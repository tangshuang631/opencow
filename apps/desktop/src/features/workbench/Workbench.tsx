import type { ImportedKnowledgeFile, StorageCleanupTarget, WorkbenchState } from "./workbenchState";
import { useEffect, useState } from "react";
import { Composer } from "./components/Composer";
import { Inspector } from "./components/Inspector";
import { MainConversation } from "./components/MainConversation";
import { Sidebar, type WorkbenchViewId } from "./components/Sidebar";
import {
  getLocalizedPermissionModeLabel,
  getLocalizedPermissionReason,
  getLocalizedPermissionRiskSummary
} from "./workbenchText";
import {
  getShellDialogRecoveryNarrative,
  getShellRecoveryChecklist,
  shellCapabilityGroups
} from "./shellCapability";

type WorkbenchProps = {
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
  onSelectModel: (modelName: string) => void;
  onNewConversation: () => void;
  onRestoreRecentConversation: (conversationId: string) => void;
  onDeleteRecentConversation: (conversationId: string) => void;
  onImportKnowledgeFile: (path: string) => void;
  onRemoveKnowledgeFile: (path: string) => void;
  onSubmitTask: (message: string) => void;
};

const viewContent: Record<Exclude<WorkbenchViewId, "chat" | "history" | "audit" | "safety" | "knowledge">, { title: string; summary: string; details: string[] }> = {
  search: {
    title: "搜索",
    summary: "联网搜索能力会通过显式开关启用，默认保持本地优先。",
    details: ["从设置中配置 Provider 后，可在对话中请求联网搜索。", "所有联网能力都会留下来源和审计记录。"]
  },
  skills: {
    title: "Skills",
    summary: "管理本地 Skills 的安装、启用、匹配和检查。",
    details: ["启用或安装会走权限确认。", "对话中匹配到的 Skill 会保留审计和可回退记录。"]
  },
  npc: {
    title: "NPC",
    summary: "配置和使用受控 NPC 工作流，优先服务本地项目检查与展示。",
    details: ["NPC 只能通过已验证的 planner 路径进入任务链。", "写入、运行、截图和发布预览继续分阶段确认。"]
  },
  mcp: {
    title: "MCP",
    summary: "管理本地 MCP 插件扫描、检查和受控启动。",
    details: ["启动本地插件需要权限与高风险确认。", "扫描和检查保持只读优先。"]
  },
  settings: {
    title: "设置",
    summary: "配置本地模型、联网搜索、远程 API、Shell 能力、回退点和清理入口。",
    details: ["高级配置默认收纳，避免干扰主对话。", "Shell 能力、权限、确认和回退会在设置中统一说明。", "高风险能力开启、关闭和清理都会进入审计。"]
  }
};

type ModelSettingsTarget = "ollama" | "remote-api";

function WorkbenchContentPanel({ viewId }: { viewId: Exclude<WorkbenchViewId, "chat" | "history" | "audit" | "safety"> }) {
  const content = viewContent[viewId];

  return (
    <section className="workspace-panel" aria-label={content.title}>
      <header className="workspace-panel-header">
        <h1>{content.title}</h1>
        <p>{content.summary}</p>
      </header>
      <div className="workspace-panel-list">
        {content.details.map((detail) => (
          <p key={detail}>{detail}</p>
        ))}
      </div>
    </section>
  );
}

function RecentConversationsPanel({
  state,
  onRestoreRecentConversation,
  onDeleteRecentConversation
}: {
  state: WorkbenchState;
  onRestoreRecentConversation: (conversationId: string) => void;
  onDeleteRecentConversation: (conversationId: string) => void;
}) {
  const currentConversationEntries = state.conversation.entries.filter((entry) => entry.kind !== "system");
  const currentConversationNewestFirst = currentConversationEntries.slice().reverse();
  const currentConversationLatestUserEntry = currentConversationNewestFirst.find((entry) => entry.kind === "user");
  const currentConversationLatestAssistantEntry = currentConversationNewestFirst.find((entry) => entry.kind === "assistant");
  const currentConversationTitle = currentConversationLatestUserEntry?.summary.trim()
    || currentConversationLatestAssistantEntry?.title.trim()
    || "当前会话";
  const currentConversationSummary = currentConversationLatestAssistantEntry?.summary.trim()
    || currentConversationLatestUserEntry?.summary.trim()
    || "你当前正在进行的会话会在这里保留，直到你手动删除。";
  const hasCurrentConversation = currentConversationEntries.length > 0;

  return (
    <section className="workspace-panel" aria-label="最近会话">
      <header className="workspace-panel-header">
        <h1>最近会话</h1>
        <p>在这里恢复、查看和删除本地保留的最近对话，不需要先切回空白会话页。</p>
      </header>
      <div className="workspace-panel-list">
        {hasCurrentConversation ? (
          <div className="workspace-history-card workspace-history-card-current">
            <div className="workspace-history-card-meta">
              <span className="workspace-history-badge">当前会话</span>
              <span className="workspace-history-meta-text">
                {currentConversationEntries.length} 条消息
              </span>
            </div>
            <p>{currentConversationTitle}</p>
            <p className="muted">{currentConversationSummary}</p>
          </div>
        ) : null}
        {state.history.recentConversations.length === 0 ? (
          <p>还没有可恢复的最近会话。继续使用 opencow 后，新的非空会话会自动出现在这里。</p>
        ) : state.history.recentConversations.map((record) => (
          <div className="workspace-history-card" key={record.id}>
            <p>{record.title}</p>
            <p className="muted">{record.summary}</p>
            <div className="action-row">
              <button className="action-button" type="button" onClick={() => onRestoreRecentConversation(record.id)}>
                恢复这段会话
              </button>
              <button className="action-button" type="button" onClick={() => onDeleteRecentConversation(record.id)}>
                删除这段会话
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function renderKnowledgeFileCard(
  file: ImportedKnowledgeFile,
  onRemoveKnowledgeFile: (path: string) => void
) {
  return (
    <div className="workspace-history-card" key={file.path}>
      <p>{file.title}</p>
      <p className="muted">{file.path}</p>
      {file.status === "missing" ? (
        <p className="workspace-knowledge-warning">文件已失效，检索时会自动跳过。</p>
      ) : null}
      <div className="action-row">
        <button
          aria-label={`移出知识库：${file.title}`}
          className="action-button"
          type="button"
          onClick={() => onRemoveKnowledgeFile(file.path)}
        >
          移出知识库
        </button>
      </div>
    </div>
  );
}

function KnowledgePanel({
  state,
  onImportKnowledgeFile,
  onRemoveKnowledgeFile
}: {
  state: WorkbenchState;
  onImportKnowledgeFile: (path: string) => void;
  onRemoveKnowledgeFile: (path: string) => void;
}) {
  return (
    <section className="workspace-panel" aria-label="知识库">
      <header className="workspace-panel-header">
        <h1>知识库</h1>
        <p>导入、索引和检索本地知识文件，优先保持工作区内可追踪、可恢复。</p>
      </header>
      <div className="workspace-panel-list">
        <p>已索引文件 {state.storage.knowledgeCount}</p>
        {state.knowledge.importedFiles.length === 0 ? (
          <p>还没有已纳入知识库的文件。先从下方候选文件中手动加入。</p>
        ) : state.knowledge.importedFiles.map((file) => renderKnowledgeFileCard(file, onRemoveKnowledgeFile))}
        <p>可导入文件</p>
        {state.knowledge.availableFiles.length === 0 ? (
          <p>当前没有新的可导入文件，稍后可以把更多 md、txt 文档放进工作区。</p>
        ) : state.knowledge.availableFiles.map((file) => (
          <div className="workspace-history-card" key={file.path}>
            <p>{file.title}</p>
            <p className="muted">{file.path}</p>
            <div className="action-row">
              <button
                aria-label={`加入知识库：${file.title}`}
                className="action-button"
                type="button"
                onClick={() => onImportKnowledgeFile(file.path)}
              >
                加入知识库
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SafetyPanel({
  state,
  onApproveDangerousAction,
  onCancelDangerousAction,
  onApprovePermissionRequest,
  onCancelPermissionRequest
}: {
  state: WorkbenchState;
  onApproveDangerousAction: () => void;
  onCancelDangerousAction: () => void;
  onApprovePermissionRequest: () => void;
  onCancelPermissionRequest: () => void;
}) {
  const pendingPermission = state.permission.pendingModeChange;
  const pendingConfirmation = state.confirmation.pending;
  const safetyError = state.error?.module === "permission" ? state.error : null;

  return (
    <section className="workspace-panel" aria-label="安全">
      <header className="workspace-panel-header">
        <h1>安全</h1>
        <p>查看权限模式、高风险确认和防卡死策略。</p>
      </header>
      <div className="workspace-panel-list">
        <p>当前权限: {state.permission.label}</p>
        <p>{state.permission.summary}</p>
        <p>最近安全事件: {state.audit.lastEvent.module === "permission" ? state.audit.summary : "暂无权限事件"}</p>
        <p>重复检测、超时、最大尝试次数和回退记录已启用。</p>
        {safetyError ? (
          <>
            <p>{safetyError.detail}</p>
            <p>{safetyError.actionLabel}</p>
          </>
        ) : null}
        {pendingPermission ? (
          <>
            <p>待确认权限: {getLocalizedPermissionModeLabel(pendingPermission.targetMode)}</p>
            <p>{getLocalizedPermissionReason(pendingPermission.reason)}</p>
            <p>{getLocalizedPermissionRiskSummary(pendingPermission.riskSummary)}</p>
            <div className="action-row">
              <button className="action-button action-button-primary" type="button" onClick={onApprovePermissionRequest}>
                批准提权
              </button>
              <button className="action-button" type="button" onClick={onCancelPermissionRequest}>
                取消提权
              </button>
            </div>
          </>
        ) : null}
        {pendingConfirmation ? (
          <>
            <p>待确认高风险操作: {pendingConfirmation.title}</p>
            <p>{pendingConfirmation.summary}</p>
            <p>命令预览: {pendingConfirmation.commandPreview}</p>
            <p>所需权限: {pendingConfirmation.requiredMode}</p>
            <div className="action-row">
              <button className="action-button action-button-primary" type="button" onClick={onApproveDangerousAction}>
                批准高风险操作
              </button>
              <button className="action-button" type="button" onClick={onCancelDangerousAction}>
                取消高风险操作
              </button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function AuditPanel({
  state,
  onCleanupStorage
}: {
  state: WorkbenchState;
  onCleanupStorage: (target: StorageCleanupTarget) => void;
}) {
  return (
    <section className="workspace-panel" aria-label="审计">
      <header className="workspace-panel-header">
        <h1>审计</h1>
        <p>查看最近的对话、权限、工具和任务事件。</p>
      </header>
      <div className="workspace-panel-list">
        <p>日志 {state.storage.logCount}</p>
        <p>{state.audit.summary}</p>
        <p>模块: {state.audit.lastEvent.module}</p>
        <p>来源: {state.audit.lastEvent.source}</p>
        <p>时间: {state.audit.lastEvent.timestamp}</p>
        <p>{state.audit.lastEvent.detail}</p>
      </div>
      <div className="action-row">
        <button className="action-button" type="button" onClick={() => onCleanupStorage("logs")}>
          清空日志
        </button>
      </div>
    </section>
  );
}

function SettingsPanel({
  state,
  focusTarget,
  onRetryOllamaCheck,
  onToggleRemoteApi,
  onToggleSearch,
  onSaveRemoteApiConfig,
  onSaveSearchProviderConfig,
  onUpdateRollbackLimit,
  onCleanupStorage
}: {
  state: WorkbenchState;
  focusTarget: ModelSettingsTarget | null;
  onRetryOllamaCheck: () => void;
  onToggleRemoteApi: (enabled: boolean) => void;
  onToggleSearch: (enabled: boolean) => void;
  onSaveRemoteApiConfig: (payload: { baseUrl: string; providerLabel: string; apiKey: string }) => void;
  onSaveSearchProviderConfig: (payload: { providerLabel: string }) => void;
  onUpdateRollbackLimit: (limit: number) => void;
  onCleanupStorage: (target: StorageCleanupTarget) => void;
}) {
  const [remoteApiBaseUrl, setRemoteApiBaseUrl] = useState(state.settings.remoteApi.baseUrl);
  const [remoteApiProviderLabel, setRemoteApiProviderLabel] = useState(state.settings.remoteApi.providerLabel);
  const [remoteApiKey, setRemoteApiKey] = useState(state.settings.remoteApi.apiKey);
  const [searchProviderLabel, setSearchProviderLabel] = useState(state.search.providerLabel);
  const activeFocusLabel = focusTarget === "remote-api" ? "大模型 API 设置" : "Ollama 设置";

  useEffect(() => {
    setRemoteApiBaseUrl(state.settings.remoteApi.baseUrl);
    setRemoteApiProviderLabel(state.settings.remoteApi.providerLabel);
    setRemoteApiKey(state.settings.remoteApi.apiKey);
  }, [
    state.settings.remoteApi.apiKey,
    state.settings.remoteApi.baseUrl,
    state.settings.remoteApi.providerLabel
  ]);

  useEffect(() => {
    setSearchProviderLabel(state.search.providerLabel);
  }, [state.search.providerLabel]);

  return (
    <section className="workspace-panel settings-panel" aria-label="设置">
      <header className="workspace-panel-header">
        <h1>设置</h1>
        <p>{activeFocusLabel}</p>
      </header>

      <section className={`settings-section ${focusTarget === "ollama" ? "settings-section-focused" : ""}`}>
        <h2>Ollama 设置</h2>
        <p>默认使用本地 Ollama。没有检测到服务或模型时，可在这里检查状态后继续配置。</p>
        <div className="settings-line-list">
          <p>状态: {state.model.status}</p>
          <p>地址: {state.model.endpoint}</p>
          <p>当前模型: {state.model.activeModel}</p>
          {state.model.diagnostic ? <p>{state.model.diagnostic}</p> : null}
          <p>可用模型: {state.model.availableModels.length}</p>
        </div>
        <div className="action-row">
          <button className="action-button action-button-primary" type="button" onClick={onRetryOllamaCheck}>
            重新检测 Ollama
          </button>
        </div>
      </section>

      <section className={`settings-section ${focusTarget === "remote-api" ? "settings-section-focused" : ""}`}>
        <h2>大模型 API 设置</h2>
        <p>本地 Ollama 不可用时，可以选择配置远程大模型 API。默认仍保持本地优先。</p>
        <div className="action-row" aria-label="远程 API 开关">
          <button
            className="action-button"
            type="button"
            onClick={() => onToggleRemoteApi(!state.settings.remoteApi.enabled)}
          >
            {state.settings.remoteApi.enabled ? "关闭远程 API" : "开启远程 API"}
          </button>
        </div>
        <div className="settings-form">
          <label>
            <span>远程 API Base URL</span>
            <input
              aria-label="远程 API Base URL"
              type="text"
              value={remoteApiBaseUrl}
              onChange={(event) => setRemoteApiBaseUrl(event.target.value)}
            />
          </label>
          <label>
            <span>远程 API Provider</span>
            <input
              aria-label="远程 API Provider"
              type="text"
              value={remoteApiProviderLabel}
              onChange={(event) => setRemoteApiProviderLabel(event.target.value)}
            />
          </label>
          <label>
            <span>远程 API Key</span>
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
            className="action-button action-button-primary"
            type="button"
            onClick={() =>
              onSaveRemoteApiConfig({
                baseUrl: remoteApiBaseUrl,
                providerLabel: remoteApiProviderLabel,
                apiKey: remoteApiKey
              })
            }
          >
            保存大模型 API 配置
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>联网搜索设置</h2>
        <p>联网搜索默认关闭。开启后，搜索来源、Provider 和结果摘要仍会进入记录。</p>
        <div className="action-row" aria-label="联网搜索开关">
          <button className="action-button" type="button" onClick={() => onToggleSearch(!state.search.enabled)}>
            {state.search.enabled ? "关闭联网搜索" : "开启联网搜索"}
          </button>
        </div>
        <div className="settings-form">
          <label>
            <span>联网搜索 Provider</span>
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
            className="action-button action-button-primary"
            type="button"
            onClick={() =>
              onSaveSearchProviderConfig({
                providerLabel: searchProviderLabel
              })
            }
          >
            保存联网搜索配置
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>Shell 能力与恢复路径</h2>
        <p>这部分默认收纳在设置里，不占首页主对话空间。Shell 会按权限分层执行，并把失败恢复路径留给对话继续处理。</p>
        <div className="settings-line-list">
          {shellCapabilityGroups.map((group) => (
            <div key={group.title} className="settings-shell-card">
              <p>{group.title} · {group.permission}</p>
              <p>{group.summary}</p>
              <p className="muted">恢复路径: {group.recovery}</p>
            </div>
          ))}
        </div>
        <div className="settings-line-list">
          {getShellRecoveryChecklist().map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
        <p className="muted">{getShellDialogRecoveryNarrative()}</p>
      </section>

      <section className="settings-section">
        <h2>回退与本地清理</h2>
        <p>回退点、会话记录、日志、缓存、快照和知识库索引统一在设置中管理。</p>
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
        <div className="settings-line-list">
          <p>会话 {state.storage.sessionCount}</p>
          <p>日志 {state.storage.logCount}</p>
          <p>缓存条目 {state.storage.cacheCount}</p>
          <p>快照 {state.storage.snapshotCount}</p>
          <p>知识库索引 {state.storage.knowledgeCount}</p>
        </div>
        <div className="action-row" aria-label="本地清理入口">
          <button className="action-button" type="button" onClick={() => onCleanupStorage("conversation")}>
            清空会话
          </button>
          <button className="action-button" type="button" onClick={() => onCleanupStorage("logs")}>
            清空日志
          </button>
          <button className="action-button" type="button" onClick={() => onCleanupStorage("cache")}>
            清空缓存
          </button>
          <button className="action-button" type="button" onClick={() => onCleanupStorage("snapshots")}>
            清空快照
          </button>
          <button className="action-button" type="button" onClick={() => onCleanupStorage("knowledge")}>
            清空知识库索引
          </button>
        </div>
      </section>
    </section>
  );
}

export function Workbench({
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
  onSaveSearchProviderConfig,
  onSelectModel,
  onNewConversation,
  onRestoreRecentConversation,
  onDeleteRecentConversation,
  onImportKnowledgeFile,
  onRemoveKnowledgeFile,
  onSubmitTask
}: WorkbenchProps) {
  const [activeView, setActiveView] = useState<WorkbenchViewId>("chat");
  const [settingsFocus, setSettingsFocus] = useState<ModelSettingsTarget | null>(null);
  const isChatView = activeView === "chat";
  const isSettingsView = activeView === "settings";

  function handleSelectView(viewId: WorkbenchViewId) {
    setActiveView(viewId);
    setSettingsFocus(null);
  }

  function handleNewConversationClick() {
    setActiveView("chat");
    setSettingsFocus(null);
    onNewConversation();
  }

  function handleOpenModelSettings(target: ModelSettingsTarget) {
    setActiveView("settings");
    setSettingsFocus(target);
  }

  function handleSubmitTask(message: string) {
    setActiveView("chat");
    setSettingsFocus(null);
    onSubmitTask(message);
  }

  function handleRetryLocalTask(taskId?: string) {
    setActiveView("chat");
    setSettingsFocus(null);
    onRetryLocalTask(taskId);
  }

  return (
    <main className="workbench" aria-label="opencow 工作台">
      <Sidebar
        activeView={activeView}
        onSelectView={handleSelectView}
        onNewConversation={handleNewConversationClick}
      />
      <section className="workbench-main">
        {isChatView ? (
          <MainConversation
            state={state}
            onPreviewRollback={onPreviewRollback}
            onCancelActiveTask={onCancelActiveTask}
            onRestoreRecentConversation={onRestoreRecentConversation}
            onDeleteRecentConversation={onDeleteRecentConversation}
          />
        ) : activeView === "history" ? (
          <RecentConversationsPanel
            state={state}
            onRestoreRecentConversation={onRestoreRecentConversation}
            onDeleteRecentConversation={onDeleteRecentConversation}
          />
        ) : activeView === "knowledge" ? (
          <KnowledgePanel
            state={state}
            onImportKnowledgeFile={onImportKnowledgeFile}
            onRemoveKnowledgeFile={onRemoveKnowledgeFile}
          />
        ) : activeView === "audit" ? (
          <AuditPanel state={state} onCleanupStorage={onCleanupStorage} />
        ) : activeView === "safety" ? (
          <SafetyPanel
            state={state}
            onApproveDangerousAction={onApproveDangerousAction}
            onCancelDangerousAction={onCancelDangerousAction}
            onApprovePermissionRequest={onApprovePermissionRequest}
            onCancelPermissionRequest={onCancelPermissionRequest}
          />
        ) : isSettingsView ? (
          <SettingsPanel
            state={state}
            focusTarget={settingsFocus}
            onRetryOllamaCheck={onRetryOllamaCheck}
            onToggleRemoteApi={onToggleRemoteApi}
            onToggleSearch={onToggleSearch}
            onSaveRemoteApiConfig={onSaveRemoteApiConfig}
            onSaveSearchProviderConfig={onSaveSearchProviderConfig}
            onUpdateRollbackLimit={onUpdateRollbackLimit}
            onCleanupStorage={onCleanupStorage}
          />
        ) : (
          <WorkbenchContentPanel viewId={activeView} />
        )}
        <Composer
          state={state}
          onSubmitTask={handleSubmitTask}
          onCancelActiveTask={onCancelActiveTask}
          onSelectModel={onSelectModel}
          onOpenModelSettings={handleOpenModelSettings}
        />
      </section>
      <Inspector
        state={state}
        onApproveDangerousAction={onApproveDangerousAction}
        onCancelDangerousAction={onCancelDangerousAction}
        onApprovePermissionRequest={onApprovePermissionRequest}
        onCancelPermissionRequest={onCancelPermissionRequest}
        onRetryOllamaCheck={onRetryOllamaCheck}
        onRecoverToolError={onRecoverToolError}
        onPreviewRollback={onPreviewRollback}
        onApplyRollback={onApplyRollback}
        onCancelRollback={onCancelRollback}
        onRetryLocalTask={handleRetryLocalTask}
        onCancelActiveTask={onCancelActiveTask}
        onUpdateRollbackLimit={onUpdateRollbackLimit}
        onCleanupStorage={onCleanupStorage}
        onToggleRemoteApi={onToggleRemoteApi}
        onToggleSearch={onToggleSearch}
        onSaveRemoteApiConfig={onSaveRemoteApiConfig}
        onSaveSearchProviderConfig={onSaveSearchProviderConfig}
      />
    </main>
  );
}
