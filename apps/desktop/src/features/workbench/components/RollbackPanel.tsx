import type { WorkbenchState } from "../workbenchState";
import { normalizeWorkbenchText } from "../workbenchText";

type RollbackPanelProps = {
  state: WorkbenchState;
  onPreviewRollback: (targetEntryId: string) => void;
  onApplyRollback: () => void;
  onCancelRollback: () => void;
};

export function RollbackPanel({
  state,
  onPreviewRollback,
  onApplyRollback,
  onCancelRollback
}: RollbackPanelProps) {
  return (
    <section>
      <h2>回退记录</h2>
      {state.rollback.pendingPreview ? (
        <>
          <p className="muted">目标回退点: {normalizeWorkbenchText(state.rollback.pendingPreview.targetLabel)}</p>
          <p className="muted">目标说明: {normalizeWorkbenchText(state.rollback.pendingPreview.targetSummary)}</p>
          <p className="muted">将回退 {state.rollback.pendingPreview.willRevertCount} 个后续状态</p>
          {state.rollback.pendingPreview.affectedEntries.map((entry) => (
            <p className="muted" key={entry.id}>
              将回退: {normalizeWorkbenchText(entry.label)}
            </p>
          ))}
          <div className="action-row">
            <button className="action-button action-button-primary" type="button" onClick={onApplyRollback}>
              确认回退
            </button>
            <button className="action-button" type="button" onClick={onCancelRollback}>
              取消回退
            </button>
          </div>
        </>
      ) : (
        <p className="muted">当前没有待确认的回退操作</p>
      )}
      {state.rollback.entries.map((entry) => (
        <div key={entry.id}>
          <p className="muted">{normalizeWorkbenchText(entry.label)}</p>
          <p className="muted">{normalizeWorkbenchText(entry.summary)}</p>
          <button className="action-button" type="button" onClick={() => onPreviewRollback(entry.id)}>
            预览回退到 {normalizeWorkbenchText(entry.label)}
          </button>
        </div>
      ))}
    </section>
  );
}
