import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { matchEnabledLocalSkillsMock, runWorkspaceWriteShellCommandMock, runControlledFullShellCommandMock } = vi.hoisted(() => ({
  matchEnabledLocalSkillsMock: vi.fn(),
  runWorkspaceWriteShellCommandMock: vi.fn(),
  runControlledFullShellCommandMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    matchEnabledLocalSkills: matchEnabledLocalSkillsMock,
    runWorkspaceWriteShellCommand: runWorkspaceWriteShellCommandMock,
    runControlledFullShellCommand: runControlledFullShellCommandMock
  };
});

describe("assistantTaskService skill-assisted workspace-write shell execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests workspace-write permission before a skill-assisted temp-output creation task", () => {
    const plan = planAssistantTask(
      "use the enabled shell automation skill to create a temp-output folder for this workspace",
      "readonly"
    );

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "skills-local-enabled-shell-create-temp-output"
    });
  });

  it("executes a skill-assisted temp-output creation task through enabled skill matching and shell execution", async () => {
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use the enabled shell automation skill to create a temp-output folder for this workspace",
      summary: "Enabled local skill matching found 1 recommended skill across 2 enabled entries.",
      registry_path: ".opencow/skills/enabled-skills.json",
      enabled_skill_count: 2,
      match_count: 1,
      items: [
        {
          name: "shell-automation",
          path: "skills/shell-automation/SKILL.md",
          source: "workspace-skill",
          description: "Run safe local shell automation tasks.",
          content_preview: "Use this skill when the task needs shell automation with local safety rails."
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
      kind: "skills-local-enabled-shell-create-temp-output",
      title: "Skill-assisted temp-output creation",
      summary: "use the enabled shell automation skill to create a temp-output folder for this workspace",
      auditSummary: "Local assistant planned a skill-assisted workspace-write temp-output creation task.",
      auditDetail: "Skill-assisted workspace-write shell command task: create temp-output directory"
    } as const);

    expect(result.resultTitle).toBe("Skill 辅助创建结果");
    expect(result.resultSummary).toContain("shell-automation");
    expect(result.resultSummary).toContain("注册表：.opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain(".opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain("命令：New-Item -ItemType Directory -Force temp-output");
    expect(result.resultSummary).toContain("New-Item -ItemType Directory -Force temp-output");
    expect(result.resultSummary).toContain("执行摘要：工作区写入命令已完成。");
    expect(result.resultSummary).not.toContain("Workspace write shell command completed successfully");
  });

  it("adds shell recovery context when a skill-assisted workspace-write command fails", async () => {
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use the enabled shell automation skill to create a temp-output folder for this workspace",
      summary: "Enabled local skill matching found 1 recommended skill across 2 enabled entries.",
      registry_path: ".opencow/skills/enabled-skills.json",
      enabled_skill_count: 2,
      match_count: 1,
      items: [
        {
          name: "shell-automation",
          path: "skills/shell-automation/SKILL.md",
          source: "workspace-skill",
          description: "Run safe local shell automation tasks.",
          content_preview: "Use this skill when the task needs shell automation with local safety rails."
        }
      ]
    });
    runWorkspaceWriteShellCommandMock.mockRejectedValueOnce(
      new Error("Tauri workspace_write_command failed: working directory escaped workspace root")
    );

    await expect(
      executeAssistantTask({
        kind: "skills-local-enabled-shell-create-temp-output",
        title: "Skill-assisted temp-output creation",
        summary: "use the enabled shell automation skill to create a temp-output folder for this workspace",
        auditSummary: "Local assistant planned a skill-assisted workspace-write temp-output creation task.",
        auditDetail: "Skill-assisted workspace-write shell command task: create temp-output directory"
      } as const)
    ).rejects.toThrow(
      /Shell execution failed in assistantTaskService\. Command id: create-temp-output-dir\. Required permission: workspace-write\. Underlying error: Tauri workspace_write_command failed: working directory escaped workspace root\. Next step: verify the permission approval, workspace root, command whitelist, and audit trail before retrying\./i
    );
  });

  it("adds registry and recovery context when no enabled skill matches a skill-assisted shell task", async () => {
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use the enabled shell automation skill to create a temp-output folder for this workspace",
      summary: "Enabled local skill matching found 0 recommended skills across 2 enabled entries.",
      registry_path: ".opencow/skills/enabled-skills.json",
      enabled_skill_count: 2,
      match_count: 0,
      items: []
    });

    await expect(
      executeAssistantTask({
        kind: "skills-local-enabled-shell-create-temp-output",
        title: "Skill-assisted temp-output creation",
        summary: "use the enabled shell automation skill to create a temp-output folder for this workspace",
        auditSummary: "Local assistant planned a skill-assisted workspace-write temp-output creation task.",
        auditDetail: "Skill-assisted workspace-write shell command task: create temp-output directory"
      } as const)
    ).rejects.toThrow(
      /No enabled local skill matched in assistantTaskService\. Capability: skill-assisted shell request\. Registry: \.opencow\/skills\/enabled-skills\.json\. Query: use the enabled shell automation skill to create a temp-output folder for this workspace\. Match count: 0 of 2 enabled skills\. Next step: inspect \.opencow\/skills\/enabled-skills\.json, enable a matching skill, or rewrite the request before retrying\./i
    );
    expect(runWorkspaceWriteShellCommandMock).not.toHaveBeenCalled();
  });

  it("executes a skill-assisted temp-output removal task through enabled skill matching and confirmed shell execution", async () => {
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use the enabled shell automation skill to delete temp-output and clean temporary files",
      summary: "Enabled local skill matching found 1 recommended skill across 2 enabled entries.",
      registry_path: ".opencow/skills/enabled-skills.json",
      enabled_skill_count: 2,
      match_count: 1,
      items: [
        {
          name: "shell-automation",
          path: "skills/shell-automation/SKILL.md",
          source: "workspace-skill",
          description: "Run safe local shell automation tasks.",
          content_preview: "Use this skill when the task needs shell automation with local safety rails."
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
      kind: "skills-local-enabled-shell-remove-temp-output",
      title: "Skill-assisted temp-output removal",
      summary: "use the enabled shell automation skill to delete temp-output and clean temporary files",
      auditSummary: "Local assistant planned a skill-assisted controlled-full temp-output removal task.",
      auditDetail: "Skill-assisted controlled-full shell command task: remove temp-output directory"
    } as const);

    expect(result.resultTitle).toBe("Skill 辅助清理结果");
    expect(result.resultSummary).toContain("shell-automation");
    expect(result.resultSummary).toContain("注册表：.opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain(".opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain("命令：Remove-Item -LiteralPath temp-output -Recurse -Force");
    expect(result.resultSummary).toContain("Remove-Item -LiteralPath temp-output -Recurse -Force");
    expect(result.resultSummary).toContain("执行摘要：受控高风险命令已完成。");
    expect(result.resultSummary).not.toContain("Controlled full shell command completed successfully");
  });

  it("executes an npc-assisted temp-output creation task through enabled skill matching and shell execution", async () => {
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use npc collaboration to create a temp-output folder with shell automation",
      summary: "Enabled local skill matching found 1 recommended skill across 2 enabled entries.",
      registry_path: ".opencow/skills/enabled-skills.json",
      enabled_skill_count: 2,
      match_count: 1,
      items: [
        {
          name: "shell-automation",
          path: "skills/shell-automation/SKILL.md",
          source: "workspace-skill",
          description: "Run safe local shell automation tasks.",
          content_preview: "Use this skill when the task needs shell automation with local safety rails."
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
      kind: "npc-local-enabled-shell-create-temp-output",
      title: "NPC-assisted temp-output creation",
      summary: "use npc collaboration to create a temp-output folder with shell automation",
      auditSummary: "Local assistant planned an NPC-assisted workspace-write temp-output creation task.",
      auditDetail: "NPC-assisted workspace-write shell command task: create temp-output directory"
    } as const);

    expect(result.resultTitle).toBe("NPC-assisted temp-output creation");
    expect(result.resultSummary).toContain("shell-automation");
    expect(result.resultSummary).toContain(".opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain("New-Item -ItemType Directory -Force temp-output");
    expect(result.resultSummary).toContain("执行摘要：工作区写入命令已完成。");
    expect(result.resultSummary).not.toContain("Workspace write shell command completed successfully");
  });

  it("executes an npc-assisted temp-output removal task through enabled skill matching and confirmed shell execution", async () => {
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use npc collaboration to delete temp-output with shell automation",
      summary: "Enabled local skill matching found 1 recommended skill across 2 enabled entries.",
      registry_path: ".opencow/skills/enabled-skills.json",
      enabled_skill_count: 2,
      match_count: 1,
      items: [
        {
          name: "shell-automation",
          path: "skills/shell-automation/SKILL.md",
          source: "workspace-skill",
          description: "Run safe local shell automation tasks.",
          content_preview: "Use this skill when the task needs shell automation with local safety rails."
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
      kind: "npc-local-enabled-shell-remove-temp-output",
      title: "NPC-assisted temp-output removal",
      summary: "use npc collaboration to delete temp-output with shell automation",
      auditSummary: "Local assistant planned an NPC-assisted controlled-full temp-output removal task.",
      auditDetail: "NPC-assisted controlled-full shell command task: remove temp-output directory"
    } as const);

    expect(result.resultTitle).toBe("NPC-assisted temp-output removal");
    expect(result.resultSummary).toContain("shell-automation");
    expect(result.resultSummary).toContain(".opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain("Remove-Item -LiteralPath temp-output -Recurse -Force");
    expect(result.resultSummary).toContain("执行摘要：受控高风险命令已完成。");
    expect(result.resultSummary).not.toContain("Controlled full shell command completed successfully");
  });
});
