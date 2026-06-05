import {
  appendRollbackEntry,
  applyRollback,
  createRollbackJournal,
  previewRollback
} from "@opencow/rollback-core";
import type { RollbackEntry } from "@opencow/rollback-core";
import type { RollbackSnapshot, WorkbenchState } from "./workbenchState.types";

export { applyRollback, createRollbackJournal, previewRollback };

export function createWorkbenchRollbackEntry(
  id: string,
  label: string,
  summary: string,
  scope: RollbackEntry["scope"]
): RollbackEntry {
  return {
    id,
    label,
    summary,
    scope,
    createdAt: "本地最近一次记录"
  };
}

export function recordRollbackEntry(
  state: WorkbenchState,
  id: string,
  label: string,
  summary: string,
  scope: RollbackEntry["scope"]
): WorkbenchState {
  const entry = createWorkbenchRollbackEntry(id, label, summary, scope);
  const journal = appendRollbackEntry(state.rollback, entry);
  const nextState: WorkbenchState = {
    ...state,
    rollback: {
      ...journal,
      snapshots: state.rollback.snapshots,
      pendingPreview: null
    }
  };

  return attachRollbackSnapshot(nextState, entry.id);
}

export function attachRollbackSnapshot(state: WorkbenchState, entryId: string): WorkbenchState {
  return {
    ...state,
    rollback: {
      ...state.rollback,
      snapshots: pruneRollbackSnapshots(
        {
          ...state.rollback.snapshots,
          [entryId]: captureRollbackSnapshot(state)
        },
        state.rollback.entries
      )
    }
  };
}

export function captureRollbackSnapshot(state: WorkbenchState): RollbackSnapshot {
  return {
    model: state.model,
    permission: state.permission,
    confirmation: state.confirmation,
    search: state.search,
    sources: state.sources,
    tools: state.tools,
    tasks: state.tasks,
    output: state.output,
    settings: state.settings,
    storage: state.storage,
    audit: state.audit,
    error: state.error
  };
}

export function pruneRollbackSnapshots(
  snapshots: Record<string, RollbackSnapshot>,
  entries: RollbackEntry[]
): Record<string, RollbackSnapshot> {
  const allowedIds = new Set(entries.map((entry) => entry.id));

  return Object.fromEntries(Object.entries(snapshots).filter(([entryId]) => allowedIds.has(entryId)));
}
