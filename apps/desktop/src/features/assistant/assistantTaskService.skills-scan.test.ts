import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { scanLocalSkillsMock } = vi.hoisted(() => ({
  scanLocalSkillsMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    scanLocalSkills: scanLocalSkillsMock
  };
});

describe("assistantTaskService local skills scan", () => {
  it("plans a local skills scan task from explicit skill inventory requests", () => {
    const plan = planAssistantTask("scan local skills and list available skill entries", "readonly");

    expect(plan).toMatchObject({
      kind: "skills-local-scan",
      title: "Local Skills scan"
    });
  });

  it("executes a local skills scan through the desktop service", async () => {
    scanLocalSkillsMock.mockResolvedValueOnce({
      summary: "Local skills scan found 3 skills across 2 scanned roots.",
      total_count: 3,
      scanned_root_count: 2,
      items: [
        {
          name: "coding-agent",
          path: "vendor/openclaw/skills/coding-agent/SKILL.md",
          source: "vendor-openclaw-skill",
          description: "OpenClaw coding agent workflow",
          enabled: true
        },
        {
          name: "browser-automation",
          path: "vendor/openclaw/extensions/browser/skills/browser-automation/SKILL.md",
          source: "vendor-openclaw-extension-skill",
          description: "OpenClaw browser automation skill",
          enabled: false
        },
        {
          name: "diffs",
          path: "vendor/openclaw/extensions/diffs/skills/diffs/SKILL.md",
          source: "vendor-openclaw-extension-skill",
          description: "OpenClaw diffs review skill",
          enabled: false
        }
      ]
    });

    const result = await executeAssistantTask({
      kind: "skills-local-scan",
      title: "Local Skills scan",
      summary: "Scan local skill directories and summarize the currently discoverable skill entries.",
      auditSummary: "Local assistant planned a local skills scan.",
      auditDetail: "Readonly local skills scan task."
    } as const);

    expect(result.resultTitle).toBe("本地 Skills 扫描");
    expect(result.resultSummary).toContain("扫描到 3 个本地 Skills，覆盖 2 个扫描根目录");
    expect(result.resultSummary).toContain("coding-agent");
    expect(result.resultSummary).toContain("browser-automation");
    expect(result.resultSummary).toContain("已启用项：coding-agent");
  });
});
