import { CheckCircle2, Circle, FileDiff, LoaderCircle, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { RollbackPanel } from "./RollbackPanel";
import type { StorageCleanupTarget, WorkbenchState } from "../workbenchState";
import {
  getVisibleLocalTaskFailureActionLabel,
  getVisibleLocalTaskFailureDetail,
  getLocalizedPermissionModeLabel,
  getLocalizedPermissionReason,
  getLocalizedPermissionRiskSummary,
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

type ChecklistItem = {
  id: string;
  label: string;
  status: "done" | "active" | "todo" | "failed";
};

type ChangeItem = {
  id: string;
  path: string;
  kind: "modified" | "added";
  sourceTitle: string;
  detail: string;
};

type ChangeStats = {
  addedLines: number | null;
  removedLines: number | null;
};

const TEXT = {
  retryTask: "重试本地任务",
  stopTask: "停止任务",
  running: "执行中",
  completed: "已完成",
  failed: "已失败",
  queued: "队列中",
  cancelled: "已取消"
} as const;

const MAX_VISIBLE_LOCAL_TASK_ATTEMPTS = 3;

type LocalTaskItem = WorkbenchState["tasks"]["items"][number];

function truncateInspectorText(value: string, limit: number) {
  const normalized = normalizeWorkbenchText(value).replace(/\s+/g, " ").trim();

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function getLatestUserRequestSummary(state: WorkbenchState) {
  const activeTask = state.tasks.activeTaskId
    ? state.tasks.items.find((item) => item.id === state.tasks.activeTaskId) ?? null
    : null;
  const latestQueuedTask = state.tasks.items[0] ?? null;
  const latestUserEntry = [...state.conversation.entries].reverse().find((entry) => entry.kind === "user");

  return activeTask?.summary?.trim()
    || latestQueuedTask?.summary?.trim()
    || latestUserEntry?.summary?.trim()
    || "";
}

function normalizeInspectorRequestSummary(value: string) {
  return normalizeWorkbenchText(value)
    .replace(/\s+/g, " ")
    .trim();
}

function createRequestPlanningSummary(requestSummary: string) {
  const normalizedRequest = normalizeInspectorRequestSummary(requestSummary);

  if (!normalizedRequest) {
    return null;
  }

  if (/^.{0,4}(hi|hello|你好|在吗|在么)[!！。?？]?$/i.test(normalizedRequest)) {
    return null;
  }

  if (normalizedRequest.length >= 80) {
    return null;
  }

  if (/(.+?)和(.+?)(谁更好|哪个好|区别|差别|对比|比较)/.test(normalizedRequest)) {
    const match = normalizedRequest.match(/(.+?)和(.+?)(谁更好|哪个好|区别|差别|对比|比较)/);
    const left = truncateInspectorText(match?.[1]?.trim() ?? "对象 A", 8);
    const right = truncateInspectorText(match?.[2]?.trim() ?? "对象 B", 8);
    return `比较 ${left} 和 ${right}`;
  }

  if (/帮我|请|麻烦/.test(normalizedRequest) && /搜索|联网|查一下|查找|找资料/.test(normalizedRequest)) {
    return "检索并整理相关资料";
  }

  if (/修复|排查|报错|问题|异常|失败|不对|出错|bug/i.test(normalizedRequest)) {
    return "定位并修复当前问题";
  }

  if (/实现|接入|联通|新增|补齐|完善|支持/i.test(normalizedRequest)) {
    return "实现并补齐目标能力";
  }

  if (/界面|侧边栏|任务单|变更|样式|布局|按钮|交互|列表|卡片|展开|收起|美观|风格|UI/i.test(normalizedRequest)) {
    return "调整界面与交互表现";
  }

  if (/解释|说明|介绍|是什么|为什么|怎么/i.test(normalizedRequest) && normalizedRequest.length <= 18) {
    return `整理问题：${truncateInspectorText(normalizedRequest, 16)}`;
  }

  return null;
}

function createRequestAwareChecklistItems(
  planningSummary: string,
  executionLabel: string,
  executeStatus: ChecklistItem["status"],
  replyStatus: ChecklistItem["status"]
): ChecklistItem[] {
  const normalizedSummary = planningSummary.trim();
  const compactSummary = truncateInspectorText(normalizedSummary, 18);
  const looksLikeUiTask = /界面|侧边栏|任务单|变更|样式|布局|按钮|交互|列表|卡片|展开|收起|美观|风格|UI/i.test(normalizedSummary);
  const looksLikeFixTask = /修复|排查|问题|异常|失败|bug/i.test(normalizedSummary);
  const looksLikeImplementationTask = /实现|接入|联通|新增|补齐|完善|支持/i.test(normalizedSummary);

  if (looksLikeUiTask) {
    return [
      { id: "request", label: compactSummary ? `任务摘要：${compactSummary}` : "任务摘要", status: "done" },
      { id: "plan", label: "拆解要改的区域和交互", status: "done" },
      { id: "execute", label: executionLabel || "调整界面与交互", status: executeStatus },
      { id: "reply", label: "整理变更结果与验证", status: replyStatus }
    ];
  }

  if (looksLikeFixTask) {
    return [
      { id: "request", label: compactSummary ? `任务摘要：${compactSummary}` : "任务摘要", status: "done" },
      { id: "plan", label: "定位原因和相关文件", status: "done" },
      { id: "execute", label: executionLabel || "实施修复", status: executeStatus },
      { id: "reply", label: "整理修复结果与验证", status: replyStatus }
    ];
  }

  if (looksLikeImplementationTask) {
    return [
      { id: "request", label: compactSummary ? `任务摘要：${compactSummary}` : "任务摘要", status: "done" },
      { id: "plan", label: "拆解执行步骤和依赖", status: "done" },
      { id: "execute", label: executionLabel || "实现对应能力", status: executeStatus },
      { id: "reply", label: "整理结果与后续说明", status: replyStatus }
    ];
  }

  return [
    { id: "request", label: compactSummary ? `任务摘要：${compactSummary}` : "任务摘要", status: "done" },
    { id: "plan", label: "规划执行步骤", status: "done" },
    { id: "execute", label: executionLabel || "执行对应任务", status: executeStatus },
    { id: "reply", label: "整理最终回复", status: replyStatus }
  ];
}

function createChecklistItems(state: WorkbenchState): ChecklistItem[] {
  const latestRequestSummary = getLatestUserRequestSummary(state);
  const planningSummary = createRequestPlanningSummary(latestRequestSummary);

  if (state.permission.pendingModeChange) {
    if (!planningSummary) {
      return [];
    }

    return [
      { id: "request", label: `任务摘要：${truncateInspectorText(planningSummary, 18)}`, status: "done" },
      { id: "plan", label: "确认所需权限和风险", status: "done" },
      { id: "permission", label: "等待权限确认", status: "active" },
      { id: "execute", label: "获批后执行任务", status: "todo" }
    ];
  }

  if (state.confirmation.pending) {
    if (!planningSummary) {
      return [];
    }

    return [
      { id: "request", label: `任务摘要：${truncateInspectorText(planningSummary, 18)}`, status: "done" },
      { id: "plan", label: "确认高风险操作范围", status: "done" },
      { id: "confirm", label: "等待高风险确认", status: "active" },
      { id: "execute", label: "确认后执行任务", status: "todo" }
    ];
  }

  const latestTask = state.tasks.items[0] ?? null;

  if (!latestTask) {
    return [];
  }

  if (!planningSummary) {
    return [];
  }

  const executionLabel = normalizeWorkbenchText(latestTask.executionTitle || "执行对应任务");
  const executeStatus =
    latestTask.status === "completed"
      ? "done"
      : latestTask.status === "running" || latestTask.status === "queued"
        ? "active"
        : latestTask.status === "failed"
          ? "failed"
          : "todo";
  const replyStatus = latestTask.status === "completed" ? "done" : "todo";

  return createRequestAwareChecklistItems(
    planningSummary,
    executionLabel,
    executeStatus,
    replyStatus
  );
}

function splitChineseList(value: string) {
  return value
    .split("、")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseChangeStats(blocks: string[]): ChangeStats {
  let addedLines: number | null = null;
  let removedLines: number | null = null;

  for (const block of blocks) {
    const normalized = normalizeWorkbenchText(block);
    const explicitChineseMatch =
      normalized.match(/新增\s*(\d[\d,]*)\s*行.*?删除\s*(\d[\d,]*)\s*行/i)
      ?? normalized.match(/增加\s*(\d[\d,]*)\s*行.*?删除\s*(\d[\d,]*)\s*行/i);
    const explicitSymbolMatch = normalized.match(/\+(\d[\d,]*)\s*[\/|· ]\s*-(\d[\d,]*)/)
      ?? normalized.match(/\+(\d[\d,]*)\s*-(\d[\d,]*)/);
    const gitStatMatch =
      normalized.match(/(\d[\d,]*)\s+insertions?\(\+\).*?(\d[\d,]*)\s+deletions?\(-\)/i)
      ?? normalized.match(/(\d[\d,]*)\s+additions?\(\+\).*?(\d[\d,]*)\s+deletions?\(-\)/i);

    const match = explicitChineseMatch ?? explicitSymbolMatch ?? gitStatMatch;
    if (!match) {
      continue;
    }

    const nextAdded = Number((match[1] ?? "0").replaceAll(",", ""));
    const nextRemoved = Number((match[2] ?? "0").replaceAll(",", ""));

    if (Number.isFinite(nextAdded) && Number.isFinite(nextRemoved)) {
      addedLines = Math.max(addedLines ?? 0, nextAdded);
      removedLines = Math.max(removedLines ?? 0, nextRemoved);
    }
  }

  return { addedLines, removedLines };
}

function collectChangeItems(state: WorkbenchState): ChangeItem[] {
  const items: ChangeItem[] = [];
  const seen = new Set<string>();

  for (const entry of state.conversation.entries) {
    if (entry.kind !== "assistant") {
      continue;
    }

    const blocks = [entry.summary, ...(entry.detailLines ?? [])];

    for (const block of blocks) {
      const changedMatch = block.match(/变更路径：(.+?)(?:。|$)/);
      const artifactMatch = block.match(/产物路径：(.+?)(?:。|$)/);

      for (const path of changedMatch ? splitChineseList(changedMatch[1] ?? "") : []) {
        const key = `modified:${path}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        items.push({
          id: key,
          path,
          kind: "modified",
          sourceTitle: normalizeWorkbenchText(entry.title),
          detail: normalizeWorkbenchText(entry.summary)
        });
      }

      for (const path of artifactMatch ? splitChineseList(artifactMatch[1] ?? "") : []) {
        const key = `added:${path}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        items.push({
          id: key,
          path,
          kind: "added",
          sourceTitle: normalizeWorkbenchText(entry.title),
          detail: normalizeWorkbenchText(entry.summary)
        });
      }
    }
  }

  return items.slice(0, 8);
}

function StatusIcon({ status }: { status: ChecklistItem["status"] }) {
  if (status === "done") {
    return <CheckCircle2 aria-hidden="true" size={18} className="inspector-checklist-icon inspector-checklist-icon-done" />;
  }

  if (status === "active") {
    return <LoaderCircle aria-hidden="true" size={18} className="inspector-checklist-icon inspector-checklist-icon-active" />;
  }

  return <Circle aria-hidden="true" size={18} className="inspector-checklist-icon" />;
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

function hasTaskFailureDetail(task: LocalTaskItem) {
  return Boolean(
    task.lastFailureSource
    || task.lastFailureSummary
    || task.lastFailureDetail
    || task.lastFailureActionLabel
  );
}

function canRetryTask(task: LocalTaskItem) {
  return task.status === "failed" && task.attemptCount < MAX_VISIBLE_LOCAL_TASK_ATTEMPTS;
}

export function Inspector({
  state,
  onApproveDangerousAction,
  onCancelDangerousAction,
  onApprovePermissionRequest,
  onCancelPermissionRequest,
  onRetryOllamaCheck,
  onRecoverToolError,
  onPreviewRollback,
  onApplyRollback,
  onCancelRollback,
  onRetryLocalTask,
  onCancelActiveTask,
  onUpdateRollbackLimit,
  onCleanupStorage,
  onToggleRemoteApi,
  onToggleSearch,
  onSaveRemoteApiConfig,
  onSaveSearchProviderConfig
}: InspectorProps) {
  const checklistItems = useMemo(() => createChecklistItems(state), [state]);
  const changeItems = useMemo(() => collectChangeItems(state), [state]);
  const [expandedChangeIds, setExpandedChangeIds] = useState<Set<string>>(() => new Set());
  const [isChangeSummaryExpanded, setIsChangeSummaryExpanded] = useState(false);
  const [isRecordsExpanded, setIsRecordsExpanded] = useState(false);
  const [isLogDetailExpanded, setIsLogDetailExpanded] = useState(false);
  const [isRollbackRecordsExpanded, setIsRollbackRecordsExpanded] = useState(false);
  const [expandedTaskFailureIds, setExpandedTaskFailureIds] = useState<Set<string>>(() => new Set());
  const [remoteApiBaseUrl, setRemoteApiBaseUrl] = useState(state.settings.remoteApi.baseUrl);
  const [remoteApiProviderLabel, setRemoteApiProviderLabel] = useState(state.settings.remoteApi.providerLabel);
  const [remoteApiKey, setRemoteApiKey] = useState(state.settings.remoteApi.apiKey);
  const [searchProviderLabel, setSearchProviderLabel] = useState(state.search.providerLabel || "Tavily");
  const pendingPermission = state.permission.pendingModeChange;
  const pendingConfirmation = state.confirmation.pending;
  const capabilityAuditSources = new Set([
    "capability_toggle_request",
    "capability_toggle_approved",
    "capability_toggle_cancelled"
  ]);
  const isCapabilityConfirmationContext = Boolean(pendingConfirmation?.requestedFeature)
    || capabilityAuditSources.has(state.audit.lastEvent.source);
  const activeTask = state.tasks.activeTaskId
    ? state.tasks.items.find((item) => item.id === state.tasks.activeTaskId) ?? null
    : null;
  const changedFileCount = changeItems.length;
  const addedFileCount = changeItems.filter((item) => item.kind === "added").length;
  const modifiedFileCount = changeItems.filter((item) => item.kind === "modified").length;
  const changeStats = useMemo(
    () => parseChangeStats(state.conversation.entries.flatMap((entry) => [entry.summary, ...(entry.detailLines ?? [])])),
    [state.conversation.entries]
  );
  const hasRealLineStats = changeStats.addedLines !== null || changeStats.removedLines !== null;
  const changeSummaryLabel = changedFileCount === 0 ? "暂无变更" : "变更";
  const changeSummaryDetail = changedFileCount === 0 ? null : `${changedFileCount} 个文件`;
  const visibleSources = state.sources.items.slice(0, 3);
  const visibleTasks = state.tasks.items
    .filter((task) =>
      checklistItems.length > 0
      || task.status === "failed"
      || hasTaskFailureDetail(task)
      || normalizeInspectorRequestSummary(task.summary).length <= 80
    )
    .slice(0, 3);
  const hasModels = state.model.availableModels.length > 0;
  const hasRetryableTaskError = Boolean(
    state.error?.module === "tasks"
    && visibleTasks.some((task) => task.status === "failed" && task.attemptCount < MAX_VISIBLE_LOCAL_TASK_ATTEMPTS)
  );

  function toggleTaskFailureDetail(taskId: string) {
    setExpandedTaskFailureIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  function renderTaskQueueItem(task: LocalTaskItem, options: { showControls: boolean }) {
    const failureExpanded = expandedTaskFailureIds.has(task.id);
    const hasFailureDetail = hasTaskFailureDetail(task);

    return (
      <div className="task-queue-item" key={task.id}>
        <span className="task-queue-status">{getTaskStatusLabel(task.status)}</span>
        <p className="task-queue-summary">{normalizeWorkbenchText(task.summary)}</p>
        <p className="muted">Attempt {task.attemptCount} / {MAX_VISIBLE_LOCAL_TASK_ATTEMPTS}</p>
        {hasFailureDetail ? (
          <button
            aria-expanded={failureExpanded}
            className="action-button"
            type="button"
            onClick={() => toggleTaskFailureDetail(task.id)}
          >
            {failureExpanded ? "收起失败细节" : "展开失败细节"}
          </button>
        ) : null}
        {failureExpanded ? (
          <>
            {task.lastFailureSource ? <p className="muted">来源：{normalizeWorkbenchText(task.lastFailureSource)}</p> : null}
            {task.lastFailureDetail ? (
              <p className="muted">
                详情：{getVisibleLocalTaskFailureDetail(task.lastFailureDetail, task.lastFailureSource)}
              </p>
            ) : task.lastFailureSummary ? (
              <p className="muted">详情：{normalizeWorkbenchText(task.lastFailureSummary)}</p>
            ) : null}
            {task.lastFailureActionLabel ? (
              <p className="muted">建议：{getVisibleLocalTaskFailureActionLabel(task.lastFailureActionLabel)}</p>
            ) : null}
          </>
        ) : null}
        {options.showControls && task.status === "running" ? (
          <div className="action-row">
            <button aria-label={TEXT.stopTask} className="action-button" type="button" onClick={onCancelActiveTask}>
              {TEXT.stopTask}
            </button>
          </div>
        ) : null}
        {options.showControls && canRetryTask(task) ? (
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
  }

  return (
    <aside aria-label="右侧面板" className="inspector glass-gradient-sidebar-right">
      {pendingPermission ? (
        <section className="inspector-inline-notice">
          <div className="inspector-inline-title">
            <ShieldAlert aria-hidden="true" size={16} />
            <span>等待权限确认</span>
          </div>
          <p className="muted">{getLocalizedPermissionModeLabel(pendingPermission.targetMode)}</p>
          <p className="muted">{getLocalizedPermissionReason(pendingPermission.reason)}</p>
          <p className="muted">{getLocalizedPermissionRiskSummary(pendingPermission.riskSummary)}</p>
          <div className="action-row">
            <button type="button" className="action-button action-button-primary" onClick={onApprovePermissionRequest}>
              批准提权
            </button>
            <button type="button" className="action-button" onClick={onCancelPermissionRequest}>
              取消提权
            </button>
          </div>
        </section>
      ) : null}

      {pendingConfirmation ? (
        <section className="inspector-inline-notice">
          <div className="inspector-inline-title">
            <ShieldAlert aria-hidden="true" size={16} />
            <span>等待高风险确认</span>
          </div>
          <p className="muted">{normalizeWorkbenchText(pendingConfirmation.summary)}</p>
          <p className="muted">所需权限：{getLocalizedPermissionModeLabel(pendingConfirmation.requiredMode)}</p>
          <div className="action-row">
            <button type="button" className="action-button action-button-primary" onClick={onApproveDangerousAction}>
              {isCapabilityConfirmationContext ? "批准能力变更" : "批准高风险操作"}
            </button>
            <button type="button" className="action-button" onClick={onCancelDangerousAction}>
              {isCapabilityConfirmationContext ? "取消能力变更" : "取消高风险操作"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="inspector-task-sheet">
        <div className="inspector-section-header">
          <div>
            <p className="knowledge-section-eyebrow">当前执行</p>
            <h2>任务单</h2>
          </div>
        </div>
        {checklistItems.length > 0 ? (
          <div className="inspector-checklist">
            {checklistItems.map((item) => (
              <div className={`inspector-checklist-item inspector-checklist-item-${item.status}`} key={item.id}>
                <StatusIcon status={item.status} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        ) : null}
        {visibleTasks.length > 0 ? (
          <div className="task-queue-list">
            {visibleTasks.map((task) => renderTaskQueueItem(task, { showControls: false }))}
          </div>
        ) : null}
      </section>

      <section className="inspector-task-sheet">
        <div className="inspector-section-header">
          <div>
            <p className="knowledge-section-eyebrow">本地文件</p>
            <h2>变更</h2>
          </div>
        </div>
        <button
          aria-expanded={isChangeSummaryExpanded}
          aria-label={isChangeSummaryExpanded ? "收起变更" : "展开变更"}
          className="inspector-change-summary"
          type="button"
          onClick={() => setIsChangeSummaryExpanded((current) => !current)}
        >
          <span className="inspector-change-summary-leading">
            <FileDiff aria-hidden="true" size={18} />
            <span className="inspector-change-summary-title">变更</span>
          </span>
          <span className="inspector-change-summary-trailing">
            {changedFileCount === 0 ? (
              <span className="inspector-change-summary-count">{changeSummaryLabel}</span>
            ) : (
              <>
                {changeSummaryDetail ? <span className="inspector-change-summary-meta">{changeSummaryDetail}</span> : null}
                {hasRealLineStats ? (
                  <span className="inspector-change-summary-stats" aria-label="变更统计">
                    {changeStats.addedLines !== null ? (
                      <span className="inspector-change-summary-added">+{changeStats.addedLines.toLocaleString("en-US")}</span>
                    ) : null}
                    {changeStats.removedLines !== null ? (
                      <span className="inspector-change-summary-removed">-{changeStats.removedLines.toLocaleString("en-US")}</span>
                    ) : null}
                  </span>
                ) : null}
              </>
            )}
          </span>
        </button>
        {isChangeSummaryExpanded ? (
          changedFileCount === 0 ? (
            <p className="inspector-change-empty">当前没有新的本地文件改动。</p>
          ) : (
            <div className="npc-compact-list inspector-change-list">
              {changeItems.map((item) => {
                const expanded = expandedChangeIds.has(item.id);

                return (
                  <div className="npc-row-button search-source-row inspector-change-row" key={item.id}>
                    <button
                      aria-label={`${item.path.split("/").pop() || item.path} ${item.kind === "added" ? "新增" : "改动"}`}
                      className="inspector-change-toggle"
                      type="button"
                      onClick={() => {
                        setExpandedChangeIds((current) => {
                          const next = new Set(current);
                          if (next.has(item.id)) {
                            next.delete(item.id);
                          } else {
                            next.add(item.id);
                          }
                          return next;
                        });
                      }}
                    >
                      <span className="npc-row-leading">
                        <span className="npc-row-title">{item.path.split("/").pop() || item.path}</span>
                        <span className="npc-row-description">{truncateInspectorText(item.path, 52)}</span>
                      </span>
                      <span className="npc-row-trailing">
                        <span className="npc-row-meta">{item.kind === "added" ? "新增" : "改动"}</span>
                      </span>
                    </button>
                    {expanded ? (
                      <div className="inspector-change-detail">
                        <p className="message-detail">完整路径：{item.path}</p>
                        <p className="message-detail">来源任务：{item.sourceTitle}</p>
                        <p className="message-detail">{item.detail}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )
        ) : null}
      </section>

      <section className="inspector-task-sheet">
        <button
          aria-expanded={isRecordsExpanded}
          aria-label={isRecordsExpanded ? "收起配置与记录" : "展开配置与记录"}
          className="inspector-change-summary"
          type="button"
          onClick={() => setIsRecordsExpanded((current) => !current)}
        >
          <span className="inspector-change-summary-leading">
            <span className="inspector-change-summary-title">配置与记录</span>
          </span>
          <span className="inspector-change-summary-trailing">
            <span className="inspector-change-summary-count">
              {state.tasks.pendingCount > 0 ? `待处理 ${state.tasks.pendingCount} 条` : "折叠"}
            </span>
          </span>
        </button>

        {isRecordsExpanded ? (
          <div className="inspector-records">
            <section>
              <h2>来源</h2>
              <p className="muted">{state.search.enabled ? "联网搜索已开启" : "联网搜索默认关闭"}</p>
              {state.search.providerLabel ? <p className="muted">搜索提供方: {state.search.providerLabel}</p> : null}
              <p className="muted">Ollama: {normalizeWorkbenchText(state.model.status)}</p>
              <p className="muted">权限: {normalizeWorkbenchText(state.permission.label)}</p>
              <p className="muted">{normalizeWorkbenchText(state.permission.summary)}</p>
              {visibleSources.map((item) => (
                <div key={`${item.provider}-${item.url}`}>
                  <p className="muted">来源标题: {normalizeWorkbenchText(item.title)}</p>
                  <p className="muted">来源地址: {item.url}</p>
                </div>
              ))}
            </section>

            <section>
              <h2>本地任务</h2>
              <p className="muted">待处理 {state.tasks.pendingCount} 条</p>
              {visibleTasks.length > 0 ? (
                <div className="task-queue-list">
                  {visibleTasks.map((task) => renderTaskQueueItem(task, { showControls: true }))}
                </div>
              ) : (
                <p className="muted">暂无本地任务</p>
              )}
            </section>

            <section>
              <h2>工具</h2>
              <p className="muted">
                {state.tools.lastResult
                  ? `${normalizeWorkbenchText(state.tools.lastResult.toolLabel)}: ${normalizeWorkbenchText(state.tools.lastResult.summary)}`
                  : hasModels
                    ? `已检测 ${state.model.availableModels.length} 个本地模型`
                    : "等待本地模型"}
              </p>
            </section>

            <section>
              <h2>日志</h2>
              <p className="muted">{normalizeWorkbenchText(state.audit.summary)}</p>
              <button
                aria-expanded={isLogDetailExpanded}
                className="action-button"
                type="button"
                onClick={() => setIsLogDetailExpanded((current) => !current)}
              >
                {isLogDetailExpanded ? "收起日志细节" : "展开日志细节"}
              </button>
              {isLogDetailExpanded ? (
                <div>
                  <p className="muted">模块: {normalizeWorkbenchText(state.audit.lastEvent.module)}</p>
                  <p className="muted">来源: {normalizeWorkbenchText(state.audit.lastEvent.source)}</p>
                  <p className="muted">时间: {normalizeWorkbenchText(state.audit.lastEvent.timestamp)}</p>
                  <p className="muted">{normalizeWorkbenchText(state.audit.lastEvent.detail)}</p>
                  {state.error ? (
                    <>
                      <p className="muted">{normalizeWorkbenchText(state.error.summary)}</p>
                      <p className="muted">模块: {normalizeWorkbenchText(state.error.module)}</p>
                      <p className="muted">来源: {normalizeWorkbenchText(state.error.source)}</p>
                      <p className="muted">时间: {normalizeWorkbenchText(state.error.timestamp)}</p>
                      <p className="muted">{normalizeWorkbenchText(state.error.detail)}</p>
                      <p className="muted">建议: {normalizeWorkbenchText(state.error.actionLabel)}</p>
                    </>
                  ) : (
                    <p className="muted">当前没有活动错误</p>
                  )}
                </div>
              ) : null}
              {state.error?.module === "ollama" ? (
                <div className="action-row">
                  <button className="action-button action-button-primary" type="button" onClick={onRetryOllamaCheck}>
                    {normalizeWorkbenchText(state.error.actionLabel)}
                  </button>
                </div>
              ) : null}
              {state.error?.module === "tools" ? (
                <div className="action-row">
                  <button className="action-button action-button-primary" type="button" onClick={onRecoverToolError}>
                    {normalizeWorkbenchText(state.error.actionLabel)}
                  </button>
                </div>
              ) : null}
              {hasRetryableTaskError ? (
                <div className="action-row">
                  <button className="action-button action-button-primary" type="button" onClick={() => onRetryLocalTask()}>
                    {TEXT.retryTask}
                  </button>
                </div>
              ) : null}
            </section>

            <section>
              <h2>高级设置</h2>
              <p className="muted">{state.settings.remoteApi.enabled ? "远程 API 已开启" : "远程 API 默认关闭"}</p>
              <p className="muted">{state.search.enabled ? "联网搜索已开启" : "联网搜索默认关闭"}</p>
              <div className="action-row" aria-label="网络开关">
                <button className="action-button" type="button" onClick={() => onToggleRemoteApi(!state.settings.remoteApi.enabled)}>
                  {state.settings.remoteApi.enabled ? "关闭远程 API" : "开启远程 API"}
                </button>
                <button className="action-button" type="button" onClick={() => onToggleSearch(!state.search.enabled)}>
                  {state.search.enabled ? "关闭联网搜索" : "开启联网搜索"}
                </button>
              </div>
              <div className="action-row">
                <label>
                  <span className="muted">联网搜索 Provider</span>
                  <input
                    aria-label="联网搜索 Provider"
                    type="text"
                    value={searchProviderLabel}
                    onChange={(event) => setSearchProviderLabel(event.target.value)}
                  />
                </label>
              </div>
              <div className="action-row">
                <button
                  className="action-button"
                  type="button"
                  onClick={() => onSaveSearchProviderConfig({ providerLabel: searchProviderLabel })}
                >
                  保存联网搜索配置
                </button>
              </div>
              <div className="action-row">
                <label>
                  <span className="muted">远程 API Base URL</span>
                  <input
                    aria-label="远程 API Base URL"
                    type="text"
                    value={remoteApiBaseUrl}
                    onChange={(event) => setRemoteApiBaseUrl(event.target.value)}
                  />
                </label>
              </div>
              <div className="action-row">
                <label>
                  <span className="muted">远程 API Provider</span>
                  <input
                    aria-label="远程 API Provider"
                    type="text"
                    value={remoteApiProviderLabel}
                    onChange={(event) => setRemoteApiProviderLabel(event.target.value)}
                  />
                </label>
              </div>
              <div className="action-row">
                <label>
                  <span className="muted">远程 API Key</span>
                  <input
                    aria-label="远程 API Key"
                    type="password"
                    value={remoteApiKey}
                    onChange={(event) => setRemoteApiKey(event.target.value)}
                  />
                </label>
              </div>
              <div className="action-row">
                <button
                  className="action-button"
                  type="button"
                  onClick={() =>
                    onSaveRemoteApiConfig({
                      baseUrl: remoteApiBaseUrl,
                      providerLabel: remoteApiProviderLabel,
                      apiKey: remoteApiKey
                    })
                  }
                >
                  保存远程 API 配置
                </button>
              </div>
              <p className="muted">回退点上限 {state.rollback.activeLimit} / {state.rollback.maxLimit}</p>
              <div className="action-row" aria-label="回退点上限快捷设置">
                <button className="action-button" type="button" onClick={() => onUpdateRollbackLimit(10)}>
                  10 段
                </button>
                <button className="action-button" type="button" onClick={() => onUpdateRollbackLimit(15)}>
                  15 段
                </button>
                <button className="action-button action-button-primary" type="button" onClick={() => onUpdateRollbackLimit(20)}>
                  20 段
                </button>
              </div>
              <p className="muted">会话 {state.storage.sessionCount}</p>
              <p className="muted">日志 {state.storage.logCount}</p>
              <p className="muted">缓存条目 {state.storage.cacheCount}</p>
              <p className="muted">快照 {state.storage.snapshotCount}</p>
              <p className="muted">知识库索引 {state.storage.knowledgeCount}</p>
              <div className="action-row" aria-label="本地清理入口">
                <button className="action-button" type="button" onClick={() => onCleanupStorage("conversation")}>
                  清空会话
                </button>
                <button className="action-button" type="button" onClick={() => onCleanupStorage("logs")}>
                  清空日志
                </button>
              </div>
              <div className="action-row">
                <button className="action-button" type="button" onClick={() => onCleanupStorage("cache")}>
                  清空缓存
                </button>
                <button className="action-button" type="button" onClick={() => onCleanupStorage("snapshots")}>
                  清空快照
                </button>
              </div>
              <div className="action-row">
                <button className="action-button" type="button" onClick={() => onCleanupStorage("knowledge")}>
                  清空知识库索引
                </button>
              </div>
            </section>

            {state.rollback.entries.length > 0 || state.rollback.pendingPreview ? (
              <section>
                <button
                  aria-expanded={isRollbackRecordsExpanded}
                  className="action-button"
                  type="button"
                  onClick={() => setIsRollbackRecordsExpanded((current) => !current)}
                >
                  {isRollbackRecordsExpanded ? "收起回退记录" : "展开回退记录"}
                </button>
                {isRollbackRecordsExpanded ? (
                  <div>
                    {state.rollback.entries.slice(0, state.rollback.activeLimit).map((entry) => (
                      <p className="muted" key={entry.id}>
                        {normalizeWorkbenchText(entry.label)}：{normalizeWorkbenchText(entry.summary)}
                      </p>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            <RollbackPanel
              state={state}
              onPreviewRollback={onPreviewRollback}
              onApplyRollback={onApplyRollback}
              onCancelRollback={onCancelRollback}
            />
          </div>
        ) : null}
      </section>
    </aside>
  );
}
