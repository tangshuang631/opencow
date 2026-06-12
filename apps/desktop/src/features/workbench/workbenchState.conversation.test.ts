import { describe, expect, it } from "vitest";
import {
  createHighRiskConfirmationState,
  createInitialWorkbenchState,
  createNewConversationState,
  createTaskExecutionCancelledState,
  createTaskExecutionStartedState,
  createUserTaskSubmittedState,
  requestRollbackPreviewState,
  requestPermissionModeChangeState
} from "./workbenchState";

describe("createNewConversationState", () => {
  it("starts a blank conversation without carrying over old permission or dangerous confirmations", () => {
    const pendingPermission = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before creating temp-output.",
      riskSummary: "Allow a fixed workspace-local temp-output creation command only.",
      queuedExecutionKind: "workspace-write-create-temp-output",
      queuedExecutionTitle: "Create temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output directory task.",
      queuedExecutionAuditDetail: "Workspace-write shell command task: create temp-output directory",
      queuedMessage: "create a temp-output folder for this workspace"
    });
    const pendingDangerousConfirmation = createHighRiskConfirmationState(pendingPermission, {
      title: "Confirm temp-output removal",
      summary: "Remove temp-output inside the approved workspace.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Delete temp-output only after explicit confirmation.",
      requiredMode: "controlled-full",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a controlled-full temp-output removal task.",
      queuedExecutionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
      queuedMessage: "remove the temp-output folder from this workspace"
    });

    const next = createNewConversationState(pendingDangerousConfirmation);

    expect(next.conversation.entries).toHaveLength(0);
    expect(next.permission.pendingModeChange).toBeNull();
    expect(next.confirmation.pending).toBeNull();
    expect(next.permission.mode).toBe("readonly");
    expect(next.audit.lastEvent.source).toBe("conversation_new");
    expect(next.audit.lastEvent.detail).toContain("cleared pending permission and confirmation gates");
    expect(next.audit.lastEvent.detail).toContain("No active local task queue was preserved.");
  });

  it("records that a new conversation clears pending rollback previews", () => {
    const pendingRollbackPreview = requestRollbackPreviewState(createInitialWorkbenchState(), "startup-baseline");

    const next = createNewConversationState(pendingRollbackPreview);

    expect(pendingRollbackPreview.rollback.pendingPreview).not.toBeNull();
    expect(next.rollback.pendingPreview).toBeNull();
    expect(next.audit.lastEvent.source).toBe("conversation_new");
    expect(next.audit.lastEvent.detail).toContain("cleared pending rollback preview");
  });

  it("records when a blank conversation has no active local task queue to preserve", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "generate an NPC config",
        executionKind: "npc-config-write",
        executionTitle: "Generate NPC config"
      })
    );
    const cancelled = createTaskExecutionCancelledState(running);

    const next = createNewConversationState(cancelled);

    expect(next.tasks.activeTaskId).toBeNull();
    expect(next.tasks.pendingCount).toBe(0);
    expect(next.tasks.items).toHaveLength(0);
    expect(next.audit.lastEvent.detail).toContain("No active local task queue was preserved.");
    expect(next.audit.lastEvent.detail).not.toContain("active local task queue were preserved");
  });

  it("records preserved queued and running task counts when a caller keeps them", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "inspect workspace"
    });
    const secondQueued = createUserTaskSubmittedState(queued, {
      message: "scan local skills"
    });
    const running = createTaskExecutionStartedState(secondQueued);

    const next = createNewConversationState(running);

    expect(next.tasks.activeTaskId).toBe(running.tasks.activeTaskId);
    expect(next.tasks.pendingCount).toBe(1);
    expect(next.tasks.items).toHaveLength(2);
    expect(next.audit.lastEvent.detail).toContain("Preserved active local task queue: queued=1, running=1.");
  });
});
