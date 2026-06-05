import type { OllamaOverview } from "../ollama/ollamaService";

export type PermissionMode = "readonly" | "workspace-write" | "controlled-full";
export type PendingConfirmation = {
  title: string;
  summary: string;
  commandPreview: string;
  impact: string;
  requiredMode: PermissionMode;
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
  };
  confirmation: {
    pending: PendingConfirmation | null;
  };
  rollback: {
    defaultLimit: number;
    maxLimit: number;
    entries: Array<{
      id: string;
      label: string;
      summary: string;
    }>;
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

export function createInitialWorkbenchState(): WorkbenchState {
  return {
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
      confirmationSummary: "删除、覆盖、递归删除、进程结束前必须弹窗确认。"
    },
    confirmation: {
      pending: null
    },
    rollback: {
      defaultLimit: 10,
      maxLimit: 20,
      entries: [
        {
          id: "startup-baseline",
          label: "启动基线",
          summary: "应用启动后的本地安全初始状态。"
        }
      ]
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
}

export function mergeOllamaOverview(state: WorkbenchState, overview: OllamaOverview): WorkbenchState {
  if (!overview.reachable) {
    return {
      ...state,
      model: {
        ...state.model,
        status: "等待 Ollama",
        endpoint: overview.endpoint,
        activeModel: overview.selectedModel || "未选择模型",
        diagnostic: overview.diagnostic,
        availableModels: overview.models
      },
      rollback: {
        ...state.rollback,
        entries: [
          state.rollback.entries[0],
          {
            id: "ollama-check-offline",
            label: "Ollama 检查",
            summary: "本地模型服务离线，保留最近一次可回退检查点。"
          }
        ].filter(Boolean) as WorkbenchState["rollback"]["entries"]
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
    };
  }

  return {
    ...state,
    model: {
      ...state.model,
      status: overview.reachable ? "Ollama 已连接" : "等待 Ollama",
      endpoint: overview.endpoint,
      activeModel: overview.selectedModel || "未选择模型",
      diagnostic: overview.diagnostic,
      availableModels: overview.models
    },
    rollback: {
      ...state.rollback,
      entries: [
        state.rollback.entries[0],
        {
          id: "ollama-check-ready",
          label: "Ollama 检查",
          summary: `已完成 ${overview.models.length} 个本地模型的读取检查。`
        }
      ].filter(Boolean) as WorkbenchState["rollback"]["entries"]
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
  };
}

export function createOllamaLoadErrorState(state: WorkbenchState, detail: string): WorkbenchState {
  return {
    ...state,
    model: {
      ...state.model,
      status: "等待 Ollama",
      diagnostic: detail
    },
    rollback: {
      ...state.rollback,
      entries: [
        state.rollback.entries[0],
        {
          id: "ollama-load-error",
          label: "异常保护",
          summary: "Ollama 状态读取异常，工作台保留在最近一次安全状态。"
        }
      ].filter(Boolean) as WorkbenchState["rollback"]["entries"]
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
