import type { RollbackEntry, RollbackJournal } from "@opencow/rollback-core";

export type PermissionMode = "readonly" | "workspace-write" | "controlled-full";

export type PendingConfirmation = {
  title: string;
  summary: string;
  commandPreview: string;
  impact: string;
  requiredMode: PermissionMode;
  safetySummary?: string;
  requestedFeature?: "search" | "remote-api";
  requestedEnabled?: boolean;
  providerLabel?: string;
  queuedExecutionKind?: LocalTaskExecutionKind;
  queuedExecutionTitle?: string;
  queuedExecutionAuditSummary?: string;
  queuedExecutionAuditDetail?: string;
  queuedMessage?: string;
};

export type PendingPermissionModeChange = {
  targetMode: PermissionMode;
  reason: string;
  riskSummary: string;
  queuedExecutionKind?: LocalTaskExecutionKind;
  queuedExecutionTitle?: string;
  queuedExecutionAuditSummary?: string;
  queuedExecutionAuditDetail?: string;
  queuedMessage?: string;
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

export type LocalTaskExecutionKind =
  | "assistant-help-overview"
  | "workspace-overview"
  | "packages-overview"
  | "workspace-config-overview"
  | "opencow-self-repair-preview"
  | "opencow-self-repair-enabled-skills-registry"
  | "capability-rag-overview"
  | "capability-skills-overview"
  | "skills-local-scan"
  | "skills-local-inspect"
  | "skills-local-install"
  | "skills-local-enable"
  | "skills-local-disable"
  | "skills-local-enabled-list"
  | "skills-local-enabled-match"
  | "skills-local-enabled-shell-create-temp-output"
  | "skills-local-enabled-shell-remove-temp-output"
  | "npc-local-enabled-shell-create-temp-output"
  | "npc-local-enabled-shell-remove-temp-output"
  | "npc-local-enabled-rag-shell-create-temp-output"
  | "npc-local-enabled-rag-shell-remove-temp-output"
  | "skills-local-enabled-rag-doc-search"
  | "rag-local-shell-handoff-preview"
  | "skills-local-enabled-rag-shell-handoff-preview"
  | "npc-local-enabled-rag-shell-handoff-preview"
  | "rag-local-shell-create-temp-output"
  | "rag-local-shell-remove-temp-output"
  | "skills-local-enabled-rag-shell-create-temp-output"
  | "skills-local-enabled-rag-shell-remove-temp-output"
  | "npc-local-collaboration-preview"
  | "npc-local-project-showcase-preview"
  | "npc-local-project-run"
  | "npc-local-shell-plan-preview"
  | "capability-npc-overview"
  | "capability-mcp-overview"
  | "mcp-local-plugin-scan"
  | "mcp-local-plugin-inspect"
  | "mcp-local-plugin-start-preview"
  | "mcp-local-plugin-start"
  | "rag-local-doc-search"
  | "readonly-shell-git-status"
  | "readonly-shell-workspace-root"
  | "readonly-shell-packages-dir"
  | "workspace-write-create-temp-output"
  | "workspace-project-run"
  | "workspace-project-status"
  | "workspace-project-stop"
  | "controlled-full-remove-temp-output";

export type LocalTaskItem = {
  id: string;
  source: "composer";
  status: "queued" | "running" | "completed" | "failed";
  summary: string;
  attemptCount: number;
  executionKind?: LocalTaskExecutionKind;
  executionTitle?: string;
  executionAuditSummary?: string;
  executionAuditDetail?: string;
  continuationMessage?: string;
};

export type StorageCleanupTarget = "conversation" | "logs" | "cache" | "snapshots" | "knowledge";

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
      apiKey: string;
    };
  };
  storage: {
    sessionCount: number;
    logCount: number;
    cacheCount: number;
    snapshotCount: number;
    knowledgeCount: number;
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
  | "storage"
  | "audit"
  | "error"
>;
