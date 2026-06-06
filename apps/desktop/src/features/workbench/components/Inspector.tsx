import { FileText, Globe2, ListChecks, ScrollText } from "lucide-react";
import { useState } from "react";
import { RollbackPanel } from "./RollbackPanel";
import type { StorageCleanupTarget, WorkbenchState } from "../workbenchState";
import { normalizeWorkbenchText } from "../workbenchText";

type InspectorProps = {
  state: WorkbenchState;
  onApproveDangerousAction: () => void;
  onCancelDangerousAction: () => void;
  onApprovePermissionRequest: () => void;
  onCancelPermissionRequest: () => void;
  onRetryOllamaCheck: () => void;
  onPreviewRollback: (targetEntryId: string) => void;
  onApplyRollback: () => void;
  onCancelRollback: () => void;
  onRetryLocalTask: () => void;
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
  sourceProvider: "\u641c\u7d22\u63d0\u4f9b\u65b9",
  sourceTitle: "\u6765\u6e90\u6807\u9898",
  sourceUrl: "\u6765\u6e90\u5730\u5740",
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
  stopTask: "\u505c\u6b62\u4efb\u52a1",
  retryTask: "\u91cd\u8bd5\u672c\u5730\u4efb\u52a1",
  noLocalTasks: "\u6682\u65e0\u672c\u5730\u4efb\u52a1",
  tools: "\u5de5\u5177",
  modelsDetectedPrefix: "\u5df2\u68c0\u6d4b",
  modelsDetectedSuffix: "\u4e2a\u672c\u5730\u6a21\u578b",
  waitingModels: "\u7b49\u5f85\u672c\u5730\u6a21\u578b",
  logs: "\u65e5\u5fd7",
  module: "\u6a21\u5757",
  source: "\u6765\u6e90",
  time: "\u65f6\u95f4",
  errors: "\u9519\u8bef",
  suggestion: "\u5efa\u8bae",
  noErrors: "\u5f53\u524d\u6ca1\u6709\u6d3b\u52a8\u9519\u8bef",
  advanced: "\u9ad8\u7ea7\u8bbe\u7f6e",
  remoteApiOn: "\u8fdc\u7a0b API \u5df2\u5f00\u542f",
  remoteApiOff: "\u8fdc\u7a0b API \u9ed8\u8ba4\u5173\u95ed",
  remoteApiCollapsed: "\u4fdd\u7559 baseUrl \u548c API \u63a5\u5165\u53e3\uff0c\u6309\u9700\u5c55\u5f00\u3002",
  remoteApiExpanded: "\u8fdc\u7a0b API \u8bbe\u7f6e\u5df2\u5c55\u5f00\u3002",
  searchOn: "\u8054\u7f51\u641c\u7d22\u5df2\u5f00\u542f",
  searchOff: "\u8054\u7f51\u641c\u7d22\u9ed8\u8ba4\u5173\u95ed",
  networkToggles: "\u7f51\u7edc\u5f00\u5173",
  disableRemoteApi: "\u5173\u95ed\u8fdc\u7a0b API",
  enableRemoteApi: "\u5f00\u542f\u8fdc\u7a0b API",
  disableSearch: "\u5173\u95ed\u8054\u7f51\u641c\u7d22",
  enableSearch: "\u5f00\u542f\u8054\u7f51\u641c\u7d22",
  searchProviderLabel: "\u8054\u7f51\u641c\u7d22 Provider",
  saveSearchProvider: "\u4fdd\u5b58\u8054\u7f51\u641c\u7d22\u914d\u7f6e",
  remoteApiBaseUrl: "\u8fdc\u7a0b API Base URL",
  remoteApiProvider: "\u8fdc\u7a0b API Provider",
  remoteApiKey: "\u8fdc\u7a0b API Key",
  saveRemoteApi: "\u4fdd\u5b58\u8fdc\u7a0b API \u914d\u7f6e",
  rollbackLimit: "\u56de\u9000\u70b9\u4e0a\u9650",
  rollbackHintPrefix: "\u5f53\u524d\u6700\u591a\u4fdd\u7559",
  rollbackHintSuffix: "\u6bb5\u53ef\u56de\u9000\u70b9\u3002",
  rollbackQuick: "\u56de\u9000\u70b9\u4e0a\u9650\u5feb\u6377\u8bbe\u7f6e",
  session: "\u4f1a\u8bdd",
  logCount: "\u65e5\u5fd7",
  cacheCount: "\u7f13\u5b58\u6761\u76ee",
  snapshotCount: "\u5feb\u7167",
  knowledgeCount: "\u77e5\u8bc6\u5e93\u7d22\u5f15",
  localCleanup: "\u672c\u5730\u6e05\u7406\u5165\u53e3",
  clearConversation: "\u6e05\u7a7a\u4f1a\u8bdd",
  clearLogs: "\u6e05\u7a7a\u65e5\u5fd7",
  clearCache: "\u6e05\u7a7a\u7f13\u5b58",
  clearSnapshots: "\u6e05\u7a7a\u5feb\u7167",
  clearKnowledge: "\u6e05\u7a7a\u77e5\u8bc6\u5e93\u7d22\u5f15",
  running: "\u6267\u884c\u4e2d",
  completed: "\u5df2\u5b8c\u6210",
  failed: "\u5df2\u5931\u8d25",
  queued: "\u961f\u5217\u4e2d"
} as const;

export function Inspector({
  state,
  onApproveDangerousAction,
  onCancelDangerousAction,
  onApprovePermissionRequest,
  onCancelPermissionRequest,
  onRetryOllamaCheck,
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
  const visibleSources = state.sources.items.slice(0, 3);
  const visibleTasks = state.tasks.items.slice(0, 3);
  const hasModels = state.model.availableModels.length > 0;
  const pendingConfirmation = state.confirmation.pending;
  const capabilityAuditSources = new Set([
    "capability_toggle_request",
    "capability_toggle_approved",
    "capability_toggle_cancelled"
  ]);
  const isCapabilityConfirmationContext = Boolean(pendingConfirmation?.requestedFeature)
    || capabilityAuditSources.has(state.audit.lastEvent.source);
  const [remoteApiBaseUrl, setRemoteApiBaseUrl] = useState(state.settings.remoteApi.baseUrl);
  const [remoteApiProviderLabel, setRemoteApiProviderLabel] = useState(state.settings.remoteApi.providerLabel);
  const [remoteApiKey, setRemoteApiKey] = useState(state.settings.remoteApi.apiKey);
  const [searchProviderLabel, setSearchProviderLabel] = useState(state.search.providerLabel || "Tavily");

  return (
    <aside className="inspector" aria-label={TEXT.panel}>
      <section>
        <h2>
          <FileText aria-hidden="true" size={16} />
          {TEXT.output}
        </h2>
        <p className="muted">{normalizeWorkbenchText(state.output.title)}</p>
        <p className="muted">{normalizeWorkbenchText(state.output.summary)}</p>
      </section>

      <section>
        <h2>
          <Globe2 aria-hidden="true" size={16} />
          {TEXT.sources}
        </h2>
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
      </section>

      <section>
        <h2>{normalizeWorkbenchText(state.permission.confirmationTitle)}</h2>
        <p className="muted">{normalizeWorkbenchText(state.permission.confirmationSummary)}</p>
        {state.permission.pendingModeChange ? (
          <>
            <p className="muted">{TEXT.permissionPending}: {state.permission.pendingModeChange.targetMode}</p>
            <p className="muted">{TEXT.permissionReason}: {normalizeWorkbenchText(state.permission.pendingModeChange.reason)}</p>
            <p className="muted">{TEXT.permissionRisk}: {normalizeWorkbenchText(state.permission.pendingModeChange.riskSummary)}</p>
            <div className="action-row">
              <button className="action-button action-button-primary" type="button" onClick={onApprovePermissionRequest}>
                {TEXT.approvePrivilege}
              </button>
              <button className="action-button" type="button" onClick={onCancelPermissionRequest}>
                {TEXT.cancelPrivilege}
              </button>
            </div>
          </>
        ) : (
          <p className="muted">{TEXT.noPermissionUpgrade}</p>
        )}

        {pendingConfirmation ? (
          <>
            <p className="muted">{normalizeWorkbenchText(pendingConfirmation.title)}</p>
            <p className="muted">{normalizeWorkbenchText(pendingConfirmation.summary)}</p>
            <p className="muted">{TEXT.commandPreview}: {normalizeWorkbenchText(pendingConfirmation.commandPreview)}</p>
            <p className="muted">{TEXT.impact}: {normalizeWorkbenchText(pendingConfirmation.impact)}</p>
            <p className="muted">{TEXT.requiredPermission}: {pendingConfirmation.requiredMode}</p>
            {pendingConfirmation.safetySummary ? (
              <p className="muted">{TEXT.safety}: {normalizeWorkbenchText(pendingConfirmation.safetySummary)}</p>
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
        ) : (
          <p className="muted">{isCapabilityConfirmationContext ? TEXT.noCapability : TEXT.noDanger}</p>
        )}
      </section>

      <section>
        <h2>
          <ListChecks aria-hidden="true" size={16} />
          {TEXT.localTasks}
        </h2>
        <p className="muted">{TEXT.taskPending} {state.tasks.pendingCount} {TEXT.taskUnit}</p>
        {visibleTasks.length > 0 ? (
          <div className="task-queue-list">
            {visibleTasks.map((task) => (
              <div key={task.id} className="task-queue-item">
                <span className="task-queue-status">{getTaskStatusLabel(task.status)}</span>
                <p className="task-queue-summary">{normalizeWorkbenchText(task.summary)}</p>
                {task.status === "running" ? (
                  <div className="action-row">
                    <button aria-label={TEXT.stopTask} className="action-button" type="button" onClick={onCancelActiveTask}>
                      {TEXT.stopTask}
                    </button>
                  </div>
                ) : null}
                {task.status === "failed" ? (
                  <div className="action-row">
                    <button
                      aria-label={TEXT.retryTask}
                      className="action-button action-button-primary"
                      type="button"
                      onClick={onRetryLocalTask}
                    >
                      {TEXT.retryTask}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">{TEXT.noLocalTasks}</p>
        )}
      </section>

      <section>
        <h2>
          <ListChecks aria-hidden="true" size={16} />
          {TEXT.tools}
        </h2>
        <p className="muted">
          {state.tools.lastResult
            ? `${normalizeWorkbenchText(state.tools.lastResult.toolLabel)}: ${normalizeWorkbenchText(state.tools.lastResult.summary)}`
            : hasModels
              ? `${TEXT.modelsDetectedPrefix} ${state.model.availableModels.length} ${TEXT.modelsDetectedSuffix}`
              : TEXT.waitingModels}
        </p>
      </section>

      <section>
        <h2>
          <ScrollText aria-hidden="true" size={16} />
          {TEXT.logs}
        </h2>
        <p className="muted">{normalizeWorkbenchText(state.audit.summary)}</p>
        <p className="muted">{TEXT.module}: {normalizeWorkbenchText(state.audit.lastEvent.module)}</p>
        <p className="muted">{TEXT.source}: {normalizeWorkbenchText(state.audit.lastEvent.source)}</p>
        <p className="muted">{TEXT.time}: {normalizeWorkbenchText(state.audit.lastEvent.timestamp)}</p>
        <p className="muted">{normalizeWorkbenchText(state.audit.lastEvent.detail)}</p>
      </section>

      <section>
        <h2>{TEXT.errors}</h2>
        {state.error ? (
          <>
            <p className="muted">{normalizeWorkbenchText(state.error.summary)}</p>
            <p className="muted">{TEXT.module}: {normalizeWorkbenchText(state.error.module)}</p>
            <p className="muted">{TEXT.source}: {normalizeWorkbenchText(state.error.source)}</p>
            <p className="muted">{TEXT.time}: {normalizeWorkbenchText(state.error.timestamp)}</p>
            <p className="muted">{normalizeWorkbenchText(state.error.detail)}</p>
            <p className="muted">{TEXT.suggestion}: {normalizeWorkbenchText(state.error.actionLabel)}</p>
            {state.error.module === "ollama" ? (
              <div className="action-row">
                <button className="action-button action-button-primary" type="button" onClick={onRetryOllamaCheck}>
                  {normalizeWorkbenchText(state.error.actionLabel)}
                </button>
              </div>
            ) : null}
            {state.error.module === "tasks" ? (
              <div className="action-row">
                <button className="action-button action-button-primary" type="button" onClick={onRetryLocalTask}>
                  {TEXT.retryTask}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="muted">{TEXT.noErrors}</p>
        )}
      </section>

      <section>
        <h2>{TEXT.advanced}</h2>
        <p className="muted">{state.settings.remoteApi.enabled ? TEXT.remoteApiOn : TEXT.remoteApiOff}</p>
        <p className="muted">
          {state.settings.remoteApi.collapsed ? TEXT.remoteApiCollapsed : TEXT.remoteApiExpanded}
        </p>
        <p className="muted">{state.search.enabled ? TEXT.searchOn : TEXT.searchOff}</p>
        <div className="action-row" aria-label={TEXT.networkToggles}>
          <button
            className="action-button"
            type="button"
            onClick={() => onToggleRemoteApi(!state.settings.remoteApi.enabled)}
          >
            {state.settings.remoteApi.enabled ? TEXT.disableRemoteApi : TEXT.enableRemoteApi}
          </button>
          <button className="action-button" type="button" onClick={() => onToggleSearch(!state.search.enabled)}>
            {state.search.enabled ? TEXT.disableSearch : TEXT.enableSearch}
          </button>
        </div>
        <div className="action-row">
          <label>
            <span className="muted">{TEXT.searchProviderLabel}</span>
            <input
              aria-label={TEXT.searchProviderLabel}
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
            onClick={() =>
              onSaveSearchProviderConfig({
                providerLabel: searchProviderLabel
              })
            }
          >
            {TEXT.saveSearchProvider}
          </button>
        </div>
        <div className="action-row">
          <label>
            <span className="muted">{TEXT.remoteApiBaseUrl}</span>
            <input
              aria-label={TEXT.remoteApiBaseUrl}
              type="text"
              value={remoteApiBaseUrl}
              onChange={(event) => setRemoteApiBaseUrl(event.target.value)}
            />
          </label>
        </div>
        <div className="action-row">
          <label>
            <span className="muted">{TEXT.remoteApiProvider}</span>
            <input
              aria-label={TEXT.remoteApiProvider}
              type="text"
              value={remoteApiProviderLabel}
              onChange={(event) => setRemoteApiProviderLabel(event.target.value)}
            />
          </label>
        </div>
        <div className="action-row">
          <label>
            <span className="muted">{TEXT.remoteApiKey}</span>
            <input
              aria-label={TEXT.remoteApiKey}
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
            {TEXT.saveRemoteApi}
          </button>
        </div>
        <p className="muted">{TEXT.rollbackLimit} {state.rollback.activeLimit} / {state.rollback.maxLimit}</p>
        <p className="muted">{TEXT.rollbackHintPrefix} {state.rollback.activeLimit} {TEXT.rollbackHintSuffix}</p>
        <div className="action-row" aria-label={TEXT.rollbackQuick}>
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
        <p className="muted">{TEXT.session} {state.storage.sessionCount}</p>
        <p className="muted">{TEXT.logCount} {state.storage.logCount}</p>
        <p className="muted">{TEXT.cacheCount} {state.storage.cacheCount}</p>
        <p className="muted">{TEXT.snapshotCount} {state.storage.snapshotCount}</p>
        <p className="muted">{TEXT.knowledgeCount} {state.storage.knowledgeCount}</p>
        <div className="action-row" aria-label={TEXT.localCleanup}>
          <button className="action-button" type="button" onClick={() => onCleanupStorage("conversation")}>
            {TEXT.clearConversation}
          </button>
          <button className="action-button" type="button" onClick={() => onCleanupStorage("logs")}>
            {TEXT.clearLogs}
          </button>
        </div>
        <div className="action-row">
          <button className="action-button" type="button" onClick={() => onCleanupStorage("cache")}>
            {TEXT.clearCache}
          </button>
          <button className="action-button" type="button" onClick={() => onCleanupStorage("snapshots")}>
            {TEXT.clearSnapshots}
          </button>
        </div>
        <div className="action-row">
          <button className="action-button" type="button" onClick={() => onCleanupStorage("knowledge")}>
            {TEXT.clearKnowledge}
          </button>
        </div>
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
    return TEXT.running;
  }

  if (status === "completed") {
    return TEXT.completed;
  }

  if (status === "failed") {
    return TEXT.failed;
  }

  return TEXT.queued;
}
