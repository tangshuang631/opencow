import type { WorkbenchState } from "./workbenchState.types";

const COMPRESSED_CONVERSATION_ENTRY_ID = "conversation-auto-summary";
const MAX_RECENT_CONVERSATIONS = 8;

const EMPTY_OUTPUT = {
  title: "暂无产物",
  summary: "等待工具执行结果或本地产物摘要。"
} as const;

function createDraftConversationRecord(
  state: WorkbenchState,
  entries: WorkbenchState["conversation"]["entries"]
): WorkbenchState["history"]["draftConversations"][number] {
  const normalizedEntries = entries.filter((entry) => entry.id !== COMPRESSED_CONVERSATION_ENTRY_ID);
  const latestFirstEntries = normalizedEntries.slice().reverse();
  const latestUserEntry = latestFirstEntries.find((entry) => entry.kind === "user");
  const latestResultEntry = latestFirstEntries.find((entry) => entry.kind !== "user");
  const title = latestUserEntry?.summary.trim() || latestResultEntry?.title.trim() || "新会话";
  const summary = latestResultEntry?.summary.trim() || latestUserEntry?.summary.trim() || "等待第一条消息";

  return {
    id: state.conversation.restoredFromConversationId ?? `draft-conversation-${state.storage.sessionCount}`,
    title,
    summary,
    entries,
    archivedAt: null
  };
}

function deduplicateConversationRecords(
  records: WorkbenchState["history"]["draftConversations"]
) {
  const seen = new Set<string>();

  return records.filter((record) => {
    if (seen.has(record.id)) {
      return false;
    }

    seen.add(record.id);
    return true;
  });
}

function getDraftConversations(state: WorkbenchState) {
  return state.history.draftConversations ?? [];
}

function getArchivedConversations(state: WorkbenchState) {
  return state.history.archivedConversations ?? [];
}

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
  const draftRecord = createDraftConversationRecord(state, state.conversation.entries);
  const nextDraftConversationId = `draft-conversation-${state.storage.sessionCount + 1}`;
  const nextDraftConversations = [
    {
      id: nextDraftConversationId,
      title: "新会话",
      summary: "等待第一条消息",
      entries: [],
      archivedAt: null
    },
    ...(
      shouldPreserveConversationHistory
        ? [{ ...draftRecord, archivedAt: null }]
        : []
    ),
    ...getDraftConversations(state).filter((record) => record.id !== draftRecord.id)
  ].slice(0, MAX_RECENT_CONVERSATIONS);
  const nextArchivedConversations = shouldPreserveConversationHistory
    ? [
        {
          ...draftRecord,
          archivedAt: new Date().toISOString()
        },
        ...getArchivedConversations(state).filter((record) => record.id !== draftRecord.id)
      ].slice(0, MAX_RECENT_CONVERSATIONS)
    : getArchivedConversations(state);

  return {
    ...state,
    conversation: {
      id: nextDraftConversations[0]?.id ?? nextDraftConversationId,
      entries: [],
      mode: "blank",
      restoredFromConversationId: nextDraftConversations[0]?.id ?? null
    },
    composer: {
      draftAttachments: []
    },
    history: {
      lastNonEmptyConversationEntries: shouldPreserveConversationHistory
        ? state.conversation.entries
        : state.history.lastNonEmptyConversationEntries,
      draftConversations: nextDraftConversations,
      archivedConversations: nextArchivedConversations
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
  const record =
    getDraftConversations(state).find((item) => item.id === conversationId)
    ?? getArchivedConversations(state).find((item) => item.id === conversationId);

  if (!record) {
    return state;
  }

  return {
    ...state,
    conversation: {
      id: record.id,
      entries: record.entries,
      mode: record.entries.length === 0 ? "blank" : "restored",
      restoredFromConversationId: record.id
    },
    composer: {
      draftAttachments: []
    },
    history: {
      ...state.history,
      lastNonEmptyConversationEntries: record.entries,
      draftConversations: deduplicateConversationRecords([
        {
          ...record,
          archivedAt: null
        },
        ...getDraftConversations(state).filter((item) => item.id !== record.id)
      ]).slice(0, MAX_RECENT_CONVERSATIONS)
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
  const record =
    getDraftConversations(state).find((item) => item.id === conversationId)
    ?? getArchivedConversations(state).find((item) => item.id === conversationId);

  if (!record) {
    return state;
  }

  const nextDraftConversations = getDraftConversations(state).filter((item) => item.id !== conversationId);
  const nextArchivedConversations = getArchivedConversations(state).filter((item) => item.id !== conversationId);
  const deletedCurrentConversation = state.conversation.entries === record.entries;
  const nextConversationEntries = deletedCurrentConversation
    ? nextDraftConversations[0]?.entries ?? []
    : state.conversation.entries;
  const nextConversationMode = deletedCurrentConversation
    ? nextDraftConversations[0]
      ? (nextDraftConversations[0]?.entries.length ? "restored" : "blank")
      : "blank"
    : state.conversation.mode ?? (state.conversation.entries.length > 0 ? "history" : "blank");
  const nextRestoredFromConversationId = deletedCurrentConversation
    ? nextDraftConversations[0]?.id ?? null
    : state.conversation.restoredFromConversationId ?? null;
  const nextLastNonEmptyConversationEntries =
    state.history.lastNonEmptyConversationEntries === record.entries
      ? nextConversationEntries
      : state.history.lastNonEmptyConversationEntries;

  return {
    ...state,
    conversation: {
      id: deletedCurrentConversation
        ? (nextDraftConversations[0]?.id ?? `draft-conversation-${state.storage.sessionCount}`)
        : state.conversation.id,
      entries: nextConversationEntries,
      mode: nextConversationMode,
      restoredFromConversationId: nextRestoredFromConversationId
    },
    composer: deletedCurrentConversation
      ? {
          draftAttachments: []
        }
      : state.composer,
    history: {
      ...state.history,
      draftConversations: nextDraftConversations,
      archivedConversations: nextArchivedConversations,
      lastNonEmptyConversationEntries: nextLastNonEmptyConversationEntries
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

export function createArchivedConversationState(state: WorkbenchState): WorkbenchState {
  const preservedConversationEntries = state.conversation.entries.filter((entry) => entry.id !== COMPRESSED_CONVERSATION_ENTRY_ID);

  if (preservedConversationEntries.length === 0) {
    return createNewConversationState(state);
  }

  const currentRecord = createDraftConversationRecord(state, state.conversation.entries);
  const nextDraftConversationId = `draft-conversation-${state.storage.sessionCount + 1}`;

  return {
    ...state,
    conversation: {
      id: nextDraftConversationId,
      entries: [],
      mode: "blank",
      restoredFromConversationId: nextDraftConversationId
    },
    composer: {
      draftAttachments: []
    },
    history: {
      lastNonEmptyConversationEntries: state.conversation.entries,
      draftConversations: [
        {
          id: nextDraftConversationId,
          title: "新会话",
          summary: "等待第一条消息",
          entries: [],
          archivedAt: null
        }
      ],
      archivedConversations: [
        {
          ...currentRecord,
          archivedAt: new Date().toISOString()
        },
        ...getArchivedConversations(state).filter((item) => item.id !== currentRecord.id)
      ].slice(0, MAX_RECENT_CONVERSATIONS)
    },
    sources: {
      items: []
    },
    tools: {
      lastResult: null
    },
    output: EMPTY_OUTPUT,
    audit: {
      summary: "已归档当前会话",
      lastEvent: {
        module: "conversation",
        detail: `已归档当前会话：${currentRecord.title}`,
        timestamp: "archived",
        source: "conversation_archived"
      }
    },
    error: state.error?.module === "ollama" ? state.error : null
  };
}
