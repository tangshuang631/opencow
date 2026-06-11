import { describe, expect, it } from "vitest";
import {
  createHighRiskConfirmationState,
  createInitialWorkbenchState,
  createNewConversationState,
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
  });

  it("records that a new conversation clears pending rollback previews", () => {
    const pendingRollbackPreview = requestRollbackPreviewState(createInitialWorkbenchState(), "startup-baseline");

    const next = createNewConversationState(pendingRollbackPreview);

    expect(pendingRollbackPreview.rollback.pendingPreview).not.toBeNull();
    expect(next.rollback.pendingPreview).toBeNull();
    expect(next.audit.lastEvent.source).toBe("conversation_new");
    expect(next.audit.lastEvent.detail).toContain("cleared pending rollback preview");
  });
});
