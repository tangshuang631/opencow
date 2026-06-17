import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { searchLocalKnowledgeMock } = vi.hoisted(() => ({
  searchLocalKnowledgeMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    searchLocalKnowledge: searchLocalKnowledgeMock
  };
});

describe("assistantTaskService local rag search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("plans a local RAG search task from knowledge retrieval requests", () => {
    const plan = planAssistantTask("search local knowledge for shell permission rules", "readonly");

    expect(plan).toMatchObject({
      kind: "rag-local-doc-search",
      title: "Local RAG document search"
    });
  });

  it("plans a local RAG search task for long pptx docx and markdown document requests", () => {
    const message = "summarize the long pptx docx and md documents in this workspace";
    const plan = planAssistantTask(message, "readonly");

    expect(plan).toMatchObject({
      kind: "rag-local-doc-search",
      title: "Local RAG document search",
      summary: message
    });
  });

  it("plans a local RAG search task for Chinese long document requests", () => {
    const message = "\u603b\u7ed3\u8fd9\u4e2a\u5de5\u4f5c\u533a\u91cc\u7684 pptx docx md \u957f\u6587\u6863";
    const plan = planAssistantTask(message, "readonly");

    expect(plan).toMatchObject({
      kind: "rag-local-doc-search",
      title: "Local RAG document search",
      summary: message
    });
  });

  it("executes a local RAG document search through the desktop service", async () => {
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "shell permission rules",
      summary: "Local knowledge search found 2 matching passages across 7 indexed documents.",
      provider: "keyword-fallback",
      fallback_reason: "Ollama embedding is unavailable in this readonly search path.",
      match_count: 2,
      indexed_document_count: 7,
      items: [
        {
          path: "docs/v1.0/04-permission-safety-shell.md",
          title: "04-permission-safety-shell.md",
          snippet: "Shell execution must include permission checks, confirmation, audit logs, timeout, and working-directory limits.",
          score: 42
        },
        {
          path: "OPENCOW_CORE_RULES.md",
          title: "OPENCOW_CORE_RULES.md",
          snippet: "Permissions, shell, safety, logs, and rollback are core safety paths.",
          score: 27
        }
      ]
    });

    const result = await executeAssistantTask({
      kind: "rag-local-doc-search",
      title: "Local RAG document search",
      summary: "search local knowledge for shell permission rules",
      auditSummary: "Local assistant planned a local RAG document search.",
      auditDetail: "Readonly local RAG search task."
    } as const);

    expect(result.resultTitle).toBe("本地 RAG 文档检索");
    expect(result.resultSummary).toContain("找到 2 条匹配片段");
    expect(result.resultSummary).toContain("已索引 7 个文档");
    expect(result.resultSummary).toContain("检索方式：关键词 fallback。");
    expect(result.resultSummary).toContain("04-permission-safety-shell.md");
    expect(result.resultSummary).toContain("OPENCOW_CORE_RULES.md");
  });

  it("executes long document RAG searches with the original user request as the query", async () => {
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "summarize the long pptx docx and md documents in this workspace",
      summary: "Local knowledge search found 3 matching passages across 9 indexed documents.",
      match_count: 3,
      indexed_document_count: 9,
      items: [
        {
          path: "docs/overview.md",
          title: "overview.md",
          snippet: "Markdown workspace overview.",
          score: 33
        },
        {
          path: "docs/slides/product-roadmap.pptx",
          title: "product-roadmap.pptx",
          snippet: "PPTX roadmap content.",
          score: 31
        }
      ]
    });

    const plan = planAssistantTask("summarize the long pptx docx and md documents in this workspace", "readonly");
    const result = await executeAssistantTask(plan);

    expect(searchLocalKnowledgeMock).toHaveBeenCalledWith(
      "summarize the long pptx docx and md documents in this workspace"
    );
    expect(result.resultTitle).toBe("本地 RAG 文档检索");
    expect(result.resultSummary).toContain("找到 3 条匹配片段");
    expect(result.resultSummary).toContain("已索引 9 个文档");
    expect(result.resultSummary).toContain("overview.md");
    expect(result.resultSummary).toContain("product-roadmap.pptx");
  });

  it("executes Chinese long document RAG searches with the original user request as the query", async () => {
    const message = "\u603b\u7ed3\u8fd9\u4e2a\u5de5\u4f5c\u533a\u91cc\u7684 pptx docx md \u957f\u6587\u6863";
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: message,
      summary: "Local knowledge search found 2 matching passages across 8 indexed documents.",
      match_count: 2,
      indexed_document_count: 8,
      items: [
        {
          path: "docs/report.docx",
          title: "report.docx",
          snippet: "Docx report content.",
          score: 30
        },
        {
          path: "docs/notes.md",
          title: "notes.md",
          snippet: "Markdown notes content.",
          score: 28
        }
      ]
    });

    const plan = planAssistantTask(message, "readonly");
    const result = await executeAssistantTask(plan);

    expect(searchLocalKnowledgeMock).toHaveBeenCalledWith(message);
    expect(result.resultTitle).toBe("本地 RAG 文档检索");
    expect(result.resultSummary).toContain("找到 2 条匹配片段");
    expect(result.resultSummary).toContain("已索引 8 个文档");
    expect(result.resultSummary).toContain("report.docx");
    expect(result.resultSummary).toContain("notes.md");
  });

  it("adds query and recovery context when local RAG document search fails", async () => {
    searchLocalKnowledgeMock.mockRejectedValueOnce(
      new Error("local knowledge index could not be opened.")
    );

    await expect(
      executeAssistantTask({
        kind: "rag-local-doc-search",
        title: "Local RAG document search",
        summary: "summarize the long pptx docx and md documents in this workspace",
        auditSummary: "Local assistant planned a local RAG document search.",
        auditDetail: "Readonly local RAG search task."
      } as const)
    ).rejects.toThrow(
      /Local RAG search failed in assistantTaskService\. Query: summarize the long pptx docx and md documents in this workspace\. Underlying error: local knowledge index could not be opened\. Next step: verify the local RAG index, document parsers for pptx\/docx\/md, workspace root discovery, and retry with a narrower document query before continuing\./i
    );
  });

  it("executes readonly network search guidance without making a network call", async () => {
    const message = "search the web for latest local RAG indexing approaches";

    const result = await executeAssistantTask({
      kind: "network-search-guidance",
      title: "Network search guidance",
      summary: message,
      auditSummary: "Local assistant planned readonly network search guidance.",
      auditDetail: "Readonly network search guidance task."
    } as const);

    expect(searchLocalKnowledgeMock).not.toHaveBeenCalled();
    expect(result.resultTitle).toBe("联网搜索说明");
    expect(result.resultSummary).toContain("本轮没有执行外部联网搜索");
    expect(result.resultSummary).toContain("搜索 Provider 尚未配置或尚未完成能力审批");
    expect(result.resultSummary).toContain("已跳过网络调用");
    expect(result.resultSummary).toContain("下一步");
    expect(result.resultSummary).toContain(message);
  });
});
