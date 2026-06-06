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
    expect(result.resultSummary).toContain("Workspace write shell command completed successfully.");
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
    expect(result.resultSummary).toContain("Controlled full shell command completed successfully.");
  });
});
