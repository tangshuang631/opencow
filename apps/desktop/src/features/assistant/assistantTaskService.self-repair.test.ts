import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const {
  loadWorkspaceOverviewMock,
  loadWorkspaceConfigOverviewMock,
  searchLocalKnowledgeMock,
  repairOpencowEnabledSkillsRegistryMock
} = vi.hoisted(() => ({
  loadWorkspaceOverviewMock: vi.fn(),
  loadWorkspaceConfigOverviewMock: vi.fn(),
  searchLocalKnowledgeMock: vi.fn(),
  repairOpencowEnabledSkillsRegistryMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    loadWorkspaceOverview: loadWorkspaceOverviewMock,
    loadWorkspaceConfigOverview: loadWorkspaceConfigOverviewMock,
    searchLocalKnowledge: searchLocalKnowledgeMock,
    repairOpencowEnabledSkillsRegistry: repairOpencowEnabledSkillsRegistryMock
  };
});

describe("assistantTaskService self-repair preview", () => {
  it("plans a readonly self-repair preview for explicit opencow self-fix requests", () => {
    const plan = planAssistantTask("diagnose opencow and preview how to fix its current local error", "readonly");

    expect(plan).toMatchObject({
      kind: "opencow-self-repair-preview",
      title: "Opencow self-repair preview"
    });
  });

  it("executes a readonly self-repair preview through the desktop service", async () => {
    loadWorkspaceOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      entry_count: 7,
      package_count: 3,
      package_names: ["openclaw-adapter", "permission-engine", "shell-runtime"],
      summary: "Workspace opencow currently contains 7 root entries and 3 local packages."
    });
    loadWorkspaceConfigOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      config_files: ["package.json", "apps/desktop/package.json", "apps/desktop/src-tauri/Cargo.toml"],
      root_script_names: ["dev", "desktop:dev", "verify:all"],
      root_script_count: 3,
      package_manager_files: ["package-lock.json"],
      summary: "Workspace config inspection found 3 key config files and 3 root scripts."
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "diagnose opencow and preview how to fix its current local error",
      summary: "Local knowledge search found 2 matching passages across 7 indexed documents.",
      match_count: 2,
      indexed_document_count: 7,
      items: [
        {
          path: "OPENCOW_CORE_RULES.md",
          title: "OPENCOW_CORE_RULES.md",
          snippet: "When opencow itself fails, the assistant should prefer a staged self-repair flow.",
          score: 42
        },
        {
          path: "docs/v1.0/04-permission-safety-shell.md",
          title: "04-permission-safety-shell.md",
          snippet: "Writable shell actions must continue to flow through the permission and audit chain.",
          score: 28
        }
      ]
    });

    const result = await executeAssistantTask({
      kind: "opencow-self-repair-preview",
      title: "Opencow self-repair preview",
      summary: "Preview a readonly opencow self-repair workflow by inspecting local docs, config surfaces, and likely repair boundaries before any mutation is approved.",
      auditSummary: "Local assistant planned a readonly opencow self-repair preview.",
      auditDetail: "Readonly opencow self-repair preview task."
    } as const);

    expect(result.resultTitle).toBe("Opencow self-repair preview");
    expect(result.resultSummary).toContain("Readonly self-repair preview");
    expect(result.resultSummary).toContain("package.json");
    expect(result.resultSummary).toContain("desktop:dev");
    expect(result.resultSummary).toContain("OPENCOW_CORE_RULES.md");
    expect(result.resultSummary).toContain("request permission for any mutation");
  });

  it("requests workspace-write permission before continuing the enabled skills registry repair", () => {
    const plan = planAssistantTask("diagnose opencow and continue repairing its enabled skills registry", "readonly");

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "opencow-self-repair-enabled-skills-registry"
    });
  });

  it("executes the enabled skills registry repair through the desktop service after approval", async () => {
    repairOpencowEnabledSkillsRegistryMock.mockResolvedValueOnce({
      query: "diagnose opencow and continue repairing its enabled skills registry",
      repair_target: "enabled-skills-registry",
      repaired_path: ".opencow/skills/enabled-skills.json",
      status: "repaired",
      preserved_entry_count: 0,
      summary: "Opencow self-repair restored the enabled skills registry to a verified default schema."
    });

    const result = await executeAssistantTask({
      kind: "opencow-self-repair-enabled-skills-registry",
      title: "Repair opencow enabled skills registry",
      summary: "Repair the workspace-local enabled skills registry through the controlled self-repair chain.",
      auditSummary: "Local assistant planned an opencow enabled skills registry self-repair.",
      auditDetail: "Opencow self-repair task: enabled skills registry"
    } as const);

    expect(result.resultTitle).toBe("Repair opencow enabled skills registry");
    expect(result.resultSummary).toContain(".opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain("verified default schema");
    expect(result.resultSummary).toContain("audit");
    expect(result.resultSummary).toContain("rollback");
  });
});
