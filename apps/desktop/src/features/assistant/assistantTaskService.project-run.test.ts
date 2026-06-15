import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { runWorkspaceProjectMock } = vi.hoisted(() => ({
  runWorkspaceProjectMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    runWorkspaceProject: runWorkspaceProjectMock
  };
});

describe("assistantTaskService project run", () => {
  it("requests workspace-write before running a matched local desktop project", () => {
    const plan = planAssistantTask("run the desktop app locally", "readonly");

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "workspace-project-run"
    });
  });

  it("runs the matched local project through the desktop service after permission approval", async () => {
    runWorkspaceProjectMock.mockResolvedValueOnce({
      project_name: "desktop",
      project_path: "apps/desktop",
      command_label: "npm run dev",
      working_directory: "apps/desktop",
      expected_url: "http://127.0.0.1:1420",
      pid: 4242,
      stdout_preview: "opencow desktop dev server started",
      summary: "Workspace project run started successfully and returned a live local process handle."
    });

    const result = await executeAssistantTask({
      kind: "workspace-project-run",
      title: "Run matched local project",
      summary: "run the desktop app locally",
      auditSummary: "Local assistant planned a workspace-backed local project run.",
      auditDetail: "Workspace-backed local project run task."
    } as const);

    expect(result.resultTitle).toBe("Run matched local project");
    expect(result.resultSummary).toContain("desktop");
    expect(result.resultSummary).toContain("apps/desktop");
    expect(result.resultSummary).toContain("npm run dev");
    expect(result.resultSummary).toContain("http://127.0.0.1:1420");
    expect(result.resultSummary).toContain("4242");
    expect(result.resultSummary).toContain("opencow desktop dev server started");
    expect(result.resultSummary).toContain("本地项目已启动并返回进程句柄。");
    expect(result.resultSummary).toContain("项目：desktop");
    expect(result.resultSummary).toContain("路径：apps/desktop");
    expect(result.resultSummary).toContain("命令：npm run dev");
    expect(result.resultSummary).toContain("工作目录：apps/desktop");
    expect(result.resultSummary).toContain("预期 URL：http://127.0.0.1:1420");
    expect(result.resultSummary).toContain("输出预览：opencow desktop dev server started");
    expect(result.resultSummary).not.toContain("Workspace project run started successfully");
    expect(result.resultSummary).not.toContain("Project:");
    expect(result.resultSummary).not.toContain("Path:");
    expect(result.resultSummary).not.toContain("Command:");
    expect(result.resultSummary).not.toContain("Working directory:");
    expect(result.resultSummary).not.toContain("Expected URL:");
    expect(result.resultSummary).not.toContain("Preview:");
  });
});
