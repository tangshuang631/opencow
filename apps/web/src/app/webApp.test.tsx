import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebApp } from "./WebApp";

const { loadOllamaOverviewMock, chatWithOllamaModelMock } = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn(),
  chatWithOllamaModelMock: vi.fn()
}));
const { loadOpenClawCapabilityOverviewMock } = vi.hoisted(() => ({
  loadOpenClawCapabilityOverviewMock: vi.fn()
}));
const fetchMock = vi.fn();

vi.mock("../../../desktop/src/features/assistant/localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("../../../desktop/src/features/assistant/localAssistantService")>(
    "../../../desktop/src/features/assistant/localAssistantService"
  );

  return {
    ...actual,
    loadOpenClawCapabilityOverview: loadOpenClawCapabilityOverviewMock
  };
});

vi.mock("../../../desktop/src/features/ollama/ollamaService", async () => {
  const actual = await vi.importActual<typeof import("../../../desktop/src/features/ollama/ollamaService")>(
    "../../../desktop/src/features/ollama/ollamaService"
  );

  return {
    ...actual,
    loadOllamaOverview: loadOllamaOverviewMock,
    chatWithOllamaModel: chatWithOllamaModelMock
  };
});

function getComposerInput() {
  return screen.getByLabelText("输入任务");
}

function getComposerSendButton() {
  return screen.getByRole("button", { name: "发送" });
}

describe("WebApp", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    fetchMock.mockReset();
    loadOpenClawCapabilityOverviewMock.mockReset();
    loadOllamaOverviewMock.mockReset();
    chatWithOllamaModelMock.mockReset();
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen2.5-coder:7b",
      message: "工厂模式是一种创建型设计模式，用工厂方法封装对象创建逻辑，让调用方不直接依赖具体类。",
      doneReason: "stop"
    });
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [
        { name: "gemma4:12b", sizeLabel: "7.2 GB" },
        { name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" },
        { name: "gemma4:e4b", sizeLabel: "3.2 GB" },
        { name: "qwen3.5:9b", sizeLabel: "6.6 GB" }
      ]
    });
    loadOpenClawCapabilityOverviewMock.mockImplementation(async (capabilityId: "rag" | "skills" | "npc" | "mcp") => ({
      capability_id: capabilityId,
      title: capabilityId.toUpperCase(),
      status: capabilityId === "rag" ? "ready-foundation" : "partial-foundation",
      required_package_count: 3,
      available_package_count: capabilityId === "rag" ? 3 : 2,
      available_packages: capabilityId === "skills"
        ? ["@openclaw/plugin-sdk", "@openclaw/skill-runtime"]
        : capabilityId === "npc"
          ? ["@openclaw/llm-runtime", "@openclaw/npc-runtime"]
          : capabilityId === "mcp"
            ? ["@openclaw/plugin-sdk", "@openclaw/mcp-registry"]
            : ["@openclaw/llm-core", "@openclaw/llm-runtime", "@openclaw/model-catalog-core"],
      missing_packages: capabilityId === "rag" ? [] : [`missing-${capabilityId}-bridge`],
      summary: `real ${capabilityId} capability summary from openclaw`
    }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("loads the current local Ollama models into the web composer", async () => {
    render(<WebApp />);

    const modelButton = await screen.findByRole("button", { name: "选择模型：qwen2.5-coder:7b" });
    fireEvent.click(modelButton);

    expect(await screen.findByRole("menuitemradio", { name: "gemma4:12b 7.2 GB" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "qwen2.5-coder:7b 4.1 GB" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "gemma4:e4b 3.2 GB" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "qwen3.5:9b 6.6 GB" })).toBeInTheDocument();
  });

  it("switches the active web model from the real local Ollama list", async () => {
    render(<WebApp />);

    const modelButton = await screen.findByRole("button", { name: "选择模型：qwen2.5-coder:7b" });
    fireEvent.click(modelButton);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "qwen3.5:9b 6.6 GB" }));

    expect(await screen.findByRole("button", { name: "选择模型：qwen3.5:9b" })).toBeInTheDocument();
  });

  it("restores browser conversation history after remount", async () => {
    const firstRender = render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "请在网页端保留这段历史" }
    });
    fireEvent.click(getComposerSendButton());

    const firstConversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(firstConversation).getAllByText("请在网页端保留这段历史").length).toBeGreaterThan(0);
      expect(within(firstConversation).getByText(/工厂模式是一种创建型设计模式/)).toBeInTheDocument();
      expect(within(firstConversation).queryByText(/Web MVP keeps browser history/)).not.toBeInTheDocument();
    });

    firstRender.unmount();

    render(<WebApp />);

    const restoredConversation = await screen.findByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(restoredConversation).getAllByText("请在网页端保留这段历史").length).toBeGreaterThan(0);
      expect(within(restoredConversation).getByText(/工厂模式是一种创建型设计模式/)).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "创建新会话" }));

    const blankConversation = screen.getByRole("region", { name: "会话" });
    expect(within(blankConversation).queryByText("把这段网页端对话放进最近会话")).not.toBeInTheDocument();
    expect(within(blankConversation).queryByText(/工厂模式是一种创建型设计模式/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "会话" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "打开会话：把这段网页端对话放进最近会话" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "打开会话：把这段网页端对话放进最近会话" }));

    const conversation = screen.getByRole("region", { name: "会话" });

    await waitFor(() => {
      expect(within(conversation).getAllByText("把这段网页端对话放进最近会话").length).toBeGreaterThan(0);
      expect(within(conversation).getByText(/工厂模式是一种创建型设计模式/)).toBeInTheDocument();
    });
  });

  it("uses Ollama for ordinary web chat instead of the local MVP placeholder", async () => {
    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "工厂模式是什么" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
      expect(within(conversation).getByText(/工厂模式是一种创建型设计模式/)).toBeInTheDocument();
    });

    expect(within(conversation).queryByText(/已为网页端保留这段上下文/)).not.toBeInTheDocument();
    expect(within(conversation).queryByText(/Web MVP keeps browser history/)).not.toBeInTheDocument();
  });

  it("does not render fallback copy as a fake model answer when Ollama chat fails", async () => {
    chatWithOllamaModelMock.mockRejectedValueOnce(new Error("ollama unavailable"));
    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "工厂模式是什么" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });

    await waitFor(() => {
      expect(within(conversation).getByText("本地模型回复失败")).toBeInTheDocument();
    });

    expect(within(conversation).queryByText("本地模型答复")).not.toBeInTheDocument();
    expect(within(conversation).queryByText(/本地模型暂时没有返回完整结果/)).not.toBeInTheDocument();
    expect(within(conversation).queryByText(/已为网页端保留这段上下文/)).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "创建新会话" }));
    fireEvent.click(screen.getByRole("button", { name: "会话" }));
    fireEvent.click(screen.getByRole("button", { name: "删除会话：这段最近会话稍后会被删除" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "打开会话：这段最近会话稍后会被删除" })).not.toBeInTheDocument();
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
      expect(within(conversation).getByText("检索命中")).toBeInTheDocument();
      expect(within(conversation).getByText("来源文件：npc-notes.txt")).toBeInTheDocument();
      expect(within(conversation).getByText("来源文件：web-history-mvp.md")).toBeInTheDocument();
      expect(within(conversation).getAllByText(/匹配分数：10/).length).toBeGreaterThan(0);
    });
  });

  it("supports follow-up search by clicking a matched knowledge source", async () => {
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
      expect(within(conversation).getByRole("button", { name: "只看来源：npc-notes.txt" })).toBeInTheDocument();
    });

    fireEvent.click(within(conversation).getByRole("button", { name: "只看来源：npc-notes.txt" }));

    await waitFor(() => {
      expect(within(conversation).getAllByText(/知识库：默认知识库。/).length).toBeGreaterThanOrEqual(2);
      expect(within(conversation).getByText(/找到 1 条匹配片段，已索引 2 个文档。/)).toBeInTheDocument();
      expect(within(conversation).getAllByText(/主要来源：npc-notes\.txt。/).length).toBeGreaterThanOrEqual(1);
      expect(
        within(conversation).getAllByText(/检索问题：search local knowledge in npc-notes\.txt for browser history。/).length
      ).toBeGreaterThanOrEqual(1);
      expect(within(conversation).getAllByText("来源文件：web-history-mvp.md").length).toBe(1);
    });
  });

  it("answers a long local question with a real Ollama browser-preview response instead of echoing the full input on the right", async () => {
    const chunks = [
      {
        model: "qwen2.5-coder:7b",
        message: { content: "结论：错误项是 A。\n\n" }
      },
      {
        model: "qwen2.5-coder:7b",
        message: { content: "理由：m2 中对 x 的一次引用会绑定到 m2 自己定义的 x。" },
        done_reason: "stop"
      }
    ];
    fetchMock.mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(new TextEncoder().encode(`${JSON.stringify(chunk)}\n`));
          }
          controller.close();
        }
      })
    });

    render(<WebApp />);

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));
    fireEvent.click(screen.getByRole("button", { name: "加入知识库：web-history-mvp.md" }));
    fireEvent.click(screen.getByRole("button", { name: "加入知识库：npc-notes.txt" }));
    fireEvent.click(screen.getByRole("button", { name: "会话" }));

    const longInput = [
      "请基于本地知识库回答这个长问题并给出简要解析，重点说明 browser history 在网页端预览里为什么不能自动消失。",
      "我想确认 web history MVP 是不是要求 recent conversations 一直保留到用户手动删除，",
      "同时 npc web preview 的说明里是不是也提到 keeps browser history guidance、readonly capability notes 和 staged execution reminders。",
      "如果这些规则同时成立，请先直接给结论，再用两三句话解释网页端为什么要保留最近会话、知识来源和回查入口，",
      "不要整段复读我的题干，但要参考 browser history、recent conversations、npc web preview 这些关键词。"
    ].join(" ");

    fireEvent.change(getComposerInput(), {
      target: { value: longInput }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    const inspector = screen.getByLabelText("右侧面板");

    await waitFor(() => {
      expect(within(conversation).getByText("本地模型答复")).toBeInTheDocument();
      expect(within(conversation).getByText(/工厂模式是一种创建型设计模式/)).toBeInTheDocument();
      expect(within(conversation).getByText("检索命中")).toBeInTheDocument();
      expect(within(conversation).getByText("来源文件：npc-notes.txt")).toBeInTheDocument();
      expect(within(conversation).getByText("来源文件：web-history-mvp.md")).toBeInTheDocument();
      expect(within(conversation).getByRole("button", { name: "只看来源：npc-notes.txt" })).toBeInTheDocument();
    });

    expect(within(inspector).queryByText("输出")).not.toBeInTheDocument();
    expect(within(inspector).queryByText(/工厂模式是一种创建型设计模式/)).not.toBeInTheDocument();
    expect(within(inspector).queryByText(longInput)).not.toBeInTheDocument();
    expect(within(conversation).queryByText(longInput)).not.toBeInTheDocument();
    expect(within(conversation).getByRole("button", { name: "展开完整输入" })).toBeInTheDocument();
  });

  it("uses Ollama for long local-history prompts instead of a canned fallback", async () => {
    render(<WebApp />);

    const longInput = Array.from(
      { length: 16 },
      (_, index) => `第${index + 1}段：请继续保留网页端最近会话，直到用户手动删除，不要自动清空。`
    ).join(" ");

    fireEvent.change(getComposerInput(), {
      target: { value: longInput }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });

    await waitFor(() => {
      expect(within(conversation).getByText("本地模型答复")).toBeInTheDocument();
      expect(within(conversation).getByText(/工厂模式是一种创建型设计模式/)).toBeInTheDocument();
    });

    expect(chatWithOllamaModelMock).toHaveBeenCalled();
    expect(within(conversation).queryByText(/结论：网页端最近会话应该持续保留/)).not.toBeInTheDocument();
    expect(within(conversation).queryByText(longInput)).not.toBeInTheDocument();
    expect(within(conversation).getByRole("button", { name: "展开完整输入" })).toBeInTheDocument();
  });

  it("imports a real local md/txt file into the current knowledge library", async () => {
    render(<WebApp />);

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));

    const uploadInput = screen.getByLabelText("导入本地 md/txt 文件");
    const file = new File(
      ["# 产品规则\n\nOpenCow web upload keeps real project notes searchable."],
      "product-rules.md",
      { type: "text/markdown" }
    );

    fireEvent.change(uploadInput, {
      target: {
        files: [file]
      }
    });

    const knowledgePanel = screen.getByLabelText("知识库");
    await waitFor(() => {
      expect(within(knowledgePanel).getByText("已索引文件 1")).toBeInTheDocument();
      expect(within(knowledgePanel).getByText("product-rules.md")).toBeInTheDocument();
      expect(within(knowledgePanel).getAllByText("本地上传").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "会话" }));
    fireEvent.change(getComposerInput(), {
      target: { value: "search local knowledge for project notes" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(conversation).getByText("本地 RAG 文档检索")).toBeInTheDocument();
      expect(within(conversation).getByText(/找到 1 条匹配片段，已索引 1 个文档。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/主要来源：product-rules\.md。/)).toBeInTheDocument();
    });
  });

  it("persists uploaded local md/txt files across remounts", async () => {
    const firstRender = render(<WebApp />);

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));

    const uploadInput = screen.getByLabelText("导入本地 md/txt 文件");
    const file = new File(
      ["# Team Notes\n\nPersist uploaded browser knowledge across remounts."],
      "team-notes.md",
      { type: "text/markdown" }
    );

    fireEvent.change(uploadInput, {
      target: {
        files: [file]
      }
    });

    const knowledgePanel = screen.getByLabelText("知识库");
    await waitFor(() => {
      expect(within(knowledgePanel).getByText("team-notes.md")).toBeInTheDocument();
      expect(within(knowledgePanel).getAllByText("本地上传").length).toBeGreaterThan(0);
    });

    firstRender.unmount();

    render(<WebApp />);
    fireEvent.click(screen.getByRole("button", { name: "知识库" }));

    const restoredKnowledgePanel = screen.getByLabelText("知识库");
    await waitFor(() => {
      expect(within(restoredKnowledgePanel).getByText("已索引文件 1")).toBeInTheDocument();
      expect(within(restoredKnowledgePanel).getByText("team-notes.md")).toBeInTheDocument();
      expect(within(restoredKnowledgePanel).getAllByText("本地上传").length).toBeGreaterThan(0);
    });
  });

  it("imports multiple local md/txt files into the current knowledge library in one selection", async () => {
    render(<WebApp />);

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));

    const uploadInput = screen.getByLabelText("导入本地 md/txt 文件");
    const files = [
      new File(["# Alpha\n\nProject planning notes."], "alpha.md", { type: "text/markdown" }),
      new File(["Beta release checklist"], "beta.txt", { type: "text/plain" })
    ];

    fireEvent.change(uploadInput, {
      target: {
        files
      }
    });

    const knowledgePanel = screen.getByLabelText("知识库");
    await waitFor(() => {
      expect(within(knowledgePanel).getByText("已索引文件 2")).toBeInTheDocument();
      expect(within(knowledgePanel).getByText("alpha.md")).toBeInTheDocument();
      expect(within(knowledgePanel).getByText("beta.txt")).toBeInTheDocument();
    });
  });

  it("imports local md/txt files by drag and drop", async () => {
    render(<WebApp />);

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));

    const uploadInput = screen.getByLabelText("导入本地 md/txt 文件");
    const files = [
      new File(["Dragged markdown content"], "drag-notes.md", { type: "text/markdown" }),
      new File(["Dragged txt content"], "drag-checklist.txt", { type: "text/plain" })
    ];

    fireEvent.dragOver(uploadInput);
    fireEvent.drop(uploadInput, {
      dataTransfer: {
        files
      }
    });

    const knowledgePanel = screen.getByLabelText("知识库");
    await waitFor(() => {
      expect(within(knowledgePanel).getByText("已索引文件 2")).toBeInTheDocument();
      expect(within(knowledgePanel).getByText("drag-notes.md")).toBeInTheDocument();
      expect(within(knowledgePanel).getByText("drag-checklist.txt")).toBeInTheDocument();
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

  it("keeps named knowledge libraries after clearing indexed knowledge", async () => {
    render(<WebApp />);

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));
    fireEvent.change(screen.getByRole("textbox", { name: "新知识库名称" }), {
      target: { value: "规则库" }
    });
    fireEvent.click(screen.getByRole("button", { name: "创建知识库" }));
    fireEvent.click(screen.getByRole("button", { name: "加入知识库：npc-notes.txt" }));

    const knowledgePanel = screen.getByLabelText("知识库");
    await waitFor(() => {
      expect(within(knowledgePanel).getByText("当前知识库：规则库")).toBeInTheDocument();
      expect(within(knowledgePanel).getByText("已索引文件 1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.click(screen.getByRole("button", { name: "清空知识库索引" }));
    fireEvent.click(screen.getByRole("button", { name: "知识库" }));

    const clearedKnowledgePanel = screen.getByLabelText("知识库");
    await waitFor(() => {
      expect(within(clearedKnowledgePanel).getByText("当前知识库：规则库")).toBeInTheDocument();
      expect(within(clearedKnowledgePanel).getByRole("button", { name: "切换到知识库：默认知识库" })).toBeInTheDocument();
      expect(within(clearedKnowledgePanel).getByRole("button", { name: "当前知识库：规则库" })).toBeInTheDocument();
      expect(within(clearedKnowledgePanel).getByText("已索引文件 0")).toBeInTheDocument();
      expect(within(clearedKnowledgePanel).getByRole("button", { name: "加入知识库：npc-notes.txt" })).toBeInTheDocument();
    });
  });

  it("creates and persists named knowledge libraries across remounts", async () => {
    const firstRender = render(<WebApp />);

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));
    fireEvent.change(screen.getByRole("textbox", { name: "新知识库名称" }), {
      target: { value: "产品文档库" }
    });
    fireEvent.click(screen.getByRole("button", { name: "创建知识库" }));

    const knowledgePanel = screen.getByLabelText("知识库");
    await waitFor(() => {
      expect(within(knowledgePanel).getByText("当前知识库：产品文档库")).toBeInTheDocument();
      expect(within(knowledgePanel).getByText("知识库列表")).toBeInTheDocument();
      expect(within(knowledgePanel).getByRole("button", { name: "切换到知识库：默认知识库" })).toBeInTheDocument();
      expect(within(knowledgePanel).getByRole("button", { name: "当前知识库：产品文档库" })).toBeInTheDocument();
    });

    firstRender.unmount();

    render(<WebApp />);
    fireEvent.click(screen.getByRole("button", { name: "知识库" }));

    const restoredKnowledgePanel = screen.getByLabelText("知识库");
    await waitFor(() => {
      expect(within(restoredKnowledgePanel).getByText("当前知识库：产品文档库")).toBeInTheDocument();
      expect(within(restoredKnowledgePanel).getByRole("button", { name: "当前知识库：产品文档库" })).toBeInTheDocument();
    });
  });

  it("switches active knowledge libraries and searches only within the current library", async () => {
    render(<WebApp />);

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));
    fireEvent.change(screen.getByRole("textbox", { name: "新知识库名称" }), {
      target: { value: "规则库" }
    });
    fireEvent.click(screen.getByRole("button", { name: "创建知识库" }));

    const knowledgePanel = screen.getByLabelText("知识库");
    await waitFor(() => {
      expect(within(knowledgePanel).getByText("当前知识库：规则库")).toBeInTheDocument();
    });

    fireEvent.click(within(knowledgePanel).getByRole("button", { name: "加入知识库：npc-notes.txt" }));

    await waitFor(() => {
      expect(within(knowledgePanel).getByText("已索引文件 1")).toBeInTheDocument();
      expect(within(knowledgePanel).getByText("npc-notes.txt")).toBeInTheDocument();
    });

    fireEvent.click(within(knowledgePanel).getByRole("button", { name: "切换到知识库：默认知识库" }));

    await waitFor(() => {
      expect(within(knowledgePanel).getByText("当前知识库：默认知识库")).toBeInTheDocument();
      expect(within(knowledgePanel).getByText("已索引文件 0")).toBeInTheDocument();
      expect(within(knowledgePanel).getByRole("button", { name: "加入知识库：npc-notes.txt" })).toBeInTheDocument();
      expect(within(knowledgePanel).queryByRole("button", { name: "移出知识库：npc-notes.txt" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "会话" }));
    fireEvent.change(getComposerInput(), {
      target: { value: "search local knowledge for browser history" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(conversation).getByText("本地 RAG 文档检索")).toBeInTheDocument();
      expect(within(conversation).getByText(/知识库：默认知识库。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/找到 0 条匹配片段，已索引 0 个文档。/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));
    fireEvent.click(screen.getByRole("button", { name: "切换到知识库：规则库" }));
    fireEvent.click(screen.getByRole("button", { name: "会话" }));
    fireEvent.change(getComposerInput(), {
      target: { value: "search local knowledge for browser history" }
    });
    fireEvent.click(getComposerSendButton());
    const switchedConversation = screen.getByRole("region", { name: "会话" });

    await waitFor(() => {
      expect(within(switchedConversation).getByText(/知识库：规则库。/)).toBeInTheDocument();
      expect(within(switchedConversation).getByText(/找到 1 条匹配片段，已索引 1 个文档。/)).toBeInTheDocument();
      expect(within(switchedConversation).getByText(/主要来源：npc-notes\.txt。/)).toBeInTheDocument();
    });
  });

  it("filters imported and available knowledge files by the current library search input", async () => {
    render(<WebApp />);

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));
    fireEvent.click(screen.getByRole("button", { name: "加入知识库：web-history-mvp.md" }));

    const knowledgePanel = screen.getByLabelText("知识库");
    const filterInput = within(knowledgePanel).getByRole("textbox", { name: "筛选当前知识库文件" });

    await waitFor(() => {
      expect(within(knowledgePanel).getByText("web-history-mvp.md")).toBeInTheDocument();
      expect(within(knowledgePanel).getByRole("button", { name: "加入知识库：npc-notes.txt" })).toBeInTheDocument();
    });

    fireEvent.change(filterInput, {
      target: { value: "history" }
    });

    await waitFor(() => {
      expect(within(knowledgePanel).getByText("web-history-mvp.md")).toBeInTheDocument();
      expect(within(knowledgePanel).queryByRole("button", { name: "加入知识库：npc-notes.txt" })).not.toBeInTheDocument();
    });

    fireEvent.change(filterInput, {
      target: { value: "npc" }
    });

    await waitFor(() => {
      expect(within(knowledgePanel).queryByText("web-history-mvp.md")).not.toBeInTheDocument();
      expect(within(knowledgePanel).getByRole("button", { name: "加入知识库：npc-notes.txt" })).toBeInTheDocument();
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
      expect(within(conversation).getByText("SKILLS 网页端能力概览")).toBeInTheDocument();
      expect(within(conversation).getByText(/状态：partial-foundation。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/可用包：@openclaw\/plugin-sdk、@openclaw\/skill-runtime。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/缺失包：missing-skills-bridge。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/real skills capability summary from openclaw/)).toBeInTheDocument();
      expect(within(conversation).getByText(/样例项：coding-agent、docs-helper。/)).toBeInTheDocument();
      expect(within(conversation).getAllByText(/下一步优先补启用列表、匹配结果和安全确认前置展示。/).length).toBeGreaterThan(0);
    });

    fireEvent.change(getComposerInput(), {
      target: { value: "show npc capability overview" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText("NPC 网页端能力概览")).toBeInTheDocument();
      expect(within(conversation).getByText(/real npc capability summary from openclaw/)).toBeInTheDocument();
      expect(within(conversation).getByText(/可用包：@openclaw\/llm-runtime、@openclaw\/npc-runtime。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/样例项：课程助手 NPC、文档处理 NPC。/)).toBeInTheDocument();
      expect(within(conversation).getAllByText(/网页端先给出 NPC 的状态、样例角色和协作入口。/).length).toBeGreaterThan(0);
    });

    fireEvent.change(getComposerInput(), {
      target: { value: "show mcp capability overview" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText("MCP 网页端能力概览")).toBeInTheDocument();
      expect(within(conversation).getByText(/real mcp capability summary from openclaw/)).toBeInTheDocument();
      expect(within(conversation).getByText(/缺失包：missing-mcp-bridge。/)).toBeInTheDocument();
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

  it("shows local skill disable result on web", async () => {
    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "disable the coding-agent skill for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(conversation).getByText("本地 Skill 禁用结果")).toBeInTheDocument();
      expect(within(conversation).getByText(/已禁用 Skill：coding-agent。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/注册表：\.opencow\/skills\/enabled-skills\.json。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/状态：disabled。/)).toBeInTheDocument();
    });
  });

  it("shows enabled local skill match result on web", async () => {
    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "which enabled skill should handle shell automation in this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(conversation).getByText("已启用 Skill 推荐")).toBeInTheDocument();
      expect(within(conversation).getByText(/从 1 个已启用 Skill 中找到 1 个推荐项。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/推荐 Skill：shell-automation。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/注册表：\.opencow\/skills\/enabled-skills\.json。/)).toBeInTheDocument();
      expect(
        within(conversation).getByText(/内容预览：Use this skill when the task needs shell automation with local safety rails\./)
      ).toBeInTheDocument();
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
      expect(within(conversation).getByText(/状态：partial-foundation。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/real npc capability summary from openclaw/)).toBeInTheDocument();
      expect(within(conversation).getByText(/已启用 Skills：coding-agent。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/注册表：\.opencow\/skills\/enabled-skills\.json。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/本地上下文：04-permission-safety-shell\.md、OPENCOW_CORE_RULES\.md。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/已索引文档：7。/)).toBeInTheDocument();
    });
  });

  it("shows readonly NPC default template preview on web without using ordinary chat", async () => {
    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "先给我课程助手 NPC 的默认模板" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(conversation).getByText("NPC 默认模板预览")).toBeInTheDocument();
      expect(within(conversation).getByText(/名称：课程助手。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/系统提示词：/)).toBeInTheDocument();
      expect(within(conversation).getByText(/默认模型：跟随当前已选 Ollama 模型。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/保存前仍需 workspace-write 权限。/)).toBeInTheDocument();
    });

    expect(chatWithOllamaModelMock).not.toHaveBeenCalled();
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
      expect(within(conversation).getByText(/推荐 Skill：docs-helper。/)).toBeInTheDocument();
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

  it("supports Chinese capability and local-tool requests on web", async () => {
    render(<WebApp />);

    const conversation = screen.getByRole("region", { name: "会话" });

    fireEvent.change(getComposerInput(), {
      target: { value: "查看 skills 能力概览" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText("SKILLS 网页端能力概览")).toBeInTheDocument();
      expect(within(conversation).getByText(/real skills capability summary from openclaw/)).toBeInTheDocument();
    });

    fireEvent.change(getComposerInput(), {
      target: { value: "扫描本地 skills" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText("本地 Skills 扫描")).toBeInTheDocument();
      expect(within(conversation).getByText(/扫描到 3 个本地 Skills，覆盖 2 个扫描根目录。/)).toBeInTheDocument();
    });

    fireEvent.change(getComposerInput(), {
      target: { value: "查看已启用 skills" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText("已启用本地 Skills")).toBeInTheDocument();
      expect(within(conversation).getByText(/当前启用 1 个本地 Skill。/)).toBeInTheDocument();
    });

    fireEvent.change(getComposerInput(), {
      target: { value: "查看 browser mcp 插件详情" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText("本地 MCP 插件详情")).toBeInTheDocument();
      expect(within(conversation).getByText(/匹配项：browser。/)).toBeInTheDocument();
    });

    fireEvent.change(getComposerInput(), {
      target: { value: "搜索本地知识库里的 browser history" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText("本地 RAG 文档检索")).toBeInTheDocument();
      expect(within(conversation).getByText(/检索问题：搜索本地知识库里的 browser history。/)).toBeInTheDocument();
    });

    fireEvent.change(getComposerInput(), {
      target: { value: "预览一个 npc 协作方案，用来检查本地 shell 权限规则" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText("NPC collaboration preview")).toBeInTheDocument();
      expect(within(conversation).getByText(/已启用 Skills：coding-agent。/)).toBeInTheDocument();
    });
  });

  it("supports Chinese skill write requests on web", async () => {
    render(<WebApp />);

    const conversation = screen.getByRole("region", { name: "会话" });

    fireEvent.change(getComposerInput(), {
      target: { value: "安装 gpt-taste skill 到当前工作区" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText("本地 Skill 安装结果")).toBeInTheDocument();
      expect(within(conversation).getByText(/已安装 Skill：gpt-taste。/)).toBeInTheDocument();
    });

    fireEvent.change(getComposerInput(), {
      target: { value: "启用 coding-agent skill" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText("本地 Skill 启用结果")).toBeInTheDocument();
      expect(within(conversation).getByText(/已启用 Skill：coding-agent。/)).toBeInTheDocument();
    });

    fireEvent.change(getComposerInput(), {
      target: { value: "禁用 coding-agent skill" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText("本地 Skill 禁用结果")).toBeInTheDocument();
      expect(within(conversation).getByText(/已禁用 Skill：coding-agent。/)).toBeInTheDocument();
    });

  });

  it("supports Chinese preview requests on web", async () => {
    render(<WebApp />);

    const conversation = screen.getByRole("region", { name: "会话" });

    fireEvent.change(getComposerInput(), {
      target: { value: "预览启动 browser mcp 插件" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText("本地 MCP 插件启动预览")).toBeInTheDocument();
      expect(within(conversation).getByText(/匹配项：browser。/)).toBeInTheDocument();
    });

    fireEvent.change(getComposerInput(), {
      target: { value: "预览一个 npc shell 计划来删除 temp-output" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText("NPC shell plan preview")).toBeInTheDocument();
      expect(within(conversation).getByText(/命令预览：Remove-Item -Recurse -Force temp-output/)).toBeInTheDocument();
    });
  });

  it("supports Chinese source-scoped knowledge requests on web", async () => {
    window.localStorage.setItem("opencow.web.knowledge.v1", JSON.stringify({
      activeLibraryId: "default-library",
      customFiles: [],
      libraries: [
        {
          id: "default-library",
          label: "默认知识库",
          importedFiles: [
            {
              path: "docs/web-history-mvp.md",
              title: "web-history-mvp.md",
              status: "ready",
              content: "# Web History MVP\n\nKeep recent conversations until the user deletes them manually."
            }
          ]
        }
      ]
    }));

    render(<WebApp />);

    const conversation = screen.getByRole("region", { name: "会话" });
    fireEvent.change(getComposerInput(), {
      target: { value: "只搜索 web-history-mvp.md 里的 browser history" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText("本地 RAG 文档检索")).toBeInTheDocument();
      expect(within(conversation).getByText(/知识库：默认知识库。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/找到 1 条匹配片段，已索引 1 个文档。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/主要来源：web-history-mvp\.md。/)).toBeInTheDocument();
      expect(
        within(conversation).getByText(/检索问题：search local knowledge in web-history-mvp\.md for browser history。/)
      ).toBeInTheDocument();
      expect(within(conversation).getByText("来源文件：web-history-mvp.md")).toBeInTheDocument();
    });
  });

  it("supports Chinese enabled-skill recommendation and skill-assisted RAG lookup on web", async () => {
    render(<WebApp />);

    const conversation = screen.getByRole("region", { name: "会话" });

    fireEvent.change(getComposerInput(), {
      target: { value: "推荐一个已启用 skill 来处理 shell 自动化" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText("已启用 Skill 推荐")).toBeInTheDocument();
      expect(within(conversation).getByText(/推荐 Skill：shell-automation。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/注册表：\.opencow\/skills\/enabled-skills\.json。/)).toBeInTheDocument();
    });

    fireEvent.change(getComposerInput(), {
      target: { value: "用已启用 docs skill 搜索本地规则里的 shell permission guidance" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(conversation).getByText("Skill 辅助本地 RAG 检索")).toBeInTheDocument();
      expect(within(conversation).getByText(/推荐 Skill：docs-helper。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/找到 2 条匹配片段，已索引 7 个文档。/)).toBeInTheDocument();
      expect(within(conversation).getByText(/主要来源：04-permission-safety-shell\.md、OPENCOW_CORE_RULES\.md。/)).toBeInTheDocument();
    });
  });
});
