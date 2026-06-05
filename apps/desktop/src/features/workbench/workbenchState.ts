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
    }
  };
}

export function mergeOllamaOverview(state: WorkbenchState, overview: OllamaOverview): WorkbenchState {
  return {
    ...state,
    model: {
      ...state.model,
      status: overview.reachable ? "Ollama 已连接" : "等待 Ollama",
      endpoint: overview.endpoint,
      activeModel: overview.selectedModel || "未选择模型",
      diagnostic: overview.diagnostic,
      availableModels: overview.models
    }
  };
}
