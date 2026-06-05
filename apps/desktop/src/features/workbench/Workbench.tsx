import type { WorkbenchState } from "./workbenchState";
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
  onPreviewRollback: (targetEntryId: string) => void;
  onApplyRollback: () => void;
  onCancelRollback: () => void;
  onDemoDangerousAction: () => void;
  onDemoPermissionRequest: () => void;
  onDemoSearch: () => void;
  onDemoTaskFailure: () => void;
  onDemoToolResult: () => void;
  onDemoToolError: () => void;
  onSubmitTask: (message: string) => void;
};

export function Workbench({
  state,
  onApproveDangerousAction,
  onCancelDangerousAction,
  onApprovePermissionRequest,
  onCancelPermissionRequest,
  onPreviewRollback,
  onApplyRollback,
  onCancelRollback,
  onDemoDangerousAction,
  onDemoPermissionRequest,
  onDemoSearch,
  onDemoTaskFailure,
  onDemoToolResult,
  onDemoToolError,
  onSubmitTask
}: WorkbenchProps) {
  return (
    <main className="workbench" aria-label="opencow 工作台">
      <Sidebar
        onDemoDangerousAction={onDemoDangerousAction}
        onDemoPermissionRequest={onDemoPermissionRequest}
        onDemoSearch={onDemoSearch}
        onDemoTaskFailure={onDemoTaskFailure}
        onDemoToolResult={onDemoToolResult}
        onDemoToolError={onDemoToolError}
      />
      <section className="workbench-main">
        <MainConversation state={state} onPreviewRollback={onPreviewRollback} />
        <Composer state={state} onSubmitTask={onSubmitTask} />
      </section>
      <Inspector
        state={state}
        onApproveDangerousAction={onApproveDangerousAction}
        onCancelDangerousAction={onCancelDangerousAction}
        onApprovePermissionRequest={onApprovePermissionRequest}
        onCancelPermissionRequest={onCancelPermissionRequest}
        onPreviewRollback={onPreviewRollback}
        onApplyRollback={onApplyRollback}
        onCancelRollback={onCancelRollback}
      />
    </main>
  );
}
