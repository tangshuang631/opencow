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
    conversation: {
      entries: [
        {
          id: "assistant-welcome",
          kind: "assistant",
          title: "Ollama 本地优先",
          summary: "默认使用本地 Ollama，并优先展示可追溯、可回退、可确认的桌面工作流。"
        }
      ]
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
      enabled: false,
      providerLabel: ""
    },
    sources: {
      items: []
    },
    tools: {
      lastResult: null
    },
    tasks: {
      pendingCount: 0,
      activeTaskId: null,
      items: []
    },
    output: {
      title: "暂无产物",
      summary: "等待工具执行结果或本地产物摘要。"
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
        conversation: {
          entries: prependConversationEntry(state.conversation.entries, {
            id: "ollama-offline",
            kind: "system",
            title: "Ollama 检查失败",
            summary: overview.diagnostic,
            actionLabel: "预览回退到 启动基线",
            rollbackTargetId: "startup-baseline"
          })
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
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: "ollama-ready",
          kind: "system",
          title: "本地模型读取完成",
          summary: `已读取 ${overview.models.length} 个本地模型，当前模型 ${overview.selectedModel || "未选择模型"}。`,
          actionLabel: "预览回退到 启动基线",
          rollbackTargetId: "startup-baseline"
        })
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
      conversation: {
      entries: prependConversationEntry(state.conversation.entries, {
        id: "ollama-load-error",
        kind: "system",
        title: "Ollama 状态读取异常",
        summary: detail,
        detailLines: ["模块: ollama", "来源: ollama_overview", "建议: 检查 Ollama 服务"],
        actionLabel: "预览回退到 启动基线",
        rollbackTargetId: "startup-baseline"
      })
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
    conversation: {
      entries: prependConversationEntry(state.conversation.entries, {
        id: `blocked-${payload.source}`,
        kind: "system",
        title: payload.summary,
        summary: payload.detail,
        detailLines: [
          "模块: permission",
          `来源: ${payload.source}`,
          `建议: ${payload.actionLabel}`
        ]
      })
    },
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
    conversation: {
      entries: prependConversationEntry(state.conversation.entries, {
        id: "dangerous-confirmation",
        kind: "system",
        title: "等待高风险操作确认",
        summary: pending.summary,
        actionLabel: "预览回退到 启动基线",
        rollbackTargetId: "startup-baseline"
      })
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
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: "confirmation-approved",
          kind: "system",
          title: "已批准高风险操作",
          summary: pending.summary,
          actionLabel: "预览回退到 confirmation-approved",
          rollbackTargetId: "confirmation-approved"
        })
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
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: "confirmation-cancelled",
          kind: "system",
          title: "已取消高风险操作",
          summary: pending.summary,
          actionLabel: "预览回退到 confirmation-cancelled",
          rollbackTargetId: "confirmation-cancelled"
        })
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
    conversation: {
      entries: prependConversationEntry(state.conversation.entries, {
        id: `permission-request-${pendingModeChange.targetMode}`,
        kind: "system",
        title: "等待权限升级",
        summary: pendingModeChange.reason,
        actionLabel: "预览回退到 启动基线",
        rollbackTargetId: "startup-baseline"
      })
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
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: "permission-approved",
          kind: "system",
          title: "已批准权限升级",
          summary: pendingModeChange.reason,
          actionLabel: "预览回退到 permission-mode-approved",
          rollbackTargetId: "permission-mode-approved"
        })
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
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: "permission-cancelled",
          kind: "system",
          title: "已取消权限升级",
          summary: pendingModeChange.reason,
          actionLabel: "预览回退到 permission-mode-cancelled",
          rollbackTargetId: "permission-mode-cancelled"
        })
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
    conversation: {
      entries: prependConversationEntry(state.conversation.entries, {
        id: `rollback-preview-${targetEntryId}`,
        kind: "system",
        title: "等待确认回退",
        summary: `准备回退到 ${targetEntry.label}，将撤销 ${preview.willRevertCount} 个后续状态。`,
        actionLabel: `预览回退到 ${targetEntry.label}`,
        rollbackTargetId: targetEntryId
      })
    },
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
    conversation: {
      entries: prependConversationEntry(state.conversation.entries, {
        id: `rollback-applied-${pendingPreview.targetEntryId}`,
        kind: "system",
        title: `已回退到 ${pendingPreview.targetLabel}`,
        summary: `已恢复目标快照，并撤销 ${pendingPreview.willRevertCount} 个后续状态。`,
        actionLabel: `预览回退到 ${pendingPreview.targetLabel}`,
        rollbackTargetId: pendingPreview.targetEntryId
      })
    },
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
    conversation: {
      entries: prependConversationEntry(state.conversation.entries, {
        id: `rollback-cancelled-${pendingPreview.targetEntryId}`,
        kind: "system",
        title: "已取消回退",
        summary: `已取消回退到 ${pendingPreview.targetLabel}。`,
        actionLabel: `预览回退到 ${pendingPreview.targetLabel}`,
        rollbackTargetId: pendingPreview.targetEntryId
      })
    },
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

export function createSearchEnabledState(
  state: WorkbenchState,
  payload: {
    provider: string;
    query: string;
    sourceTitle: string;
    sourceUrl: string;
    summary: string;
  }
): WorkbenchState {
  const rollbackEntryId = createWorkbenchEventId(state, "search-enabled", payload.provider.toLowerCase());

  return recordRollbackEntry(
    {
      ...state,
      search: {
        enabled: true,
        providerLabel: payload.provider
      },
      sources: {
        items: [
          {
            title: payload.sourceTitle,
            url: payload.sourceUrl,
            provider: payload.provider,
            query: payload.query,
            summary: payload.summary
          },
          ...state.sources.items
        ].slice(0, 6)
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: rollbackEntryId,
          kind: "system",
          title: "联网搜索已开启",
          summary: `${payload.provider} 已返回来源 ${payload.sourceTitle}。`,
          actionLabel: `预览回退到 ${payload.provider} 搜索前`,
          rollbackTargetId: rollbackEntryId
        })
      },
      audit: {
        summary: payload.summary,
        lastEvent: {
          module: "search",
          detail: `${payload.provider} 查询: ${payload.query}`,
          timestamp: "已执行",
          source: "search_query"
        }
      }
    },
    rollbackEntryId,
    "联网搜索",
    `${payload.provider} 已返回来源 ${payload.sourceTitle}。`,
    "session"
  );
}

export function createToolExecutionState(
  state: WorkbenchState,
  payload: {
    toolLabel: string;
    summary: string;
    outputTitle: string;
    outputSummary: string;
    source: string;
  }
): WorkbenchState {
  const rollbackEntryId = createWorkbenchEventId(state, "tool-result", payload.source);

  return recordRollbackEntry(
    {
      ...state,
      tools: {
        lastResult: {
          toolLabel: payload.toolLabel,
          summary: payload.summary,
          source: payload.source
        }
      },
      output: {
        title: payload.outputTitle,
        summary: payload.outputSummary
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: rollbackEntryId,
          kind: "system",
          title: "工具执行完成",
          summary: `${payload.toolLabel}: ${payload.summary}`,
          actionLabel: `预览回退到 ${payload.toolLabel} 执行前`,
          rollbackTargetId: rollbackEntryId
        })
      },
      audit: {
        summary: `${payload.toolLabel} 已完成`,
        lastEvent: {
          module: "tools",
          detail: payload.summary,
          timestamp: "已执行",
          source: payload.source
        }
      }
    },
    rollbackEntryId,
    "工具执行结果",
    `${payload.toolLabel} 已写入当前工作台产物与日志。`,
    "tool"
  );
}

export function createToolExecutionErrorState(
  state: WorkbenchState,
  payload: {
    toolLabel: string;
    summary: string;
    detail: string;
    actionLabel: string;
    source: string;
  }
): WorkbenchState {
  const rollbackEntryId = createWorkbenchEventId(state, "tool-error", payload.source);

  return recordRollbackEntry(
    {
      ...state,
      tools: {
        lastResult: {
          toolLabel: payload.toolLabel,
          summary: payload.summary,
          source: payload.source
        }
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: rollbackEntryId,
          kind: "system",
          title: "工具执行失败",
          summary: `${payload.toolLabel}: ${payload.summary}`,
          detailLines: ["模块: tools", `来源: ${payload.source}`, `建议: ${payload.actionLabel}`]
        })
      },
      audit: {
        summary: payload.summary,
        lastEvent: {
          module: "tools",
          detail: payload.detail,
          timestamp: "已执行",
          source: payload.source
        }
      },
      error: {
        module: "tools",
        summary: payload.summary,
        detail: payload.detail,
        actionLabel: payload.actionLabel,
        timestamp: "已执行",
        source: payload.source
      }
    },
    rollbackEntryId,
    "工具执行失败",
    `${payload.toolLabel} 失败，已写入修复建议与审计日志。`,
    "tool"
  );
}

export function createUserTaskSubmittedState(
  state: WorkbenchState,
  payload: {
    message: string;
  }
): WorkbenchState {
  const rollbackEntryId = createWorkbenchEventId(state, "composer-submit", "local-task");

  return recordRollbackEntry(
    {
      ...state,
      tasks: {
        pendingCount: state.tasks.pendingCount + 1,
        activeTaskId: null,
        items: [
          {
            id: rollbackEntryId,
            source: "composer" as const,
            status: "queued" as const,
            summary: payload.message
          },
          ...state.tasks.items
        ].slice(0, 20)
      },
      output: {
        title: "\u672c\u5730\u4efb\u52a1\u961f\u5217",
        summary: `\u5f53\u524d\u6709 ${state.tasks.pendingCount + 1} \u6761\u5f85\u5904\u7406\u7684\u672c\u5730\u4efb\u52a1\u3002`
      },
      conversation: {
        entries: prependConversationEntries(state.conversation.entries, [
          {
            id: `${rollbackEntryId}-user`,
            kind: "user",
            title: "本地任务",
            summary: payload.message
          },
          {
            id: `${rollbackEntryId}-system`,
            kind: "system",
            title: "任务已进入本地队列",
            summary: "将优先使用本地 Ollama 处理这条任务。",
            detailLines: [
              `模型: ${state.model.activeModel}`,
              `权限: ${state.permission.label}`,
              `联网搜索: ${state.search.enabled ? "已开启" : "默认关闭"}`
            ],
            actionLabel: "预览回退到 本次输入前",
            rollbackTargetId: rollbackEntryId
          }
        ])
      },
      audit: {
        summary: "已提交 1 条本地任务",
        lastEvent: {
          module: "conversation",
          detail: payload.message,
          timestamp: "已提交",
          source: "composer_submit"
        }
      }
    },
    rollbackEntryId,
    "会话输入",
    `已提交本地任务: ${payload.message}`,
    "session"
  );
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
    sources: state.sources,
    tools: state.tools,
    tasks: state.tasks,
    output: state.output,
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

function prependConversationEntry(
  entries: ConversationEntry[],
  entry: ConversationEntry
): ConversationEntry[] {
  return [entry, ...entries].slice(0, 12);
}

function prependConversationEntries(
  entries: ConversationEntry[],
  nextEntries: ConversationEntry[]
): ConversationEntry[] {
  return [...nextEntries.reverse(), ...entries].slice(0, 12);
}

function createWorkbenchEventId(
  state: WorkbenchState,
  prefix: string,
  suffix: string
): string {
  return `${prefix}-${suffix}-${state.rollback.entries.length}`;
}
