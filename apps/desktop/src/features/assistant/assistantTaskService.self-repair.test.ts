import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const {
  loadWorkspaceOverviewMock,
  loadWorkspaceConfigOverviewMock,
  searchLocalKnowledgeMock,
  repairOpencowEnabledSkillsRegistryMock,
  repairOpencowWorkspaceProjectRuntimeRegistryMock
} = vi.hoisted(() => ({
  loadWorkspaceOverviewMock: vi.fn(),
  loadWorkspaceConfigOverviewMock: vi.fn(),
  searchLocalKnowledgeMock: vi.fn(),
  repairOpencowEnabledSkillsRegistryMock: vi.fn(),
  repairOpencowWorkspaceProjectRuntimeRegistryMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    loadWorkspaceOverview: loadWorkspaceOverviewMock,
    loadWorkspaceConfigOverview: loadWorkspaceConfigOverviewMock,
    searchLocalKnowledge: searchLocalKnowledgeMock,
    repairOpencowEnabledSkillsRegistry: repairOpencowEnabledSkillsRegistryMock,
    repairOpencowWorkspaceProjectRuntimeRegistry: repairOpencowWorkspaceProjectRuntimeRegistryMock
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
      summary: "diagnose opencow and preview repairing its enabled skills registry",
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

  it("tailors the readonly self-repair preview to the enabled skills registry target", async () => {
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
      query: "diagnose opencow and preview repairing its enabled skills registry",
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
          path: "docs/v1.0/06-rag-skills-npc-mcp.md",
          title: "06-rag-skills-npc-mcp.md",
          snippet: "Every self-repair mutation must remain audit-visible and rollback-visible.",
          score: 38
        }
      ]
    });

    const result = await executeAssistantTask({
      kind: "opencow-self-repair-preview",
      title: "Opencow self-repair preview",
      summary: "Preview a readonly opencow self-repair workflow by inspecting local docs, config surfaces, and likely repair boundaries before any mutation is approved.",
      auditSummary: "Local assistant planned a readonly opencow self-repair preview.",
      auditDetail:
        "Readonly opencow self-repair preview task: diagnose opencow and preview repairing its enabled skills registry"
    } as const);

    expect(result.resultSummary).toContain(".opencow/skills/enabled-skills.json");
    expect(result.resultSummary).toContain("Workspace write permission would be required");
    expect(result.resultSummary).toContain("enabled skills registry");
    expect(result.resultSummary).toContain("Check .opencow/skills/enabled-skills.json first.");
    expect(result.resultSummary).toContain("Suggested next request");
    expect(result.resultSummary).toContain("diagnose opencow and continue repairing its enabled skills registry");
  });

  it("tailors the readonly self-repair preview to the workspace project runtime registry target", async () => {
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
      query: "diagnose opencow and preview repairing its workspace project runtime registry",
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
          path: "docs/v1.0/10-openclaw-adapter.md",
          title: "10-openclaw-adapter.md",
          snippet: "The runtime registry is durable enough for the current desktop mainline.",
          score: 38
        }
      ]
    });

    const result = await executeAssistantTask({
      kind: "opencow-self-repair-preview",
      title: "Opencow self-repair preview",
      summary: "Preview a readonly opencow self-repair workflow by inspecting local docs, config surfaces, and likely repair boundaries before any mutation is approved.",
      auditSummary: "Local assistant planned a readonly opencow self-repair preview.",
      auditDetail:
        "Readonly opencow self-repair preview task: diagnose opencow and preview repairing its workspace project runtime registry"
    } as const);

    expect(result.resultSummary).toContain(".opencow/runtime/workspace-project-runs.json");
    expect(result.resultSummary).toContain("Workspace write permission would be required");
    expect(result.resultSummary).toContain("workspace project runtime registry");
    expect(result.resultSummary).toContain("Check .opencow/runtime/workspace-project-runs.json first.");
    expect(result.resultSummary).toContain("Suggested next request");
    expect(result.resultSummary).toContain(
      "diagnose opencow and continue repairing its workspace project runtime registry"
    );
  });

  it("makes generic readonly self-repair preview stop short of mutation and point to the two concrete next targets", async () => {
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
      auditDetail: "Readonly opencow self-repair preview task: diagnose opencow and preview how to fix its current local error"
    } as const);

    expect(result.resultSummary).toContain("No specific controlled repair target has been confirmed yet");
    expect(result.resultSummary).toContain("diagnose opencow and preview repairing its enabled skills registry");
    expect(result.resultSummary).toContain("diagnose opencow and preview repairing its workspace project runtime registry");
  });

  it("requests workspace-write permission before continuing the enabled skills registry repair", () => {
    const plan = planAssistantTask("diagnose opencow and continue repairing its enabled skills registry", "readonly");

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "opencow-self-repair-enabled-skills-registry"
    });
  });

  it("returns a narrow target-guidance result when self-repair continue is requested without a specific repair target", async () => {
    const plan = planAssistantTask("diagnose opencow and continue fixing its current local error", "readonly");

    expect(plan).toMatchObject({
      kind: "opencow-self-repair-target-guidance",
      title: "Clarify opencow self-repair target"
    });

    const result = await executeAssistantTask(plan);

    expect(result.resultTitle).toBe("Clarify opencow self-repair target");
    expect(result.resultSummary).toContain("enabled skills registry");
    expect(result.resultSummary).toContain("workspace project runtime registry");
    expect(result.resultSummary).toContain("avoid retry loops");
    expect(result.resultSummary).toContain("diagnose opencow and continue repairing its enabled skills registry");
    expect(result.resultSummary).toContain(
      "diagnose opencow and continue repairing its workspace project runtime registry"
    );
  });

  it("executes the enabled skills registry repair through the desktop service after approval", async () => {
    repairOpencowEnabledSkillsRegistryMock.mockResolvedValueOnce({
      query: "diagnose opencow and continue repairing its enabled skills registry",
      repair_target: "enabled-skills-registry",
      repaired_path: ".opencow/skills/enabled-skills.json",
      status: "repaired",
      preserved_entry_count: 0,
      verified_version: 1,
      verified_entry_count: 0,
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
    expect(result.resultSummary).toContain("Verified schema version: 1");
    expect(result.resultSummary).toContain("Verified enabled entries: 0");
    expect(result.resultSummary).toContain("audit");
    expect(result.resultSummary).toContain("rollback");
  });

  it("adds target, permission, and recovery context when enabled skills registry repair fails", async () => {
    repairOpencowEnabledSkillsRegistryMock.mockRejectedValueOnce(
      new Error("Enabled skills registry repair verification failed because the rewritten schema remained invalid.")
    );

    await expect(
      executeAssistantTask({
        kind: "opencow-self-repair-enabled-skills-registry",
        title: "Repair opencow enabled skills registry",
        summary: "Repair the workspace-local enabled skills registry through the controlled self-repair chain.",
        auditSummary: "Local assistant planned an opencow enabled skills registry self-repair.",
        auditDetail: "Opencow self-repair task: enabled skills registry"
      } as const)
    ).rejects.toThrow(
      /Opencow self-repair failed in assistantTaskService\. Target: enabled skills registry\. Target path: \.opencow\/skills\/enabled-skills\.json\. Required permission: workspace-write\. Underlying error: Enabled skills registry repair verification failed because the rewritten schema remained invalid\. Next step: inspect \.opencow\/skills\/enabled-skills\.json, narrow the repair request, or fix the file manually before retrying with explicit workspace-write approval\./i
    );
  });

  it("requests workspace-write permission before continuing the workspace project runtime registry repair", () => {
    const plan = planAssistantTask(
      "diagnose opencow and continue repairing its workspace project runtime registry",
      "readonly"
    );

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "opencow-self-repair-workspace-project-runtime-registry"
    });
  });

  it("requests workspace-write permission before continuing repair for the explicit runtime registry path", () => {
    const plan = planAssistantTask(
      "diagnose opencow and continue repairing .opencow/runtime/workspace-project-runs.json",
      "readonly"
    );

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "opencow-self-repair-workspace-project-runtime-registry"
    });
  });

  it("executes the workspace project runtime registry repair through the desktop service after approval", async () => {
    repairOpencowWorkspaceProjectRuntimeRegistryMock.mockResolvedValueOnce({
      query: "diagnose opencow and continue repairing its workspace project runtime registry",
      repair_target: "workspace-project-runtime-registry",
      repaired_path: ".opencow/runtime/workspace-project-runs.json",
      status: "repaired",
      preserved_entry_count: 0,
      verified_version: 1,
      verified_run_count: 0,
      summary: "Opencow self-repair restored the workspace project runtime registry to a verified default schema."
    });

    const result = await executeAssistantTask({
      kind: "opencow-self-repair-workspace-project-runtime-registry",
      title: "Repair opencow workspace project runtime registry",
      summary: "Repair the workspace project runtime registry through the controlled self-repair chain.",
      auditSummary: "Local assistant planned an opencow workspace project runtime registry self-repair.",
      auditDetail: "Opencow self-repair task: workspace project runtime registry"
    } as const);

    expect(result.resultTitle).toBe("Repair opencow workspace project runtime registry");
    expect(result.resultSummary).toContain(".opencow/runtime/workspace-project-runs.json");
    expect(result.resultSummary).toContain("verified default schema");
    expect(result.resultSummary).toContain("Verified schema version: 1");
    expect(result.resultSummary).toContain("Verified runtime runs: 0");
    expect(result.resultSummary).toContain("audit");
    expect(result.resultSummary).toContain("rollback");
  });

  it("adds target, permission, and recovery context when workspace project runtime registry repair fails", async () => {
    repairOpencowWorkspaceProjectRuntimeRegistryMock.mockRejectedValueOnce(
      new Error("Runtime registry repair verification failed because the repaired schema could not be validated.")
    );

    await expect(
      executeAssistantTask({
        kind: "opencow-self-repair-workspace-project-runtime-registry",
        title: "Repair opencow workspace project runtime registry",
        summary: "Repair the workspace project runtime registry through the controlled self-repair chain.",
        auditSummary: "Local assistant planned an opencow workspace project runtime registry self-repair.",
        auditDetail: "Opencow self-repair task: workspace project runtime registry"
      } as const)
    ).rejects.toThrow(
      /Opencow self-repair failed in assistantTaskService\. Target: workspace project runtime registry\. Target path: \.opencow\/runtime\/workspace-project-runs\.json\. Required permission: workspace-write\. Underlying error: Runtime registry repair verification failed because the repaired schema could not be validated\. Next step: inspect \.opencow\/runtime\/workspace-project-runs\.json, narrow the repair request, or fix the file manually before retrying with explicit workspace-write approval\./i
    );
  });
});
