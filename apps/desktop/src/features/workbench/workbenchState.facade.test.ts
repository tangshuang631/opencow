import { describe, expect, it } from "vitest";
import * as workbenchState from "./workbenchState";

describe("workbenchState facade", () => {
  it("keeps the public state transition api available from the main module", () => {
    expect(workbenchState.createInitialWorkbenchState).toBeTypeOf("function");
    expect(workbenchState.mergeOllamaOverview).toBeTypeOf("function");
    expect(workbenchState.createOllamaLoadErrorState).toBeTypeOf("function");
    expect(workbenchState.createCommandPolicyBlockedState).toBeTypeOf("function");
    expect(workbenchState.createHighRiskConfirmationState).toBeTypeOf("function");
    expect(workbenchState.approvePendingConfirmationState).toBeTypeOf("function");
    expect(workbenchState.cancelPendingConfirmationState).toBeTypeOf("function");
    expect(workbenchState.requestPermissionModeChangeState).toBeTypeOf("function");
    expect(workbenchState.approvePermissionModeChangeState).toBeTypeOf("function");
    expect(workbenchState.cancelPermissionModeChangeState).toBeTypeOf("function");
    expect(workbenchState.requestRollbackPreviewState).toBeTypeOf("function");
    expect(workbenchState.applyPendingRollbackState).toBeTypeOf("function");
    expect(workbenchState.cancelPendingRollbackState).toBeTypeOf("function");
    expect(workbenchState.createRemoteApiToggleState).toBeTypeOf("function");
    expect(workbenchState.createSearchToggleState).toBeTypeOf("function");
    expect(workbenchState.createSearchEnabledState).toBeTypeOf("function");
    expect(workbenchState.createStorageCleanupState).toBeTypeOf("function");
    expect(workbenchState.createToolExecutionState).toBeTypeOf("function");
    expect(workbenchState.createToolExecutionErrorState).toBeTypeOf("function");
    expect(workbenchState.createUserTaskSubmittedState).toBeTypeOf("function");
    expect(workbenchState.createTaskExecutionStartedState).toBeTypeOf("function");
    expect(workbenchState.createTaskExecutionSucceededState).toBeTypeOf("function");
    expect(workbenchState.createTaskExecutionFailedState).toBeTypeOf("function");
    expect(workbenchState.createTaskExecutionRetriedState).toBeTypeOf("function");
    expect(workbenchState.createTaskExecutionCancelledState).toBeTypeOf("function");
  });
});
