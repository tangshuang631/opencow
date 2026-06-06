import type { StorageCleanupTarget, WorkbenchState } from "./workbenchState";
import { Composer } from "./components/Composer";
import { Inspector } from "./components/Inspector";
import { MainConversation } from "./components/MainConversation";
import { Sidebar } from "./components/Sidebar";

type WorkbenchProps = {
  state: WorkbenchState;
  onApproveDangerousAction: () => void;
  onCancelDangerousAction: () => void;
  onApprovePermissionRequest: () => void;
  onCancelPermissionRequest: () => void;
  onRetryOllamaCheck: () => void;
  onRecoverToolError: () => void;
  onPreviewRollback: (targetEntryId: string) => void;
  onApplyRollback: () => void;
  onCancelRollback: () => void;
  onRetryLocalTask: () => void;
  onCancelActiveTask: () => void;
  onUpdateRollbackLimit: (limit: number) => void;
  onCleanupStorage: (target: StorageCleanupTarget) => void;
  onToggleRemoteApi: (enabled: boolean) => void;
  onToggleSearch: (enabled: boolean) => void;
  onSaveRemoteApiConfig: (payload: { baseUrl: string; providerLabel: string; apiKey: string }) => void;
  onSaveSearchProviderConfig: (payload: { providerLabel: string }) => void;
  onSubmitTask: (message: string) => void;
};

export function Workbench({
  state,
  onApproveDangerousAction,
  onCancelDangerousAction,
  onApprovePermissionRequest,
  onCancelPermissionRequest,
  onRetryOllamaCheck,
  onRecoverToolError,
  onPreviewRollback,
  onApplyRollback,
  onCancelRollback,
  onRetryLocalTask,
  onCancelActiveTask,
  onUpdateRollbackLimit,
  onCleanupStorage,
  onToggleRemoteApi,
  onToggleSearch,
  onSaveRemoteApiConfig,
  onSaveSearchProviderConfig,
  onSubmitTask
}: WorkbenchProps) {
  return (
    <main className="workbench" aria-label="opencow 工作台">
      <Sidebar />
      <section className="workbench-main">
        <MainConversation state={state} onPreviewRollback={onPreviewRollback} />
        <Composer state={state} onSubmitTask={onSubmitTask} onCancelActiveTask={onCancelActiveTask} />
      </section>
      <Inspector
        state={state}
        onApproveDangerousAction={onApproveDangerousAction}
        onCancelDangerousAction={onCancelDangerousAction}
        onApprovePermissionRequest={onApprovePermissionRequest}
        onCancelPermissionRequest={onCancelPermissionRequest}
        onRetryOllamaCheck={onRetryOllamaCheck}
        onRecoverToolError={onRecoverToolError}
        onPreviewRollback={onPreviewRollback}
        onApplyRollback={onApplyRollback}
        onCancelRollback={onCancelRollback}
        onRetryLocalTask={onRetryLocalTask}
        onCancelActiveTask={onCancelActiveTask}
        onUpdateRollbackLimit={onUpdateRollbackLimit}
        onCleanupStorage={onCleanupStorage}
        onToggleRemoteApi={onToggleRemoteApi}
        onToggleSearch={onToggleSearch}
        onSaveRemoteApiConfig={onSaveRemoteApiConfig}
        onSaveSearchProviderConfig={onSaveSearchProviderConfig}
      />
    </main>
  );
}
