import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const { loadOllamaOverviewMock } = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn()
}));

vi.mock("../features/ollama/ollamaService", () => ({
  loadOllamaOverview: loadOllamaOverviewMock
}));

describe("App chat fallback", () => {
  it("handles ordinary Chinese chat input without failing the local task chain", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });

    render(<App />);

    await screen.findAllByText("qwen3.6:35b");

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "你能帮我做什么" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getAllByText(/Workspace overview|本地任务执行完成/).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("本地任务执行失败")).not.toBeInTheDocument();
  });
});
