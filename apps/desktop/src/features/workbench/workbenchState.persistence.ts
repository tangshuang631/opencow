import { createInitialWorkbenchState } from "./workbenchState.initial";
import type { LocalTaskItem, WorkbenchState } from "./workbenchState.types";

const WORKBENCH_STATE_STORAGE_KEY = "opencow.desktop.workbench-state.v1";

type PersistedWorkbenchStateEnvelope = {
  version: 1;
  state: WorkbenchState;
};

function isBrowserStorageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
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
    lastFailureDetail: "The previous desktop session ended before the running task completed, so opencow restored the history and marked the task as cancelled.",
    lastFailureActionLabel: "Review the preserved conversation context and retry manually if you still want this task to run."
  };
}

function revivePersistedState(state: WorkbenchState): WorkbenchState {
  return {
    ...state,
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

export function loadPersistedWorkbenchState(): WorkbenchState {
  if (!isBrowserStorageAvailable()) {
    return createInitialWorkbenchState();
  }

  const candidate = window.localStorage.getItem(WORKBENCH_STATE_STORAGE_KEY);

  if (!candidate) {
    return createInitialWorkbenchState();
  }

  try {
    const parsed = JSON.parse(candidate) as PersistedWorkbenchStateEnvelope;

    if (parsed?.version !== 1 || !parsed.state) {
      throw new Error("Unsupported persisted workbench state version.");
    }

    return revivePersistedState(parsed.state);
  } catch {
    window.localStorage.removeItem(WORKBENCH_STATE_STORAGE_KEY);
    return createInitialWorkbenchState();
  }
}

export function persistWorkbenchState(state: WorkbenchState) {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  const payload: PersistedWorkbenchStateEnvelope = {
    version: 1,
    state
  };

  window.localStorage.setItem(WORKBENCH_STATE_STORAGE_KEY, JSON.stringify(payload));
}

export function clearPersistedWorkbenchState() {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  window.localStorage.removeItem(WORKBENCH_STATE_STORAGE_KEY);
}

