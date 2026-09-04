import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelPendingConfirmationState,
  cancelPermissionModeChangeState,
  createCapabilityToggleRequestState,
  createCommandPolicyBlockedState,
  createDuplicatePendingApprovalSkippedState,
  createHighRiskConfirmationState,
  createInitialWorkbenchState,
  createOllamaLoadErrorState,
  createSearchProviderConfigState,
  createSearchToggleState,
  createTaskExecutionCancelledState,
  createTaskExecutionFailedState,
  createTaskExecutionProgressState,
  createTaskExecutionStreamingChunkState,
  createTaskExecutionSucceededState,
  createTaskExecutionStartedState,
  createUserTaskSubmittedState,
  requestRollbackPreviewState,
  createToolExecutionErrorState,
  requestPermissionModeChangeState
} from "../workbenchState";
import { mergeOllamaOverview } from "../workbenchState";
import { MainConversation } from "./MainConversation";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn()
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock
}));

function flushAnimationFrame() {
  return new Promise<void>((resolve) => {
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => resolve());
      return;
    }

    resolve();
  });
}

describe("MainConversation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    invokeMock.mockReset();
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("keeps a new conversation visually blank by default", () => {
    const { container } = render(
      <MainConversation state={createInitialWorkbenchState()} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />
    );

    expect(screen.getByLabelText("会话")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本地助手" })).not.toBeInTheDocument();
    expect(screen.queryByText("直接输入需求。命令、权限和日志细节会按需在右侧或设置中展开。")).not.toBeInTheDocument();
    expect(screen.queryByText("Ollama 本地优先")).not.toBeInTheDocument();
    expect(screen.queryByText("默认使用本地 Ollama，并优先展示可追溯、可回退、可确认的桌面工作流。")).not.toBeInTheDocument();
    expect(screen.queryByText("准备开始")).not.toBeInTheDocument();
    expect(screen.queryByText("直接输入问题或任务，普通对话会优先返回助手答复。")).not.toBeInTheDocument();
    expect(screen.queryByText("opencow desktop")).not.toBeInTheDocument();
    expect(screen.queryByText("模型状态")).not.toBeInTheDocument();
    expect(screen.queryByText("当前模型")).not.toBeInTheDocument();
    expect(screen.queryByText("当前权限")).not.toBeInTheDocument();
    expect(container.querySelector(".message-row")).not.toBeInTheDocument();
    expect(container.querySelector(".message-card")).not.toBeInTheDocument();
  });

  it("exposes a stable motion scope for progressive conversation reveals", () => {
    const { container } = render(
      <MainConversation state={createInitialWorkbenchState()} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />
    );

    expect(container.querySelector(".conversation-scroll")).toHaveAttribute("data-motion-scope", "conversation");
  });

  it("keeps a blank conversation screen empty even when recent conversations exist", () => {
    const state = {
      ...createInitialWorkbenchState(),
      history: {
        lastNonEmptyConversationEntries: [
          {
            id: "history-entry-user",
            kind: "user" as const,
            title: "用户",
            summary: "帮我继续修网页端历史记录"
          }
        ],
        draftConversations: [
          {
            id: "recent-conversation-1",
            title: "帮我继续修网页端历史记录",
            summary: "最近一次会话保留了网页端历史记录修复上下文。",
            entries: [
              {
                id: "history-entry-user",
                kind: "user" as const,
                title: "用户",
                summary: "帮我继续修网页端历史记录"
              }
            ]
          }
        ],
        archivedConversations: []
      }
    };

    render(
      <MainConversation
        state={state}
        onPreviewRollback={vi.fn()}
        onCancelActiveTask={vi.fn()}
      />
    );

    expect(screen.queryByText("最近会话")).not.toBeInTheDocument();
    expect(screen.queryByText("帮我继续修网页端历史记录")).not.toBeInTheDocument();
    expect(screen.queryByText("最近一次会话保留了网页端历史记录修复上下文。")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "恢复这段会话" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除这段会话" })).not.toBeInTheDocument();
  });

  it("shows only the current conversation title and overview after messages exist", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "整理这个项目现在最需要修的前端问题",
      executionKind: "local-model-chat",
      executionTitle: "本地模型对话",
      executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
      executionAuditDetail: "Local model chat task: 整理这个项目现在最需要修的前端问题"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "前端问题概览",
      resultSummary: "当前优先修复导航切换、模型选择和默认空白对话。"
    });

    render(<MainConversation state={completed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "整理这个项目现在最需要修的前端问题" })).toBeInTheDocument();
    expect(screen.getByText("概览：前端问题概览")).toBeInTheDocument();
    expect(screen.getByText("当前优先修复导航切换、模型选择和默认空白对话。")).toBeInTheDocument();
    expect(screen.queryByText("本地助手工作台")).not.toBeInTheDocument();
    expect(screen.queryByText("Ollama 本地优先")).not.toBeInTheDocument();
    expect(screen.queryByText("当前权限")).not.toBeInTheDocument();
  });

  it("renders historical user attachments and reopens them on double click", () => {
    const onOpenAttachment = vi.fn();
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "看一下这些附件",
      attachments: [
        {
          id: "attachment-1",
          name: "capture-1.png",
          mimeType: "image/png",
          sizeBytes: 4096,
          kind: "image",
          filePath: "/tmp/capture-1.png",
          previewUrl: "blob:capture-1",
          source: "drop"
        },
        {
          id: "attachment-2",
          name: "谭懿钧简历-AI方向.pdf",
          mimeType: "application/pdf",
          sizeBytes: 2048,
          kind: "file",
          filePath: "/tmp/resume.pdf",
          source: "paste"
        },
        {
          id: "attachment-3",
          name: "payload.bin",
          mimeType: "application/octet-stream",
          sizeBytes: 512,
          kind: "file",
          filePath: "/tmp/payload.bin",
          source: "drop"
        }
      ]
    });

    render(
      <MainConversation
        state={submitted}
        onPreviewRollback={vi.fn()}
        onCancelActiveTask={vi.fn()}
        onOpenAttachment={onOpenAttachment}
      />
    );

    const firstAttachment = screen.getByRole("button", { name: /打开附件：capture-1\.png/i });
    const messageBody = firstAttachment.closest(".message-body");
    expect(screen.getByAltText("附件缩略图：capture-1.png")).toHaveAttribute("src", "blob:capture-1");
    expect(messageBody?.textContent?.indexOf("capture-1.png")).toBeLessThan(
      messageBody?.textContent?.indexOf("看一下这些附件") ?? 0
    );
    expect(screen.queryByText(/图片 ·/)).not.toBeInTheDocument();
    expect(screen.getByText("谭懿钧简历-AI方向.pdf")).toBeInTheDocument();
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();

    fireEvent.doubleClick(firstAttachment);

    expect(onOpenAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "attachment-1",
        name: "capture-1.png"
      })
    );
  });

  it("auto-scrolls to the newest message when conversation content changes", async () => {
    const scrollTopDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTop");
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    let latestScrollTop = 0;

    Object.defineProperty(HTMLElement.prototype, "scrollTop", {
      configurable: true,
      get() {
        return latestScrollTop;
      },
      set(value) {
        latestScrollTop = value;
      }
    });
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return 480;
      }
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 480;
      }
    });

    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "第一条消息",
      executionKind: "local-model-chat",
      executionTitle: "本地模型对话",
      executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
      executionAuditDetail: "Local model chat task: 第一条消息"
    });

    const { rerender } = render(
      <MainConversation state={submitted} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />
    );

    await flushAnimationFrame();
    expect(latestScrollTop).toBe(480);

    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "本地模型答复",
      resultSummary: "这里是最新回复。"
    });

    latestScrollTop = 0;
    rerender(<MainConversation state={completed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    await flushAnimationFrame();
    expect(latestScrollTop).toBe(480);

    if (scrollTopDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "scrollTop", scrollTopDescriptor);
    }

    if (scrollHeightDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "scrollHeight", scrollHeightDescriptor);
    }

    if (clientHeightDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientHeight", clientHeightDescriptor);
    }
  });

  it("keeps a reader's scroll position while streaming when they are away from the bottom", async () => {
    const scrollTopDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTop");
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    let currentScrollTop = 100;

    Object.defineProperty(HTMLElement.prototype, "scrollTop", {
      configurable: true,
      get: () => currentScrollTop,
      set: (value) => { currentScrollTop = value; }
    });
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 480 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 240 });

    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "保留阅读位置",
      executionKind: "local-model-chat",
      executionTitle: "本地模型对话",
      executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
      executionAuditDetail: "Local model chat task: 保留阅读位置"
    });

    render(<MainConversation state={submitted} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    await flushAnimationFrame();
    expect(currentScrollTop).toBe(100);

    if (scrollTopDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollTop", scrollTopDescriptor);
    if (scrollHeightDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollHeight", scrollHeightDescriptor);
    if (clientHeightDescriptor) Object.defineProperty(HTMLElement.prototype, "clientHeight", clientHeightDescriptor);
  });

  it("surfaces capability cancellation recovery in the main conversation", () => {
    const requested = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "search",
      enabled: true,
      source: "conversation",
      reason: "Allow Tavily search for the current research request.",
      providerLabel: "Tavily"
    });
    const cancelled = cancelPendingConfirmationState(requested);

    render(<MainConversation state={cancelled} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText("能力变更已取消，当前设置保持不变。")).toBeInTheDocument();
    expect(screen.queryByText(/Capability change was cancelled/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Current capability state was preserved/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Recovery visibility:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/provider\/configuration/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/queued execution/i)).not.toBeInTheDocument();
  });

  it("surfaces dangerous confirmation cancellation as concise Chinese recovery", () => {
    const requested = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "Confirm temp-output removal",
      summary: "Remove temp-output inside the approved workspace.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Delete temp-output only after explicit confirmation.",
      requiredMode: "controlled-full",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a controlled-full temp-output removal task.",
      queuedExecutionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
      queuedMessage: "remove the temp-output folder from this workspace"
    });
    const cancelled = cancelPendingConfirmationState(requested);

    render(<MainConversation state={cancelled} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText("高风险操作已取消，没有执行命令。")).toBeInTheDocument();
    expect(screen.queryByText(/No command was executed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Recovery visibility:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Queued execution/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Remove-Item/i)).not.toBeInTheDocument();
  });

  it("surfaces permission cancellation as concise Chinese recovery", () => {
    const requested = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before creating temp-output.",
      riskSummary: "Allow a fixed workspace-local temp-output creation command only.",
      queuedExecutionKind: "workspace-write-create-temp-output",
      queuedExecutionTitle: "Create temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output directory task.",
      queuedExecutionAuditDetail: "Workspace-write shell command task: create temp-output directory",
      queuedMessage: "create a temp-output folder for this workspace"
    });
    const cancelled = cancelPermissionModeChangeState(requested);

    render(<MainConversation state={cancelled} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText("权限升级已取消，当前权限保持不变。")).toBeInTheDocument();
    expect(screen.queryByText(/Permission mode was not changed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Recovery visibility:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Queued execution/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Workspace write permission is required/i)).not.toBeInTheDocument();
  });

  it("surfaces command policy blocked reason in the main conversation", () => {
    const blocked = createCommandPolicyBlockedState(createInitialWorkbenchState(), {
      summary: "Command execution was blocked",
      detail: "Working directory escaped the approved workspace: c:/windows",
      actionLabel: "Check the working directory and permission scope before retrying.",
      source: "command_policy"
    });

    render(<MainConversation state={blocked} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText(/Command execution was blocked/i)).toBeInTheDocument();
    expect(screen.getByText(/Check the working directory and permission scope before retrying/i)).toBeInTheDocument();
    expect(screen.getByText(/Working directory escaped the approved workspace/i)).toBeInTheDocument();
    expect(screen.queryByText(/Working directory escaped the approved workspace: c:\/windows Check the working directory/i)).not.toBeInTheDocument();
  });

  it("surfaces duplicate pending approval skips in the main conversation", () => {
    const pending = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before creating temp-output.",
      riskSummary: "Allow a fixed workspace-local temp-output creation command only.",
      queuedExecutionKind: "workspace-write-create-temp-output",
      queuedExecutionTitle: "Create temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output directory task.",
      queuedExecutionAuditDetail: "Workspace-write shell command task: create temp-output directory",
      queuedMessage: "create a temp-output folder for this workspace"
    });
    const skipped = createDuplicatePendingApprovalSkippedState(pending, {
      approvalType: "permission",
      message: "create a temp-output folder for this workspace"
    });
    const onPreviewRollback = vi.fn();

    render(<MainConversation state={skipped} onPreviewRollback={onPreviewRollback} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText("重复审批请求已跳过")).toBeInTheDocument();
    expect(screen.queryByText(/Duplicate pending approval request skipped/i)).not.toBeInTheDocument();
    expect(screen.getByText("已有权限审批正在等待处理，已跳过这次重复请求。")).toBeInTheDocument();
    expect(screen.queryByText(/Module: permission/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Source: duplicate_pending_approval_skipped/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Suggestion:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Queued execution audit detail/i)).not.toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /预览回退/i })).not.toBeInTheDocument();
    expect(onPreviewRollback).not.toHaveBeenCalled();
  });

  it("surfaces duplicate local task skips without exposing execution trace in the main conversation", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "repair runtime registry",
          executionKind: "opencow-self-repair-preview",
          executionTitle: "Opencow self-repair preview",
          executionAuditSummary: "Local assistant planned a readonly self-repair preview.",
          executionAuditDetail: "Readonly self-repair preview for runtime registry."
        })
      ),
      {
        summary: "Local task failed",
        detail: "Runtime registry repair verification failed after rewrite.",
        actionLabel: "Check .opencow/runtime/workspace-project-runs.json first, then ask opencow to retry.",
        source: "opencow_self_repair_failure_analysis"
      }
    );
    const skipped = createUserTaskSubmittedState(failed, {
      message: "repair runtime registry"
    });

    render(<MainConversation state={skipped} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText("重复任务已跳过")).toBeInTheDocument();
    expect(screen.getByText("相同任务已经失败，请先查看失败详情、点击重试本地任务，或改写请求。")).toBeInTheDocument();
    expect(screen.queryByText(/Existing task status:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Execution kind:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Previous failure detail:/i)).not.toBeInTheDocument();
  });

  it("keeps Ollama setup prompts out of the main conversation when Ollama cannot be reached", () => {
    const failed = createOllamaLoadErrorState(
      createInitialWorkbenchState(),
      "Ollama startup check failed: connection refused on 127.0.0.1:11434."
    );

    render(
      <MainConversation
        state={failed}
        onPreviewRollback={vi.fn()}
        onCancelActiveTask={vi.fn()}
      />
    );

    expect(screen.queryByText("需要配置模型")).not.toBeInTheDocument();
    expect(screen.queryByText(/默认使用本地 Ollama/)).not.toBeInTheDocument();
    expect(screen.queryByText(/connection refused on 127\.0\.0\.1:11434/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "配置 Ollama" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "配置大模型 API" })).not.toBeInTheDocument();
  });

  it("keeps Ollama no-model prompts out of the main conversation", () => {
    const noModels = mergeOllamaOverview(createInitialWorkbenchState(), {
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "",
      diagnostic: "",
      models: []
    });

    render(<MainConversation state={noModels} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.queryByText("需要配置模型")).not.toBeInTheDocument();
    expect(screen.queryByText(/未检测到可用本地模型/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "配置 Ollama" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "配置大模型 API" })).not.toBeInTheDocument();
  });

  it("keeps tool execution error details collapsed in the main conversation", () => {
    const failed = createToolExecutionErrorState(createInitialWorkbenchState(), {
      toolLabel: "RAG document parser",
      summary: "Document parsing failed",
      detail: "The selected PPTX could not be parsed. TOOL_ERROR_DETAIL_SENTINEL: parser stack, slide id, file path, and retry trace are kept for audit.",
      actionLabel: "Check the source document, then retry with a narrower document range.",
      source: "rag_document_parser"
    });

    render(<MainConversation state={failed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText(/Document parsing failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Check the source document, then retry/i)).toBeInTheDocument();
    expect(screen.getByText("完整工具错误详情已保留在日志、错误详情和回退记录中。")).toBeInTheDocument();
    expect(screen.queryByText(/TOOL_ERROR_DETAIL_SENTINEL/i)).not.toBeInTheDocument();
  });

  it("keeps the main conversation empty when custom search provider is cleared back to default search", () => {
    const searchEnabled = createSearchToggleState(createInitialWorkbenchState(), {
      enabled: true,
      providerLabel: "Tavily"
    });
    const missingProvider = createSearchProviderConfigState(searchEnabled, {
      providerLabel: " "
    });

    render(<MainConversation state={missingProvider} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.queryByText(/联网搜索 Provider 未配置/)).not.toBeInTheDocument();
    expect(screen.queryByText(/前往设置配置联网搜索 Provider/)).not.toBeInTheDocument();
    expect(screen.queryByText(/不会执行实时联网检索/)).not.toBeInTheDocument();
  });

  it("offers rollback from the user message instead of assistant recovery chrome", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "repair opencow runtime registry"
        })
      ),
      {
        summary: "Local task failed",
        detail: "Runtime registry repair verification failed after rewrite.",
        actionLabel: "Check the runtime registry and retry with a narrower request.",
        source: "local_task_runner"
      }
    );
    const onPreviewRollback = vi.fn();

    render(<MainConversation state={failed} onPreviewRollback={onPreviewRollback} onCancelActiveTask={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /预览回退/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "回退到这条消息之前" }));

    expect(onPreviewRollback).toHaveBeenCalledWith("composer-submit-local-task-1");
  });

  it("rolls back a later user message to the state immediately before that message", () => {
    const firstCompleted = createTaskExecutionSucceededState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "first local request"
        })
      ),
      {
        resultTitle: "First result",
        resultSummary: "The first request completed."
      }
    );
    const secondSubmitted = createUserTaskSubmittedState(firstCompleted, {
      message: "second local request"
    });
    const onPreviewRollback = vi.fn();

    render(<MainConversation state={secondSubmitted} onPreviewRollback={onPreviewRollback} onCancelActiveTask={vi.fn()} />);

    const rollbackButtons = screen.getAllByRole("button", { name: "回退到这条消息之前" });
    expect(rollbackButtons).toHaveLength(2);
    fireEvent.click(rollbackButtons[1]);

    expect(onPreviewRollback).toHaveBeenCalledWith("composer-submit-local-task-4");
    expect(onPreviewRollback).not.toHaveBeenCalledWith("startup-baseline");
  });

  it("keeps task execution trace out of main-conversation failure recovery", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "create a temp-output folder for this workspace",
          executionKind: "workspace-write-create-temp-output",
          executionTitle: "Create temp-output directory",
          executionAuditSummary: "Local assistant planned a workspace-write temp-output creation command.",
          executionAuditDetail: "Workspace write shell command task: create temp-output directory"
        })
      ),
      {
        summary: "Local task failed",
        detail: "Shell bridge refused workspace write because the directory lock could not be acquired.",
        actionLabel: "Check the workspace lock and retry with a narrower request.",
        source: "local_task_runner"
      }
    );

    render(<MainConversation state={failed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText(/Local task failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Check the workspace lock and retry/i)).toBeInTheDocument();
    expect(screen.getByText(/Shell bridge refused workspace write/i)).toBeInTheDocument();
    expect(screen.queryByText(/Execution kind:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Execution audit detail:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Recovery visibility:/i)).not.toBeInTheDocument();
  });

  it("keeps local model raw diagnostics out of the main conversation failure recovery", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "开源协议有哪些",
          executionKind: "local-model-chat",
          executionTitle: "本地模型对话",
          executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
          executionAuditDetail: "Local model chat task: 开源协议有哪些"
        })
      ),
      {
        summary: "本地模型对话失败",
        detail:
          "Local task exceeded the maximum execution time of 480 seconds. Local model chat diagnostics: model=qwen3.6:35b; timeout=480s; inputLength=7; longAnswerProtection=enabled.",
        actionLabel:
          "本地模型响应超时：请确认 Ollama 进程仍在运行，或切换更快模型后重试。",
        source: "local_model_chat_runner"
      }
    );

    render(<MainConversation state={failed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText("本地模型对话失败")).toBeInTheDocument();
    expect(screen.getByText(/本地模型响应超时/)).toBeInTheDocument();
    expect(screen.queryByText(/Local model chat diagnostics/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/model=qwen3\.6:35b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/inputLength=7/i)).not.toBeInTheDocument();
  });

  it("surfaces actionable Ollama error details in local model failure recovery", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "explain MIT license",
          executionKind: "local-model-chat",
          executionTitle: "Local model chat",
          executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
          executionAuditDetail: "Local model chat task: explain MIT license"
        })
      ),
      {
        summary: "本地模型对话失败",
        detail:
          "Ollama chat failed with HTTP 404: model missing:latest not found. Local model chat diagnostics: model=missing:latest; timeout=480s; inputLength=19; longAnswerProtection=disabled.",
        actionLabel: "请检查 Ollama 模型是否已拉取并重新选择模型后重试。",
        source: "local_model_chat_runner"
      }
    );

    render(<MainConversation state={failed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText(/model missing:latest not found/i)).toBeInTheDocument();
    expect(screen.queryByText(/Local model chat diagnostics/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/timeout=480s/i)).not.toBeInTheDocument();
  });

  it("keeps stale 45 second local-model timeout diagnostics out of the main conversation", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "开源协议有哪些",
          executionKind: "local-model-chat",
          executionTitle: "本地模型对话",
          executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
          executionAuditDetail: "Local model chat task: 开源协议有哪些"
        })
      ),
      {
        summary: "本地模型对话失败",
        detail:
          "Local task exceeded the maximum execution time of 45 seconds. Local model chat diagnostics: model=qwen3.6:35b; timeout=45s; inputLength=7; longAnswerProtection=enabled.",
        actionLabel:
          "本地模型响应超时：长回答保护已启用，OpenCow 会优先使用自动分段、缺题补写和显式重试；如果模型仍超时，请确认 Ollama 进程仍在运行，切换更快模型，或减少单次输入长度后重试。",
        source: "local_model_chat_runner"
      }
    );

    render(<MainConversation state={failed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText("本地模型对话失败")).toBeInTheDocument();
    expect(screen.getByText(/长回答保护已启用/)).toBeInTheDocument();
    expect(screen.getByText("本地模型本轮没有按时返回完整结果，详细诊断已保留在右侧任务详情和日志中。")).toBeInTheDocument();
    expect(screen.queryByText(/45 seconds/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/timeout=45s/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Local model chat diagnostics/i)).not.toBeInTheDocument();
  });

  it("surfaces waiting-first-chunk local-model timeout guidance without leaking raw diagnostics", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "解释一下享元模式",
          executionKind: "local-model-chat",
          executionTitle: "本地模型对话",
          executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
          executionAuditDetail: "Local model chat task: 解释一下享元模式"
        })
      ),
      {
        summary: "本地模型对话失败",
        detail:
          "Local task exceeded the maximum execution time of 480 seconds. Local model chat diagnostics: model=qwen3.6:35b; timeout=480s; inputLength=8; streamPhase=waiting-first-chunk; elapsedMs=480000; firstChunkAfterMs=none; longAnswerProtection=enabled.",
        actionLabel:
          "本地模型响应超时：长回答保护已启用，OpenCow 会优先使用自动分段、缺题补写和显式重试；如果模型仍超时，请确认 Ollama 进程仍在运行，切换更快模型，或减少单次输入长度后重试。",
        source: "local_model_chat_runner"
      }
    );

    render(<MainConversation state={failed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText("本地模型对话失败")).toBeInTheDocument();
    expect(screen.getByText(/本地模型已连接，但首轮输出没有在本轮超时前返回/)).toBeInTheDocument();
    expect(screen.queryByText(/streamPhase=waiting-first-chunk/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/firstChunkAfterMs=none/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Local model chat diagnostics/i)).not.toBeInTheDocument();
  });

  it("surfaces streaming local-model timeout guidance without leaking raw diagnostics", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "开源协议有哪些",
          executionKind: "local-model-chat",
          executionTitle: "本地模型对话",
          executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
          executionAuditDetail: "Local model chat task: 开源协议有哪些"
        })
      ),
      {
        summary: "本地模型对话失败",
        detail:
          "Local task exceeded the maximum execution time of 480 seconds. Local model chat diagnostics: model=qwen3.6:35b; timeout=480s; inputLength=7; streamPhase=streaming; elapsedMs=480000; firstChunkAfterMs=1200; longAnswerProtection=enabled.",
        actionLabel:
          "本地模型响应超时：长回答保护已启用，OpenCow 会优先使用自动分段、缺题补写和显式重试；如果模型仍超时，请确认 Ollama 进程仍在运行，切换更快模型，或减少单次输入长度后重试。",
        source: "local_model_chat_runner"
      }
    );

    render(<MainConversation state={failed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText("本地模型对话失败")).toBeInTheDocument();
    expect(screen.getByText(/本地模型已经开始输出，但没有在本轮超时前完整结束/)).toBeInTheDocument();
    expect(screen.queryByText(/streamPhase=streaming/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/firstChunkAfterMs=1200/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Local model chat diagnostics/i)).not.toBeInTheDocument();
  });

  it("keeps successful assistant replies concise in the main conversation", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "你能帮我做什么",
      executionKind: "local-model-chat",
      executionTitle: "本地模型对话",
      executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
      executionAuditDetail: "Local model chat task: 你能帮我做什么"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "本地模型回答",
      resultSummary: "我可以帮你对话、检查工作区、按权限执行命令，并在失败时给出下一步建议。"
    });

    render(<MainConversation state={completed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText("本地模型回答")).toBeInTheDocument();
    expect(screen.getByText(/我可以帮你对话、检查工作区、按权限执行命令/)).toBeInTheDocument();
    expect(screen.queryByText(/Input summary:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Execution kind:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Execution audit detail:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Result summary:/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /预览回退/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "回退到这条消息之前" })).toBeInTheDocument();
  });

  it("keeps task cancellation rollback on the user message", () => {
    const cancelled = createTaskExecutionCancelledState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "long running local assistant task"
        })
      )
    );
    const onPreviewRollback = vi.fn();

    render(<MainConversation state={cancelled} onPreviewRollback={onPreviewRollback} onCancelActiveTask={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /预览回退/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "回退到这条消息之前" }));

    expect(onPreviewRollback).toHaveBeenCalledWith("composer-submit-local-task-1");
  });

  it("keeps rollback preview confirmation out of the main conversation", () => {
    const completed = createTaskExecutionSucceededState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "first request"
        })
      ),
      {
        resultTitle: "Done",
        resultSummary: "First request completed."
      }
    );
    const previewed = requestRollbackPreviewState(completed, "startup-baseline");

    render(<MainConversation state={previewed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.queryByText("等待确认回退")).not.toBeInTheDocument();
    expect(screen.queryByText(/准备回退到 启动基线/)).not.toBeInTheDocument();
  });

  it("keeps task cancellation recovery concise in the main conversation", () => {
    const cancelled = createTaskExecutionCancelledState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "run a long local diagnostic",
          executionKind: "workspace-project-run",
          executionTitle: "Run workspace project",
          executionAuditSummary: "Local assistant planned a workspace project run.",
          executionAuditDetail: "Workspace project run task."
        })
      )
    );

    render(<MainConversation state={cancelled} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText("本地任务已停止")).toBeInTheDocument();
    expect(screen.getByText("任务已停止，未继续执行。可以改写请求、缩小范围，或确认后重新提交。")).toBeInTheDocument();
    expect(screen.getByText("停止记录已保留在日志和回退记录中。")).toBeInTheDocument();
    expect(screen.queryByText(/Rewrite the request/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Input summary:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Execution kind:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Recovery visibility:/i)).not.toBeInTheDocument();
  });

  it("keeps retry-limit recovery concise in the main conversation", () => {
    const retryLimited = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "inspect the workspace and keep going",
          executionKind: "workspace-overview",
          executionTitle: "Workspace overview",
          executionAuditSummary: "Local assistant planned a workspace overview task.",
          executionAuditDetail: "Readonly workspace overview task."
        })
      ),
      {
        summary: "Original retry guard summary",
        detail: "Task exceeded the maximum retry limit of 3 attempts.",
        actionLabel: "Original unnormalized retry hint",
        source: "local_task_attempt_guard"
      }
    );

    render(<MainConversation state={retryLimited} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText("本地任务已达到重试上限")).toBeInTheDocument();
    expect(screen.getByText("已停止重复执行，避免死循环。请查看失败详情、改写请求，或先帮助 opencow 修复缺失依赖。")).toBeInTheDocument();
    expect(screen.getByText("重试上限记录已保留在日志和回退记录中。")).toBeInTheDocument();
    expect(screen.queryByText(/Local task retry limit reached/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Repeated execution was stopped/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Task exceeded the maximum retry limit/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Execution kind:/i)).not.toBeInTheDocument();
  });

  it("shows explicit local model generation status while Ollama is still responding", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "开源协议有哪些",
        executionKind: "local-model-chat",
        executionTitle: "本地模型对话",
        executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
        executionAuditDetail: "Local model chat task: 开源协议有哪些"
      })
    );

    render(
      <MainConversation
        state={running}
        onPreviewRollback={vi.fn()}
        onCancelActiveTask={vi.fn()}
      />
    );

    const pending = screen.getByLabelText("assistant-pending");

    expect(pending).toBeInTheDocument();
    expect(within(pending).getByText("正在思考")).toBeInTheDocument();
    expect(within(pending).queryByText(/本地模型首轮响应可能较慢/)).not.toBeInTheDocument();
    expect(pending.querySelector(".task-inline-panel")).toBeNull();
    expect(screen.getAllByText("开源协议有哪些").length).toBeGreaterThan(0);
    expect(within(pending).queryByText("开源协议有哪些")).not.toBeInTheDocument();
    expect(within(pending).queryByText(/不会重复提交同一请求/)).not.toBeInTheDocument();
    expect(within(pending).queryByText(/请稍候/)).not.toBeInTheDocument();
    expect(within(pending).queryByRole("button", { name: "停止任务" })).not.toBeInTheDocument();
  });

  it("keeps conversation history visible while local model generation is pending", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "开源协议有哪些",
        executionKind: "local-model-chat",
        executionTitle: "本地模型对话",
        executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
        executionAuditDetail: "Local model chat task: 开源协议有哪些"
      })
    );
    const progressed = createTaskExecutionProgressState(running, {
      taskId: running.tasks.activeTaskId ?? "",
      progressSummary: "Ollama 仍在生成，已等待约 15 秒。"
    });

    render(
      <MainConversation
        state={progressed}
        onPreviewRollback={vi.fn()}
        onCancelActiveTask={vi.fn()}
      />
    );

    const pending = screen.getByLabelText("assistant-pending");

    expect(within(pending).getByText("正在思考")).toBeInTheDocument();
    expect(within(pending).getByText("正在准备回复…")).toBeInTheDocument();
    expect(within(pending).queryByRole("progressbar", { name: "预计开始回复" })).not.toBeInTheDocument();
    expect(pending.querySelector(".task-inline-panel")).toBeNull();
    expect(screen.getAllByText("开源协议有哪些").length).toBeGreaterThan(0);
  });

  it("keeps the local-model waiting state minimal before the first streamed chunk arrives", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "开源协议有哪些",
        executionKind: "local-model-chat",
        executionTitle: "本地模型对话",
        executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
        executionAuditDetail: "Local model chat task: 开源协议有哪些"
      })
    );
    const progressed = createTaskExecutionProgressState(running, {
      taskId: running.tasks.activeTaskId ?? "",
      progressSummary: "Ollama 已连接，正在等待首轮输出，已等待约 15 秒。"
    });

    render(
      <MainConversation
        state={progressed}
        onPreviewRollback={vi.fn()}
        onCancelActiveTask={vi.fn()}
      />
    );

    const pending = screen.getByLabelText("assistant-pending");

    expect(within(pending).getByText("正在思考")).toBeInTheDocument();
    expect(within(pending).getByText("正在准备回复…")).toBeInTheDocument();
    expect(within(pending).queryByRole("progressbar", { name: "预计开始回复" })).not.toBeInTheDocument();
    expect(within(pending).queryByText("Ollama 已连接，正在等待首轮输出，已等待约 15 秒。")).not.toBeInTheDocument();
  });

  it("switches from the estimated reply progress bar to streaming content after the first chunk", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "解释一下享元模式",
        executionKind: "local-model-chat",
        executionTitle: "本地模型对话",
        executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
        executionAuditDetail: "Local model chat task: 解释一下享元模式"
      })
    );
    const progressed = createTaskExecutionProgressState(running, {
      taskId: running.tasks.activeTaskId ?? "",
      progressSummary: "Ollama 已连接，正在等待首轮输出，已等待约 15 秒。"
    });
    const streamed = createTaskExecutionStreamingChunkState(progressed, {
      taskId: progressed.tasks.activeTaskId ?? "",
      chunk: "第一段回答。"
    });

    render(
      <MainConversation
        state={streamed}
        onPreviewRollback={vi.fn()}
        onCancelActiveTask={vi.fn()}
      />
    );

    const pending = screen.getByLabelText("assistant-pending");

    expect(within(pending).getByText("第一段回答。")).toBeInTheDocument();
    expect(within(pending).queryByRole("progressbar", { name: "预计开始回复" })).not.toBeInTheDocument();
  });

  it("shows NPC config generation as a local-model pending task with heartbeat text", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "你能帮我创建一个课程助手npc吗",
        executionKind: "npc-config-write",
        executionTitle: "大模型生成并保存 NPC 配置",
        executionAuditSummary: "Local assistant planned an LLM-generated NPC configuration write.",
        executionAuditDetail: "LLM-generated NPC configuration write task: 你能帮我创建一个课程助手npc吗"
      })
    );
    const progressed = createTaskExecutionProgressState(running, {
      taskId: running.tasks.activeTaskId ?? "",
      progressSummary: "Ollama 已连接，正在等待首轮输出，已等待约 15 秒。"
    });

    render(
      <MainConversation
        state={progressed}
        onPreviewRollback={vi.fn()}
        onCancelActiveTask={vi.fn()}
      />
    );

    const pending = screen.getByLabelText("assistant-pending");

    expect(within(pending).getByText("正在思考")).toBeInTheDocument();
    expect(within(pending).getByText("正在准备回复…")).toBeInTheDocument();
    expect(within(pending).queryByRole("progressbar", { name: "预计开始回复" })).not.toBeInTheDocument();
    expect(screen.getAllByText("你能帮我创建一个课程助手npc吗").length).toBeGreaterThan(0);
  });

  it("preserves previous and current conversation context while a local model chat is pending", () => {
    const completed = createTaskExecutionSucceededState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "上一轮问题",
          executionKind: "local-model-chat",
          executionTitle: "本地模型对话",
          executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
          executionAuditDetail: "Local model chat task: 上一轮问题"
        })
      ),
      {
        resultTitle: "上一轮回答",
        resultSummary: "上一轮已经完成。"
      }
    );
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(completed, {
        message: "你能做什么",
        executionKind: "local-model-chat",
        executionTitle: "本地模型对话",
        executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
        executionAuditDetail: "Local model chat task: 你能做什么"
      })
    );

    render(
      <MainConversation
        state={running}
        onPreviewRollback={vi.fn()}
        onCancelActiveTask={vi.fn()}
      />
    );

    const conversation = screen.getByLabelText("会话");
    const pending = screen.getByLabelText("assistant-pending");

    expect(within(pending).getByText("正在思考")).toBeInTheDocument();
    expect(within(pending).queryByText(/本地模型首轮响应可能较慢/)).not.toBeInTheDocument();
    expect(pending.querySelector(".task-inline-panel")).toBeNull();
    expect(within(conversation).queryByText(/本地模型首轮响应可能较慢/)).not.toBeInTheDocument();
    expect(within(conversation).queryByText("请稍候，界面保持响应中")).not.toBeInTheDocument();
    expect(within(conversation).getAllByText("你能做什么").length).toBeGreaterThan(0);
    expect(within(conversation).getAllByText("上一轮问题").length).toBeGreaterThan(0);
    expect(within(conversation).getByText("上一轮回答")).toBeInTheDocument();
    expect(within(conversation).getByText("上一轮已经完成。")).toBeInTheDocument();
    expect(within(conversation).getByRole("heading", { name: "你能做什么" })).toBeInTheDocument();
    expect(within(conversation).queryByRole("button", { name: "停止任务" })).not.toBeInTheDocument();
  });

  it("collapses very long user input in the conversation until explicitly expanded", () => {
    const longInput = Array.from({ length: 60 }, (_, index) => `第${index + 1}题 这是一段很长的题目正文和选项内容`).join(" ");
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: longInput
    });

    render(<MainConversation state={submitted} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.queryByText(longInput)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "长文本对话" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^第1题 这是一段很长的题目正文和选项内容/ })).toBeInTheDocument();
    expect(document.querySelector(".message-summary-collapsed")).toHaveTextContent(/…$/);

    fireEvent.click(screen.getByRole("button", { name: "展开完整输入" }));

    expect(screen.getByText(longInput)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起输入" })).toBeInTheDocument();
  });

  it("strips code-closing punctuation from generated long input titles", () => {
    const longInput = [
      "}; 修复代码问题：这段输入前面带有 C++ 类闭合符号，但标题应该使用真正的任务文字。",
      ...Array.from({ length: 16 }, (_, index) => `补充上下文 ${index + 1}：请检查边界条件和返回格式。`)
    ].join("\n");
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: longInput
    });

    render(<MainConversation state={submitted} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.queryByRole("heading", { name: /^};/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^修复代码问题/ })).toBeInTheDocument();
  });

  it("shows auto-compressed older messages without exposing retention copy", () => {
    let state = createInitialWorkbenchState();

    for (let index = 0; index < 64; index += 1) {
      state = createUserTaskSubmittedState(state, {
        message: index === 0
          ? "工作区根目录修复上下文"
          : `持续对话消息 ${index}`
      });
    }

    render(<MainConversation state={state} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText("较早消息摘要")).toBeInTheDocument();
    expect(screen.getByText(/工作区根目录修复上下文/)).toBeInTheDocument();
    expect(screen.queryByText(/保留/)).not.toBeInTheDocument();
  });

  it("aligns user messages to the right while assistant replies stay on the left", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "开源协议有哪些"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "模型答复",
      resultSummary: "常见开源协议包括 MIT、Apache-2.0、GPL、LGPL、BSD 等。"
    });
    const { container } = render(
      <MainConversation state={completed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />
    );
    const userRow = container.querySelector(".message-row.user-row");
    const assistantRow = container.querySelector(".message-row.assistant-row");

    expect(userRow).not.toBeNull();
    expect(userRow).toHaveClass("message-row-user-bubble");
    expect(userRow?.querySelector(".message-avatar")).not.toBeInTheDocument();
    expect(userRow?.querySelector(".message-title")).not.toBeInTheDocument();
    expect(userRow?.querySelector(".message-body")).toHaveClass("user-message-bubble");
    expect(assistantRow).not.toBeNull();
    expect(assistantRow).not.toHaveClass("message-row-user-bubble");
    expect(assistantRow?.querySelector(".message-avatar")).toBeInTheDocument();
  });

  it("keeps long user bubbles in the compact bubble layout instead of stretching the whole row", () => {
    const longInput = "averylongtokenwithoutspaces".repeat(40);
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: longInput
    });
    const { container } = render(
      <MainConversation state={submitted} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />
    );

    const userBubble = container.querySelector(".user-message-bubble");
    const collapsedSummary = container.querySelector(".message-summary-collapsed");

    expect(userBubble).not.toBeNull();
    expect(userBubble).toBeInTheDocument();
    expect(collapsedSummary).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开完整输入" })).toBeInTheDocument();
  });

  it("keeps local model audit diagnostics out of the default main conversation", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "开源协议有哪些",
      executionKind: "local-model-chat",
      executionTitle: "本地模型对话",
      executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
      executionAuditDetail: "Local model chat task: 开源协议有哪些"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "本地模型答复",
      resultSummary: "开源协议包括 Apache、MIT、GPL、LGPL、BSD 以及 MPL 等常见类型。",
      auditDetailLines: [
        "Ollama model: qwen3.6:35b",
        "Ollama done reason: stop",
        "Search context items: 0/3",
        "Search context status: disabled",
        "Search provider: none"
      ]
    });

    render(<MainConversation state={completed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText(/Apache、MIT、GPL/)).toBeInTheDocument();
    expect(screen.queryByText(/Ollama model:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ollama done reason:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Search context items:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Search context status:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Search provider:/i)).not.toBeInTheDocument();
  });

  it("collapses knowledge details behind a compact toggle and localizes knowledge metadata", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "检索知识库规则"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "本地 RAG 说明",
      resultSummary: "本地知识库返回了匹配内容。",
      auditDetailLines: [
        "Knowledge library: 默认知识库",
        "Knowledge library sources: 暂无匹配来源",
        "Indexed documents: 0",
        "命中卡片：来源文件=rules.md；匹配分数=42；片段预览=Shell 执行必须经过权限确认。；回查指令=只看 rules.md；事实片段=Shell 执行必须经过权限确认。｜默认只允许安全范围内操作。"
      ]
    });

    render(<MainConversation state={completed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByRole("button", { name: "展开信息引用" })).toBeInTheDocument();
    expect(screen.getByText("1 条信息引用")).toBeInTheDocument();
    expect(screen.queryByText(/Knowledge library:/)).not.toBeInTheDocument();
    expect(screen.queryByText("知识库：默认知识库")).not.toBeInTheDocument();
    expect(screen.queryByText("rules.md")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开信息引用" }));

    expect(screen.getByRole("button", { name: "收起信息引用" })).toBeInTheDocument();
    expect(screen.getByText("知识库：默认知识库")).toBeInTheDocument();
    expect(screen.getByText("知识库来源：暂无匹配来源")).toBeInTheDocument();
    expect(screen.getByText("已索引文档：0")).toBeInTheDocument();
    expect(screen.getByText("来源文件：rules.md")).toBeInTheDocument();
    expect(screen.getByText("匹配分数：42")).toBeInTheDocument();
    expect(screen.getByText("Shell 执行必须经过权限确认。")).toBeInTheDocument();
    expect(screen.getByText("默认只允许安全范围内操作。")).toBeInTheDocument();
  });

  it("collapses network-search references behind the same compact info toggle", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "帮我上网搜索豆包"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "联网搜索结果",
      resultSummary: "已通过 OpenCow 默认搜索 返回 2 条来源。",
      searchSources: [
        {
          title: "豆包",
          url: "https://www.doubao.com/",
          provider: "豆包官网",
          sourceLabel: "豆包官网",
          query: "帮我上网搜索豆包",
          summary: "豆包是字节跳动推出的 AI 助手产品。",
          factSnippets: ["豆包提供智能问答能力。", "豆包支持写作辅助。"]
        },
        {
          title: "豆包帮助中心",
          url: "https://www.doubao.com/help",
          provider: "豆包帮助中心",
          sourceLabel: "豆包帮助中心",
          query: "帮我上网搜索豆包",
          summary: "包含产品使用与常见问题说明。"
        }
      ]
    });

    render(<MainConversation state={completed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByRole("button", { name: "展开信息引用" })).toBeInTheDocument();
    expect(screen.getByText("2 条信息引用")).toBeInTheDocument();
    expect(screen.queryByText("https://www.doubao.com/")).not.toBeInTheDocument();
    expect(screen.queryByText("豆包是字节跳动推出的 AI 助手产品。")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开信息引用" }));

    expect(screen.getByRole("button", { name: "打开条目：豆包" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开来源：豆包官网" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开来源：豆包帮助中心" })).toBeInTheDocument();
    expect(screen.queryByText("https://www.doubao.com/")).not.toBeInTheDocument();
    expect(screen.getByText("豆包提供智能问答能力。")).toBeInTheDocument();
    expect(screen.getByText("豆包支持写作辅助。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开条目：豆包帮助中心" })).toBeInTheDocument();
    expect(screen.getByText("包含产品使用与常见问题说明。")).toBeInTheDocument();
    expect(screen.queryByText("原文链接")).not.toBeInTheDocument();
  });

  it("keeps malformed long-query search reference lines collapsed as information references", () => {
    const longCodeQuery = [
      "class Solution {",
      "public:",
      "  void merge(vector<int>& nums1, int m, vector<int>& nums2, int n) {",
      "    for (int i=0;int j=0;j<n){",
      "      if(nums1[i]>nums2[j]){",
      "        int temp=nums1[i];",
      "      }",
      "    }",
      "  }",
      "}",
      "SOURCE_QUERY_SENTINEL_SHOULD_STAY_COLLAPSED"
    ].join("\n");
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "检查这段 merge 代码"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "本地模型答复",
      resultSummary: "这个 merge 实现有边界问题。",
      auditDetailLines: [
        `搜索来源：标题=十大经典排序算法整理汇总(附代码)_知乎；来源=知乎；查询=${longCodeQuery}`
      ]
    });

    render(<MainConversation state={completed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByRole("button", { name: "展开信息引用" })).toBeInTheDocument();
    expect(screen.getByText("1 条信息引用")).toBeInTheDocument();
    expect(screen.queryByText(/搜索来源：标题=/)).not.toBeInTheDocument();
    expect(screen.queryByText(/SOURCE_QUERY_SENTINEL_SHOULD_STAY_COLLAPSED/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开信息引用" }));

    expect(screen.getByText("联网搜索来源")).toBeInTheDocument();
    expect(screen.getByText("十大经典排序算法整理汇总(附代码)_知乎")).toBeInTheDocument();
    expect(screen.getByText((content) => content.startsWith("查询：class Solution { public: void merge"))).toBeInTheDocument();
    expect(screen.queryByText(/SOURCE_QUERY_SENTINEL_SHOULD_STAY_COLLAPSED/)).not.toBeInTheDocument();
  });

  it("filters low-value or html-like reference snippets from visible citations", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "帮我搜索 GLM 最新模型"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "联网搜索结果",
      resultSummary: "已通过 OpenCow 默认搜索 返回 1 条来源。",
      searchSources: [
        {
          title: "GLM-5.2 正式发布",
          url: "https://www.bigmodel.cn/dev/news/glm-5-2-release",
          provider: "智谱开放平台",
          sourceLabel: "智谱开放平台",
          query: "帮我搜索 GLM 最新模型",
          summary: "GLM-5.2 是智谱发布的新一代模型。",
          factSnippets: [
            "网易首页 快速导航 推荐阅读",
            "<div>window.UID_TARGET = ['0']</div>",
            "GLM-5.2 是智谱发布的新一代模型。"
          ]
        }
      ]
    });

    render(<MainConversation state={completed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "展开信息引用" }));

    expect(screen.getByText("GLM-5.2 是智谱发布的新一代模型。")).toBeInTheDocument();
    expect(screen.queryByText(/网易首页/)).not.toBeInTheDocument();
    expect(screen.queryByText(/UID_TARGET/)).not.toBeInTheDocument();
  });

  it("renders markdown headings, dividers, and table-like rows without leaking raw markdown markers", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "解释 IPv4 和 IPv6 的区别"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "本地模型答复",
      resultSummary: [
        "## IPv4 和 IPv6 的异同点",
        "",
        "下面是详细比较：",
        "",
        "---",
        "",
        "### 主要区别一览表",
        "| 特性 | IPv4 | IPv6 |",
        "| --- | --- | --- |",
        "| 地址长度 | 32位 | 128位 |"
      ].join("\n")
    });

    render(<MainConversation state={completed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText("IPv4 和 IPv6 的异同点")).toBeInTheDocument();
    expect(screen.getByText("主要区别一览表")).toBeInTheDocument();
    expect(screen.getByText("地址长度")).toBeInTheDocument();
    expect(screen.queryByText("## IPv4 和 IPv6 的异同点")).not.toBeInTheDocument();
    expect(screen.queryByText("| 特性 | IPv4 | IPv6 |")).not.toBeInTheDocument();
    expect(document.querySelector(".message-rich-divider")).not.toBeNull();
    expect(document.querySelector(".message-rich-table")).not.toBeNull();
  });

  it("renders fenced code blocks as standalone code blocks without leaking fences", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "修正 merge 实现"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "本地模型答复",
      resultSummary: [
        "正确写法如下：",
        "",
        "```cpp",
        "class Solution {",
        "public:",
        "  void merge(vector<int>& nums1, int m, vector<int>& nums2, int n) {",
        "    int i = m - 1;",
        "  }",
        "};",
        "```",
        "",
        "从后往前合并可以避免覆盖。"
      ].join("\n")
    });

    render(<MainConversation state={completed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    const codeBlock = document.querySelector(".message-code-block");
    expect(codeBlock).not.toBeNull();
    expect(codeBlock).toHaveTextContent("class Solution");
    expect(screen.getByText("cpp")).toBeInTheDocument();
    expect(screen.queryByText("```cpp")).not.toBeInTheDocument();
    expect(screen.queryByText("```")).not.toBeInTheDocument();
    expect(screen.getByText("从后往前合并可以避免覆盖。")).toBeInTheDocument();
  });

  it("opens search references with the system browser in desktop mode", () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {}
    });

    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "帮我搜索 GLM 最新模型"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "联网搜索结果",
      resultSummary: "已通过 OpenCow 默认搜索 返回 1 条来源。",
      searchSources: [
        {
          title: "GLM-5.2 正式发布",
          url: "https://www.bigmodel.cn/dev/news/glm-5-2-release",
          provider: "智谱开放平台",
          sourceLabel: "智谱开放平台",
          query: "帮我搜索 GLM 最新模型",
          summary: "GLM-5.2 是智谱发布的新一代模型。",
          factSnippets: ["GLM-5.2 是智谱发布的新一代模型。"]
        }
      ]
    });

    render(<MainConversation state={completed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "展开信息引用" }));
    fireEvent.click(screen.getByRole("button", { name: "打开来源：智谱开放平台" }));

    expect(invokeMock).toHaveBeenCalledWith("external_link_open", {
      url: "https://www.bigmodel.cn/dev/news/glm-5-2-release"
    });
  });

  it("never shows default-search placeholder copy inside visible references", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "帮我比较 deepseek 和豆包"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "联网搜索结果",
      resultSummary: "已通过 OpenCow 默认搜索 返回 1 条来源。",
      searchSources: [
        {
          title: "全面评测,DeepSeek和豆包,哪个更好用_哔哩哔哩_bilibili",
          url: "https://www.bilibili.com/video/demo",
          provider: "Bilibili",
          sourceLabel: "Bilibili",
          query: "帮我比较 deepseek 和豆包",
          summary: "OpenCow 默认搜索返回了可用网页结果。"
        }
      ]
    });

    render(<MainConversation state={completed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "展开信息引用" }));

    expect(screen.queryByText("OpenCow 默认搜索返回了可用网页结果。")).not.toBeInTheDocument();
  });

  it("renders network references and knowledge references in a unified grouped layout", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "解释 MCP 并参考本地规则"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "本地模型答复",
      resultSummary: "已结合联网来源和知识库命中整理说明。",
      auditDetailLines: [
        "Knowledge library: 默认知识库",
        "Knowledge library sources: rules.md",
        "Indexed documents: 1",
        "命中卡片：来源文件=rules.md；匹配分数=42；片段预览=Shell 执行必须经过权限确认。；回查指令=只看 rules.md"
      ],
      searchSources: [
        {
          title: "MCP overview",
          url: "https://example.com/mcp",
          provider: "Example Docs",
          sourceLabel: "Example Docs",
          query: "解释 MCP 并参考本地规则",
          summary: "MCP 是连接模型与外部能力的协议。",
          factSnippets: ["MCP 用于连接模型与外部工具。"]
        }
      ]
    });

    render(<MainConversation state={completed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "展开信息引用" }));

    expect(screen.getByText("联网搜索来源")).toBeInTheDocument();
    expect(screen.getByText("知识库来源")).toBeInTheDocument();
    expect(screen.getByText("MCP 用于连接模型与外部工具。")).toBeInTheDocument();
    expect(screen.getByText("Shell 执行必须经过权限确认。")).toBeInTheDocument();
  });

  it("does not expose knowledge-priority debug lines in the visible assistant reply", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "解释 MCP 和 CLI 的区别"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "本地模型答复",
      resultSummary: "MCP 是协议，CLI 是命令行界面。",
      auditDetailLines: [
        "Knowledge source priority: network",
        "Knowledge library: 默认知识库"
      ]
    });

    render(<MainConversation state={completed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.queryByText("Knowledge source priority: network")).not.toBeInTheDocument();
    expect(screen.queryByText(/Knowledge source priority:/i)).not.toBeInTheDocument();
  });

  it("renders assistant markdown without exposing raw double asterisks", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "抽象工厂模式是什么"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "本地模型答复",
      resultSummary:
        "**结论：**\n抽象工厂模式是一种**创建型设计模式**。\n\n**简要解析：**\n1. **核心目的**：解耦对象创建。\n2. **结构构成**：\n   * **抽象工厂**：定义创建接口。\n   * **具体工厂**：生成一组产品。\n"
    });

    render(<MainConversation state={completed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.queryByText("**")).not.toBeInTheDocument();
    expect(screen.getByText("结论：")).toBeInTheDocument();
    expect(screen.getByText(/抽象工厂模式是一种/)).toBeInTheDocument();
    expect(screen.getByText("简要解析：")).toBeInTheDocument();
    expect(screen.getByText("核心目的")).toBeInTheDocument();
    expect(screen.getByText("抽象工厂")).toBeInTheDocument();
    expect(screen.getByText("具体工厂")).toBeInTheDocument();
  });

  it("renders inline file names and keys as gray code pills inside assistant content", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "说明这次改了哪些文件"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "本地模型答复",
      resultSummary: "这次主要调整了 `Workbench.tsx`、`App.tsx` 和 `settings.ollama`。"
    });

    render(<MainConversation state={completed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    const inlineCodes = document.querySelectorAll(".message-inline-code");
    expect(inlineCodes.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("Workbench.tsx")).toBeInTheDocument();
    expect(screen.getByText("App.tsx")).toBeInTheDocument();
    expect(screen.getByText("settings.ollama")).toBeInTheDocument();
  });

  it("renders lightweight operation separators for step-like assistant updates", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "继续实现"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "本地模型答复",
      resultSummary: [
        "已读取 2 个文件和已搜索代码",
        "",
        "我已经定位到主链路了，接下来会直接补设置状态和请求透传。",
        "",
        "正在编辑 `Workbench.tsx`"
      ].join("\n")
    });

    render(<MainConversation state={completed} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    const operations = document.querySelectorAll(".message-rich-operation");
    expect(operations).toHaveLength(2);
    expect(operations[0]?.querySelector("svg")).not.toBeNull();
    expect(operations[1]?.querySelector("svg")).not.toBeNull();
    expect(operations[0]).toHaveClass("message-rich-operation-reading");
    expect(operations[1]).toHaveClass("message-rich-operation-editing");
    expect(screen.getByText("已读取 2 个文件和已搜索代码")).toBeInTheDocument();
    expect(screen.getByText("正在编辑")).toBeInTheDocument();
    expect(screen.getByText(/我已经定位到主链路了/)).toBeInTheDocument();
  });
});
