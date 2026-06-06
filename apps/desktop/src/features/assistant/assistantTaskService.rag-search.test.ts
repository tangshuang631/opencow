import { describe, expect, it, vi } from "vitest";
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
  it("plans a local RAG search task from knowledge retrieval requests", () => {
    const plan = planAssistantTask("search local knowledge for shell permission rules", "readonly");

    expect(plan).toMatchObject({
      kind: "rag-local-doc-search",
      title: "Local RAG document search"
    });
  });

  it("executes a local RAG document search through the desktop service", async () => {
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "shell permission rules",
      summary: "Local knowledge search found 2 matching passages across 7 indexed documents.",
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

    expect(result.resultTitle).toBe("Local RAG document search");
    expect(result.resultSummary).toContain("2 matching passages across 7 indexed documents");
    expect(result.resultSummary).toContain("04-permission-safety-shell.md");
    expect(result.resultSummary).toContain("OPENCOW_CORE_RULES.md");
  });
});
