import type { OllamaOverview } from "../ollama/ollamaService";
import { recordRollbackEntry } from "./workbenchState.rollback";
import { prependConversationEntry } from "./workbenchState.shared";
import type { WorkbenchState } from "./workbenchState.types";

function getReachableOllamaDiagnostic(overview: OllamaOverview): string {
  if (overview.diagnostic) {
    return overview.diagnostic;
  }

  if (overview.models.length === 0) {
    return "No local Ollama models were found. Pull a model before starting chat.";
  }

  return "";
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
        diagnostic: getReachableOllamaDiagnostic(overview),
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
