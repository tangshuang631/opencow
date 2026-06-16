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
    render(<Workbench {...createWorkbenchProps()} />);

    expect(screen.getByLabelText("会话")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本地助手" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "知识库" }));

    expect(screen.getByRole("heading", { name: "知识库" })).toBeInTheDocument();
    expect(screen.getByText("导入、索引和检索本地长文档，后续会接入 doc、md、pptx 等工作区内容。")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本地助手" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "会话" }));

    expect(screen.getByLabelText("会话")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本地助手" })).not.toBeInTheDocument();
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

  it("returns to the conversation view when a task is submitted from settings", () => {
    const onSubmitTask = vi.fn();

    render(<Workbench {...createWorkbenchProps(createInitialWorkbenchState(), { onSubmitTask })} />);

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();

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

    fireEvent.click(screen.getByRole("button", { name: "新对话" }));
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

    fireEvent.click(screen.getByRole("button", { name: "新对话" }));
    expect(onNewConversation).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("会话")).toBeInTheDocument();
  });
});
