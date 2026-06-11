import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { matchEnabledLocalSkillsMock, searchLocalKnowledgeMock } = vi.hoisted(() => ({
  matchEnabledLocalSkillsMock: vi.fn(),
  searchLocalKnowledgeMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    matchEnabledLocalSkills: matchEnabledLocalSkillsMock,
    searchLocalKnowledge: searchLocalKnowledgeMock
  };
});

describe("assistantTaskService skill-assisted readonly RAG execution", () => {
  it("plans a skill-assisted readonly local RAG search without a permission upgrade", () => {
    const plan = planAssistantTask(
      "use the enabled docs skill to search local rules for shell permission guidance",
      "readonly"
    );

    expect(plan).toMatchObject({
      kind: "skills-local-enabled-rag-doc-search",
      title: "Skill-assisted local RAG document search"
    });
  });

  it("executes a skill-assisted readonly local RAG search through enabled skill matching and doc retrieval", async () => {
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use the enabled docs skill to search local rules for shell permission guidance",
      summary: "Enabled local skill matching found 1 recommended skill across 2 enabled entries.",
      registry_path: ".opencow/skills/enabled-skills.json",
      enabled_skill_count: 2,
      match_count: 1,
      items: [
        {
          name: "docs-helper",
          path: "skills/docs-helper/SKILL.md",
          source: "workspace-skill",
          description: "Help search local docs, rules, and knowledge files.",
          content_preview: "Use this skill when the task needs local document lookup and rule retrieval."
        }
      ]
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "use the enabled docs skill to search local rules for shell permission guidance",
      summary: "Local knowledge search returned 2 matching passages across 7 indexed documents.",
      match_count: 2,
      indexed_document_count: 7,
      items: [
        {
          path: "docs/v1.0/04-permission-safety-shell.md",
          title: "04-permission-safety-shell.md",
          snippet: "Shell execution must include permission checks and confirmation.",
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
      kind: "skills-local-enabled-rag-doc-search",
      title: "Skill-assisted local RAG document search",
      summary: "use the enabled docs skill to search local rules for shell permission guidance",
      auditSummary: "Local assistant planned a skill-assisted readonly local RAG document search.",
      auditDetail: "Skill-assisted readonly local RAG search task"
    } as const);

    expect(result.resultTitle).toBe("Skill-assisted local RAG document search");
    expect(result.resultSummary).toContain("docs-helper");
    expect(result.resultSummary).toContain(".opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain("04-permission-safety-shell.md");
    expect(result.resultSummary).toContain("OPENCOW_CORE_RULES.md");
    expect(result.resultSummary).toContain("Indexed documents: 7");
  });

  it("keeps matched skill diagnostics when the skill-assisted local RAG search fails", async () => {
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use the enabled docs skill to summarize pptx docx md workspace docs",
      summary: "Enabled local skill matching found 1 recommended skill across 2 enabled entries.",
      registry_path: ".opencow/skills/enabled-skills.json",
      enabled_skill_count: 2,
      match_count: 1,
      items: [
        {
          name: "docs-helper",
          path: "skills/docs-helper/SKILL.md",
          source: "workspace-skill",
          description: "Help search local docs, rules, and knowledge files.",
          content_preview: "Use this skill when the task needs local document lookup and rule retrieval."
        }
      ]
    });
    searchLocalKnowledgeMock.mockRejectedValueOnce(
      new Error("document parsers for pptx/docx/md are unavailable")
    );

    await expect(
      executeAssistantTask({
        kind: "skills-local-enabled-rag-doc-search",
        title: "Skill-assisted local RAG document search",
        summary: "use the enabled docs skill to summarize pptx docx md workspace docs",
        auditSummary: "Local assistant planned a skill-assisted readonly local RAG document search.",
        auditDetail: "Skill-assisted readonly local RAG search task"
      } as const)
    ).rejects.toThrow(
      /Skill-assisted local RAG search failed in assistantTaskService\. Recommended skill: docs-helper\. Registry: \.opencow\/skills\/enabled-skills\.json\. Underlying RAG failure: Local RAG search failed in assistantTaskService\..*document parsers for pptx\/docx\/md are unavailable.*Next step: verify the matched skill, local RAG index, document parsers, workspace root discovery, and retry with a narrower document query before continuing\./i
    );
  });
});
