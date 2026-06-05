import { recordRollbackEntry } from "./workbenchState.rollback";
import { createWorkbenchEventId, prependConversationEntries, prependConversationEntry } from "./workbenchState.shared";
import { withStorageDelta } from "./workbenchState.storage";
import type { WorkbenchState } from "./workbenchState.types";

export function createUserTaskSubmittedState(
  state: WorkbenchState,
  payload: {
    message: string;
  }
): WorkbenchState {
  const rollbackEntryId = createWorkbenchEventId(state, "composer-submit", "local-task");

  return recordRollbackEntry(
    withStorageDelta(
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
          title: "本地任务队列",
          summary: `当前有 ${state.tasks.pendingCount + 1} 条待处理的本地任务。`
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
      {
        sessionCount: state.storage.sessionCount + 1
      }
    ),
    rollbackEntryId,
    "会话输入",
    `已提交本地任务: ${payload.message}`,
    "session"
  );
}

export function createTaskExecutionStartedState(state: WorkbenchState): WorkbenchState {
  if (state.tasks.activeTaskId) {
    return state;
  }

  const nextTask = state.tasks.items.find((item) => item.status === "queued");

  if (!nextTask) {
    return state;
  }

  return recordRollbackEntry(
    {
      ...state,
      tasks: {
        pendingCount: Math.max(0, state.tasks.pendingCount - 1),
        activeTaskId: nextTask.id,
        items: state.tasks.items.map((item) =>
          item.id === nextTask.id
            ? {
                ...item,
                status: "running" as const
              }
            : item
        )
      },
      output: {
        title: "本地任务执行中",
        summary: "正在使用本地 Ollama 处理当前任务。"
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: `${nextTask.id}-running`,
          kind: "system",
          title: "本地任务开始执行",
          summary: nextTask.summary,
          detailLines: [`模型: ${state.model.activeModel}`, `权限: ${state.permission.label}`],
          actionLabel: "预览回退到 本次任务开始前",
          rollbackTargetId: nextTask.id
        })
      },
      audit: {
        summary: "本地任务开始执行",
        lastEvent: {
          module: "tasks",
          detail: nextTask.summary,
          timestamp: "执行中",
          source: "local_task_runner"
        }
      },
      error: null
    },
    `${nextTask.id}-running`,
    "本地任务开始执行",
    `开始执行本地任务: ${nextTask.summary}`,
    "tool"
  );
}

export function createTaskExecutionSucceededState(
  state: WorkbenchState,
  payload: {
    resultTitle: string;
    resultSummary: string;
  }
): WorkbenchState {
  const activeTaskId = state.tasks.activeTaskId;

  if (!activeTaskId) {
    return state;
  }

  const activeTask = state.tasks.items.find((item) => item.id === activeTaskId);

  if (!activeTask) {
    return state;
  }

  return recordRollbackEntry(
    {
      ...state,
      tasks: {
        pendingCount: state.tasks.pendingCount,
        activeTaskId: null,
        items: state.tasks.items.map((item) =>
          item.id === activeTaskId
            ? {
                ...item,
                status: "completed" as const
              }
            : item
        )
      },
      output: {
        title: payload.resultTitle,
        summary: payload.resultSummary
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: `${activeTaskId}-completed`,
          kind: "system",
          title: "本地任务执行完成",
          summary: payload.resultSummary,
          detailLines: [`任务: ${activeTask.summary}`, `产物: ${payload.resultTitle}`],
          actionLabel: "预览回退到 本次任务完成前",
          rollbackTargetId: `${activeTaskId}-running`
        })
      },
      audit: {
        summary: "本地任务执行完成",
        lastEvent: {
          module: "tasks",
          detail: payload.resultSummary,
          timestamp: "已完成",
          source: "local_task_runner"
        }
      },
      error: null
    },
    `${activeTaskId}-completed`,
    "本地任务执行完成",
    `已完成本地任务: ${activeTask.summary}`,
    "tool"
  );
}

export function createTaskExecutionFailedState(
  state: WorkbenchState,
  payload: {
    summary: string;
    detail: string;
    actionLabel: string;
    source: string;
  }
): WorkbenchState {
  const activeTaskId = state.tasks.activeTaskId;

  if (!activeTaskId) {
    return state;
  }

  const activeTask = state.tasks.items.find((item) => item.id === activeTaskId);

  if (!activeTask) {
    return state;
  }

  return recordRollbackEntry(
    {
      ...state,
      tasks: {
        pendingCount: state.tasks.pendingCount,
        activeTaskId: null,
        items: state.tasks.items.map((item) =>
          item.id === activeTaskId
            ? {
                ...item,
                status: "failed" as const
              }
            : item
        )
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: `${activeTaskId}-failed`,
          kind: "system",
          title: payload.summary,
          summary: activeTask.summary,
          detailLines: ["模块: tasks", `来源: ${payload.source}`, `建议: ${payload.actionLabel}`]
        })
      },
      audit: {
        summary: payload.summary,
        lastEvent: {
          module: "tasks",
          detail: payload.detail,
          timestamp: "已失败",
          source: payload.source
        }
      },
      error: {
        module: "tasks",
        summary: payload.summary,
        detail: payload.detail,
        actionLabel: payload.actionLabel,
        timestamp: "已失败",
        source: payload.source
      }
    },
    `${activeTaskId}-failed`,
    "本地任务执行失败",
    `本地任务执行失败: ${activeTask.summary}`,
    "tool"
  );
}

export function createTaskExecutionRetriedState(state: WorkbenchState): WorkbenchState {
  const failedTask = state.tasks.items.find((item) => item.status === "failed");

  if (!failedTask) {
    return state;
  }

  return recordRollbackEntry(
    {
      ...state,
      tasks: {
        pendingCount: state.tasks.pendingCount + 1,
        activeTaskId: null,
        items: state.tasks.items.map((item) =>
          item.id === failedTask.id
            ? {
                ...item,
                status: "queued" as const
              }
            : item
        )
      },
      output: {
        title: "本地任务队列",
        summary: `当前有 ${state.tasks.pendingCount + 1} 条待处理的本地任务。`
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: `${failedTask.id}-retried`,
          kind: "system",
          title: "已重试本地任务",
          summary: failedTask.summary,
          detailLines: ["模块: tasks", "来源: local_task_retry", "建议: 已重新加入本地队列，等待继续执行"]
        })
      },
      audit: {
        summary: "已重试本地任务",
        lastEvent: {
          module: "tasks",
          detail: failedTask.summary,
          timestamp: "已重试",
          source: "local_task_retry"
        }
      },
      error: null
    },
    `${failedTask.id}-retried`,
    "本地任务重试",
    `已将本地任务重新加入队列: ${failedTask.summary}`,
    "tool"
  );
}

export function createTaskExecutionCancelledState(state: WorkbenchState): WorkbenchState {
  const activeTaskId = state.tasks.activeTaskId;

  if (!activeTaskId) {
    return state;
  }

  const activeTask = state.tasks.items.find((item) => item.id === activeTaskId);

  if (!activeTask) {
    return state;
  }

  return recordRollbackEntry(
    {
      ...state,
      tasks: {
        pendingCount: state.tasks.pendingCount,
        activeTaskId: null,
        items: state.tasks.items.map((item) =>
          item.id === activeTaskId
            ? {
                ...item,
                status: "failed" as const
              }
            : item
        )
      },
      output: {
        title: "本地任务已停止",
        summary: "当前任务已中断，未继续执行高风险或长耗时步骤。"
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: `${activeTaskId}-cancelled`,
          kind: "system",
          title: "本地任务已停止",
          summary: activeTask.summary,
          detailLines: ["模块: tasks", "来源: local_task_cancelled", "建议: 可稍后重新排队执行"]
        })
      },
      audit: {
        summary: "本地任务已停止",
        lastEvent: {
          module: "tasks",
          detail: activeTask.summary,
          timestamp: "已停止",
          source: "local_task_cancelled"
        }
      },
      error: {
        module: "tasks",
        summary: "本地任务已停止",
        detail: "用户主动中断了当前本地任务，系统已保持可恢复状态。",
        actionLabel: "可稍后重新排队执行",
        timestamp: "已停止",
        source: "local_task_cancelled"
      }
    },
    `${activeTaskId}-cancelled`,
    "本地任务已停止",
    `已停止本地任务: ${activeTask.summary}`,
    "tool"
  );
}
