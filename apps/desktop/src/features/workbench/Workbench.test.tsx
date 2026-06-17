import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { Workbench } from "./Workbench";
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
    onSaveRemoteApiConfig: noop,
    onSaveSearchProviderConfig: noop,
    onSelectModel: noop,
    onNewConversation: noop,
    onArchiveConversation: noop,
    onRestoreRecentConversation: noop,
    onDeleteRecentConversation: noop,
    onImportKnowledgeFile: noop,
    onRemoveKnowledgeFile: noop,
    onSubmitTask: noop,
    ...overrides
  };
}

describe("Workbench", () => {
  it("anchors the left and right sidebars to the glass gradient visual layer", () => {
    render(<Workbench {...createWorkbenchProps()} />);

    expect(screen.getByLabelText("主导航")).toHaveClass("glass-gradient-sidebar-left");
    expect(screen.getByLabelText("右侧面板")).toHaveClass("glass-gradient-sidebar-right");
  });

  it("switches the main workspace content when a sidebar item is selected", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));

    expect(screen.getByRole("heading", { name: "知识库" })).toBeInTheDocument();
    expect(screen.getByText("导入、索引和检索本地知识文件，优先保持工作区内可追踪、可恢复。")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本地助手" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "会话" }));
    fireEvent.click(screen.getByRole("button", { name: "打开会话：网页端历史修复上下文" }));
    expect(onRestoreRecentConversation).toHaveBeenCalledWith("recent-conversation-entry");

    fireEvent.click(screen.getByRole("button", { name: "会话" }));

    expect(screen.getByLabelText("会话")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本地助手" })).not.toBeInTheDocument();
  });

  it("shows imported and importable knowledge files in the knowledge workspace", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));

    const knowledgePanel = screen.getByLabelText("知识库");

    expect(within(knowledgePanel).getByText("已索引文件 2")).toBeInTheDocument();
    expect(within(knowledgePanel).getByText("06-rag-skills-npc-mcp.md")).toBeInTheDocument();
    expect(within(knowledgePanel).getByText("docs/v1.0/06-rag-skills-npc-mcp.md")).toBeInTheDocument();
    expect(within(knowledgePanel).getByText("local-rag-rules.txt")).toBeInTheDocument();
    expect(within(knowledgePanel).getByText("文件已失效，检索时会自动跳过。")).toBeInTheDocument();
    expect(within(knowledgePanel).getByText("faq.txt")).toBeInTheDocument();

    fireEvent.click(within(knowledgePanel).getByRole("button", { name: "移出知识库：06-rag-skills-npc-mcp.md" }));
    fireEvent.click(within(knowledgePanel).getByRole("button", { name: "加入知识库：faq.txt" }));

    expect(onRemoveKnowledgeFile).toHaveBeenCalledWith("docs/v1.0/06-rag-skills-npc-mcp.md");
    expect(onImportKnowledgeFile).toHaveBeenCalledWith("notes/faq.txt");
  });

  it("hides the conversation composer outside the conversation workspace", () => {
    render(<Workbench {...createWorkbenchProps()} />);

    expect(screen.getByRole("textbox", { name: "输入任务" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Skills" }));

    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "输入任务" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "会话" }));

    expect(screen.getByRole("textbox", { name: "输入任务" })).toBeInTheDocument();
  });

  it("switches every left sidebar destination into the main workspace", () => {
    const destinations = [
      "搜索",
      "知识库",
      "Skills",
      "NPC",
      "MCP",
      "审计",
      "安全",
      "设置"
    ];

    render(<Workbench {...createWorkbenchProps()} />);

    for (const destination of destinations) {
      fireEvent.click(screen.getByRole("button", { name: destination }));

      expect(screen.getByRole("heading", { name: destination })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: destination })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByLabelText("会话")).not.toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: "会话" }));

    expect(screen.getByLabelText("会话")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "会话" })).toHaveAttribute("aria-pressed", "true");
  });

  it("replaces separate new-conversation and recent-history buttons with a collapsible conversation cluster", () => {
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
    expect(screen.queryByRole("button", { name: /打开会话：最近会话 [1-7]/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "会话" }));

    expect(screen.getAllByRole("button", { name: /打开会话：最近会话 [1-7]/ }).length).toBe(3);

    fireEvent.click(screen.getByRole("button", { name: "展开最近会话" }));

    expect(screen.getAllByRole("button", { name: /打开会话：最近会话 [1-7]/ }).length).toBe(6);
  });

  it("restores a recent conversation when its conversation card is clicked", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "会话" }));
    fireEvent.click(screen.getByRole("button", { name: "打开会话：恢复目标会话" }));

    expect(onRestoreRecentConversation).toHaveBeenCalledWith("recent-restore");
  });

  it("toggles the recent conversation dropdown from the conversation row", () => {
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

    expect(screen.queryByRole("button", { name: "打开会话：可收起的历史会话" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "会话" }));

    expect(screen.getByRole("button", { name: "打开会话：可收起的历史会话" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "会话" }));

    expect(screen.queryByRole("button", { name: "打开会话：可收起的历史会话" })).not.toBeInTheDocument();
  });

  it("shows the temporary blank conversation inside the draft conversation dropdown", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "创建新会话" }));
    fireEvent.click(screen.getByRole("button", { name: "会话" }));

    expect(onNewConversation).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "打开会话：新会话" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开会话：之前的旧会话" })).toBeInTheDocument();
  });

  it("asks for confirmation before permanently deleting a conversation from the cluster", () => {
    const onDeleteRecentConversation = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
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

    fireEvent.click(screen.getByRole("button", { name: "会话" }));
    fireEvent.click(screen.getByRole("button", { name: "删除会话：删除目标会话" }));

    expect(confirmSpy).toHaveBeenCalledWith("确定永久删除此对话吗？");
    expect(onDeleteRecentConversation).toHaveBeenCalledWith("recent-delete");
  });

  it("opens conversation search and creates a new conversation from the conversation cluster header", () => {
    const onNewConversation = vi.fn();

    render(<Workbench {...createWorkbenchProps(createInitialWorkbenchState(), { onNewConversation })} />);

    expect(screen.queryByRole("textbox", { name: "搜索历史记录" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "搜索历史会话" }));

    expect(screen.getByRole("textbox", { name: "搜索历史记录" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "创建新会话" }));

    expect(onNewConversation).toHaveBeenCalledTimes(1);
  });

  it("filters across all saved recent conversations from the cluster search box", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "搜索历史会话" }));
    fireEvent.change(screen.getByRole("textbox", { name: "搜索历史记录" }), {
      target: { value: "目标会话" }
    });

    expect(screen.getByRole("button", { name: "打开会话：更早的目标会话" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "打开会话：最近会话 1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "打开会话：归档旧会话" })).not.toBeInTheDocument();
  });

  it("keeps conversation card text compact instead of rendering the full long prompt", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "会话" }));

    const cluster = screen.getByLabelText("会话分组");

    expect(within(cluster).queryByText(longTitle)).not.toBeInTheDocument();
    expect(within(cluster).queryByText(longSummary)).not.toBeInTheDocument();
    expect(within(cluster).getByText(/…$/)).toBeInTheDocument();
  });

  it("routes missing model setup actions into the matching settings section", () => {
    const failed = createOllamaLoadErrorState(
      createInitialWorkbenchState(),
      "Ollama startup check failed: connection refused on 127.0.0.1:11434."
    );

    render(<Workbench {...createWorkbenchProps(failed)} />);

    fireEvent.click(screen.getByRole("button", { name: "配置 Ollama" }));

    const settingsPanel = screen.getByLabelText("设置");
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("heading", { name: "Ollama 设置" })).toBeInTheDocument();
    expect(within(settingsPanel).getByText(/connection refused on 127\.0\.0\.1:11434/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "会话" }));
    fireEvent.click(screen.getByRole("button", { name: "配置大模型 API" }));

    expect(screen.getByRole("heading", { name: "大模型 API 设置" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "远程 API Base URL" })).toBeInTheDocument();
  });

  it("keeps model, shell, network, rollback, and cleanup configuration in settings", () => {
    render(<Workbench {...createWorkbenchProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "设置" }));

    const settingsPanel = screen.getByLabelText("设置");

    expect(within(settingsPanel).getByRole("heading", { name: "Ollama 设置" })).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("heading", { name: "大模型 API 设置" })).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("heading", { name: "恢复会话" })).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("heading", { name: "联网搜索设置" })).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("heading", { name: "Shell 能力与恢复路径" })).toBeInTheDocument();
    expect(within(settingsPanel).getByText("只读 Shell · readonly")).toBeInTheDocument();
    expect(within(settingsPanel).getByText("写入 Shell · workspace-write")).toBeInTheDocument();
    expect(within(settingsPanel).getByText("高危 Shell · controlled-full")).toBeInTheDocument();
    expect(within(settingsPanel).getByText(/失败时优先检查工作区根目录发现/)).toBeInTheDocument();
    expect(within(settingsPanel).getByText(/失败时先检查权限是否已批准/)).toBeInTheDocument();
    expect(within(settingsPanel).getByText(/失败时优先确认快照是否存在/)).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("textbox", { name: "联网搜索 Provider" })).toBeInTheDocument();
    expect(within(settingsPanel).getByText("回退点上限 10 / 20")).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("button", { name: "20 段" })).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("button", { name: "清空会话" })).toBeInTheDocument();
    expect(within(settingsPanel).getByRole("button", { name: "清空知识库索引" })).toBeInTheDocument();
  });

  it("disables the archive action while the current conversation is still a blank draft", () => {
    render(<Workbench {...createWorkbenchProps(createInitialWorkbenchState())} />);

    expect(screen.getByRole("button", { name: "归档当前会话" })).toBeDisabled();
  });

  it("groups archived conversations by time and filters them inside settings restore", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "设置" }));

    const settingsPanel = screen.getByLabelText("设置");
    expect(within(settingsPanel).getByText("今天")).toBeInTheDocument();
    expect(within(settingsPanel).getByText("更早")).toBeInTheDocument();
    expect(within(settingsPanel).getAllByText(/归档于/).length).toBeGreaterThan(0);

    fireEvent.change(within(settingsPanel).getByRole("textbox", { name: "搜索恢复会话" }), {
      target: { value: "今天归档" }
    });

    expect(within(settingsPanel).getByText("今天归档的会话")).toBeInTheDocument();
    expect(within(settingsPanel).queryByText("更早归档的会话")).not.toBeInTheDocument();
  });

  it("shows recent audit details and log cleanup from the audit workspace", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "审计" }));

    const auditPanel = screen.getByLabelText("审计");

    expect(within(auditPanel).getByRole("heading", { name: "审计" })).toBeInTheDocument();
    expect(within(auditPanel).getByText(`日志 ${failed.storage.logCount}`)).toBeInTheDocument();
    expect(within(auditPanel).getByText("Local task failed")).toBeInTheDocument();
    expect(within(auditPanel).getByText(/opencow_self_repair_failure_analysis/)).toBeInTheDocument();
    expect(within(auditPanel).getByText(/Runtime registry repair verification failed after rewrite/)).toBeInTheDocument();

    fireEvent.click(within(auditPanel).getByRole("button", { name: "清空日志" }));

    expect(onCleanupStorage).toHaveBeenCalledWith("logs");
  });

  it("shows an empty log count after logs are cleared", () => {
    const logsCleared = createStorageCleanupState(createInitialWorkbenchState(), "logs");

    render(<Workbench {...createWorkbenchProps(logsCleared)} />);

    fireEvent.click(screen.getByRole("button", { name: "审计" }));

    const auditPanel = screen.getByLabelText("审计");

    expect(within(auditPanel).getByText("日志 0")).toBeInTheDocument();
    expect(within(auditPanel).getByText("已清空本地日志")).toBeInTheDocument();
    expect(within(auditPanel).getByText(/日志清理已完成/)).toBeInTheDocument();
  });

  it("shows blocked command diagnostics and recovery guidance from the safety workspace", () => {
    const blocked = createCommandPolicyBlockedState(createInitialWorkbenchState(), {
      summary: "命令执行被阻止",
      detail: "Remove-Item -LiteralPath temp-output -Recurse -Force requires controlled-full permission.",
      actionLabel: "改写为只读检查，或先请求 controlled-full 权限并确认高风险操作。",
      source: "command_policy"
    });

    render(<Workbench {...createWorkbenchProps(blocked)} />);

    fireEvent.click(screen.getByRole("button", { name: "安全" }));

    const safetyPanel = screen.getByLabelText("安全");

    expect(within(safetyPanel).getByRole("heading", { name: "安全" })).toBeInTheDocument();
    expect(within(safetyPanel).getByText("当前权限: 只读")).toBeInTheDocument();
    expect(within(safetyPanel).getByText("最近安全事件: 命令执行被阻止")).toBeInTheDocument();
    expect(within(safetyPanel).getByText(/Remove-Item -LiteralPath temp-output/)).toBeInTheDocument();
    expect(within(safetyPanel).getByText(/改写为只读检查/)).toBeInTheDocument();
  });

  it("shows pending permission actions from the safety workspace", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "安全" }));

    const safetyPanel = screen.getByLabelText("安全");

    expect(within(safetyPanel).getByText("待确认权限: 工作区读写")).toBeInTheDocument();
    expect(within(safetyPanel).getByText(/需要在工作区内写入修复文件/)).toBeInTheDocument();
    expect(within(safetyPanel).getByText(/允许在授权工作区内创建和修改文件/)).toBeInTheDocument();

    fireEvent.click(within(safetyPanel).getByRole("button", { name: "批准提权" }));
    fireEvent.click(within(safetyPanel).getByRole("button", { name: "取消提权" }));

    expect(onApprovePermissionRequest).toHaveBeenCalledTimes(1);
    expect(onCancelPermissionRequest).toHaveBeenCalledTimes(1);
  });

  it("keeps task submission in the conversation view after leaving settings", () => {
    const onSubmitTask = vi.fn();

    render(<Workbench {...createWorkbenchProps(createInitialWorkbenchState(), { onSubmitTask })} />);

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "输入任务" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "会话" }));

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "联网搜索一下最新资料" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmitTask).toHaveBeenCalledWith("联网搜索一下最新资料");
    expect(screen.getByLabelText("会话")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "会话" })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not trigger a new conversation when switching back to chat from another workspace view", () => {
    const onNewConversation = vi.fn();

    render(<Workbench {...createWorkbenchProps(createInitialWorkbenchState(), { onNewConversation })} />);

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));
    expect(screen.getByRole("heading", { name: "知识库" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "创建新会话" }));
    expect(onNewConversation).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));
    expect(screen.getByRole("heading", { name: "知识库" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "会话" }));
    expect(screen.getByLabelText("会话")).toBeInTheDocument();
    expect(onNewConversation).toHaveBeenCalledTimes(1);
  });

  it("triggers a new conversation only from the explicit new-conversation action", () => {
    const onNewConversation = vi.fn();

    render(<Workbench {...createWorkbenchProps(createInitialWorkbenchState(), { onNewConversation })} />);

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "会话" }));
    expect(screen.getByLabelText("会话")).toBeInTheDocument();
    expect(onNewConversation).toHaveBeenCalledTimes(0);

    fireEvent.click(screen.getByRole("button", { name: "创建新会话" }));
    expect(onNewConversation).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("会话")).toBeInTheDocument();
  });
});
