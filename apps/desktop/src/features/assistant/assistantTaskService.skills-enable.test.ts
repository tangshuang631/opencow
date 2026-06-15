import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { enableLocalSkillMock } = vi.hoisted(() => ({
  enableLocalSkillMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    enableLocalSkill: enableLocalSkillMock
  };
});

describe("assistantTaskService local skill enable", () => {
  it("requests workspace-write permission before enabling a local skill", () => {
    const plan = planAssistantTask("enable the coding-agent skill for this workspace", "readonly");

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "skills-local-enable"
    });
  });

  it("executes a local skill enable through the desktop service", async () => {
    enableLocalSkillMock.mockResolvedValueOnce({
      query: "enable the coding-agent skill for this workspace",
      enabled_skill_name: "coding-agent",
      registry_path: ".opencow/skills/enabled-skills.json",
      status: "enabled",
      summary: "Local skill enablement registered coding-agent in the workspace skill registry."
    });

    const result = await executeAssistantTask({
      kind: "skills-local-enable",
      title: "Enable local skill",
      summary: "enable the coding-agent skill for this workspace",
      auditSummary: "Local assistant planned a local skill enable task.",
      auditDetail: "Workspace write local skill enable task."
    } as const);

    expect(result.resultTitle).toBe("本地 Skill 启用结果");
    expect(result.resultSummary).toContain("coding-agent");
    expect(result.resultSummary).toContain("注册表：.opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain(".opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain("状态：enabled");
  });
});
