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

  it("searches imported local knowledge and shows a local RAG-style result summary", async () => {
    render(<WebApp />);

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));
    fireEvent.click(screen.getByRole("button", { name: "加入知识库：web-history-mvp.md" }));
    fireEvent.click(screen.getByRole("button", { name: "加入知识库：npc-notes.txt" }));

    fireEvent.click(screen.getByRole("button", { name: "会话" }));
    fireEvent.change(getComposerInput(), {
      target: { value: "search local knowledge for browser history" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(conversation).getByText("本地 RAG 文档检索")).toBeInTheDocument();
      expect(within(conversation).getByText(/找到 2 条匹配片段，已索引 2 个文档。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/主要来源：/)).toBeInTheDocument();
      expect(within(conversation).getAllByText(/npc-notes\.txt/).length).toBeGreaterThan(0);
      expect(within(conversation).getAllByText(/web-history-mvp\.md/).length).toBeGreaterThan(0);
      expect(within(conversation).getByText(/检索问题：search local knowledge for browser history。/)).toBeInTheDocument();
    });
  });

  it("shows structured readonly capability details for skills, npc, and mcp requests", async () => {
    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "show skills capability overview" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(conversation).getByText("Skills 网页端能力概览")).toBeInTheDocument();
      expect(within(conversation).getByText(/状态：partial-foundation。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/样例项：coding-agent、docs-helper。/)).toBeInTheDocument();
      expect(within(conversation).getAllByText(/下一步优先补启用列表、匹配结果和安全确认前置展示。/).length).toBeGreaterThan(0);
    });

    fireEvent.change(getComposerInput(), {
      target: { value: "show npc capability overview" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText("NPC 网页端能力概览")).toBeInTheDocument();
      expect(within(conversation).getByText(/样例项：课程助手 NPC、文档处理 NPC。/)).toBeInTheDocument();
      expect(within(conversation).getAllByText(/网页端先给出 NPC 的状态、样例角色和协作入口。/).length).toBeGreaterThan(0);
    });

    fireEvent.change(getComposerInput(), {
      target: { value: "show mcp capability overview" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText("MCP 网页端能力概览")).toBeInTheDocument();
      expect(within(conversation).getByText(/样例项：browser、codex-supervisor。/)).toBeInTheDocument();
      expect(within(conversation).getAllByText(/下一步优先补插件扫描结果、激活方式和受控启动预览。/).length).toBeGreaterThan(0);
    });
  });

  it("shows readonly local skills scan, enabled list, and detail results on web", async () => {
    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "scan local skills for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(conversation).getByText(/扫描到 3 个本地 Skills，覆盖 2 个扫描根目录。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/已启用项：coding-agent。/)).toBeInTheDocument();
    });

    fireEvent.change(getComposerInput(), {
      target: { value: "show enabled skills for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText(/当前启用 1 个本地 Skill。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/注册表：\.opencow\/skills\/enabled-skills\.json。/)).toBeInTheDocument();
    });

    fireEvent.change(getComposerInput(), {
      target: { value: "show details for the coding-agent skill" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText(/找到 1 个匹配 Skill，覆盖 2 个扫描根目录。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/匹配项：coding-agent。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/启用状态：已启用。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/内容预览：Use this skill when implementing focused coding tasks/)).toBeInTheDocument();
    });
  });
});
