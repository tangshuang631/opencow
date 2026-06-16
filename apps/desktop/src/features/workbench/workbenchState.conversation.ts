import type { WorkbenchState } from "./workbenchState.types";

const COMPRESSED_CONVERSATION_ENTRY_ID = "conversation-auto-summary";
const MAX_RECENT_CONVERSATIONS = 8;

const EMPTY_OUTPUT = {
  title: "暂无产物",
  summary: "等待工具执行结果或本地产物摘要。"
} as const;

function createNewConversationAuditDetail(preservedTasks: WorkbenchState["tasks"]["items"]): string {
  const queuedCount = preservedTasks.filter((item) => item.status === "queued").length;
  const runningCount = preservedTasks.filter((item) => item.status === "running").length;
  const taskQueueDetail =
    preservedTasks.length > 0
      ? `Preserved active local task queue: queued=${queuedCount}, running=${runningCount}.`
      : "No active local task queue was preserved.";

  return [
    "Started a blank conversation and cleared pending permission and confirmation gates, plus cleared pending rollback preview.",
    "Model, permission mode, settings, and rollback history were preserved.",
    taskQueueDetail
  ].join(" ");
}

export function createNewConversationState(state: WorkbenchState): WorkbenchState {
  const activeTask = state.tasks.activeTaskId
    ? state.tasks.items.find((item) => item.id === state.tasks.activeTaskId)
    : null;
  const preservedTasks = state.tasks.items.filter((item) => item.status === "queued" || item.status === "running");
  const preservedActiveTaskId = activeTask?.status === "running" ? state.tasks.activeTaskId : null;
  const preservedConversationEntries = state.conversation.entries.filter((entry) => entry.id !== COMPRESSED_CONVERSATION_ENTRY_ID);
  const shouldPreserveConversationHistory = preservedConversationEntries.length > 0;
  const nextRecentConversations = shouldPreserveConversationHistory
    ? createNextRecentConversations(state, state.conversation.entries)
    : state.history.recentConversations;

  return {
    ...state,
    conversation: {
      entries: []
    },
    history: {
      lastNonEmptyConversationEntries: shouldPreserveConversationHistory
        ? state.conversation.entries
        : state.history.lastNonEmptyConversationEntries,
      recentConversations: nextRecentConversations
    },
    permission: {
      ...state.permission,
      pendingModeChange: null
    },
    confirmation: {
      pending: null
    },
    rollback: {
      ...state.rollback,
      pendingPreview: null
    },
    sources: {
      items: []
    },
    tools: {
      lastResult: null
    },
    tasks: {
      pendingCount: preservedTasks.filter((item) => item.status === "queued").length,
      activeTaskId: preservedActiveTaskId,
      items: preservedTasks
    },
    output: EMPTY_OUTPUT,
    audit: {
      summary: "已新建空白对话",
      lastEvent: {
        module: "conversation",
        detail: createNewConversationAuditDetail(preservedTasks),
        timestamp: "ready",
        source: "conversation_new"
      }
    },
    error: state.error?.module === "ollama" ? state.error : null
  };
}

export function restoreRecentConversationState(
  state: WorkbenchState,
  conversationId: string
): WorkbenchState {
  const record = state.history.recentConversations.find((item) => item.id === conversationId);

  if (!record) {
    return state;
  }

  return {
    ...state,
    conversation: {
      entries: record.entries
    },
    history: {
      ...state.history,
      lastNonEmptyConversationEntries: record.entries
    },
    audit: {
      summary: "已恢复最近会话",
      lastEvent: {
        module: "conversation",
        detail: `已恢复最近会话：${record.title}`,
        timestamp: "restored",
        source: "conversation_recent_restored"
      }
    },
    error: null
  };
}

export function deleteRecentConversationState(
  state: WorkbenchState,
  conversationId: string
): WorkbenchState {
  const record = state.history.recentConversations.find((item) => item.id === conversationId);

  if (!record) {
    return state;
  }

  return {
    ...state,
    history: {
      ...state.history,
      recentConversations: state.history.recentConversations.filter((item) => item.id !== conversationId),
      lastNonEmptyConversationEntries:
        state.history.lastNonEmptyConversationEntries === record.entries
          ? []
          : state.history.lastNonEmptyConversationEntries
    },
    audit: {
      summary: "已删除最近会话",
      lastEvent: {
        module: "conversation",
        detail: `已删除最近会话：${record.title}`,
        timestamp: "deleted",
        source: "conversation_recent_deleted"
      }
    },
    error: null
  };
}

function createNextRecentConversations(
  state: WorkbenchState,
  entries: WorkbenchState["conversation"]["entries"]
) {
  const normalizedEntries = entries.filter((entry) => entry.id !== COMPRESSED_CONVERSATION_ENTRY_ID);
  const latestFirstEntries = normalizedEntries.slice().reverse();
  const latestUserEntry = latestFirstEntries.find((entry) => entry.kind === "user");
  const latestResultEntry = latestFirstEntries.find((entry) => entry.kind !== "user");
  const title = latestUserEntry?.summary.trim() || latestResultEntry?.title.trim() || "未命名会话";
  const summary = latestResultEntry?.summary.trim() || latestUserEntry?.summary.trim() || "保留的最近会话";
  const nextRecord = {
    id: `recent-conversation-${state.storage.sessionCount}`,
    title,
    summary,
    entries
  };

  return [
    nextRecord,
    ...state.history.recentConversations.filter((record) => record.title !== nextRecord.title || record.summary !== nextRecord.summary)
  ].slice(0, MAX_RECENT_CONVERSATIONS);
}
