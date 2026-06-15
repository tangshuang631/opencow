import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const { cancelOllamaChatMock, chatWithOllamaModelMock, loadOllamaOverviewMock } = vi.hoisted(() => ({
  cancelOllamaChatMock: vi.fn(),
  chatWithOllamaModelMock: vi.fn(),
  loadOllamaOverviewMock: vi.fn()
}));

vi.mock("../features/ollama/ollamaService", () => ({
  cancelOllamaChat: cancelOllamaChatMock,
  chatWithOllamaModel: chatWithOllamaModelMock,
  loadOllamaOverview: loadOllamaOverviewMock
}));

function getComposerInput() {
  return screen.getByLabelText("输入任务");
}

function getComposerSendButton() {
  return screen.getByRole("button", { name: "发送" });
}

function getConversationRegion() {
  return screen.getByRole("region", { name: "会话" });
}

describe("App workbench persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    cancelOllamaChatMock.mockReset();
    chatWithOllamaModelMock.mockReset();
    loadOllamaOverviewMock.mockReset();
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
  });

  it("restores conversation history after the app remounts", async () => {
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "历史记录恢复测试回答。"
    });

    const firstRender = render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(getComposerInput(), {
      target: { value: "帮我记住这一轮对话" }
    });
    fireEvent.click(getComposerSendButton());

    const firstConversation = getConversationRegion();
    await waitFor(() => {
      expect(within(firstConversation).getAllByText("帮我记住这一轮对话").length).toBeGreaterThan(0);
      expect(within(firstConversation).getByText("历史记录恢复测试回答。")).toBeInTheDocument();
    });

    firstRender.unmount();

    render(<App />);

    const restoredConversation = await screen.findByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(restoredConversation).getAllByText("帮我记住这一轮对话").length).toBeGreaterThan(0);
      expect(within(restoredConversation).getByText("历史记录恢复测试回答。")).toBeInTheDocument();
    });
  });

  it("keeps the conversation cleared across remounts after the user manually clears it", async () => {
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "这条历史稍后应该被手动清掉。"
    });

    const firstRender = render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(getComposerInput(), {
      target: { value: "生成一条会被清空的历史" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(screen.getAllByText("生成一条会被清空的历史").length).toBeGreaterThan(0);
      expect(screen.getByText("这条历史稍后应该被手动清掉。")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.click(screen.getByRole("button", { name: "清空会话" }));
    fireEvent.click(screen.getByRole("button", { name: "新对话" }));

    const clearedConversation = getConversationRegion();
    await waitFor(() => {
      expect(within(clearedConversation).queryByText("生成一条会被清空的历史")).not.toBeInTheDocument();
      expect(within(clearedConversation).queryByText("这条历史稍后应该被手动清掉。")).not.toBeInTheDocument();
    });

    firstRender.unmount();

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "新对话" }));

    const restoredConversation = getConversationRegion();
    await waitFor(() => {
      expect(within(restoredConversation).queryByText("生成一条会被清空的历史")).not.toBeInTheDocument();
      expect(within(restoredConversation).queryByText("这条历史稍后应该被手动清掉。")).not.toBeInTheDocument();
    });
  });
});
