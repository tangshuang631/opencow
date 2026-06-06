import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { loadWorkspaceOverviewMock } = vi.hoisted(() => ({
  loadWorkspaceOverviewMock: vi.fn()
}));

vi.mock("./localAssistantService", () => ({
  loadWorkspaceOverview: loadWorkspaceOverviewMock
}));

describe("assistantTaskService", () => {
  it("plans a readonly workspace overview task for ordinary local assistant input", () => {
    const plan = planAssistantTask("inspect the current workspace and summarize it", "workspace-write");

    expect(plan).toMatchObject({
      kind: "workspace-overview",
      title: "Workspace overview"
    });
  });

  it("requests controlled full permission for destructive cleanup input", () => {
    const plan = planAssistantTask("delete temp-output and clean temporary files", "workspace-write");

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "controlled-full"
    });
  });

  it("executes a workspace overview through the desktop service", async () => {
    loadWorkspaceOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      entry_count: 7,
      package_count: 3,
      package_names: ["openclaw-adapter", "permission-engine", "shell-runtime"],
      summary: "Workspace opencow currently contains 7 root entries and 3 local packages."
    });

    const result = await executeAssistantTask({
      kind: "workspace-overview",
      title: "Workspace overview",
      summary: "Inspect the current workspace structure before deeper local assistant execution.",
      auditSummary: "Local assistant planned a workspace overview task.",
      auditDetail: "Readonly workspace overview task."
    });

    expect(result.resultTitle).toBe("Workspace overview");
    expect(result.resultSummary).toContain("openclaw-adapter");
    expect(result.resultSummary).toContain("3 local packages");
  });
});
