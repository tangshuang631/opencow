import { describe, expect, it } from "vitest";
import { createHighRiskConfirmationState, createInitialWorkbenchState } from "./workbenchState";

describe("workbenchState high-risk confirmation metadata", () => {
  it("preserves queued execution metadata on pending dangerous confirmations", () => {
    const updated = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "Confirm destructive cleanup",
      summary: "Remove temp-output inside the approved workspace.",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "Delete temp-output after confirmation and snapshot protections.",
      requiredMode: "controlled-full",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a controlled-full temp-output removal command.",
      queuedExecutionAuditDetail: "Controlled full shell command task: remove temp-output directory",
      queuedMessage: "delete temp-output and clean temporary files"
    });

    expect(updated.confirmation.pending).toMatchObject({
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a controlled-full temp-output removal command.",
      queuedExecutionAuditDetail: "Controlled full shell command task: remove temp-output directory",
      queuedMessage: "delete temp-output and clean temporary files"
    });
  });
});
