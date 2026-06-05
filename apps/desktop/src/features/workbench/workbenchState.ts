import type { OllamaOverview } from "../ollama/ollamaService";

export type PermissionMode = "readonly" | "workspace-write" | "controlled-full";

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
  };
  rollback: {
    defaultLimit: number;
    maxLimit: number;
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
    };
  };
  error: {
    module: string;
    summary: string;
    detail: string;
    actionLabel: string;
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
      label: "只读"
    },
    rollback: {
      defaultLimit: 10,
      maxLimit: 20
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
        detail: "应用已启动，等待读取本地模型状态。"
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
      audit: {
        summary: "Ollama 离线，等待本地服务恢复",
        lastEvent: {
          module: "ollama",
          detail: overview.diagnostic
        }
      },
      error: {
        module: "ollama",
        summary: "无法连接本地 Ollama",
        detail: overview.diagnostic,
        actionLabel: "检查 Ollama 服务"
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
    audit: {
      summary: `已读取 ${overview.models.length} 个本地模型`,
      lastEvent: {
        module: "ollama",
        detail: `${overview.endpoint} 已返回模型列表。`
      }
    },
    error: null
  };
}
