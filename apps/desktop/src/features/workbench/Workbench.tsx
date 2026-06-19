import type { ChatAttachment, ImportedKnowledgeFile, StorageCleanupTarget, WorkbenchState } from "./workbenchState";
import { useEffect, useRef, useState } from "react";
import { Composer } from "./components/Composer";
import { Inspector } from "./components/Inspector";
import { MainConversation } from "./components/MainConversation";
import { Sidebar, type WorkbenchViewId } from "./components/Sidebar";
import { openChatAttachment } from "./chatAttachments";
import {
  disableLocalSkill,
  enableLocalSkill,
  inspectLocalMcpPlugin,
  installLocalSkill,
  listEnabledLocalSkills,
  loadOpenClawCapabilityOverview,
  matchEnabledLocalSkills,
  previewLocalMcpPluginStart,
  startLocalMcpPlugin,
  scanLocalMcpPlugins,
  scanLocalSkills,
  writeNpcConfig,
  type EnabledLocalSkillMatchResult,
  type EnabledLocalSkillsResult,
  type LocalMcpPluginInspectResult,
  type LocalMcpPluginScanResult,
  type LocalMcpPluginStartPreviewResult,
  type LocalSkillScanResult,
  type OpenClawCapabilityOverview
} from "../assistant/localAssistantService";
import {
  getLocalizedPermissionModeLabel,
  getLocalizedPermissionReason,
  getLocalizedPermissionRiskSummary
} from "./workbenchText";
import { getChatCapableOllamaModels } from "./workbenchState";
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
  onSelectNpcModel?: (modelName: string) => void;
  onNewConversation: () => void;
  onArchiveConversation: () => void;
  onRestoreRecentConversation: (conversationId: string) => void;
  onDeleteRecentConversation: (conversationId: string) => void;
  onImportKnowledgeFile: (path: string) => void;
  onImportLocalKnowledgeFiles?: (files: File[]) => void;
  onRemoveKnowledgeFile: (path: string) => void;
  knowledgeLibraryLabel?: string;
  knowledgeLibraries?: Array<{
    id: string;
    label: string;
    description?: string;
    active: boolean;
  }>;
  onCreateKnowledgeLibrary?: (name: string, description?: string) => void;
  onSelectKnowledgeLibrary?: (libraryId: string) => void;
  onSubmitTask: (message: string, attachments?: ChatAttachment[]) => void;
  onAddComposerAttachments?: (attachments: ChatAttachment[]) => void;
  onRemoveComposerAttachment?: (attachmentId: string) => void;
  onRequestClose?: () => void;
  onMinimizeApp?: () => void;
};

type StaticWorkbenchViewId = Exclude<WorkbenchViewId, "chat" | "audit" | "safety" | "knowledge">;

const viewContent: Record<StaticWorkbenchViewId, { title: string; summary: string; details: string[] }> = {
  history: {
    title: "历史",
    summary: "历史会话已并入当前草稿链路与设置恢复入口，主工作区不再单独承载旧历史库。",
    details: ["左侧会话区展示当前草稿链路里的最近会话。", "已归档历史会话统一进入设置页的恢复会话区域。"]
  },
  search: {
    title: "搜索",
    summary: "联网搜索能力会通过显式开关启用，默认保持本地优先。",
    details: ["从设置中配置 Provider 后，可在对话中请求联网搜索。", "所有联网能力都会留下来源和审计记录。"]
  },
  skills: {
    title: "Skills",
    summary: "管理本地 Skills 的安装、启用、匹配和检查。",
    details: ["启用或安装会走权限确认。", "对话中匹配到的 Skill 会写入审计和可回退记录。"]
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

type WorkspaceAuditEvent = WorkbenchState["audit"]["lastEvent"] & {
  summary: string;
  id: string;
};

type SkillsPanelState = {
  loading: boolean;
  error: string | null;
  scan: LocalSkillScanResult | null;
  enabled: EnabledLocalSkillsResult | null;
  match: EnabledLocalSkillMatchResult | null;
  query: string;
  actionQuery: string;
};

type MspPanelState = {
  loading: boolean;
  error: string | null;
  scan: LocalMcpPluginScanResult | null;
  inspect: LocalMcpPluginInspectResult | null;
  preview: LocalMcpPluginStartPreviewResult | null;
  query: string;
  actionQuery: string;
};

type NpcPanelState = {
  loading: boolean;
  error: string | null;
  capability: OpenClawCapabilityOverview | null;
  promptDraft: string;
  saveStatus: string | null;
};

function createAuditEventId(event: WorkbenchState["audit"]["lastEvent"]) {
  return `${event.timestamp}::${event.module}::${event.source}::${event.detail}`;
}

function SkillsPanel({
  state,
  panelState,
  onRefresh,
  onQueryChange,
  onRunMatch,
  onSkillActionQueryChange,
  onEnableSkill,
  onInstallSkill,
  onDisableSkill
}: {
  state: WorkbenchState;
  panelState: SkillsPanelState;
  onRefresh: () => void;
  onQueryChange: (query: string) => void;
  onRunMatch: () => void;
  onSkillActionQueryChange: (query: string) => void;
  onEnableSkill: () => void;
  onInstallSkill: () => void;
  onDisableSkill: () => void;
}) {
  const enabledItems = panelState.enabled?.items ?? [];
  const scannedItems = panelState.scan?.items ?? [];
  const matchedItems = panelState.match?.items ?? [];
  const actionItems = panelState.scan?.items ?? panelState.enabled?.items ?? [];

  return (
    <section className="workspace-panel" aria-label="Skills">
      <header className="workspace-panel-header">
        <h1>Skills</h1>
        <p>查看本地 Skill 列表、已启用项和当前请求的匹配建议，不再只显示占位说明。</p>
      </header>
      <div className="workspace-panel-list">
        <div className="workspace-history-card">
          <p>已启用 Skills</p>
          <p className="muted">
            {panelState.enabled?.summary ?? "读取工作区已启用 Skill 注册表。"}
          </p>
          <div className="action-row">
            <button className="action-button action-button-primary" type="button" onClick={onRefresh}>
              {panelState.loading ? "刷新中" : "刷新 Skills"}
            </button>
          </div>
        </div>
        {panelState.error ? <p className="workspace-knowledge-warning">{panelState.error}</p> : null}
        <p>已启用 {enabledItems.length}</p>
        {enabledItems.length === 0 ? (
          <p>当前还没有已启用 Skill。</p>
        ) : enabledItems.map((item) => (
          <div className="workspace-history-card" key={`${item.name}-${item.path}`}>
            <p>{item.name}</p>
            <p className="muted">{item.description}</p>
            <p className="workspace-knowledge-source">{item.path}</p>
          </div>
        ))}
        <p>已扫描 {scannedItems.length}</p>
        {scannedItems.length === 0 ? (
          <p>当前还没有扫描到本地 Skill。</p>
        ) : scannedItems.map((item) => (
          <div className="workspace-history-card" key={`${item.name}-${item.path}`}>
            <p>{item.name}{item.enabled ? " · 已启用" : ""}</p>
            <p className="muted">{item.description}</p>
            <p className="workspace-knowledge-source">{item.path}</p>
          </div>
        ))}
        <div className="workspace-history-card">
          <p>Skill 匹配建议</p>
          <p className="muted">输入一句任务描述，查看当前桌面端会推荐哪些已启用 Skill。</p>
          <input
            aria-label="Skill 匹配查询"
            className="settings-textarea"
            type="text"
            value={panelState.query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          <div className="action-row">
            <button className="action-button" type="button" onClick={onRunMatch}>
              匹配已启用 Skills
            </button>
          </div>
        </div>
        <div className="workspace-history-card">
          <p>Skill 操作</p>
          <p className="muted">先输入 Skill 名称，再启用、安装或禁用。</p>
          <input
            aria-label="Skill 操作查询"
            className="settings-textarea"
            type="text"
            value={panelState.actionQuery}
            onChange={(event) => onSkillActionQueryChange(event.target.value)}
          />
          <div className="action-row">
            <button className="action-button" type="button" onClick={onEnableSkill}>
              启用
            </button>
            <button className="action-button" type="button" onClick={onInstallSkill}>
              安装
            </button>
            <button className="action-button" type="button" onClick={onDisableSkill}>
              禁用
            </button>
          </div>
        </div>
        {actionItems.length > 0 ? (
          <p className="muted">当前可操作项: {actionItems.map((item) => item.name).join("、")}</p>
        ) : null}
        {matchedItems.length > 0 ? (
          <>
            <p>推荐结果 {matchedItems.length}</p>
            {matchedItems.map((item) => (
              <div className="workspace-history-card" key={`${item.name}-${item.path}-match`}>
                <p>{item.name}</p>
                <p className="muted">{item.description}</p>
                <p className="muted">{item.content_preview}</p>
                <p className="workspace-knowledge-source">{item.path}</p>
              </div>
            ))}
          </>
        ) : null}
        <div className="workspace-history-card">
          <p>设置页迁移说明</p>
          <p className="muted">Skill 相关主体信息已经放回本页，设置页后续只保留全局配置。</p>
          <p className="muted">权限审批和高风险确认仍统一走右侧面板。</p>
        </div>
      </div>
    </section>
  );
}

function McpPanel({
  panelState,
  onRefresh,
  onQueryChange,
  onInspect,
  onStart
}: {
  panelState: MspPanelState;
  onRefresh: () => void;
  onQueryChange: (query: string) => void;
  onInspect: () => void;
  onStart: () => void;
}) {
  const scannedItems = panelState.scan?.items ?? [];
  const inspectedItems = panelState.inspect?.items ?? [];
  const previewItems = panelState.preview?.items ?? [];

  return (
    <section className="workspace-panel" aria-label="MCP">
      <header className="workspace-panel-header">
        <h1>MCP</h1>
        <p>展示本地 MCP 扫描结果、插件详情和启动预览，替代原来的纯说明页。</p>
      </header>
      <div className="workspace-panel-list">
        <div className="workspace-history-card">
          <p>本地 MCP 插件扫描</p>
          <p className="muted">{panelState.scan?.summary ?? "扫描本地 MCP 插件入口。"}</p>
          <div className="action-row">
            <button className="action-button action-button-primary" type="button" onClick={onRefresh}>
              {panelState.loading ? "刷新中" : "刷新 MCP"}
            </button>
          </div>
        </div>
        {panelState.error ? <p className="workspace-knowledge-warning">{panelState.error}</p> : null}
        <p>扫描到 {scannedItems.length} 个插件入口</p>
        {scannedItems.map((item) => (
          <div className="workspace-history-card" key={`${item.id}-${item.path}`}>
            <p>{item.id}</p>
            <p className="muted">激活方式: {item.activation}</p>
            <p className="muted">工具 {item.tool_count} · Skills {item.skill_count}</p>
            <p className="workspace-knowledge-source">{item.path}</p>
          </div>
        ))}
        <div className="workspace-history-card">
          <p>插件详情查询</p>
          <p className="muted">输入插件名，查看详情与启动预览。</p>
          <input
            aria-label="MCP 插件查询"
            className="settings-textarea"
            type="text"
            value={panelState.query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          <div className="action-row">
            <button className="action-button" type="button" onClick={onInspect}>
              查看详情
            </button>
            <button className="action-button action-button-primary" type="button" onClick={onStart}>
              启动插件
            </button>
          </div>
        </div>
        {inspectedItems.map((item) => (
          <div className="workspace-history-card" key={`${item.id}-${item.path}-detail`}>
            <p>{item.id} · 详情</p>
            <p className="muted">{item.description}</p>
            <p className="muted">工具: {item.tool_names.join("、") || "无"}</p>
            <p className="muted">Skill 路径: {item.skill_paths.join("、") || "无"}</p>
            <p className="workspace-knowledge-source">{item.path}</p>
          </div>
        ))}
        {previewItems.map((item) => (
          <div className="workspace-history-card" key={`${item.id}-${item.path}-preview`}>
            <p>{item.id} · 启动预览</p>
            <p className="muted">{item.risk_summary}</p>
            <p className="muted">命令预览: {item.command_preview}</p>
            <p className="muted">工作目录: {item.working_directory}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function NpcPanel({
  state,
  panelState,
  knowledgeLibraryLabel,
  knowledgeLibraries,
  onPromptDraftChange,
  onSelectKnowledgeLibrary,
  onSaveNpcConfig
}: {
  state: WorkbenchState;
  panelState: NpcPanelState;
  knowledgeLibraryLabel?: string;
  knowledgeLibraries?: Array<{
    id: string;
    label: string;
    active: boolean;
  }>;
  onPromptDraftChange: (value: string) => void;
  onSelectKnowledgeLibrary?: (libraryId: string) => void;
  onSaveNpcConfig: () => void;
}) {
  const selectedLibraries = (knowledgeLibraries ?? []).filter((library) => library.active);

  return (
    <section className="workspace-panel" aria-label="NPC">
      <header className="workspace-panel-header">
        <h1>NPC</h1>
        <p>在这里选择 NPC 要加载的知识库，再保存提示词和配置。</p>
      </header>
      <div className="workspace-panel-list">
        <div className="workspace-history-card">
          <p>NPC 能力概览</p>
          <p className="muted">{panelState.capability?.summary ?? "读取本地 NPC 能力基础。"}</p>
          <p className="muted">当前 NPC 模型: {state.settings.npc.localModel || state.model.activeModel}</p>
          <p className="muted">状态: {panelState.capability?.status ?? "未读取"}</p>
        </div>
        <div className="workspace-history-card">
          <p>NPC 提示词草案</p>
          <p className="muted">先在这里编辑 NPC 的职责、边界和工作流，后续再接保存配置。</p>
          <textarea
            aria-label="NPC 提示词草案"
            className="settings-textarea"
            value={panelState.promptDraft}
            onChange={(event) => onPromptDraftChange(event.target.value)}
          />
          <div className="action-row">
            <button className="action-button action-button-primary" type="button" onClick={onSaveNpcConfig}>
              保存 NPC 配置
            </button>
          </div>
          {panelState.saveStatus ? <p className="muted">{panelState.saveStatus}</p> : null}
        </div>
        <div className="workspace-history-card">
          <p>知识库绑定</p>
          <p className="muted">当前知识库: {knowledgeLibraryLabel ?? "默认知识库"}</p>
          <p className="muted">在这里选择 NPC 要加载的知识库。</p>
          <div className="action-row" aria-label="NPC 知识库切换">
            {(knowledgeLibraries ?? []).map((library) => (
              <button
                key={library.id}
                className="action-button"
                type="button"
                onClick={() => onSelectKnowledgeLibrary?.(library.id)}
              >
                {library.active ? `${library.label}（当前）` : library.label}
              </button>
            ))}
          </div>
          {selectedLibraries.length > 0 ? (
            <p className="muted">
              已选中: {selectedLibraries.map((library) => library.label).join("、")}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AuditTimelinePanel({
  events,
  onCleanupStorage,
  filter,
  onFilterChange
}: {
  events: WorkspaceAuditEvent[];
  onCleanupStorage: (target: StorageCleanupTarget) => void;
  filter: string;
  onFilterChange: (value: string) => void;
}) {
  const normalizedFilter = filter.trim().toLowerCase();
  const visibleEvents = normalizedFilter.length === 0
    ? events
    : events.filter((event) =>
      `${event.summary} ${event.module} ${event.source} ${event.detail}`.toLowerCase().includes(normalizedFilter)
    );

  return (
    <section className="workspace-panel" aria-label="审计">
      <header className="workspace-panel-header">
        <h1>审计</h1>
        <p>完整展示最近的日志事件，而不是只显示单条 lastEvent。</p>
      </header>
      <div className="workspace-panel-list">
        <div className="workspace-history-card">
          <p>日志筛选</p>
          <input
            aria-label="审计筛选"
            className="settings-textarea"
            type="text"
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
          />
        </div>
        <p>日志 {visibleEvents.length}</p>
        {visibleEvents.length === 0 ? (
          <p>当前还没有审计事件。</p>
        ) : visibleEvents.map((event) => (
          <div className="workspace-history-card" key={event.id}>
            <p>{event.summary}</p>
            <p className="muted">模块: {event.module}</p>
            <p className="muted">来源: {event.source}</p>
            <p className="muted">时间: {event.timestamp}</p>
            <p className="muted">{event.detail}</p>
          </div>
        ))}
      </div>
      <div className="action-row">
        <button className="action-button" type="button" onClick={() => onCleanupStorage("logs")}>
          清空日志
        </button>
      </div>
    </section>
  );
}

function WorkbenchContentPanel({ viewId }: { viewId: StaticWorkbenchViewId }) {
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

function formatArchivedConversationTime(archivedAt?: string | null) {
  if (!archivedAt) {
    return "归档时间未记录";
  }

  const date = new Date(archivedAt);

  if (Number.isNaN(date.getTime())) {
    return "归档时间未记录";
  }

  return `归档于 ${date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function renderKnowledgeFileCard(
  file: ImportedKnowledgeFile,
  onRemoveKnowledgeFile: (path: string) => void
) {
  return (
    <div className="workspace-history-card" key={file.path}>
      <p>{file.title}</p>
      <p className="muted">{file.path}</p>
      <p className="workspace-knowledge-source">{file.path.startsWith("uploads/") ? "本地上传" : "知识库文件"}</p>
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

function renderKnowledgeLibraryFileRow(
  file: ImportedKnowledgeFile,
  onRemoveKnowledgeFile: (path: string) => void
) {
  return (
    <div className="knowledge-file-row" key={file.path}>
      <div className="knowledge-file-main">
        <p>{file.title}</p>
        <p className="workspace-knowledge-source">{file.path}</p>
        {file.status === "missing" ? (
          <p className="workspace-knowledge-warning">文件已失效，检索时会自动跳过。</p>
        ) : null}
      </div>
      <button
        aria-label={`移出知识库：${file.title}`}
        className="action-button"
        type="button"
        onClick={() => onRemoveKnowledgeFile(file.path)}
      >
        移出
      </button>
    </div>
  );
}

function KnowledgePanel({
  state,
  onImportKnowledgeFile,
  onImportLocalKnowledgeFiles,
  onRemoveKnowledgeFile,
  knowledgeLibraryLabel,
  knowledgeLibraries,
  onCreateKnowledgeLibrary,
  onSelectKnowledgeLibrary,
  onRequestClose,
  onMinimizeApp
}: {
  state: WorkbenchState;
  onImportKnowledgeFile: (path: string) => void;
  onImportLocalKnowledgeFiles?: (files: File[]) => void;
  onRemoveKnowledgeFile: (path: string) => void;
  knowledgeLibraryLabel?: string;
  knowledgeLibraries?: Array<{
    id: string;
    label: string;
    description?: string;
    active: boolean;
  }>;
  onCreateKnowledgeLibrary?: (name: string, description?: string) => void;
  onSelectKnowledgeLibrary?: (libraryId: string) => void;
  onRequestClose?: () => void;
  onMinimizeApp?: () => void;
}) {
  const [draftLibraryName, setDraftLibraryName] = useState("");
  const [draftLibraryDescription, setDraftLibraryDescription] = useState("");
  const [isCreateLibraryDialogOpen, setIsCreateLibraryDialogOpen] = useState(false);
  const filePoolInputRef = useRef<HTMLInputElement | null>(null);
  const stateKnowledgeLibraries = state.knowledge.libraries ?? [];
  const derivedKnowledgeLibraries =
    knowledgeLibraries ??
    stateKnowledgeLibraries.map((library) => ({
      id: library.id,
      label: library.label,
      description: library.description,
      active: library.id === state.knowledge.activeLibraryId
    }));
  const currentKnowledgeLibraryLabel =
    knowledgeLibraryLabel ??
    derivedKnowledgeLibraries.find((library) => library.active)?.label ??
    state.knowledge.activeLibraryLabel ??
    "默认知识库";
  const supportsNamedLibraries = derivedKnowledgeLibraries.length > 0;
  const availableKnowledgeLibraries = derivedKnowledgeLibraries;
  const handleSelectLibrary = onSelectKnowledgeLibrary ?? (() => undefined);
  const handleCreateLibrary = onCreateKnowledgeLibrary ?? (() => undefined);
  const canCreateKnowledgeLibrary = Boolean(onCreateKnowledgeLibrary);
  const importedFiles = state.knowledge.importedFiles;
  const availableFiles = state.knowledge.availableFiles;

  function handleImportLocalFiles(files: FileList | File[]) {
    const fileList = Array.from(files);

    if (fileList.length === 0) {
      return;
    }

    onImportLocalKnowledgeFiles?.(fileList);
  }

  function submitKnowledgeLibraryDraft() {
    const nextName = draftLibraryName.trim();
    const nextDescription = draftLibraryDescription.trim();

    if (!nextName) {
      return;
    }

    handleCreateLibrary(nextName, nextDescription || undefined);
    setDraftLibraryName("");
    setDraftLibraryDescription("");
    setIsCreateLibraryDialogOpen(false);
  }

  return (
    <section className="workspace-panel" aria-label="知识库">
      <header className="workspace-panel-header">
        <h1>知识库</h1>
        <p>把文件先纳入共享文件库，再拖入当前知识库。NPC 在自己的配置页里选择要加载哪个知识库。</p>
      </header>
      <div className="knowledge-workspace">
        <aside className="knowledge-rail" aria-label="知识库列表">
          <div className="knowledge-section-heading">
            <div>
              <p>知识库列表</p>
              <span>{supportsNamedLibraries ? `${availableKnowledgeLibraries.length} 个知识库` : "默认知识库"}</span>
            </div>
            {canCreateKnowledgeLibrary ? (
              <button
                aria-label="创建知识库"
                className="knowledge-create-button"
                type="button"
                onClick={() => setIsCreateLibraryDialogOpen(true)}
              >
                +
              </button>
            ) : null}
          </div>
          {canCreateKnowledgeLibrary && isCreateLibraryDialogOpen ? (
            <div className="knowledge-create-dialog" role="dialog" aria-label="新建知识库">
              <div className="knowledge-create-dialog-header">
                <p>新建知识库</p>
                <button
                  aria-label="取消创建知识库"
                  className="knowledge-dialog-close-button"
                  type="button"
                  onClick={() => {
                    setIsCreateLibraryDialogOpen(false);
                    setDraftLibraryName("");
                    setDraftLibraryDescription("");
                  }}
                >
                  取消
                </button>
              </div>
              <label className="knowledge-field">
                <span>知识库名称</span>
                <input
                  aria-label="知识库名称"
                  className="knowledge-inline-input"
                  placeholder="例如：产品文档库"
                  type="text"
                  value={draftLibraryName}
                  onChange={(event) => setDraftLibraryName(event.target.value)}
                />
              </label>
              <label className="knowledge-field">
                <span>知识库简介</span>
                <textarea
                  aria-label="知识库简介"
                  className="settings-textarea"
                  placeholder="例如：整理产品需求、PRD、交互说明和会议结论。"
                  value={draftLibraryDescription}
                  onChange={(event) => setDraftLibraryDescription(event.target.value)}
                />
              </label>
              <div className="action-row">
                <button
                  className="action-button action-button-primary"
                  type="button"
                  onClick={() => submitKnowledgeLibraryDraft()}
                >
                  确认创建知识库
                </button>
              </div>
            </div>
          ) : null}
          {supportsNamedLibraries ? (
            <>
              <div className="knowledge-library-list">
                {availableKnowledgeLibraries.map((library) => (
                  <button
                    key={library.id}
                    aria-label={library.active ? `当前知识库：${library.label}` : `切换到知识库：${library.label}`}
                    className={library.active ? "knowledge-library-item active" : "knowledge-library-item"}
                    type="button"
                    onClick={() => handleSelectLibrary(library.id)}
                  >
                    <span className="knowledge-library-title">{library.label}</span>
                    {library.description ? <span className="knowledge-library-summary">{library.description}</span> : null}
                    <span className="knowledge-library-meta">{library.active ? "当前工作区" : "点击切换"}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="knowledge-library-list">
              <div className="knowledge-library-item active">
                <span className="knowledge-library-title">{knowledgeLibraryLabel ?? "默认知识库"}</span>
                <span className="knowledge-library-meta">当前工作区</span>
              </div>
            </div>
          )}
        </aside>

        <section className="knowledge-main" aria-label="当前知识库工作区">
          <div className="knowledge-main-header">
            <div>
              <p className="knowledge-section-eyebrow">当前知识库</p>
              <h2>{currentKnowledgeLibraryLabel}</h2>
            </div>
            <span className="workspace-history-badge">已索引文件 {state.storage.knowledgeCount}</span>
          </div>
          <div className="knowledge-dropzone">
            <strong>把文件拖到这里加入当前知识库</strong>
            <p>可以从右侧文件库拖入，也可以直接拖入 Finder 文件。文件先上传到文件库，再拖进某个知识库。文件库对所有知识库互通。</p>
          </div>
          <div className="knowledge-section-heading">
            <div>
              <p>当前知识库文件</p>
              <span>{importedFiles.length === 0 ? "还没有文件" : `${importedFiles.length} 个文件`}</span>
            </div>
          </div>
          <div className="knowledge-file-list">
            {importedFiles.length === 0 ? (
              <p className="knowledge-empty-state">还没有已纳入知识库的文件。先把右侧文件拖进来。</p>
            ) : (
              importedFiles.map((file) => renderKnowledgeLibraryFileRow(file, onRemoveKnowledgeFile))
            )}
          </div>
        </section>

        <aside className="knowledge-file-pool" aria-label="文件库">
          <div className="knowledge-section-heading">
            <div>
              <p>文件库</p>
              <span>{availableFiles.length === 0 ? "暂无待加入文件" : `${availableFiles.length} 个待加入文件`}</span>
            </div>
            <button
              aria-label="上传文件到文件库"
              className="knowledge-create-button"
              type="button"
              onClick={() => filePoolInputRef.current?.click()}
            >
              +
            </button>
          </div>
          <input
            ref={filePoolInputRef}
            aria-label="导入本地 md/txt 文件"
            className="knowledge-hidden-file-input"
            accept=".md,.txt,text/markdown,text/plain"
            hidden
            type="file"
            multiple
            onChange={(event) => {
              const files = event.target.files;

              if (!files || files.length === 0) {
                return;
              }

              handleImportLocalFiles(files);
              event.currentTarget.value = "";
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleImportLocalFiles(event.dataTransfer.files);
            }}
            onDragOver={(event) => {
              event.preventDefault();
            }}
          />
          <p className="knowledge-file-pool-hint">点击右上角加号，把本机文档直接纳入文件库。</p>
          <div className="knowledge-file-list">
            {availableFiles.length === 0 ? (
              <p className="knowledge-empty-state">当前没有新的可导入文件。</p>
            ) : (
              availableFiles.map((file) => (
                <div className="knowledge-file-row" key={file.path}>
                  <div className="knowledge-file-main">
                    <p>{file.title}</p>
                    <p className="workspace-knowledge-source">{file.path}</p>
                  </div>
                  <button
                    aria-label={`导入知识库文件：${file.title}`}
                    className="action-button"
                    type="button"
                    onClick={() => onImportKnowledgeFile(file.path)}
                  >
                    加入
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>
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
  onSelectNpcModel,
  onUpdateRollbackLimit,
  onCleanupStorage,
  onRestoreRecentConversation,
  onDeleteRecentConversation
}: {
  state: WorkbenchState;
  focusTarget: ModelSettingsTarget | null;
  onRetryOllamaCheck: () => void;
  onToggleRemoteApi: (enabled: boolean) => void;
  onToggleSearch: (enabled: boolean) => void;
  onSaveRemoteApiConfig: (payload: { baseUrl: string; providerLabel: string; apiKey: string }) => void;
  onSaveSearchProviderConfig: (payload: { providerLabel: string }) => void;
  onSelectNpcModel: (modelName: string) => void;
  onUpdateRollbackLimit: (limit: number) => void;
  onCleanupStorage: (target: StorageCleanupTarget) => void;
  onRestoreRecentConversation: (conversationId: string) => void;
  onDeleteRecentConversation: (conversationId: string) => void;
}) {
  const [remoteApiBaseUrl, setRemoteApiBaseUrl] = useState(state.settings.remoteApi.baseUrl);
  const [remoteApiProviderLabel, setRemoteApiProviderLabel] = useState(state.settings.remoteApi.providerLabel);
  const [remoteApiKey, setRemoteApiKey] = useState(state.settings.remoteApi.apiKey);
  const [searchProviderLabel, setSearchProviderLabel] = useState(state.search.providerLabel);
  const [archivedConversationQuery, setArchivedConversationQuery] = useState("");
  const activeFocusLabel = focusTarget === "remote-api" ? "大模型 API 设置" : "Ollama 设置";
  const archivedConversations = state.history.archivedConversations ?? [];
  const normalizedArchivedConversationQuery = archivedConversationQuery.trim().toLowerCase();
  const filteredArchivedConversations = normalizedArchivedConversationQuery
    ? archivedConversations.filter((conversation) =>
      `${conversation.title} ${conversation.summary}`.toLowerCase().includes(normalizedArchivedConversationQuery)
    )
    : archivedConversations;
  const groupedArchivedConversations = {
    today: filteredArchivedConversations.filter((conversation) => {
      if (!conversation.archivedAt) {
        return false;
      }

      return new Date(conversation.archivedAt).toDateString() === new Date().toDateString();
    }),
    earlier: filteredArchivedConversations.filter((conversation) => {
      if (!conversation.archivedAt) {
        return true;
      }

      return new Date(conversation.archivedAt).toDateString() !== new Date().toDateString();
    })
  };

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
        <p>{activeFocusLabel} · 这里只保留全局配置，不再承载 Skills、NPC、MCP、审计主体页面。</p>
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

      <section className="settings-section">
        <h2>NPC 本地模型</h2>
        <p>这里只保留 NPC 的全局模型配置。提示词草案、知识库绑定和能力概览已经迁到 NPC 页面。</p>
        <div className="settings-line-list">
          <p>当前 NPC 模型: {state.settings?.npc?.localModel || state.model.activeModel}</p>
          <p>不会使用 embedding 模型</p>
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
        <p>这里只保留全局 Shell 策略说明。运行中的日志、权限事件、失败详情和回退记录请看审计与安全页面。</p>
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
        <h2>恢复会话</h2>
        <p>这里只保留归档恢复入口。实时会话主体在左侧会话区，日志主体在审计页。</p>
        <div className="workspace-history-card">
          <p>搜索恢复会话</p>
          <input
            aria-label="搜索恢复会话"
            className="settings-textarea"
            type="text"
            value={archivedConversationQuery}
            onChange={(event) => setArchivedConversationQuery(event.target.value)}
          />
        </div>
        <div className="settings-line-list">
          {filteredArchivedConversations.length === 0 ? (
            <p>还没有已归档会话。</p>
          ) : (
            <>
              {groupedArchivedConversations.today.length > 0 ? (
                <>
                  <p className="settings-group-label">今天</p>
                  {groupedArchivedConversations.today.map((conversation) => (
                    <div className="workspace-history-card" key={conversation.id}>
                      <p>{conversation.title}</p>
                      <p className="muted">{conversation.summary}</p>
                      <p className="workspace-history-card-meta">{formatArchivedConversationTime(conversation.archivedAt)}</p>
                      <div className="action-row">
                        <button
                          className="action-button action-button-primary"
                          type="button"
                          onClick={() => onRestoreRecentConversation(conversation.id)}
                        >
                          恢复会话
                        </button>
                        <button
                          className="action-button"
                          type="button"
                          onClick={() => onDeleteRecentConversation(conversation.id)}
                        >
                          永久删除
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              ) : null}
              {groupedArchivedConversations.earlier.length > 0 ? (
                <>
                  <p className="settings-group-label">更早</p>
                  {groupedArchivedConversations.earlier.map((conversation) => (
                    <div className="workspace-history-card" key={conversation.id}>
                      <p>{conversation.title}</p>
                      <p className="muted">{conversation.summary}</p>
                      <p className="workspace-history-card-meta">{formatArchivedConversationTime(conversation.archivedAt)}</p>
                      <div className="action-row">
                        <button
                          className="action-button action-button-primary"
                          type="button"
                          onClick={() => onRestoreRecentConversation(conversation.id)}
                        >
                          恢复会话
                        </button>
                        <button
                          className="action-button"
                          type="button"
                          onClick={() => onDeleteRecentConversation(conversation.id)}
                        >
                          永久删除
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              ) : null}
            </>
          )}
        </div>
      </section>

      <section className="settings-section">
        <h2>回退与本地清理</h2>
        <p>这里只保留全局回退与清理动作。日志主体已经迁到审计页，知识库主体在知识库页。</p>
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
  onSelectNpcModel,
  onNewConversation,
  onArchiveConversation,
  onRestoreRecentConversation,
  onDeleteRecentConversation,
  onImportKnowledgeFile,
  onImportLocalKnowledgeFiles,
  onRemoveKnowledgeFile,
  knowledgeLibraryLabel,
  knowledgeLibraries,
  onCreateKnowledgeLibrary,
  onSelectKnowledgeLibrary,
  onSubmitTask,
  onAddComposerAttachments,
  onRemoveComposerAttachment
}: WorkbenchProps) {
  const [activeView, setActiveView] = useState<WorkbenchViewId>("chat");
  const [settingsFocus, setSettingsFocus] = useState<ModelSettingsTarget | null>(null);
  const [isConversationSearchOpen, setIsConversationSearchOpen] = useState(false);
  const [isConversationDropdownOpen, setIsConversationDropdownOpen] = useState(false);
  const [conversationSearchQuery, setConversationSearchQuery] = useState("");
  const [isConversationClusterExpanded, setIsConversationClusterExpanded] = useState(false);
  const [pendingDeleteConversationId, setPendingDeleteConversationId] = useState<string | null>(null);
  const [auditEvents, setAuditEvents] = useState<WorkspaceAuditEvent[]>(() => [
    {
      ...state.audit.lastEvent,
      summary: state.audit.summary,
      id: createAuditEventId(state.audit.lastEvent)
    }
  ]);
  const [skillsPanelState, setSkillsPanelState] = useState<SkillsPanelState>({
    loading: false,
    error: null,
    scan: null,
    enabled: null,
    match: null,
    query: "",
    actionQuery: ""
  });
  const [mcpPanelState, setMcpPanelState] = useState<MspPanelState>({
    loading: false,
    error: null,
    scan: null,
    inspect: null,
    preview: null,
    query: "",
    actionQuery: ""
  });
  const [npcPanelState, setNpcPanelState] = useState<NpcPanelState>({
    loading: false,
    error: null,
    capability: null,
    promptDraft: "",
    saveStatus: null
  });
  const [auditFilter, setAuditFilter] = useState("");
  const isChatView = activeView === "chat";
  const isSettingsView = activeView === "settings";
  const archiveConversationDisabled = state.conversation.entries.length === 0;

  useEffect(() => {
    setAuditEvents((current) => {
      const nextEvent: WorkspaceAuditEvent = {
        ...state.audit.lastEvent,
        summary: state.audit.summary,
        id: createAuditEventId(state.audit.lastEvent)
      };

      if (current[0]?.id === nextEvent.id) {
        return current;
      }

      return [nextEvent, ...current].slice(0, 60);
    });
  }, [state.audit.lastEvent, state.audit.summary]);

  async function refreshSkillsPanel() {
    setSkillsPanelState((current) => ({ ...current, loading: true, error: null }));

    try {
      const [scan, enabled] = await Promise.all([scanLocalSkills(), listEnabledLocalSkills()]);
      setSkillsPanelState((current) => ({
        ...current,
        loading: false,
        scan,
        enabled
      }));
    } catch (error) {
      setSkillsPanelState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "读取 Skills 失败"
      }));
    }
  }

  async function inspectMcpPanel() {
    const query = mcpPanelState.query.trim();

    if (!query) {
      return;
    }

    setMcpPanelState((current) => ({ ...current, loading: true, error: null }));

    try {
      const [inspect, preview] = await Promise.all([inspectLocalMcpPlugin(query), previewLocalMcpPluginStart(query)]);
      setMcpPanelState((current) => ({
        ...current,
        loading: false,
        inspect,
        preview
      }));
    } catch (error) {
      setMcpPanelState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "读取 MCP 详情失败"
      }));
    }
  }

  async function refreshMcpPanel() {
    setMcpPanelState((current) => ({ ...current, loading: true, error: null }));

    try {
      const scan = await scanLocalMcpPlugins();
      setMcpPanelState((current) => ({
        ...current,
        loading: false,
        scan
      }));
    } catch (error) {
      setMcpPanelState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "读取 MCP 列表失败"
      }));
    }
  }

  async function refreshNpcPanel() {
    setNpcPanelState((current) => ({ ...current, loading: true, error: null }));

    try {
      const capability = await loadOpenClawCapabilityOverview("npc");
      setNpcPanelState((current) => ({
        ...current,
        loading: false,
        capability
      }));
    } catch (error) {
      setNpcPanelState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "读取 NPC 能力失败"
      }));
    }
  }

  async function runSkillsMatch() {
    const query = skillsPanelState.query.trim();

    if (!query) {
      return;
    }

    setSkillsPanelState((current) => ({ ...current, loading: true, error: null }));

    try {
      const match = await matchEnabledLocalSkills(query);
      setSkillsPanelState((current) => ({
        ...current,
        loading: false,
        match
      }));
    } catch (error) {
      setSkillsPanelState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "匹配 Skills 失败"
      }));
    }
  }

  async function runSkillAction(action: "enable" | "install" | "disable") {
    const query = skillsPanelState.actionQuery.trim();

    if (!query) {
      return;
    }

    setSkillsPanelState((current) => ({ ...current, loading: true, error: null }));

    try {
      if (action === "enable") {
        await enableLocalSkill(query);
      } else if (action === "install") {
        await installLocalSkill(query);
      } else {
        await disableLocalSkill(query);
      }

      await refreshSkillsPanel();
    } catch (error) {
      setSkillsPanelState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "执行 Skill 操作失败"
      }));
    }
  }

  async function runMcpStart() {
    const query = mcpPanelState.query.trim();

    if (!query) {
      return;
    }

    setMcpPanelState((current) => ({ ...current, loading: true, error: null }));

    try {
      await startLocalMcpPlugin(query);
      await inspectMcpPanel();
    } catch (error) {
      setMcpPanelState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "启动 MCP 插件失败"
      }));
    }
  }

  async function saveNpcConfigDraft() {
    const modelOutput = npcPanelState.promptDraft.trim();

    if (!modelOutput) {
      setNpcPanelState((current) => ({ ...current, saveStatus: "请先填写 NPC 提示词草案。" }));
      return;
    }

    try {
      await writeNpcConfig({
        query: "NPC 配置草案",
        modelOutput,
        config: {
          local_model: state.settings?.npc?.localModel || state.model.activeModel,
          knowledge_library_id: state.knowledge.activeLibraryId ?? "default-library",
          knowledge_library_label: state.knowledge.activeLibraryLabel ?? "默认知识库"
        }
      });
      setNpcPanelState((current) => ({ ...current, saveStatus: "NPC 配置已保存。" }));
    } catch (error) {
      setNpcPanelState((current) => ({
        ...current,
        saveStatus: error instanceof Error ? error.message : "保存 NPC 配置失败"
      }));
    }
  }

  useEffect(() => {
    if (activeView === "skills" && !skillsPanelState.scan && !skillsPanelState.loading) {
      void refreshSkillsPanel();
    }
    if (activeView === "mcp" && !mcpPanelState.scan && !mcpPanelState.loading) {
      void refreshMcpPanel();
    }
    if (activeView === "npc" && !npcPanelState.capability && !npcPanelState.loading) {
      void refreshNpcPanel();
    }
  }, [
    activeView,
    mcpPanelState.loading,
    mcpPanelState.scan,
    npcPanelState.capability,
    npcPanelState.loading,
    skillsPanelState.loading,
    skillsPanelState.scan
  ]);

  useEffect(() => {
    if (activeView === "npc") {
      setNpcPanelState((current) => ({
        ...current,
        promptDraft:
          current.promptDraft || [
            `你是 ${state.settings?.npc?.localModel || state.model.activeModel} 驱动的 NPC。`,
            `知识库：${state.knowledge.activeLibraryLabel ?? "默认知识库"}。`,
            "职责：优先给出可执行、可追踪、可回退的本地工作流。"
          ].join(" ")
      }));
    }
  }, [activeView, state.knowledge.activeLibraryLabel, state.model.activeModel, state.settings?.npc?.localModel]);

  function handleSelectView(viewId: WorkbenchViewId) {
    setActiveView(viewId);
    setSettingsFocus(null);
  }

  function handleNewConversationClick() {
    setActiveView("chat");
    setSettingsFocus(null);
    setIsConversationDropdownOpen(false);
    setIsConversationSearchOpen(false);
    setConversationSearchQuery("");
    setIsConversationClusterExpanded(false);
    onNewConversation();
  }

  function handleOpenModelSettings(target: ModelSettingsTarget) {
    setActiveView("settings");
    setSettingsFocus(target);
  }

  function handleSubmitTask(message: string, attachments?: ChatAttachment[]) {
    setActiveView("chat");
    setSettingsFocus(null);
    onSubmitTask(message, attachments);
  }

  function handleRetryLocalTask(taskId?: string) {
    setActiveView("chat");
    setSettingsFocus(null);
    onRetryLocalTask(taskId);
  }

  function handleDeleteConversationClick(conversationId: string) {
    setPendingDeleteConversationId(conversationId);
  }

  function handleConfirmDeleteConversation() {
    if (!pendingDeleteConversationId) {
      return;
    }

    onDeleteRecentConversation(pendingDeleteConversationId);
    setPendingDeleteConversationId(null);
  }

  return (
    <main className="workbench" aria-label="opencow 工作台">
      <Sidebar
        activeView={activeView}
        onSelectView={handleSelectView}
        onNewConversation={handleNewConversationClick}
        hasActiveConversationEntries={state.conversation.entries.some((entry) => entry.kind !== "system")}
        recentConversations={state.history.draftConversations}
        onArchiveConversation={onArchiveConversation}
        archiveConversationDisabled={archiveConversationDisabled}
        isConversationSearchOpen={isConversationSearchOpen}
        conversationSearchQuery={conversationSearchQuery}
        onConversationSearchQueryChange={setConversationSearchQuery}
        onToggleConversationSearch={() => {
          setIsConversationSearchOpen((current) => {
            const next = !current;

            if (!next) {
              setConversationSearchQuery("");
            }

            return next;
          });
        }}
        isConversationDropdownOpen={isConversationDropdownOpen}
        onToggleConversationDropdown={() => {
          if (isConversationDropdownOpen || isConversationSearchOpen) {
            setIsConversationDropdownOpen(false);
            setIsConversationSearchOpen(false);
            setConversationSearchQuery("");
            return;
          }

          setIsConversationDropdownOpen(true);
        }}
        onCloseConversationDropdown={() => {
          setIsConversationDropdownOpen(false);
          setIsConversationSearchOpen(false);
          setConversationSearchQuery("");
        }}
        onRestoreRecentConversation={onRestoreRecentConversation}
        onDeleteRecentConversation={handleDeleteConversationClick}
        isConversationClusterExpanded={isConversationClusterExpanded}
        onToggleConversationCluster={() => setIsConversationClusterExpanded((current) => !current)}
      />
      <section className="workbench-main">
        {isChatView ? (
          <MainConversation
            state={state}
            onPreviewRollback={onPreviewRollback}
            onCancelActiveTask={onCancelActiveTask}
            onRestoreRecentConversation={onRestoreRecentConversation}
            onDeleteRecentConversation={onDeleteRecentConversation}
            onSubmitTask={onSubmitTask}
            onOpenAttachment={(attachment) => {
              void openChatAttachment(attachment);
            }}
          />
        ) : activeView === "knowledge" ? (
        <KnowledgePanel
          state={state}
          onImportKnowledgeFile={onImportKnowledgeFile}
          onImportLocalKnowledgeFiles={onImportLocalKnowledgeFiles}
          onRemoveKnowledgeFile={onRemoveKnowledgeFile}
          knowledgeLibraryLabel={knowledgeLibraryLabel}
          knowledgeLibraries={knowledgeLibraries}
          onCreateKnowledgeLibrary={onCreateKnowledgeLibrary}
          onSelectKnowledgeLibrary={onSelectKnowledgeLibrary}
        />
        ) : activeView === "skills" ? (
          <SkillsPanel
            state={state}
            panelState={skillsPanelState}
            onRefresh={() => void refreshSkillsPanel()}
            onQueryChange={(query) => setSkillsPanelState((current) => ({ ...current, query }))}
            onRunMatch={() => void runSkillsMatch()}
            onSkillActionQueryChange={(actionQuery) =>
              setSkillsPanelState((current) => ({ ...current, actionQuery }))
            }
            onEnableSkill={() => void runSkillAction("enable")}
            onInstallSkill={() => void runSkillAction("install")}
            onDisableSkill={() => void runSkillAction("disable")}
          />
        ) : activeView === "npc" ? (
          <NpcPanel
            state={state}
            panelState={npcPanelState}
            knowledgeLibraryLabel={knowledgeLibraryLabel}
            knowledgeLibraries={knowledgeLibraries}
            onPromptDraftChange={(promptDraft) => setNpcPanelState((current) => ({ ...current, promptDraft }))}
            onSelectKnowledgeLibrary={onSelectKnowledgeLibrary}
            onSaveNpcConfig={() => void saveNpcConfigDraft()}
          />
        ) : activeView === "mcp" ? (
          <McpPanel
            panelState={mcpPanelState}
            onRefresh={() => void refreshMcpPanel()}
            onQueryChange={(query) => setMcpPanelState((current) => ({ ...current, query }))}
            onInspect={() => void inspectMcpPanel()}
            onStart={() => void runMcpStart()}
          />
        ) : activeView === "audit" ? (
          <AuditTimelinePanel
            events={auditEvents}
            onCleanupStorage={onCleanupStorage}
            filter={auditFilter}
            onFilterChange={setAuditFilter}
          />
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
            onSelectNpcModel={onSelectNpcModel ?? (() => undefined)}
            onUpdateRollbackLimit={onUpdateRollbackLimit}
            onCleanupStorage={onCleanupStorage}
            onRestoreRecentConversation={onRestoreRecentConversation}
            onDeleteRecentConversation={handleDeleteConversationClick}
          />
        ) : (
          <WorkbenchContentPanel viewId={activeView} />
        )}
        {isChatView ? (
          <Composer
            state={state}
            onSubmitTask={handleSubmitTask}
            onCancelActiveTask={onCancelActiveTask}
            onSelectModel={onSelectModel}
            onSelectNpcModel={onSelectNpcModel}
            onOpenModelSettings={handleOpenModelSettings}
            onAddAttachments={onAddComposerAttachments}
            onRemoveAttachment={onRemoveComposerAttachment}
          />
        ) : null}
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
      {pendingDeleteConversationId ? (
        <div className="app-close-overlay" role="dialog" aria-label="删除会话确认">
          <div className="app-close-dialog">
            <h2>删除会话</h2>
            <p>此操作会永久删除这段会话记录，删除后无法恢复。</p>
            <div className="action-row">
              <button
                type="button"
                className="action-button action-button-primary"
                onClick={handleConfirmDeleteConversation}
              >
                确认删除
              </button>
              <button
                type="button"
                className="action-button"
                onClick={() => setPendingDeleteConversationId(null)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
