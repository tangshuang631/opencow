import type { RollbackEntry, RollbackJournal } from "@opencow/rollback-core";

export type PermissionMode = "readonly" | "workspace-write" | "controlled-full";

export type PendingConfirmation = {
  title: string;
  summary: string;
  commandPreview: string;
  impact: string;
  requiredMode: PermissionMode;
  safetySummary?: string;
};

export type PendingPermissionModeChange = {
  targetMode: PermissionMode;
  reason: string;
  riskSummary: string;
};

export type RollbackPreviewState = {
  targetEntryId: string;
  targetLabel: string;
  targetSummary: string;
  willRevertCount: number;
  affectedEntries: Array<{
    id: string;
    label: string;
    summary: string;
  }>;
};

export type ConversationEntry = {
  id: string;
  kind: "assistant" | "system" | "user";
  title: string;
  summary: string;
  detailLines?: string[];
  actionLabel?: string;
  rollbackTargetId?: string;
};

export type SearchSourceItem = {
  title: string;
  url: string;
  provider: string;
  query: string;
  summary: string;
};

export type ToolExecutionResult = {
  toolLabel: string;
  summary: string;
  source: string;
};

export type LocalTaskItem = {
  id: string;
  source: "composer";
  status: "queued" | "running" | "completed" | "failed";
  summary: string;
};

export type WorkbenchState = {
  model: {
    label: string;
    status: string;
    remoteApiEnabled: boolean;
    endpoint: string;
    activeModel: string;
    diagnostic: string;
    availableModels: Array<{
      name: string;
      sizeLabel: string;
    }>;
  };
  permission: {
    mode: PermissionMode;
    label: string;
    summary: string;
    requiresConfirmation: boolean;
    confirmationTitle: string;
    confirmationSummary: string;
    pendingModeChange: PendingPermissionModeChange | null;
  };
  confirmation: {
    pending: PendingConfirmation | null;
  };
  conversation: {
    entries: ConversationEntry[];
  };
  rollback: {
    defaultLimit: number;
    activeLimit: number;
    maxLimit: number;
    entries: RollbackEntry[];
    lastRollback: RollbackJournal["lastRollback"];
    snapshots: Record<string, RollbackSnapshot>;
    pendingPreview: RollbackPreviewState | null;
  };
  search: {
    enabled: boolean;
    providerLabel: string;
  };
  sources: {
    items: SearchSourceItem[];
  };
  tools: {
    lastResult: ToolExecutionResult | null;
  };
  tasks: {
    pendingCount: number;
    activeTaskId: string | null;
    items: LocalTaskItem[];
  };
  output: {
    title: string;
    summary: string;
  };
  settings: {
    remoteApi: {
      collapsed: boolean;
      enabled: boolean;
      baseUrl: string;
      providerLabel: string;
    };
  };
  audit: {
    summary: string;
    lastEvent: {
      module: string;
      detail: string;
      timestamp: string;
      source: string;
    };
  };
  error: {
    module: string;
    summary: string;
    detail: string;
    actionLabel: string;
    timestamp: string;
    source: string;
  } | null;
};

export type RollbackSnapshot = Pick<
  WorkbenchState,
  | "model"
  | "permission"
  | "confirmation"
  | "search"
  | "sources"
  | "tools"
  | "tasks"
  | "output"
  | "settings"
  | "audit"
  | "error"
>;
