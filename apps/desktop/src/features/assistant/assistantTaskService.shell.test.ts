import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { runReadonlyShellCommandMock } = vi.hoisted(() => ({
  runReadonlyShellCommandMock: vi.fn()
}));

vi.mock("./localAssistantService", () => ({
  runReadonlyShellCommand: runReadonlyShellCommandMock
}));

describe("assistantTaskService readonly shell execution", () => {
  it("plans a readonly git status task from conversation intent", () => {
    const plan = planAssistantTask("check git status for this workspace", "readonly");

    expect(plan).toMatchObject({
      kind: "readonly-shell-git-status",
      title: "Workspace git status"
    });
  });

  it("executes a readonly shell command through the desktop local assistant service", async () => {
    runReadonlyShellCommandMock.mockResolvedValueOnce({
      command_id: "git-status",
      command_label: "git status --short",
      stdout_preview: " M apps/desktop/src/app/App.tsx\n?? packages/openclaw-adapter/src/localAssistantPlan.shell.test.ts",
      line_count: 2,
      summary: "Readonly shell command completed successfully."
    });

    const result = await executeAssistantTask({
      kind: "readonly-shell-git-status",
      title: "Workspace git status",
      summary: "Inspect current workspace git changes before deeper assistant execution.",
      auditSummary: "Local assistant planned a readonly git status command.",
      auditDetail: "Readonly shell command task: git status --short"
    });

    expect(result.resultTitle).toBe("Workspace git status");
    expect(result.resultSummary).toContain("git status --short");
    expect(result.resultSummary).toContain("App.tsx");
  });

  it("summarizes readonly shell diagnostics as a self-check report", async () => {
    runReadonlyShellCommandMock.mockResolvedValueOnce({
      command_id: "workspace-root-list",
      command_label: "Get-ChildItem -Force",
      stdout_preview: "apps\npackages\ndocs\nOPENCOW_CORE_RULES.md",
      line_count: 4,
      summary: "Readonly shell command completed successfully."
    });

    const result = await executeAssistantTask({
      kind: "readonly-shell-workspace-root",
      title: "Readonly shell diagnostics",
      summary: "Run a readonly shell diagnostic by listing the workspace root before retrying command execution.",
      auditSummary: "Local assistant planned readonly shell diagnostics.",
      auditDetail:
        "Readonly shell diagnostics task: workspace root listing | request=检查权限批准和工作区根目录再重试"
    });

    expect(result.resultTitle).toBe("Readonly shell diagnostics");
    expect(result.resultSummary).toContain("Self-check report:");
    expect(result.resultSummary).toContain("shell bridge reachable");
    expect(result.resultSummary).toContain("workspace root accessible");
    expect(result.resultSummary).toContain("command whitelist accepted workspace-root-list");
    expect(result.resultSummary).toContain("audit trail retained readonly shell diagnostics");
    expect(result.resultSummary).toContain("Preview: apps");
  });

  it("adds command, permission, and recovery context when readonly shell execution fails", async () => {
    runReadonlyShellCommandMock.mockRejectedValueOnce(
      new Error("Tauri readonly_command failed: git executable unavailable.")
    );

    await expect(
      executeAssistantTask({
        kind: "readonly-shell-git-status",
        title: "Workspace git status",
        summary: "Inspect current workspace git changes before deeper assistant execution.",
        auditSummary: "Local assistant planned a readonly git status command.",
        auditDetail: "Readonly shell command task: git status --short"
      })
    ).rejects.toThrow(
      /Shell execution failed in assistantTaskService\. Command id: git-status\. Required permission: readonly\. Underlying error: Tauri readonly_command failed: git executable unavailable\. Next step: verify the readonly shell bridge, workspace root, command whitelist, and audit trail before retrying\./i
    );
  });

  it("aborts readonly shell execution when the assistant task signal is cancelled", async () => {
    let resolveCommand: (value: {
      command_id: string;
      command_label: string;
      stdout_preview: string;
      line_count: number;
      summary: string;
    }) => void = () => {};
    runReadonlyShellCommandMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCommand = resolve;
      })
    );
    const abortController = new AbortController();
    const executionPromise = executeAssistantTask(
      {
        kind: "readonly-shell-git-status",
        title: "Workspace git status",
        summary: "Inspect current workspace git changes before deeper assistant execution.",
        auditSummary: "Local assistant planned a readonly git status command.",
        auditDetail: "Readonly shell command task: git status --short"
      },
      {
        signal: abortController.signal
      }
    );

    abortController.abort();
    resolveCommand({
      command_id: "git-status",
      command_label: "git status --short",
      stdout_preview: " M apps/desktop/src/app/App.tsx",
      line_count: 1,
      summary: "Readonly shell command completed successfully."
    });

    await expect(executionPromise).rejects.toThrow(/Assistant task execution aborted/i);
  });
});
