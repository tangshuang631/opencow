import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Workbench } from "./Workbench";
import type {
  LocalMcpPluginInspectResult,
  LocalMcpPluginInstallResult,
  LocalMcpPluginScanResult,
  LocalMcpPluginStartPreviewResult,
  LocalSkillScanResult,
  RecommendedMcpManifestResult,
  RecommendedSkillManifestResult
} from "../assistant/localAssistantService";
import {
  createCommandPolicyBlockedState,
  createInitialWorkbenchState,
  createOllamaLoadErrorState,
  createStorageCleanupState,
  createTaskExecutionFailedState,
  createTaskExecutionStartedState,
  createUserTaskSubmittedState,
  requestPermissionModeChangeState
} from "./workbenchState";

async function click(element: Element) {
  const user =
    typeof vi.isFakeTimers === "function" && vi.isFakeTimers()
      ? userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      : userEvent.setup();
  await user.click(element);
}

async function change(element: Element, value: string) {
  const user =
    typeof vi.isFakeTimers === "function" && vi.isFakeTimers()
      ? userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      : userEvent.setup();
  await user.clear(element as HTMLElement);
  await user.type(element as HTMLElement, value);
}

const mockLocalAssistantService = vi.hoisted(() => ({
  scanLocalSkills: vi.fn<() => Promise<LocalSkillScanResult>>(async () => ({
    summary: "OpenCow 已安装技能列表为空。",
    total_count: 0,
    scanned_root_count: 1,
    items: []
  })),
  loadRecommendedSkillManifest: vi.fn<() => Promise<RecommendedSkillManifestResult>>(async () => ({
    summary: "OpenCow 推荐技能清单已加载，共 2 项。",
    total_count: 2,
    items: [
      {
        name: "coding-agent",
        description: "代码代理",
        source: "opencow-builtin-manifest",
        install_query: "coding-agent",
        rationale: "OpenCow 本地助手最常见的是代码落地与修复，这项覆盖率最高。"
      },
      {
        name: "browser-automation",
        description: "浏览器自动化",
        source: "opencow-builtin-manifest",
        install_query: "browser-automation",
        rationale: "桌面端和本地 Web 联调频繁，浏览器自动化非常适合作为默认精选能力。"
      }
    ]
  })),
  listEnabledLocalSkills: vi.fn(async () => ({
    summary: "已启用 1 个 Skill",
    total_count: 1,
    registry_path: ".opencow/skills/enabled-skills.json",
    items: [
      {
        name: "coding-agent",
        path: "skills/coding-agent/SKILL.md",
        source: "workspace-skill",
        description: "代码代理"
      }
    ]
  })),
  matchEnabledLocalSkills: vi.fn(async (query: string) => ({
    query,
    summary: "匹配到 1 个推荐 Skill",
    registry_path: ".opencow/skills/enabled-skills.json",
    enabled_skill_count: 1,
    match_count: 1,
    items: [
      {
        name: "coding-agent",
        path: "skills/coding-agent/SKILL.md",
        source: "workspace-skill",
        description: "代码代理",
        content_preview: "适合当前编码任务"
      }
    ]
  })),
  enableLocalSkill: vi.fn(async () => ({
    query: "coding-agent",
    enabled_skill_name: "coding-agent",
    registry_path: ".opencow/skills/enabled-skills.json",
    status: "enabled",
    summary: "已启用 coding-agent"
  })),
  installLocalSkill: vi.fn(async () => ({
    query: "coding-agent",
    installed_skill_name: "coding-agent",
    installed_skill_path: "skills/coding-agent/SKILL.md",
    source_skill_path: "skills/coding-agent/SKILL.md",
    status: "installed",
    summary: "已安装 coding-agent"
  })),
  disableLocalSkill: vi.fn(async () => ({
    query: "coding-agent",
    disabled_skill_name: "coding-agent",
    registry_path: ".opencow/skills/enabled-skills.json",
    status: "disabled",
    summary: "已禁用 coding-agent"
  })),
  loadRecommendedMcpManifest: vi.fn<() => Promise<RecommendedMcpManifestResult>>(async () => ({
    summary: "OpenCow 推荐 MCP 清单已加载，共 2 项。",
    total_count: 2,
    items: [
      {
        id: "browser",
        name: "浏览器控制",
        description: "用于浏览器联调、页面检查和点击操作。",
        source: "opencow-builtin-manifest",
        install_query: "browser",
        rationale: "这是 OpenCow 当前最成熟、最常用的 MCP 类型之一。",
        supported: true
      },
      {
        id: "fetch",
        name: "网页读取",
        description: "适合后续补充网页内容抓取和结构化读取。",
        source: "opencow-builtin-manifest",
        install_query: "fetch",
        rationale: "先进入推荐清单，后续再补稳定宿主。",
        supported: false
      }
    ]
  })),
  scanLocalMcpPlugins: vi.fn<() => Promise<LocalMcpPluginScanResult>>(async () => ({
    summary: "扫描到 1 个 MCP 插件",
    total_count: 1,
    scanned_root_count: 1,
    items: [
      {
        id: "browser",
        name: "浏览器控制",
        path: "plugins/browser/openclaw.plugin.json",
        source: "workspace-plugin",
        description: "浏览器插件",
        activation: "startup",
        tool_count: 1,
        skill_count: 1,
        status: "stopped",
        supported: true
      }
    ]
  })),
  inspectLocalMcpPlugin: vi.fn<(query: string) => Promise<LocalMcpPluginInspectResult>>(async (query: string) => ({
    query,
    summary: "找到 1 个 MCP 插件详情",
    match_count: 1,
    scanned_root_count: 1,
    items: [
      {
        id: "browser",
        path: "plugins/browser/openclaw.plugin.json",
        source: "workspace-plugin",
        activation: "startup",
        tool_count: 1,
        skill_count: 1,
        description: "浏览器插件",
        tool_names: ["browser"],
        skill_paths: ["./skills"]
      }
    ]
  })),
  previewLocalMcpPluginStart: vi.fn<(query: string) => Promise<LocalMcpPluginStartPreviewResult>>(async (query: string) => ({
    query,
    summary: "找到 1 个启动预览",
    match_count: 1,
    scanned_root_count: 1,
    items: [
      {
        id: "browser",
        path: "plugins/browser/openclaw.plugin.json",
        source: "workspace-plugin",
        activation: "startup",
        startup_allowed: false,
        command_preview: "node vendor/openclaw/openclaw.mjs browser start",
        working_directory: "plugins/browser",
        risk_summary: "仅预览，不启动进程",
        requires_config: false,
        config_hint: "无额外配置"
      }
    ]
  })),
  startLocalMcpPlugin: vi.fn(async (query: string) => ({
    plugin_id: query,
    command_label: "browser",
    working_directory: "plugins/browser",
    stdout_preview: "started",
    line_count: 1,
    summary: "已启动 browser"
  })),
  installLocalMcpPlugin: vi.fn<(query: string) => Promise<LocalMcpPluginInstallResult>>(async (query: string) => ({
    query,
    installed_plugin_id: "browser",
    installed_plugin_name: "浏览器控制",
    installed_plugin_path: "mcp/installed/browser/openclaw.plugin.json",
    source_plugin_path: "vendor/openclaw/extensions/browser/openclaw.plugin.json",
    status: "installed",
    summary: "已安装浏览器控制"
  })),
  uninstallLocalMcpPlugin: vi.fn(async (query: string) => ({
    query,
    removed_plugin_id: "browser",
    removed_plugin_name: "浏览器控制",
    removed_plugin_path: "mcp/installed/browser/openclaw.plugin.json",
    status: "removed",
    summary: "已删除浏览器控制"
  })),
  loadOpenClawCapabilityOverview: vi.fn(async () => ({
    capability_id: "npc",
    title: "NPC capability",
    status: "ready-foundation",
    required_package_count: 2,
    available_package_count: 2,
    available_packages: ["npc-core", "npc-shell"],
    missing_packages: [],
    summary: "NPC 本地能力基础可用"
  })),
  writeNpcConfig: vi.fn(async () => ({
    npc_name: "opencow",
    config_path: ".opencow/npc/config.json",
    status: "saved",
    summary: "NPC 配置已保存"
  }))
}));

function createWorkbenchProps(
  state = createInitialWorkbenchState(),
  overrides: Partial<ComponentProps<typeof Workbench>> = {}
) {
  const noop = vi.fn();

  return {
    state,
    onApproveDangerousAction: noop,
    onCancelDangerousAction: noop,
    onApprovePermissionRequest: noop,
    onCancelPermissionRequest: noop,
    onRetryOllamaCheck: noop,
    onRecoverToolError: noop,
    onPreviewRollback: noop,
    onApplyRollback: noop,
    onCancelRollback: noop,
    onRetryLocalTask: noop,
    onCancelActiveTask: noop,
    onUpdateRollbackLimit: noop,
    onCleanupStorage: noop,
    onToggleRemoteApi: noop,
    onToggleSearch: noop,
    onSaveOllamaConfig: noop,
    onSaveRemoteApiConfig: noop,
    onSaveSearchProviderConfig: noop,
    onSelectModel: noop,
    onNewConversation: noop,
    onArchiveConversation: noop,
    onRestoreRecentConversation: noop,
    onDeleteRecentConversation: noop,
    onImportKnowledgeFile: noop,
    onCreateKnowledgeLibrary: noop,
    onSelectKnowledgeLibrary: noop,
    onRemoveKnowledgeFile: noop,
    onSubmitTask: noop,
    ...overrides
  };
}

vi.mock("../assistant/localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("../assistant/localAssistantService")>("../assistant/localAssistantService");

  return {
    ...actual,
    scanLocalSkills: mockLocalAssistantService.scanLocalSkills,
    loadRecommendedSkillManifest: mockLocalAssistantService.loadRecommendedSkillManifest,
    listEnabledLocalSkills: mockLocalAssistantService.listEnabledLocalSkills,
    matchEnabledLocalSkills: mockLocalAssistantService.matchEnabledLocalSkills,
    enableLocalSkill: mockLocalAssistantService.enableLocalSkill,
    installLocalSkill: mockLocalAssistantService.installLocalSkill,
    disableLocalSkill: mockLocalAssistantService.disableLocalSkill,
    loadRecommendedMcpManifest: mockLocalAssistantService.loadRecommendedMcpManifest,
    scanLocalMcpPlugins: mockLocalAssistantService.scanLocalMcpPlugins,
    inspectLocalMcpPlugin: mockLocalAssistantService.inspectLocalMcpPlugin,
    previewLocalMcpPluginStart: mockLocalAssistantService.previewLocalMcpPluginStart,
    startLocalMcpPlugin: mockLocalAssistantService.startLocalMcpPlugin,
    installLocalMcpPlugin: mockLocalAssistantService.installLocalMcpPlugin,
    uninstallLocalMcpPlugin: mockLocalAssistantService.uninstallLocalMcpPlugin,
    loadOpenClawCapabilityOverview: mockLocalAssistantService.loadOpenClawCapabilityOverview,
    writeNpcConfig: mockLocalAssistantService.writeNpcConfig
  };
});

describe("Workbench", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    mockLocalAssistantService.scanLocalSkills.mockReset();
    mockLocalAssistantService.scanLocalSkills.mockResolvedValue({
      summary: "OpenCow 已安装技能列表为空。",
      total_count: 0,
      scanned_root_count: 1,
      items: []
    });
    mockLocalAssistantService.loadRecommendedSkillManifest.mockReset();
    mockLocalAssistantService.loadRecommendedSkillManifest.mockResolvedValue({
      summary: "OpenCow 推荐技能清单已加载，共 2 项。",
      total_count: 2,
      items: [
        {
          name: "coding-agent",
          description: "代码代理",
          source: "opencow-builtin-manifest",
          install_query: "coding-agent",
          rationale: "OpenCow 本地助手最常见的是代码落地与修复，这项覆盖率最高。"
        },
        {
          name: "browser-automation",
          description: "浏览器自动化",
          source: "opencow-builtin-manifest",
          install_query: "browser-automation",
          rationale: "桌面端和本地 Web 联调频繁，浏览器自动化非常适合作为默认精选能力。"
        }
      ]
    });
    mockLocalAssistantService.listEnabledLocalSkills.mockReset();
    mockLocalAssistantService.listEnabledLocalSkills.mockResolvedValue({
      summary: "已启用 1 个 Skill",
      total_count: 1,
      registry_path: ".opencow/skills/enabled-skills.json",
      items: [
        {
          name: "coding-agent",
          path: "skills/installed/coding-agent/SKILL.md",
          source: "opencow-installed-skill",
          description: "代码代理"
        }
      ]
    });
    mockLocalAssistantService.matchEnabledLocalSkills.mockReset();
    mockLocalAssistantService.matchEnabledLocalSkills.mockResolvedValue({
      query: "帮我修代码",
      summary: "匹配到 1 个推荐 Skill",
      registry_path: ".opencow/skills/enabled-skills.json",
      enabled_skill_count: 1,
      match_count: 1,
      items: [
        {
          name: "coding-agent",
          path: "skills/installed/coding-agent/SKILL.md",
          source: "opencow-installed-skill",
          description: "代码代理",
          content_preview: "适合当前编码任务"
        }
      ]
    });
    mockLocalAssistantService.enableLocalSkill.mockReset();
    mockLocalAssistantService.installLocalSkill.mockReset();
    mockLocalAssistantService.disableLocalSkill.mockReset();
    mockLocalAssistantService.loadRecommendedMcpManifest.mockReset();
    mockLocalAssistantService.loadRecommendedMcpManifest.mockResolvedValue({
      summary: "OpenCow 推荐 MCP 清单已加载，共 1 项。",
      total_count: 1,
      items: [
        {
          id: "browser",
          name: "浏览器控制",
          description: "浏览器插件",
          source: "opencow-builtin-manifest",
          install_query: "browser",
          rationale: "默认推荐",
          supported: true
        }
      ]
    });
    mockLocalAssistantService.scanLocalMcpPlugins.mockReset();
    mockLocalAssistantService.scanLocalMcpPlugins.mockResolvedValue({
      summary: "扫描到 1 个 MCP 插件",
      total_count: 1,
      scanned_root_count: 1,
      items: [
        {
          id: "browser",
          name: "浏览器控制",
          path: "plugins/browser/openclaw.plugin.json",
          source: "workspace-plugin",
          description: "浏览器插件",
          activation: "startup",
          tool_count: 1,
          skill_count: 1,
          status: "stopped",
          supported: true
        }
      ]
    });
    mockLocalAssistantService.inspectLocalMcpPlugin.mockReset();
    mockLocalAssistantService.inspectLocalMcpPlugin.mockResolvedValue({
      query: "browser",
      summary: "找到 1 个 MCP 插件详情",
      match_count: 1,
      scanned_root_count: 1,
      items: [
        {
          id: "browser",
          path: "plugins/browser/openclaw.plugin.json",
          source: "workspace-plugin",
          activation: "startup",
          tool_count: 1,
          skill_count: 1,
          description: "浏览器插件",
          tool_names: ["browser"],
          skill_paths: ["./skills"]
        }
      ]
    });
    mockLocalAssistantService.previewLocalMcpPluginStart.mockReset();
    mockLocalAssistantService.previewLocalMcpPluginStart.mockResolvedValue({
      query: "browser",
      summary: "找到 1 个启动预览",
      match_count: 1,
      scanned_root_count: 1,
      items: [
        {
          id: "browser",
          path: "plugins/browser/openclaw.plugin.json",
          source: "workspace-plugin",
          activation: "startup",
          startup_allowed: false,
          command_preview: "node vendor/openclaw/openclaw.mjs browser start",
          working_directory: "plugins/browser",
          risk_summary: "仅预览，不启动进程",
          requires_config: false,
          config_hint: "无额外配置"
        }
      ]
    });
    mockLocalAssistantService.startLocalMcpPlugin.mockReset();
    mockLocalAssistantService.loadOpenClawCapabilityOverview.mockReset();
    mockLocalAssistantService.writeNpcConfig.mockReset();
  });

  it("anchors the left and right sidebars to the glass gradient visual layer", () => {
    render(<Workbench {...createWorkbenchProps()} />);

    expect(screen.getByLabelText("主导航")).toHaveClass("glass-gradient-sidebar-left");
    expect(screen.getByLabelText("右侧面板")).toHaveClass("glass-gradient-sidebar-right");
  });

  it("switches the main workspace content when a sidebar item is selected", async () => {
    const onRestoreRecentConversation = vi.fn();
    const state = {
      ...createInitialWorkbenchState(),
      conversation: {
        entries: [
          {
            id: "current-session-entry",
            kind: "user" as const,
            title: "用户",
            summary: "当前正在查看的会话"
          }
        ]
      },
      history: {
        lastNonEmptyConversationEntries: [],
        draftConversations: [
          {
            id: "recent-conversation-entry",
            title: "网页端历史修复上下文",
            summary: "这里应该显示最近会话摘要。",
            entries: [
              {
                id: "recent-conversation-message",
                kind: "user" as const,
                title: "用户",
                summary: "网页端历史修复上下文"
              }
            ]
          }
        ],
        archivedConversations: []
      }
    };

    render(<Workbench {...createWorkbenchProps(state, { onRestoreRecentConversation })} />);

    expect(screen.getByLabelText("会话")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本地助手" })).not.toBeInTheDocument();

    await click(screen.getByRole("button", { name: "知识库" }));

    expect(screen.getByRole("heading", { name: "知识库" })).toBeInTheDocument();
    expect(screen.getByText("把文件先纳入共享文件库，再拖入当前知识库。NPC 在自己的配置页里选择要加载哪个知识库。")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本地助手" })).not.toBeInTheDocument();

    await click(screen.getByRole("button", { name: "会话" }));
    await click(screen.getByRole("button", { name: "打开会话：网页端历史修复上下文" }));
    expect(onRestoreRecentConversation).toHaveBeenCalledWith("recent-conversation-entry");

    await click(screen.getByRole("button", { name: "会话" }));

    expect(screen.getByLabelText("会话")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本地助手" })).not.toBeInTheDocument();
  });

  it("shows imported and importable knowledge files as a compact library and file list", async () => {
    const onImportKnowledgeFile = vi.fn();
    const onRemoveKnowledgeFile = vi.fn();
    const state = {
      ...createInitialWorkbenchState(),
      storage: {
        ...createInitialWorkbenchState().storage,
        knowledgeCount: 2
      },
      knowledge: {
        importedFiles: [
          {
            path: "docs/v1.0/06-rag-skills-npc-mcp.md",
            title: "06-rag-skills-npc-mcp.md",
            status: "ready" as const
          },
          {
            path: "notes/local-rag-rules.txt",
            title: "local-rag-rules.txt",
            status: "missing" as const
          }
        ],
        availableFiles: [
          {
            path: "notes/faq.txt",
            title: "faq.txt"
          }
        ]
      }
    };

    render(<Workbench {...createWorkbenchProps(state, { onImportKnowledgeFile, onRemoveKnowledgeFile })} />);

    await click(screen.getByRole("button", { name: "知识库" }));

    const knowledgePanel = screen.getByLabelText("知识库");

    expect(within(knowledgePanel).getByText("已索引文件 2")).toBeInTheDocument();
    expect(within(knowledgePanel).getByText(/文件先上传到文件库，再拖进某个知识库/)).toBeInTheDocument();
    expect(within(knowledgePanel).getByText("06-rag-skills-npc-mcp.md")).toBeInTheDocument();
    expect(within(knowledgePanel).getByText("docs/v1.0/06-rag-skills-npc-mcp.md")).toBeInTheDocument();
    expect(within(knowledgePanel).getByText("local-rag-rules.txt")).toBeInTheDocument();
    expect(within(knowledgePanel).getByText("文件已失效，检索时会自动跳过。")).toBeInTheDocument();
    expect(within(knowledgePanel).getByText("faq.txt")).toBeInTheDocument();

    await click(within(knowledgePanel).getByRole("button", { name: "移出知识库：06-rag-skills-npc-mcp.md" }));

    expect(onRemoveKnowledgeFile).toHaveBeenCalledWith("docs/v1.0/06-rag-skills-npc-mcp.md");
    expect(onImportKnowledgeFile).not.toHaveBeenCalled();
  });

  it("renders a real Skills page with enabled list, scanned list, and match results", async () => {
    render(<Workbench {...createWorkbenchProps()} />);

    await click(screen.getByRole("button", { name: "Skills" }));

    const skillsPanel = screen.getByLabelText("Skills");
    expect(await within(skillsPanel).findByText("技能中心")).toBeInTheDocument();
    expect(within(skillsPanel).getByRole("heading", { name: "OpenCow 技能" })).toBeInTheDocument();
    expect(await within(skillsPanel).findByText("你还没有 skills，去 Skills 页面安装。")).toBeInTheDocument();

    await click(within(skillsPanel).getByRole("button", { name: "推荐安装" }));
    expect(await within(skillsPanel).findByRole("heading", { name: "OpenCow 精选推荐" })).toBeInTheDocument();
    expect(within(skillsPanel).getByText("browser-automation")).toBeInTheDocument();
    expect(within(skillsPanel).getByRole("button", { name: "安装 browser-automation" })).toBeInTheDocument();

    await change(within(skillsPanel).getByRole("textbox", { name: "Skill 匹配查询" }), "帮我修代码");
    await click(within(skillsPanel).getByRole("button", { name: "匹配已启用 Skills" }));

    expect(await within(skillsPanel).findByText("适合当前编码任务")).toBeInTheDocument();
  });

  it("runs skill enable install and disable actions from the Skills page", async () => {
    render(<Workbench {...createWorkbenchProps()} />);

    await click(screen.getByRole("button", { name: "Skills" }));

    const skillsPanel = screen.getByLabelText("Skills");
    await change(within(skillsPanel).getByRole("textbox", { name: "Skill 操作查询" }), "coding-agent");

    await click(within(skillsPanel).getByRole("button", { name: "启用" }));
    await click(within(skillsPanel).getByRole("button", { name: "安装" }));
    await click(within(skillsPanel).getByRole("button", { name: "删除" }));

    expect(mockLocalAssistantService.enableLocalSkill).toHaveBeenCalledWith("coding-agent");
    expect(mockLocalAssistantService.installLocalSkill).toHaveBeenCalledWith("coding-agent");
    expect(mockLocalAssistantService.disableLocalSkill).toHaveBeenCalledWith("coding-agent");
  });

  it("renders a real MCP page with installed and recommended product lists", async () => {
    render(<Workbench {...createWorkbenchProps()} />);

    await click(screen.getByRole("button", { name: "MCP" }));

    const mcpPanel = screen.getByLabelText("MCP");
    await click(within(mcpPanel).getByRole("button", { name: /刷新/ }));
    expect(await within(mcpPanel).findByText("已安装 1 个 MCP")).toBeInTheDocument();
    expect(within(mcpPanel).getByText("浏览器控制")).toBeInTheDocument();

    await click(within(mcpPanel).getByRole("button", { name: "查看" }));
    expect(await within(mcpPanel).findByText(/node vendor\/openclaw\/openclaw\.mjs browser start/)).toBeInTheDocument();

    await click(within(mcpPanel).getByRole("button", { name: "推荐安装" }));
    expect(await within(mcpPanel).findByText("推荐 1 个 MCP")).toBeInTheDocument();
  });

  it("runs MCP start from the MCP page", async () => {
    render(<Workbench {...createWorkbenchProps()} />);

    await click(screen.getByRole("button", { name: "MCP" }));

    const mcpPanel = screen.getByLabelText("MCP");
    await click(within(mcpPanel).getByRole("button", { name: /刷新/ }));
    expect(await within(mcpPanel).findByText("已安装 1 个 MCP")).toBeInTheDocument();
    await click(within(mcpPanel).getByRole("button", { name: "启动" }));

    expect(mockLocalAssistantService.startLocalMcpPlugin).toHaveBeenCalledWith("browser");
  });

  it("renders the single NPC workspace with compact cards and lightweight navigation", async () => {
    const state = {
      ...createInitialWorkbenchState(),
      npcWorkspace: {
        ...createInitialWorkbenchState().npcWorkspace,
        selectedNpcId: "research-bot",
        items: [
          {
            id: "research-bot",
            name: "研究助手",
            description: "负责资料整理",
            defaultModel: "qwen3.5:9b",
            personaPrompt: "你负责整理资料",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: ["coding-agent"],
            knowledgeLibraryIds: ["rules-library"],
            updatedAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      },
      settings: {
        ...createInitialWorkbenchState().settings,
        npc: {
          localModel: "qwen3.5:9b"
        }
      }
    };

    render(<Workbench
      {...createWorkbenchProps(state, {
        knowledgeLibraryLabel: "规则库",
        knowledgeLibraries: [
          { id: "default-library", label: "默认知识库", active: false, documentCount: 0 },
          { id: "rules-library", label: "规则库", active: true, documentCount: 2 }
        ] as Array<any>
      })}
    />);

    await click(screen.getByRole("button", { name: "NPC" }));

    const npcPanel = screen.getByLabelText("NPC");
    expect(await within(npcPanel).findByRole("button", { name: "研究助手" })).toBeInTheDocument();
    expect(within(npcPanel).getByDisplayValue("负责资料整理")).toBeInTheDocument();
    const navigation = within(npcPanel).getByLabelText("NPC 配置导航");
    expect(within(navigation).getByRole("button", { name: "概览" })).toBeInTheDocument();
    expect(within(navigation).getByRole("button", { name: "人设" })).toBeInTheDocument();
    expect(within(navigation).getByRole("button", { name: "技能" })).toBeInTheDocument();
    expect(within(navigation).getByRole("button", { name: "知识库" })).toBeInTheDocument();
    expect(within(npcPanel).getByDisplayValue("研究助手")).toBeInTheDocument();
    expect(within(npcPanel).getByDisplayValue("负责资料整理")).toBeInTheDocument();
    expect(within(npcPanel).getByText("最近更新 2026-06-19 10:00")).toBeInTheDocument();
  });

  it("debounces overview edits before routing them through the NPC workspace update callback", async () => {
    vi.useFakeTimers();
    try {
      const onUpdateNpcWorkspaceOverview = vi.fn();
      const state = {
        ...createInitialWorkbenchState(),
        npcWorkspace: {
          ...createInitialWorkbenchState().npcWorkspace,
          selectedNpcId: "research-bot",
          activeSection: "overview" as const,
          items: [
            {
              id: "research-bot",
              name: "研究助手",
              description: "负责资料整理",
              defaultModel: "qwen3.5:9b",
              personaPrompt: "你负责整理资料",
              outputStyle: "简洁",
              agentDraft: "",
              rulesDraft: "",
              enabledSkillNames: [],
              knowledgeLibraryIds: [],
              updatedAt: "2026-06-19T10:00:00.000Z"
            }
          ]
        }
      };

      render(<Workbench {...createWorkbenchProps(state, { onUpdateNpcWorkspaceOverview })} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "NPC" }));
      });

      const npcPanel = screen.getByLabelText("NPC");
      await act(async () => {
        fireEvent.change(within(npcPanel).getByRole("textbox", { name: "NPC 名称" }), {
          target: { value: "审计助手" }
        });
      });

      expect(onUpdateNpcWorkspaceOverview).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(350);
        await Promise.resolve();
      });

      expect(onUpdateNpcWorkspaceOverview).toHaveBeenCalledWith("research-bot", expect.objectContaining({
        name: "审计助手"
      }));
    } finally {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
  });

  it("renders a dedicated persona title field and debounces persona edits through the NPC update callback", async () => {
    vi.useFakeTimers();
    try {
      const onUpdateNpcWorkspacePersona = vi.fn();
      const state = {
        ...createInitialWorkbenchState(),
        npcWorkspace: {
          ...createInitialWorkbenchState().npcWorkspace,
          selectedNpcId: "research-bot",
          activeSection: "persona" as const,
          items: [
            {
              id: "research-bot",
              name: "研究助手",
              description: "负责资料整理",
              defaultModel: "qwen3.5:9b",
              personaTitle: "资料研究员",
              personaPrompt: "你负责整理资料",
              outputStyle: "简洁",
              agentDraft: "",
              rulesDraft: "",
              enabledSkillNames: [],
              knowledgeLibraryIds: [],
              updatedAt: "2026-06-19T10:00:00.000Z"
            }
          ]
        }
      };

      render(<Workbench {...createWorkbenchProps(state, { onUpdateNpcWorkspacePersona })} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "NPC" }));
      });
      const npcPanel = screen.getByLabelText("NPC");
      await act(async () => {
        fireEvent.click(within(npcPanel).getByRole("button", { name: "人设" }));
      });

      expect(within(npcPanel).getByRole("textbox", { name: "人设标题" })).toHaveValue("资料研究员");

      await act(async () => {
        fireEvent.change(within(npcPanel).getByRole("textbox", { name: "人设标题" }), {
          target: { value: "事实核验官" }
        });
      });

      expect(onUpdateNpcWorkspacePersona).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(350);
        await Promise.resolve();
      });

      expect(onUpdateNpcWorkspacePersona).toHaveBeenCalledWith("research-bot", expect.objectContaining({
        personaTitle: "事实核验官",
        personaPrompt: "你负责整理资料"
      }));
    } finally {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
  });

  it("renders compact skill metadata rows in the NPC workspace", async () => {
    mockLocalAssistantService.scanLocalSkills.mockResolvedValueOnce({
      summary: "loaded",
      total_count: 1,
      scanned_root_count: 1,
      items: [
        {
          name: "本地检索增强",
          path: "skills/rag/SKILL.md",
          source: "workspace",
          description: "读取本地文档",
          enabled: true
        }
      ]
    });
    const state = {
      ...createInitialWorkbenchState(),
      npcWorkspace: {
        ...createInitialWorkbenchState().npcWorkspace,
        selectedNpcId: "research-bot",
        activeSection: "skills" as const,
        items: [
          {
            id: "research-bot",
            name: "研究助手",
            description: "负责资料整理",
            defaultModel: "qwen3.5:9b",
            personaPrompt: "你负责整理资料",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: ["本地检索增强"],
            knowledgeLibraryIds: ["rules-library"],
            updatedAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      }
    };

    render(<Workbench
      {...createWorkbenchProps(state, {
        knowledgeLibraryLabel: "规则库",
        knowledgeLibraries: [
          {
            id: "rules-library",
            label: "规则库",
            description: "整理产品需求、PRD 和交互说明。",
            active: true,
            documentCount: 2
          }
        ] as Array<any>
      })}
    />);

    await click(screen.getByRole("button", { name: "NPC" }));

    const npcPanel = screen.getByLabelText("NPC");
    expect(await within(npcPanel).findByText("读取本地文档")).toBeInTheDocument();
    expect(within(npcPanel).getByText("已选择")).toBeInTheDocument();
  });

  it("renders the selected NPC skill detail from the shared workspace state", async () => {
    mockLocalAssistantService.scanLocalSkills.mockResolvedValueOnce({
      summary: "loaded",
      total_count: 1,
      scanned_root_count: 1,
      items: [
        {
          name: "本地检索增强",
          path: "skills/rag/SKILL.md",
          source: "workspace",
          description: "读取本地文档",
          enabled: true
        }
      ]
    });
    const state = {
      ...createInitialWorkbenchState(),
      npcWorkspace: {
        ...createInitialWorkbenchState().npcWorkspace,
        selectedNpcId: "research-bot",
        activeSection: "skills" as const,
        selectedSkillName: "本地检索增强",
        selectedSkillPreview: {
          name: "本地检索增强",
          description: "读取本地文档",
          contentPreview: "用于本地知识检索。",
          path: "skills/rag/SKILL.md",
          source: "workspace"
        },
        items: [
          {
            id: "research-bot",
            name: "研究助手",
            description: "负责资料整理",
            defaultModel: "qwen3.5:9b",
            personaPrompt: "你负责整理资料",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: ["本地检索增强"],
            knowledgeLibraryIds: [],
            updatedAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      }
    };

    render(<Workbench {...createWorkbenchProps(state)} />);

    await click(screen.getByRole("button", { name: "NPC" }));

    const npcPanel = screen.getByLabelText("NPC");
    expect(await within(npcPanel).findByText("用于本地知识检索。")).toBeInTheDocument();
    expect(within(npcPanel).getByText("共享技能 · 当前 NPC 已绑定")).toBeInTheDocument();
    expect(within(npcPanel).getByRole("button", { name: "移除绑定" })).toBeInTheDocument();
  });

  it("shows uninstalled state in NPC skill detail and keeps binding as the only action", async () => {
    mockLocalAssistantService.scanLocalSkills.mockResolvedValueOnce({
      summary: "loaded",
      total_count: 1,
      scanned_root_count: 1,
      items: [
        {
          name: "本地检索增强",
          path: "skills/rag/SKILL.md",
          source: "workspace",
          description: "读取本地文档",
          enabled: false
        }
      ]
    });
    const state = {
      ...createInitialWorkbenchState(),
      npcWorkspace: {
        ...createInitialWorkbenchState().npcWorkspace,
        selectedNpcId: "research-bot",
        activeSection: "skills" as const,
        selectedSkillName: "本地检索增强",
        selectedSkillPreview: {
          name: "本地检索增强",
          description: "读取本地文档",
          contentPreview: "用于本地知识检索。",
          path: "skills/rag/SKILL.md",
          source: "workspace"
        },
        items: [
          {
            id: "research-bot",
            name: "研究助手",
            description: "负责资料整理",
            defaultModel: "qwen3.5:9b",
            personaTitle: "资料研究员",
            personaPrompt: "你负责整理资料",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: [],
            knowledgeLibraryIds: [],
            updatedAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      }
    };

    render(<Workbench {...createWorkbenchProps(state)} />);

    await click(screen.getByRole("button", { name: "NPC" }));

    const npcPanel = screen.getByLabelText("NPC");
    expect((await within(npcPanel).findAllByText("OpenCow 未安装")).length).toBeGreaterThan(0);
    expect(within(npcPanel).getByText("共享技能 · 当前 NPC 未绑定")).toBeInTheDocument();
    expect(within(npcPanel).getByRole("button", { name: "绑定技能" })).toBeInTheDocument();
  });

  it("shows installed state in NPC skill rows without exposing global skill management actions", async () => {
    mockLocalAssistantService.scanLocalSkills.mockResolvedValueOnce({
      summary: "loaded",
      total_count: 1,
      scanned_root_count: 1,
      items: [
        {
          name: "本地检索增强",
          path: "skills/installed/rag/SKILL.md",
          source: "user",
          description: "读取本地文档",
          enabled: true
        }
      ]
    });
    const state = {
      ...createInitialWorkbenchState(),
      npcWorkspace: {
        ...createInitialWorkbenchState().npcWorkspace,
        selectedNpcId: "research-bot",
        activeSection: "skills" as const,
        selectedSkillName: "本地检索增强",
        selectedSkillPreview: {
          name: "本地检索增强",
          description: "读取本地文档",
          contentPreview: "用于本地知识检索。",
          path: "skills/rag/SKILL.md",
          source: "workspace"
        },
        items: [
          {
            id: "research-bot",
            name: "研究助手",
            description: "负责资料整理",
            defaultModel: "qwen3.5:9b",
            personaTitle: "资料研究员",
            personaPrompt: "你负责整理资料",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: [],
            knowledgeLibraryIds: [],
            updatedAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      }
    };

    render(<Workbench {...createWorkbenchProps(state)} />);

    await click(screen.getByRole("button", { name: "NPC" }));

    const npcPanel = screen.getByLabelText("NPC");
    expect((await within(npcPanel).findAllByText("OpenCow 已安装")).length).toBeGreaterThan(0);
    expect(within(npcPanel).queryByRole("button", { name: "在工作区禁用" })).not.toBeInTheDocument();
    expect(within(npcPanel).queryByRole("button", { name: "在工作区启用" })).not.toBeInTheDocument();
  });

  it("hides stale NPC skill detail when the selected skill is no longer in the scanned skill list", async () => {
    mockLocalAssistantService.scanLocalSkills.mockResolvedValueOnce({
      summary: "loaded",
      total_count: 1,
      scanned_root_count: 1,
      items: [
        {
          name: "新技能",
          path: "skills/new/SKILL.md",
          source: "workspace",
          description: "新的技能说明",
          enabled: true
        }
      ]
    });
    const state = {
      ...createInitialWorkbenchState(),
      npcWorkspace: {
        ...createInitialWorkbenchState().npcWorkspace,
        selectedNpcId: "research-bot",
        activeSection: "skills" as const,
        selectedSkillName: "本地检索增强",
        selectedSkillPreview: {
          name: "本地检索增强",
          description: "读取本地文档",
          contentPreview: "用于本地知识检索。",
          path: "skills/rag/SKILL.md",
          source: "workspace"
        },
        items: [
          {
            id: "research-bot",
            name: "研究助手",
            description: "负责资料整理",
            defaultModel: "qwen3.5:9b",
            personaPrompt: "你负责整理资料",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: [],
            knowledgeLibraryIds: [],
            updatedAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      }
    };

    render(<Workbench {...createWorkbenchProps(state)} />);

    await click(screen.getByRole("button", { name: "NPC" }));

    const npcPanel = screen.getByLabelText("NPC");
    expect(await within(npcPanel).findByRole("button", { name: /新技能/ })).toBeInTheDocument();
    expect(within(npcPanel).queryByText("用于本地知识检索。")).not.toBeInTheDocument();
    expect(within(npcPanel).queryByRole("button", { name: "绑定技能" })).not.toBeInTheDocument();
  });

  it("renders compact knowledge metadata rows in the NPC workspace", async () => {
    const state = {
      ...createInitialWorkbenchState(),
      npcWorkspace: {
        ...createInitialWorkbenchState().npcWorkspace,
        selectedNpcId: "research-bot",
        activeSection: "knowledge" as const,
        items: [
          {
            id: "research-bot",
            name: "研究助手",
            description: "负责资料整理",
            defaultModel: "qwen3.5:9b",
            personaPrompt: "你负责整理资料",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: ["本地检索增强"],
            knowledgeLibraryIds: ["rules-library"],
            updatedAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      }
    };

    render(<Workbench
      {...createWorkbenchProps(state, {
        knowledgeLibraryLabel: "规则库",
        knowledgeLibraries: [
          {
            id: "rules-library",
            label: "规则库",
            description: "整理产品需求、PRD 和交互说明。",
            active: true,
            documentCount: 2
          }
        ] as Array<any>
      })}
    />);

    await click(screen.getByRole("button", { name: "NPC" }));

    const npcPanel = screen.getByLabelText("NPC");
    expect(within(npcPanel).getByText("整理产品需求、PRD 和交互说明。")).toBeInTheDocument();
    expect(within(npcPanel).getByText("2 篇文件")).toBeInTheDocument();
  });

  it("renders the selected NPC knowledge detail from the shared workspace state", async () => {
    const state = {
      ...createInitialWorkbenchState(),
      npcWorkspace: {
        ...createInitialWorkbenchState().npcWorkspace,
        selectedNpcId: "research-bot",
        activeSection: "knowledge" as const,
        selectedKnowledgeLibraryId: "rules-library",
        items: [
          {
            id: "research-bot",
            name: "研究助手",
            description: "负责资料整理",
            defaultModel: "qwen3.5:9b",
            personaPrompt: "你负责整理资料",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: [],
            knowledgeLibraryIds: ["rules-library"],
            updatedAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      }
    };

    render(<Workbench
      {...createWorkbenchProps(state, {
        knowledgeLibraries: [
          {
            id: "rules-library",
            label: "规则库",
            description: "整理产品需求、PRD 和交互说明。",
            active: true,
            documentCount: 2
          }
        ] as Array<any>
      })}
    />);

    await click(screen.getByRole("button", { name: "NPC" }));

    const npcPanel = screen.getByLabelText("NPC");
    expect(within(npcPanel).getByText("共享知识库 · 当前 NPC 已绑定")).toBeInTheDocument();
    expect(within(npcPanel).getByText("当前共 2 篇文件")).toBeInTheDocument();
    expect(within(npcPanel).getByRole("button", { name: "取消绑定" })).toBeInTheDocument();
  });

  it("shows unbound knowledge detail as a shared library before the NPC binds it", async () => {
    const state = {
      ...createInitialWorkbenchState(),
      npcWorkspace: {
        ...createInitialWorkbenchState().npcWorkspace,
        selectedNpcId: "research-bot",
        activeSection: "knowledge" as const,
        selectedKnowledgeLibraryId: "rules-library",
        items: [
          {
            id: "research-bot",
            name: "研究助手",
            description: "负责资料整理",
            defaultModel: "qwen3.5:9b",
            personaPrompt: "你负责整理资料",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: [],
            knowledgeLibraryIds: [],
            updatedAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      }
    };

    render(<Workbench
      {...createWorkbenchProps(state, {
        knowledgeLibraries: [
          {
            id: "rules-library",
            label: "规则库",
            description: "整理产品需求、PRD 和交互说明。",
            active: true,
            documentCount: 2
          }
        ] as Array<any>
      })}
    />);

    await click(screen.getByRole("button", { name: "NPC" }));

    const npcPanel = screen.getByLabelText("NPC");
    expect(within(npcPanel).getByText("共享知识库 · 当前 NPC 未绑定")).toBeInTheDocument();
    expect(within(npcPanel).getByRole("button", { name: "绑定知识库" })).toBeInTheDocument();
  });

  it("shows shared skill detail without exposing install actions inside the NPC workspace", async () => {
    mockLocalAssistantService.scanLocalSkills.mockResolvedValueOnce({
      summary: "loaded",
      total_count: 0,
      scanned_root_count: 1,
      items: []
    });
    const state = {
      ...createInitialWorkbenchState(),
      npcWorkspace: {
        ...createInitialWorkbenchState().npcWorkspace,
        selectedNpcId: "research-bot",
        activeSection: "skills" as const,
        selectedSkillName: "docs-helper",
        selectedSkillPreview: {
          name: "docs-helper",
          description: "文档助手",
          contentPreview: "适合读取和整理说明文档",
          path: "skills/docs-helper/SKILL.md",
          source: "workspace-skill"
        },
        items: [
          {
            id: "research-bot",
            name: "研究助手",
            description: "负责资料整理",
            defaultModel: "qwen3.5:9b",
            personaPrompt: "你负责整理资料",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: [],
            knowledgeLibraryIds: [],
            updatedAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      }
    };

    render(<Workbench {...createWorkbenchProps(state)} />);

    await click(screen.getByRole("button", { name: "NPC" }));

    const npcPanel = screen.getByLabelText("NPC");
    expect(await within(npcPanel).findByText("你还没有 skills，去 Skills 页面安装。")).toBeInTheDocument();
    expect(within(npcPanel).queryByText("共享技能 · 当前 NPC 未绑定")).not.toBeInTheDocument();
    expect(within(npcPanel).queryByRole("button", { name: "绑定技能" })).not.toBeInTheDocument();
  });

  it("shows a compact empty state when no local skills are available for the selected NPC", async () => {
    mockLocalAssistantService.scanLocalSkills.mockResolvedValueOnce({
      summary: "loaded",
      total_count: 0,
      scanned_root_count: 1,
      items: []
    });
    const state = {
      ...createInitialWorkbenchState(),
      npcWorkspace: {
        ...createInitialWorkbenchState().npcWorkspace,
        selectedNpcId: "research-bot",
        activeSection: "skills" as const,
        items: [
          {
            id: "research-bot",
            name: "研究助手",
            description: "负责资料整理",
            defaultModel: "qwen3.5:9b",
            personaTitle: "资料研究员",
            personaPrompt: "你负责整理资料",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: [],
            knowledgeLibraryIds: [],
            updatedAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      }
    };

    render(<Workbench {...createWorkbenchProps(state)} />);

    fireEvent.click(screen.getByRole("button", { name: "NPC" }));

    const npcPanel = screen.getByLabelText("NPC");
    expect(await within(npcPanel).findByText("你还没有 skills，去 Skills 页面安装。")).toBeInTheDocument();
    expect(within(npcPanel).getByText("0 项")).toBeInTheDocument();
  });

  it("shows a compact empty state when no knowledge libraries are available for the selected NPC", async () => {
    const state = {
      ...createInitialWorkbenchState(),
      knowledge: {
        ...createInitialWorkbenchState().knowledge,
        libraries: []
      },
      npcWorkspace: {
        ...createInitialWorkbenchState().npcWorkspace,
        selectedNpcId: "research-bot",
        activeSection: "knowledge" as const,
        items: [
          {
            id: "research-bot",
            name: "研究助手",
            description: "负责资料整理",
            defaultModel: "qwen3.5:9b",
            personaTitle: "资料研究员",
            personaPrompt: "你负责整理资料",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: [],
            knowledgeLibraryIds: [],
            updatedAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      }
    };

    render(<Workbench {...createWorkbenchProps(state, { knowledgeLibraries: [] as Array<any> })} />);

    await click(screen.getByRole("button", { name: "NPC" }));

    const npcPanel = screen.getByLabelText("NPC");
    expect(within(npcPanel).getByText("还没有可绑定的知识库，先到知识库页面新建。")).toBeInTheDocument();
    expect(within(npcPanel).getByText("0 项")).toBeInTheDocument();
  });

  it("hides stale NPC knowledge detail when the selected library is no longer in the shared library list", async () => {
    const state = {
      ...createInitialWorkbenchState(),
      npcWorkspace: {
        ...createInitialWorkbenchState().npcWorkspace,
        selectedNpcId: "research-bot",
        activeSection: "knowledge" as const,
        selectedKnowledgeLibraryId: "rules-library",
        items: [
          {
            id: "research-bot",
            name: "研究助手",
            description: "负责资料整理",
            defaultModel: "qwen3.5:9b",
            personaPrompt: "你负责整理资料",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: [],
            knowledgeLibraryIds: [],
            updatedAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      }
    };

    render(<Workbench
      {...createWorkbenchProps(state, {
        knowledgeLibraries: [
          {
            id: "new-library",
            label: "新库",
            description: "新的知识库说明。",
            active: true,
            documentCount: 1
          }
        ] as Array<any>
      })}
    />);

    await click(screen.getByRole("button", { name: "NPC" }));

    const npcPanel = screen.getByLabelText("NPC");
    expect(within(npcPanel).getByText("新库")).toBeInTheDocument();
    expect(within(npcPanel).queryByText("当前共 2 篇文件")).not.toBeInTheDocument();
    expect(within(npcPanel).queryByRole("button", { name: "取消绑定" })).not.toBeInTheDocument();
  });

  it("renders a styled NPC save status message inside the configuration area", async () => {
    const state = {
      ...createInitialWorkbenchState(),
      npcWorkspace: {
        ...createInitialWorkbenchState().npcWorkspace,
        selectedNpcId: "research-bot",
        saveStatus: "NPC 配置已保存。",
        items: [
          {
            id: "research-bot",
            name: "研究助手",
            description: "负责资料整理",
            defaultModel: "qwen3.5:9b",
            personaPrompt: "你负责整理资料",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: [],
            knowledgeLibraryIds: [],
            updatedAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      }
    };

    render(<Workbench {...createWorkbenchProps(state)} />);

    await click(screen.getByRole("button", { name: "NPC" }));

    const status = screen.getByText("NPC 配置已保存。");
    expect(status).toHaveClass("npc-save-status", "npc-save-status-success");
  });

  it("keeps the NPC skill list in sync after the Skills workspace refreshes", async () => {
    mockLocalAssistantService.scanLocalSkills
      .mockResolvedValueOnce({
        summary: "loaded",
        total_count: 1,
        scanned_root_count: 1,
        items: [
          {
            name: "旧技能",
            path: "skills/legacy/SKILL.md",
            source: "workspace",
            description: "旧的技能说明",
            enabled: true
          }
        ]
      })
      .mockResolvedValueOnce({
        summary: "loaded",
        total_count: 1,
        scanned_root_count: 1,
        items: [
          {
            name: "新技能",
            path: "skills/new/SKILL.md",
            source: "workspace",
            description: "新的技能说明",
            enabled: true
          }
        ]
      })
      .mockResolvedValueOnce({
        summary: "loaded",
        total_count: 1,
        scanned_root_count: 1,
        items: [
          {
            name: "新技能",
            path: "skills/new/SKILL.md",
            source: "workspace",
            description: "新的技能说明",
            enabled: true
          }
        ]
      });

    const state = {
      ...createInitialWorkbenchState(),
      npcWorkspace: {
        ...createInitialWorkbenchState().npcWorkspace,
        selectedNpcId: "research-bot",
        activeSection: "skills" as const,
        items: [
          {
            id: "research-bot",
            name: "研究助手",
            description: "负责资料整理",
            defaultModel: "qwen3.5:9b",
            personaPrompt: "你负责整理资料",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: [],
            knowledgeLibraryIds: [],
            updatedAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      }
    };

    render(<Workbench {...createWorkbenchProps(state)} />);

    await click(screen.getByRole("button", { name: "NPC" }));
    expect(await screen.findByText("旧的技能说明")).toBeInTheDocument();

    await click(screen.getByRole("button", { name: "Skills" }));
    await click(await screen.findByRole("button", { name: "刷新技能" }));
    expect(await screen.findByText("新的技能说明")).toBeInTheDocument();

    await click(screen.getByRole("button", { name: "NPC" }));
    expect(await screen.findByText("新的技能说明")).toBeInTheDocument();
  }, 15_000);

  it("debounces persona edits before routing them through the NPC workspace update callback", async () => {
    vi.useFakeTimers();
    try {
      const onUpdateNpcWorkspacePersona = vi.fn();
      const state = {
        ...createInitialWorkbenchState(),
        npcWorkspace: {
          ...createInitialWorkbenchState().npcWorkspace,
          selectedNpcId: "research-bot",
          activeSection: "persona" as const,
          items: [
            {
              id: "research-bot",
              name: "研究助手",
              description: "负责资料整理",
              defaultModel: "qwen3.5:9b",
              personaPrompt: "",
              outputStyle: "简洁",
              agentDraft: "",
              rulesDraft: "",
              enabledSkillNames: [],
              knowledgeLibraryIds: [],
              updatedAt: "2026-06-19T10:00:00.000Z"
            }
          ]
        }
      };

      render(<Workbench {...createWorkbenchProps(state, { onUpdateNpcWorkspacePersona })} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "NPC" }));
      });

      const npcPanel = screen.getByLabelText("NPC");
      await act(async () => {
        fireEvent.change(within(npcPanel).getByRole("textbox", { name: "系统提示词" }), {
          target: { value: "你是一个代码审计 NPC" }
        });
      });

      expect(onUpdateNpcWorkspacePersona).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(350);
        await Promise.resolve();
      });

      expect(onUpdateNpcWorkspacePersona).toHaveBeenCalledWith("research-bot", expect.objectContaining({
        personaPrompt: "你是一个代码审计 NPC"
      }));
    } finally {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
  });

  it("routes both the NPC card body and the gear action into the same selection callback", async () => {
    const onSelectNpcWorkspace = vi.fn();
    const state = {
      ...createInitialWorkbenchState(),
      npcWorkspace: {
        ...createInitialWorkbenchState().npcWorkspace,
        items: [
          {
            id: "research-bot",
            name: "研究助手",
            description: "负责资料整理",
            defaultModel: "qwen3.5:9b",
            personaPrompt: "",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: [],
            knowledgeLibraryIds: [],
            updatedAt: "2026-06-19T10:00:00.000Z"
          }
        ]
      }
    };

    render(<Workbench {...createWorkbenchProps(state, { onSelectNpcWorkspace })} />);

    await click(screen.getByRole("button", { name: "NPC" }));
    await click(await screen.findByRole("button", { name: "研究助手" }));
    await click(screen.getByRole("button", { name: "配置 研究助手" }));

    expect(onSelectNpcWorkspace).toHaveBeenNthCalledWith(1, "research-bot");
    expect(onSelectNpcWorkspace).toHaveBeenNthCalledWith(2, "research-bot");
  });

  it("filters audit events from the audit page", async () => {
    const state = {
      ...createInitialWorkbenchState(),
      audit: {
        summary: "最近有 2 条审计事件",
        lastEvent: {
          timestamp: "2026-06-18T10:00:00.000Z",
          module: "skills",
          source: "desktop",
          detail: "启用 coding-agent"
        }
      }
    };

    render(<Workbench {...createWorkbenchProps(state)} />);

    await click(screen.getByRole("button", { name: "审计" }));

    const auditPanel = screen.getByLabelText("审计");
    await change(within(auditPanel).getByRole("textbox", { name: "审计筛选" }), "skills");

    expect(within(auditPanel).getByText("最近有 2 条审计事件")).toBeInTheDocument();
    expect(within(auditPanel).getByText("启用 coding-agent")).toBeInTheDocument();
  });

  it("supports named knowledge libraries in the desktop knowledge workspace", async () => {
    const onCreateKnowledgeLibrary = vi.fn();
    const onSelectKnowledgeLibrary = vi.fn();
    const state = {
      ...createInitialWorkbenchState(),
      knowledge: {
        importedFiles: [],
        availableFiles: [],
        activeLibraryId: "rules-library",
        activeLibraryLabel: "规则库",
        libraries: [
          {
            id: "default-library",
            label: "默认知识库"
          },
          {
            id: "rules-library",
            label: "规则库"
          }
        ]
      }
    };

    render(<Workbench
      {...createWorkbenchProps(state, {
        knowledgeLibraryLabel: "规则库",
        knowledgeLibraries: [
          {
            id: "default-library",
            label: "默认知识库",
            description: "通用知识入口",
            active: false
          },
          {
            id: "rules-library",
            label: "规则库",
            description: "整理产品需求、PRD 和交互说明。",
            active: true
          }
        ],
        onCreateKnowledgeLibrary,
        onSelectKnowledgeLibrary
      })}
    />);

    await click(screen.getByRole("button", { name: "知识库" }));

    const knowledgePanel = screen.getByLabelText("知识库");
    expect(within(knowledgePanel).getByLabelText("知识库列表")).toBeInTheDocument();
    expect(within(knowledgePanel).getByLabelText("当前知识库工作区")).toBeInTheDocument();
    expect(within(knowledgePanel).getByLabelText("文件库")).toBeInTheDocument();
    expect(within(knowledgePanel).getByRole("button", { name: "创建知识库" })).toBeInTheDocument();
    expect(within(knowledgePanel).getByRole("button", { name: "切换到知识库：默认知识库" })).toBeInTheDocument();
    expect(within(knowledgePanel).getByRole("button", { name: "当前知识库：规则库" })).toBeInTheDocument();
    expect(within(knowledgePanel).getByText("把文件拖到这里加入当前知识库")).toBeInTheDocument();
    expect(
      within(knowledgePanel).getByText(/可以从右侧文件库拖入，也可以直接拖入 Finder 文件。文件先上传到文件库，再拖进某个知识库。文件库对所有知识库互通。/)
    ).toBeInTheDocument();

    await click(within(knowledgePanel).getByRole("button", { name: "切换到知识库：默认知识库" }));
    expect(onSelectKnowledgeLibrary).toHaveBeenCalledWith("default-library");

    await click(within(knowledgePanel).getByRole("button", { name: "创建知识库" }));
    expect(within(knowledgePanel).getByRole("dialog", { name: "新建知识库" })).toBeInTheDocument();

    await change(within(knowledgePanel).getByRole("textbox", { name: "知识库名称" }), "产品文档库");
    await change(within(knowledgePanel).getByRole("textbox", { name: "知识库简介" }), "整理产品需求、PRD 和交互说明。");
    await click(within(knowledgePanel).getByRole("button", { name: "确认创建知识库" }));
    expect(onCreateKnowledgeLibrary).toHaveBeenCalledWith("产品文档库", "整理产品需求、PRD 和交互说明。");
  });

  it("uses a lightweight icon action for file-pool upload instead of a visible native file input block", async () => {
    render(<Workbench {...createWorkbenchProps()} />);

    await click(screen.getByRole("button", { name: "知识库" }));

    const knowledgePanel = screen.getByLabelText("知识库");
    const filePool = within(knowledgePanel).getByLabelText("文件库");

    expect(within(filePool).getByRole("button", { name: "上传文件到文件库" })).toBeInTheDocument();
    expect(within(filePool).queryByText("上传文件")).not.toBeInTheDocument();
    expect(within(filePool).queryByLabelText("导入本地 md/txt 文件")).toBeNull();
  });

  it("renders NPC local model information in settings and keeps embedding models out of the visible configuration", async () => {
    const state = {
      ...createInitialWorkbenchState(),
      model: {
        ...createInitialWorkbenchState().model,
        status: "Ollama 已连接",
        activeModel: "qwen2.5-coder:7b",
        availableModels: [
          { name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" },
          { name: "gemma4:12b", sizeLabel: "7.2 GB" }
        ]
      },
      settings: {
        ...createInitialWorkbenchState().settings,
        npc: {
          localModel: "qwen2.5-coder:7b"
        }
      }
    };

    render(<Workbench {...createWorkbenchProps(state)} />);

    await click(screen.getByRole("button", { name: "设置" }));

    const settingsPanel = screen.getByLabelText("设置");
    const npcSection = within(settingsPanel).getByText("NPC 本地模型").closest("section");

    expect(npcSection).not.toBeNull();
    expect(within(npcSection as HTMLElement).getByText("当前 NPC 模型: qwen2.5-coder:7b")).toBeInTheDocument();
    expect(within(npcSection as HTMLElement).getByText("不会使用 embedding 模型")).toBeInTheDocument();
    expect(within(npcSection as HTMLElement).queryByRole("button", { name: "qwen2.5-coder:7b" })).not.toBeInTheDocument();
    expect(within(npcSection as HTMLElement).queryByRole("button", { name: "gemma4:12b" })).not.toBeInTheDocument();
  });

  it("hides the conversation composer outside the conversation workspace", async () => {
    render(<Workbench {...createWorkbenchProps()} />);

    expect(screen.getByRole("textbox", { name: "输入任务" })).toBeInTheDocument();

    await click(screen.getByRole("button", { name: "Skills" }));

    expect(screen.getByRole("heading", { name: "技能" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "输入任务" })).not.toBeInTheDocument();

    await click(screen.getByRole("button", { name: "会话" }));

    expect(screen.getByRole("textbox", { name: "输入任务" })).toBeInTheDocument();
  });

  it("switches every left sidebar destination into the main workspace", async () => {
    const destinations = [
      ["搜索", "搜索"],
      ["知识库", "知识库"],
      ["Skills", "技能"],
      ["NPC", "NPC"],
      ["MCP", "MCP"],
      ["审计", "审计"],
      ["安全", "安全"],
      ["设置", "设置"]
    ];

    render(<Workbench {...createWorkbenchProps()} />);

    for (const [destination, heading] of destinations) {
      await click(screen.getByRole("button", { name: destination }));

      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: destination })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByLabelText("会话")).not.toBeInTheDocument();
    }

    await click(screen.getByRole("button", { name: "会话" }));

    expect(screen.getByLabelText("会话")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "会话" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the conversation cluster compact while showing three recent conversations by default", async () => {
    const state = {
      ...createInitialWorkbenchState(),
      history: {
        lastNonEmptyConversationEntries: [],
        draftConversations: Array.from({ length: 7 }, (_, index) => ({
          id: `recent-${index + 1}`,
          title: `最近会话 ${index + 1}`,
          summary: `摘要 ${index + 1}`,
          entries: [
            {
              id: `entry-${index + 1}`,
              kind: "user" as const,
              title: "用户",
              summary: `最近会话 ${index + 1}`
            }
          ]
        })),
        archivedConversations: []
      }
    };

    render(<Workbench {...createWorkbenchProps(state)} />);

    expect(screen.queryByRole("button", { name: "新对话" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "最近会话" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "搜索历史会话" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "创建新会话" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "归档当前会话" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /打开会话：最近会话 [1-7]/ }).length).toBe(3);

    await click(screen.getByRole("button", { name: "会话" }));

    expect(screen.getAllByRole("button", { name: /打开会话：最近会话 [1-7]/ }).length).toBe(3);

    await click(screen.getByRole("button", { name: "展开最近会话" }));

    expect(screen.getAllByRole("button", { name: /打开会话：最近会话 [1-7]/ }).length).toBe(6);
  });

  it("restores a recent conversation when its conversation card is clicked", async () => {
    const onRestoreRecentConversation = vi.fn();
    const state = {
      ...createInitialWorkbenchState(),
      history: {
        lastNonEmptyConversationEntries: [],
        draftConversations: [
          {
            id: "recent-restore",
            title: "恢复目标会话",
            summary: "点击卡片主体应恢复",
            entries: [
              {
                id: "restore-entry",
                kind: "user" as const,
                title: "用户",
                summary: "恢复目标会话"
              }
            ]
          }
        ],
        archivedConversations: []
      }
    };

    render(<Workbench {...createWorkbenchProps(state, { onRestoreRecentConversation })} />);

    await click(screen.getByRole("button", { name: "会话" }));
    await click(screen.getByRole("button", { name: "打开会话：恢复目标会话" }));

    expect(onRestoreRecentConversation).toHaveBeenCalledWith("recent-restore");
  });

  it("keeps recent conversations visible when the conversation row is toggled", async () => {
    const state = {
      ...createInitialWorkbenchState(),
      history: {
        lastNonEmptyConversationEntries: [],
        draftConversations: [
          {
            id: "recent-toggle",
            title: "可收起的历史会话",
            summary: "再次点击会话应收起",
            entries: []
          }
        ],
        archivedConversations: []
      }
    };

    render(<Workbench {...createWorkbenchProps(state)} />);

    expect(screen.getByRole("button", { name: "打开会话：可收起的历史会话" })).toBeInTheDocument();

    await click(screen.getByRole("button", { name: "会话" }));

    expect(screen.getByRole("button", { name: "打开会话：可收起的历史会话" })).toBeInTheDocument();

    await click(screen.getByRole("button", { name: "会话" }));

    expect(screen.getByRole("button", { name: "打开会话：可收起的历史会话" })).toBeInTheDocument();
  });

  it("shows the temporary blank conversation inside the draft conversation dropdown", async () => {
    const onNewConversation = vi.fn();
    const state = {
      ...createInitialWorkbenchState(),
      conversation: {
        ...createInitialWorkbenchState().conversation,
        restoredFromConversationId: "draft-conversation-1"
      },
      history: {
        lastNonEmptyConversationEntries: [],
        draftConversations: [
          {
            id: "draft-conversation-1",
            title: "新会话",
            summary: "等待第一条消息",
            entries: []
          },
          {
            id: "previous-history",
            title: "之前的旧会话",
            summary: "旧会话仍可恢复",
            entries: []
          }
        ],
        archivedConversations: []
      }
    };

    render(<Workbench {...createWorkbenchProps(state, { onNewConversation })} />);

    await click(screen.getByRole("button", { name: "创建新会话" }));
    await click(screen.getByRole("button", { name: "会话" }));

    expect(onNewConversation).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "打开会话：新会话" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开会话：之前的旧会话" })).toBeInTheDocument();
  });

  it("shows the conversation NPC bar and switches explicit NPC activation without affecting editor selection semantics", async () => {
    const onSelectConversationNpc = vi.fn();
    const state = {
      ...createInitialWorkbenchState(),
      conversation: {
        ...createInitialWorkbenchState().conversation,
        npcId: null
      },
      npcWorkspace: {
        ...createInitialWorkbenchState().npcWorkspace,
        selectedNpcId: "writer-bot",
        items: [
          {
            id: "research-bot",
            name: "研究助手",
            description: "负责资料整理",
            defaultModel: "qwen2.5-coder:7b",
            personaPrompt: "",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: [],
            knowledgeLibraryIds: []
          },
          {
            id: "writer-bot",
            name: "写作助手",
            description: "负责整理输出",
            defaultModel: "qwen2.5-coder:7b",
            personaPrompt: "",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: [],
            knowledgeLibraryIds: []
          }
        ]
      }
    };

    const { rerender } = render(<Workbench {...createWorkbenchProps(state, { onSelectConversationNpc })} />);

    expect(screen.getByText("未启用 NPC")).toBeInTheDocument();
    await click(screen.getByRole("button", { name: "会话 NPC" }));
    await click(screen.getByRole("menuitemradio", { name: "研究助手" }));

    expect(onSelectConversationNpc).toHaveBeenCalledWith("research-bot");

    rerender(<Workbench {...createWorkbenchProps({
      ...state,
      conversation: {
        ...state.conversation,
        npcId: "research-bot"
      }
    }, { onSelectConversationNpc })} />);

    expect(screen.getByText("当前 NPC：研究助手")).toBeInTheDocument();
    await click(screen.getByRole("button", { name: "会话 NPC" }));
    await click(screen.getByRole("menuitemradio", { name: "不使用 NPC" }));

    expect(onSelectConversationNpc).toHaveBeenCalledWith(null);
  });

  it("asks for confirmation in-app before permanently deleting a conversation from the cluster", async () => {
    const onDeleteRecentConversation = vi.fn();
    const state = {
      ...createInitialWorkbenchState(),
      history: {
        lastNonEmptyConversationEntries: [],
        draftConversations: [
          {
            id: "recent-delete",
            title: "删除目标会话",
            summary: "点击减号应删除",
            entries: []
          }
        ],
        archivedConversations: []
      }
    };

    render(<Workbench {...createWorkbenchProps(state, { onDeleteRecentConversation })} />);

    await click(screen.getByRole("button", { name: "会话" }));
    await click(screen.getByRole("button", { name: "删除会话：删除目标会话" }));

    expect(screen.getByRole("dialog", { name: "删除会话确认" })).toBeInTheDocument();
    await click(screen.getByRole("button", { name: "确认删除" }));
    expect(onDeleteRecentConversation).toHaveBeenCalledWith("recent-delete");
  });

  it("opens conversation search and creates a new conversation from the conversation cluster header", async () => {
    const onNewConversation = vi.fn();

    render(<Workbench {...createWorkbenchProps(createInitialWorkbenchState(), { onNewConversation })} />);

    expect(screen.queryByRole("textbox", { name: "搜索历史记录" })).not.toBeInTheDocument();

    await click(screen.getByRole("button", { name: "搜索历史会话" }));

    expect(screen.getByRole("textbox", { name: "搜索历史记录" })).toBeInTheDocument();

    await click(screen.getByRole("button", { name: "创建新会话" }));

    expect(onNewConversation).toHaveBeenCalledTimes(1);
  });

  it("filters across all saved recent conversations from the cluster search box", async () => {
    const state = {
      ...createInitialWorkbenchState(),
      history: {
        lastNonEmptyConversationEntries: [],
        draftConversations: Array.from({ length: 7 }, (_, index) => ({
          id: `recent-${index + 1}`,
          title: index === 6 ? "更早的目标会话" : `最近会话 ${index + 1}`,
          summary: index === 6 ? "需要通过搜索命中" : `摘要 ${index + 1}`,
          entries: []
        })),
        archivedConversations: [
          {
            id: "archived-hidden",
            title: "归档旧会话",
            summary: "不应出现在左侧搜索里",
            entries: []
          }
        ]
      }
    };

    render(<Workbench {...createWorkbenchProps(state)} />);

    await click(screen.getByRole("button", { name: "搜索历史会话" }));
    await change(screen.getByRole("textbox", { name: "搜索历史记录" }), "目标会话");

    expect(screen.getByRole("button", { name: "打开会话：更早的目标会话" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "打开会话：最近会话 1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "打开会话：归档旧会话" })).not.toBeInTheDocument();
  });

  it("keeps conversation card text compact instead of rendering the full long prompt", async () => {
    const longTitle = "你能回答以下问题并给出简要解析吗 1. 对以下两个源代码进行符号解析时 以下描述错误的是";
    const longSummary = "这是一段很长的最近会话摘要，侧边栏里应该只显示成一小行预览，而不是完整铺开。";
    const state = {
      ...createInitialWorkbenchState(),
      history: {
        lastNonEmptyConversationEntries: [],
        draftConversations: [
          {
            id: "recent-long",
            title: longTitle,
            summary: longSummary,
            entries: []
          }
        ],
        archivedConversations: []
      }
    };

    render(<Workbench {...createWorkbenchProps(state)} />);

    await click(screen.getByRole("button", { name: "会话" }));

    const cluster = screen.getByLabelText("会话分组");

    expect(within(cluster).queryByText(longTitle)).not.toBeInTheDocument();
    expect(within(cluster).queryByText(longSummary)).not.toBeInTheDocument();
    expect(within(cluster).getByText(/…$/)).toBeInTheDocument();
  });

  it("routes missing model setup actions into the matching settings section", async () => {
    const failed = createOllamaLoadErrorState(
      createInitialWorkbenchState(),
      "Ollama startup check failed: connection refused on 127.0.0.1:11434."
    );

    render(<Workbench {...createWorkbenchProps(failed)} />);

    await click(screen.getByRole("button", { name: "配置 Ollama" }));

    const settingsPanel = screen.getByLabelText("设置");
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("heading", { name: "Ollama 设置" })).toBeInTheDocument();
    expect(within(settingsPanel).getByText(/connection refused on 127\.0\.0\.1:11434/i)).toBeInTheDocument();

    await click(screen.getByRole("button", { name: "会话" }));
    await click(screen.getByRole("button", { name: "配置大模型 API" }));

    expect(screen.getByRole("heading", { name: "大模型 API 设置" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "远程 API Base URL" })).toBeInTheDocument();
  });

  it("keeps model, shell, network, rollback, and cleanup configuration in settings", async () => {
    render(<Workbench {...createWorkbenchProps()} />);

    await click(screen.getByRole("button", { name: "设置" }));

    const settingsPanel = screen.getByLabelText("设置");

    expect(within(settingsPanel).getByRole("heading", { name: "Ollama 设置" })).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("heading", { name: "大模型 API 设置" })).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("heading", { name: "恢复会话" })).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("heading", { name: "Shell 能力与恢复路径" })).toBeInTheDocument();
    expect(within(settingsPanel).getByText("只读 Shell · readonly")).toBeInTheDocument();
    expect(within(settingsPanel).getByText("写入 Shell · workspace-write")).toBeInTheDocument();
    expect(within(settingsPanel).getByText("高危 Shell · controlled-full")).toBeInTheDocument();
    expect(within(settingsPanel).getByText(/失败时优先检查工作区根目录发现/)).toBeInTheDocument();
    expect(within(settingsPanel).getByText(/失败时先检查权限是否已批准/)).toBeInTheDocument();
    expect(within(settingsPanel).getByText(/失败时优先确认快照是否存在/)).toBeInTheDocument();
    expect(within(settingsPanel).queryByRole("textbox", { name: "联网搜索 Provider" })).not.toBeInTheDocument();
    expect(within(settingsPanel).getByText("回退点上限 10 / 20")).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("button", { name: "20 段" })).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("button", { name: "清空会话" })).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("button", { name: "清空知识库索引" })).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("spinbutton", { name: "长回答输出预算" })).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("spinbutton", { name: "自动续写次数上限" })).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("spinbutton", { name: "续写参考尾部长度" })).toBeInTheDocument();
  });

  it("saves configurable ollama long-answer settings from settings", async () => {
    const onSaveOllamaConfig = vi.fn();
    render(<Workbench {...createWorkbenchProps(createInitialWorkbenchState(), { onSaveOllamaConfig })} />);

    await click(screen.getByRole("button", { name: "设置" }));
    await change(screen.getByRole("spinbutton", { name: "长回答输出预算" }), "12288");
    await change(screen.getByRole("spinbutton", { name: "自动续写次数上限" }), "7");
    await change(screen.getByRole("spinbutton", { name: "续写参考尾部长度" }), "3600");
    await click(screen.getByRole("button", { name: "保存长回答设置" }));

    expect(onSaveOllamaConfig).toHaveBeenCalledWith({
      longAnswerNumPredict: 12288,
      autoContinuationLimit: 7,
      continuationTailLimit: 3600
    });
  });

  it("disables the archive action while the current conversation is still a blank draft", () => {
    render(<Workbench {...createWorkbenchProps(createInitialWorkbenchState())} />);

    expect(screen.getByRole("button", { name: "归档当前会话" })).toBeDisabled();
  });

  it("groups archived conversations by time and filters them inside settings restore", async () => {
    const today = new Date().toISOString();
    const earlier = "2026-06-15T08:00:00.000Z";
    const state = {
      ...createInitialWorkbenchState(),
      history: {
        ...createInitialWorkbenchState().history,
        archivedConversations: [
          {
            id: "archived-today",
            title: "今天归档的会话",
            summary: "今天的摘要",
            entries: [],
            archivedAt: today
          },
          {
            id: "archived-earlier",
            title: "更早归档的会话",
            summary: "更早的摘要",
            entries: [],
            archivedAt: earlier
          }
        ]
      }
    };

    render(<Workbench {...createWorkbenchProps(state)} />);

    await click(screen.getByRole("button", { name: "设置" }));

    const settingsPanel = screen.getByLabelText("设置");
    expect(within(settingsPanel).getByText("今天")).toBeInTheDocument();
    expect(within(settingsPanel).getByText("更早")).toBeInTheDocument();
    expect(within(settingsPanel).getAllByText(/归档于/).length).toBeGreaterThan(0);

    await change(within(settingsPanel).getByRole("textbox", { name: "搜索恢复会话" }), "今天归档");

    expect(within(settingsPanel).getByText("今天归档的会话")).toBeInTheDocument();
    expect(within(settingsPanel).queryByText("更早归档的会话")).not.toBeInTheDocument();
  });

  it("shows recent audit details and log cleanup from the audit workspace", async () => {
    const onCleanupStorage = vi.fn();
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "repair runtime registry"
        })
      ),
      {
        summary: "Local task failed",
        detail: "Runtime registry repair verification failed after rewrite.",
        actionLabel: "Inspect the runtime registry and retry explicitly.",
        source: "opencow_self_repair_failure_analysis"
      }
    );

    render(<Workbench {...createWorkbenchProps(failed, { onCleanupStorage })} />);

    await click(screen.getByRole("button", { name: "审计" }));

    const auditPanel = screen.getByLabelText("审计");

    expect(within(auditPanel).getByRole("heading", { name: "审计" })).toBeInTheDocument();
    expect(within(auditPanel).getByText("日志 1")).toBeInTheDocument();
    expect(within(auditPanel).getByText("Local task failed")).toBeInTheDocument();
    expect(within(auditPanel).getByText(/opencow_self_repair_failure_analysis/)).toBeInTheDocument();
    expect(within(auditPanel).getByText(/Runtime registry repair verification failed after rewrite/)).toBeInTheDocument();

    await click(within(auditPanel).getByRole("button", { name: "清空日志" }));

    expect(onCleanupStorage).toHaveBeenCalledWith("logs");
  });

  it("keeps a full audit event list instead of only a single summary row", async () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "scan local skills"
      })
    );

    render(<Workbench {...createWorkbenchProps(running)} />);

    await click(screen.getByRole("button", { name: "审计" }));

    const auditPanel = screen.getByLabelText("审计");
    expect(within(auditPanel).getAllByText(/模块:/).length).toBeGreaterThan(0);
    expect(within(auditPanel).getAllByText(/来源:/).length).toBeGreaterThan(0);
    expect(within(auditPanel).getAllByText(/时间:/).length).toBeGreaterThan(0);
  });

  it("shows an empty log count after logs are cleared", async () => {
    const logsCleared = createStorageCleanupState(createInitialWorkbenchState(), "logs");

    render(<Workbench {...createWorkbenchProps(logsCleared)} />);

    await click(screen.getByRole("button", { name: "审计" }));

    const auditPanel = screen.getByLabelText("审计");

    expect(within(auditPanel).getByText("日志 1")).toBeInTheDocument();
    expect(within(auditPanel).getByText("已清空本地日志")).toBeInTheDocument();
    expect(within(auditPanel).getByText(/日志清理已完成/)).toBeInTheDocument();
  });

  it("shows blocked command diagnostics and recovery guidance from the safety workspace", async () => {
    const blocked = createCommandPolicyBlockedState(createInitialWorkbenchState(), {
      summary: "命令执行被阻止",
      detail: "Remove-Item -LiteralPath temp-output -Recurse -Force requires controlled-full permission.",
      actionLabel: "改写为只读检查，或先请求 controlled-full 权限并确认高风险操作。",
      source: "command_policy"
    });

    render(<Workbench {...createWorkbenchProps(blocked)} />);

    await click(screen.getByRole("button", { name: "安全" }));

    const safetyPanel = screen.getByLabelText("安全");

    expect(within(safetyPanel).getByRole("heading", { name: "安全" })).toBeInTheDocument();
    expect(within(safetyPanel).getByText("当前权限: 只读")).toBeInTheDocument();
    expect(within(safetyPanel).getByText("最近安全事件: 命令执行被阻止")).toBeInTheDocument();
    expect(within(safetyPanel).getByText(/Remove-Item -LiteralPath temp-output/)).toBeInTheDocument();
    expect(within(safetyPanel).getByText(/改写为只读检查/)).toBeInTheDocument();
  });

  it("shows pending permission actions from the safety workspace", async () => {
    const onApprovePermissionRequest = vi.fn();
    const onCancelPermissionRequest = vi.fn();
    const pending = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "需要在工作区内写入修复文件。",
      riskSummary: "允许在授权工作区内创建和修改文件，但仍禁止高风险删除。"
    });

    render(<Workbench {...createWorkbenchProps(pending, {
      onApprovePermissionRequest,
      onCancelPermissionRequest
    })} />);

    await click(screen.getByRole("button", { name: "安全" }));

    const safetyPanel = screen.getByLabelText("安全");

    expect(within(safetyPanel).getByText("待确认权限: 工作区读写")).toBeInTheDocument();
    expect(within(safetyPanel).getByText(/需要在工作区内写入修复文件/)).toBeInTheDocument();
    expect(within(safetyPanel).getByText(/允许在授权工作区内创建和修改文件/)).toBeInTheDocument();

    await click(within(safetyPanel).getByRole("button", { name: "批准提权" }));
    await click(within(safetyPanel).getByRole("button", { name: "取消提权" }));

    expect(onApprovePermissionRequest).toHaveBeenCalledTimes(1);
    expect(onCancelPermissionRequest).toHaveBeenCalledTimes(1);
  });

  it("keeps task submission in the conversation view after leaving settings", async () => {
    const onSubmitTask = vi.fn();

    render(<Workbench {...createWorkbenchProps(createInitialWorkbenchState(), { onSubmitTask })} />);

    await click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "输入任务" })).not.toBeInTheDocument();

    await click(screen.getByRole("button", { name: "会话" }));

    await change(screen.getByRole("textbox", { name: "输入任务" }), "联网搜索一下最新资料");
    await click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmitTask).toHaveBeenCalledWith("联网搜索一下最新资料", []);
    expect(screen.getByLabelText("会话")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "会话" })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not trigger a new conversation when switching back to chat from another workspace view", async () => {
    const onNewConversation = vi.fn();

    render(<Workbench {...createWorkbenchProps(createInitialWorkbenchState(), { onNewConversation })} />);

    await click(screen.getByRole("button", { name: "知识库" }));
    expect(screen.getByRole("heading", { name: "知识库" })).toBeInTheDocument();

    await click(screen.getByRole("button", { name: "创建新会话" }));
    expect(onNewConversation).toHaveBeenCalledTimes(1);

    await click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();

    await click(screen.getByRole("button", { name: "知识库" }));
    expect(screen.getByRole("heading", { name: "知识库" })).toBeInTheDocument();

    await click(screen.getByRole("button", { name: "会话" }));
    expect(screen.getByLabelText("会话")).toBeInTheDocument();
    expect(onNewConversation).toHaveBeenCalledTimes(1);
  });

  it("triggers a new conversation only from the explicit new-conversation action", async () => {
    const onNewConversation = vi.fn();

    render(<Workbench {...createWorkbenchProps(createInitialWorkbenchState(), { onNewConversation })} />);

    await click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();

    await click(screen.getByRole("button", { name: "会话" }));
    expect(screen.getByLabelText("会话")).toBeInTheDocument();
    expect(onNewConversation).toHaveBeenCalledTimes(0);

    await click(screen.getByRole("button", { name: "创建新会话" }));
    expect(onNewConversation).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("会话")).toBeInTheDocument();
  });
});
