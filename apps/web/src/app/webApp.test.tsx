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
      expect(
        within(conversation).getByText(/命中片段：npc-notes\.txt: NPC web preview keeps browser history guidance/)
      ).toBeInTheDocument();
      expect(
        within(conversation).getByText(/命中片段：web-history-mvp\.md: # Web History MVP Keep recent conversations/)
      ).toBeInTheDocument();
    });
  });

  it("removes imported knowledge files and makes them available for re-import", async () => {
    render(<WebApp />);

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));
    fireEvent.click(screen.getByRole("button", { name: "加入知识库：web-history-mvp.md" }));

    const knowledgePanel = screen.getByLabelText("知识库");
    await waitFor(() => {
      expect(within(knowledgePanel).getByText("已索引文件 1")).toBeInTheDocument();
      expect(within(knowledgePanel).getByText("web-history-mvp.md")).toBeInTheDocument();
    });

    fireEvent.click(within(knowledgePanel).getByRole("button", { name: "移出知识库：web-history-mvp.md" }));

    await waitFor(() => {
      expect(within(knowledgePanel).getByText("已索引文件 0")).toBeInTheDocument();
      expect(within(knowledgePanel).getByText("还没有已纳入知识库的文件。先从下方候选文件中手动加入。")).toBeInTheDocument();
      expect(within(knowledgePanel).getByRole("button", { name: "加入知识库：web-history-mvp.md" })).toBeInTheDocument();
    });
  });

  it("clears all imported knowledge entries and resets knowledge count", async () => {
    render(<WebApp />);

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));
    fireEvent.click(screen.getByRole("button", { name: "加入知识库：web-history-mvp.md" }));
    fireEvent.click(screen.getByRole("button", { name: "加入知识库：npc-notes.txt" }));

    const knowledgePanel = screen.getByLabelText("知识库");
    await waitFor(() => {
      expect(within(knowledgePanel).getByText("已索引文件 2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.click(screen.getByRole("button", { name: "清空知识库索引" }));
    fireEvent.click(screen.getByRole("button", { name: "知识库" }));

    const resetKnowledgePanel = screen.getByLabelText("知识库");
    await waitFor(() => {
      expect(within(resetKnowledgePanel).getByText("已索引文件 0")).toBeInTheDocument();
      expect(within(resetKnowledgePanel).getByRole("button", { name: "加入知识库：web-history-mvp.md" })).toBeInTheDocument();
      expect(within(resetKnowledgePanel).getByRole("button", { name: "加入知识库：npc-notes.txt" })).toBeInTheDocument();
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

  it("shows local skill install result on web", async () => {
    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "install the gpt-taste skill into this workspace skills folder" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(conversation).getByText("本地 Skill 安装结果")).toBeInTheDocument();
      expect(within(conversation).getByText(/已安装 Skill：gpt-taste。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/安装路径：skills\/gpt-taste\/SKILL\.md。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/来源：vendor\/openclaw\/skills\/gpt-taste\/SKILL\.md。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/状态：installed。/)).toBeInTheDocument();
    });
  });

  it("shows local skill enable result on web", async () => {
    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "enable the coding-agent skill for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(conversation).getByText("本地 Skill 启用结果")).toBeInTheDocument();
      expect(within(conversation).getByText(/已启用 Skill：coding-agent。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/注册表：\.opencow\/skills\/enabled-skills\.json。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/状态：enabled。/)).toBeInTheDocument();
    });
  });

  it("shows readonly npc collaboration preview on web", async () => {
    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "preview an npc collaboration plan for local shell permission rules" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(conversation).getByText(/状态：ready-foundation。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/已启用 Skills：coding-agent。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/注册表：\.opencow\/skills\/enabled-skills\.json。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/本地上下文：04-permission-safety-shell\.md、OPENCOW_CORE_RULES\.md。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/已索引文档：7。/)).toBeInTheDocument();
    });
  });

  it("shows readonly npc shell plan preview on web", async () => {
    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "preview an npc collaboration shell plan to delete temp-output" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(conversation).getByText(/推荐 Skill：shell-automation。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/命令预览：Remove-Item -Recurse -Force temp-output/)).toBeInTheDocument();
      expect(within(conversation).getByText(/工作区根目录：E:\\2026\\opencow。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/所需权限：controlled-full。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/安全状态：requires-snapshot。/)).toBeInTheDocument();
    });
  });

  it("shows readonly npc rag shell handoff preview on web", async () => {
    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: {
        value: "use npc collaboration to review local shell permission rules and preview the next safe shell step to delete temp-output"
      }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(conversation).getByText(/推荐 Skill：shell-automation。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/主要来源：04-permission-safety-shell\.md、OPENCOW_CORE_RULES\.md。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/命令预览：Remove-Item -Recurse -Force temp-output/)).toBeInTheDocument();
      expect(within(conversation).getByText(/工作区根目录：E:\\2026\\opencow。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/所需权限：controlled-full。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/安全状态：requires-snapshot。/)).toBeInTheDocument();
    });
  });

  it("shows readonly local mcp plugin scan on web", async () => {
    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "scan local mcp plugins and list available model context protocol entries" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(conversation).getByText(/扫描到 2 个本地 MCP 插件入口，覆盖 2 个扫描根目录。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/样例插件：browser、codex-supervisor。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/激活方式：browser=startup、codex-supervisor=manual。/)).toBeInTheDocument();
    });
  });

  it("shows readonly local mcp plugin detail on web", async () => {
    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "show details for the browser mcp plugin" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(conversation).getByText(/找到 1 个匹配 MCP 插件，覆盖 2 个扫描根目录。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/匹配项：browser。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/激活方式：startup。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/工具：browser。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/Skills 路径：\.\/skills。/)).toBeInTheDocument();
    });
  });

  it("shows readonly local mcp plugin start preview on web", async () => {
    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "preview starting the browser mcp plugin locally" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(conversation).getByText(/找到 1 个可预览 MCP 插件，覆盖 2 个扫描根目录。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/匹配项：browser。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/允许启动：否。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/命令预览：当前桌面端尚未实现已验证的 MCP 插件启动器。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/配置提示：未检测到必填配置项。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/风险说明：仅预览插件 manifest，不会启动真实 MCP 进程。/)).toBeInTheDocument();
    });
  });
});
