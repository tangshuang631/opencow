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
});
