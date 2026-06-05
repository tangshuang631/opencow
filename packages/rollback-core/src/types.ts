export type RollbackScope = "session" | "tool" | "filesystem" | "permission";

export type RollbackEntry = {
  id: string;
  label: string;
  summary: string;
  createdAt: string;
  scope: RollbackScope;
};

export type RollbackJournal = {
  defaultLimit: number;
  activeLimit: number;
  maxLimit: number;
  entries: RollbackEntry[];
  lastRollback: {
    targetEntryId: string;
    revertedEntryIds: string[];
  } | null;
};

export type CreateRollbackJournalOptions = {
  defaultLimit?: number;
  activeLimit?: number;
  maxLimit?: number;
  baselineEntry?: RollbackEntry;
};

export type RollbackPreview = {
  targetEntryId: string;
  affectedEntries: RollbackEntry[];
  willRevertCount: number;
};
