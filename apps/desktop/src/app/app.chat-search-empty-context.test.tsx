import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const { chatWithOllamaModelMock, loadOllamaOverviewMock, searchNetworkMock } = vi.hoisted(() => ({
  chatWithOllamaModelMock: vi.fn(),
  loadOllamaOverviewMock: vi.fn(),
  searchNetworkMock: vi.fn()
}));

vi.mock("../features/ollama/ollamaService", () => ({
  chatWithOllamaModel: chatWithOllamaModelMock,
  loadOllamaOverview: loadOllamaOverviewMock
}));

vi.mock("../features/assistant/localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("../features/assistant/localAssistantService")>(
    "../features/assistant/localAssistantService"
  );

  return {
    ...actual,
    searchNetwork: searchNetworkMock
  };
});

vi.mock("../features/workbench/workbenchState", async () => {
  const actual = await vi.importActual<typeof import("../features/workbench/workbenchState")>(
    "../features/workbench/workbenchState"
  );

  return {
    ...actual,
    createInitialWorkbenchState: () =>
      actual.createSearchToggleState(actual.createInitialWorkbenchState(), {
        enabled: true,
        providerLabel: "Tavily"
      })
  };
});

describe("App chat search empty context", () => {
  it("does not invoke search for a stable question when the search toggle is enabled", async () => {
    searchNetworkMock.mockRejectedValue(new Error("OpenCow 默认搜索当前不可用"));
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "我会基于已有知识回答，并说明本轮没有可用联网来源。"
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "解释一下享元模式" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
    });
    expect(searchNetworkMock).not.toHaveBeenCalled();
    expect(chatWithOllamaModelMock.mock.calls[0]?.[0].message).toContain("普通对话任务");
    expect(chatWithOllamaModelMock.mock.calls[0]?.[0].message).not.toContain("联网搜索已开启，但本轮没有可用外部来源");

    await waitFor(() => {
      expect(screen.getByText(/我会基于已有知识回答/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "审计" }));
    const auditPanel = await screen.findByRole("region", { name: "审计" });

    expect(within(auditPanel).getAllByText(/Search context status: enabled-not-required/).length).toBeGreaterThan(0);
  });
});
