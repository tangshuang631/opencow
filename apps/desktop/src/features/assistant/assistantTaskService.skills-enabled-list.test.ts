import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { listEnabledLocalSkillsMock } = vi.hoisted(() => ({
  listEnabledLocalSkillsMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    listEnabledLocalSkills: listEnabledLocalSkillsMock
  };
});

describe("assistantTaskService enabled local skills list", () => {
  it("plans an enabled local skills task from explicit enabled skill requests", () => {
    const plan = planAssistantTask("show enabled skills for this workspace", "readonly");

    expect(plan).toMatchObject({
      kind: "skills-local-enabled-list",
      title: "Enabled local skills"
    });
  });

  it("executes an enabled local skills list through the desktop service", async () => {
    listEnabledLocalSkillsMock.mockResolvedValueOnce({
      summary: "Enabled local skills registry currently contains 1 enabled skill entry.",
      total_count: 1,
      registry_path: ".opencow/skills/enabled-skills.json",
      items: [
        {
          name: "coding-agent",
          path: "vendor/openclaw/skills/coding-agent/SKILL.md",
          source: "vendor-openclaw-skill",
          description: "OpenClaw coding agent workflow"
        }
      ]
    });

    const result = await executeAssistantTask({
      kind: "skills-local-enabled-list",
      title: "Enabled local skills",
      summary: "show enabled skills for this workspace",
      auditSummary: "Local assistant planned an enabled local skills list task.",
      auditDetail: "Readonly enabled local skills list task."
    } as const);

    expect(result.resultTitle).toBe("已启用本地 Skills");
    expect(result.resultSummary).toContain("当前启用 1 个本地 Skill");
    expect(result.resultSummary).toContain("coding-agent");
    expect(result.resultSummary).toContain("注册表：.opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain(".opencow/skills/enabled-skills.json");
  });
});
