import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { inspectLocalSkillMock } = vi.hoisted(() => ({
  inspectLocalSkillMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    inspectLocalSkill: inspectLocalSkillMock
  };
});

describe("assistantTaskService local skill inspect", () => {
  it("plans a local skill detail task from explicit skill inspection requests", () => {
    const plan = planAssistantTask("show details for the coding-agent skill", "readonly");

    expect(plan).toMatchObject({
      kind: "skills-local-inspect",
      title: "Local Skill detail"
    });
  });

  it("executes a local skill detail lookup through the desktop service", async () => {
    inspectLocalSkillMock.mockResolvedValueOnce({
      query: "show details for the coding-agent skill",
      summary: "Local skill detail lookup found 1 matching skill across 2 scanned roots.",
      match_count: 1,
      scanned_root_count: 2,
      items: [
        {
          name: "coding-agent",
          path: "vendor/openclaw/skills/coding-agent/SKILL.md",
          source: "vendor-openclaw-skill",
          description: "OpenClaw coding agent workflow",
          content_preview: "Use this skill when implementing focused coding tasks with tight repo context.",
          enabled: true
        }
      ]
    });

    const result = await executeAssistantTask({
      kind: "skills-local-inspect",
      title: "Local Skill detail",
      summary: "show details for the coding-agent skill",
      auditSummary: "Local assistant planned a local skill detail lookup.",
      auditDetail: "Readonly local skill detail task."
    } as const);

    expect(result.resultTitle).toBe("本地 Skill 详情");
    expect(result.resultSummary).toContain("找到 1 个匹配 Skill，覆盖 2 个扫描根目录");
    expect(result.resultSummary).toContain("coding-agent");
    expect(result.resultSummary).toContain("OpenClaw coding agent workflow");
    expect(result.resultSummary).toContain("启用状态：已启用");
    expect(result.resultSummary).toContain("内容预览：Use this skill when implementing focused coding tasks");
  });
});
