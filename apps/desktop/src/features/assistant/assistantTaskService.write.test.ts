import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { runWorkspaceWriteShellCommandMock, runControlledFullShellCommandMock } = vi.hoisted(() => ({
  runWorkspaceWriteShellCommandMock: vi.fn(),
  runControlledFullShellCommandMock: vi.fn()
}));

vi.mock("./localAssistantService", () => ({
  runWorkspaceWriteShellCommand: runWorkspaceWriteShellCommandMock,
  runControlledFullShellCommand: runControlledFullShellCommandMock
}));

describe("assistantTaskService workspace-write shell execution", () => {
  it("requests workspace-write permission before planning temp-output creation", () => {
    const plan = planAssistantTask("create a temp-output folder for this workspace", "readonly");

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "workspace-write-create-temp-output"
    });
  });

  it("executes the approved temp-output creation command through the desktop service", async () => {
    runWorkspaceWriteShellCommandMock.mockResolvedValueOnce({
      command_id: "create-temp-output-dir",
      command_label: "New-Item -ItemType Directory -Force temp-output",
      stdout_preview: "temp-output",
      line_count: 1,
      summary: "Workspace write shell command completed successfully."
    });

    const result = await executeAssistantTask({
      kind: "workspace-write-create-temp-output",
      title: "Create temp-output directory",
      summary: "Create the temp-output workspace directory through the controlled shell runner.",
      auditSummary: "Local assistant planned a workspace-write temp-output creation command.",
      auditDetail: "Workspace write shell command task: create temp-output directory"
    });

    expect(result.resultTitle).toBe("Create temp-output directory");
    expect(result.resultSummary).toContain("New-Item -ItemType Directory -Force temp-output");
    expect(result.resultSummary).toContain("工作区写入命令已完成。");
    expect(result.resultSummary).toContain("命令：New-Item -ItemType Directory -Force temp-output");
    expect(result.resultSummary).toContain("输出预览：temp-output");
    expect(result.resultSummary).not.toContain("Workspace write shell command completed successfully");
    expect(result.resultSummary).not.toContain("Command:");
    expect(result.resultSummary).not.toContain("Preview:");
  });

  it("adds command, permission, and recovery context when workspace-write shell execution fails", async () => {
    runWorkspaceWriteShellCommandMock.mockRejectedValueOnce(
      new Error("Tauri workspace_write_command failed: access denied")
    );

    await expect(
      executeAssistantTask({
        kind: "workspace-write-create-temp-output",
        title: "Create temp-output directory",
        summary: "Create the temp-output workspace directory through the controlled shell runner.",
        auditSummary: "Local assistant planned a workspace-write temp-output creation command.",
        auditDetail: "Workspace write shell command task: create temp-output directory"
      })
    ).rejects.toThrow(
      /Shell execution failed in assistantTaskService\. Command id: create-temp-output-dir\. Required permission: workspace-write\. Underlying error: Tauri workspace_write_command failed: access denied\. Next step: verify the permission approval, workspace root, command whitelist, and audit trail before retrying\./i
    );
  });

  it("executes the approved temp-output removal command through the desktop service", async () => {
    runControlledFullShellCommandMock.mockResolvedValueOnce({
      command_id: "remove-temp-output-dir",
      command_label: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      stdout_preview: "temp-output removed",
      line_count: 1,
      summary: "Controlled full shell command completed successfully."
    });

    const result = await executeAssistantTask({
      kind: "controlled-full-remove-temp-output",
      title: "Remove temp-output directory",
      summary: "Remove the temp-output workspace directory through the confirmed shell runner.",
      auditSummary: "Local assistant planned a controlled-full temp-output removal command.",
      auditDetail: "Controlled full shell command task: remove temp-output directory"
    } as any);

    expect(result.resultTitle).toBe("Remove temp-output directory");
    expect(result.resultSummary).toContain("Remove-Item -LiteralPath temp-output -Recurse -Force");
    expect(result.resultSummary).toContain("受控高风险命令已完成。");
    expect(result.resultSummary).toContain("命令：Remove-Item -LiteralPath temp-output -Recurse -Force");
    expect(result.resultSummary).toContain("输出预览：temp-output removed");
    expect(result.resultSummary).not.toContain("Controlled full shell command completed successfully");
    expect(result.resultSummary).not.toContain("Command:");
    expect(result.resultSummary).not.toContain("Preview:");
  });

  it("adds command, permission, and recovery context when controlled-full shell execution fails", async () => {
    runControlledFullShellCommandMock.mockRejectedValueOnce(
      new Error("Tauri controlled_full_command failed: snapshot unavailable")
    );

    await expect(
      executeAssistantTask({
        kind: "controlled-full-remove-temp-output",
        title: "Remove temp-output directory",
        summary: "Remove the temp-output workspace directory through the confirmed shell runner.",
        auditSummary: "Local assistant planned a controlled-full temp-output removal command.",
        auditDetail: "Controlled full shell command task: remove temp-output directory"
      } as any)
    ).rejects.toThrow(
      /Shell execution failed in assistantTaskService\. Command id: remove-temp-output-dir\. Required permission: controlled-full\. Underlying error: Tauri controlled_full_command failed: snapshot unavailable\. Next step: verify the dangerous confirmation, rollback snapshot availability, workspace root, command whitelist, and audit trail before retrying\./i
    );
  });

  it("blocks controlled-full shell execution before invoking Tauri when rollback snapshots are unavailable", async () => {
    const callsBefore = runControlledFullShellCommandMock.mock.calls.length;

    await expect(
      executeAssistantTask(
        {
          kind: "controlled-full-remove-temp-output",
          title: "Remove temp-output directory",
          summary: "Remove the temp-output workspace directory through the confirmed shell runner.",
          auditSummary: "Local assistant planned a controlled-full temp-output removal command.",
          auditDetail: "Controlled full shell command task: remove temp-output directory"
        } as any,
        {
          snapshotAvailable: false
        }
      )
    ).rejects.toThrow(
      /Shell execution blocked in assistantTaskService\. Command id: remove-temp-output-dir\. Required permission: controlled-full\. Reason: rollback snapshot unavailable\. Next step: restore snapshot capability or run a readonly preview before retrying destructive execution\./i
    );

    expect(runControlledFullShellCommandMock.mock.calls).toHaveLength(callsBefore);
  });
});
