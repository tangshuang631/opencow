import type { WorkbenchState } from "./workbenchState.types";

const EMPTY_OUTPUT = {
  title: "暂无产物",
  summary: "等待工具执行结果或本地产物摘要。"
} as const;

function createNewConversationAuditDetail(preservedTasks: WorkbenchState["tasks"]["items"]): string {
  const queuedCount = preservedTasks.filter((item) => item.status === "queued").length;
  const runningCount = preservedTasks.filter((item) => item.status === "running").length;
  const taskQueueDetail =
    preservedTasks.length > 0
      ? `Preserved active local task queue: queued=${queuedCount}, running=${runningCount}.`
      : "No active local task queue was preserved.";

  return [
    "Started a blank conversation and cleared pending permission and confirmation gates, plus cleared pending rollback preview.",
    "Model, permission mode, settings, and rollback history were preserved.",
    taskQueueDetail
  ].join(" ");
}

export function createNewConversationState(state: WorkbenchState): WorkbenchState {
  const activeTask = state.tasks.activeTaskId
    ? state.tasks.items.find((item) => item.id === state.tasks.activeTaskId)
    : null;
  const preservedTasks = state.tasks.items.filter((item) => item.status === "queued" || item.status === "running");
  const preservedActiveTaskId = activeTask?.status === "running" ? state.tasks.activeTaskId : null;

  return {
    ...state,
    conversation: {
      entries: []
    },
    permission: {
      ...state.permission,
      pendingModeChange: null
    },
    confirmation: {
      pending: null
    },
    rollback: {
      ...state.rollback,
      pendingPreview: null
    },
    sources: {
      items: []
    },
    tools: {
      lastResult: null
    },
    tasks: {
      pendingCount: preservedTasks.filter((item) => item.status === "queued").length,
      activeTaskId: preservedActiveTaskId,
      items: preservedTasks
    },
    output: EMPTY_OUTPUT,
    audit: {
      summary: "已新建空白对话",
      lastEvent: {
        module: "conversation",
        detail: createNewConversationAuditDetail(preservedTasks),
        timestamp: "ready",
        source: "conversation_new"
      }
    },
    error: state.error?.module === "ollama" ? state.error : null
  };
}
