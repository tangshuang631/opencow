import { FileText, Globe2, ListChecks, ScrollText } from "lucide-react";
import { RollbackPanel } from "./RollbackPanel";
import type { WorkbenchState } from "../workbenchState";

type InspectorProps = {
  state: WorkbenchState;
  onApproveDangerousAction: () => void;
  onCancelDangerousAction: () => void;
  onApprovePermissionRequest: () => void;
  onCancelPermissionRequest: () => void;
  onPreviewRollback: (targetEntryId: string) => void;
  onApplyRollback: () => void;
  onCancelRollback: () => void;
  onRetryLocalTask: () => void;
};

export function Inspector({
  state,
  onApproveDangerousAction,
  onCancelDangerousAction,
  onApprovePermissionRequest,
  onCancelPermissionRequest,
  onPreviewRollback,
  onApplyRollback,
  onCancelRollback,
  onRetryLocalTask
}: InspectorProps) {
  const visibleSources = state.sources.items.slice(0, 3);
  const visibleTasks = state.tasks.items.slice(0, 3);
  const hasModels = state.model.availableModels.length > 0;

  return (
    <aside className="inspector" aria-label="右侧面板">
      <section>
        <h2>
          <FileText aria-hidden="true" size={16} />
          输出
        </h2>
        <p className="muted">{state.output.title}</p>
        <p className="muted">{state.output.summary}</p>
      </section>

      <section>
        <h2>
          <Globe2 aria-hidden="true" size={16} />
          来源
        </h2>
        <p className="muted">{state.search.enabled ? "联网搜索已开启" : "联网搜索默认关闭"}</p>
        {state.search.providerLabel ? <p className="muted">搜索提供方: {state.search.providerLabel}</p> : null}
        <p className="muted">Ollama: {state.model.status}</p>
        <p className="muted">权限: {state.permission.label}</p>
        <p className="muted">{state.permission.summary}</p>
        {visibleSources.map((item) => (
          <div key={`${item.provider}-${item.url}`}>
            <p className="muted">来源标题: {item.title}</p>
            <p className="muted">来源地址: {item.url}</p>
          </div>
        ))}
      </section>

      <section>
        <h2>{state.permission.confirmationTitle}</h2>
        <p className="muted">{state.permission.confirmationSummary}</p>
        {state.permission.pendingModeChange ? (
          <>
            <p className="muted">待切换权限: {state.permission.pendingModeChange.targetMode}</p>
            <p className="muted">提权原因: {state.permission.pendingModeChange.reason}</p>
            <p className="muted">风险说明: {state.permission.pendingModeChange.riskSummary}</p>
            <div className="action-row">
              <button className="action-button action-button-primary" type="button" onClick={onApprovePermissionRequest}>
                批准提权
              </button>
              <button className="action-button" type="button" onClick={onCancelPermissionRequest}>
                取消提权
              </button>
            </div>
          </>
        ) : (
          <p className="muted">当前没有待确认的权限升级</p>
        )}

        {state.confirmation.pending ? (
          <>
            <p className="muted">{state.confirmation.pending.title}</p>
            <p className="muted">{state.confirmation.pending.summary}</p>
            <p className="muted">命令预览: {state.confirmation.pending.commandPreview}</p>
            <p className="muted">影响范围: {state.confirmation.pending.impact}</p>
            <p className="muted">所需权限: {state.confirmation.pending.requiredMode}</p>
            {state.confirmation.pending.safetySummary ? (
              <p className="muted">安全保护: {state.confirmation.pending.safetySummary}</p>
            ) : null}
            <div className="action-row">
              <button className="action-button action-button-primary" type="button" onClick={onApproveDangerousAction}>
                批准高风险操作
              </button>
              <button className="action-button" type="button" onClick={onCancelDangerousAction}>
                取消高风险操作
              </button>
            </div>
          </>
        ) : (
          <p className="muted">当前没有待确认的高风险操作</p>
        )}
      </section>

      <section>
        <h2>
          <ListChecks aria-hidden="true" size={16} />
          本地任务
        </h2>
        <p className="muted">待处理 {state.tasks.pendingCount} 条</p>
        {visibleTasks.length > 0 ? (
          <div className="task-queue-list">
            {visibleTasks.map((task) => (
              <div key={task.id} className="task-queue-item">
                <span className="task-queue-status">{getTaskStatusLabel(task.status)}</span>
                <p className="task-queue-summary">{task.summary}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">暂无本地任务</p>
        )}
      </section>

      <section>
        <h2>
          <ListChecks aria-hidden="true" size={16} />
          工具
        </h2>
        <p className="muted">
          {state.tools.lastResult
            ? `${state.tools.lastResult.toolLabel}: ${state.tools.lastResult.summary}`
            : hasModels
              ? `已检测 ${state.model.availableModels.length} 个本地模型`
              : "等待本地模型"}
        </p>
      </section>

      <section>
        <h2>
          <ScrollText aria-hidden="true" size={16} />
          日志
        </h2>
        <p className="muted">{state.audit.summary}</p>
        <p className="muted">模块: {state.audit.lastEvent.module}</p>
        <p className="muted">来源: {state.audit.lastEvent.source}</p>
        <p className="muted">时间: {state.audit.lastEvent.timestamp}</p>
        <p className="muted">{state.audit.lastEvent.detail}</p>
      </section>

      <section>
        <h2>错误</h2>
        {state.error ? (
          <>
            <p className="muted">{state.error.summary}</p>
            <p className="muted">模块: {state.error.module}</p>
            <p className="muted">来源: {state.error.source}</p>
            <p className="muted">时间: {state.error.timestamp}</p>
            <p className="muted">{state.error.detail}</p>
            <p className="muted">建议: {state.error.actionLabel}</p>
            {state.error.module === "tasks" ? (
              <div className="action-row">
                <button className="action-button action-button-primary" type="button" onClick={onRetryLocalTask}>
                  重试本地任务
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="muted">当前没有活动错误</p>
        )}
      </section>

      <section>
        <h2>高级设置</h2>
        <p className="muted">远程 API 默认关闭</p>
        <p className="muted">
          {state.settings.remoteApi.collapsed
            ? "保留 baseUrl 和 API 接入入口，按需展开。"
            : "远程 API 设置已展开。"}
        </p>
      </section>

      <RollbackPanel
        state={state}
        onPreviewRollback={onPreviewRollback}
        onApplyRollback={onApplyRollback}
        onCancelRollback={onCancelRollback}
      />
    </aside>
  );
}

function getTaskStatusLabel(status: WorkbenchState["tasks"]["items"][number]["status"]) {
  if (status === "running") {
    return "执行中";
  }

  if (status === "completed") {
    return "已完成";
  }

  if (status === "failed") {
    return "已失败";
  }

  return "队列中";
}
