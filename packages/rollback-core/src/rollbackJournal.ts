import type {
  CreateRollbackJournalOptions,
  RollbackEntry,
  RollbackJournal,
  RollbackPreview
} from "./types.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const MIN_LIMIT = 1;

export function createRollbackJournal(options: CreateRollbackJournalOptions = {}): RollbackJournal {
  const maxLimit = clampLimit(options.maxLimit ?? MAX_LIMIT, MAX_LIMIT);
  const defaultLimit = clampLimit(options.defaultLimit ?? DEFAULT_LIMIT, maxLimit);
  const activeLimit = clampLimit(options.activeLimit ?? defaultLimit, maxLimit);

  return {
    defaultLimit,
    activeLimit,
    maxLimit,
    entries: options.baselineEntry ? [options.baselineEntry] : [],
    lastRollback: null
  };
}

export function appendRollbackEntry(journal: RollbackJournal, entry: RollbackEntry): RollbackJournal {
  const nextEntries = [entry, ...journal.entries].slice(0, journal.activeLimit);

  return {
    ...journal,
    entries: nextEntries
  };
}

export function previewRollback(journal: RollbackJournal, targetEntryId: string): RollbackPreview {
  const targetIndex = journal.entries.findIndex((entry) => entry.id === targetEntryId);

  if (targetIndex < 0) {
    throw new Error(`Unknown rollback entry: ${targetEntryId}`);
  }

  const affectedEntries = journal.entries.slice(0, targetIndex);

  return {
    targetEntryId,
    affectedEntries,
    willRevertCount: affectedEntries.length
  };
}

export function applyRollback(journal: RollbackJournal, targetEntryId: string): RollbackJournal {
  const preview = previewRollback(journal, targetEntryId);
  const targetIndex = journal.entries.findIndex((entry) => entry.id === targetEntryId);

  return {
    ...journal,
    entries: journal.entries.slice(targetIndex),
    lastRollback: {
      targetEntryId,
      revertedEntryIds: preview.affectedEntries.map((entry) => entry.id)
    }
  };
}

function clampLimit(value: number, max: number): number {
  if (!Number.isFinite(value)) {
    return Math.min(DEFAULT_LIMIT, max);
  }

  return Math.max(MIN_LIMIT, Math.min(Math.floor(value), max));
}
