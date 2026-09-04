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
  installLocalMcpPlugin,
  inspectLocalMcpPlugin,
  installLocalSkill,
  loadRecommendedMcpManifest,
  loadRecommendedSkillManifest,
  listEnabledLocalSkills,
  matchEnabledLocalSkills,
  previewLocalMcpPluginStart,
  startLocalMcpPlugin,
  scanLocalMcpPlugins,
  scanLocalSkills,
  uninstallLocalMcpPlugin,
  type EnabledLocalSkillMatchResult,
  type EnabledLocalSkillsResult,
  type LocalMcpPluginInspectResult,
  type LocalMcpPluginScanResult,
  type LocalMcpPluginStartPreviewResult,
  type RecommendedMcpManifestResult,
  type RecommendedSkillManifestResult,
  type LocalSkillScanResult,
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
  onSaveOllamaConfig: (payload: {
    longAnswerNumPredict: number;
    autoContinuationLimit: number;
    continuationTailLimit: number;
  }) => void;
  onSaveRemoteApiConfig: (payload: { baseUrl: string; providerLabel: string; apiKey: string }) => void;
  onSaveSearchProviderConfig: (payload: {
    providerLabel: string;
    baseUrl?: string;
    apiKey?: string;
    suppressFallbackNotice?: boolean;
  }) => void;
  onSelectModel: (modelName: string) => void;
  onSelectNpcModel?: (modelName: string) => void;
  onNewConversation: () => void;
  onArchiveConversation: () => void;
  onRestoreRecentConversation: (conversationId: string) => void;
  onDeleteRecentConversation: (conversationId: string) => void;
  confirmRecentConversationDelete?: boolean;
  onImportKnowledgeFile: (path: string) => void;
  onImportLocalKnowledgeFiles?: (files?: File[]) => void;
  onRemoveKnowledgeFile: (path: string) => void;
  knowledgeReferenceLabel?: string;
  knowledgeFileInputLabel?: string;
  inspectorCompatibilityOutputLabel?: string;
  knowledgeLibraryLabel?: string;
  knowledgeLibraries?: Array<{
    id: string;
    label: string;
    description?: string;
    active: boolean;
    documentCount?: number;
  }>;
  onCreateKnowledgeLibrary?: (name: string, description?: string) => void;
  onSelectKnowledgeLibrary?: (libraryId: string) => void;
  onCreateNpcWorkspace?: (name: string, description?: string) => void;
  onSelectConversationNpc?: (npcId: string | null) => void;
  onSelectNpcWorkspace?: (npcId: string) => void;
  onSelectNpcWorkspaceSection?: (section: WorkbenchState["npcWorkspace"]["activeSection"]) => void;
  onUpdateNpcWorkspaceOverview?: (
    npcId: string,
    payload: {
      name: string;
      description: string;
      defaultModel: string;
    }
  ) => void;
  onUpdateNpcWorkspacePersona?: (
    npcId: string,
    payload: {
      personaTitle?: string;
      personaPrompt: string;
      outputStyle: string;
      agentDraft: string;
      rulesDraft: string;
    }
  ) => void;
  onToggleNpcWorkspaceSkill?: (npcId: string, skillName: string) => void;
  onToggleNpcWorkspaceKnowledgeLibrary?: (npcId: string, libraryId: string) => void;
  onSelectNpcWorkspaceKnowledgeLibrary?: (libraryId: string | null) => void;
  onSelectNpcWorkspaceSkill?: (skillName: string) => void;
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
    summary: "管理 OpenCow 自有 MCP 安装、推荐清单和受控启动状态。",
    details: ["只展示 OpenCow 已安装的 MCP。", "推荐清单和受支持状态由 OpenCow 本地产品清单统一管理。"]
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
  recommended: RecommendedSkillManifestResult | null;
  match: EnabledLocalSkillMatchResult | null;
  query: string;
  actionQuery: string;
  activeTab: "installed" | "recommended";
  expandedSkillName: string | null;
};

type SearchPanelState = {
  query: string;
  customProviderLabel: string;
  customBaseUrl: string;
  customApiKey: string;
};

type MspPanelState = {
  loading: boolean;
  error: string | null;
  scan: LocalMcpPluginScanResult | null;
  recommended: RecommendedMcpManifestResult | null;
  inspect: LocalMcpPluginInspectResult | null;
  preview: LocalMcpPluginStartPreviewResult | null;
  query: string;
  actionQuery: string;
  activeTab: "installed" | "recommended";
  expandedPluginId: string | null;
};

type NpcPanelState = {
  loading: boolean;
  error: string | null;
  skills: LocalSkillScanResult | null;
};

const NPC_AUTOSAVE_DELAY_MS = 300;

function formatNpcUpdatedAt(value?: string) {
  if (!value) {
    return "最近更新 暂无记录";
  }

  return `最近更新 ${value.replace("T", " ").slice(0, 16)}`;
}

function formatNpcSkillSource(source: string) {
  if (source.startsWith("workspace")) {
    return "工作区";
  }

  if (source.startsWith("user")) {
    return "用户目录";
  }

  return source;
}

function getNpcSaveStatusTone(status: string | null | undefined) {
  if (!status) {
    return null;
  }

  if (status.includes("失败")) {
    return "error";
  }

  if (status.includes("保存中") || status.includes("创建中")) {
    return "pending";
  }

  return "success";
}

function createAuditEventId(event: WorkbenchState["audit"]["lastEvent"]) {
  return `${event.timestamp}::${event.module}::${event.source}::${event.detail}`;
}

function SkillsPanel({
  panelState,
  onRefresh,
  onQueryChange,
  onRunMatch,
  onSkillActionQueryChange,
  onEnableSkill,
  onInstallSkill,
  onDisableSkill,
  onToggleTab,
  onToggleExpand,
  onInstallRecommendedSkill
}: {
  panelState: SkillsPanelState;
  onRefresh: () => void;
  onQueryChange: (query: string) => void;
  onRunMatch: () => void;
  onSkillActionQueryChange: (query: string) => void;
  onEnableSkill: () => void;
  onInstallSkill: () => void;
  onDisableSkill: () => void;
  onToggleTab: (tab: "installed" | "recommended") => void;
  onToggleExpand: (skillName: string) => void;
  onInstallRecommendedSkill: (query: string) => void;
}) {
  const enabledItems = panelState.enabled?.items ?? [];
  const matchedItems = panelState.match?.items ?? [];
  const installedItems = panelState.scan?.items ?? [];
  const recommendedItems = panelState.recommended?.items ?? [];

  function renderRows(
    items: Array<{ name: string; description: string; detail: string }>,
    emptyText: string
  ) {
    if (items.length === 0) {
      return <p className="npc-empty-state">{emptyText}</p>;
    }

    return items.map((item) => {
      const expanded = panelState.expandedSkillName === item.name;

      return (
        <button
          key={item.name}
          className={expanded ? "npc-row-button active" : "npc-row-button"}
          type="button"
          onClick={() => onToggleExpand(item.name)}
        >
          <span className="npc-row-leading">
            <span className="npc-row-title">{item.name}</span>
            <span className="npc-row-description">{item.description}</span>
            {expanded ? <span className="npc-row-description">{item.detail}</span> : null}
          </span>
          <span className="npc-row-trailing">
            <span className="npc-row-status">{expanded ? "收起" : "展开"}</span>
          </span>
        </button>
      );
    });
  }

  return (
    <section className="workspace-panel" aria-label="Skills">
      <header className="workspace-panel-header">
        <h1>技能</h1>
        <p>统一管理 OpenCow 自己的技能目录。NPC 页面只负责勾选绑定，不处理安装。</p>
      </header>
      <div className="workspace-panel-list">
        <div className="workspace-history-card workspace-history-card-current">
          <p>技能中心</p>
          <p className="muted">
            {panelState.activeTab === "installed"
              ? (panelState.scan?.summary ?? "读取 OpenCow 已安装技能。")
              : (panelState.recommended?.summary ?? "读取 OpenCow 推荐安装清单。")}
          </p>
          <div className="action-row">
            <button
              className={panelState.activeTab === "installed" ? "action-button action-button-primary" : "action-button"}
              type="button"
              onClick={() => onToggleTab("installed")}
            >
              已安装
            </button>
            <button
              className={panelState.activeTab === "recommended" ? "action-button action-button-primary" : "action-button"}
              type="button"
              onClick={() => onToggleTab("recommended")}
            >
              推荐安装
            </button>
            <button className="action-button action-button-primary" type="button" onClick={onRefresh}>
              {panelState.loading ? "刷新中" : "刷新技能"}
            </button>
          </div>
        </div>
        {panelState.error ? <p className="workspace-knowledge-warning">{panelState.error}</p> : null}
        <div className="npc-main-section">
          <div className="npc-section-header">
            <div>
              <p className="knowledge-section-eyebrow">{panelState.activeTab === "installed" ? "已安装" : "精选推荐"}</p>
              <h2>{panelState.activeTab === "installed" ? "OpenCow 技能" : "OpenCow 精选推荐"}</h2>
            </div>
            <span className="workspace-history-badge">
              {panelState.activeTab === "installed" ? installedItems.length : recommendedItems.length} 项
            </span>
          </div>
          <div className="npc-compact-list">
            {panelState.activeTab === "installed"
              ? renderRows(
                installedItems.map((item) => ({
                  name: item.name,
                  description: item.description,
                  detail: `${enabledItems.some((enabled) => enabled.name === item.name) ? "已启用" : "未启用"} · ${item.path}`,
                })),
                "你还没有 skills，去 Skills 页面安装。"
              )
              : renderRows(
                recommendedItems.map((item) => ({
                  name: item.name,
                  description: item.description,
                  detail: `${item.rationale ?? "OpenCow 精选推荐能力。"} · 安装标识：${item.install_query}`,
                })),
                "当前没有推荐安装技能。"
              )}
          </div>
          {panelState.activeTab === "recommended" && recommendedItems.length > 0 ? (
            <div className="action-row">
              {recommendedItems.map((item) => (
                <button
                  key={`${item.name}-install`}
                  className="action-button"
                  type="button"
                  onClick={() => onInstallRecommendedSkill(item.install_query)}
                >
                  安装 {item.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="workspace-history-card">
          <p>技能操作</p>
          <p className="muted">默认显示已安装列表。每行只展示名称和一行简介，点击行再展开详情。</p>
          <input
            aria-label="Skill 操作查询"
            className="settings-textarea"
            type="text"
            value={panelState.actionQuery}
            onChange={(event) => onSkillActionQueryChange(event.target.value)}
          />
          <div className="action-row">
            <button className="action-button" type="button" onClick={onInstallSkill}>
              安装
            </button>
            <button className="action-button" type="button" onClick={onEnableSkill}>
              启用
            </button>
            <button className="action-button" type="button" onClick={onDisableSkill}>
              删除
            </button>
          </div>
        </div>
        <div className="workspace-history-card">
          <p>技能匹配建议</p>
          <p className="muted">输入任务描述，查看当前已启用技能里最适合分配给会话的候选项。</p>
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
  onSelectTab,
  onToggleExpand,
  onInspect,
  onStart,
  onInstall,
  onRemove
}: {
  panelState: MspPanelState;
  onRefresh: () => void;
  onSelectTab: (tab: "installed" | "recommended") => void;
  onToggleExpand: (pluginId: string) => void;
  onInspect: (pluginId: string) => void;
  onStart: (pluginId: string) => void;
  onInstall: (pluginId: string) => void;
  onRemove: (pluginId: string) => void;
}) {
  const installedItems = panelState.scan?.items ?? [];
  const recommendedItems = panelState.recommended?.items ?? [];
  const previewById = new Map((panelState.preview?.items ?? []).map((item) => [item.id, item]));
  const inspectById = new Map((panelState.inspect?.items ?? []).map((item) => [item.id, item]));
  const activeItems = panelState.activeTab === "installed" ? installedItems : recommendedItems;

  return (
    <section className="workspace-panel" aria-label="MCP">
      <header className="workspace-panel-header">
        <h1>MCP</h1>
        <p>统一管理 OpenCow 自有 MCP 安装、推荐清单和受控启动状态。</p>
      </header>
      <div className="workspace-panel-list">
        <div className="workspace-section-card">
          <div className="workspace-inline-tabs" role="tablist" aria-label="MCP 分类">
            <button
              className={`workspace-inline-tab${panelState.activeTab === "installed" ? " is-active" : ""}`}
              type="button"
              onClick={() => onSelectTab("installed")}
            >
              已安装
            </button>
            <button
              className={`workspace-inline-tab${panelState.activeTab === "recommended" ? " is-active" : ""}`}
              type="button"
              onClick={() => onSelectTab("recommended")}
            >
              推荐安装
            </button>
          </div>
          <p className="muted">
            {panelState.activeTab === "installed"
              ? panelState.scan?.summary ?? "读取 OpenCow 已安装 MCP。"
              : panelState.recommended?.summary ?? "读取 OpenCow 推荐 MCP 清单。"}
          </p>
          <div className="action-row">
            <button className="action-button action-button-primary" type="button" onClick={onRefresh}>
              {panelState.loading ? "刷新中" : "刷新列表"}
            </button>
          </div>
        </div>
        {panelState.error ? <p className="workspace-knowledge-warning">{panelState.error}</p> : null}
        <p>
          {panelState.activeTab === "installed"
            ? `已安装 ${installedItems.length} 个 MCP`
            : `推荐 ${recommendedItems.length} 个 MCP`}
        </p>
        {activeItems.length === 0 ? (
          <div className="workspace-empty-state">
            <p>{panelState.activeTab === "installed" ? "你还没有安装 MCP，请先去推荐安装。" : "当前没有可推荐的 MCP。"}</p>
          </div>
        ) : null}
        {activeItems.map((item) => {
          const expanded = panelState.expandedPluginId === item.id;
          const inspectItem = inspectById.get(item.id);
          const previewItem = previewById.get(item.id);
          const isInstalled = panelState.activeTab === "installed";
          return (
            <div
              className="workspace-list-row"
              key={`${item.id}-${"path" in item ? item.path : item.install_query}`}
            >
              <button
                className="workspace-list-row-main"
                type="button"
                onClick={() => onToggleExpand(item.id)}
              >
                <span className="workspace-list-row-title">
                  {item.name}
                </span>
                <span className="workspace-list-row-subtitle">
                  {item.description}
                </span>
              </button>
              <div className="workspace-list-row-actions">
                {isInstalled ? (
                  <>
                    <button className="action-button" type="button" onClick={() => onInspect(item.id)}>
                      查看
                    </button>
                    <button className="action-button action-button-primary" type="button" onClick={() => onStart(item.id)}>
                      启动
                    </button>
                    <button className="action-button" type="button" onClick={() => onRemove(item.id)}>
                      删除
                    </button>
                  </>
                ) : (
                  <button className="action-button action-button-primary" type="button" onClick={() => onInstall(item.id)}>
                    安装
                  </button>
                )}
              </div>
              {expanded ? (
                <div className="workspace-inline-detail">
                  {"supported" in item ? <p className="muted">支持状态: {item.supported ? "已支持" : "规划中"}</p> : null}
                  {isInstalled ? <p className="muted">状态: {"status" in item ? item.status : "stopped"}</p> : null}
                  {inspectItem ? (
                    <>
                      <p className="muted">工具: {inspectItem.tool_names.join("、") || "无"}</p>
                      <p className="muted">技能目录: {inspectItem.skill_paths.join("、") || "无"}</p>
                    </>
                  ) : null}
                  {previewItem ? (
                    <>
                      <p className="muted">命令预览: {previewItem.command_preview}</p>
                      <p className="muted">说明: {previewItem.risk_summary}</p>
                    </>
                  ) : null}
                  {"rationale" in item && item.rationale ? <p className="muted">推荐理由: {item.rationale}</p> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NpcPanel({
  state,
  panelState,
  knowledgeLibraries,
  onCreateNpcWorkspace,
  onSelectNpcWorkspace,
  onSelectNpcWorkspaceSection,
  onUpdateNpcWorkspaceOverview,
  onUpdateNpcWorkspacePersona,
  onToggleNpcWorkspaceSkill,
  onToggleNpcWorkspaceKnowledgeLibrary,
  onSelectNpcWorkspaceKnowledgeLibrary,
  onSelectNpcWorkspaceSkill
}: {
  state: WorkbenchState;
  panelState: NpcPanelState;
  knowledgeLibraries?: Array<{
    id: string;
    label: string;
    description?: string;
    active: boolean;
    documentCount?: number;
  }>;
  onCreateNpcWorkspace?: (name: string, description?: string) => void;
  onSelectNpcWorkspace?: (npcId: string) => void;
  onSelectNpcWorkspaceSection?: (section: WorkbenchState["npcWorkspace"]["activeSection"]) => void;
  onUpdateNpcWorkspaceOverview?: (
    npcId: string,
    payload: {
      name: string;
      description: string;
      defaultModel: string;
    }
  ) => void;
  onUpdateNpcWorkspacePersona?: (
    npcId: string,
    payload: {
      personaTitle?: string;
      personaPrompt: string;
      outputStyle: string;
      agentDraft: string;
      rulesDraft: string;
    }
  ) => void;
  onToggleNpcWorkspaceSkill?: (npcId: string, skillName: string) => void;
  onToggleNpcWorkspaceKnowledgeLibrary?: (npcId: string, libraryId: string) => void;
  onSelectNpcWorkspaceKnowledgeLibrary?: (libraryId: string | null) => void;
  onSelectNpcWorkspaceSkill?: (skillName: string) => void;
}) {
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [overviewDraft, setOverviewDraft] = useState({
    name: "",
    description: "",
    defaultModel: ""
  });
  const [personaDraft, setPersonaDraft] = useState({
    personaTitle: "",
    personaPrompt: "",
    outputStyle: "",
    agentDraft: "",
    rulesDraft: ""
  });
  const selectedNpc = state.npcWorkspace.items.find((item) => item.id === state.npcWorkspace.selectedNpcId) ?? null;
  const activeSection = state.npcWorkspace.activeSection;
  const skillRows = panelState.skills?.items ?? [];
  const selectedSkill = state.npcWorkspace.selectedSkillName
    ? skillRows.find((skill) => skill.name === state.npcWorkspace.selectedSkillName) ?? null
    : null;
  const hasSelectedNpcSkill = state.npcWorkspace.selectedSkillName
    ? skillRows.some((skill) => skill.name === state.npcWorkspace.selectedSkillName)
    : false;
  const boundKnowledgeIds = new Set(selectedNpc?.knowledgeLibraryIds ?? []);
  const npcModel = selectedNpc?.defaultModel || state.settings.npc.localModel || state.model.activeModel;
  const selectedKnowledgeLibrary = (knowledgeLibraries ?? []).find(
    (library) => library.id === state.npcWorkspace.selectedKnowledgeLibraryId
  ) ?? null;

  useEffect(() => {
    setOverviewDraft({
      name: selectedNpc?.name ?? "",
      description: selectedNpc?.description ?? "",
      defaultModel: selectedNpc?.defaultModel ?? ""
    });
  }, [selectedNpc?.id, selectedNpc?.name, selectedNpc?.description, selectedNpc?.defaultModel]);

  useEffect(() => {
    setPersonaDraft({
      personaTitle: selectedNpc?.personaTitle ?? "",
      personaPrompt: selectedNpc?.personaPrompt ?? "",
      outputStyle: selectedNpc?.outputStyle ?? "",
      agentDraft: selectedNpc?.agentDraft ?? "",
      rulesDraft: selectedNpc?.rulesDraft ?? ""
    });
  }, [
    selectedNpc?.id,
    selectedNpc?.personaTitle,
    selectedNpc?.personaPrompt,
    selectedNpc?.outputStyle,
    selectedNpc?.agentDraft,
    selectedNpc?.rulesDraft
  ]);

  useEffect(() => {
    if (!selectedNpc) {
      return;
    }

    if (
      overviewDraft.name === selectedNpc.name
      && overviewDraft.description === selectedNpc.description
      && overviewDraft.defaultModel === selectedNpc.defaultModel
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      onUpdateNpcWorkspaceOverview?.(selectedNpc.id, overviewDraft);
    }, NPC_AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [overviewDraft, onUpdateNpcWorkspaceOverview, selectedNpc]);

  useEffect(() => {
    if (!selectedNpc) {
      return;
    }

    if (
      personaDraft.personaTitle === selectedNpc.personaTitle
      && personaDraft.personaPrompt === selectedNpc.personaPrompt
      && personaDraft.outputStyle === selectedNpc.outputStyle
      && personaDraft.agentDraft === selectedNpc.agentDraft
      && personaDraft.rulesDraft === selectedNpc.rulesDraft
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      onUpdateNpcWorkspacePersona?.(selectedNpc.id, personaDraft);
    }, NPC_AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [onUpdateNpcWorkspacePersona, personaDraft, selectedNpc]);

  function submitCreateNpc() {
    const nextName = draftName.trim();

    if (!nextName) {
      return;
    }

    onCreateNpcWorkspace?.(nextName, draftDescription.trim() || undefined);
    setDraftName("");
    setDraftDescription("");
    setIsCreateOpen(false);
  }

  function renderOverviewSection() {
    if (!selectedNpc) {
      return (
        <div className="npc-main-section npc-main-section-empty">
          <div className="npc-section-header">
            <div>
              <p className="knowledge-section-eyebrow">概览</p>
              <h2>先创建一个 NPC</h2>
            </div>
          </div>
          <p className="npc-empty-state">给它一个名字、简介和默认模型，后面的人设、技能、知识库都会在这里继续配置。</p>
          <div className="action-row">
            <button className="action-button action-button-primary" type="button" onClick={() => setIsCreateOpen(true)}>
              立即创建
            </button>
          </div>
          {isCreateOpen ? <p className="muted">左侧 NPC 列表顶部已打开创建表单。</p> : null}
        </div>
      );
    }

    return (
      <div className="npc-main-section">
        <div className="npc-section-header">
          <div>
            <p className="knowledge-section-eyebrow">概览</p>
            <h2>{selectedNpc.name}</h2>
          </div>
          <span className="workspace-history-badge">技能 {selectedNpc.enabledSkillNames.length} · 知识库 {selectedNpc.knowledgeLibraryIds.length}</span>
        </div>
        <div className="npc-overview-summary">
          <p>{formatNpcUpdatedAt(selectedNpc.updatedAt)}</p>
          <p>当前默认模型 {npcModel || "未选择"}</p>
        </div>
        <label className="knowledge-field">
          <span>NPC 名称</span>
          <input
            aria-label="NPC 名称"
            className="knowledge-inline-input"
            type="text"
            value={overviewDraft.name}
            onChange={(event) => setOverviewDraft((current) => ({
              ...current,
              name: event.target.value
            }))}
          />
        </label>
        <label className="knowledge-field">
          <span>简介</span>
          <textarea
            aria-label="NPC 简介"
            className="settings-textarea"
            value={overviewDraft.description}
            onChange={(event) => setOverviewDraft((current) => ({
              ...current,
              description: event.target.value
            }))}
          />
        </label>
        <div className="npc-compact-list">
          <p className="npc-list-title">默认模型</p>
          {getChatCapableOllamaModels(state.model.availableModels).map((model) => (
            <button
              key={model.name}
              className={model.name === overviewDraft.defaultModel ? "npc-row-button active" : "npc-row-button"}
              type="button"
              onClick={() => setOverviewDraft((current) => ({
                ...current,
                defaultModel: model.name
              }))}
            >
              <span>{model.name}</span>
              <span>{model.name === overviewDraft.defaultModel ? "当前" : model.sizeLabel}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderPersonaSection() {
    if (!selectedNpc) {
      return <p className="npc-empty-state">先创建一个 NPC，再补充人设、系统提示词和规则。</p>;
    }

    return (
      <div className="npc-main-section">
        <div className="npc-section-header">
          <div>
            <p className="knowledge-section-eyebrow">人设</p>
            <h2>{selectedNpc.personaTitle || selectedNpc.name}</h2>
          </div>
        </div>
        <label className="knowledge-field">
          <span>人设标题</span>
          <input
            aria-label="人设标题"
            className="knowledge-inline-input"
            type="text"
            value={personaDraft.personaTitle}
            onChange={(event) => setPersonaDraft((current) => ({
              ...current,
              personaTitle: event.target.value
            }))}
          />
        </label>
        <label className="knowledge-field">
          <span>系统提示词</span>
          <textarea
            aria-label="系统提示词"
            className="settings-textarea"
            value={personaDraft.personaPrompt}
            onChange={(event) => setPersonaDraft((current) => ({
              ...current,
              personaPrompt: event.target.value
            }))}
          />
        </label>
        <label className="knowledge-field">
          <span>输出风格</span>
          <input
            aria-label="输出风格"
            className="knowledge-inline-input"
            type="text"
            value={personaDraft.outputStyle}
            onChange={(event) => setPersonaDraft((current) => ({
              ...current,
              outputStyle: event.target.value
            }))}
          />
        </label>
        <label className="knowledge-field">
          <span>Agent 草案</span>
          <textarea
            aria-label="Agent 草案"
            className="settings-textarea"
            value={personaDraft.agentDraft}
            onChange={(event) => setPersonaDraft((current) => ({
              ...current,
              agentDraft: event.target.value
            }))}
          />
        </label>
        <label className="knowledge-field">
          <span>规则草案</span>
          <textarea
            aria-label="规则草案"
            className="settings-textarea"
            value={personaDraft.rulesDraft}
            onChange={(event) => setPersonaDraft((current) => ({
              ...current,
              rulesDraft: event.target.value
            }))}
          />
        </label>
      </div>
    );
  }

  function renderSkillsSection() {
    if (!selectedNpc) {
      return <p className="npc-empty-state">先创建一个 NPC，再把工作区技能绑定到它。</p>;
    }

    return (
      <div className="npc-main-section">
        <div className="npc-section-header">
          <div>
            <p className="knowledge-section-eyebrow">技能</p>
            <h2>已绑定技能</h2>
          </div>
          <span className="workspace-history-badge">{selectedNpc.enabledSkillNames.length} 项</span>
        </div>
        {panelState.error ? <p className="workspace-knowledge-warning">{panelState.error}</p> : null}
        <div className="npc-compact-list">
          {skillRows.map((skill) => {
            const bound = selectedNpc.enabledSkillNames.includes(skill.name);
            const selected = state.npcWorkspace.selectedSkillName === skill.name;

            return (
              <button
                key={skill.name}
                className={bound || selected ? "npc-row-button active" : "npc-row-button"}
                type="button"
                onClick={() => onSelectNpcWorkspaceSkill?.(skill.name)}
              >
                <span className="npc-row-leading">
                  <span className={bound ? "npc-checkbox active" : "npc-checkbox"} aria-hidden="true" />
                  <span className="npc-row-title">{skill.name}</span>
                  <span className="npc-row-description">{skill.description || "这个技能还没有补充简介。"}</span>
                </span>
                <span className="npc-row-trailing">
                  <span className="npc-row-status">{bound ? "已选择" : "可选择"}</span>
                </span>
              </button>
            );
          })}
        </div>
        {skillRows.length === 0 ? (
          <p className="npc-empty-state">你还没有 skills，去 Skills 页面安装。</p>
        ) : null}
        {state.npcWorkspace.selectedSkillPreview && hasSelectedNpcSkill ? (
          <div className="npc-detail-panel">
            <p>{state.npcWorkspace.selectedSkillPreview.description}</p>
            <p className="workspace-knowledge-source">{state.npcWorkspace.selectedSkillPreview.path}</p>
            <p className="muted">{state.npcWorkspace.selectedSkillPreview.contentPreview}</p>
            <p className="npc-detail-status">
              {selectedNpc.enabledSkillNames.includes(state.npcWorkspace.selectedSkillName ?? "")
                ? "共享技能 · 当前 NPC 已绑定"
                : "共享技能 · 当前 NPC 未绑定"}
            </p>
            <p className="npc-detail-status">
              {selectedSkill?.enabled ? "OpenCow 已安装" : "OpenCow 未安装"}
            </p>
            <div className="action-row">
              <button
                className="action-button action-button-primary"
                type="button"
                onClick={() => onToggleNpcWorkspaceSkill?.(selectedNpc.id, state.npcWorkspace.selectedSkillName ?? "")}
              >
                {selectedNpc.enabledSkillNames.includes(state.npcWorkspace.selectedSkillName ?? "") ? "移除绑定" : "绑定技能"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function renderKnowledgeSection() {
    if (!selectedNpc) {
      return <p className="npc-empty-state">先创建一个 NPC，再为它选择要加载的知识库。</p>;
    }

    return (
      <div className="npc-main-section">
        <div className="npc-section-header">
          <div>
            <p className="knowledge-section-eyebrow">知识库</p>
            <h2>已绑定知识库</h2>
          </div>
          <span className="workspace-history-badge">{selectedNpc.knowledgeLibraryIds.length} 项</span>
        </div>
        <div className="npc-compact-list">
          {(knowledgeLibraries ?? []).map((library) => {
            const bound = boundKnowledgeIds.has(library.id);

            return (
              <button
                key={library.id}
                className={bound ? "npc-row-button active" : "npc-row-button"}
                type="button"
                onClick={() => onSelectNpcWorkspaceKnowledgeLibrary?.(library.id)}
              >
                <span className="npc-row-leading">
                  <span className="npc-row-title">{library.label}</span>
                  <span className="npc-row-description">{library.description || "这个知识库还没有补充简介。"}</span>
                </span>
                <span className="npc-row-trailing">
                  <span className="npc-row-meta">
                    {typeof library.documentCount === "number" ? `${library.documentCount} 篇文件` : "文件数待同步"}
                  </span>
                  <span className="npc-row-status">{bound ? "已绑定" : "可绑定"}</span>
                </span>
              </button>
            );
          })}
        </div>
        {(knowledgeLibraries ?? []).length === 0 ? (
          <p className="npc-empty-state">还没有可绑定的知识库，先到知识库页面新建。</p>
        ) : null}
        {selectedKnowledgeLibrary ? (
          <div className="npc-detail-panel">
            <p>{selectedKnowledgeLibrary.description || "这个知识库还没有补充简介。"}</p>
            <p className="npc-detail-status">
              {boundKnowledgeIds.has(selectedKnowledgeLibrary.id) ? "共享知识库 · 当前 NPC 已绑定" : "共享知识库 · 当前 NPC 未绑定"}
            </p>
            {typeof selectedKnowledgeLibrary.documentCount === "number" ? (
              <p className="muted">当前共 {selectedKnowledgeLibrary.documentCount} 篇文件</p>
            ) : null}
            <div className="action-row">
              <button
                className="action-button action-button-primary"
                type="button"
                onClick={() => onToggleNpcWorkspaceKnowledgeLibrary?.(selectedNpc.id, selectedKnowledgeLibrary.id)}
              >
                {boundKnowledgeIds.has(selectedKnowledgeLibrary.id) ? "取消绑定" : "绑定知识库"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section className="workspace-panel" aria-label="NPC">
      <header className="workspace-panel-header">
        <h1>NPC</h1>
        <p>左侧保留紧凑 NPC 卡片，中间是低代码配置区，右侧只做轻量分区导航。</p>
      </header>
      <div className="npc-workspace">
        <aside className="npc-rail" aria-label="NPC 列表">
          <div className="knowledge-section-heading">
            <div>
              <p>NPC</p>
              <span>{state.npcWorkspace.items.length} 个</span>
            </div>
            <button
              aria-label="新建 NPC"
              className="knowledge-create-button"
              type="button"
              onClick={() => setIsCreateOpen(true)}
            >
              +
            </button>
          </div>
          {isCreateOpen ? (
            <div className="knowledge-create-dialog">
              <label className="knowledge-field">
                <span>NPC 名称</span>
                <input
                  aria-label="新 NPC 名称"
                  className="knowledge-inline-input"
                  type="text"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                />
              </label>
              <label className="knowledge-field">
                <span>NPC 简介</span>
                <textarea
                  aria-label="新 NPC 简介"
                  className="settings-textarea"
                  value={draftDescription}
                  onChange={(event) => setDraftDescription(event.target.value)}
                />
              </label>
              <div className="action-row">
                <button className="action-button action-button-primary" type="button" onClick={submitCreateNpc}>
                  创建
                </button>
              </div>
            </div>
          ) : null}
          <div className="npc-card-list">
            {state.npcWorkspace.items.map((npc) => (
              <div
                key={npc.id}
                className={npc.id === state.npcWorkspace.selectedNpcId ? "npc-card-item active" : "npc-card-item"}
              >
                <button
                  aria-label={npc.name}
                  className="npc-card-main"
                  type="button"
                  onClick={() => onSelectNpcWorkspace?.(npc.id)}
                >
                  <span className="npc-card-title">{npc.name}</span>
                  <span className="npc-card-summary">{npc.personaTitle || npc.description || "未填写人设"}</span>
                </button>
                <button
                  aria-label={`配置 ${npc.name}`}
                  className="npc-card-gear"
                  type="button"
                  onClick={() => onSelectNpcWorkspace?.(npc.id)}
                >
                  ⚙
                </button>
              </div>
            ))}
          </div>
        </aside>
        <section className="npc-main" aria-label="NPC 配置区">
          {activeSection === "overview"
            ? renderOverviewSection()
            : activeSection === "persona"
              ? renderPersonaSection()
              : activeSection === "skills"
                ? renderSkillsSection()
                : renderKnowledgeSection()}
          {state.npcWorkspace.saveStatus ? (
            <p className={`npc-save-status npc-save-status-${getNpcSaveStatusTone(state.npcWorkspace.saveStatus)}`}>
              {state.npcWorkspace.saveStatus}
            </p>
          ) : null}
        </section>
        <aside className="npc-context-rail" aria-label="NPC 配置导航">
          <div className="npc-context-title">
            <strong>{selectedNpc?.name ?? "未选择 NPC"}</strong>
            <span>{selectedNpc?.personaTitle || selectedNpc?.description || "选择左侧 NPC 进入配置。"}</span>
          </div>
          <button
            className={activeSection === "overview" ? "npc-nav-row active" : "npc-nav-row"}
            type="button"
            onClick={() => onSelectNpcWorkspaceSection?.("overview")}
          >
            概览
          </button>
          <button
            className={activeSection === "persona" ? "npc-nav-row active" : "npc-nav-row"}
            type="button"
            onClick={() => onSelectNpcWorkspaceSection?.("persona")}
          >
            人设
          </button>
          <button
            className={activeSection === "skills" ? "npc-nav-row active" : "npc-nav-row"}
            type="button"
            onClick={() => onSelectNpcWorkspaceSection?.("skills")}
          >
            技能
          </button>
          <button
            className={activeSection === "knowledge" ? "npc-nav-row active" : "npc-nav-row"}
            type="button"
            onClick={() => onSelectNpcWorkspaceSection?.("knowledge")}
          >
            知识库
          </button>
        </aside>
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

function SearchPanel({
  state,
  panelState,
  onToggleSearch,
  onQueryChange,
  onRunSearch,
  onProviderChange,
  onBaseUrlChange,
  onApiKeyChange,
  onSaveConfig,
  onDismissFallbackNotice,
  onSuppressFallbackNotice
}: {
  state: WorkbenchState;
  panelState: SearchPanelState;
  onToggleSearch: (enabled: boolean) => void;
  onQueryChange: (query: string) => void;
  onRunSearch: () => void;
  onProviderChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onSaveConfig: () => void;
  onDismissFallbackNotice: () => void;
  onSuppressFallbackNotice: () => void;
}) {
  const visibleSources = state.sources.items;
  const fallbackVisible = Boolean(state.search.lastFallbackReason && !state.search.suppressFallbackNotice);

  return (
    <section className="workspace-panel" aria-label="搜索">
      <header className="workspace-panel-header">
        <h1>搜索</h1>
        <p>默认使用 OpenCow 默认搜索。保存自定义搜索 API 后会优先使用用户配置，失败时自动回退。</p>
      </header>
      <div className="workspace-panel-list">
        <div className="workspace-history-card workspace-history-card-current">
          <p>当前状态</p>
          <p className="muted">
            {state.search.enabled ? "联网搜索已开启" : "联网搜索已关闭"} · 当前生效提供方：{state.search.effectiveProvider}
          </p>
          <div className="action-row">
            <button className="action-button action-button-primary" type="button" onClick={() => onToggleSearch(!state.search.enabled)}>
              {state.search.enabled ? "关闭联网搜索" : "开启联网搜索"}
            </button>
          </div>
        </div>

        {fallbackVisible ? (
          <div className="workspace-history-card">
            <p>回退提示</p>
            <p className="muted">{state.search.lastFallbackReason}</p>
            <div className="action-row">
              <button className="action-button" type="button" onClick={onDismissFallbackNotice}>
                知道了
              </button>
              <button className="action-button" type="button" onClick={onSuppressFallbackNotice}>
                以后不再提示
              </button>
            </div>
          </div>
        ) : null}

        <div className="workspace-history-card">
          <p>OpenCow 默认搜索</p>
          <p className="muted">免 API，可直接启用，适合作为开箱即用和失败回退方案。</p>
        </div>

        <div className="workspace-history-card">
          <p>自定义搜索 API</p>
          <div className="settings-form">
            <label>
              <span>搜索 Provider</span>
              <input aria-label="联网搜索 Provider" type="text" value={panelState.customProviderLabel} onChange={(event) => onProviderChange(event.target.value)} />
            </label>
            <label>
              <span>搜索 Base URL</span>
              <input aria-label="联网搜索 Base URL" type="text" value={panelState.customBaseUrl} onChange={(event) => onBaseUrlChange(event.target.value)} />
            </label>
            <label>
              <span>搜索 API Key</span>
              <input aria-label="联网搜索 API Key" type="password" value={panelState.customApiKey} onChange={(event) => onApiKeyChange(event.target.value)} />
            </label>
          </div>
          <div className="action-row">
            <button className="action-button action-button-primary" type="button" onClick={onSaveConfig}>
              保存联网搜索配置
            </button>
          </div>
        </div>

        <div className="workspace-history-card">
          <p>手动测试</p>
          <input
            aria-label="搜索测试输入"
            className="settings-textarea"
            type="text"
            value={panelState.query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          <div className="action-row">
            <button className="action-button action-button-primary" type="button" onClick={onRunSearch}>
              测试联网搜索
            </button>
          </div>
        </div>

        <div className="npc-main-section">
          <div className="npc-section-header">
            <div>
              <p className="knowledge-section-eyebrow">最近来源</p>
              <h2>搜索来源</h2>
            </div>
            <span className="workspace-history-badge">{visibleSources.length} 项</span>
          </div>
          <div className="npc-compact-list">
            {visibleSources.length === 0 ? (
              <p className="npc-empty-state">当前还没有搜索记录。开启后可直接在这里测试或在会话里触发联网搜索。</p>
            ) : visibleSources.map((source) => (
              <div key={`${source.provider}-${source.url}`} className="npc-row-button search-source-row">
                <span className="npc-row-leading">
                  <span className="npc-row-title">{source.title}</span>
                  <span className="npc-row-description">{source.summary}</span>
                  <span className="npc-row-meta">来源：{source.sourceLabel || source.provider}</span>
                </span>
                <a
                  className="message-link-button"
                  href={source.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  原文链接
                </a>
              </div>
            ))}
          </div>
        </div>
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
        <p className="workspace-knowledge-source">{file.path.startsWith("uploads/") ? "本地上传" : "知识库文件"}</p>
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
  knowledgeFileInputLabel,
  knowledgeLibraryLabel,
  knowledgeLibraries,
  onCreateKnowledgeLibrary,
  onSelectKnowledgeLibrary,
  onRequestClose,
  onMinimizeApp
}: {
  state: WorkbenchState;
  onImportKnowledgeFile: (path: string) => void;
  onImportLocalKnowledgeFiles?: (files?: File[]) => void;
  onRemoveKnowledgeFile: (path: string) => void;
  knowledgeFileInputLabel?: string;
  knowledgeLibraryLabel?: string;
  knowledgeLibraries?: Array<{
    id: string;
    label: string;
    description?: string;
    active: boolean;
    documentCount?: number;
  }>;
  onCreateKnowledgeLibrary?: (name: string, description?: string) => void;
  onSelectKnowledgeLibrary?: (libraryId: string) => void;
  onRequestClose?: () => void;
  onMinimizeApp?: () => void;
}) {
  const [draftLibraryName, setDraftLibraryName] = useState("");
  const [draftLibraryDescription, setDraftLibraryDescription] = useState("");
  const [knowledgeFilter, setKnowledgeFilter] = useState("");
  const [isCreateLibraryDialogOpen, setIsCreateLibraryDialogOpen] = useState(false);
  const stateKnowledgeLibraries = state.knowledge.libraries ?? [];
  const derivedKnowledgeLibraries =
    knowledgeLibraries ??
    stateKnowledgeLibraries.map((library) => ({
      id: library.id,
      label: library.label,
      description: library.description,
      documentCount: library.documentCount,
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
  const normalizedKnowledgeFilter = knowledgeFilter.trim().toLowerCase();
  const filteredImportedFiles = normalizedKnowledgeFilter
    ? importedFiles.filter((file) => `${file.title} ${file.path}`.toLowerCase().includes(normalizedKnowledgeFilter))
    : importedFiles;
  const filteredAvailableFiles = normalizedKnowledgeFilter
    ? availableFiles.filter((file) => `${file.title} ${file.path}`.toLowerCase().includes(normalizedKnowledgeFilter))
    : availableFiles;

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
            {canCreateKnowledgeLibrary && knowledgeFileInputLabel ? (
              <div className="knowledge-inline-create">
                <input
                  aria-label="新知识库名称"
                  className="knowledge-inline-input"
                  placeholder="例如：产品文档库"
                  type="text"
                  value={draftLibraryName}
                  onChange={(event) => setDraftLibraryName(event.target.value)}
                />
                <button
                  aria-label="创建知识库"
                  className="knowledge-create-button"
                  type="button"
                  onClick={() => submitKnowledgeLibraryDraft()}
                >
                  创建知识库
                </button>
              </div>
            ) : canCreateKnowledgeLibrary ? (
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
              {knowledgeFileInputLabel ? <span>当前知识库：{currentKnowledgeLibraryLabel}</span> : null}
              <h2>{currentKnowledgeLibraryLabel}</h2>
            </div>
            <span className="workspace-history-badge">已索引文件 {state.storage.knowledgeCount}</span>
          </div>
          <input
            aria-label="筛选当前知识库文件"
            className="knowledge-inline-input"
            placeholder="筛选当前知识库文件"
            type="text"
            value={knowledgeFilter}
            onChange={(event) => setKnowledgeFilter(event.target.value)}
          />
          <div className="knowledge-dropzone">
            <strong>把文件拖到这里加入当前知识库</strong>
            <p>可以从右侧文件库拖入，也可以直接拖入 Finder 文件。文件先上传到文件库，再拖进某个知识库。文件库对所有知识库互通。</p>
          </div>
          <div className="knowledge-section-heading">
            <div>
              <p>当前知识库文件</p>
              <span>{filteredImportedFiles.length === 0 ? "还没有文件" : `${filteredImportedFiles.length} 个文件`}</span>
            </div>
          </div>
          <div className="knowledge-file-list">
            {filteredImportedFiles.length === 0 ? (
              <p className="knowledge-empty-state">还没有已纳入知识库的文件。先从下方候选文件中手动加入。</p>
            ) : (
              filteredImportedFiles.map((file) => renderKnowledgeLibraryFileRow(file, onRemoveKnowledgeFile))
            )}
          </div>
        </section>

        <aside className="knowledge-file-pool" aria-label="文件库">
          <div className="knowledge-section-heading">
            <div>
              <p>文件库</p>
              <span>{filteredAvailableFiles.length === 0 ? "暂无待加入文件" : `${filteredAvailableFiles.length} 个待加入文件`}</span>
            </div>
            <button
              aria-label="上传文件到文件库"
              className="knowledge-create-button"
              type="button"
              onClick={() => onImportLocalKnowledgeFiles?.()}
            >
              +
            </button>
            {knowledgeFileInputLabel ? (
              <input
                aria-label={knowledgeFileInputLabel}
                accept=".md,.txt,text/markdown,text/plain"
                hidden
                type="file"
                multiple
                onChange={(event) => {
                  onImportLocalKnowledgeFiles?.(Array.from(event.target.files ?? []));
                  event.currentTarget.value = "";
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  onImportLocalKnowledgeFiles?.(Array.from(event.dataTransfer.files));
                }}
              />
            ) : null}
          </div>
          <p className="knowledge-file-pool-hint">点击右上角加号，把本机文档直接纳入文件库。</p>
          <div className="knowledge-file-list">
            {filteredAvailableFiles.length === 0 ? (
              <p className="knowledge-empty-state">当前没有新的可导入文件。</p>
            ) : (
              filteredAvailableFiles.map((file) => (
                <div className="knowledge-file-row" key={file.path}>
                  <div className="knowledge-file-main">
                    <p>{file.title}</p>
                    <p className="workspace-knowledge-source">{file.path}</p>
                  </div>
                  <button
                    aria-label={`加入知识库：${file.title}`}
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
  onSaveOllamaConfig,
  onToggleRemoteApi,
  onSaveRemoteApiConfig,
  onSelectNpcModel,
  onUpdateRollbackLimit,
  onCleanupStorage,
  onRestoreRecentConversation,
  onDeleteRecentConversation
}: {
  state: WorkbenchState;
  focusTarget: ModelSettingsTarget | null;
  onRetryOllamaCheck: () => void;
  onSaveOllamaConfig: (payload: {
    longAnswerNumPredict: number;
    autoContinuationLimit: number;
    continuationTailLimit: number;
  }) => void;
  onToggleRemoteApi: (enabled: boolean) => void;
  onSaveRemoteApiConfig: (payload: { baseUrl: string; providerLabel: string; apiKey: string }) => void;
  onSelectNpcModel: (modelName: string) => void;
  onUpdateRollbackLimit: (limit: number) => void;
  onCleanupStorage: (target: StorageCleanupTarget) => void;
  onRestoreRecentConversation: (conversationId: string) => void;
  onDeleteRecentConversation: (conversationId: string) => void;
}) {
  const [remoteApiBaseUrl, setRemoteApiBaseUrl] = useState(state.settings.remoteApi.baseUrl);
  const [remoteApiProviderLabel, setRemoteApiProviderLabel] = useState(state.settings.remoteApi.providerLabel);
  const [remoteApiKey, setRemoteApiKey] = useState(state.settings.remoteApi.apiKey);
  const [longAnswerNumPredict, setLongAnswerNumPredict] = useState(String(state.settings.ollama.longAnswerNumPredict));
  const [autoContinuationLimit, setAutoContinuationLimit] = useState(String(state.settings.ollama.autoContinuationLimit));
  const [continuationTailLimit, setContinuationTailLimit] = useState(String(state.settings.ollama.continuationTailLimit));
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
    setLongAnswerNumPredict(String(state.settings.ollama.longAnswerNumPredict));
    setAutoContinuationLimit(String(state.settings.ollama.autoContinuationLimit));
    setContinuationTailLimit(String(state.settings.ollama.continuationTailLimit));
  }, [
    state.settings.ollama.autoContinuationLimit,
    state.settings.ollama.continuationTailLimit,
    state.settings.ollama.longAnswerNumPredict
  ]);

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
        <div className="settings-form">
          <label>
            <span>长回答输出预算</span>
            <input
              aria-label="长回答输出预算"
              type="number"
              min={1024}
              max={16384}
              step={256}
              value={longAnswerNumPredict}
              onChange={(event) => setLongAnswerNumPredict(event.target.value)}
            />
          </label>
          <label>
            <span>自动续写次数上限</span>
            <input
              aria-label="自动续写次数上限"
              type="number"
              min={1}
              max={24}
              step={1}
              value={autoContinuationLimit}
              onChange={(event) => setAutoContinuationLimit(event.target.value)}
            />
          </label>
          <label>
            <span>续写参考尾部长度</span>
            <input
              aria-label="续写参考尾部长度"
              type="number"
              min={1200}
              max={4800}
              step={100}
              value={continuationTailLimit}
              onChange={(event) => setContinuationTailLimit(event.target.value)}
            />
          </label>
        </div>
        <p className="muted">值越大，长回答更不容易中断，但耗时和资源占用会更高。</p>
        <div className="action-row">
          <button className="action-button action-button-primary" type="button" onClick={onRetryOllamaCheck}>
            重新检测 Ollama
          </button>
          <button
            className="action-button"
            type="button"
            onClick={() =>
              onSaveOllamaConfig({
                longAnswerNumPredict: Number.parseInt(longAnswerNumPredict, 10),
                autoContinuationLimit: Number.parseInt(autoContinuationLimit, 10),
                continuationTailLimit: Number.parseInt(continuationTailLimit, 10)
              })
            }
          >
            保存长回答设置
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
  onSaveOllamaConfig,
  onSaveRemoteApiConfig,
  onSaveSearchProviderConfig,
  onSelectModel,
  onSelectNpcModel,
  onNewConversation,
  onArchiveConversation,
  onRestoreRecentConversation,
  onDeleteRecentConversation,
  confirmRecentConversationDelete,
  onImportKnowledgeFile,
  onImportLocalKnowledgeFiles,
  onRemoveKnowledgeFile,
  knowledgeReferenceLabel,
  knowledgeFileInputLabel,
  inspectorCompatibilityOutputLabel,
  knowledgeLibraryLabel,
  knowledgeLibraries,
  onCreateKnowledgeLibrary,
  onSelectKnowledgeLibrary,
  onCreateNpcWorkspace,
  onSelectConversationNpc,
  onSelectNpcWorkspace,
  onSelectNpcWorkspaceSection,
  onUpdateNpcWorkspaceOverview,
  onUpdateNpcWorkspacePersona,
  onToggleNpcWorkspaceSkill,
  onToggleNpcWorkspaceKnowledgeLibrary,
  onSelectNpcWorkspaceKnowledgeLibrary,
  onSelectNpcWorkspaceSkill,
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
    recommended: null,
    match: null,
    query: "",
    actionQuery: "",
    activeTab: "installed",
    expandedSkillName: null
  });
  const [mcpPanelState, setMcpPanelState] = useState<MspPanelState>({
    loading: false,
    error: null,
    scan: null,
    recommended: null,
    inspect: null,
    preview: null,
    query: "",
    actionQuery: "",
    activeTab: "installed",
    expandedPluginId: null
  });
  const [searchPanelState, setSearchPanelState] = useState<SearchPanelState>({
    query: "",
    customProviderLabel: state.search.customProviderLabel,
    customBaseUrl: state.search.customBaseUrl,
    customApiKey: state.search.customApiKey
  });
  const [npcPanelState, setNpcPanelState] = useState<NpcPanelState>({
    loading: false,
    error: null,
    skills: null
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

  useEffect(() => {
    setSearchPanelState((current) => ({
      ...current,
      customProviderLabel: state.search.customProviderLabel,
      customBaseUrl: state.search.customBaseUrl,
      customApiKey: state.search.customApiKey
    }));
  }, [
    state.search.customApiKey,
    state.search.customBaseUrl,
    state.search.customProviderLabel
  ]);

  async function refreshSkillsPanel() {
    setSkillsPanelState((current) => ({ ...current, loading: true, error: null }));

    try {
      const [scan, enabled, recommended] = await Promise.all([
        scanLocalSkills(),
        listEnabledLocalSkills(),
        loadRecommendedSkillManifest()
      ]);
      setSkillsPanelState((current) => ({
        ...current,
        loading: false,
        scan,
        enabled,
        recommended
      }));
      setNpcPanelState((current) => ({
        ...current,
        skills: scan,
        loading: false,
        error: null
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
      const [scan, recommended] = await Promise.all([scanLocalMcpPlugins(), loadRecommendedMcpManifest()]);
      setMcpPanelState((current) => ({
        ...current,
        loading: false,
        scan,
        recommended
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
      const skills = await scanLocalSkills();
      setNpcPanelState((current) => ({
        ...current,
        loading: false,
        skills
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

  async function installRecommendedSkill(query: string) {
    const normalized = query.trim();

    if (!normalized) {
      return;
    }

    setSkillsPanelState((current) => ({
      ...current,
      loading: true,
      error: null,
      actionQuery: normalized
    }));

    try {
      await installLocalSkill(normalized);
      await refreshSkillsPanel();
    } catch (error) {
      setSkillsPanelState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "执行 Skill 安装失败"
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

  async function inspectMcpPluginById(pluginId: string) {
    setMcpPanelState((current) => ({
      ...current,
      loading: true,
      error: null,
      query: pluginId,
      expandedPluginId: pluginId
    }));

    try {
      const [inspect, preview] = await Promise.all([inspectLocalMcpPlugin(pluginId), previewLocalMcpPluginStart(pluginId)]);
      setMcpPanelState((current) => ({
        ...current,
        loading: false,
        inspect,
        preview,
        query: pluginId
      }));
    } catch (error) {
      setMcpPanelState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "读取 MCP 详情失败"
      }));
    }
  }

  async function startMcpPluginById(pluginId: string) {
    setMcpPanelState((current) => ({
      ...current,
      loading: true,
      error: null,
      query: pluginId
    }));

    try {
      await startLocalMcpPlugin(pluginId);
      await inspectMcpPluginById(pluginId);
      await refreshMcpPanel();
    } catch (error) {
      setMcpPanelState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "启动 MCP 插件失败"
      }));
    }
  }

  async function installMcpPluginById(pluginId: string) {
    setMcpPanelState((current) => ({
      ...current,
      loading: true,
      error: null,
      actionQuery: pluginId
    }));

    try {
      await installLocalMcpPlugin(pluginId);
      await refreshMcpPanel();
      setMcpPanelState((current) => ({
        ...current,
        activeTab: "installed",
        expandedPluginId: pluginId
      }));
    } catch (error) {
      setMcpPanelState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "安装 MCP 失败"
      }));
    }
  }

  async function removeMcpPluginById(pluginId: string) {
    setMcpPanelState((current) => ({
      ...current,
      loading: true,
      error: null,
      actionQuery: pluginId
    }));

    try {
      await uninstallLocalMcpPlugin(pluginId);
      await refreshMcpPanel();
      setMcpPanelState((current) => ({
        ...current,
        expandedPluginId: current.expandedPluginId === pluginId ? null : current.expandedPluginId
      }));
    } catch (error) {
      setMcpPanelState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "删除 MCP 失败"
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
    if (activeView === "npc" && !npcPanelState.skills && !npcPanelState.loading) {
      void refreshNpcPanel();
    }
  }, [
    activeView,
    mcpPanelState.loading,
    mcpPanelState.scan,
    npcPanelState.skills,
    npcPanelState.loading,
    skillsPanelState.loading,
    skillsPanelState.scan
  ]);

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
    if (confirmRecentConversationDelete) {
      onDeleteRecentConversation(conversationId);
      return;
    }

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
            onRetryLocalTask={handleRetryLocalTask}
            onRestoreRecentConversation={onRestoreRecentConversation}
            onDeleteRecentConversation={onDeleteRecentConversation}
            onSubmitTask={onSubmitTask}
            onOpenAttachment={(attachment) => {
              void openChatAttachment(attachment);
            }}
            knowledgeReferenceLabel={knowledgeReferenceLabel}
          />
        ) : activeView === "knowledge" ? (
        <KnowledgePanel
          state={state}
          onImportKnowledgeFile={onImportKnowledgeFile}
          onImportLocalKnowledgeFiles={onImportLocalKnowledgeFiles}
          knowledgeFileInputLabel={knowledgeFileInputLabel}
          onRemoveKnowledgeFile={onRemoveKnowledgeFile}
          knowledgeLibraryLabel={knowledgeLibraryLabel}
          knowledgeLibraries={knowledgeLibraries}
          onCreateKnowledgeLibrary={onCreateKnowledgeLibrary}
          onSelectKnowledgeLibrary={onSelectKnowledgeLibrary}
        />
        ) : activeView === "skills" ? (
          <SkillsPanel
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
            onInstallRecommendedSkill={(query) => void installRecommendedSkill(query)}
            onToggleTab={(activeTab) =>
              setSkillsPanelState((current) => ({ ...current, activeTab, expandedSkillName: null }))
            }
            onToggleExpand={(skillName) =>
              setSkillsPanelState((current) => ({
                ...current,
                expandedSkillName: current.expandedSkillName === skillName ? null : skillName
              }))
            }
          />
        ) : activeView === "npc" ? (
          <NpcPanel
            state={state}
            panelState={npcPanelState}
            knowledgeLibraries={knowledgeLibraries}
            onCreateNpcWorkspace={onCreateNpcWorkspace}
            onSelectNpcWorkspace={onSelectNpcWorkspace}
            onSelectNpcWorkspaceSection={onSelectNpcWorkspaceSection}
            onUpdateNpcWorkspaceOverview={onUpdateNpcWorkspaceOverview}
            onUpdateNpcWorkspacePersona={onUpdateNpcWorkspacePersona}
            onToggleNpcWorkspaceSkill={onToggleNpcWorkspaceSkill}
            onToggleNpcWorkspaceKnowledgeLibrary={onToggleNpcWorkspaceKnowledgeLibrary}
            onSelectNpcWorkspaceKnowledgeLibrary={onSelectNpcWorkspaceKnowledgeLibrary}
            onSelectNpcWorkspaceSkill={onSelectNpcWorkspaceSkill}
          />
        ) : activeView === "mcp" ? (
          <McpPanel
            panelState={mcpPanelState}
            onRefresh={() => void refreshMcpPanel()}
            onSelectTab={(activeTab) =>
              setMcpPanelState((current) => ({ ...current, activeTab, expandedPluginId: null }))
            }
            onToggleExpand={(pluginId) =>
              setMcpPanelState((current) => ({
                ...current,
                expandedPluginId: current.expandedPluginId === pluginId ? null : pluginId
              }))
            }
            onInspect={(pluginId) => void inspectMcpPluginById(pluginId)}
            onStart={(pluginId) => void startMcpPluginById(pluginId)}
            onInstall={(pluginId) => void installMcpPluginById(pluginId)}
            onRemove={(pluginId) => void removeMcpPluginById(pluginId)}
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
        ) : activeView === "search" ? (
          <SearchPanel
            state={state}
            panelState={searchPanelState}
            onToggleSearch={onToggleSearch}
            onQueryChange={(query) => setSearchPanelState((current) => ({ ...current, query }))}
            onRunSearch={() => {
              const query = searchPanelState.query.trim();
              if (!query) {
                return;
              }
              handleSubmitTask(query);
            }}
            onProviderChange={(value) => setSearchPanelState((current) => ({ ...current, customProviderLabel: value }))}
            onBaseUrlChange={(value) => setSearchPanelState((current) => ({ ...current, customBaseUrl: value }))}
            onApiKeyChange={(value) => setSearchPanelState((current) => ({ ...current, customApiKey: value }))}
            onSaveConfig={() =>
            onSaveSearchProviderConfig({
              providerLabel: searchPanelState.customProviderLabel,
              baseUrl: searchPanelState.customBaseUrl,
              apiKey: searchPanelState.customApiKey
              } as {
                providerLabel: string;
                baseUrl: string;
                apiKey: string;
              })
            }
            onDismissFallbackNotice={() => {
              onSaveSearchProviderConfig({
                providerLabel: state.search.customProviderLabel,
                baseUrl: state.search.customBaseUrl,
                apiKey: state.search.customApiKey,
                clearFallbackNotice: true
              } as {
                providerLabel: string;
                baseUrl: string;
                apiKey: string;
                clearFallbackNotice: boolean;
              });
            }}
            onSuppressFallbackNotice={() =>
              onSaveSearchProviderConfig({
                providerLabel: state.search.customProviderLabel,
                baseUrl: state.search.customBaseUrl,
                apiKey: state.search.customApiKey,
                suppressFallbackNotice: true,
                clearFallbackNotice: true
              } as {
                providerLabel: string;
                baseUrl: string;
                apiKey: string;
                suppressFallbackNotice: boolean;
                clearFallbackNotice: boolean;
              })
            }
          />
        ) : isSettingsView ? (
          <SettingsPanel
            state={state}
            focusTarget={settingsFocus}
            onRetryOllamaCheck={onRetryOllamaCheck}
            onSaveOllamaConfig={onSaveOllamaConfig}
            onToggleRemoteApi={onToggleRemoteApi}
            onSaveRemoteApiConfig={onSaveRemoteApiConfig}
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
            onSelectConversationNpc={onSelectConversationNpc}
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
        compatibilityOutputLabel={inspectorCompatibilityOutputLabel}
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
      {state.rollback.pendingPreview ? (
        <div className="app-close-overlay" role="dialog" aria-label="回退确认">
          <div className="app-close-dialog">
            <h2>确认回退</h2>
            <p>将回退到“{state.rollback.pendingPreview.targetLabel}”，撤销 {state.rollback.pendingPreview.willRevertCount} 个后续状态。</p>
            <div className="action-row">
              <button
                type="button"
                className="action-button action-button-primary"
                onClick={onApplyRollback}
              >
                确认回退
              </button>
              <button
                type="button"
                className="action-button"
                onClick={onCancelRollback}
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
