import { CheckCircle2, Circle, FileDiff, LoaderCircle, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import type { StorageCleanupTarget, WorkbenchState } from "../workbenchState";
import {
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

export function Inspector({
  state,
  onApproveDangerousAction,
  onCancelDangerousAction,
  onApprovePermissionRequest,
  onCancelPermissionRequest,
  onCancelActiveTask
}: InspectorProps) {
  const checklistItems = useMemo(() => createChecklistItems(state), [state]);
  const changeItems = useMemo(() => collectChangeItems(state), [state]);
  const [expandedChangeIds, setExpandedChangeIds] = useState<Set<string>>(() => new Set());
  const [isChangeSummaryExpanded, setIsChangeSummaryExpanded] = useState(false);
  const pendingPermission = state.permission.pendingModeChange;
  const pendingConfirmation = state.confirmation.pending;
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
              批准
            </button>
            <button type="button" className="action-button" onClick={onCancelPermissionRequest}>
              取消
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
              批准
            </button>
            <button type="button" className="action-button" onClick={onCancelDangerousAction}>
              取消
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
    </aside>
  );
}
