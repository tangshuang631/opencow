import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { loadOpenClawCapabilityOverviewMock, listEnabledLocalSkillsMock, searchLocalKnowledgeMock } = vi.hoisted(() => ({
  loadOpenClawCapabilityOverviewMock: vi.fn(),
  listEnabledLocalSkillsMock: vi.fn(),
  searchLocalKnowledgeMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    loadOpenClawCapabilityOverview: loadOpenClawCapabilityOverviewMock,
    listEnabledLocalSkills: listEnabledLocalSkillsMock,
    searchLocalKnowledge: searchLocalKnowledgeMock
  };
});

describe("assistantTaskService npc collaboration preview", () => {
  it("plans a readonly npc collaboration preview without a permission upgrade", () => {
    const plan = planAssistantTask("preview an npc collaboration plan for local shell permission rules", "readonly");

    expect(plan).toMatchObject({
      kind: "npc-local-collaboration-preview",
      title: "NPC collaboration preview"
    });
  });

  it("requests permission before an LLM-generated NPC config write", () => {
    const plan = planAssistantTask("你能帮我配置一个课程助手npc吗", "readonly");

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "npc-config-write"
    });
  });

  it("keeps Chinese NPC draft requests on the readonly preview path", () => {
    const plan = planAssistantTask("先给我课程助手 NPC 的只读草案", "readonly");

    expect(plan).toMatchObject({
      kind: "npc-local-collaboration-preview",
      title: "NPC collaboration preview"
    });
  });

  it("plans a document processing NPC config write once workspace-write is available", () => {
    const plan = planAssistantTask("你能帮我配置一个文档处理npc吗", "workspace-write");

    expect(plan).toMatchObject({
      kind: "npc-config-write",
      title: "大模型生成并保存 NPC 配置"
    });
  });

  it("executes an npc collaboration preview by combining npc readiness, enabled skills, and local docs", async () => {
    loadOpenClawCapabilityOverviewMock.mockResolvedValueOnce({
      capability_id: "npc",
      title: "OpenClaw NPC capability overview",
      status: "ready-foundation",
      required_package_count: 3,
      available_package_count: 3,
      available_packages: ["@openclaw/llm-core", "@openclaw/llm-runtime", "@openclaw/tool-call-repair"],
      missing_packages: [],
      summary: "NPC foundation packages are available for local collaboration preview."
    });
    listEnabledLocalSkillsMock.mockResolvedValueOnce({
      summary: "Found 2 enabled local skill entries in the workspace registry.",
      total_count: 2,
      registry_path: ".opencow/skills/enabled-skills.json",
      items: [
        {
          name: "coding-agent",
          path: "vendor/openclaw/skills/coding-agent/SKILL.md",
          source: "vendor-openclaw-skill",
          description: "OpenClaw coding agent workflow"
        },
        {
          name: "docs-helper",
          path: "skills/docs-helper/SKILL.md",
          source: "workspace-skill",
          description: "Help search local docs and rules."
        }
      ]
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "preview an npc collaboration plan for local shell permission rules",
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
      kind: "npc-local-collaboration-preview",
      title: "NPC collaboration preview",
      summary: "preview an npc collaboration plan for local shell permission rules",
      auditSummary: "Local assistant planned a readonly NPC collaboration preview.",
      auditDetail: "Readonly NPC collaboration preview task"
    } as const);

    expect(result.resultTitle).toBe("NPC collaboration preview");
    expect(result.resultSummary).toContain("ready-foundation");
    expect(result.resultSummary).toContain("coding-agent");
    expect(result.resultSummary).toContain("docs-helper");
    expect(result.resultSummary).toContain("04-permission-safety-shell.md");
    expect(result.resultSummary).toContain("OPENCOW_CORE_RULES.md");
    expect(result.resultSummary).toContain("状态：ready-foundation");
    expect(result.resultSummary).toContain("已启用 Skills：coding-agent、docs-helper");
    expect(result.resultSummary).toContain("注册表：.opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain("本地上下文：04-permission-safety-shell.md、OPENCOW_CORE_RULES.md");
    expect(result.resultSummary).toContain("已索引文档：7");
    expect(result.resultSummary).not.toContain("Status:");
    expect(result.resultSummary).not.toContain("Enabled skills:");
    expect(result.resultSummary).not.toContain("Registry:");
    expect(result.resultSummary).not.toContain("Local context:");
    expect(result.resultSummary).not.toContain("Indexed documents:");
  });
});
