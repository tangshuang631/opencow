import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  createTaskExecutionSucceededState,
  createTaskExecutionStartedState,
  createUserTaskSubmittedState,
  createToolExecutionErrorState,
  requestPermissionModeChangeState
} from "../workbenchState";
import { mergeOllamaOverview } from "../workbenchState";
import { MainConversation } from "./MainConversation";

describe("MainConversation", () => {
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

    expect(screen.getByText("已跳过重复审批请求")).toBeInTheDocument();
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

  it("surfaces missing search provider repair guidance in the main conversation", () => {
    const searchEnabled = createSearchToggleState(createInitialWorkbenchState(), {
      enabled: true,
      providerLabel: "Tavily"
    });
    const missingProvider = createSearchProviderConfigState(searchEnabled, {
      providerLabel: " "
    });

    render(<MainConversation state={missingProvider} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByText(/Search provider is not configured/i)).toBeInTheDocument();
    expect(screen.getByText(/Configure a search provider/i)).toBeInTheDocument();
    expect(screen.getByText(/Provider status: not configured/i)).toBeInTheDocument();
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

    expect(onPreviewRollback).toHaveBeenCalledWith("startup-baseline");
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
    const firstCompletedRollbackId = firstCompleted.rollback.entries[0]?.id;
    const secondSubmitted = createUserTaskSubmittedState(firstCompleted, {
      message: "second local request"
    });
    const onPreviewRollback = vi.fn();

    render(<MainConversation state={secondSubmitted} onPreviewRollback={onPreviewRollback} onCancelActiveTask={vi.fn()} />);

    const rollbackButtons = screen.getAllByRole("button", { name: "回退到这条消息之前" });
    expect(rollbackButtons).toHaveLength(2);
    fireEvent.click(rollbackButtons[1]);

    expect(firstCompletedRollbackId).toBeDefined();
    expect(onPreviewRollback).toHaveBeenCalledWith(firstCompletedRollbackId);
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

    expect(onPreviewRollback).toHaveBeenCalledWith("startup-baseline");
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
    expect(within(pending).getByText("Ollama 正在生成")).toBeInTheDocument();
    expect(within(pending).getByText(/本地模型首轮响应可能较慢/)).toBeInTheDocument();
    expect(pending.querySelector(".task-inline-panel")).toBeNull();
    expect(screen.queryByText("开源协议有哪些")).not.toBeInTheDocument();
    expect(within(pending).queryByText(/不会重复提交同一请求/)).not.toBeInTheDocument();
    expect(within(pending).queryByText(/请稍候/)).not.toBeInTheDocument();
    expect(within(pending).queryByRole("button", { name: "停止任务" })).not.toBeInTheDocument();
  });

  it("keeps local model generation progress out of the main conversation chrome", () => {
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

    expect(within(pending).getByText("Ollama 正在生成")).toBeInTheDocument();
    expect(within(pending).getByText("Ollama 仍在生成，已等待约 15 秒。")).toBeInTheDocument();
    expect(pending.querySelector(".task-inline-panel")).toBeNull();
    expect(screen.queryByText("开源协议有哪些")).not.toBeInTheDocument();
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

    expect(within(pending).getByText("Ollama 正在生成 NPC 配置")).toBeInTheDocument();
    expect(within(pending).getByText("Ollama 已连接，正在等待首轮输出，已等待约 15 秒。")).toBeInTheDocument();
    expect(screen.queryByText("你能帮我创建一个课程助手npc吗")).not.toBeInTheDocument();
  });

  it("shows only the compact Ollama generation title while a local model chat is pending", () => {
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

    expect(within(pending).getByText("Ollama 正在生成")).toBeInTheDocument();
    expect(within(pending).getByText(/本地模型首轮响应可能较慢/)).toBeInTheDocument();
    expect(pending.querySelector(".task-inline-panel")).toBeNull();
    expect(within(conversation).getByText(/本地模型首轮响应可能较慢/)).toBeInTheDocument();
    expect(within(conversation).queryByText("请稍候，界面保持响应中")).not.toBeInTheDocument();
    expect(within(conversation).queryByText("你能做什么")).not.toBeInTheDocument();
    expect(within(conversation).queryByText("上一轮问题")).not.toBeInTheDocument();
    expect(within(conversation).queryByText("上一轮回答")).not.toBeInTheDocument();
    expect(within(conversation).queryByText("上一轮已经完成。")).not.toBeInTheDocument();
    expect(within(conversation).queryByRole("heading")).not.toBeInTheDocument();
    expect(within(conversation).queryByRole("button", { name: "停止任务" })).not.toBeInTheDocument();
  });

  it("collapses very long user input in the conversation until explicitly expanded", () => {
    const longInput = Array.from({ length: 60 }, (_, index) => `第${index + 1}题 这是一段很长的题目正文和选项内容`).join(" ");
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: longInput
    });

    render(<MainConversation state={submitted} onPreviewRollback={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.queryByText(longInput)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "长文本对话" })).toBeInTheDocument();
    expect(screen.getAllByText(/^第1题 这是一段很长的题目正文和选项内容/)).toHaveLength(1);
    expect(screen.getAllByText(/…$/)).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "展开完整输入" }));

    expect(screen.getByText(longInput)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起输入" })).toBeInTheDocument();
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
});
