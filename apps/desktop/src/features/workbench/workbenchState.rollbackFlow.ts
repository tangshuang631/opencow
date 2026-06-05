import { applyRollback, previewRollback, recordRollbackEntry } from "./workbenchState.rollback";
import { prependConversationEntry } from "./workbenchState.shared";
import type { WorkbenchState } from "./workbenchState.types";
import { pruneRollbackSnapshots } from "./workbenchState.rollback";

export function requestRollbackPreviewState(state: WorkbenchState, targetEntryId: string): WorkbenchState {
  const preview = previewRollback(state.rollback, targetEntryId);
  const targetEntry = state.rollback.entries.find((entry) => entry.id === targetEntryId);

  if (!targetEntry) {
    return state;
  }

  return {
    ...state,
    conversation: {
      entries: prependConversationEntry(state.conversation.entries, {
        id: `rollback-preview-${targetEntryId}`,
        kind: "system",
        title: "等待确认回退",
        summary: `准备回退到 ${targetEntry.label}，将撤销 ${preview.willRevertCount} 个后续状态。`,
        actionLabel: `预览回退到 ${targetEntry.label}`,
        rollbackTargetId: targetEntryId
      })
    },
    rollback: {
      ...state.rollback,
      pendingPreview: {
        targetEntryId,
        targetLabel: targetEntry.label,
        targetSummary: targetEntry.summary,
        willRevertCount: preview.willRevertCount,
        affectedEntries: preview.affectedEntries.map((entry) => ({
          id: entry.id,
          label: entry.label,
          summary: entry.summary
        }))
      }
    },
    audit: {
      summary: "等待用户确认回退",
      lastEvent: {
        module: "rollback",
        detail: `准备回退到 ${targetEntry.label}，将撤销 ${preview.willRevertCount} 个后续状态。`,
        timestamp: "待用户确认",
        source: "rollback_preview"
      }
    }
  };
}

export function applyPendingRollbackState(state: WorkbenchState): WorkbenchState {
  const pendingPreview = state.rollback.pendingPreview;

  if (!pendingPreview) {
    return state;
  }

  const snapshot = state.rollback.snapshots[pendingPreview.targetEntryId];

  if (!snapshot) {
    return state;
  }

  const restoredJournal = applyRollback(state.rollback, pendingPreview.targetEntryId);

  return {
    ...state,
    ...snapshot,
    conversation: {
      entries: prependConversationEntry(state.conversation.entries, {
        id: `rollback-applied-${pendingPreview.targetEntryId}`,
        kind: "system",
        title: `已回退到 ${pendingPreview.targetLabel}`,
        summary: `已恢复目标快照，并撤销 ${pendingPreview.willRevertCount} 个后续状态。`,
        actionLabel: `预览回退到 ${pendingPreview.targetLabel}`,
        rollbackTargetId: pendingPreview.targetEntryId
      })
    },
    rollback: {
      ...restoredJournal,
      snapshots: pruneRollbackSnapshots(state.rollback.snapshots, restoredJournal.entries),
      pendingPreview: null
    },
    audit: {
      summary: `已回退到 ${pendingPreview.targetLabel}`,
      lastEvent: {
        module: "rollback",
        detail: `已回退到 ${pendingPreview.targetLabel}，共撤销 ${pendingPreview.willRevertCount} 个后续状态。`,
        timestamp: "已回退",
        source: "rollback_applied"
      }
    }
  };
}

export function cancelPendingRollbackState(state: WorkbenchState): WorkbenchState {
  const pendingPreview = state.rollback.pendingPreview;

  if (!pendingPreview) {
    return state;
  }

  return {
    ...state,
    conversation: {
      entries: prependConversationEntry(state.conversation.entries, {
        id: `rollback-cancelled-${pendingPreview.targetEntryId}`,
        kind: "system",
        title: "已取消回退",
        summary: `已取消回退到 ${pendingPreview.targetLabel}。`,
        actionLabel: `预览回退到 ${pendingPreview.targetLabel}`,
        rollbackTargetId: pendingPreview.targetEntryId
      })
    },
    rollback: {
      ...state.rollback,
      pendingPreview: null
    },
    audit: {
      summary: "已取消回退",
      lastEvent: {
        module: "rollback",
        detail: `已取消回退到 ${pendingPreview.targetLabel}。`,
        timestamp: "已取消",
        source: "rollback_cancelled"
      }
    }
  };
}

export function createRollbackLimitUpdatedState(state: WorkbenchState, requestedLimit: number): WorkbenchState {
  const nextLimit = Math.min(state.rollback.maxLimit, Math.max(state.rollback.defaultLimit, requestedLimit));

  if (nextLimit === state.rollback.activeLimit) {
    return state;
  }

  return recordRollbackEntry(
    {
      ...state,
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: `rollback-limit-updated-${nextLimit}`,
          kind: "system",
          title: "已更新回退点上限",
          summary: `当前最多保留 ${nextLimit} 段可回退点。`,
          actionLabel: "预览回退到 启动基线",
          rollbackTargetId: "startup-baseline"
        })
      },
      rollback: {
        ...state.rollback,
        activeLimit: nextLimit
      },
      audit: {
        summary: "已更新回退点上限",
        lastEvent: {
          module: "rollback",
          detail: `回退点上限已调整为 ${nextLimit}，默认基线仍为 ${state.rollback.defaultLimit}。`,
          timestamp: "已调整",
          source: "rollback_limit_update"
        }
      }
    },
    `rollback-limit-${nextLimit}`,
    "回退点上限调整",
    `当前最多保留 ${nextLimit} 段可回退点。`,
    "session"
  );
}
