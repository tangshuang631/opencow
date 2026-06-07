import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { stopWorkspaceProjectMock } = vi.hoisted(() => ({
  stopWorkspaceProjectMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    stopWorkspaceProject: stopWorkspaceProjectMock
  };
});

describe("assistantTaskService project stop", () => {
  it("requests workspace-write before stopping a matched local desktop project", () => {
    const plan = planAssistantTask("stop the desktop app local run", "readonly");

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "workspace-project-stop",
      queuedExecutionTitle: "Stop matched local project"
    });
  });

  it("stops the matched local project through the desktop service after permission approval", async () => {
    stopWorkspaceProjectMock.mockResolvedValueOnce({
      project_name: "desktop",
      project_path: "apps/desktop",
      command_label: "npm run dev",
      working_directory: "apps/desktop",
      pid: 4242,
      status: "stopped",
      stdout_preview: "job:4242 stopped",
      summary: "Workspace project stop completed successfully and released the local process handle."
    });

    const result = await executeAssistantTask({
      kind: "workspace-project-stop",
      title: "Stop matched local project",
      summary: "stop the desktop app local run",
      auditSummary: "Local assistant planned a workspace-backed local project stop.",
      auditDetail: "Workspace-backed local project stop task."
    } as const);

    expect(result.resultTitle).toBe("Stop matched local project");
    expect(result.resultSummary).toContain("desktop");
    expect(result.resultSummary).toContain("apps/desktop");
    expect(result.resultSummary).toContain("4242");
    expect(result.resultSummary).toContain("stopped");
    expect(result.resultSummary).toContain("job:4242 stopped");
  });
});
