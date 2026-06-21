import { invoke } from "@tauri-apps/api/core";
import { createInitialWorkbenchState } from "./workbenchState.initial";
import type { ConversationMode, LocalTaskItem, WorkbenchState } from "./workbenchState.types";

const WORKBENCH_STATE_STORAGE_KEY = "opencow.desktop.workbench-state.v1";
const tauriInternals = "__TAURI_INTERNALS__" as const;

type PersistedWorkbenchStateEnvelope = {
  version: 1;
  state: WorkbenchState;
};

type NativeWorkbenchStateReadResult = {
  found: boolean;
  payload: PersistedWorkbenchStateEnvelope | null;
};

function deduplicateRecentConversations(records: WorkbenchState["history"]["draftConversations"]) {
  const seen = new Set<string>();

  return records.filter((record) => {
    if (seen.has(record.id)) {
      return false;
    }

    seen.add(record.id);
    return true;
  });
}

function isBrowserStorageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isTauriDesktopAvailable() {
  return typeof window !== "undefined" && tauriInternals in window;
}

function createPersistedEnvelope(state: WorkbenchState): PersistedWorkbenchStateEnvelope {
  return {
    version: 1,
    state
  };
}

function loadLegacyBrowserEnvelope(): PersistedWorkbenchStateEnvelope | null {
  if (!isBrowserStorageAvailable()) {
    return null;
  }

  const candidate = window.localStorage.getItem(WORKBENCH_STATE_STORAGE_KEY);

  if (!candidate) {
    return null;
  }

  const parsed = JSON.parse(candidate) as PersistedWorkbenchStateEnvelope;

  if (parsed?.version !== 1 || !parsed.state) {
    throw new Error("Unsupported persisted workbench state version.");
  }

  return parsed;
}

function persistLegacyBrowserEnvelope(payload: PersistedWorkbenchStateEnvelope) {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  window.localStorage.setItem(WORKBENCH_STATE_STORAGE_KEY, JSON.stringify(payload));
}

function clearLegacyBrowserEnvelope() {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  window.localStorage.removeItem(WORKBENCH_STATE_STORAGE_KEY);
}

type LegacyHistoryState = WorkbenchState["history"] & {
  recentConversations?: WorkbenchState["history"]["draftConversations"];
};

function revivePersistedTasks(tasks: WorkbenchState["tasks"]): WorkbenchState["tasks"] {
  const revivedItems = tasks.items.map((item) => revivePersistedTask(item));
  const activeTask = tasks.activeTaskId
    ? revivedItems.find((item) => item.id === tasks.activeTaskId)
    : null;

  return {
    pendingCount: revivedItems.filter((item) => item.status === "queued").length,
    activeTaskId: activeTask?.status === "running" ? activeTask.id : null,
    items: revivedItems
  };
}

function revivePersistedTask(task: LocalTaskItem): LocalTaskItem {
  if (task.status !== "running") {
    return task;
  }

  return {
    ...task,
    status: "cancelled",
    progressSummary: undefined,
    streamingSummary: undefined,
    executionMessage: task.executionMessage,
    continuationMessage: task.continuationMessage,
    lastFailureSource: "restored_interrupted_task",
    lastFailureSummary: "App restarted while this task was still running.",
    lastFailureDetail:
      "The previous desktop session ended before the running task completed, so opencow restored the history and marked the task as cancelled.",
    lastFailureActionLabel:
      "Review the preserved conversation context and retry manually if you still want this task to run."
  };
}

function inferLegacyConversationMode(
  state: WorkbenchState,
  revivedConversationEntries: WorkbenchState["conversation"]["entries"]
): ConversationMode {
  const persistedMode = state.conversation.mode;

  if (persistedMode === "blank" || persistedMode === "history" || persistedMode === "restored") {
    return persistedMode;
  }

  if (state.audit?.lastEvent?.source === "conversation_new") {
    return "blank";
  }

  if (state.audit?.lastEvent?.source === "conversation_recent_restored") {
    return "restored";
  }

  if (revivedConversationEntries.length > 0) {
    return "history";
  }

  return "blank";
}

function revivePersistedState(state: WorkbenchState): WorkbenchState {
  const revivedHistoryEntries =
    state.history?.lastNonEmptyConversationEntries
    ?? (state.conversation.entries.length > 0 ? state.conversation.entries : []);
  const revivedDraftConversations =
    deduplicateRecentConversations(
      state.history?.draftConversations
      ?? (state.history as LegacyHistoryState | undefined)?.recentConversations
      ?? []
    );
  const revivedArchivedConversations = state.history?.archivedConversations ?? [];
  const revivedKnowledge = state.knowledge ?? {
    importedFiles: [],
    availableFiles: [],
    activeLibraryId: "default-library",
    activeLibraryLabel: "默认知识库",
    libraries: [
      {
        id: "default-library",
        label: "默认知识库"
      }
    ]
  };
  const revivedNpcWorkspace = state.npcWorkspace ?? {
    items: [],
    selectedNpcId: null,
    activeSection: "overview",
    selectedSkillName: null,
    selectedSkillPreview: null,
    selectedKnowledgeLibraryId: null,
    saveStatus: null
  };
  const revivedComposer = state.composer ?? {
    draftAttachments: []
  };
  const revivedConversationEntries =
    state.conversation.entries.length > 0 || state.conversation.mode === "blank"
      ? state.conversation.entries
      : revivedHistoryEntries;
  const revivedConversationMode = inferLegacyConversationMode(state, revivedConversationEntries);
  const revivedRestoredFromConversationId = revivedConversationMode === "restored"
    ? (state.conversation.restoredFromConversationId ?? null)
    : null;

  return {
    ...state,
    conversation: {
      entries: revivedConversationEntries,
      mode: revivedConversationMode,
      restoredFromConversationId: revivedRestoredFromConversationId
    },
    composer: revivedComposer,
    history: {
      lastNonEmptyConversationEntries: revivedHistoryEntries,
      draftConversations: revivedDraftConversations,
      archivedConversations: revivedArchivedConversations
    },
    knowledge: revivedKnowledge,
    npcWorkspace: revivedNpcWorkspace,
    tasks: revivePersistedTasks(state.tasks),
    confirmation: {
      pending: null
    },
    permission: {
      ...state.permission,
      pendingModeChange: null
    },
    search: {
      enabled: state.search?.enabled ?? false,
      defaultProviderEnabled: state.search?.defaultProviderEnabled ?? true,
      providerLabel:
        state.search?.providerLabel
        ?? state.search?.effectiveProvider
        ?? state.search?.customProviderLabel
        ?? "OpenCow 默认搜索",
      customProviderLabel: state.search?.customProviderLabel ?? "",
      customBaseUrl: state.search?.customBaseUrl ?? "",
      customApiKey: state.search?.customApiKey ?? "",
      effectiveProvider:
        state.search?.effectiveProvider
        ?? state.search?.providerLabel
        ?? state.search?.customProviderLabel
        ?? "OpenCow 默认搜索",
      lastFallbackReason: state.search?.lastFallbackReason ?? null,
      suppressFallbackNotice: state.search?.suppressFallbackNotice ?? false
    },
    settings: {
      remoteApi: {
        collapsed: state.settings?.remoteApi?.collapsed ?? true,
        enabled: state.settings?.remoteApi?.enabled ?? false,
        baseUrl: state.settings?.remoteApi?.baseUrl ?? "",
        providerLabel: state.settings?.remoteApi?.providerLabel ?? "",
        apiKey: state.settings?.remoteApi?.apiKey ?? ""
      },
      npc: {
        localModel: state.settings?.npc?.localModel ?? ""
      }
    },
    rollback: {
      ...state.rollback,
      pendingPreview: null
    }
  };
}

export async function loadPersistedWorkbenchState(): Promise<WorkbenchState> {
  const persisted = await readPersistedWorkbenchState();
  return persisted ?? createInitialWorkbenchState();
}

export async function readPersistedWorkbenchState(): Promise<WorkbenchState | null> {
  try {
    if (isTauriDesktopAvailable()) {
      const nativeResult = await invoke<NativeWorkbenchStateReadResult>("workbench_state_load");

      if (nativeResult.found && nativeResult.payload) {
        clearLegacyBrowserEnvelope();
        return revivePersistedState(nativeResult.payload.state);
      }

      const legacyPayload = loadLegacyBrowserEnvelope();

      if (legacyPayload) {
        await invoke("workbench_state_save", { payload: legacyPayload });
        clearLegacyBrowserEnvelope();
        return revivePersistedState(legacyPayload.state);
      }

      return null;
    }

    const legacyPayload = loadLegacyBrowserEnvelope();
    return legacyPayload ? revivePersistedState(legacyPayload.state) : null;
  } catch {
    try {
      const legacyPayload = loadLegacyBrowserEnvelope();
      return legacyPayload ? revivePersistedState(legacyPayload.state) : null;
    } catch {
      clearLegacyBrowserEnvelope();
      return null;
    }
  }
}

export function loadPersistedWorkbenchStateFromBrowserStorage(
  createInitialState: () => WorkbenchState = createInitialWorkbenchState
): WorkbenchState {
  try {
    const legacyPayload = loadLegacyBrowserEnvelope();
    return legacyPayload ? revivePersistedState(legacyPayload.state) : createInitialState();
  } catch {
    clearLegacyBrowserEnvelope();
    return createInitialState();
  }
}

export async function persistWorkbenchState(state: WorkbenchState) {
  const normalizedState: WorkbenchState = {
    ...state,
    conversation: {
      ...state.conversation,
      mode: state.conversation.mode ?? (state.conversation.entries.length > 0 ? "history" : "blank"),
      restoredFromConversationId: state.conversation.mode === "restored"
        ? (state.conversation.restoredFromConversationId ?? null)
        : null
    },
    history: {
      lastNonEmptyConversationEntries: state.conversation.entries.length > 0
        ? state.conversation.entries
        : state.history.lastNonEmptyConversationEntries,
      draftConversations: state.history.draftConversations,
      archivedConversations: state.history.archivedConversations
    }
  };
  const normalizedPayload = createPersistedEnvelope(normalizedState);

  if (isTauriDesktopAvailable()) {
    await invoke("workbench_state_save", { payload: normalizedPayload });
    clearLegacyBrowserEnvelope();
    return;
  }

  persistLegacyBrowserEnvelope(normalizedPayload);
}

export async function clearPersistedWorkbenchState() {
  if (isTauriDesktopAvailable()) {
    await invoke("workbench_state_clear");
  }

  clearLegacyBrowserEnvelope();
}
