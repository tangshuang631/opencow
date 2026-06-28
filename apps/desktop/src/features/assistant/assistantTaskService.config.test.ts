import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask } from "./assistantTaskService";

const { loadWorkspaceConfigOverviewMock } = vi.hoisted(() => ({
  loadWorkspaceConfigOverviewMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    loadWorkspaceConfigOverview: loadWorkspaceConfigOverviewMock
  };
});

describe("assistantTaskService config overview", () => {
  it("executes a workspace config overview through the desktop service", async () => {
    loadWorkspaceConfigOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      config_files: ["package.json", "apps/desktop/package.json", "apps/desktop/src-tauri/Cargo.toml"],
      root_script_names: ["dev", "desktop:dev", "verify:all"],
      root_script_count: 3,
      package_manager_files: ["package-lock.json"],
      summary: "Workspace config inspection found 3 key config files and 3 root scripts."
    });

    const result = await executeAssistantTask({
      kind: "workspace-config-overview",
      title: "Workspace config overview",
      summary: "Inspect workspace config files and root scripts before controlled execution.",
      auditSummary: "Local assistant planned a workspace config overview task.",
      auditDetail: "Readonly workspace config overview task."
    });

    expect(result.resultTitle).toBe("工作区配置概览");
    expect(result.resultSummary).toContain("3 key config files");
    expect(result.resultSummary).toContain("关键配置文件");
    expect(result.resultSummary).toContain("package.json");
    expect(result.resultSummary).toContain("desktop:dev");
  });
});
