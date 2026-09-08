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
    expect(plan.intent).toMatchObject({
      kind: "workspace-read",
      domain: "workspace",
      requiredCapabilities: ["workspace.inspect"]
    });
  });

  it("keeps fresh research on the unified local answer path after retrieval", () => {
    const plan = planAssistantTask("python和java哪个历史更悠久，请联网搜索", "readonly");

    expect(plan).toMatchObject({
      kind: "local-model-chat",
      title: "联网检索与本地回答",
      intent: {
        kind: "fresh-research",
        needsNetwork: true,
        requiredCapabilities: ["network.search"]
      }
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

    expect(result.resultTitle).toBe("工作区概览");
    expect(result.resultSummary).toContain("openclaw-adapter");
    expect(result.resultSummary).toContain("3 个本地包");
  });

  it("rejects legacy fixed assistant help overview tasks so user questions go through the model", async () => {
    await expect(executeAssistantTask({
      kind: "assistant-help-overview",
      title: "Assistant help overview",
      summary: "Summarize the assistant's current core local capabilities in direct user-facing language.",
      auditSummary: "Local assistant planned a user-facing help overview.",
      auditDetail: "User-facing assistant help overview task."
    } as never)).rejects.toThrow(/Unsupported assistant task execution plan: assistant-help-overview/i);
  });
});
