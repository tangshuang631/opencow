import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { disableLocalSkillMock } = vi.hoisted(() => ({
  disableLocalSkillMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    disableLocalSkill: disableLocalSkillMock
  };
});

describe("assistantTaskService local skill disable", () => {
  it("requests workspace-write permission before disabling a local skill", () => {
    const plan = planAssistantTask("disable the coding-agent skill for this workspace", "readonly");

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "skills-local-disable",
      queuedExecutionTitle: "Disable local skill"
    });
  });

  it("executes a local skill disable through the desktop service", async () => {
    disableLocalSkillMock.mockResolvedValueOnce({
      query: "disable the coding-agent skill for this workspace",
      disabled_skill_name: "coding-agent",
      registry_path: ".opencow/skills/enabled-skills.json",
      status: "disabled",
      summary: "Local skill disablement removed coding-agent from the workspace skill registry."
    });

    const result = await executeAssistantTask({
      kind: "skills-local-disable",
      title: "Disable local skill",
      summary: "disable the coding-agent skill for this workspace",
      auditSummary: "Local assistant planned a local skill disable task.",
      auditDetail: "Workspace write local skill disable task."
    } as const);

    expect(result.resultTitle).toBe("本地 Skill 禁用结果");
    expect(result.resultSummary).toContain("coding-agent");
    expect(result.resultSummary).toContain("注册表：.opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain(".opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain("状态：disabled");
  });
});
