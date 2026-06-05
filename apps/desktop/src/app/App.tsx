import { startTransition, useEffect, useState } from "react";
import { loadOllamaOverview } from "../features/ollama/ollamaService";
import { Workbench } from "../features/workbench/Workbench";
import { evaluateDangerousCommandPolicy } from "../features/workbench/commandPolicyService";
import {
  approvePendingConfirmationState,
  approvePermissionModeChangeState,
  cancelPendingConfirmationState,
  cancelPermissionModeChangeState,
  createCommandPolicyBlockedState,
  createHighRiskConfirmationState,
  createInitialWorkbenchState,
  createOllamaLoadErrorState,
  mergeOllamaOverview,
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

  return (
    <Workbench
      state={state}
      onApproveDangerousAction={handleApproveDangerousAction}
      onCancelDangerousAction={handleCancelDangerousAction}
      onApprovePermissionRequest={handleApprovePermissionRequest}
      onCancelPermissionRequest={handleCancelPermissionRequest}
      onDemoDangerousAction={handleDemoDangerousAction}
      onDemoPermissionRequest={handleDemoPermissionRequest}
    />
  );
}
