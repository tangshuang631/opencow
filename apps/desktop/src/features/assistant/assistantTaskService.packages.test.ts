import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { loadWorkspacePackagesOverviewMock } = vi.hoisted(() => ({
  loadWorkspacePackagesOverviewMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    loadWorkspacePackagesOverview: loadWorkspacePackagesOverviewMock
  };
});

describe("assistantTaskService packages overview", () => {
  it("executes a packages overview through the desktop service", async () => {
    loadWorkspacePackagesOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      package_count: 3,
      package_names: ["openclaw-adapter", "permission-engine", "shell-runtime"],
      total_script_count: 9,
      packages_with_scripts: ["openclaw-adapter", "permission-engine"],
      summary: "Workspace package inspection found 3 packages and 9 npm scripts."
    });

    const result = await executeAssistantTask({
      kind: "packages-overview",
      title: "Workspace packages overview",
      summary: "Inspect local workspace packages and script coverage before deeper tool wiring.",
      auditSummary: "Local assistant planned a packages overview task.",
      auditDetail: "Readonly workspace packages overview task."
    });

    expect(result.resultTitle).toBe("Workspace packages overview");
    expect(result.resultSummary).toContain("3 packages");
    expect(result.resultSummary).toContain("9 npm scripts");
    expect(result.resultSummary).toContain("openclaw-adapter");
  });

  it("keeps adapter planning available from the desktop service boundary", () => {
    const plan = planAssistantTask("inspect workspace packages and scripts", "readonly");

    expect(["workspace-overview", "packages-overview"]).toContain(plan.kind);
  });
});
