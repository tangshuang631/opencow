import { appendRollbackEntry, applyRollback, createRollbackJournal, previewRollback } from "@opencow/rollback-core";
import type { RollbackEntry, RollbackJournal } from "@opencow/rollback-core";
import type { OllamaOverview } from "../ollama/ollamaService";

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
  "model" | "permission" | "confirmation" | "search" | "settings" | "audit" | "error"
>;

export function createInitialWorkbenchState(): WorkbenchState {
  const state: WorkbenchState = {
    model: {
      label: "Ollama 本地优先",
      status: "等待 Ollama",
      remoteApiEnabled: false,
      endpoint: "http://127.0.0.1:11434",
      activeModel: "未选择模型",
      diagnostic: "正在读取本地 Ollama 状态。",
      availableModels: []
    },
    permission: {
      mode: "readonly",
      label: "只读",
      summary: "仅允许读取已授权目录与附件。",
      requiresConfirmation: true,
      confirmationTitle: "权限确认",
      confirmationSummary: "删除、覆盖、递归删除、进程结束前必须弹窗确认。",
      pendingModeChange: null
    },
    confirmation: {
      pending: null
    },
    rollback: {
      ...createRollbackJournal({
        baselineEntry: createRollbackEntry(
          "startup-baseline",
          "启动基线",
          "应用启动后的本地安全初始状态。",
          "session"
        )
      }),
      snapshots: {},
      pendingPreview: null
    },
    search: {
      enabled: false
    },
    settings: {
      remoteApi: {
        collapsed: true,
        enabled: false,
        baseUrl: "",
        providerLabel: ""
      }
    },
    audit: {
      summary: "等待本地事件",
      lastEvent: {
        module: "startup",
        detail: "应用已启动，等待读取本地模型状态。",
        timestamp: "未记录",
        source: "desktop-bootstrap"
      }
    },
    error: null
  };

  return attachRollbackSnapshot(state, "startup-baseline");
}

export function mergeOllamaOverview(state: WorkbenchState, overview: OllamaOverview): WorkbenchState {
  if (!overview.reachable) {
    return recordRollbackEntry(
      {
        ...state,
        model: {
          ...state.model,
          status: "等待 Ollama",
          endpoint: overview.endpoint,
          activeModel: overview.selectedModel || "未选择模型",
          diagnostic: overview.diagnostic,
          availableModels: overview.models
        },
        audit: {
          summary: "Ollama 离线，等待本地服务恢复",
          lastEvent: {
            module: "ollama",
            detail: overview.diagnostic,
            timestamp: "本地最近一次检查",
            source: "ollama_overview"
          }
        },
        error: {
          module: "ollama",
          summary: "无法连接本地 Ollama",
          detail: overview.diagnostic,
          actionLabel: "检查 Ollama 服务",
          timestamp: "本地最近一次检查",
          source: "ollama_overview"
        }
      },
      "ollama-check-offline",
      "Ollama 检查",
      "本地模型服务离线，保留最近一次可回退检查点。",
      "session"
    );
  }

  return recordRollbackEntry(
    {
      ...state,
      model: {
        ...state.model,
        status: "Ollama 已连接",
        endpoint: overview.endpoint,
        activeModel: overview.selectedModel || "未选择模型",
        diagnostic: overview.diagnostic,
        availableModels: overview.models
      },
      audit: {
        summary: `已读取 ${overview.models.length} 个本地模型`,
        lastEvent: {
          module: "ollama",
          detail: `${overview.endpoint} 已返回模型列表。`,
          timestamp: "本地最近一次检查",
          source: "ollama_overview"
        }
      },
      error: null
    },
    "ollama-check-ready",
    "Ollama 检查",
    `已完成 ${overview.models.length} 个本地模型的读取检查。`,
    "session"
  );
}

export function createOllamaLoadErrorState(state: WorkbenchState, detail: string): WorkbenchState {
  return recordRollbackEntry(
    {
      ...state,
      model: {
        ...state.model,
        status: "等待 Ollama",
        diagnostic: detail
      },
      audit: {
        summary: "Ollama 状态读取失败，工作台保持可用",
        lastEvent: {
          module: "ollama",
          detail,
          timestamp: "本地最近一次检查",
          source: "ollama_overview"
        }
      },
      error: {
        module: "ollama",
        summary: "无法连接本地 Ollama",
        detail,
        actionLabel: "检查 Ollama 服务",
        timestamp: "本地最近一次检查",
        source: "ollama_overview"
      }
    },
    "ollama-load-error",
    "异常保护",
    "Ollama 状态读取异常，工作台保留在最近一次安全状态。",
    "session"
  );
}

export function createCommandPolicyBlockedState(
  state: WorkbenchState,
  payload: {
    summary: string;
    detail: string;
    actionLabel: string;
    source: string;
  }
): WorkbenchState {
  return {
    ...state,
    audit: {
      summary: payload.summary,
      lastEvent: {
        module: "permission",
        detail: payload.detail,
        timestamp: "策略拦截",
        source: payload.source
      }
    },
    error: {
      module: "permission",
      summary: payload.summary,
      detail: payload.detail,
      actionLabel: payload.actionLabel,
      timestamp: "策略拦截",
      source: payload.source
    }
  };
}

export function createHighRiskConfirmationState(
  state: WorkbenchState,
  pending: PendingConfirmation
): WorkbenchState {
  return {
    ...state,
    confirmation: {
      pending
    },
    audit: {
      summary: "等待用户确认高风险操作",
      lastEvent: {
        module: "permission",
        detail: pending.summary,
        timestamp: "待用户确认",
        source: "permission_confirmation"
      }
    }
  };
}

export function approvePendingConfirmationState(state: WorkbenchState): WorkbenchState {
  const pending = state.confirmation.pending;

  if (!pending) {
    return state;
  }

  return recordRollbackEntry(
    {
      ...state,
      confirmation: {
        pending: null
      },
      audit: {
        summary: "用户已批准高风险操作",
        lastEvent: {
          module: "permission",
          detail: pending.summary,
          timestamp: "已批准",
          source: "permission_confirmation_approved"
        }
      }
    },
    "confirmation-approved",
    "已批准操作",
    `${pending.title} 已获批准，后续执行仍需记录日志与快照。`,
    "tool"
  );
}

export function cancelPendingConfirmationState(state: WorkbenchState): WorkbenchState {
  const pending = state.confirmation.pending;

  if (!pending) {
    return state;
  }

  return recordRollbackEntry(
    {
      ...state,
      confirmation: {
        pending: null
      },
      audit: {
        summary: "用户已取消高风险操作",
        lastEvent: {
          module: "permission",
          detail: pending.summary,
          timestamp: "已取消",
          source: "permission_confirmation_cancelled"
        }
      }
    },
    "confirmation-cancelled",
    "已取消操作",
    `${pending.title} 已取消，工作台保持最近一次安全状态。`,
    "tool"
  );
}

export function requestPermissionModeChangeState(
  state: WorkbenchState,
  pendingModeChange: PendingPermissionModeChange
): WorkbenchState {
  return {
    ...state,
    permission: {
      ...state.permission,
      pendingModeChange
    },
    audit: {
      summary: "等待用户确认权限升级",
      lastEvent: {
        module: "permission",
        detail: pendingModeChange.reason,
        timestamp: "待用户确认",
        source: "permission_mode_change"
      }
    }
  };
}

export function approvePermissionModeChangeState(state: WorkbenchState): WorkbenchState {
  const pendingModeChange = state.permission.pendingModeChange;

  if (!pendingModeChange) {
    return state;
  }

  return recordRollbackEntry(
    {
      ...state,
      permission: {
        ...state.permission,
        ...getPermissionPresentation(pendingModeChange.targetMode),
        pendingModeChange: null
      },
      audit: {
        summary: "用户已批准权限升级",
        lastEvent: {
          module: "permission",
          detail: pendingModeChange.reason,
          timestamp: "已批准",
          source: "permission_mode_change_approved"
        }
      }
    },
    "permission-mode-approved",
    "已批准权限升级",
    `${pendingModeChange.targetMode} 权限已获批准，后续操作仍受安全链路保护。`,
    "permission"
  );
}

export function cancelPermissionModeChangeState(state: WorkbenchState): WorkbenchState {
  const pendingModeChange = state.permission.pendingModeChange;

  if (!pendingModeChange) {
    return state;
  }

  return recordRollbackEntry(
    {
      ...state,
      permission: {
        ...state.permission,
        pendingModeChange: null
      },
      audit: {
        summary: "用户已取消权限升级",
        lastEvent: {
          module: "permission",
          detail: pendingModeChange.reason,
          timestamp: "已取消",
          source: "permission_mode_change_cancelled"
        }
      }
    },
    "permission-mode-cancelled",
    "已取消权限升级",
    "权限保持当前模式，未执行额外提权。",
    "permission"
  );
}

export function requestRollbackPreviewState(state: WorkbenchState, targetEntryId: string): WorkbenchState {
  const preview = previewRollback(state.rollback, targetEntryId);
  const targetEntry = state.rollback.entries.find((entry) => entry.id === targetEntryId);

  if (!targetEntry) {
    return state;
  }

  return {
    ...state,
    rollback: {
      ...state.rollback,
      pendingPreview: {
        targetEntryId,
        targetLabel: targetEntry.label,
        targetSummary: targetEntry.summary,
        willRevertCount: preview.willRevertCount,
        affectedEntries: preview.affectedEntries.map((entry) => ({
          id: entry.id,
          label: entry.label,
          summary: entry.summary
        }))
      }
    },
    audit: {
      summary: "等待用户确认回退",
      lastEvent: {
        module: "rollback",
        detail: `准备回退到 ${targetEntry.label}，将撤销 ${preview.willRevertCount} 个后续状态。`,
        timestamp: "待用户确认",
        source: "rollback_preview"
      }
    }
  };
}

export function applyPendingRollbackState(state: WorkbenchState): WorkbenchState {
  const pendingPreview = state.rollback.pendingPreview;

  if (!pendingPreview) {
    return state;
  }

  const snapshot = state.rollback.snapshots[pendingPreview.targetEntryId];

  if (!snapshot) {
    return state;
  }

  const restoredJournal = applyRollback(state.rollback, pendingPreview.targetEntryId);

  return {
    ...state,
    ...snapshot,
    rollback: {
      ...restoredJournal,
      snapshots: pruneRollbackSnapshots(state.rollback.snapshots, restoredJournal.entries),
      pendingPreview: null
    },
    audit: {
      summary: `已回退到 ${pendingPreview.targetLabel}`,
      lastEvent: {
        module: "rollback",
        detail: `已回退到 ${pendingPreview.targetLabel}，共撤销 ${pendingPreview.willRevertCount} 个后续状态。`,
        timestamp: "已回退",
        source: "rollback_applied"
      }
    }
  };
}

export function cancelPendingRollbackState(state: WorkbenchState): WorkbenchState {
  const pendingPreview = state.rollback.pendingPreview;

  if (!pendingPreview) {
    return state;
  }

  return {
    ...state,
    rollback: {
      ...state.rollback,
      pendingPreview: null
    },
    audit: {
      summary: "已取消回退",
      lastEvent: {
        module: "rollback",
        detail: `已取消回退到 ${pendingPreview.targetLabel}。`,
        timestamp: "已取消",
        source: "rollback_cancelled"
      }
    }
  };
}

function getPermissionPresentation(mode: PermissionMode) {
  if (mode === "workspace-write") {
    return {
      mode,
      label: "工作区读写",
      summary: "允许在授权工作区内创建和修改文件。"
    };
  }

  if (mode === "controlled-full") {
    return {
      mode,
      label: "受控完全访问",
      summary: "允许受控高风险操作，但必须保留确认、日志、超时和回退。"
    };
  }

  return {
    mode: "readonly" as const,
    label: "只读",
    summary: "仅允许读取已授权目录与附件。"
  };
}

function recordRollbackEntry(
  state: WorkbenchState,
  id: string,
  label: string,
  summary: string,
  scope: RollbackEntry["scope"]
): WorkbenchState {
  const entry = createRollbackEntry(id, label, summary, scope);
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

function createRollbackEntry(
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

function attachRollbackSnapshot(state: WorkbenchState, entryId: string): WorkbenchState {
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

function captureRollbackSnapshot(state: WorkbenchState): RollbackSnapshot {
  return {
    model: state.model,
    permission: state.permission,
    confirmation: state.confirmation,
    search: state.search,
    settings: state.settings,
    audit: state.audit,
    error: state.error
  };
}

function pruneRollbackSnapshots(
  snapshots: Record<string, RollbackSnapshot>,
  entries: RollbackEntry[]
): Record<string, RollbackSnapshot> {
  const allowedIds = new Set(entries.map((entry) => entry.id));

  return Object.fromEntries(
    Object.entries(snapshots).filter(([entryId]) => allowedIds.has(entryId))
  );
}
