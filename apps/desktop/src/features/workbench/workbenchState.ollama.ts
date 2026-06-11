import type { OllamaOverview } from "../ollama/ollamaService";
import { recordRollbackEntry } from "./workbenchState.rollback";
import type { WorkbenchState } from "./workbenchState.types";

const PREFERRED_DEFAULT_CHAT_MODELS = ["gemma:26b", "gemma4:26b"];

function getReachableOllamaDiagnostic(overview: OllamaOverview): string {
  if (overview.diagnostic) {
    return overview.diagnostic;
  }

  if (overview.models.length === 0) {
    return "No local Ollama models were found. Pull a model before starting chat.";
  }

  if (
    overview.selectedModel
    && !overview.models.some((model) => model.name === overview.selectedModel)
  ) {
    return `Selected Ollama model is unavailable: ${overview.selectedModel}. Choose one of the detected local models before retrying.`;
  }

  return "";
}

function getReachableOllamaActiveModel(overview: OllamaOverview): string {
  const selectedModel = overview.selectedModel.trim();

  if (selectedModel && overview.models.some((model) => model.name === selectedModel)) {
    return selectedModel;
  }

  if (overview.models.length > 0) {
    return overview.models.find((model) => PREFERRED_DEFAULT_CHAT_MODELS.includes(model.name))?.name
      ?? overview.models[0]?.name
      ?? "未选择模型";
  }

  return "未选择模型";
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

  const diagnostic = getReachableOllamaDiagnostic(overview);
  const selectedModelUnavailable = Boolean(
    overview.selectedModel.trim()
      && !overview.models.some((model) => model.name === overview.selectedModel.trim())
  );
  const auditSummary = selectedModelUnavailable
    ? "Ollama 模型需要重新选择"
    : `已读取 ${overview.models.length} 个本地模型`;
  const auditDetail = selectedModelUnavailable
    ? diagnostic
    : `${overview.endpoint} 已返回模型列表。`;
  const rollbackLabel = selectedModelUnavailable ? auditSummary : "Ollama 检查";
  const rollbackSummary = selectedModelUnavailable
    ? diagnostic
    : `已完成 ${overview.models.length} 个本地模型的读取检查。`;

  return recordRollbackEntry(
    {
      ...state,
      model: {
        ...state.model,
        status: "Ollama 已连接",
        endpoint: overview.endpoint,
        activeModel: getReachableOllamaActiveModel(overview),
        diagnostic,
        availableModels: overview.models
      },
      audit: {
        summary: auditSummary,
        lastEvent: {
          module: "ollama",
          detail: auditDetail,
          timestamp: "本地最近一次检查",
          source: "ollama_overview"
        }
      },
      error: null
    },
    "ollama-check-ready",
    rollbackLabel,
    rollbackSummary,
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

export function createModelSelectedState(state: WorkbenchState, modelName: string): WorkbenchState {
  const selectedModel = state.model.availableModels.find((model) => model.name === modelName);

  if (!selectedModel) {
    return state;
  }

  return recordRollbackEntry(
    {
      ...state,
      model: {
        ...state.model,
        activeModel: selectedModel.name
      },
      output: {
        title: "本地模型已切换",
        summary: `当前使用 ${selectedModel.name}。`
      },
      audit: {
        summary: `已选择本地模型 ${selectedModel.name}`,
        lastEvent: {
          module: "ollama",
          detail: `Selected local Ollama model: ${selectedModel.name}. Size: ${selectedModel.sizeLabel}.`,
          timestamp: "本地最近一次选择",
          source: "ollama_model_selected"
        }
      },
      error: state.error?.module === "ollama" ? null : state.error
    },
    "ollama-model-selected",
    "模型选择",
    `已选择本地模型 ${selectedModel.name}。`,
    "session"
  );
}
