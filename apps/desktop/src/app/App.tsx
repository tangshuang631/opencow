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
  createHighRiskConfirmationState,
  createInitialWorkbenchState,
  createOllamaLoadErrorState,
  createSearchEnabledState,
  createToolExecutionErrorState,
  createToolExecutionState,
  mergeOllamaOverview,
  requestRollbackPreviewState,
  requestPermissionModeChangeState
} from "../features/workbench/workbenchState";

export function App() {
  const [state, setState] = useState(createInitialWorkbenchState);

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
      onDemoDangerousAction={handleDemoDangerousAction}
      onDemoPermissionRequest={handleDemoPermissionRequest}
      onDemoSearch={handleDemoSearch}
      onDemoToolResult={handleDemoToolResult}
      onDemoToolError={handleDemoToolError}
    />
  );
}
