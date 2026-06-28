import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const { chatWithOllamaModelMock, loadOllamaOverviewMock } = vi.hoisted(() => ({
  chatWithOllamaModelMock: vi.fn(),
  loadOllamaOverviewMock: vi.fn()
}));

vi.mock("../features/ollama/ollamaService", () => ({
  chatWithOllamaModel: chatWithOllamaModelMock,
  loadOllamaOverview: loadOllamaOverviewMock
}));

describe("App model selection", () => {
  beforeEach(() => {
    chatWithOllamaModelMock.mockReset();
    loadOllamaOverviewMock.mockReset();
  });

  it("selects from the Ollama model list in the composer", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [
        { name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" },
        { name: "qwen3.6:35b", sizeLabel: "20 GB" }
      ]
    });

    render(<App />);

    const modelButton = await screen.findByRole("button", { name: "选择模型：qwen2.5-coder:7b" });
    fireEvent.click(modelButton);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "qwen3.6:35b 20 GB" }));

    expect(screen.getByRole("button", { name: "选择模型：qwen3.6:35b" })).toBeInTheDocument();
  });

  it("uses the newly selected Ollama model for the next ordinary chat", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [
        { name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" },
        { name: "qwen3.6:35b", sizeLabel: "20 GB" }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "已使用切换后的模型回答。"
    });

    render(<App />);

    const modelButton = await screen.findByRole("button", { name: "选择模型：qwen2.5-coder:7b" });
    fireEvent.click(modelButton);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "qwen3.6:35b 20 GB" }));
    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "解释一下享元模式" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText("已使用切换后的模型回答。")).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen3.6:35b",
      message: expect.stringContaining("解释一下享元模式")
    }));
    expect(chatWithOllamaModelMock.mock.calls[0]?.[0].message).toContain("本地知识库参考");
    expect(chatWithOllamaModelMock.mock.calls[0]?.[0].requestId).toMatch(/^local-model-chat-/);
    expect(chatWithOllamaModelMock.mock.calls[0]?.[0].signal).toBeInstanceOf(AbortSignal);
  });

  it("falls back to the first detected model when Ollama returns models but no selectedModel", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "",
      diagnostic: "",
      models: [
        { name: "gemma4:26b", sizeLabel: "17 GB" },
        { name: "qwen3.5:9b", sizeLabel: "6.6 GB" }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "gemma4:26b",
      message: "已使用自动兜底的本地模型回答。"
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：gemma4:26b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "解释一下享元模式" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText("已使用自动兜底的本地模型回答。")).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "gemma4:26b",
      message: expect.stringContaining("解释一下享元模式")
    }));
    expect(chatWithOllamaModelMock.mock.calls[0]?.[0].message).toContain("本地知识库参考");
  });
});
