import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { installLocalSkillMock } = vi.hoisted(() => ({
  installLocalSkillMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    installLocalSkill: installLocalSkillMock
  };
});

describe("assistantTaskService local skill install", () => {
  it("requests workspace-write permission before installing a local skill", () => {
    const plan = planAssistantTask("install the gpt-taste skill into this workspace skills folder", "readonly");

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "skills-local-install",
      queuedExecutionTitle: "Install local skill"
    });
  });

  it("executes a local skill install through the desktop service", async () => {
    installLocalSkillMock.mockResolvedValueOnce({
      query: "install the gpt-taste skill into this workspace skills folder",
      installed_skill_name: "gpt-taste",
      installed_skill_path: "skills/gpt-taste/SKILL.md",
      source_skill_path: "vendor/openclaw/skills/gpt-taste/SKILL.md",
      status: "installed",
      summary: "Local skill installation copied gpt-taste into the workspace skills directory."
    });

    const result = await executeAssistantTask({
      kind: "skills-local-install",
      title: "Install local skill",
      summary: "install the gpt-taste skill into this workspace skills folder",
      auditSummary: "Local assistant planned a local skill installation task.",
      auditDetail: "Workspace write local skill installation task."
    } as const);

    expect(result.resultTitle).toBe("本地 Skill 安装结果");
    expect(result.resultSummary).toContain("gpt-taste");
    expect(result.resultSummary).toContain("安装路径：skills/gpt-taste/SKILL.md");
    expect(result.resultSummary).toContain("skills/gpt-taste/SKILL.md");
    expect(result.resultSummary).toContain("来源：vendor/openclaw/skills/gpt-taste/SKILL.md");
    expect(result.resultSummary).toContain("状态：installed");
  });
});
