import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { WebApp } from "./WebApp";

function getComposerInput() {
  return screen.getByLabelText("输入任务");
}

function getComposerSendButton() {
  return screen.getByRole("button", { name: "发送" });
}

describe("WebApp", () => {
  it("restores browser conversation history after remount", async () => {
    const firstRender = render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "请在网页端保留这段历史" }
    });
    fireEvent.click(getComposerSendButton());

    const firstConversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(firstConversation).getAllByText("请在网页端保留这段历史").length).toBeGreaterThan(0);
      expect(within(firstConversation).getByText("已为网页端保留这段上下文：请在网页端保留这段历史")).toBeInTheDocument();
    });

    firstRender.unmount();

    render(<WebApp />);

    const restoredConversation = await screen.findByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(restoredConversation).getAllByText("请在网页端保留这段历史").length).toBeGreaterThan(0);
      expect(within(restoredConversation).getByText("已为网页端保留这段上下文：请在网页端保留这段历史")).toBeInTheDocument();
    });
  });

  it("keeps recent conversations available after starting a blank conversation", async () => {
    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "把这段网页端对话放进最近会话" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(screen.getAllByText("把这段网页端对话放进最近会话").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "新对话" }));

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(conversation).getByText("最近会话")).toBeInTheDocument();
      expect(within(conversation).getByText("把这段网页端对话放进最近会话")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "恢复这段会话" }));

    await waitFor(() => {
      expect(within(conversation).getAllByText("把这段网页端对话放进最近会话").length).toBeGreaterThan(0);
      expect(within(conversation).getByText("已为网页端保留这段上下文：把这段网页端对话放进最近会话")).toBeInTheDocument();
    });
  });

  it("removes recent conversations permanently after manual deletion", async () => {
    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "这段最近会话稍后会被删除" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(screen.getAllByText("这段最近会话稍后会被删除").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "新对话" }));
    fireEvent.click(screen.getByRole("button", { name: "最近会话" }));
    fireEvent.click(screen.getByRole("button", { name: "删除这段会话" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "恢复这段会话" })).not.toBeInTheDocument();
      expect(screen.queryByText("这段最近会话稍后会被删除")).not.toBeInTheDocument();
    });
  });

  it("persists imported md/txt knowledge entries across remounts", async () => {
    const firstRender = render(<WebApp />);

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));
    fireEvent.click(screen.getByRole("button", { name: "加入知识库：web-history-mvp.md" }));
    fireEvent.click(screen.getByRole("button", { name: "加入知识库：npc-notes.txt" }));

    const knowledgePanel = screen.getByLabelText("知识库");
    await waitFor(() => {
      expect(within(knowledgePanel).getByText("已索引文件 2")).toBeInTheDocument();
      expect(within(knowledgePanel).getByText("web-history-mvp.md")).toBeInTheDocument();
      expect(within(knowledgePanel).getByText("npc-notes.txt")).toBeInTheDocument();
    });

    firstRender.unmount();

    render(<WebApp />);

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));

    const restoredKnowledgePanel = screen.getByLabelText("知识库");
    await waitFor(() => {
      expect(within(restoredKnowledgePanel).getByText("已索引文件 2")).toBeInTheDocument();
      expect(within(restoredKnowledgePanel).getByText("web-history-mvp.md")).toBeInTheDocument();
      expect(within(restoredKnowledgePanel).getByText("npc-notes.txt")).toBeInTheDocument();
    });
  });
});
