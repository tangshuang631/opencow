import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { matchEnabledLocalSkillsMock } = vi.hoisted(() => ({
  matchEnabledLocalSkillsMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    matchEnabledLocalSkills: matchEnabledLocalSkillsMock
  };
});

describe("assistantTaskService enabled local skills match", () => {
  it("plans an enabled local skills match from explicit recommendation requests", () => {
    const plan = planAssistantTask("which enabled skill should handle shell automation in this workspace", "readonly");

    expect(plan).toMatchObject({
      kind: "skills-local-enabled-match",
      title: "Match enabled local skills"
    });
  });

  it("executes an enabled local skills match through the desktop service", async () => {
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "which enabled skill should handle shell automation in this workspace",
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

    const result = await executeAssistantTask({
      kind: "skills-local-enabled-match",
      title: "Match enabled local skills",
      summary: "which enabled skill should handle shell automation in this workspace",
      auditSummary: "Local assistant planned an enabled local skills match task.",
      auditDetail: "Readonly enabled local skills match task."
    } as const);

    expect(result.resultTitle).toBe("Match enabled local skills");
    expect(result.resultSummary).toContain("1 recommended skill");
    expect(result.resultSummary).toContain("shell-automation");
    expect(result.resultSummary).toContain(".opencow/skills/enabled-skills.json");
  });
});
