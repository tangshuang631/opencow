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
      actual.createSearchEnabledState(actual.createInitialWorkbenchState(), {
        provider: "Tavily",
        query: "软件体系设计 享元模式 内部状态 外部状态",
        sourceTitle: "Flyweight pattern reference",
        sourceUrl: "https://example.test/flyweight",
        summary: "享元模式通常把可共享且不随上下文变化的数据称为内部状态，把随使用场景变化的数据称为外部状态。"
      })
  };
});

describe("App chat search context", () => {
  it("passes compressed enabled-search references to the selected local model for ordinary chat", async () => {
    searchNetworkMock.mockResolvedValue({
      query: "软件体系设计的享元模式易懂的解释,以及它的内部状态和外部状态是什么",
      provider: "Tavily",
      effective_provider: "Tavily",
      used_fallback: false,
      fallback_reason: null,
      items: [
        {
          title: "Flyweight pattern reference",
          url: "https://example.test/flyweight",
          summary: "享元模式通常把可共享且不随上下文变化的数据称为内部状态，把随使用场景变化的数据称为外部状态。"
        }
      ]
    });
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "享元模式会共享内部状态，并把场景相关的外部状态从调用处传入。"
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "软件体系设计的享元模式易懂的解释,以及它的内部状态和外部状态是什么" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen3.6:35b",
      message: expect.stringContaining("联网搜索参考")
    }));
    expect(chatWithOllamaModelMock.mock.calls[0]?.[0].requestId).toMatch(/^local-model-chat-/);
    expect(chatWithOllamaModelMock.mock.calls[0]?.[0].signal).toBeInstanceOf(AbortSignal);
    expect(chatWithOllamaModelMock.mock.calls[0]?.[0].message).toContain("只作为参考，不要盲信");
    expect(chatWithOllamaModelMock.mock.calls[0]?.[0].message).toContain("Flyweight pattern reference");
    expect(chatWithOllamaModelMock.mock.calls[0]?.[0].message).toContain("https://example.test/flyweight");
    expect(chatWithOllamaModelMock.mock.calls[0]?.[0].message).toContain("用户问题：软件体系设计的享元模式");
  });

  it("records selected Ollama model and bounded search context in the audit log", async () => {
    searchNetworkMock.mockResolvedValue({
      query: "软件体系设计的享元模式",
      provider: "Tavily",
      effective_provider: "Tavily",
      used_fallback: false,
      fallback_reason: null,
      items: [
        {
          title: "Flyweight pattern reference",
          url: "https://example.test/flyweight",
          summary: "享元模式通常把可共享且不随上下文变化的数据称为内部状态，把随使用场景变化的数据称为外部状态。"
        }
      ]
    });
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "享元模式会共享内部状态，并把场景相关的外部状态从调用处传入。"
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "软件体系设计的享元模式" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText(/享元模式会共享内部状态/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "审计" }));

    const auditPanel = await screen.findByRole("region", { name: "审计" });

    expect(within(auditPanel).getAllByText(/Ollama model: qwen3\.6:35b/).length).toBeGreaterThan(0);
    expect(within(auditPanel).getAllByText(/Search context items: 1\/3/).length).toBeGreaterThan(0);
    expect(within(auditPanel).getAllByText(/Search provider: Tavily/).length).toBeGreaterThan(0);
  });
});
