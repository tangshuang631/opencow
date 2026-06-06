import { startTransition, useEffect, useState } from "react";
import { executeAssistantTask, planAssistantTask } from "../features/assistant/assistantTaskService";
import { loadOllamaOverview } from "../features/ollama/ollamaService";
import { Workbench } from "../features/workbench/Workbench";
import {
  applyPendingRollbackState,
  approvePendingConfirmationState,
  approvePermissionModeChangeState,
  cancelPendingConfirmationState,
  cancelPendingRollbackState,
  cancelPermissionModeChangeState,
  createCapabilityToggleRequestState,
  createHighRiskConfirmationState,
  createInitialWorkbenchState,
  createOllamaLoadErrorState,
  createRemoteApiConfigState,
  createRemoteApiToggleState,
  createRollbackLimitUpdatedState,
  createSearchProviderConfigState,
  createSearchToggleState,
  createStorageCleanupState,
  createTaskExecutionCancelledState,
  createTaskExecutionFailedState,
  createTaskExecutionRetriedState,
  createTaskExecutionStartedState,
  createTaskExecutionSucceededState,
  createUserTaskSubmittedState,
  mergeOllamaOverview,
  requestPermissionModeChangeState,
  requestRollbackPreviewState
} from "../features/workbench/workbenchState";
import type { WorkbenchState } from "../features/workbench/workbenchState";
import type { AssistantTaskPlanResult } from "../features/assistant/assistantTaskService";

const CONTINUATION_PREVIEW_KINDS = new Set([
  "rag-local-shell-handoff-preview",
  "skills-local-enabled-rag-shell-handoff-preview",
  "npc-local-enabled-rag-shell-handoff-preview"
]);

export function createContinuationMessageFromPreview(kind: string, message: string): string {
  if (!CONTINUATION_PREVIEW_KINDS.has(kind)) {
    return message.trim();
  }

  const normalized = message
    .replace(/\bpreview\b/gi, "continue")
    .replace(/\bplan\b/gi, "continue")
    .replace(/\bworkflow\b/gi, "continue")
    .replace(/\band continue the next safe shell step to\b/gi, "and continue to")
    .replace(/\band continue the next shell step to\b/gi, "and continue to");

  if (/continue to .* with shell automation/i.test(normalized)) {
    return normalized.trim();
  }

  if (/continue to /i.test(normalized)) {
    return `${normalized.trim()} with shell automation`;
  }

  return normalized.trim();
}

export function resolveContinuationMessage(message: string, state: WorkbenchState): string {
  if (message.trim().toLowerCase() !== "continue") {
    return message;
  }

  const latestPreviewTask = state.tasks.items.find((item) =>
    item.executionKind ? CONTINUATION_PREVIEW_KINDS.has(item.executionKind) : false
  );

  if (!latestPreviewTask?.executionKind) {
    return message;
  }

  return createContinuationMessageFromPreview(latestPreviewTask.executionKind, latestPreviewTask.summary);
}

export function App() {
  const [state, setState] = useState(createInitialWorkbenchState);

  useEffect(() => {
    let cancelled = false;

    void loadOllamaOverview()
      .then((overview) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setState((current) => mergeOllamaOverview(current, overview));
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        const detail = error instanceof Error ? error.message : "Unknown ollama load error";

        startTransition(() => {
          setState((current) => createOllamaLoadErrorState(current, detail));
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.tasks.activeTaskId || state.tasks.pendingCount === 0) {
      return;
    }

    const startTimer = window.setTimeout(() => {
      startTransition(() => {
        setState((current) => createTaskExecutionStartedState(current));
      });
    }, 80);

    return () => {
      window.clearTimeout(startTimer);
    };
  }, [state.tasks.activeTaskId, state.tasks.pendingCount]);

  useEffect(() => {
    if (!state.tasks.activeTaskId) {
      return;
    }

    const activeTask = state.tasks.items.find((item) => item.id === state.tasks.activeTaskId);

    if (!activeTask) {
      return;
    }

    const finishTimer = window.setTimeout(() => {
      if (!activeTask.executionKind) {
        startTransition(() => {
          setState((current) =>
            createTaskExecutionSucceededState(current, {
              resultTitle: "本地助手答复",
              resultSummary: "已基于本地 Ollama 完成当前输入的初步处理。"
            })
          );
        });
        return;
      }

      const executionPlan = {
        kind: activeTask.executionKind,
        title: activeTask.executionTitle ?? "本地助手任务",
        summary: activeTask.summary,
        auditSummary: activeTask.executionAuditSummary ?? "Local assistant planned a task.",
        auditDetail: activeTask.executionAuditDetail ?? activeTask.summary
      } as AssistantTaskPlanResult;

      void executeAssistantTask(executionPlan)
        .then((result) => {
          startTransition(() => {
            setState((current) => createTaskExecutionSucceededState(current, result));
          });
        })
        .catch((error: unknown) => {
          const detail = error instanceof Error ? error.message : "Unknown local assistant execution error";

          startTransition(() => {
            setState((current) =>
              createTaskExecutionFailedState(current, {
                summary: "本地任务执行失败",
                detail,
                actionLabel: "检查本地执行链后重试",
                source: "local_task_runner"
              })
            );
          });
        });
    }, 120);

    return () => {
      window.clearTimeout(finishTimer);
    };
  }, [state.tasks.activeTaskId, state.tasks.items]);

  function parseCapabilityToggleIntent(message: string, currentState: WorkbenchState) {
    const normalized = message.trim();

    if (normalized.includes("开启联网搜索") || normalized.includes("打开联网搜索")) {
      return {
        feature: "search" as const,
        enabled: true,
        source: "conversation_request",
        reason: "用户请求开启联网搜索以补充最新来源。",
        providerLabel: currentState.search.providerLabel || "Tavily"
      };
    }

    if (normalized.includes("关闭联网搜索")) {
      return {
        feature: "search" as const,
        enabled: false,
        source: "conversation_request",
        reason: "用户请求关闭联网搜索并保持本地优先。"
      };
    }

    if (normalized.includes("开启远程API") || normalized.includes("开启远程 API") || normalized.includes("打开远程 API")) {
      return {
        feature: "remote-api" as const,
        enabled: true,
        source: "conversation_request",
        reason: "用户请求开启远程 API 作为高级配置入口。"
      };
    }

    if (normalized.includes("关闭远程API") || normalized.includes("关闭远程 API")) {
      return {
        feature: "remote-api" as const,
        enabled: false,
        source: "conversation_request",
        reason: "用户请求关闭远程 API 并保持本地 Ollama 优先。"
      };
    }

    return null;
  }

  function handleApproveDangerousAction() {
    startTransition(() => {
      setState((current) => {
        const pendingConfirmation = current.confirmation.pending;
        const approvedState = approvePendingConfirmationState(current);

        if (!pendingConfirmation?.queuedExecutionKind || !pendingConfirmation.queuedMessage) {
          return approvedState;
        }

        return createUserTaskSubmittedState(approvedState, {
          message: pendingConfirmation.queuedMessage,
          executionKind: pendingConfirmation.queuedExecutionKind,
          executionTitle: pendingConfirmation.queuedExecutionTitle,
          executionAuditSummary: pendingConfirmation.queuedExecutionAuditSummary,
          executionAuditDetail: pendingConfirmation.queuedExecutionAuditDetail
        });
      });
    });
  }

  function handleCancelDangerousAction() {
    startTransition(() => {
      setState((current) => cancelPendingConfirmationState(current));
    });
  }

  function handleApprovePermissionRequest() {
    startTransition(() => {
      setState((current) => {
        const pendingModeChange = current.permission.pendingModeChange;
        const approvedState = approvePermissionModeChangeState(current);

        if (!pendingModeChange?.queuedMessage) {
          return approvedState;
        }

        const continuedPlan = planAssistantTask(pendingModeChange.queuedMessage, approvedState.permission.mode);

        if (continuedPlan.kind === "permission-request") {
          return requestPermissionModeChangeState(approvedState, {
            targetMode: continuedPlan.targetMode,
            reason: continuedPlan.reason,
            riskSummary: continuedPlan.riskSummary,
            queuedExecutionKind: continuedPlan.queuedExecutionKind,
            queuedExecutionTitle: continuedPlan.queuedExecutionTitle,
            queuedExecutionAuditSummary: continuedPlan.queuedExecutionAuditSummary,
            queuedExecutionAuditDetail: continuedPlan.queuedExecutionAuditDetail,
            queuedMessage: continuedPlan.queuedMessage
          });
        }

        if (continuedPlan.kind === "confirmation") {
          return createHighRiskConfirmationState(approvedState, {
            title: continuedPlan.title,
            summary: continuedPlan.summary,
            commandPreview: continuedPlan.commandPreview,
            impact: continuedPlan.impact,
            requiredMode: continuedPlan.requiredMode,
            safetySummary: continuedPlan.safetySummary,
            queuedExecutionKind: continuedPlan.queuedExecutionKind,
            queuedExecutionTitle: continuedPlan.queuedExecutionTitle,
            queuedExecutionAuditSummary: continuedPlan.queuedExecutionAuditSummary,
            queuedExecutionAuditDetail: continuedPlan.queuedExecutionAuditDetail,
            queuedMessage: continuedPlan.queuedMessage
          });
        }

        return createUserTaskSubmittedState(approvedState, {
          message: pendingModeChange.queuedMessage,
          executionKind: continuedPlan.kind,
          executionTitle: continuedPlan.title,
          executionAuditSummary: continuedPlan.auditSummary,
          executionAuditDetail: continuedPlan.auditDetail
        });
      });
    });
  }

  function handleCancelPermissionRequest() {
    startTransition(() => {
      setState((current) => cancelPermissionModeChangeState(current));
    });
  }

  function handleRetryOllamaCheck() {
    void loadOllamaOverview()
      .then((overview) => {
        startTransition(() => {
          setState((current) => mergeOllamaOverview(current, overview));
        });
      })
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : "Unknown ollama load error";

        startTransition(() => {
          setState((current) => createOllamaLoadErrorState(current, detail));
        });
      });
  }

  function handleRecoverToolError() {
    startTransition(() => {
      setState((current) => current);
    });
  }

  function handlePreviewRollback(targetEntryId: string) {
    startTransition(() => {
      setState((current) => requestRollbackPreviewState(current, targetEntryId));
    });
  }

  function handleApplyRollback() {
    startTransition(() => {
      setState((current) => applyPendingRollbackState(current));
    });
  }

  function handleCancelRollback() {
    startTransition(() => {
      setState((current) => cancelPendingRollbackState(current));
    });
  }

  function handleRetryLocalTask() {
    startTransition(() => {
      setState((current) => createTaskExecutionRetriedState(current));
    });
  }

  function handleCancelActiveTask() {
    startTransition(() => {
      setState((current) => createTaskExecutionCancelledState(current));
    });
  }

  function handleUpdateRollbackLimit(limit: number) {
    startTransition(() => {
      setState((current) => createRollbackLimitUpdatedState(current, limit));
    });
  }

  function handleCleanupStorage(target: "conversation" | "logs" | "cache" | "snapshots" | "knowledge") {
    startTransition(() => {
      setState((current) => createStorageCleanupState(current, target));
    });
  }

  function handleToggleRemoteApi(enabled: boolean) {
    startTransition(() => {
      setState((current) => createRemoteApiToggleState(current, enabled));
    });
  }

  function handleToggleSearch(enabled: boolean) {
    startTransition(() => {
      setState((current) =>
        createSearchToggleState(current, {
          enabled,
          providerLabel: current.search.providerLabel || "Tavily"
        })
      );
    });
  }

  function handleSaveRemoteApiConfig(payload: { baseUrl: string; providerLabel: string; apiKey: string }) {
    startTransition(() => {
      setState((current) => createRemoteApiConfigState(current, payload));
    });
  }

  function handleSaveSearchProviderConfig(payload: { providerLabel: string }) {
    startTransition(() => {
      setState((current) => createSearchProviderConfigState(current, payload));
    });
  }

  function handleSubmitTask(message: string) {
    startTransition(() => {
      setState((current) => {
        const resolvedMessage = resolveContinuationMessage(message, current);
        const capabilityIntent = parseCapabilityToggleIntent(resolvedMessage, current);

        if (capabilityIntent) {
          return createCapabilityToggleRequestState(current, capabilityIntent);
        }

        const assistantPlan = planAssistantTask(resolvedMessage, current.permission.mode);

        if (assistantPlan.kind === "permission-request") {
          return requestPermissionModeChangeState(current, {
            targetMode: assistantPlan.targetMode,
            reason: assistantPlan.reason,
            riskSummary: assistantPlan.riskSummary,
            queuedExecutionKind: assistantPlan.queuedExecutionKind,
            queuedExecutionTitle: assistantPlan.queuedExecutionTitle,
            queuedExecutionAuditSummary: assistantPlan.queuedExecutionAuditSummary,
            queuedExecutionAuditDetail: assistantPlan.queuedExecutionAuditDetail,
            queuedMessage: assistantPlan.queuedMessage
          });
        }

        if (assistantPlan.kind === "confirmation") {
          return createHighRiskConfirmationState(current, {
            title: assistantPlan.title,
            summary: assistantPlan.summary,
            commandPreview: assistantPlan.commandPreview,
            impact: assistantPlan.impact,
            requiredMode: assistantPlan.requiredMode,
            safetySummary: assistantPlan.safetySummary,
            queuedExecutionKind: assistantPlan.queuedExecutionKind,
            queuedExecutionTitle: assistantPlan.queuedExecutionTitle,
            queuedExecutionAuditSummary: assistantPlan.queuedExecutionAuditSummary,
            queuedExecutionAuditDetail: assistantPlan.queuedExecutionAuditDetail,
            queuedMessage: assistantPlan.queuedMessage
          });
        }

        return createUserTaskSubmittedState(current, {
          message: resolvedMessage,
          executionKind: assistantPlan.kind,
          executionTitle: assistantPlan.title,
          executionAuditSummary: assistantPlan.auditSummary,
          executionAuditDetail: assistantPlan.auditDetail
        });
      });
    });
  }

  return (
    <Workbench
      state={state}
      onApproveDangerousAction={handleApproveDangerousAction}
      onCancelDangerousAction={handleCancelDangerousAction}
      onApprovePermissionRequest={handleApprovePermissionRequest}
      onCancelPermissionRequest={handleCancelPermissionRequest}
      onRetryOllamaCheck={handleRetryOllamaCheck}
      onRecoverToolError={handleRecoverToolError}
      onPreviewRollback={handlePreviewRollback}
      onApplyRollback={handleApplyRollback}
      onCancelRollback={handleCancelRollback}
      onRetryLocalTask={handleRetryLocalTask}
      onCancelActiveTask={handleCancelActiveTask}
      onUpdateRollbackLimit={handleUpdateRollbackLimit}
      onCleanupStorage={handleCleanupStorage}
      onToggleRemoteApi={handleToggleRemoteApi}
      onToggleSearch={handleToggleSearch}
      onSaveRemoteApiConfig={handleSaveRemoteApiConfig}
      onSaveSearchProviderConfig={handleSaveSearchProviderConfig}
      onSubmitTask={handleSubmitTask}
    />
  );
}
