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

function createChecklistItems(state: WorkbenchState): ChecklistItem[] {
  if (state.permission.pendingModeChange) {
    return [
      { id: "request", label: "接收当前请求", status: "done" },
      { id: "plan", label: "规划执行方式", status: "done" },
      { id: "permission", label: "等待权限确认", status: "active" },
      { id: "execute", label: "执行对应任务", status: "todo" }
    ];
  }

  if (state.confirmation.pending) {
    return [
      { id: "request", label: "接收当前请求", status: "done" },
      { id: "plan", label: "规划执行方式", status: "done" },
      { id: "confirm", label: "等待高风险确认", status: "active" },
      { id: "execute", label: "执行对应任务", status: "todo" }
    ];
  }

  const latestTask = state.tasks.items[0] ?? null;

  if (!latestTask) {
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

  return [
    { id: "request", label: "接收当前请求", status: "done" },
    { id: "plan", label: "规划执行方式", status: "done" },
    { id: "execute", label: executionLabel, status: executeStatus },
    { id: "reply", label: "整理最终回复", status: replyStatus }
  ];
}

function splitChineseList(value: string) {
  return value
    .split("、")
    .map((item) => item.trim())
    .filter(Boolean);
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
  const pendingPermission = state.permission.pendingModeChange;
  const pendingConfirmation = state.confirmation.pending;
  const activeTask = state.tasks.activeTaskId
    ? state.tasks.items.find((item) => item.id === state.tasks.activeTaskId) ?? null
    : null;

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
          {activeTask ? (
            <button type="button" className="message-link-button" onClick={onCancelActiveTask}>
              停止
            </button>
          ) : null}
        </div>
        {checklistItems.length === 0 ? (
          <p className="npc-empty-state">还没有任务，发一条消息后会在这里生成任务单。</p>
        ) : (
          <div className="inspector-checklist">
            {checklistItems.map((item) => (
              <div className={`inspector-checklist-item inspector-checklist-item-${item.status}`} key={item.id}>
                <StatusIcon status={item.status} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="inspector-task-sheet">
        <div className="inspector-section-header">
          <div>
            <p className="knowledge-section-eyebrow">本地文件</p>
            <h2>变更</h2>
          </div>
          <span className="workspace-history-badge">{changeItems.length} 项</span>
        </div>
        {changeItems.length === 0 ? (
          <p className="npc-empty-state">当前还没有可展示的本地文件变更。</p>
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
        )}
      </section>
    </aside>
  );
}
