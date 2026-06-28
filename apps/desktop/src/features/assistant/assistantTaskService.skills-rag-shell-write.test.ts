import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { matchEnabledLocalSkillsMock, searchLocalKnowledgeMock, runWorkspaceWriteShellCommandMock, runControlledFullShellCommandMock } = vi.hoisted(() => ({
  matchEnabledLocalSkillsMock: vi.fn(),
  searchLocalKnowledgeMock: vi.fn(),
  runWorkspaceWriteShellCommandMock: vi.fn(),
  runControlledFullShellCommandMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    matchEnabledLocalSkills: matchEnabledLocalSkillsMock,
    searchLocalKnowledge: searchLocalKnowledgeMock,
    runWorkspaceWriteShellCommand: runWorkspaceWriteShellCommandMock,
    runControlledFullShellCommand: runControlledFullShellCommandMock
  };
});

describe("assistantTaskService skill-assisted rag shell continuation", () => {
  it("plans a workspace-write continuation for a skill-assisted RAG handoff temp-output creation task", () => {
    const plan = planAssistantTask(
      "use the enabled docs skill to review local shell permission rules and continue to create a temp-output folder with shell automation",
      "readonly"
    );

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "skills-local-enabled-rag-shell-create-temp-output"
    });
  });

  it("executes a skill-assisted RAG handoff temp-output creation task through skill match, docs retrieval, and shell execution", async () => {
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use the enabled docs skill to review local shell permission rules and continue to create a temp-output folder with shell automation",
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
      query: "use the enabled docs skill to review local shell permission rules and continue to create a temp-output folder with shell automation",
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
    runWorkspaceWriteShellCommandMock.mockResolvedValueOnce({
      command_id: "create-temp-output-dir",
      command_label: "New-Item -ItemType Directory -Force temp-output",
      stdout_preview: "temp-output",
      line_count: 1,
      summary: "Workspace write shell command completed successfully."
    });

    const result = await executeAssistantTask({
      kind: "skills-local-enabled-rag-shell-create-temp-output",
      title: "Skill-assisted RAG handoff temp-output creation",
      summary: "use the enabled docs skill to review local shell permission rules and continue to create a temp-output folder with shell automation",
      auditSummary: "Local assistant planned a skill-assisted RAG handoff workspace-write temp-output creation task.",
      auditDetail: "Skill-assisted RAG handoff workspace-write shell command task: create temp-output directory"
    } as const);

    expect(result.resultTitle).toBe("Skill-assisted RAG handoff temp-output creation");
    expect(result.resultSummary).toContain("docs-helper");
    expect(result.resultSummary).toContain("推荐 Skill：docs-helper");
    expect(result.resultSummary).toContain("注册表：.opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain("主要来源：04-permission-safety-shell.md、OPENCOW_CORE_RULES.md");
    expect(result.resultSummary).toContain("04-permission-safety-shell.md");
    expect(result.resultSummary).toContain("OPENCOW_CORE_RULES.md");
    expect(result.resultSummary).toContain("命令：New-Item -ItemType Directory -Force temp-output");
    expect(result.resultSummary).toContain("输出预览：temp-output");
    expect(result.resultSummary).toContain("New-Item -ItemType Directory -Force temp-output");
    expect(result.resultSummary).toContain("执行摘要：工作区写入命令已完成。");
    expect(result.resultSummary).not.toContain("Workspace write shell command completed successfully");
    expect(result.resultSummary).not.toContain("Recommended skill:");
    expect(result.resultSummary).not.toContain("Registry:");
    expect(result.resultSummary).not.toContain("Top matches:");
    expect(result.resultSummary).not.toContain("Command:");
    expect(result.resultSummary).not.toContain("Preview:");
  });

  it("executes a skill-assisted RAG handoff temp-output removal task through skill match, docs retrieval, and confirmed shell execution", async () => {
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use the enabled docs skill to review local shell permission rules and continue to delete temp-output with shell automation",
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
      query: "use the enabled docs skill to review local shell permission rules and continue to delete temp-output with shell automation",
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
    runControlledFullShellCommandMock.mockResolvedValueOnce({
      command_id: "remove-temp-output-dir",
      command_label: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      stdout_preview: "temp-output removed",
      line_count: 1,
      summary: "Controlled full shell command completed successfully."
    });

    const result = await executeAssistantTask({
      kind: "skills-local-enabled-rag-shell-remove-temp-output",
      title: "Skill-assisted RAG handoff temp-output removal",
      summary: "use the enabled docs skill to review local shell permission rules and continue to delete temp-output with shell automation",
      auditSummary: "Local assistant planned a skill-assisted RAG handoff controlled-full temp-output removal task.",
      auditDetail: "Skill-assisted RAG handoff controlled-full shell command task: remove temp-output directory"
    } as const);

    expect(result.resultTitle).toBe("Skill-assisted RAG handoff temp-output removal");
    expect(result.resultSummary).toContain("docs-helper");
    expect(result.resultSummary).toContain("推荐 Skill：docs-helper");
    expect(result.resultSummary).toContain("注册表：.opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain("主要来源：04-permission-safety-shell.md、OPENCOW_CORE_RULES.md");
    expect(result.resultSummary).toContain("04-permission-safety-shell.md");
    expect(result.resultSummary).toContain("OPENCOW_CORE_RULES.md");
    expect(result.resultSummary).toContain("命令：Remove-Item -LiteralPath temp-output -Recurse -Force");
    expect(result.resultSummary).toContain("输出预览：temp-output removed");
    expect(result.resultSummary).toContain("Remove-Item -LiteralPath temp-output -Recurse -Force");
    expect(result.resultSummary).toContain("执行摘要：受控高风险命令已完成。");
    expect(result.resultSummary).not.toContain("Controlled full shell command completed successfully");
    expect(result.resultSummary).not.toContain("Recommended skill:");
    expect(result.resultSummary).not.toContain("Registry:");
    expect(result.resultSummary).not.toContain("Top matches:");
    expect(result.resultSummary).not.toContain("Command:");
    expect(result.resultSummary).not.toContain("Preview:");
  });

  it("executes an npc-assisted RAG handoff temp-output creation task through skill match, docs retrieval, and shell execution", async () => {
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use npc collaboration to review local shell permission rules and continue to create a temp-output folder with shell automation",
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
      query: "use npc collaboration to review local shell permission rules and continue to create a temp-output folder with shell automation",
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
    runWorkspaceWriteShellCommandMock.mockResolvedValueOnce({
      command_id: "create-temp-output-dir",
      command_label: "New-Item -ItemType Directory -Force temp-output",
      stdout_preview: "temp-output",
      line_count: 1,
      summary: "Workspace write shell command completed successfully."
    });

    const result = await executeAssistantTask({
      kind: "npc-local-enabled-rag-shell-create-temp-output",
      title: "NPC-assisted RAG handoff temp-output creation",
      summary: "use npc collaboration to review local shell permission rules and continue to create a temp-output folder with shell automation",
      auditSummary: "Local assistant planned an NPC-assisted RAG handoff workspace-write temp-output creation task.",
      auditDetail: "NPC-assisted RAG handoff workspace-write shell command task: create temp-output directory"
    } as const);

    expect(result.resultTitle).toBe("NPC-assisted RAG handoff temp-output creation");
    expect(result.resultSummary).toContain("docs-helper");
    expect(result.resultSummary).toContain("推荐 Skill：docs-helper");
    expect(result.resultSummary).toContain("注册表：.opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain("主要来源：04-permission-safety-shell.md、OPENCOW_CORE_RULES.md");
    expect(result.resultSummary).toContain("04-permission-safety-shell.md");
    expect(result.resultSummary).toContain("OPENCOW_CORE_RULES.md");
    expect(result.resultSummary).toContain("命令：New-Item -ItemType Directory -Force temp-output");
    expect(result.resultSummary).toContain("输出预览：temp-output");
    expect(result.resultSummary).toContain("New-Item -ItemType Directory -Force temp-output");
    expect(result.resultSummary).toContain("执行摘要：工作区写入命令已完成。");
    expect(result.resultSummary).not.toContain("Workspace write shell command completed successfully");
    expect(result.resultSummary).not.toContain("Recommended skill:");
    expect(result.resultSummary).not.toContain("Registry:");
    expect(result.resultSummary).not.toContain("Top matches:");
    expect(result.resultSummary).not.toContain("Command:");
    expect(result.resultSummary).not.toContain("Preview:");
  });

  it("executes an npc-assisted RAG handoff temp-output removal task through skill match, docs retrieval, and confirmed shell execution", async () => {
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use npc collaboration to review local shell permission rules and continue to delete temp-output with shell automation",
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
      query: "use npc collaboration to review local shell permission rules and continue to delete temp-output with shell automation",
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
    runControlledFullShellCommandMock.mockResolvedValueOnce({
      command_id: "remove-temp-output-dir",
      command_label: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      stdout_preview: "temp-output removed",
      line_count: 1,
      summary: "Controlled full shell command completed successfully."
    });

    const result = await executeAssistantTask({
      kind: "npc-local-enabled-rag-shell-remove-temp-output",
      title: "NPC-assisted RAG handoff temp-output removal",
      summary: "use npc collaboration to review local shell permission rules and continue to delete temp-output with shell automation",
      auditSummary: "Local assistant planned an NPC-assisted RAG handoff controlled-full temp-output removal task.",
      auditDetail: "NPC-assisted RAG handoff controlled-full shell command task: remove temp-output directory"
    } as const);

    expect(result.resultTitle).toBe("NPC-assisted RAG handoff temp-output removal");
    expect(result.resultSummary).toContain("docs-helper");
    expect(result.resultSummary).toContain("推荐 Skill：docs-helper");
    expect(result.resultSummary).toContain("注册表：.opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain("主要来源：04-permission-safety-shell.md、OPENCOW_CORE_RULES.md");
    expect(result.resultSummary).toContain("04-permission-safety-shell.md");
    expect(result.resultSummary).toContain("OPENCOW_CORE_RULES.md");
    expect(result.resultSummary).toContain("命令：Remove-Item -LiteralPath temp-output -Recurse -Force");
    expect(result.resultSummary).toContain("输出预览：temp-output removed");
    expect(result.resultSummary).toContain("Remove-Item -LiteralPath temp-output -Recurse -Force");
    expect(result.resultSummary).toContain("执行摘要：受控高风险命令已完成。");
    expect(result.resultSummary).not.toContain("Controlled full shell command completed successfully");
    expect(result.resultSummary).not.toContain("Recommended skill:");
    expect(result.resultSummary).not.toContain("Registry:");
    expect(result.resultSummary).not.toContain("Top matches:");
    expect(result.resultSummary).not.toContain("Command:");
    expect(result.resultSummary).not.toContain("Preview:");
  });
});
