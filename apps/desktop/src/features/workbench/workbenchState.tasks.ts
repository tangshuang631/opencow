import { recordRollbackEntry } from "./workbenchState.rollback";
import { createWorkbenchEventId, prependConversationEntry } from "./workbenchState.shared";
import { withStorageDelta } from "./workbenchState.storage";
import { getShellDialogRecoveryNarrative } from "./shellCapability";
import type { ChatAttachment, LocalTaskExecutionKind, WorkbenchState } from "./workbenchState.types";

const MAX_LOCAL_TASK_ATTEMPTS = 3;
const PREVIOUS_FAILURE_DIAGNOSTICS_SUMMARY = "上次失败诊断已保留在日志和展开详情中。";
const STALE_ACTIVE_TASK_RECOVERY_SUMMARY = "已清理失效的本地任务占用状态，队列可继续调度。";
const STALE_ACTIVE_TASK_DIAGNOSTICS_SUMMARY = "完整恢复诊断已保留在日志和展开详情中。";
const DEFAULT_TASK_PREVIEW_LIMIT = 140;

function createTaskEventId(
  state: WorkbenchState,
  taskId: string,
  status: "running" | "completed" | "failed" | "retried" | "cancelled"
): string {
  return createWorkbenchEventId(state, taskId, status);
}

function createDefaultTaskPreview(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();

  return normalized.length > DEFAULT_TASK_PREVIEW_LIMIT
    ? `${normalized.slice(0, DEFAULT_TASK_PREVIEW_LIMIT).trim()}...`
    : normalized;
}

function isLocalModelGenerationTaskKind(executionKind: string | undefined): boolean {
  return executionKind === "local-model-chat"
    || executionKind === "npc-config-write"
    || executionKind === "skills-local-ollama-description";
}

function createDraftConversationSummaryFromEntries(
  entries: WorkbenchState["conversation"]["entries"]
) {
  const latestFirstEntries = entries.slice().reverse();
  const latestUserEntry = latestFirstEntries.find((entry) => entry.kind === "user");
  const latestResultEntry = latestFirstEntries.find((entry) => entry.kind !== "user");

  return {
    title: latestUserEntry?.summary.trim() || latestResultEntry?.title.trim() || "新会话",
    summary: latestResultEntry?.summary.trim() || latestUserEntry?.summary.trim() || "等待第一条消息"
  };
}

export function createUserTaskSubmittedState(
  state: WorkbenchState,
  payload: {
    message: string;
    attachments?: ChatAttachment[];
    executionKind?: LocalTaskExecutionKind;
    executionTitle?: string;
    executionAuditSummary?: string;
    executionAuditDetail?: string;
    executionMessage?: string;
    continuationMessage?: string;
    allowResumeFromFailedTask?: boolean;
    preserveExistingUserMessage?: boolean;
  }
): WorkbenchState {
  const normalizedMessage = payload.message.trim();
  const normalizedAttachments = payload.attachments ?? state.composer.draftAttachments;
  const failedTaskToResume = payload.allowResumeFromFailedTask
    ? state.tasks.items.find(
        (item) => item.status === "failed" && item.summary.trim().toLowerCase() === normalizedMessage.toLowerCase()
      )
    : null;
  const duplicatedTask = state.tasks.items.find(
    (item) =>
      (item.status === "queued"
        || item.status === "running"
        || (!payload.allowResumeFromFailedTask && item.status === "failed")) &&
      item.summary.trim().toLowerCase() === normalizedMessage.toLowerCase()
  );

  if (duplicatedTask) {
    const duplicateSkipId = createWorkbenchEventId(state, duplicatedTask.id, "duplicate-skipped");
    const defaultMessagePreview = createDefaultTaskPreview(normalizedMessage);
    const reachedDuplicateAttemptLimit =
      duplicatedTask.status === "failed" && duplicatedTask.attemptCount >= MAX_LOCAL_TASK_ATTEMPTS;
    const hasPreviousFailureDiagnostics =
      Boolean(duplicatedTask.lastFailureSource)
      || Boolean(duplicatedTask.lastFailureSummary)
      || Boolean(duplicatedTask.lastFailureDetail)
      || Boolean(duplicatedTask.lastFailureActionLabel);
    const duplicateSummary =
      reachedDuplicateAttemptLimit
        ? `The same task already reached the retry limit. Review the latest failure, rewrite the request, or help opencow repair the missing dependency or permission before trying again: ${defaultMessagePreview}`
        : duplicatedTask.status === "failed"
        ? `相同任务已经失败，正在等待用户点击重试本地任务或改写请求：${defaultMessagePreview}`
        : `已有相同任务正在排队或执行：${defaultMessagePreview}`;
    const duplicateReason =
      reachedDuplicateAttemptLimit
        ? "Reason: the duplicate task already reached the retry limit. Review the latest failure detail or rewrite the request instead of retrying the same task again."
        : duplicatedTask.status === "failed"
        ? "原因：相同任务已经失败，正在等待显式重试或新的请求内容。"
        : "原因：已有相同任务在本地队列中。";

    const duplicateTraceLines = [
      `Existing task status: ${duplicatedTask.status}`,
      `Existing task attempts: ${duplicatedTask.attemptCount}/${MAX_LOCAL_TASK_ATTEMPTS}`,
      duplicatedTask.executionKind ? `Execution kind: ${duplicatedTask.executionKind}` : null,
      duplicatedTask.executionTitle ? `Execution title: ${duplicatedTask.executionTitle}` : null,
      duplicatedTask.executionAuditDetail ? `Execution audit detail: ${duplicatedTask.executionAuditDetail}` : null,
      duplicatedTask.lastFailureSource
        ? `Previous failure source: ${duplicatedTask.lastFailureSource}`
        : null,
      duplicatedTask.lastFailureSummary
        ? `Previous failure summary: ${duplicatedTask.lastFailureSummary}`
        : null,
      duplicatedTask.lastFailureDetail
        ? `Previous failure detail: ${duplicatedTask.lastFailureDetail}`
        : null,
      duplicatedTask.lastFailureActionLabel
        ? `Previous failure recovery hint: ${duplicatedTask.lastFailureActionLabel}`
        : null,
      duplicatedTask.status === "failed" || hasPreviousFailureDiagnostics
        ? "Previous failure recovery: use explicit retry or rollback preview after reviewing the audit trail."
        : null
    ].filter((line): line is string => line !== null);
    const duplicateAuditDetail = [normalizedMessage, ...duplicateTraceLines].join(" ");
    const duplicateOutputSummary = [
      duplicateSummary,
      hasPreviousFailureDiagnostics ? PREVIOUS_FAILURE_DIAGNOSTICS_SUMMARY : null
    ].filter((line): line is string => line !== null).join(" ");

    return recordRollbackEntry(
      withStorageDelta(
        {
          ...state,
          output: {
            title: "重复任务已跳过",
            summary: duplicateOutputSummary
          },
          conversation: {
            entries: prependConversationEntry(state.conversation.entries, {
              id: duplicateSkipId,
              kind: "system",
              title: "重复任务已跳过",
              summary: defaultMessagePreview,
              detailLines: [
                duplicateReason,
                ...duplicateTraceLines,
                `已有任务：${duplicatedTask.summary}`
              ]
            })
          },
          audit: {
            summary: "跳过重复本地任务",
            lastEvent: {
              module: "conversation",
              detail: duplicateAuditDetail,
              timestamp: "skipped",
              source: "composer_submit_deduplicated"
            }
          }
        },
        {
          sessionCount: state.storage.sessionCount
        }
      ),
      duplicateSkipId,
      "重复任务已跳过",
      `跳过重复本地任务：${normalizedMessage}`,
      "session"
    );
  }

  const rollbackEntryId = createWorkbenchEventId(state, "composer-submit", "local-task");
  const nextTaskId = failedTaskToResume?.id ?? rollbackEntryId;

  const queuedState = withStorageDelta(
    {
      ...state,
      tasks: {
        pendingCount: state.tasks.pendingCount + 1,
        activeTaskId: null,
        items: failedTaskToResume
          ? state.tasks.items.map((item) =>
              item.id === failedTaskToResume.id
                ? {
                    ...item,
                    status: "queued" as const,
                    executionMessage: payload.executionMessage?.trim() || undefined,
                    attachments: normalizedAttachments,
                    executionKind: payload.executionKind,
                    executionTitle: payload.executionTitle,
                    executionAuditSummary: payload.executionAuditSummary,
                    executionAuditDetail: payload.executionAuditDetail,
                    continuationMessage: payload.continuationMessage
                  }
                : item
            )
          : [
              {
                id: nextTaskId,
                source: "composer" as const,
                status: "queued" as const,
                summary: normalizedMessage,
                attachments: normalizedAttachments,
                executionMessage: payload.executionMessage?.trim() || undefined,
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
        ...state.conversation,
        id: state.conversation.id || (state.conversation.restoredFromConversationId ?? `draft-conversation-${state.storage.sessionCount + 1}`),
        npcId: state.conversation.npcId ?? null,
        mode: "history",
        restoredFromConversationId: state.conversation.restoredFromConversationId ?? `draft-conversation-${state.storage.sessionCount + 1}`,
        entries: payload.preserveExistingUserMessage
          ? state.conversation.entries
          : prependConversationEntry(state.conversation.entries, {
              id: `${rollbackEntryId}-user`,
              kind: "user",
              title: "用户",
              summary: normalizedMessage,
              attachments: normalizedAttachments,
              rollbackTargetId: nextTaskId
            })
      },
      composer: {
        draftAttachments: []
      },
      history: {
        ...state.history,
        draftConversations: [
          {
            id: state.conversation.id || (state.conversation.restoredFromConversationId ?? `draft-conversation-${state.storage.sessionCount + 1}`),
            ...createDraftConversationSummaryFromEntries(
              payload.preserveExistingUserMessage
                ? state.conversation.entries
                : prependConversationEntry(state.conversation.entries, {
                    id: `${rollbackEntryId}-user`,
                    kind: "user",
                    title: "用户",
                    summary: normalizedMessage,
                    attachments: normalizedAttachments
                  })
            ),
            entries: payload.preserveExistingUserMessage
              ? state.conversation.entries
              : prependConversationEntry(state.conversation.entries, {
                  id: `${rollbackEntryId}-user`,
                  kind: "user",
                  title: "用户",
                  summary: normalizedMessage,
                  attachments: normalizedAttachments,
                  rollbackTargetId: nextTaskId
                }),
            npcId: state.conversation.npcId ?? null,
            archivedAt: null
          },
          ...state.history.draftConversations.filter((item) => item.id !== (state.conversation.id || (state.conversation.restoredFromConversationId ?? `draft-conversation-${state.storage.sessionCount + 1}`)))
        ].slice(0, 8)
      },
      audit: {
        summary: "已提交本地任务",
        lastEvent: {
          module: "conversation",
          detail: normalizedMessage,
          timestamp: "queued",
          source: "composer_submit"
        }
      },
      error: null
    },
    {
      sessionCount: payload.preserveExistingUserMessage
        ? state.storage.sessionCount
        : state.storage.sessionCount + 1
    }
  );

  if (payload.preserveExistingUserMessage) {
    return queuedState;
  }

  return recordRollbackEntry(
    queuedState,
    nextTaskId,
    "会话输入",
    `提交本地任务：${normalizedMessage}`,
    "session"
  );
}

export function createAssistantPlanningFailedState(
  state: WorkbenchState,
  payload: {
    message: string;
    detail: string;
    actionLabel?: string;
    source?: string;
  }
): WorkbenchState {
  const normalizedMessage = payload.message.trim();
  const planningFailureId = createWorkbenchEventId(state, "assistant-planning", "failed");
  const source = payload.source ?? "local_assistant_planner";
  const recoveryNarrative = getShellDialogRecoveryNarrative();
  const actionLabel =
    payload.actionLabel
    ?? [
      "Review planner routing, rewrite the request, or restart from a readonly preview before retrying.",
      recoveryNarrative
    ].join("\n");
  const traceLines = [
    `Input summary: ${normalizedMessage || "(empty)"}`,
    `Planner failure detail: ${payload.detail}`,
    `Planner recovery hint: ${actionLabel}`,
    "No local task was queued and no command was executed.",
    `Recovery visibility: rollback preview is available for this planning failure; rollback snapshot id: ${planningFailureId}.`,
    "Recovery visibility: audit trail keeps the input summary and planner error detail.",
    recoveryNarrative
  ];
  const traceDetail = traceLines.join(" ");
  const userSummary = "本地助手暂时无法理解这次请求，未排队、未执行任何命令。";
  const userRecovery = "请改写得更具体，或从只读预览重新开始。";

  return recordRollbackEntry(
    withStorageDelta(
      {
        ...state,
        output: {
          title: "本地助手规划失败",
          summary: `${userSummary}${userRecovery}`
        },
        conversation: {
          entries: prependConversationEntry(state.conversation.entries, {
            id: planningFailureId,
            kind: "system",
            title: "本地助手规划失败",
            summary: userSummary,
            actionLabel: "预览回退到这次规划失败前",
            rollbackTargetId: planningFailureId,
            detailLines: ["Module: tasks", `Source: ${source}`, `Suggestion: ${actionLabel}`, ...traceLines]
          })
        },
        audit: {
          summary: "Local assistant planning failed",
          lastEvent: {
            module: "tasks",
            detail: traceDetail,
            timestamp: "failed",
            source
          }
        },
        error: {
          module: "tasks",
          summary: "Local assistant planning failed",
          detail: traceDetail,
          actionLabel,
          timestamp: "failed",
          source
        }
      },
      {
        sessionCount: state.storage.sessionCount + 1
      }
    ),
    planningFailureId,
    "Local assistant planning failed",
    traceDetail,
    "session"
  );
}

export function createDuplicatePlanningFailureSkippedState(
  state: WorkbenchState,
  payload: {
    message: string;
  }
): WorkbenchState {
  const normalizedMessage = payload.message.trim();
  const duplicateId = createWorkbenchEventId(state, "assistant-planning", "duplicate-skipped");
  const previousFailureDetail = state.error?.detail ?? state.audit.lastEvent.detail;
  const conciseSummary =
    "相同请求刚刚发生规划失败，已跳过重复规划。请查看上一条失败详情、改写请求，或从只读预览重新开始。";
  const detailLines = [
    `Input summary: ${normalizedMessage || "(empty)"}`,
    "相同请求刚刚发生规划失败，未再次调用 planner，也未排队或执行命令。",
    "建议：查看上一条规划失败详情，改写请求，或从只读预览重新开始。",
    `Previous planner failure detail: ${previousFailureDetail}`,
    `Recovery visibility: rollback preview is available for this duplicate planning skip; rollback snapshot id: ${duplicateId}.`,
    "Recovery visibility: audit trail keeps the skipped input and previous planner failure detail."
  ];
  const detail = detailLines.join(" ");

  return recordRollbackEntry(
    withStorageDelta(
      {
        ...state,
        output: {
          title: "重复规划失败已跳过",
          summary: conciseSummary
        },
        conversation: {
          entries: prependConversationEntry(state.conversation.entries, {
            id: duplicateId,
            kind: "system",
            title: "重复规划失败已跳过",
            summary: normalizedMessage || "(empty)",
            actionLabel: "预览回退到本次重复规划跳过前",
            rollbackTargetId: duplicateId,
            detailLines: ["Module: tasks", "Source: local_assistant_planner_duplicate_skipped", ...detailLines]
          })
        },
        audit: {
          summary: "重复规划失败已跳过",
          lastEvent: {
            module: "tasks",
            detail,
            timestamp: "skipped",
            source: "local_assistant_planner_duplicate_skipped"
          }
        }
      },
      {
        sessionCount: state.storage.sessionCount
      }
    ),
    duplicateId,
    "重复规划失败已跳过",
    detail,
    "session"
  );
}

export function createTaskExecutionStartedState(state: WorkbenchState): WorkbenchState {
  const activeTask = state.tasks.activeTaskId
    ? state.tasks.items.find((item) => item.id === state.tasks.activeTaskId)
    : null;

  if (state.tasks.activeTaskId && activeTask?.status === "running") {
    return state;
  }

  const nextTask = state.tasks.items.find((item) => item.status === "queued");

  if (!nextTask) {
    return state;
  }

  const staleActiveTraceLines = state.tasks.activeTaskId
    ? [
        `Recovered stale active local task slot: ${state.tasks.activeTaskId}`,
        activeTask ? `Stale active task status: ${activeTask.status}` : "Stale active task record was missing."
      ]
    : [];
  const taskEventId = createTaskEventId(state, nextTask.id, "running");
  const startFailureTraceLines = [
    nextTask.lastFailureSource ? `Previous failure source: ${nextTask.lastFailureSource}` : null,
    nextTask.lastFailureSummary ? `Previous failure summary: ${nextTask.lastFailureSummary}` : null,
    nextTask.lastFailureDetail ? `Previous failure detail: ${nextTask.lastFailureDetail}` : null,
    nextTask.lastFailureActionLabel ? `Previous failure recovery hint: ${nextTask.lastFailureActionLabel}` : null
  ].filter((line): line is string => line !== null);
  const startAuditDetail = [nextTask.summary, ...staleActiveTraceLines, ...startFailureTraceLines].join(" ");
  const startOutputSummary = [
    "正在使用本地助手处理当前请求",
    staleActiveTraceLines.length > 0 ? STALE_ACTIVE_TASK_RECOVERY_SUMMARY : null,
    startFailureTraceLines.length > 0 ? PREVIOUS_FAILURE_DIAGNOSTICS_SUMMARY : null
  ].filter((line): line is string => line !== null).join(" ");

  return recordRollbackEntry(
    withStorageDelta(
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
          summary: startOutputSummary
        },
        audit: {
          summary: "本地任务开始执行",
          lastEvent: {
            module: "tasks",
            detail: startAuditDetail,
            timestamp: "running",
            source: "local_task_runner"
          }
        },
        error: null
      },
      {
        logCount: state.storage.logCount + 1
      }
    ),
    taskEventId,
    "本地任务开始执行",
    `开始执行本地任务：${nextTask.summary}`,
    "tool"
  );
}

export function createStaleActiveTaskSlotRecoveredState(state: WorkbenchState): WorkbenchState {
  if (!state.tasks.activeTaskId) {
    return state;
  }

  const activeTask = state.tasks.items.find((item) => item.id === state.tasks.activeTaskId);

  if (activeTask?.status === "running") {
    return state;
  }

  const taskEventId = createWorkbenchEventId(state, state.tasks.activeTaskId, "stale-active-recovered");
  const queuedCount = state.tasks.items.filter((item) => item.status === "queued").length;
  const recoveryTraceLines = [
    `Recovered stale active local task slot: ${state.tasks.activeTaskId}`,
    activeTask ? `Stale active task status: ${activeTask.status}` : "Stale active task record was missing.",
    queuedCount > 0
      ? `Queued local tasks remain available for the next scheduler pass: ${queuedCount}.`
      : "No queued local task was available to start."
  ];
  const recoveryTraceDetail = recoveryTraceLines.join(" ");

  return recordRollbackEntry(
    withStorageDelta(
      {
        ...state,
        tasks: {
          pendingCount: queuedCount,
          activeTaskId: null,
          items: state.tasks.items
        },
        output: {
          title: "本地任务队列已恢复",
          summary: `${STALE_ACTIVE_TASK_RECOVERY_SUMMARY}${STALE_ACTIVE_TASK_DIAGNOSTICS_SUMMARY}`
        },
        conversation: {
          entries: prependConversationEntry(state.conversation.entries, {
            id: taskEventId,
            kind: "system",
            title: "本地任务队列已恢复",
            summary: "已清理失效的本地任务占用状态。",
            detailLines: ["模块：tasks", "来源：local_task_stale_active_recovered", ...recoveryTraceLines]
          })
        },
        audit: {
          summary: "本地任务队列已恢复",
          lastEvent: {
            module: "tasks",
            detail: recoveryTraceDetail,
            timestamp: "recovered",
            source: "local_task_stale_active_recovered"
          }
        },
        error: null
      },
      {
        logCount: state.storage.logCount + 1
      }
    ),
    taskEventId,
    "本地任务队列已恢复",
    recoveryTraceDetail,
    "tool"
  );
}

export function createTaskExecutionSucceededState(
  state: WorkbenchState,
  payload: {
    resultTitle: string;
    resultSummary: string;
    auditDetailLines?: string[];
    auditOnlyDetailLines?: string[];
    searchSources?: WorkbenchState["sources"]["items"];
    searchStatePatch?: Partial<WorkbenchState["search"]>;
    searchFallbackNotice?: {
      visible: boolean;
      summary: string;
    };
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

  if (activeTask.status !== "running") {
    return state;
  }

  const taskEventId = createTaskEventId(state, activeTaskId, "completed");
  const visibleCompletionTraceLines = [
    `Input summary: ${activeTask.summary}`,
    activeTask.executionKind ? `Execution kind: ${activeTask.executionKind}` : null,
    activeTask.executionTitle ? `Execution title: ${activeTask.executionTitle}` : null,
    activeTask.executionAuditDetail ? `Execution audit detail: ${activeTask.executionAuditDetail}` : null,
    activeTask.lastFailureSource ? `Previous failure source: ${activeTask.lastFailureSource}` : null,
    activeTask.lastFailureSummary ? `Previous failure summary: ${activeTask.lastFailureSummary}` : null,
    activeTask.lastFailureDetail ? `Previous failure detail: ${activeTask.lastFailureDetail}` : null,
    activeTask.lastFailureActionLabel ? `Previous failure recovery hint: ${activeTask.lastFailureActionLabel}` : null,
    ...(payload.auditDetailLines ?? []),
    ...(payload.searchSources ?? []).map((source) =>
      [
        `搜索来源：标题=${source.title}；来源=${source.sourceLabel || source.provider}；查询=${source.query}；地址=${source.url}；摘要=${source.summary}`,
        source.factSnippets?.length
          ? `；事实片段=${source.factSnippets.join("｜")}`
          : ""
      ].join("")
    ),
    `Result summary: ${payload.resultSummary}`
  ].filter((line): line is string => line !== null);
  const completionTraceLines = [
    ...visibleCompletionTraceLines,
    ...(payload.auditOnlyDetailLines ?? [])
  ].filter((line): line is string => line !== null);
  const completionTraceDetail = completionTraceLines.join(" ");

  return recordRollbackEntry(
    withStorageDelta(
      {
        ...state,
        search: {
          ...state.search,
          ...(payload.searchStatePatch ?? {})
        },
        sources: payload.searchSources
          ? {
              items: payload.searchSources.slice(0, 6)
            }
          : state.sources,
        tasks: {
          pendingCount: state.tasks.pendingCount,
          activeTaskId: null,
          items: state.tasks.items.map((item) =>
            item.id === activeTaskId
              ? {
                  ...item,
                  status: "completed" as const,
                  lastFailureSource: undefined,
                  lastFailureSummary: undefined,
                  lastFailureDetail: undefined,
                  lastFailureActionLabel: undefined
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
            id: `${taskEventId}-assistant`,
            kind: "assistant",
            title: payload.resultTitle,
            summary: payload.searchFallbackNotice?.visible
              ? `${payload.resultSummary}\n\n${payload.searchFallbackNotice.summary}`
              : payload.resultSummary,
            actionLabel: "预览回退到本次任务执行前",
            rollbackTargetId: taskEventId,
            detailLines: visibleCompletionTraceLines
          })
        },
        audit: {
          summary: activeTask.executionAuditSummary ?? "本地任务执行完成",
          lastEvent: {
            module: "tasks",
            detail: completionTraceDetail,
            timestamp: "completed",
            source: "local_task_runner"
          }
        },
        error: null
      },
      {
        logCount: state.storage.logCount + 1
      }
    ),
    taskEventId,
    "本地任务执行完成",
    `完成本地任务：${activeTask.summary}`,
    "tool"
  );
}

export function createTaskExecutionProgressState(
  state: WorkbenchState,
  payload: {
    taskId: string;
    progressSummary: string;
  }
): WorkbenchState {
  const normalizedProgressSummary = payload.progressSummary.trim();
  const activeTask = state.tasks.items.find((item) =>
    item.id === payload.taskId
    && item.status === "running"
    && isLocalModelGenerationTaskKind(item.executionKind)
  );

  if (!activeTask || !normalizedProgressSummary || activeTask.progressSummary === normalizedProgressSummary) {
    return state;
  }

  return {
    ...state,
    tasks: {
      ...state.tasks,
      items: state.tasks.items.map((item) =>
        item.id === activeTask.id
          ? {
              ...item,
              progressSummary: normalizedProgressSummary
            }
          : item
      )
    },
    output: {
      title: "本地模型生成中",
      summary: normalizedProgressSummary
    },
    audit: {
      summary: "本地模型仍在生成",
      lastEvent: {
        module: "tasks",
        detail: `Input summary: ${activeTask.summary}. Progress: ${normalizedProgressSummary}`,
        timestamp: "running",
        source: "local_model_chat_progress"
      }
    }
  };
}

export function createTaskExecutionStreamingChunkState(
  state: WorkbenchState,
  payload: {
    taskId: string;
    chunk: string;
  }
): WorkbenchState {
  const activeTask = state.tasks.items.find((item) =>
    item.id === payload.taskId
    && item.status === "running"
    && isLocalModelGenerationTaskKind(item.executionKind)
  );

  if (!activeTask) {
    return state;
  }

  if (!activeTask.streamingSummary && !payload.chunk.trim()) {
    return state;
  }

  const streamingSummary = activeTask.streamingSummary
    ? `${activeTask.streamingSummary}${payload.chunk}`
    : payload.chunk.trimStart();

  if (!streamingSummary || streamingSummary === activeTask.streamingSummary) {
    return state;
  }

  return {
    ...state,
    tasks: {
      ...state.tasks,
      items: state.tasks.items.map((item) =>
        item.id === activeTask.id
          ? {
              ...item,
              streamingSummary
            }
          : item
      )
    },
    output: {
      title: "本地模型生成中",
      summary: streamingSummary
    }
  };
}

export function createTaskMissingExecutionKindFailedState(state: WorkbenchState): WorkbenchState {
  return createTaskExecutionFailedState(state, {
    summary: "本地任务缺少执行类型",
    detail:
      "The active local task did not include an execution kind, so opencow stopped instead of fabricating a fixed assistant reply.",
    actionLabel: "请改写请求后重新提交；如果反复出现，请查看任务规划日志并让 opencow 先自检本地助手路由。",
    source: "local_task_missing_execution_kind"
  });
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

  if (activeTask.status !== "running") {
    return state;
  }

  const reachedAttemptLimit = activeTask.attemptCount >= MAX_LOCAL_TASK_ATTEMPTS;
  const normalizedPayload =
    payload.source === "local_task_attempt_guard" || reachedAttemptLimit
      ? {
          ...payload,
          summary: "Local task retry limit reached and execution was stopped",
          detail:
            payload.source === "local_task_attempt_guard"
              ? payload.detail
              : `Task exceeded the maximum retry limit of ${MAX_LOCAL_TASK_ATTEMPTS} attempts. Last failure: ${payload.detail}`,
          actionLabel:
            "Repeated execution was stopped to avoid a retry loop. Review the latest failure detail, simplify the request, or help opencow restore the missing dependency or permission before retrying again.",
          source: "local_task_attempt_guard"
        }
      : payload;

  const taskEventId = createTaskEventId(state, activeTaskId, "failed");
  const recoveryVisibilityLines = [
    `Recovery visibility: rollback preview is available for this failed task; rollback snapshot id: ${taskEventId}.`,
    "Recovery visibility: audit trail keeps the input, execution kind, execution title, audit detail, and failure detail."
  ];
  const executionTraceLines = [
    `Input summary: ${activeTask.summary}`,
    `Attempt: ${activeTask.attemptCount}/${MAX_LOCAL_TASK_ATTEMPTS}`,
    activeTask.executionKind ? `Execution kind: ${activeTask.executionKind}` : null,
    activeTask.executionTitle ? `Execution title: ${activeTask.executionTitle}` : null,
    activeTask.executionAuditDetail ? `Execution audit detail: ${activeTask.executionAuditDetail}` : null,
    `Failure detail: ${normalizedPayload.detail}`,
    `Recovery hint: ${normalizedPayload.actionLabel}`,
    ...recoveryVisibilityLines
  ].filter((line): line is string => line !== null);
  const executionTraceDetail = executionTraceLines.join(". ");
  const failureOutputSummary = `${normalizedPayload.actionLabel} 完整失败详情已保留在日志和展开详情中。`;

  return recordRollbackEntry(
    withStorageDelta(
      {
        ...state,
        tasks: {
          pendingCount: state.tasks.pendingCount,
          activeTaskId: null,
          items: state.tasks.items.map((item) =>
            item.id === activeTaskId
              ? {
                  ...item,
                  status: "failed" as const,
                  lastFailureSource: normalizedPayload.source,
                  lastFailureSummary: normalizedPayload.summary,
                  lastFailureDetail: normalizedPayload.detail,
                  lastFailureActionLabel: normalizedPayload.actionLabel
                }
              : item
          )
        },
        output: {
          title: normalizedPayload.summary,
          summary: failureOutputSummary
        },
        conversation: {
          entries: prependConversationEntry(state.conversation.entries, {
            id: taskEventId,
            kind: "system",
            title: normalizedPayload.summary,
            summary: activeTask.summary,
            actionLabel: "预览回退到本次任务失败记录",
            rollbackTargetId: taskEventId,
            detailLines: [
              "模块：tasks",
              `来源：${normalizedPayload.source}`,
              `建议：${normalizedPayload.actionLabel}`,
              ...executionTraceLines
            ]
          })
        },
        audit: {
          summary: normalizedPayload.summary,
          lastEvent: {
            module: "tasks",
            detail: executionTraceDetail,
            timestamp: "failed",
            source: normalizedPayload.source
          }
        },
        error: {
          module: "tasks",
          summary: normalizedPayload.summary,
          detail: executionTraceDetail,
          actionLabel: normalizedPayload.actionLabel,
          timestamp: "failed",
          source: normalizedPayload.source
        }
      },
      {
        logCount: state.storage.logCount + 1
      }
    ),
    taskEventId,
    "本地任务执行失败",
    `本地任务执行失败：${activeTask.summary}`,
    "tool"
  );
}

export function createTaskExecutionRetriedState(state: WorkbenchState, taskId?: string): WorkbenchState {
  const failedTask = state.tasks.items.find((item) =>
    taskId ? item.id === taskId && item.status === "failed" : item.status === "failed"
  );

  if (!failedTask) {
    return state;
  }

  if (
    failedTask.attemptCount >= MAX_LOCAL_TASK_ATTEMPTS
    && state.audit.lastEvent.source === "local_task_attempt_guard"
  ) {
    return state;
  }

  if (failedTask.attemptCount >= MAX_LOCAL_TASK_ATTEMPTS) {
    return recordRetryLimitReachedState(state, failedTask.id);
  }

  const taskEventId = createTaskEventId(state, failedTask.id, "retried");
  const retryFailureTraceLines = [
    failedTask.lastFailureSource ? `Previous failure source: ${failedTask.lastFailureSource}` : null,
    failedTask.lastFailureSummary ? `Previous failure summary: ${failedTask.lastFailureSummary}` : null,
    failedTask.lastFailureDetail ? `Previous failure detail: ${failedTask.lastFailureDetail}` : null,
    failedTask.lastFailureActionLabel ? `Previous failure recovery hint: ${failedTask.lastFailureActionLabel}` : null
  ].filter((line): line is string => line !== null);
  const retryAuditDetail = [failedTask.summary, ...retryFailureTraceLines].join(" ");
  const retryOutputSummary = [
    `当前有 ${state.tasks.pendingCount + 1} 条待处理任务`,
    retryFailureTraceLines.length > 0 ? PREVIOUS_FAILURE_DIAGNOSTICS_SUMMARY : null
  ].filter((line): line is string => line !== null).join(" ");

  return recordRollbackEntry(
    withStorageDelta(
      {
        ...state,
        tasks: {
          pendingCount: state.tasks.pendingCount + 1,
          activeTaskId: null,
          items: state.tasks.items.map((item) =>
            item.id === failedTask.id
              ? {
                  ...item,
                  status: "queued" as const,
                  progressSummary: undefined,
                  streamingSummary: undefined
                }
              : item
          )
        },
        output: {
          title: "本地任务队列",
          summary: retryOutputSummary
        },
        conversation: {
          entries: prependConversationEntry(state.conversation.entries, {
            id: taskEventId,
            kind: "system",
            title: "已重试本地任务",
            summary: failedTask.summary,
            detailLines: [
              "模块：tasks",
              "来源：local_task_retry",
              "任务已重新加入队列",
              ...retryFailureTraceLines
            ]
          })
        },
        audit: {
          summary: "已重试本地任务",
          lastEvent: {
            module: "tasks",
            detail: retryAuditDetail,
            timestamp: "retried",
            source: "local_task_retry"
          }
        },
        error: null
      },
      {
        logCount: state.storage.logCount + 1
      }
    ),
    taskEventId,
    "本地任务重试",
    `重新加入本地任务队列：${failedTask.summary}`,
    "tool"
  );
}

function recordRetryLimitReachedState(state: WorkbenchState, taskId: string): WorkbenchState {
  const failedTask = state.tasks.items.find((item) => item.id === taskId);

  if (!failedTask) {
    return state;
  }

  return createTaskExecutionFailedState(
    {
      ...state,
      tasks: {
        ...state.tasks,
        activeTaskId: failedTask.id
      }
    },
    {
      summary: "Local task retry limit reached and execution was stopped",
      detail: `Task exceeded the maximum retry limit of ${MAX_LOCAL_TASK_ATTEMPTS} attempts.`,
      actionLabel:
        "Repeated execution was stopped to avoid a retry loop. Review the latest failure detail, simplify the request, or help opencow restore the missing dependency or permission before retrying again.",
      source: "local_task_attempt_guard"
    }
  );
}

export function createTaskExecutionCancelledState(state: WorkbenchState): WorkbenchState {
  const activeTaskId = state.tasks.activeTaskId;

  if (!activeTaskId) {
    return state;
  }

  const activeTask = state.tasks.items.find((item) => item.id === activeTaskId);

  if (!activeTask) {
    return createStaleActiveTaskSlotRecoveredState(state);
  }

  if (activeTask.status !== "running") {
    return createStaleActiveTaskSlotRecoveredState(state);
  }

  const taskEventId = createTaskEventId(state, activeTaskId, "cancelled");
  const cancellationRecoveryVisibilityLines = [
    `Recovery visibility: rollback preview is available for this cancelled task; rollback snapshot id: ${taskEventId}.`,
    "Recovery visibility: audit trail keeps the input, attempt count, execution kind, execution title, audit detail, and cancellation detail."
  ];
  const cancellationFailureTraceLines = [
    activeTask.lastFailureSource ? `Previous failure source: ${activeTask.lastFailureSource}` : null,
    activeTask.lastFailureSummary ? `Previous failure summary: ${activeTask.lastFailureSummary}` : null,
    activeTask.lastFailureDetail ? `Previous failure detail: ${activeTask.lastFailureDetail}` : null,
    activeTask.lastFailureActionLabel ? `Previous failure recovery hint: ${activeTask.lastFailureActionLabel}` : null
  ].filter((line): line is string => line !== null);
  const cancellationTraceLines = [
    `Input summary: ${activeTask.summary}`,
    `Attempt: ${activeTask.attemptCount}/${MAX_LOCAL_TASK_ATTEMPTS}`,
    activeTask.executionKind ? `Execution kind: ${activeTask.executionKind}` : null,
    activeTask.executionTitle ? `Execution title: ${activeTask.executionTitle}` : null,
    activeTask.executionAuditDetail ? `Execution audit detail: ${activeTask.executionAuditDetail}` : null,
    ...cancellationFailureTraceLines,
    "No further local execution was started after cancellation.",
    ...cancellationRecoveryVisibilityLines
  ].filter((line): line is string => line !== null);
  const cancellationTraceDetail = cancellationTraceLines.join(" ");
  const cancellationErrorDetail = `${cancellationTraceDetail} The task was stopped by the user and the queue was unlocked for a narrower retry or rewritten request.`;
  const cancellationOutputSummary = [
    "本地任务已停止，未继续执行本地任务。",
    cancellationFailureTraceLines.length > 0 ? PREVIOUS_FAILURE_DIAGNOSTICS_SUMMARY : null,
    "取消详情已保留在日志和展开详情中。"
  ].filter((line): line is string => line !== null).join(" ");

  return recordRollbackEntry(
    withStorageDelta(
      {
        ...state,
        tasks: {
          pendingCount: state.tasks.pendingCount,
          activeTaskId: null,
          items: state.tasks.items.map((item) =>
            item.id === activeTaskId
              ? {
                  ...item,
                  status: "cancelled" as const
                }
              : item
          )
        },
        output: {
          title: "本地任务已停止",
          summary: cancellationOutputSummary
        },
        conversation: {
          entries: prependConversationEntry(state.conversation.entries, {
            id: taskEventId,
            kind: "system",
            title: "本地任务已停止",
            summary: activeTask.summary,
            actionLabel: "预览回退到本次任务停止记录",
            rollbackTargetId: taskEventId,
            detailLines: [
              "模块：tasks",
              "来源：local_task_cancelled",
              "可稍后重新排队执行",
              ...cancellationTraceLines
            ]
          })
        },
        audit: {
          summary: "本地任务已停止",
          lastEvent: {
            module: "tasks",
            detail: cancellationTraceDetail,
            timestamp: "cancelled",
            source: "local_task_cancelled"
          }
        },
        error: {
          module: "tasks",
          summary: "本地任务已停止",
          detail: cancellationErrorDetail,
          actionLabel: "Rewrite the request, retry explicitly after review, or submit a smaller readonly diagnostic task.",
          timestamp: "cancelled",
          source: "local_task_cancelled"
        }
      },
      {
        logCount: state.storage.logCount + 1
      }
    ),
    taskEventId,
    "本地任务已停止",
    `停止本地任务：${activeTask.summary}`,
    "tool"
  );
}
