import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const {
  loadOpenClawCapabilityOverviewMock,
  loadWorkspaceOverviewMock,
  matchEnabledLocalSkillsMock,
  searchLocalKnowledgeMock
} = vi.hoisted(() => ({
  loadOpenClawCapabilityOverviewMock: vi.fn(),
  loadWorkspaceOverviewMock: vi.fn(),
  matchEnabledLocalSkillsMock: vi.fn(),
  searchLocalKnowledgeMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    loadOpenClawCapabilityOverview: loadOpenClawCapabilityOverviewMock,
    loadWorkspaceOverview: loadWorkspaceOverviewMock,
    matchEnabledLocalSkills: matchEnabledLocalSkillsMock,
    searchLocalKnowledge: searchLocalKnowledgeMock
  };
});

describe("assistantTaskService npc shell plan preview", () => {
  it("plans a readonly npc shell plan preview without a permission upgrade", () => {
    const plan = planAssistantTask("preview an npc collaboration shell plan to delete temp-output", "readonly");

    expect(plan).toMatchObject({
      kind: "npc-local-shell-plan-preview",
      title: "NPC shell plan preview"
    });
  });

  it("executes an npc shell plan preview by combining npc readiness, enabled skill matching, and shell safety planning", async () => {
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
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "preview an npc collaboration shell plan to delete temp-output",
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
    loadWorkspaceOverviewMock.mockResolvedValueOnce({
      root_name: "other-opencow",
      root_path: "D:\\other-opencow",
      entry_count: 7,
      package_count: 3,
      package_names: ["openclaw-adapter", "permission-engine", "shell-runtime"],
      summary: "Workspace other-opencow currently contains 7 root entries and 3 local packages."
    });

    const result = await executeAssistantTask({
      kind: "npc-local-shell-plan-preview",
      title: "NPC shell plan preview",
      summary: "preview an npc collaboration shell plan to delete temp-output",
      auditSummary: "Local assistant planned a readonly NPC shell plan preview.",
      auditDetail: "Readonly NPC shell plan preview task"
    } as const);

    expect(result.resultTitle).toBe("NPC shell plan preview");
    expect(result.resultSummary).toContain("ready-foundation");
    expect(result.resultSummary).toContain("shell-automation");
    expect(result.resultSummary).toContain(".opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain("Remove-Item");
    expect(result.resultSummary).toContain("Workspace root: D:\\other-opencow");
    expect(result.resultSummary).toContain("controlled-full");
    expect(result.resultSummary).toContain("requires-snapshot");
  });

  it("executes an npc-assisted RAG shell handoff preview by combining npc readiness, enabled skill matching, local docs, and shell safety planning", async () => {
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
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use npc collaboration to review local shell permission rules and preview the next safe shell step to delete temp-output",
      summary: "Enabled local skill matching found 1 recommended skill across 2 enabled entries.",
      registry_path: ".opencow/skills/enabled-skills.json",
      enabled_skill_count: 2,
      match_count: 1,
      items: [
        {
          name: "docs-helper",
          path: "skills/docs-helper/SKILL.md",
          source: "workspace-skill",
          description: "Help search local docs and rules.",
          content_preview: "Use this skill when the task needs local document lookup and rule retrieval."
        }
      ]
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "use npc collaboration to review local shell permission rules and preview the next safe shell step to delete temp-output",
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
    loadWorkspaceOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      root_path: "E:\\2026\\opencow",
      entry_count: 7,
      package_count: 3,
      package_names: ["openclaw-adapter", "permission-engine", "shell-runtime"],
      summary: "Workspace opencow currently contains 7 root entries and 3 local packages."
    });

    const result = await executeAssistantTask({
      kind: "npc-local-enabled-rag-shell-handoff-preview",
      title: "NPC-assisted RAG shell handoff preview",
      summary: "use npc collaboration to review local shell permission rules and preview the next safe shell step to delete temp-output",
      auditSummary: "Local assistant planned a readonly NPC-assisted RAG shell handoff preview.",
      auditDetail: "NPC-assisted readonly RAG shell handoff preview task"
    } as const);

    expect(result.resultTitle).toBe("NPC-assisted RAG shell handoff preview");
    expect(result.resultSummary).toContain("ready-foundation");
    expect(result.resultSummary).toContain("docs-helper");
    expect(result.resultSummary).toContain(".opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain("04-permission-safety-shell.md");
    expect(result.resultSummary).toContain("OPENCOW_CORE_RULES.md");
    expect(result.resultSummary).toContain("Remove-Item");
    expect(result.resultSummary).toContain("controlled-full");
    expect(result.resultSummary).toContain("requires-snapshot");
  });
});
