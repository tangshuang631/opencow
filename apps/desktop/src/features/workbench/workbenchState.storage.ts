import { recordRollbackEntry } from "./workbenchState.rollback";
import { prependConversationEntry } from "./workbenchState.shared";
import type { StorageCleanupTarget, WorkbenchState } from "./workbenchState.types";

const cleanupLabels: Record<StorageCleanupTarget, string> = {
  conversation: "清空会话",
  logs: "清空日志",
  cache: "清空缓存",
  snapshots: "清空快照",
  knowledge: "清空知识库索引"
};

const cleanupTitles: Record<StorageCleanupTarget, string> = {
  conversation: "已清空本地会话",
  logs: "已清空本地日志",
  cache: "已清理本地缓存",
  snapshots: "已清空本地快照",
  knowledge: "已清空知识库索引"
};

export function createStorageCleanupState(
  state: WorkbenchState,
  target: StorageCleanupTarget
): WorkbenchState {
  const title = cleanupTitles[target];
  const label = cleanupLabels[target];
  const nextState = buildCleanupState(state, target, title);

  return recordRollbackEntry(
    nextState,
    `storage-cleanup-${target}-${state.rollback.entries.length}`,
    label,
    `${title}，维护入口已写入审计日志。`,
    "session"
  );
}

export function withStorageDelta(
  state: WorkbenchState,
  delta: Partial<WorkbenchState["storage"]>
): WorkbenchState {
  return {
    ...state,
    storage: {
      ...state.storage,
      ...delta
    }
  };
}

function buildCleanupState(
  state: WorkbenchState,
  target: StorageCleanupTarget,
  title: string
): WorkbenchState {
  const nextStorage = {
    ...state.storage
  };

  let nextState: WorkbenchState = state;

  if (target === "conversation") {
    nextStorage.sessionCount = 0;
  }

  if (target === "logs") {
    nextStorage.logCount = 0;
  }

  if (target === "cache") {
    nextStorage.cacheCount = 0;
    nextState = {
      ...nextState,
      sources: {
        items: []
      },
      tools: {
        lastResult: null
      },
      output: {
        title: "暂无产物",
        summary: "等待工具执行结果或本地产物摘要。"
      }
    };
  }

  if (target === "snapshots") {
    nextStorage.snapshotCount = 0;
  }

  if (target === "knowledge") {
    nextStorage.knowledgeCount = 0;
  }

  return {
    ...nextState,
    conversation: {
      entries: prependConversationEntry(nextState.conversation.entries, {
        id: `storage-cleanup-${target}`,
        kind: "system",
        title,
        summary: `${labelForSummary(target)}已完成，可继续安全执行本地任务。`,
        actionLabel: "预览回退到 启动基线",
        rollbackTargetId: "startup-baseline"
      })
    },
    history: {
      lastNonEmptyConversationEntries: target === "conversation"
        ? []
        : nextState.history.lastNonEmptyConversationEntries,
      recentConversations: target === "conversation"
        ? []
        : nextState.history.recentConversations
    },
    storage: nextStorage,
    audit: {
      summary: title,
      lastEvent: {
        module: "storage",
        detail: `${labelForSummary(target)}已完成，当前维护动作仅影响本地原型状态。`,
        timestamp: "已执行",
        source: `storage_cleanup_${target}`
      }
    },
    error: null
  };
}

function labelForSummary(target: StorageCleanupTarget) {
  if (target === "conversation") {
    return "会话清理";
  }

  if (target === "logs") {
    return "日志清理";
  }

  if (target === "cache") {
    return "缓存清理";
  }

  if (target === "snapshots") {
    return "快照清理";
  }

  return "知识库索引清理";
}
