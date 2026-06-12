import { FileText, Globe2, ListChecks, ScrollText } from "lucide-react";
import { useState } from "react";
import { RollbackPanel } from "./RollbackPanel";
import type { StorageCleanupTarget, WorkbenchState } from "../workbenchState";
import {
  getLocalizedPermissionModeLabel,
  getLocalizedPermissionReason,
  getLocalizedPermissionRiskSummary,
  getVisibleLocalTaskFailureActionLabel,
  getVisibleLocalTaskFailureDetail,
  getVisibleLocalTaskFailureTitle,
  isLocalAssistantPlannerFailureSource,
  normalizeWorkbenchText
} from "../workbenchText";

type InspectorProps = {
  state: WorkbenchState;
  onApproveDangerousAction: () => void;
  onCancelDangerousAction: () => void;
  onApprovePermissionRequest: () => void;
  onCancelPermissionRequest: () => void;
  onRetryOllamaCheck: () => void;
  onRecoverToolError: () => void;
  onPreviewRollback: (targetEntryId: string) => void;
  onApplyRollback: () => void;
  onCancelRollback: () => void;
  onRetryLocalTask: (taskId?: string) => void;
  onCancelActiveTask: () => void;
  onUpdateRollbackLimit: (limit: number) => void;
  onCleanupStorage: (target: StorageCleanupTarget) => void;
  onToggleRemoteApi: (enabled: boolean) => void;
  onToggleSearch: (enabled: boolean) => void;
  onSaveRemoteApiConfig: (payload: { baseUrl: string; providerLabel: string; apiKey: string }) => void;
  onSaveSearchProviderConfig: (payload: { providerLabel: string }) => void;
};

const TEXT = {
  panel: "\u53f3\u4fa7\u9762\u677f",
  output: "\u8f93\u51fa",
  sources: "\u6765\u6e90",
  sourceSummaryEmpty: "\u6682\u65e0\u5916\u90e8\u6765\u6e90\u3002\u6a21\u578b\u3001\u6743\u9650\u548c\u6765\u6e90\u660e\u7ec6\u6309\u9700\u5c55\u5f00\u3002",
  sourceSummaryPrefix: "\u5df2\u8bb0\u5f55",
  sourceSummarySuffix: "\u4e2a\u6765\u6e90\u3002\u6a21\u578b\u3001\u6743\u9650\u548c\u6765\u6e90\u660e\u7ec6\u6309\u9700\u5c55\u5f00\u3002",
  expandSourceStatus: "\u5c55\u5f00\u6765\u6e90\u4e0e\u72b6\u6001",
  sourceProvider: "\u641c\u7d22\u63d0\u4f9b\u65b9",
  sourceTitle: "\u6765\u6e90\u6807\u9898",
  sourceUrl: "\u6765\u6e90\u5730\u5740",
  records: "\u914d\u7f6e\u4e0e\u8bb0\u5f55",
  recordsSummary: "\u6765\u6e90\u3001\u65e5\u5fd7\u548c\u56de\u9000\u8bb0\u5f55\u5df2\u6536\u7eb3\uff0c\u914d\u7f6e\u5165\u53e3\u5728\u8bbe\u7f6e\u4e2d\u3002",
  expandRecords: "\u5c55\u5f00\u914d\u7f6e\u4e0e\u8bb0\u5f55",
  collapseRecords: "\u6536\u8d77\u914d\u7f6e\u4e0e\u8bb0\u5f55",
  permission: "\u6743\u9650",
  permissionPending: "\u5f85\u5207\u6362\u6743\u9650",
  permissionReason: "\u63d0\u6743\u539f\u56e0",
  permissionRisk: "\u98ce\u9669\u8bf4\u660e",
  approvePrivilege: "\u6279\u51c6\u63d0\u6743",
  cancelPrivilege: "\u53d6\u6d88\u63d0\u6743",
  noPermissionUpgrade: "\u5f53\u524d\u6ca1\u6709\u5f85\u786e\u8ba4\u7684\u6743\u9650\u5347\u7ea7",
  commandPreview: "\u547d\u4ee4\u9884\u89c8",
  impact: "\u5f71\u54cd\u8303\u56f4",
  requiredPermission: "\u6240\u9700\u6743\u9650",
  safety: "\u5b89\u5168\u4fdd\u62a4",
  approveDanger: "\u6279\u51c6\u9ad8\u98ce\u9669\u64cd\u4f5c",
  cancelDanger: "\u53d6\u6d88\u9ad8\u98ce\u9669\u64cd\u4f5c",
  noDanger: "\u5f53\u524d\u6ca1\u6709\u5f85\u786e\u8ba4\u7684\u9ad8\u98ce\u9669\u64cd\u4f5c",
  approveCapability: "\u6279\u51c6\u80fd\u529b\u53d8\u66f4",
  cancelCapability: "\u53d6\u6d88\u80fd\u529b\u53d8\u66f4",
  noCapability: "\u5f53\u524d\u6ca1\u6709\u5f85\u786e\u8ba4\u7684\u80fd\u529b\u53d8\u66f4",
  localTasks: "\u672c\u5730\u4efb\u52a1",
  taskPending: "\u5f85\u5904\u7406",
  taskUnit: "\u6761",
  taskAttempt: "Attempt",
  stopTask: "\u505c\u6b62\u4efb\u52a1",
  retryTask: "\u91cd\u8bd5\u672c\u5730\u4efb\u52a1",
  expandFailureDetails: "\u5c55\u5f00\u5931\u8d25\u7ec6\u8282",
  collapseFailureDetails: "\u6536\u8d77\u5931\u8d25\u7ec6\u8282",
  tools: "\u5de5\u5177",
  logs: "\u65e5\u5fd7",
  expandLogs: "\u5c55\u5f00\u65e5\u5fd7\u7ec6\u8282",
  module: "\u6a21\u5757",
  source: "\u6765\u6e90",
  time: "\u65f6\u95f4",
  errors: "\u9519\u8bef",
  suggestion: "\u5efa\u8bae",
  noErrors: "\u5f53\u524d\u6ca1\u6709\u6d3b\u52a8\u9519\u8bef",
  searchOn: "\u8054\u7f51\u641c\u7d22\u5df2\u5f00\u542f",
  searchOff: "\u8054\u7f51\u641c\u7d22\u9ed8\u8ba4\u5173\u95ed",
  running: "\u6267\u884c\u4e2d",
  completed: "\u5df2\u5b8c\u6210",
  failed: "\u5df2\u5931\u8d25",
  cancelled: "\u5df2\u53d6\u6d88",
  queued: "\u961f\u5217\u4e2d"
} as const;

const MAX_LOCAL_TASK_ATTEMPTS = 3;
const LONG_TASK_SUMMARY_LIMIT = 120;
const PENDING_APPROVAL_TEXT_LIMIT = 260;
const EMPTY_OUTPUT_TITLE = "暂无产物";
const EMPTY_OUTPUT_SUMMARY = "等待工具执行结果或本地产物摘要。";
const LOCAL_MODEL_CHAT_CONCISE_FAILURE_DETAIL =
  "本地模型本轮没有按时返回完整结果，详细诊断已保留在本地任务失败细节和日志中。";
const NPC_CONFIG_MODEL_CONCISE_FAILURE_DETAIL =
  "本地模型没有按时生成 NPC 配置，配置尚未写入；完整模型、输入长度和等待阶段诊断已保留在本地任务失败细节和日志中。";

function isLocalTaskExecutionErrorSource(source: string) {
  return source === "local_task_runner"
    || source === "local_task_timeout"
    || source === "local_task_attempt_guard"
    || source === "local_model_chat_runner"
    || source === "local_task_missing_execution_kind"
    || source === "opencow_self_repair_failure_analysis";
}

function isCompletedLocalModelChatTask(task: WorkbenchState["tasks"]["items"][number]) {
  return task.executionKind === "local-model-chat" && task.status === "completed";
}

function isLocalModelGenerationTask(task: WorkbenchState["tasks"]["items"][number] | undefined) {
  return Boolean(
    task
      && (task.executionKind === "local-model-chat" || task.executionKind === "npc-config-write")
  );
}

function shouldSuppressCompletedLocalModelChatOutput(state: WorkbenchState) {
  const latestTask = state.tasks.items[0];

  return Boolean(
    latestTask
      && isCompletedLocalModelChatTask(latestTask)
      && state.audit.lastEvent.source === "local_task_runner"
      && state.output.title === "本地模型答复"
  );
}

function shouldSuppressLocalModelChatProgressOutput(state: WorkbenchState) {
  const latestTask = state.tasks.items[0];

  return Boolean(
    latestTask
      && isLocalModelGenerationTask(latestTask)
      && (latestTask.status === "queued" || latestTask.status === "running")
      && state.audit.lastEvent.source === "local_model_chat_progress"
  );
}

function isPendingLocalModelChat(task: WorkbenchState["tasks"]["items"][number] | undefined) {
  return Boolean(
    task
      && isLocalModelGenerationTask(task)
      && (task.status === "queued" || task.status === "running")
  );
}

function getVisibleOutputTitle(state: WorkbenchState) {
  if (state.error?.source === "local_task_attempt_guard") {
    return "本地任务已达到重试上限";
  }

  if (state.audit.lastEvent.source === "composer_submit_deduplicated") {
    return "重复任务已跳过";
  }

  if (state.audit.lastEvent.source === "permission_confirmation_cancelled") {
    return "高风险操作已取消";
  }

  if (state.audit.lastEvent.source === "permission_mode_change_cancelled") {
    return "权限升级已取消";
  }

  if (state.audit.lastEvent.source === "capability_toggle_cancelled") {
    return "能力变更已取消";
  }

  if (
    state.error?.module === "tasks"
    && (isLocalTaskExecutionErrorSource(state.error.source) || isLocalAssistantPlannerFailureSource(state.error.source))
  ) {
    return getVisibleLocalTaskFailureTitle(state.error.summary, state.error.source, state.error.detail);
  }

  return state.output.title;
}

function getVisibleOutputSummary(state: WorkbenchState) {
  if (state.error?.module === "permission" && state.error.source === "command_policy") {
    return "命令已被安全策略阻止，详细原因已保留在错误、日志和回退记录中。";
  }

  if (state.error?.source === "local_task_cancelled") {
    return "任务已停止，未继续执行。可以改写请求、缩小范围，或确认后重新提交。";
  }

  if (state.error?.source === "local_task_attempt_guard") {
    return "已停止重复执行，避免死循环。请查看失败详情、改写请求，或先帮助 opencow 修复缺失依赖。";
  }

  if (state.audit.lastEvent.source === "composer_submit_deduplicated") {
    return getVisibleDuplicateLocalTaskSkipSummary(state.audit.lastEvent.detail);
  }

  if (state.audit.lastEvent.source === "permission_confirmation_cancelled") {
    return "没有执行命令。详细记录可在日志或回退记录中展开。";
  }

  if (state.audit.lastEvent.source === "permission_mode_change_cancelled") {
    return "当前权限保持不变。详细记录可在日志或回退记录中展开。";
  }

  if (state.audit.lastEvent.source === "capability_toggle_cancelled") {
    return "当前设置保持不变。详细记录可在日志或回退记录中展开。";
  }

  if (state.error?.module === "tasks") {
    if (state.error.source === "local_model_chat_runner") {
      if (isNpcConfigModelFailure(state.error.detail)) {
        return NPC_CONFIG_MODEL_CONCISE_FAILURE_DETAIL;
      }

      return LOCAL_MODEL_CHAT_CONCISE_FAILURE_DETAIL;
    }

    return `${getVisibleLocalTaskFailureActionLabel(state.error.actionLabel)} 完整失败详情已保留在错误、日志和展开详情中。`;
  }

  return getConciseVisibleOutputSummary(state.output.summary);
}

function getVisibleDuplicateLocalTaskSkipSummary(detail: string) {
  if (detail.includes("retry limit")) {
    return "相同任务已经达到重试上限，请查看失败详情、改写请求，或先帮助 opencow 修复缺失依赖。";
  }

  if (detail.includes("Existing task status: failed")) {
    return "相同任务已经失败，请先查看失败详情、点击重试本地任务，或改写请求。";
  }

  return "已有相同任务正在排队或执行，已跳过这次重复提交。";
}

function getPendingApprovalTextPreview(text: string) {
  const normalized = normalizeWorkbenchText(text).replace(/\s+/g, " ").trim();

  if (normalized.length <= PENDING_APPROVAL_TEXT_LIMIT) {
    return normalized;
  }

  return `${normalized.slice(0, PENDING_APPROVAL_TEXT_LIMIT).trim()}...`;
}

function getVisibleErrorDetail(error: NonNullable<WorkbenchState["error"]>) {
  if (error.source === "local_task_cancelled") {
    return "停止记录已保留在日志和回退记录中。";
  }

  if (error.source === "local_task_attempt_guard") {
    return "重试上限记录已保留在日志和回退记录中。";
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

  if (error.source === "local_model_chat_runner") {
    return getVisibleLocalModelChatFailureActionLabel(error.detail, error.actionLabel);
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

function getVisibleTaskFailureSummary(task: WorkbenchState["tasks"]["items"][number]) {
  return getVisibleLocalTaskFailureTitle(
    task.lastFailureSummary ?? "",
    task.lastFailureSource,
    task.lastFailureDetail ?? ""
  );
}

function getVisibleTaskFailureActionLabel(task: WorkbenchState["tasks"]["items"][number]) {
  if (task.lastFailureSource === "local_model_chat_runner") {
    return getVisibleLocalModelChatFailureActionLabel(task.lastFailureDetail ?? "", task.lastFailureActionLabel ?? "");
  }

  return getVisibleLocalTaskFailureActionLabel(task.lastFailureActionLabel ?? "");
}

function getVisibleLocalModelChatFailureActionLabel(detail: string, fallbackActionLabel: string) {
  const normalizedDetail = detail.toLowerCase();

  if (isNpcConfigModelFailure(detail) && normalizedDetail.includes("streamphase=waiting-first-chunk")) {
    return "NPC 配置生成卡在首轮输出前：配置还没有写入。请先缩短角色需求、拆分工具权限，或切换更快的 Ollama 模型后重试。";
  }

  if (isNpcConfigModelFailure(detail) && normalizedDetail.includes("streamphase=streaming")) {
    return "NPC 配置生成中途超时：配置还没有写入。请缩小 NPC 职责范围、要求分阶段生成，或切换更快模型后重试。";
  }

  if (normalizedDetail.includes("streamphase=waiting-first-chunk")) {
    return "本地模型首轮输出超时：请先确认 Ollama 进程仍在生成或切换更快模型；如果要继续同一任务，建议缩短输入、拆分目标，或重试本地任务。";
  }

  if (normalizedDetail.includes("streamphase=streaming")) {
    return "本地模型生成中途超时：请缩小本轮输出范围、要求分段回答，或切换更快模型后重试。";
  }

  if (
    normalizedDetail.includes("maximum execution time")
    || normalizedDetail.includes("timed out")
    || normalizedDetail.includes("local model chat diagnostics")
  ) {
    return "本地模型响应超时：长回答保护已启用；请确认 Ollama 仍在运行，切换更快模型，或减少单次输入长度后重试。";
  }

  return getVisibleLocalTaskFailureActionLabel(fallbackActionLabel);
}

function isNpcConfigModelFailure(detail: string) {
  return detail.toLowerCase().includes("executionkind=npc-config-write");
}

function getConciseVisibleOutputSummary(summary: string) {
  if (!summary.includes("Previous failure ")) {
    return summary;
  }

  const pendingCountMatch = summary.match(/^当前有\s+\d+\s+条待处理任务/);

  return pendingCountMatch
    ? `${pendingCountMatch[0]}。上次失败细节已收起，可在本地任务中展开。`
    : "上次失败细节已收起，可在本地任务或日志中展开。";
}

function isLongTaskSummary(summary: string) {
  return normalizeWorkbenchText(summary).trim().length > LONG_TASK_SUMMARY_LIMIT;
}

function getVisibleTaskSummary(task: WorkbenchState["tasks"]["items"][number]) {
  if (task.executionKind === "npc-config-write") {
    if (task.status === "queued" || task.status === "running") {
      return "正在生成 NPC 配置";
    }

    if (task.status === "failed") {
      return "NPC 配置生成失败，详情已收起到任务记录中。";
    }

    return "NPC 配置生成任务已结束。";
  }

  if (task.executionKind === "local-model-chat") {
    if (task.status === "queued" || task.status === "running") {
      return "正在生成";
    }

    if (task.status === "failed") {
      return "本地模型对话失败，详情已收起到任务记录中。";
    }

    return "本地模型任务已结束。";
  }

  if (isLongTaskSummary(task.summary)) {
    if (task.status === "failed") {
      return "这条长文本输入处理失败，完整原文保留在左侧对话和审计记录中。";
    }

    return "等待本地助手处理，不在右侧重复展示长输入。";
  }

  return normalizeWorkbenchText(task.summary);
}

export function Inspector({
  state,
  onApproveDangerousAction,
  onCancelDangerousAction,
  onApprovePermissionRequest,
  onCancelPermissionRequest,
  onRecoverToolError,
  onPreviewRollback,
  onApplyRollback,
  onCancelRollback,
  onRetryLocalTask,
  onCancelActiveTask
}: InspectorProps) {
  const visibleSources = state.sources.items.slice(0, 3);
  const visibleTasks = state.tasks.items.filter((task) => !isCompletedLocalModelChatTask(task)).slice(0, 3);
  const hasTaskAtAttemptLimit = state.tasks.items.some(
    (task) => task.status === "failed" && task.attemptCount >= MAX_LOCAL_TASK_ATTEMPTS
  );
  const pendingConfirmation = state.confirmation.pending;
  const hasPendingPermissionOrConfirmation = Boolean(state.permission.pendingModeChange || pendingConfirmation);
  const capabilityAuditSources = new Set([
    "capability_toggle_request",
    "capability_toggle_approved",
    "capability_toggle_cancelled"
  ]);
  const isCapabilityConfirmationContext = Boolean(pendingConfirmation?.requestedFeature)
    || capabilityAuditSources.has(state.audit.lastEvent.source);
  const [auditExpanded, setAuditExpanded] = useState(false);
  const [recordsExpanded, setRecordsExpanded] = useState(false);
  const [sourceStatusExpanded, setSourceStatusExpanded] = useState(false);
  const [expandedFailureTaskIds, setExpandedFailureTaskIds] = useState<Set<string>>(() => new Set());
  const visibleOutputTitle = getVisibleOutputTitle(state);
  const visibleOutputSummary = getVisibleOutputSummary(state);
  const shouldKeepInspectorQuietForLocalModelGeneration = Boolean(
    isPendingLocalModelChat(state.tasks.items[0])
      && !hasPendingPermissionOrConfirmation
      && !state.rollback.pendingPreview
      && !state.error
      && !state.tools.lastResult
  );
  const hasVisibleOutput =
    !shouldKeepInspectorQuietForLocalModelGeneration
    &&
    !shouldSuppressCompletedLocalModelChatOutput(state)
    && !shouldSuppressLocalModelChatProgressOutput(state)
    && (visibleOutputTitle !== EMPTY_OUTPUT_TITLE || visibleOutputSummary !== EMPTY_OUTPUT_SUMMARY);
  const visibleError = state.error?.module === "ollama" ? null : state.error;

  const sourceSection = (
    <section>
      <h2>
        <Globe2 aria-hidden="true" size={16} />
        {TEXT.sources}
      </h2>
      <p className="muted">
        {state.sources.items.length > 0
          ? `${TEXT.sourceSummaryPrefix} ${state.sources.items.length} ${TEXT.sourceSummarySuffix}`
          : TEXT.sourceSummaryEmpty}
      </p>
      <button
        className="inspector-disclosure-button"
        type="button"
        onClick={() => setSourceStatusExpanded((expanded) => !expanded)}
      >
        {TEXT.expandSourceStatus}
      </button>
      {sourceStatusExpanded ? (
        <div className="inspector-disclosure">
          <p className="muted">{state.search.enabled ? TEXT.searchOn : TEXT.searchOff}</p>
          {state.search.providerLabel ? <p className="muted">{TEXT.sourceProvider}: {state.search.providerLabel}</p> : null}
          <p className="muted">Ollama: {normalizeWorkbenchText(state.model.status)}</p>
          <p className="muted">{TEXT.permission}: {normalizeWorkbenchText(state.permission.label)}</p>
          <p className="muted">{normalizeWorkbenchText(state.permission.summary)}</p>
          {visibleSources.map((item) => (
            <div key={`${item.provider}-${item.url}`}>
              <p className="muted">{TEXT.sourceTitle}: {normalizeWorkbenchText(item.title)}</p>
              <p className="muted">{TEXT.sourceUrl}: {item.url}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );

  const auditSection = (
    <section>
      <h2>
        <ScrollText aria-hidden="true" size={16} />
        {TEXT.logs}
      </h2>
      <p className="muted">{normalizeWorkbenchText(state.audit.summary)}</p>
      <button
        className="inspector-disclosure-button"
        type="button"
        onClick={() => setAuditExpanded((expanded) => !expanded)}
      >
        {TEXT.expandLogs}
      </button>
      {auditExpanded ? (
        <div className="inspector-disclosure">
          <p className="muted">{TEXT.module}: {normalizeWorkbenchText(state.audit.lastEvent.module)}</p>
          <p className="muted">{TEXT.source}: {normalizeWorkbenchText(state.audit.lastEvent.source)}</p>
          <p className="muted">{TEXT.time}: {normalizeWorkbenchText(state.audit.lastEvent.timestamp)}</p>
          <p className="muted">{normalizeWorkbenchText(state.audit.lastEvent.detail)}</p>
        </div>
      ) : null}
    </section>
  );

  const rollbackSection = (
    <RollbackPanel
      state={state}
      onPreviewRollback={onPreviewRollback}
      onApplyRollback={onApplyRollback}
      onCancelRollback={onCancelRollback}
    />
  );

  return (
    <aside className="inspector glass-gradient-sidebar-right" aria-label={TEXT.panel}>
      {hasVisibleOutput ? (
        <section>
          <h2>
            <FileText aria-hidden="true" size={16} />
            {TEXT.output}
          </h2>
          <p className="muted">{normalizeWorkbenchText(visibleOutputTitle)}</p>
          <p className="muted">{normalizeWorkbenchText(visibleOutputSummary)}</p>
        </section>
      ) : null}

      {shouldKeepInspectorQuietForLocalModelGeneration ? null : (
        <section>
          <h2>{TEXT.records}</h2>
          <p className="muted">{TEXT.recordsSummary}</p>
          <button
            className="inspector-disclosure-button"
            type="button"
            onClick={() => setRecordsExpanded((expanded) => !expanded)}
          >
            {recordsExpanded ? TEXT.collapseRecords : TEXT.expandRecords}
          </button>
        </section>
      )}

      {recordsExpanded ? (
        <>
          {sourceSection}
          {auditSection}
          {state.rollback.pendingPreview ? null : rollbackSection}
        </>
      ) : null}

      {hasPendingPermissionOrConfirmation ? (
        <section>
          <h2>{normalizeWorkbenchText(state.permission.confirmationTitle)}</h2>
          <p className="muted">{normalizeWorkbenchText(state.permission.confirmationSummary)}</p>
        {state.permission.pendingModeChange ? (
          <>
            <p className="muted">{TEXT.permissionPending}: {getLocalizedPermissionModeLabel(state.permission.pendingModeChange.targetMode)}</p>
            <p className="muted">{TEXT.permissionReason}: {getPendingApprovalTextPreview(getLocalizedPermissionReason(state.permission.pendingModeChange.reason))}</p>
            <p className="muted">{TEXT.permissionRisk}: {getPendingApprovalTextPreview(getLocalizedPermissionRiskSummary(state.permission.pendingModeChange.riskSummary))}</p>
            <div className="action-row">
              <button className="action-button action-button-primary" type="button" onClick={onApprovePermissionRequest}>
                {TEXT.approvePrivilege}
              </button>
              <button className="action-button" type="button" onClick={onCancelPermissionRequest}>
                {TEXT.cancelPrivilege}
              </button>
            </div>
          </>
        ) : null}

        {pendingConfirmation ? (
          <>
            <p className="muted">{getPendingApprovalTextPreview(pendingConfirmation.title)}</p>
            <p className="muted">{getPendingApprovalTextPreview(pendingConfirmation.summary)}</p>
            <p className="muted">{TEXT.commandPreview}: {getPendingApprovalTextPreview(pendingConfirmation.commandPreview)}</p>
            <p className="muted">{TEXT.impact}: {getPendingApprovalTextPreview(pendingConfirmation.impact)}</p>
            <p className="muted">{TEXT.requiredPermission}: {pendingConfirmation.requiredMode}</p>
            {pendingConfirmation.safetySummary ? (
              <p className="muted">{TEXT.safety}: {getPendingApprovalTextPreview(pendingConfirmation.safetySummary)}</p>
            ) : null}
            <div className="action-row">
              <button className="action-button action-button-primary" type="button" onClick={onApproveDangerousAction}>
                {isCapabilityConfirmationContext ? TEXT.approveCapability : TEXT.approveDanger}
              </button>
              <button className="action-button" type="button" onClick={onCancelDangerousAction}>
                {isCapabilityConfirmationContext ? TEXT.cancelCapability : TEXT.cancelDanger}
              </button>
            </div>
          </>
        ) : null}
        </section>
      ) : null}

      {!shouldKeepInspectorQuietForLocalModelGeneration && visibleTasks.length > 0 ? (
        <section>
          <h2>
            <ListChecks aria-hidden="true" size={16} />
            {TEXT.localTasks}
          </h2>
          <p className="muted">{TEXT.taskPending} {state.tasks.pendingCount} {TEXT.taskUnit}</p>
          <div className="task-queue-list">
            {visibleTasks.map((task) => {
                const hasFailureDetails = Boolean(
                  task.lastFailureSource
                    || task.lastFailureSummary
                    || task.lastFailureDetail
                    || task.lastFailureActionLabel
                );
                const failureDetailsExpanded = expandedFailureTaskIds.has(task.id);

                return (
                  <div key={task.id} className="task-queue-item">
                    <span className="task-queue-status">{getTaskStatusLabel(task.status)}</span>
                    <p className="task-queue-summary">{getVisibleTaskSummary(task)}</p>
                    {task.attemptCount > 0 ? (
                      <p className="muted">{TEXT.taskAttempt} {task.attemptCount} / {MAX_LOCAL_TASK_ATTEMPTS}</p>
                    ) : null}
                    {hasFailureDetails ? (
                      <button
                        className="inspector-disclosure-button"
                        type="button"
                        onClick={() =>
                          setExpandedFailureTaskIds((current) => {
                            const next = new Set(current);

                            if (next.has(task.id)) {
                              next.delete(task.id);
                            } else {
                              next.add(task.id);
                            }

                            return next;
                          })
                        }
                      >
                        {failureDetailsExpanded ? TEXT.collapseFailureDetails : TEXT.expandFailureDetails}
                      </button>
                    ) : null}
                    {hasFailureDetails && failureDetailsExpanded ? (
                      <div className="inspector-disclosure">
                        {task.lastFailureSource ? (
                          <p className="muted">{`来源：${normalizeWorkbenchText(task.lastFailureSource)}`}</p>
                        ) : null}
                        {task.lastFailureSummary ? (
                          <p className="muted">{`摘要：${getVisibleTaskFailureSummary(task)}`}</p>
                        ) : null}
                        {task.lastFailureDetail ? (
                          <p className="muted">{`详情：${normalizeWorkbenchText(task.lastFailureDetail)}`}</p>
                        ) : null}
                        {task.lastFailureActionLabel ? (
                          <p className="muted">{`建议：${getVisibleTaskFailureActionLabel(task)}`}</p>
                        ) : null}
                      </div>
                    ) : null}
                    {task.status === "running" ? (
                      <div className="action-row">
                        <button aria-label={TEXT.stopTask} className="action-button" type="button" onClick={onCancelActiveTask}>
                          {TEXT.stopTask}
                        </button>
                      </div>
                    ) : null}
                    {task.status === "failed" && task.attemptCount < MAX_LOCAL_TASK_ATTEMPTS ? (
                      <div className="action-row">
                        <button
                          aria-label={TEXT.retryTask}
                          className="action-button action-button-primary"
                          type="button"
                          onClick={() => onRetryLocalTask(task.id)}
                        >
                          {TEXT.retryTask}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>
        </section>
      ) : null}

      {state.tools.lastResult ? (
        <section>
          <h2>
            <ListChecks aria-hidden="true" size={16} />
            {TEXT.tools}
          </h2>
          <p className="muted">
            {`${normalizeWorkbenchText(state.tools.lastResult.toolLabel)}: ${normalizeWorkbenchText(state.tools.lastResult.summary)}`}
          </p>
        </section>
      ) : null}

      {visibleError ? (
        <section>
          <h2>{TEXT.errors}</h2>
          <>
            <p className="muted">{normalizeWorkbenchText(getVisibleErrorTitle(visibleError))}</p>
            <p className="muted">{TEXT.module}: {normalizeWorkbenchText(visibleError.module)}</p>
            <p className="muted">{TEXT.source}: {normalizeWorkbenchText(visibleError.source)}</p>
            <p className="muted">{TEXT.time}: {normalizeWorkbenchText(visibleError.timestamp)}</p>
            <p className="muted">{normalizeWorkbenchText(getVisibleErrorDetail(visibleError))}</p>
            <p className="muted">{TEXT.suggestion}: {normalizeWorkbenchText(getVisibleErrorActionLabel(visibleError))}</p>
            {visibleError.module === "tools" ? (
              <div className="action-row">
                <button className="action-button action-button-primary" type="button" onClick={onRecoverToolError}>
                  {normalizeWorkbenchText(visibleError.actionLabel)}
                </button>
              </div>
            ) : null}
            {visibleError.module === "tasks" && !hasTaskAtAttemptLimit ? (
              <div className="action-row">
                <button className="action-button action-button-primary" type="button" onClick={() => onRetryLocalTask()}>
                  {TEXT.retryTask}
                </button>
              </div>
            ) : null}
          </>
        </section>
      ) : null}

      {state.rollback.pendingPreview ? rollbackSection : null}
    </aside>
  );
}

function getTaskStatusLabel(status: WorkbenchState["tasks"]["items"][number]["status"]) {
  if (status === "running") {
    return TEXT.running;
  }

  if (status === "completed") {
    return TEXT.completed;
  }

  if (status === "failed") {
    return TEXT.failed;
  }

  if (status === "cancelled") {
    return TEXT.cancelled;
  }

  return TEXT.queued;
}
