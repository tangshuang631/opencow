import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { getWorkspaceProjectStatusMock } = vi.hoisted(() => ({
  getWorkspaceProjectStatusMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    getWorkspaceProjectStatus: getWorkspaceProjectStatusMock
  };
});

describe("assistantTaskService project status", () => {
  it("plans a readonly matched local desktop project status lookup without permission escalation", () => {
    const plan = planAssistantTask("show the status of the desktop app local run", "readonly");

    expect(plan).toMatchObject({
      kind: "workspace-project-status",
      title: "Matched local project status"
    });
  });

  it("reads the matched local project status through the desktop service", async () => {
    getWorkspaceProjectStatusMock.mockResolvedValueOnce({
      project_name: "desktop",
      project_path: "apps/desktop",
      command_label: "npm run dev",
      working_directory: "apps/desktop",
      expected_url: "http://127.0.0.1:1420",
      pid: 4242,
      status: "running",
      stdout_preview: "pid:4242",
      summary: "Workspace project status found an active local process handle for the matched project."
    });

    const result = await executeAssistantTask({
      kind: "workspace-project-status",
      title: "Matched local project status",
      summary: "show the status of the desktop app local run",
      auditSummary: "Local assistant planned a readonly workspace-backed local project status lookup.",
      auditDetail: "Readonly workspace-backed local project status task."
    } as const);

    expect(result.resultTitle).toBe("Matched local project status");
    expect(result.resultSummary).toContain("desktop");
    expect(result.resultSummary).toContain("apps/desktop");
    expect(result.resultSummary).toContain("npm run dev");
    expect(result.resultSummary).toContain("http://127.0.0.1:1420");
    expect(result.resultSummary).toContain("4242");
    expect(result.resultSummary).toContain("running");
    expect(result.resultSummary).toContain("项目：desktop");
    expect(result.resultSummary).toContain("路径：apps/desktop");
    expect(result.resultSummary).toContain("命令：npm run dev");
    expect(result.resultSummary).toContain("工作目录：apps/desktop");
    expect(result.resultSummary).toContain("预期 URL：http://127.0.0.1:1420");
    expect(result.resultSummary).toContain("状态：running");
    expect(result.resultSummary).toContain("输出预览：pid:4242");
    expect(result.resultSummary).not.toContain("Project:");
    expect(result.resultSummary).not.toContain("Path:");
    expect(result.resultSummary).not.toContain("Command:");
    expect(result.resultSummary).not.toContain("Working directory:");
    expect(result.resultSummary).not.toContain("Expected URL:");
    expect(result.resultSummary).not.toContain("Status:");
    expect(result.resultSummary).not.toContain("Preview:");
  });
});
