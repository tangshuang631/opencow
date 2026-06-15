import { Bot, LoaderCircle, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { WorkbenchState } from "../workbenchState";
import {
  getLocalizedPermissionReason,
  getVisibleLocalTaskFailureActionLabel,
  getVisibleLocalTaskFailureDetail,
  getVisibleLocalTaskFailureTitle,
  isLocalAssistantPlannerFailureSource,
  normalizeWorkbenchText
} from "../workbenchText";

type MainConversationProps = {
  state: WorkbenchState;
  onPreviewRollback: (targetEntryId: string) => void;
  onCancelActiveTask: () => void;
};

const TEXT = {
  conversation: "会话",
  rollbackToUserMessage: "回退到这条消息之前",
  user: "你",
  system: "系统",
  thinkingTitle: "助手处理中",
  localModelThinkingTitle: "Ollama 正在生成",
  npcConfigThinkingTitle: "Ollama 正在生成 NPC 配置",
  queuedLabel: "已进入本地任务队列",
  runningLabel: "正在本地执行链中处理",
  localModelRunningLabel: "正在等待本地模型输出",
  npcConfigRunningLabel: "正在等待本地模型生成 NPC 配置",
  localModelSlowStartHint: "本地模型首轮响应可能较慢，OpenCow 会保持界面响应，并持续等待真实输出返回。"
} as const;

const LONG_TEXT_LIMIT = 220;
const LONG_TITLE_LIMIT = 80;
const COMPRESSED_CONVERSATION_ENTRY_ID = "conversation-auto-summary";
const SUCCESS_TRACE_PREFIXES = [
  "Input summary:",
  "Execution kind:",
  "Execution title:",
  "Execution audit detail:",
  "Ollama model:",
  "Ollama done reason:",
  "Search context items:",
  "Search context status:",
  "Search provider:",
  "Result summary:"
];

function isLocalTaskExecutionErrorSource(source: string) {
  return source === "local_task_runner"
    || source === "local_task_timeout"
    || source === "local_task_attempt_guard"
    || source === "local_model_chat_runner"
    || source === "local_task_missing_execution_kind"
    || source === "opencow_self_repair_failure_analysis";
}

function getVisibleDetailLines(entry: WorkbenchState["conversation"]["entries"][number]) {
  const detailLines = entry.detailLines ?? [];

  if (
    isDuplicatePendingApprovalSkippedEntry(entry)
    || isDuplicateLocalTaskSkippedEntry(entry)
    || isDuplicatePlanningFailureSkippedEntry(entry)
  ) {
    return [];
  }

  if (entry.kind !== "assistant") {
    return detailLines;
  }

  return detailLines.filter(
    (line) => !SUCCESS_TRACE_PREFIXES.some((prefix) => line.startsWith(prefix))
  );
}

function isDuplicatePendingApprovalSkippedEntry(entry: WorkbenchState["conversation"]["entries"][number]) {
  return entry.detailLines?.some((line) => line === "Source: duplicate_pending_approval_skipped") ?? false;
}

function isDuplicatePlanningFailureSkippedEntry(entry: WorkbenchState["conversation"]["entries"][number]) {
  return entry.detailLines?.some((line) => line === "Source: local_assistant_planner_duplicate_skipped") ?? false;
}

function isDuplicateLocalTaskSkippedEntry(entry: WorkbenchState["conversation"]["entries"][number]) {
  return entry.title === "重复任务已跳过"
    && (entry.detailLines?.some((line) => line.startsWith("Existing task status:")) ?? false);
}

function isVisibleSystemEntry(entry: WorkbenchState["conversation"]["entries"][number]) {
  return entry.id === COMPRESSED_CONVERSATION_ENTRY_ID
    || isDuplicatePendingApprovalSkippedEntry(entry)
    || isDuplicateLocalTaskSkippedEntry(entry)
    || isDuplicatePlanningFailureSkippedEntry(entry);
}

function getVisibleSummary(entry: WorkbenchState["conversation"]["entries"][number]) {
  if (entry.title === "等待权限升级") {
    return getLocalizedPermissionReason(entry.summary);
  }

  if (isDuplicateLocalTaskSkippedEntry(entry)) {
    return getVisibleDuplicateLocalTaskSkipSummary(entry);
  }

  if (isDuplicatePlanningFailureSkippedEntry(entry)) {
    return "\u76f8\u540c\u8bf7\u6c42\u521a\u521a\u53d1\u751f\u89c4\u5212\u5931\u8d25\uff0c\u5df2\u8df3\u8fc7\u91cd\u590d\u89c4\u5212\u3002\u8bf7\u6539\u5199\u8bf7\u6c42\uff0c\u6216\u4ece\u53ea\u8bfb\u9884\u89c8\u91cd\u65b0\u5f00\u59cb\u3002";
  }

  if (!isDuplicatePendingApprovalSkippedEntry(entry)) {
    return entry.summary;
  }

  const approvalType = getDuplicatePendingApprovalType(entry);

  if (approvalType === "permission" || entry.summary.includes("already waiting for permission approval")) {
    return "已有权限审批正在等待处理，已跳过这次重复请求。";
  }

  if (
    approvalType === "dangerous-confirmation" ||
    entry.summary.includes("already waiting for dangerous confirmation")
  ) {
    return "已有高风险确认正在等待处理，已跳过这次重复请求。";
  }

  return "已有能力变更确认正在等待处理，已跳过这次重复请求。";
}

function getDuplicatePendingApprovalType(entry: WorkbenchState["conversation"]["entries"][number]) {
  const approvalTypeLine = entry.detailLines
    ?.find((line) => line.startsWith("Approval type: ") || line.startsWith("审批类型: "));

  return approvalTypeLine
    ?.replace("Approval type: ", "")
    .replace("审批类型: ", "");
}

function getVisibleDuplicateLocalTaskSkipSummary(entry: WorkbenchState["conversation"]["entries"][number]) {
  const detailLines = entry.detailLines ?? [];

  if (detailLines.some((line) => line.includes("retry limit"))) {
    return "相同任务已经达到重试上限，请查看失败详情、改写请求，或先帮助 opencow 修复缺失依赖。";
  }

  if (detailLines.some((line) => line === "Existing task status: failed")) {
    return "相同任务已经失败，请先查看失败详情、点击重试本地任务，或改写请求。";
  }

  return "已有相同任务正在排队或执行，已跳过这次重复提交。";
}

function getVisibleTitle(entry: WorkbenchState["conversation"]["entries"][number], isUser: boolean) {
  if (isUser) {
    return TEXT.user;
  }

  if (isDuplicatePendingApprovalSkippedEntry(entry)) {
    return "已跳过重复审批请求";
  }

  if (isDuplicatePlanningFailureSkippedEntry(entry)) {
    return "\u91cd\u590d\u89c4\u5212\u5931\u8d25\u5df2\u8df3\u8fc7";
  }

  return entry.title;
}

function getVisibleErrorDetail(error: NonNullable<WorkbenchState["error"]>) {
  if (error.source === "local_task_cancelled") {
    return "停止记录已保留在日志和回退记录中。";
  }

  if (error.source === "local_task_attempt_guard") {
    return "重试上限记录已保留在日志和回退记录中。";
  }

  if (error.source === "local_model_chat_runner") {
    const failureDetail =
      error.detail.match(/Failure detail:\s*(.*?)(?:\.\s*Recovery hint:|\.\s*Recovery visibility:|$)/s)?.[1]?.trim()
      ?? error.detail;
    const visibleDetail = getVisibleLocalTaskFailureDetail(failureDetail, error.source);

    return visibleDetail.startsWith("Ollama error:") || failureDetail.includes("streamPhase=")
      ? visibleDetail
      : "本地模型本轮没有按时返回完整结果，详细诊断已保留在右侧任务详情和日志中。";
  }

  if (error.module === "permission" && error.source === "command_policy") {
    return normalizeWorkbenchText(error.detail);
  }

  if (error.module === "tools") {
    return "完整工具错误详情已保留在日志、错误详情和回退记录中。";
  }

  if (error.module !== "tasks") {
    return error.detail;
  }

  if (!isLocalTaskExecutionErrorSource(error.source) && !isLocalAssistantPlannerFailureSource(error.source)) {
    return normalizeWorkbenchText(error.detail);
  }

  const failureDetail =
    error.detail.match(/Failure detail:\s*(.*?)(?:\.\s*Recovery hint:|\.\s*Recovery visibility:|$)/s)?.[1]?.trim()
    ?? error.detail;

  return getVisibleLocalTaskFailureDetail(failureDetail, error.source);
}

function getVisibleErrorActionLabel(error: NonNullable<WorkbenchState["error"]>) {
  if (error.source === "local_task_cancelled") {
    return "任务已停止，未继续执行。可以改写请求、缩小范围，或确认后重新提交。";
  }

  if (error.source === "local_task_attempt_guard") {
    return "已停止重复执行，避免死循环。请查看失败详情、改写请求，或先帮助 opencow 修复缺失依赖。";
  }

  if (
    error.module === "tasks"
    && (isLocalTaskExecutionErrorSource(error.source) || isLocalAssistantPlannerFailureSource(error.source))
  ) {
    return getVisibleLocalTaskFailureActionLabel(error.actionLabel);
  }

  return normalizeWorkbenchText(error.actionLabel);
}

function getVisibleErrorTitle(error: NonNullable<WorkbenchState["error"]>) {
  if (error.module === "tasks") {
    return getVisibleLocalTaskFailureTitle(error.summary, error.source, error.detail);
  }

  return normalizeWorkbenchText(error.summary);
}

function getVisibleCancellationSummary(source: WorkbenchState["audit"]["lastEvent"]["source"]) {
  if (source === "permission_confirmation_cancelled") {
    return "高风险操作已取消，没有执行命令。";
  }

  if (source === "permission_mode_change_cancelled") {
    return "权限升级已取消，当前权限保持不变。";
  }

  return "能力变更已取消，当前设置保持不变。";
}

function createConversationHeader(entries: WorkbenchState["conversation"]["entries"]) {
  const latestFirstEntries = entries.slice().reverse();
  const latestUserEntry = latestFirstEntries.find((entry) => entry.kind === "user");
  const latestResultEntry = latestFirstEntries.find((entry) => entry.kind !== "user");
  const title = latestUserEntry?.summary.trim() || "";
  const resultTitle = latestResultEntry ? getVisibleTitle(latestResultEntry, false).trim() : "";
  const overview = resultTitle ? `概览：${resultTitle}` : "";

  if (!title) {
    return null;
  }

  return {
    title: isLongWorkbenchText(title) ? "长文本对话" : createCompactText(title, LONG_TITLE_LIMIT),
    overview
  };
}

function createCompactText(text: string, limit = LONG_TEXT_LIMIT) {
  const normalized = normalizeWorkbenchText(text).replace(/\s+/g, " ").trim();

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit).trimEnd()}…`;
}

function isLongWorkbenchText(text: string) {
  return normalizeWorkbenchText(text).trim().length > LONG_TEXT_LIMIT;
}

function isLocalModelPendingTask(executionKind: string | undefined) {
  return executionKind === "local-model-chat" || executionKind === "npc-config-write";
}

function CollapsibleWorkbenchText({
  text,
  isUser
}: {
  text: string;
  isUser: boolean;
}) {
  const normalized = normalizeWorkbenchText(text);
  const [expanded, setExpanded] = useState(false);

  if (!isUser || !isLongWorkbenchText(normalized)) {
    return <p className="message-summary">{normalized}</p>;
  }

  return (
    <div className="message-summary-group">
      <p className="message-summary message-summary-collapsed">
        {expanded ? normalized : createCompactText(normalized)}
      </p>
      <button
        className="message-expand-button"
        type="button"
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? "收起输入" : "展开完整输入"}
      </button>
    </div>
  );
}

function getRollbackTargetBeforeUserEntry(
  entry: WorkbenchState["conversation"]["entries"][number],
  state: WorkbenchState
) {
  if (entry.kind !== "user") {
    return null;
  }

  const submitRollbackId = entry.id.endsWith("-user")
    ? entry.id.slice(0, -"user".length - 1)
    : entry.rollbackTargetId;

  if (!submitRollbackId) {
    return null;
  }

  const submitRollbackIndex = state.rollback.entries.findIndex((rollbackEntry) => rollbackEntry.id === submitRollbackId);

  if (submitRollbackIndex < 0) {
    return null;
  }

  return state.rollback.entries[submitRollbackIndex + 1]?.id ?? null;
}

export function MainConversation({
  state,
  onPreviewRollback
}: MainConversationProps) {
  const activeTask = state.tasks.activeTaskId
    ? state.tasks.items.find((item) => item.id === state.tasks.activeTaskId) ?? null
    : null;
  const queuedTask = state.tasks.items.find((item) => item.status === "queued") ?? null;
  const pendingTask = activeTask ?? queuedTask;
  const hasPendingTask = pendingTask !== null;
  const isLocalModelPending = isLocalModelPendingTask(pendingTask?.executionKind);
  const isNpcConfigPending = pendingTask?.executionKind === "npc-config-write";
  const entries = state.conversation.entries.slice().reverse();
  const visibleEntries = entries.filter((entry) => {
    if (entry.kind === "system") {
      return isVisibleSystemEntry(entry);
    }

    return true;
  });
  const conversationHeader = createConversationHeader(visibleEntries);
  const showsCancellationRecovery = state.audit.lastEvent.source === "permission_confirmation_cancelled"
    || state.audit.lastEvent.source === "permission_mode_change_cancelled"
    || state.audit.lastEvent.source === "capability_toggle_cancelled";
  const showsActionableErrorRecovery = state.error !== null && state.error.module !== "ollama";
  const pendingStatusLabel = isLocalModelPending
    ? isNpcConfigPending
      ? TEXT.npcConfigRunningLabel
      : TEXT.localModelRunningLabel
    : activeTask
      ? TEXT.runningLabel
      : TEXT.queuedLabel;
  const pendingTitle = isLocalModelPending
    ? isNpcConfigPending
      ? TEXT.npcConfigThinkingTitle
      : TEXT.localModelThinkingTitle
    : TEXT.thinkingTitle;
  const pendingLocalModelProgress = isLocalModelPending
    ? pendingTask?.progressSummary?.trim() || TEXT.localModelSlowStartHint
    : "";

  return (
    <section className="conversation" aria-label={TEXT.conversation}>
      {conversationHeader ? (
        <header className="conversation-header">
          <div className="conversation-hero">
            <h1>{normalizeWorkbenchText(conversationHeader.title)}</h1>
            {conversationHeader.overview ? (
              <p className="conversation-subtitle">
                {normalizeWorkbenchText(conversationHeader.overview)}
              </p>
            ) : null}
          </div>
        </header>
      ) : null}
      <div className="conversation-scroll">
        {visibleEntries.map((entry) => {
          const isUser = entry.kind === "user";
          const visibleDetailLines = getVisibleDetailLines(entry);
          const userRollbackTargetId = getRollbackTargetBeforeUserEntry(entry, state);

          return (
            <article
              className={`message-row ${isUser ? "user-row message-row-user-bubble" : "assistant-row"}`}
              key={entry.id}
            >
              {isUser ? null : (
                <div className="message-avatar assistant-avatar">
                  <Bot aria-hidden="true" size={18} />
                </div>
              )}
              <div className={`message-body ${isUser ? "user-message-bubble" : ""}`}>
                {isUser ? null : (
                  <p className="message-title">
                    {normalizeWorkbenchText(getVisibleTitle(entry, isUser))}
                  </p>
                )}
                <CollapsibleWorkbenchText text={getVisibleSummary(entry)} isUser={isUser} />
                {visibleDetailLines.map((line) => (
                  <p className="message-detail" key={`${entry.id}-${line}`}>
                    {normalizeWorkbenchText(line)}
                  </p>
                ))}
                {userRollbackTargetId ? (
                  <button
                    aria-label={TEXT.rollbackToUserMessage}
                    className="message-rollback-action"
                    type="button"
                    onClick={() => onPreviewRollback(userRollbackTargetId)}
                  >
                    <RotateCcw aria-hidden="true" size={14} />
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}

        {showsCancellationRecovery ? (
          <article className="message-row assistant-row">
            <div className="message-avatar assistant-avatar">
              <Bot aria-hidden="true" size={18} />
            </div>
            <div className="message-body">
              <p className="message-title">{TEXT.system}</p>
              <p className="message-summary">
                {normalizeWorkbenchText(getVisibleCancellationSummary(state.audit.lastEvent.source))}
              </p>
            </div>
          </article>
        ) : null}

        {showsActionableErrorRecovery ? (
          <article className="message-row assistant-row">
            <div className="message-avatar assistant-avatar">
              <Bot aria-hidden="true" size={18} />
            </div>
            <div className="message-body">
              <p className="message-title">
                {state.error ? normalizeWorkbenchText(getVisibleErrorTitle(state.error)) : ""}
              </p>
              <p className="message-summary">
                {state.error ? normalizeWorkbenchText(getVisibleErrorActionLabel(state.error)) : ""}
              </p>
              {state.error ? (
                <p className="message-detail">{normalizeWorkbenchText(getVisibleErrorDetail(state.error))}</p>
              ) : null}
            </div>
          </article>
        ) : null}

        {hasPendingTask ? (
          <article
            aria-label="assistant-pending"
            aria-live="polite"
            className="message-row assistant-row thinking-row"
          >
            <div className="message-avatar assistant-avatar thinking-avatar">
              <LoaderCircle aria-hidden="true" className="thinking-spinner" size={18} />
            </div>
            <div className="message-body">
              <div className="thinking-header">
                <p className="message-title">{pendingTitle}</p>
                <span className="thinking-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
              {!isLocalModelPending ? (
                <div className="task-inline-panel">
                  <span className="task-inline-status">{pendingStatusLabel}</span>
                </div>
              ) : (
                <div className="thinking-summary-group">
                  <p className="message-summary">{pendingLocalModelProgress}</p>
                </div>
              )}
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
