import { describe, expect, it } from "vitest";
import {
  createContinuationMessageFromPreview,
  resolveContinuationMessage,
  shouldRecoverStaleActiveTaskSlot,
  shouldScheduleLocalTaskStart
} from "./App";
import {
  cancelPendingConfirmationState,
  cancelPermissionModeChangeState,
  createCapabilityToggleRequestState,
  createCommandPolicyBlockedState,
  createHighRiskConfirmationState,
  createInitialWorkbenchState,
  createTaskExecutionCancelledState,
  createTaskExecutionFailedState,
  createTaskExecutionStartedState,
  createUserTaskSubmittedState,
  requestPermissionModeChangeState
} from "../features/workbench/workbenchState";

describe("createContinuationMessageFromPreview", () => {
  it("schedules local task start when the active task slot is stale", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "inspect workspace state"
    });
    const staleMissingActive = {
      ...queued,
      tasks: {
        ...queued.tasks,
        activeTaskId: "missing-active-task"
      }
    };
    const queuedAgain = createUserTaskSubmittedState(queued, {
      message: "inspect package config"
    });
    const staleCompletedActive = {
      ...queuedAgain,
      tasks: {
        ...queuedAgain.tasks,
        activeTaskId: queuedAgain.tasks.items[1]?.id ?? null,
        items: queuedAgain.tasks.items.map((item) =>
          item.id === queuedAgain.tasks.items[1]?.id
            ? {
                ...item,
                status: "completed" as const
              }
            : item
        )
      }
    };
    const running = createTaskExecutionStartedState(queued);

    expect(shouldScheduleLocalTaskStart(queued)).toBe(true);
    expect(shouldScheduleLocalTaskStart(staleMissingActive)).toBe(true);
    expect(shouldScheduleLocalTaskStart(staleCompletedActive)).toBe(true);
    expect(shouldScheduleLocalTaskStart(running)).toBe(false);
  });

  it("recovers a stale active task slot when there is no queued task to start", () => {
    const staleActive = {
      ...createInitialWorkbenchState(),
      tasks: {
        pendingCount: 0,
        activeTaskId: "missing-active-task",
        items: []
      }
    };
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "inspect workspace state"
    });
    const running = createTaskExecutionStartedState(queued);

    expect(shouldRecoverStaleActiveTaskSlot(staleActive)).toBe(true);
    expect(shouldRecoverStaleActiveTaskSlot(queued)).toBe(false);
    expect(shouldRecoverStaleActiveTaskSlot(running)).toBe(false);
    expect(shouldScheduleLocalTaskStart(staleActive)).toBe(false);
  });

  it("converts preview wording into a continuation shell request", () => {
    expect(
      createContinuationMessageFromPreview(
        "rag-local-shell-handoff-preview",
        "review local shell permission rules and preview the next safe shell step to create a temp-output folder"
      )
    ).toBe("review local shell permission rules and continue to create a temp-output folder with shell automation");
  });

  it("converts plan wording into a continuation shell request", () => {
    expect(
      createContinuationMessageFromPreview(
        "rag-local-shell-handoff-preview",
        "review local shell permission rules and plan the next safe shell step to create a temp-output folder"
      )
    ).toBe("review local shell permission rules and continue to create a temp-output folder with shell automation");
  });

  it("converts workflow wording into a continuation shell request", () => {
    expect(
      createContinuationMessageFromPreview(
        "rag-local-shell-handoff-preview",
        "review local shell permission rules and workflow the next safe shell step to create a temp-output folder"
      )
    ).toBe("review local shell permission rules and continue to create a temp-output folder with shell automation");
  });

  it("resolves continue from the latest preview task even when the continuation is derived from summary text", () => {
    const withPreviewTask = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "review local shell permission rules and plan the next safe shell step to create a temp-output folder",
      executionKind: "rag-local-shell-handoff-preview",
      executionTitle: "Local RAG shell handoff preview",
      executionAuditSummary: "Local assistant planned a readonly local RAG shell handoff preview.",
      executionAuditDetail: "Readonly local RAG shell handoff preview task"
    });

    expect(resolveContinuationMessage("continue", withPreviewTask)).toBe(
      "review local shell permission rules and continue to create a temp-output folder with shell automation"
    );
  });

  it("prefers a stored continuation message over re-deriving from the preview summary", () => {
    const withPreviewTask = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "Preview a readonly opencow self-repair workflow by inspecting local docs and repair boundaries.",
      executionKind: "opencow-self-repair-preview",
      executionTitle: "Opencow self-repair preview",
      executionAuditSummary: "Local assistant planned a readonly opencow self-repair preview.",
      executionAuditDetail: "Readonly opencow self-repair preview task",
      continuationMessage: "diagnose opencow and continue repairing its enabled skills registry"
    });

    expect(resolveContinuationMessage("continue", withPreviewTask)).toBe(
      "diagnose opencow and continue repairing its enabled skills registry"
    );
  });

  it("treats the Chinese continue command as an explicit preview continuation", () => {
    const withPreviewTask = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "预览修复 opencow 的 enabled skills registry",
      executionKind: "opencow-self-repair-preview",
      executionTitle: "Opencow self-repair preview",
      executionAuditSummary: "Local assistant planned a readonly opencow self-repair preview.",
      executionAuditDetail: "Readonly opencow self-repair preview task",
      continuationMessage: "diagnose opencow and continue repairing its enabled skills registry"
    });

    expect(resolveContinuationMessage("继续", withPreviewTask)).toBe(
      "diagnose opencow and continue repairing its enabled skills registry"
    );
  });

  it("does not reuse a preview continuation after that preview task failed", () => {
    const withPreviewTask = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "预览修复 opencow 的 enabled skills registry",
      executionKind: "opencow-self-repair-preview",
      executionTitle: "Opencow self-repair preview",
      executionAuditSummary: "Local assistant planned a readonly opencow self-repair preview.",
      executionAuditDetail: "Readonly opencow self-repair preview task",
      continuationMessage: "diagnose opencow and continue repairing its enabled skills registry"
    });
    const failedPreview = createTaskExecutionFailedState(createTaskExecutionStartedState(withPreviewTask), {
      summary: "Opencow self-repair stopped after failure analysis",
      detail: "Readonly self-repair preview failed because the local knowledge search index could not be opened.",
      actionLabel: "Check the local knowledge index first, then ask for a narrower repair target.",
      source: "opencow_self_repair_failure_analysis"
    });

    expect(resolveContinuationMessage("continue", failedPreview)).toBe("continue");
    expect(resolveContinuationMessage("继续", failedPreview)).toBe("继续");
  });

  it("does not reuse a preview continuation after that preview task is cancelled", () => {
    const withPreviewTask = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "预览修复 opencow 的 enabled skills registry",
      executionKind: "opencow-self-repair-preview",
      executionTitle: "Opencow self-repair preview",
      executionAuditSummary: "Local assistant planned a readonly opencow self-repair preview.",
      executionAuditDetail: "Readonly opencow self-repair preview task",
      continuationMessage: "diagnose opencow and continue repairing its enabled skills registry"
    });
    const cancelledPreview = createTaskExecutionCancelledState(createTaskExecutionStartedState(withPreviewTask));

    expect(resolveContinuationMessage("continue", cancelledPreview)).toBe("continue");
    expect(resolveContinuationMessage("继续", cancelledPreview)).toBe("继续");
  });

  it("does not reuse preview continuation after a dangerous confirmation is cancelled", () => {
    const withPreviewTask = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "preview the next safe shell step to delete temp-output",
      executionKind: "rag-local-shell-handoff-preview",
      executionTitle: "Local RAG shell handoff preview",
      executionAuditSummary: "Local assistant planned a readonly local RAG shell handoff preview.",
      executionAuditDetail: "Readonly local RAG shell handoff preview task",
      continuationMessage: "continue to delete temp-output with shell automation"
    });
    const withPendingConfirmation = createHighRiskConfirmationState(withPreviewTask, {
      title: "Confirm temp-output removal",
      summary: "Remove temp-output inside the approved workspace.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Delete temp-output after explicit confirmation.",
      requiredMode: "controlled-full",
      queuedExecutionKind: "rag-local-shell-remove-temp-output",
      queuedExecutionTitle: "Local RAG handoff temp-output removal",
      queuedExecutionAuditSummary: "Local assistant planned a local RAG handoff removal task.",
      queuedExecutionAuditDetail: "Local RAG handoff shell removal task",
      queuedMessage: "continue to delete temp-output with shell automation"
    });
    const cancelled = cancelPendingConfirmationState(withPendingConfirmation);

    expect(resolveContinuationMessage("continue", cancelled)).toBe("continue");
  });

  it("does not reuse preview continuation after a permission request is cancelled", () => {
    const withPreviewTask = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "preview the next safe shell step to create a temp-output folder",
      executionKind: "rag-local-shell-handoff-preview",
      executionTitle: "Local RAG shell handoff preview",
      executionAuditSummary: "Local assistant planned a readonly local RAG shell handoff preview.",
      executionAuditDetail: "Readonly local RAG shell handoff preview task",
      continuationMessage: "continue to create a temp-output folder with shell automation"
    });
    const withPendingPermission = requestPermissionModeChangeState(withPreviewTask, {
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before creating temp-output.",
      riskSummary: "Allow fixed workspace-local temp-output creation only.",
      queuedExecutionKind: "rag-local-shell-create-temp-output",
      queuedExecutionTitle: "Local RAG handoff temp-output creation",
      queuedExecutionAuditSummary: "Local assistant planned a local RAG handoff creation task.",
      queuedExecutionAuditDetail: "Local RAG handoff shell creation task",
      queuedMessage: "continue to create a temp-output folder with shell automation"
    });
    const cancelled = cancelPermissionModeChangeState(withPendingPermission);

    expect(resolveContinuationMessage("continue", cancelled)).toBe("continue");
  });

  it("does not reuse preview continuation after a capability confirmation is cancelled", () => {
    const withPreviewTask = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "preview the next safe network search step",
      executionKind: "rag-local-shell-handoff-preview",
      executionTitle: "Local RAG shell handoff preview",
      executionAuditSummary: "Local assistant planned a readonly local RAG shell handoff preview.",
      executionAuditDetail: "Readonly local RAG shell handoff preview task",
      continuationMessage: "continue to search the web with network search"
    });
    const withPendingCapability = createCapabilityToggleRequestState(withPreviewTask, {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "Network search needs explicit capability confirmation.",
      providerLabel: "Tavily",
      queuedMessage: "continue to search the web with network search"
    });
    const cancelled = cancelPendingConfirmationState(withPendingCapability);

    expect(resolveContinuationMessage("continue", cancelled)).toBe("continue");
  });

  it("does not reuse preview continuation after a permission loop guard blocks the chain", () => {
    const withPreviewTask = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "preview the next safe shell step to create a temp-output folder",
      executionKind: "rag-local-shell-handoff-preview",
      executionTitle: "Local RAG shell handoff preview",
      executionAuditSummary: "Local assistant planned a readonly local RAG shell handoff preview.",
      executionAuditDetail: "Readonly local RAG shell handoff preview task",
      continuationMessage: "continue to create a temp-output folder with shell automation"
    });
    const blocked = createCommandPolicyBlockedState(withPreviewTask, {
      summary: "Permission escalation loop stopped",
      detail: "Permission chain stopped because the planner requested workspace-write again after approval.",
      actionLabel: "Review the planner route or rewrite the request before retrying.",
      source: "permission_escalation_loop_guard"
    });

    expect(resolveContinuationMessage("continue", blocked)).toBe("continue");
  });

  it("does not reuse preview continuation after other policy guards block the chain", () => {
    const guardCases = [
      {
        summary: "Dangerous confirmation loop stopped",
        source: "dangerous_confirmation_loop_guard"
      },
      {
        summary: "Dangerous confirmation required after controlled-full approval",
        source: "controlled_full_confirmation_required_guard"
      }
    ];

    for (const guardCase of guardCases) {
      const withPreviewTask = createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "preview the next safe shell step to remove temp-output",
        executionKind: "rag-local-shell-handoff-preview",
        executionTitle: "Local RAG shell handoff preview",
        executionAuditSummary: "Local assistant planned a readonly local RAG shell handoff preview.",
        executionAuditDetail: "Readonly local RAG shell handoff preview task",
        continuationMessage: "continue to remove temp-output with shell automation"
      });
      const blocked = createCommandPolicyBlockedState(withPreviewTask, {
        summary: guardCase.summary,
        detail: "Policy guard stopped this chain before any command could execute.",
        actionLabel: "Review the planner route or restart from a readonly preview.",
        source: guardCase.source
      });

      expect(resolveContinuationMessage("continue", blocked)).toBe("continue");
    }
  });

  it("does not revive an older cancelled continuation after a newer task is submitted", () => {
    const withPreviewTask = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "preview the next safe shell step to create a temp-output folder",
      executionKind: "rag-local-shell-handoff-preview",
      executionTitle: "Local RAG shell handoff preview",
      executionAuditSummary: "Local assistant planned a readonly local RAG shell handoff preview.",
      executionAuditDetail: "Readonly local RAG shell handoff preview task",
      continuationMessage: "continue to create a temp-output folder with shell automation"
    });
    const withPendingPermission = requestPermissionModeChangeState(withPreviewTask, {
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before creating temp-output.",
      riskSummary: "Allow fixed workspace-local temp-output creation only.",
      queuedExecutionKind: "rag-local-shell-create-temp-output",
      queuedExecutionTitle: "Local RAG handoff temp-output creation",
      queuedExecutionAuditSummary: "Local assistant planned a local RAG handoff creation task.",
      queuedExecutionAuditDetail: "Local RAG handoff shell creation task",
      queuedMessage: "continue to create a temp-output folder with shell automation"
    });
    const cancelled = cancelPermissionModeChangeState(withPendingPermission);
    const withNewerTask = createUserTaskSubmittedState(cancelled, {
      message: "inspect workspace config",
      executionKind: "workspace-config-overview",
      executionTitle: "Workspace config overview",
      executionAuditSummary: "Local assistant planned a workspace config overview task.",
      executionAuditDetail: "Readonly workspace config overview task."
    });

    expect(resolveContinuationMessage("continue", withNewerTask)).toBe("continue");
  });
});
