import type { OllamaOverview } from "../ollama/ollamaService";
import { recordRollbackEntry } from "./workbenchState.rollback";
import type { WorkbenchState } from "./workbenchState.types";

const PREFERRED_DEFAULT_CHAT_MODELS = ["gemma:26b", "gemma4:26b"];

function isEmbeddingOnlyOllamaModel(modelName: string) {
  const normalized = modelName.trim().toLowerCase();

  return normalized.includes("embedding")
    || normalized.includes("embed")
    || normalized.includes("bge")
    || normalized.includes("mxbai")
    || normalized.includes("nomic-embed")
    || normalized.includes("all-minilm");
}

export function getChatCapableOllamaModels(availableModels: WorkbenchState["model"]["availableModels"]) {
  return availableModels.filter((model) => {
    const capabilities = model.capabilities ?? [];
    const capabilityBasedEmbedding = capabilities.some((capability: string) => capability.toLowerCase() === "embedding");

    return !(capabilityBasedEmbedding || isEmbeddingOnlyOllamaModel(model.name));
  });
}

export function resolveUsableWorkbenchChatModel(
  selectedModel: string,
  availableModels: WorkbenchState["model"]["availableModels"]
) {
  const normalizedSelectedModel = selectedModel.trim();
  const chatCapableModels = getChatCapableOllamaModels(availableModels);

  if (
    normalizedSelectedModel
    && chatCapableModels.some((model) => model.name === normalizedSelectedModel)
  ) {
    return normalizedSelectedModel;
  }

  if (chatCapableModels.length > 0) {
    return chatCapableModels.find((model) => PREFERRED_DEFAULT_CHAT_MODELS.includes(model.name))?.name
      ?? chatCapableModels[0]?.name
      ?? "";
  }

  return "";
}

function getReachableOllamaDiagnostic(overview: OllamaOverview): string {
  if (overview.diagnostic) {
    return overview.diagnostic;
  }

  const chatCapableModels = getChatCapableOllamaModels(overview.models);

  if (chatCapableModels.length === 0) {
    return "No local Ollama models were found. Pull a model before starting chat.";
  }

  if (
    overview.selectedModel
    && !chatCapableModels.some((model) => model.name === overview.selectedModel)
  ) {
    return `Selected Ollama model is unavailable: ${overview.selectedModel}. Choose one of the detected local models before retrying.`;
  }

  return "";
}

function getReachableOllamaActiveModel(overview: OllamaOverview): string {
  const resolvedModel = resolveUsableWorkbenchChatModel(overview.selectedModel, overview.models);

  if (resolvedModel) {
    return resolvedModel;
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
  const chatCapableModels = getChatCapableOllamaModels(overview.models);
  const selectedModelUnavailable = Boolean(
    overview.selectedModel.trim()
      && !chatCapableModels.some((model) => model.name === overview.selectedModel.trim())
  );
  const auditSummary = selectedModelUnavailable
    ? "Ollama 模型需要重新选择"
    : `已读取 ${chatCapableModels.length} 个本地模型`;
  const auditDetail = selectedModelUnavailable
    ? diagnostic
    : `${overview.endpoint} 已返回模型列表。`;
  const rollbackLabel = selectedModelUnavailable ? auditSummary : "Ollama 检查";
  const rollbackSummary = selectedModelUnavailable
    ? diagnostic
    : `已完成 ${chatCapableModels.length} 个本地模型的读取检查。`;
  const nextActiveModel = getReachableOllamaActiveModel(overview);
  const nextNpcModel = resolveUsableWorkbenchChatModel(state.settings?.npc?.localModel ?? "", overview.models) || nextActiveModel;

  return recordRollbackEntry(
    {
      ...state,
      model: {
        ...state.model,
        status: "Ollama 已连接",
        endpoint: overview.endpoint,
        activeModel: nextActiveModel,
        diagnostic,
        availableModels: chatCapableModels
      },
      settings: {
        ...state.settings,
        npc: {
          localModel: nextNpcModel
        }
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
      settings: {
        ...state.settings,
        npc: {
          localModel: state.settings?.npc?.localModel || selectedModel.name
        }
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

export function createNpcLocalModelSelectedState(state: WorkbenchState, modelName: string): WorkbenchState {
  const selectedModel = state.model.availableModels.find((model) => model.name === modelName);

  if (!selectedModel) {
    return state;
  }

  return recordRollbackEntry(
    {
      ...state,
      settings: {
        ...state.settings,
        npc: {
          localModel: selectedModel.name
        }
      },
      output: {
        title: "NPC 模型已切换",
        summary: `NPC 当前使用 ${selectedModel.name}。`
      },
      audit: {
        summary: `已选择 NPC 本地模型 ${selectedModel.name}`,
        lastEvent: {
          module: "ollama",
          detail: `Selected local NPC model: ${selectedModel.name}. Size: ${selectedModel.sizeLabel}.`,
          timestamp: "本地最近一次选择",
          source: "npc_local_model_selected"
        }
      },
      error: state.error?.module === "ollama" ? null : state.error
    },
    "npc-local-model-selected",
    "NPC 模型选择",
    `已选择 NPC 本地模型 ${selectedModel.name}。`,
    "session"
  );
}

function clampLongAnswerNumPredict(value: number) {
  return Math.min(16384, Math.max(1024, Math.round(value)));
}

function clampAutoContinuationLimit(value: number) {
  return Math.min(8, Math.max(1, Math.round(value)));
}

function clampContinuationTailLimit(value: number) {
  return Math.min(4800, Math.max(1200, Math.round(value)));
}

export function createOllamaSettingsState(
  state: WorkbenchState,
  payload: {
    longAnswerNumPredict: number;
    autoContinuationLimit: number;
    continuationTailLimit?: number;
  }
): WorkbenchState {
  const nextLongAnswerNumPredict = clampLongAnswerNumPredict(payload.longAnswerNumPredict);
  const nextAutoContinuationLimit = clampAutoContinuationLimit(payload.autoContinuationLimit);
  const nextContinuationTailLimit = clampContinuationTailLimit(
    payload.continuationTailLimit ?? state.settings.ollama.continuationTailLimit
  );

  if (
    state.settings.ollama.longAnswerNumPredict === nextLongAnswerNumPredict
    && state.settings.ollama.autoContinuationLimit === nextAutoContinuationLimit
    && state.settings.ollama.continuationTailLimit === nextContinuationTailLimit
  ) {
    return state;
  }

  return recordRollbackEntry(
    {
      ...state,
      settings: {
        ...state.settings,
        ollama: {
          ...state.settings.ollama,
          longAnswerNumPredict: nextLongAnswerNumPredict,
          autoContinuationLimit: nextAutoContinuationLimit,
          continuationTailLimit: nextContinuationTailLimit
        }
      },
      audit: {
        summary: "已更新 Ollama 长回答设置",
        lastEvent: {
          module: "ollama",
          detail: `longAnswerNumPredict=${nextLongAnswerNumPredict} autoContinuationLimit=${nextAutoContinuationLimit} continuationTailLimit=${nextContinuationTailLimit}`,
          timestamp: "已执行",
          source: "ollama_settings"
        }
      },
      error: null
    },
    `ollama-settings-${state.rollback.entries.length}`,
    "Ollama 设置更新",
    "已保存本地长回答预算与自动续写设置。",
    "session"
  );
}
