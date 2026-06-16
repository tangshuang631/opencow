import { invoke } from "@tauri-apps/api/core";
import { createInitialWorkbenchState } from "./workbenchState.initial";
import type { LocalTaskItem, WorkbenchState } from "./workbenchState.types";

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

function revivePersistedState(state: WorkbenchState): WorkbenchState {
  const revivedHistoryEntries =
    state.history?.lastNonEmptyConversationEntries
    ?? (state.conversation.entries.length > 0 ? state.conversation.entries : []);
  const revivedRecentConversations = state.history?.recentConversations ?? [];
  const revivedConversationEntries =
    state.conversation.entries.length > 0
      ? state.conversation.entries
      : revivedHistoryEntries;

  return {
    ...state,
    conversation: {
      entries: revivedConversationEntries
    },
    history: {
      lastNonEmptyConversationEntries: revivedHistoryEntries,
      recentConversations: revivedRecentConversations
    },
    tasks: revivePersistedTasks(state.tasks),
    confirmation: {
      pending: null
    },
    permission: {
      ...state.permission,
      pendingModeChange: null
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
    clearLegacyBrowserEnvelope();
    return null;
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
    history: {
      lastNonEmptyConversationEntries: state.conversation.entries.length > 0
        ? state.conversation.entries
        : state.history.lastNonEmptyConversationEntries,
      recentConversations: state.history.recentConversations
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
