import { startTransition, useEffect, useState } from "react";
import { loadOllamaOverview } from "../features/ollama/ollamaService";
import { Workbench } from "../features/workbench/Workbench";
import { evaluateDangerousCommandPolicy } from "../features/workbench/commandPolicyService";
import {
  applyPendingRollbackState,
  approvePendingConfirmationState,
  approvePermissionModeChangeState,
  cancelPendingRollbackState,
  cancelPendingConfirmationState,
  cancelPermissionModeChangeState,
  createCommandPolicyBlockedState,
  createCapabilityToggleRequestState,
  createHighRiskConfirmationState,
  createInitialWorkbenchState,
  createOllamaLoadErrorState,
  createRemoteApiConfigState,
  createRemoteApiToggleState,
  createRollbackLimitUpdatedState,
  createSearchEnabledState,
  createSearchProviderConfigState,
  createSearchToggleState,
  createStorageCleanupState,
  createTaskExecutionCancelledState,
  createTaskExecutionFailedState,
  createTaskExecutionRetriedState,
  createTaskExecutionStartedState,
  createTaskExecutionSucceededState,
  createUserTaskSubmittedState,
  createToolExecutionErrorState,
  createToolExecutionState,
  mergeOllamaOverview,
  requestRollbackPreviewState,
  requestPermissionModeChangeState
} from "../features/workbench/workbenchState";

export function App() {
  const [state, setState] = useState(createInitialWorkbenchState);

  function parseCapabilityToggleIntent(message: string, currentState = state) {
    const normalized = message.trim();

    if (normalized.includes("开启联网搜索") || normalized.includes("打开联网搜索")) {
      return {
        feature: "search" as const,
        enabled: true,
        source: "conversation_request",
        reason: "用户要求开启联网搜索以补充最新来源。",
        providerLabel: currentState.search.providerLabel || "Tavily"
      };
    }

    if (normalized.includes("关闭联网搜索")) {
      return {
        feature: "search" as const,
        enabled: false,
        source: "conversation_request",
        reason: "用户要求关闭联网搜索并回到本地优先模式。"
      };
    }

    if (normalized.includes("开启远程 API") || normalized.includes("打开远程 API")) {
      return {
        feature: "remote-api" as const,
        enabled: true,
        source: "conversation_request",
        reason: "用户要求开启远程 API 作为高级设置兼容入口。"
      };
    }

    if (normalized.includes("关闭远程 API")) {
      return {
        feature: "remote-api" as const,
        enabled: false,
        source: "conversation_request",
        reason: "用户要求关闭远程 API 并保持本地 Ollama 优先。"
      };
    }

    return null;
  }

  useEffect(() => {
    let cancelled = false;

    async function syncOllamaState() {
      try {
        const overview = await loadOllamaOverview();

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setState((current) => mergeOllamaOverview(current, overview));
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const detail = error instanceof Error ? error.message : "Unknown ollama load error";

        startTransition(() => {
          setState((current) => createOllamaLoadErrorState(current, detail));
        });
      }
    }

    void syncOllamaState();

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

    const finishTimer = window.setTimeout(() => {
      startTransition(() => {
        setState((current) =>
          createTaskExecutionSucceededState(current, {
            resultTitle: "本地任务结果",
            resultSummary: "已基于本地 Ollama 生成首轮处理结果。"
          })
        );
      });
    }, 180);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(finishTimer);
    };
  }, [state.tasks.activeTaskId, state.tasks.pendingCount]);

  function handleDemoDangerousAction() {
    startTransition(() => {
      setState((current) => {
        const result = evaluateDangerousCommandPolicy(current);

        if (result.kind === "permission-request") {
          return requestPermissionModeChangeState(current, {
            targetMode: result.targetMode,
            reason: result.reason,
            riskSummary: result.riskSummary
          });
        }

        if (result.kind === "confirmation") {
          return createHighRiskConfirmationState(current, {
            title: result.title,
            summary: result.summary,
            commandPreview: result.commandPreview,
            impact: result.impact,
            requiredMode: result.requiredMode,
            safetySummary: result.safetySummary
          });
        }

        return createCommandPolicyBlockedState(current, {
          summary: result.summary,
          detail: result.detail,
          actionLabel: result.actionLabel,
          source: result.source
        });
      });
    });
  }

  function handleDemoPermissionRequest() {
    startTransition(() => {
      setState((current) =>
        requestPermissionModeChangeState(current, {
          targetMode: "workspace-write",
          reason: "需要在工作区内写入修复文件。",
          riskSummary: "允许在授权工作区内创建和修改文件，但仍禁止高风险删除。"
        })
      );
    });
  }

  function handleApproveDangerousAction() {
    startTransition(() => {
      setState((current) => approvePendingConfirmationState(current));
    });
  }

  function handleCancelDangerousAction() {
    startTransition(() => {
      setState((current) => cancelPendingConfirmationState(current));
    });
  }

  function handleApprovePermissionRequest() {
    startTransition(() => {
      setState((current) => approvePermissionModeChangeState(current));
    });
  }

  function handleCancelPermissionRequest() {
    startTransition(() => {
      setState((current) => cancelPermissionModeChangeState(current));
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

  function handleDemoSearch() {
    startTransition(() => {
      setState((current) =>
        createSearchEnabledState(current, {
          provider: "Tavily",
          query: "OpenClaw Windows 本地助手",
          sourceTitle: "OpenClaw GitHub",
          sourceUrl: "https://github.com/example/openclaw",
          summary: "已启用联网搜索，并注入 1 条来源摘要。"
        })
      );
    });
  }

  function handleDemoToolResult() {
    startTransition(() => {
      setState((current) =>
        createToolExecutionState(current, {
          toolLabel: "Skill 扫描",
          summary: "已扫描 6 个本地 Skills，发现 1 个需要用户确认启用。",
          outputTitle: "本地 Skill 清单",
          outputSummary: "生成了最新的本地 Skill 扫描结果，可用于后续启用与审计。",
          source: "skills_scan"
        })
      );
    });
  }

  function handleDemoToolError() {
    startTransition(() => {
      setState((current) =>
        createToolExecutionErrorState(current, {
          toolLabel: "Skill 下载",
          summary: "Skill 下载失败",
          detail: "下载源返回 403，当前未获得联网下载授权。",
          actionLabel: "检查联网开关并重新授权后重试",
          source: "skill_download"
        })
      );
    });
  }

  function handleDemoTaskFailure() {
    startTransition(() => {
      setState((current) =>
        createTaskExecutionFailedState(
          createTaskExecutionStartedState(
            createUserTaskSubmittedState(current, {
              message: "请检查本地模型状态并重试当前任务"
            })
          ),
          {
            summary: "本地任务执行失败",
            detail: "Ollama 响应超时，请检查本地模型状态。",
            actionLabel: "检查 Ollama 服务并重试",
            source: "local_task_runner"
          }
        )
      );
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
          providerLabel: "Tavily"
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
        const capabilityIntent = parseCapabilityToggleIntent(message, current);

        if (capabilityIntent) {
          return createCapabilityToggleRequestState(current, capabilityIntent);
        }

        return createUserTaskSubmittedState(current, { message });
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
      onDemoDangerousAction={handleDemoDangerousAction}
      onDemoPermissionRequest={handleDemoPermissionRequest}
      onDemoSearch={handleDemoSearch}
      onDemoTaskFailure={handleDemoTaskFailure}
      onDemoToolResult={handleDemoToolResult}
      onDemoToolError={handleDemoToolError}
      onSubmitTask={handleSubmitTask}
    />
  );
}
