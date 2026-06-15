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

describe("assistantTaskService skill-assisted rag shell handoff preview", () => {
  it("plans a workspace-write permission request for a local RAG handoff continuation generated from plan wording", () => {
    const plan = planAssistantTask(
      "review local shell permission rules and continue to create a temp-output folder with shell automation",
      "readonly"
    );

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "rag-local-shell-create-temp-output",
      queuedExecutionTitle: "Local RAG handoff temp-output creation"
    });
  });

  it("plans a readonly local RAG shell handoff preview without a permission upgrade", () => {
    const plan = planAssistantTask(
      "review local shell permission rules and preview the next safe shell step to delete temp-output",
      "readonly"
    );

    expect(plan).toMatchObject({
      kind: "rag-local-shell-handoff-preview",
      title: "Local RAG shell handoff preview"
    });
  });

  it("executes a local RAG shell handoff preview by combining local docs and shell safety planning", async () => {
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "review local shell permission rules and preview the next safe shell step to delete temp-output",
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
      kind: "rag-local-shell-handoff-preview",
      title: "Local RAG shell handoff preview",
      summary: "review local shell permission rules and preview the next safe shell step to delete temp-output",
      auditSummary: "Local assistant planned a readonly local RAG shell handoff preview.",
      auditDetail: "Readonly local RAG shell handoff preview task"
    } as const);

    expect(result.resultTitle).toBe("Local RAG shell handoff preview");
    expect(result.resultSummary).toContain("04-permission-safety-shell.md");
    expect(result.resultSummary).toContain("OPENCOW_CORE_RULES.md");
    expect(result.resultSummary).toContain("Remove-Item -LiteralPath temp-output -Recurse -Force");
    expect(result.resultSummary).toContain("controlled-full");
  });

  it("plans a readonly skill-assisted rag shell handoff preview without a permission upgrade", () => {
    const plan = planAssistantTask(
      "use the enabled docs skill to review local shell permission rules and preview the next safe shell step to delete temp-output",
      "readonly"
    );

    expect(plan).toMatchObject({
      kind: "skills-local-enabled-rag-shell-handoff-preview",
      title: "Skill-assisted RAG shell handoff preview"
    });
  });

  it("executes a skill-assisted rag shell handoff preview by combining skill match, local docs, and shell safety planning", async () => {
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use the enabled docs skill to review local shell permission rules and preview the next safe shell step to delete temp-output",
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
      query: "use the enabled docs skill to review local shell permission rules and preview the next safe shell step to delete temp-output",
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
      kind: "skills-local-enabled-rag-shell-handoff-preview",
      title: "Skill-assisted RAG shell handoff preview",
      summary: "use the enabled docs skill to review local shell permission rules and preview the next safe shell step to delete temp-output",
      auditSummary: "Local assistant planned a skill-assisted readonly RAG shell handoff preview.",
      auditDetail: "Skill-assisted readonly RAG shell handoff preview task"
    } as const);

    expect(result.resultTitle).toBe("Skill 辅助 RAG Shell 交接预览");
    expect(result.resultSummary).toContain("docs-helper");
    expect(result.resultSummary).toContain("注册表：.opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain(".opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain("主要来源：04-permission-safety-shell.md、OPENCOW_CORE_RULES.md");
    expect(result.resultSummary).toContain("04-permission-safety-shell.md");
    expect(result.resultSummary).toContain("OPENCOW_CORE_RULES.md");
    expect(result.resultSummary).toContain("命令预览：Remove-Item");
    expect(result.resultSummary).toContain("所需权限：controlled-full");
    expect(result.resultSummary).toContain("安全状态：requires-snapshot");
  });
});
