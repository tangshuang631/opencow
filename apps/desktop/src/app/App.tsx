import { startTransition, useEffect, useState } from "react";
import { loadOllamaOverview } from "../features/ollama/ollamaService";
import { Workbench } from "../features/workbench/Workbench";
import {
  approvePendingConfirmationState,
  approvePermissionModeChangeState,
  cancelPendingConfirmationState,
  cancelPermissionModeChangeState,
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
      setState((current) =>
        createHighRiskConfirmationState(current, {
          title: "确认删除临时目录",
          summary: "模型计划删除工作区内的 temp-output 目录。",
          commandPreview: "Remove-Item .\\temp-output -Recurse",
          impact: "将删除 12 个文件，写入回退快照后才可执行。",
          requiredMode: "controlled-full"
        })
      );
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
