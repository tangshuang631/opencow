import { recordRollbackEntry } from "./workbenchState.rollback";
import { createWorkbenchEventId, prependConversationEntry } from "./workbenchState.shared";
import { withStorageDelta } from "./workbenchState.storage";
import type { LocalTaskExecutionKind, WorkbenchState } from "./workbenchState.types";

export function createUserTaskSubmittedState(
  state: WorkbenchState,
  payload: {
    message: string;
    executionKind?: LocalTaskExecutionKind;
    executionTitle?: string;
    executionAuditSummary?: string;
    executionAuditDetail?: string;
    continuationMessage?: string;
  }
): WorkbenchState {
  const normalizedMessage = payload.message.trim();
  const duplicatedTask = state.tasks.items.find(
    (item) =>
      (item.status === "queued" || item.status === "running") &&
      item.summary.trim().toLowerCase() === normalizedMessage.toLowerCase()
  );

  if (duplicatedTask) {
    return recordRollbackEntry(
      withStorageDelta(
        {
          ...state,
          output: {
            title: "重复任务已跳过",
            summary: `已有相同任务正在排队或执行：${normalizedMessage}`
          },
          conversation: {
            entries: prependConversationEntry(state.conversation.entries, {
              id: `${duplicatedTask.id}-duplicate-skipped`,
              kind: "system",
              title: "重复任务已跳过",
              summary: normalizedMessage,
              detailLines: [
                "原因：已有相同任务在本地队列中。",
                `已有任务：${duplicatedTask.summary}`
              ]
            })
          },
          audit: {
            summary: "跳过重复本地任务",
            lastEvent: {
              module: "conversation",
              detail: normalizedMessage,
              timestamp: "skipped",
              source: "composer_submit_deduplicated"
            }
          }
        },
        {
          sessionCount: state.storage.sessionCount
        }
      ),
      `${duplicatedTask.id}-duplicate-skipped`,
      "重复任务已跳过",
      `跳过重复本地任务：${normalizedMessage}`,
      "session"
    );
  }

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
              summary: normalizedMessage,
              attemptCount: 0,
              executionKind: payload.executionKind,
              executionTitle: payload.executionTitle,
              executionAuditSummary: payload.executionAuditSummary,
              executionAuditDetail: payload.executionAuditDetail,
              continuationMessage: payload.continuationMessage
            },
            ...state.tasks.items
          ].slice(0, 20)
        },
        output: {
          title: "本地任务队列",
          summary: `当前有 ${state.tasks.pendingCount + 1} 条待处理任务`
        },
        conversation: {
          entries: prependConversationEntry(state.conversation.entries, {
            id: `${rollbackEntryId}-user`,
            kind: "user",
            title: "用户",
            summary: normalizedMessage
          })
        },
        audit: {
          summary: "已提交本地任务",
          lastEvent: {
            module: "conversation",
            detail: normalizedMessage,
            timestamp: "queued",
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
    `提交本地任务：${normalizedMessage}`,
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
                attemptCount: item.attemptCount + 1,
                status: "running" as const
              }
            : item
        )
      },
      output: {
        title: "本地任务执行中",
        summary: "正在使用本地助手处理当前请求"
      },
      audit: {
        summary: "本地任务开始执行",
        lastEvent: {
          module: "tasks",
          detail: nextTask.summary,
          timestamp: "running",
          source: "local_task_runner"
        }
      },
      error: null
    },
    `${nextTask.id}-running`,
    "本地任务开始执行",
    `开始执行本地任务：${nextTask.summary}`,
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
          id: `${activeTaskId}-assistant`,
          kind: "assistant",
          title: payload.resultTitle,
          summary: payload.resultSummary
        })
      },
      audit: {
        summary: "本地任务执行完成",
        lastEvent: {
          module: "tasks",
          detail: payload.resultSummary,
          timestamp: "completed",
          source: "local_task_runner"
        }
      },
      error: null
    },
    `${activeTaskId}-completed`,
    "本地任务执行完成",
    `完成本地任务：${activeTask.summary}`,
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
          detailLines: [
            "模块：tasks",
            `来源：${payload.source}`,
            `建议：${payload.actionLabel}`
          ]
        })
      },
      audit: {
        summary: payload.summary,
        lastEvent: {
          module: "tasks",
          detail: payload.detail,
          timestamp: "failed",
          source: payload.source
        }
      },
      error: {
        module: "tasks",
        summary: payload.summary,
        detail: payload.detail,
        actionLabel: payload.actionLabel,
        timestamp: "failed",
        source: payload.source
      }
    },
    `${activeTaskId}-failed`,
    "本地任务执行失败",
    `本地任务执行失败：${activeTask.summary}`,
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
        summary: `当前有 ${state.tasks.pendingCount + 1} 条待处理任务`
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: `${failedTask.id}-retried`,
          kind: "system",
          title: "已重试本地任务",
          summary: failedTask.summary,
          detailLines: [
            "模块：tasks",
            "来源：local_task_retry",
            "任务已重新加入队列"
          ]
        })
      },
      audit: {
        summary: "已重试本地任务",
        lastEvent: {
          module: "tasks",
          detail: failedTask.summary,
          timestamp: "retried",
          source: "local_task_retry"
        }
      },
      error: null
    },
    `${failedTask.id}-retried`,
    "本地任务重试",
    `重新加入本地任务队列：${failedTask.summary}`,
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
        summary: "当前任务已中断，未继续执行高风险或长耗时步骤"
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: `${activeTaskId}-cancelled`,
          kind: "system",
          title: "本地任务已停止",
          summary: activeTask.summary,
          detailLines: [
            "模块：tasks",
            "来源：local_task_cancelled",
            "可稍后重新排队执行"
          ]
        })
      },
      audit: {
        summary: "本地任务已停止",
        lastEvent: {
          module: "tasks",
          detail: activeTask.summary,
          timestamp: "cancelled",
          source: "local_task_cancelled"
        }
      },
      error: {
        module: "tasks",
        summary: "本地任务已停止",
        detail: "用户主动中断了当前本地任务，系统已保持可恢复状态。",
        actionLabel: "可稍后重新排队执行",
        timestamp: "cancelled",
        source: "local_task_cancelled"
      }
    },
    `${activeTaskId}-cancelled`,
    "本地任务已停止",
    `停止本地任务：${activeTask.summary}`,
    "tool"
  );
}
