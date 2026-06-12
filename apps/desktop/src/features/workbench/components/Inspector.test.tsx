import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Inspector } from "./Inspector";
import {
  cancelPendingConfirmationState,
  createCapabilityToggleRequestState,
  createCommandPolicyBlockedState,
  createInitialWorkbenchState,
  createOllamaLoadErrorState,
  createRollbackLimitUpdatedState,
  createSearchEnabledState,
  createTaskExecutionCancelledState,
  createTaskExecutionFailedState,
  createTaskExecutionProgressState,
  createTaskExecutionRetriedState,
  createTaskExecutionStartedState,
  createTaskExecutionSucceededState,
  createToolExecutionErrorState,
  createToolExecutionRecoveredState,
  createUserTaskSubmittedState,
  requestPermissionModeChangeState,
  requestRollbackPreviewState
} from "../workbenchState";

function createInspectorProps(state = createInitialWorkbenchState()) {
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
    onSaveSearchProviderConfig: noop
  };
}

function createTwoFailedTasksState() {
  const firstFailed = createTaskExecutionFailedState(
    createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "repair the local rag index"
      })
    ),
    {
      summary: "Local task failed",
      detail: "The local RAG index could not be read.",
      actionLabel: "Inspect the index and retry explicitly.",
      source: "local_task_runner"
    }
  );
  const firstTaskId = firstFailed.tasks.items[0]?.id ?? "";
  const secondQueued = createUserTaskSubmittedState(firstFailed, {
    message: "repair the enabled skills registry"
  });
  const secondFailed = createTaskExecutionFailedState(createTaskExecutionStartedState(secondQueued), {
    summary: "Local task failed",
    detail: "The enabled skills registry could not be parsed.",
    actionLabel: "Inspect the registry and retry explicitly.",
    source: "local_task_runner"
  });
  const secondTaskId = secondFailed.tasks.items.find((item) => item.summary === "repair the enabled skills registry")?.id ?? "";

  return {
    state: secondFailed,
    firstTaskId,
    secondTaskId
  };
}

function renderInspector(state = createInitialWorkbenchState()) {
  return render(<Inspector {...createInspectorProps(state)} />);
}

describe("Inspector", () => {
  it("keeps default inspector to a folded configuration entry without empty output placeholders", () => {
    renderInspector();

    expect(screen.getByLabelText("右侧面板")).toBeInTheDocument();
    expect(screen.getByText("配置与记录")).toBeInTheDocument();
    expect(screen.getByText("来源、日志和回退记录已收纳，配置入口在设置中。")).toBeInTheDocument();
    expect(screen.queryByText("输出")).not.toBeInTheDocument();
    expect(screen.queryByText("暂无产物")).not.toBeInTheDocument();
    expect(screen.queryByText("等待工具执行结果或本地产物摘要。")).not.toBeInTheDocument();
    expect(screen.queryByText("来源")).not.toBeInTheDocument();
    expect(screen.queryByText("日志")).not.toBeInTheDocument();
    expect(screen.queryByText("高级设置")).not.toBeInTheDocument();
    expect(screen.queryByText("回退记录")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开配置与记录" }));

    expect(screen.getByText("来源")).toBeInTheDocument();
    expect(screen.getByText("日志")).toBeInTheDocument();
    expect(screen.queryByText("回退记录")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "展开回退记录" })).not.toBeInTheDocument();
  });

  it("keeps empty permission, confirmation, and error states out of the default inspector", () => {
    renderInspector();

    expect(screen.getByLabelText("右侧面板")).toBeInTheDocument();
    expect(screen.queryByText("当前没有待确认的权限升级")).not.toBeInTheDocument();
    expect(screen.queryByText("当前没有待确认的高风险操作")).not.toBeInTheDocument();
    expect(screen.queryByText("当前没有待确认的能力变更")).not.toBeInTheDocument();
    expect(screen.queryByText("当前没有活动错误")).not.toBeInTheDocument();
  });

  it("keeps empty task and tool placeholders out of the default inspector", () => {
    renderInspector();

    expect(screen.queryByText("本地任务")).not.toBeInTheDocument();
    expect(screen.queryByText("暂无本地任务")).not.toBeInTheDocument();
    expect(screen.queryByText("工具")).not.toBeInTheDocument();
    expect(screen.queryByText("等待本地模型")).not.toBeInTheDocument();
  });

  it("keeps Ollama setup diagnostics folded out of the default inspector", () => {
    const failed = createOllamaLoadErrorState(
      createInitialWorkbenchState(),
      "Ollama startup check failed: connection refused on 127.0.0.1:11434."
    );

    renderInspector(failed);

    expect(screen.queryByText(/connection refused on 127\.0\.0\.1:11434/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ollama_overview/i)).not.toBeInTheDocument();
  });

  it("keeps pending rollback preview visible without duplicating it when records expand", () => {
    const stateWithEntries = createRollbackLimitUpdatedState(createInitialWorkbenchState(), 15);
    const pending = requestRollbackPreviewState(stateWithEntries, "startup-baseline");

    renderInspector(pending);

    expect(screen.getAllByText("目标回退点: 启动基线")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "确认回退" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "展开配置与记录" }));

    expect(screen.getAllByText("目标回退点: 启动基线")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "确认回退" })).toHaveLength(1);
  });

  it("keeps source and runtime metadata collapsed by default", () => {
    const searched = createSearchEnabledState(createInitialWorkbenchState(), {
      provider: "Tavily",
      query: "opencow",
      sourceTitle: "OpenCow docs",
      sourceUrl: "https://example.test/opencow",
      summary: "OpenCow source summary."
    });

    renderInspector(searched);

    expect(screen.queryByText("来源")).not.toBeInTheDocument();
    expect(screen.queryByText("已记录 1 个来源。模型、权限和来源明细按需展开。")).not.toBeInTheDocument();
    expect(screen.queryByText(/搜索提供方: Tavily/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ollama:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/权限: 只读/)).not.toBeInTheDocument();
    expect(screen.queryByText(/OpenCow docs/)).not.toBeInTheDocument();
    expect(screen.queryByText("https://example.test/opencow")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开配置与记录" }));

    expect(screen.getByText("来源")).toBeInTheDocument();
    expect(screen.getByText("已记录 1 个来源。模型、权限和来源明细按需展开。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开来源与状态" }));

    expect(screen.getByText(/搜索提供方: Tavily/)).toBeInTheDocument();
    expect(screen.getByText(/Ollama:/)).toBeInTheDocument();
    expect(screen.getByText(/权限: 只读/)).toBeInTheDocument();
    expect(screen.getByText(/来源标题: OpenCow docs/)).toBeInTheDocument();
    expect(screen.getByText(/来源地址: https:\/\/example\.test\/opencow/)).toBeInTheDocument();
  });

  it("keeps advanced configuration controls collapsed by default", () => {
    renderInspector();

    expect(screen.queryByText("高级设置")).not.toBeInTheDocument();
    expect(screen.queryByText("远程 API 默认关闭")).not.toBeInTheDocument();
    expect(screen.queryByText("联网搜索默认关闭")).not.toBeInTheDocument();
    expect(screen.queryByText(/保留 baseUrl 和 API 接入口/)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "\u8054\u7f51\u641c\u7d22 Provider" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "\u8fdc\u7a0b API Base URL" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("\u8fdc\u7a0b API Key")).not.toBeInTheDocument();
  });

  it("keeps advanced configuration controls out of the right records drawer", () => {
    renderInspector();

    fireEvent.click(screen.getByRole("button", { name: "展开配置与记录" }));

    expect(screen.queryByText("高级设置")).not.toBeInTheDocument();
    expect(screen.queryByText("远程 API 默认关闭")).not.toBeInTheDocument();
    expect(screen.queryByText("联网搜索默认关闭")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "\u8054\u7f51\u641c\u7d22 Provider" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "\u8fdc\u7a0b API Base URL" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("\u8fdc\u7a0b API Key")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "清空会话" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "20 段" })).not.toBeInTheDocument();
  });

  it("keeps audit metadata collapsed in the default inspector view", () => {
    renderInspector();

    expect(screen.queryByText("日志")).not.toBeInTheDocument();
    expect(screen.queryByText("等待本地事件")).not.toBeInTheDocument();
    expect(screen.queryByText(/desktop-bootstrap/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/应用已启动，等待读取本地模型状态/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开配置与记录" }));

    expect(screen.getByText("日志")).toBeInTheDocument();
    expect(screen.getByText("等待本地事件")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));

    expect(screen.getByText(/desktop-bootstrap/i)).toBeInTheDocument();
    expect(screen.getByText(/应用已启动，等待读取本地模型状态/)).toBeInTheDocument();
  });

  it("keeps cancellation recovery output concise by default while logs remain traceable", () => {
    const requested = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "search",
      enabled: true,
      source: "conversation",
      reason: "Allow Tavily search for the current research request.",
      providerLabel: "Tavily"
    });
    const cancelled = cancelPendingConfirmationState(requested);

    renderInspector(cancelled);

    expect(screen.getByText("能力变更已取消")).toBeInTheDocument();
    expect(screen.getByText("当前设置保持不变。详细记录可在日志或回退记录中展开。")).toBeInTheDocument();
    expect(screen.queryByText(/Capability change was cancelled/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Recovery visibility:/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开配置与记录" }));
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));

    expect(screen.getByText(/Recovery visibility: rollback preview is available/i)).toBeInTheDocument();
  });

  it("keeps local task failure output concise by default while logs remain traceable", () => {
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

    renderInspector(failed);

    expect(screen.getAllByText("Local task failed").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Runtime registry repair verification failed after rewrite/i)).toHaveLength(1);
    expect(screen.getByText(/完整失败详情已保留在错误、日志和展开详情中。/)).toBeInTheDocument();
    expect(screen.queryByText(/Failure detail:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Recovery visibility:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Execution kind: opencow-self-repair-preview/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Execution audit detail: Readonly self-repair preview/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开配置与记录" }));
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));

    expect(screen.getByText(/Recovery visibility: rollback preview is available/i)).toBeInTheDocument();
    expect(screen.getByText(/Execution kind: opencow-self-repair-preview/i)).toBeInTheDocument();
    expect(screen.getByText(/Execution audit detail: Readonly self-repair preview/i)).toBeInTheDocument();
  });

  it("surfaces command policy blocked reason by default while logs keep diagnostics", () => {
    const blocked = createCommandPolicyBlockedState(createInitialWorkbenchState(), {
      summary: "Command execution was blocked",
      detail: "Working directory escaped the approved workspace: c:/windows",
      actionLabel: "Check the working directory and permission scope before retrying.",
      source: "command_policy"
    });

    renderInspector(blocked);

    expect(screen.getAllByText("Command execution was blocked").length).toBeGreaterThan(0);
    expect(screen.getByText("命令已被安全策略阻止，详细原因已保留在错误、日志和回退记录中。")).toBeInTheDocument();
    expect(screen.getByText(/Working directory escaped the approved workspace/i)).toBeInTheDocument();
    expect(screen.queryByText(/Working directory escaped the approved workspace: c:\/windows Check the working directory/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开配置与记录" }));
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));

    expect(screen.getAllByText(/Working directory escaped the approved workspace/i).length).toBeGreaterThan(1);
  });

  it("shows the pending permission summary instead of the previous failed task output", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "create a temp-output folder"
        })
      ),
      {
        summary: "本地任务执行失败",
        detail: "Workspace-write command planning failed before permission could be requested.",
        actionLabel: "请检查权限升级链路后重试。",
        source: "local_task_failed_before_permission_request"
      }
    );
    const pending = requestPermissionModeChangeState(failed, {
      targetMode: "workspace-write",
      reason: "need workspace write access",
      riskSummary: "allow edits inside approved workspace only"
    });

    renderInspector(pending);

    expect(screen.getByText("等待权限升级")).toBeInTheDocument();
    expect(screen.getByText("尚未执行提权后的操作，等待你的确认。")).toBeInTheDocument();
    expect(screen.queryByText(/Workspace-write command planning failed before permission could be requested/i)).not.toBeInTheDocument();
  });

  it("localizes visible pending permission copy in the inspector even when planner text is English", () => {
    const pending = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before opencow can ask the selected local model to generate an NPC configuration and save it under .opencow/npcs/.",
      riskSummary: "This task writes only an NPC configuration JSON file inside .opencow/npcs/. The configuration content must be generated by the selected local model after approval; no fixed template answer is used."
    });

    renderInspector(pending);

    expect(screen.getByText("待切换权限: 工作区读写")).toBeInTheDocument();
    expect(screen.getByText(/需要先授予工作区读写权限/)).toBeInTheDocument();
    expect(screen.getByText(/并不会套用固定模板回答/)).toBeInTheDocument();
    expect(screen.queryByText(/Workspace write permission is required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/This task writes only an NPC configuration JSON file/i)).not.toBeInTheDocument();
  });

  it("keeps long pending approval text concise in the right inspector", () => {
    const longReason =
      Array.from({ length: 40 }, (_, index) => `第${index + 1}段 权限确认原因需要保留但不应默认铺满右侧`).join(" ")
      + " FULL_PENDING_REASON_SENTINEL";
    const longRisk =
      Array.from({ length: 35 }, (_, index) => `风险说明${index + 1} 只允许工作区内写入`).join(" ")
      + " FULL_PENDING_RISK_SENTINEL";
    const pending = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: longReason,
      riskSummary: longRisk
    });

    renderInspector(pending);

    expect(screen.getByText("等待权限升级")).toBeInTheDocument();
    expect(screen.queryByText(longReason)).not.toBeInTheDocument();
    expect(screen.queryByText(longRisk)).not.toBeInTheDocument();
    expect(screen.queryByText(/FULL_PENDING_REASON_SENTINEL/)).not.toBeInTheDocument();
    expect(screen.queryByText(/FULL_PENDING_RISK_SENTINEL/)).not.toBeInTheDocument();
    expect(screen.getByText(/第1段 权限确认原因需要保留但不应默认铺满右侧/)).toHaveTextContent("...");
    expect(screen.getByText(/风险说明1 只允许工作区内写入/)).toHaveTextContent("...");
  });

  it("keeps duplicate local task skip output concise while logs remain traceable", () => {
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

    renderInspector(skipped);

    expect(screen.getByText("重复任务已跳过")).toBeInTheDocument();
    expect(screen.getByText("相同任务已经失败，请先查看失败详情、点击重试本地任务，或改写请求。")).toBeInTheDocument();
    expect(screen.queryByText(/Existing task status:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Execution kind:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Previous failure detail:/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开配置与记录" }));
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));

    expect(screen.getByText(/Existing task status: failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Previous failure detail: Runtime registry repair verification failed after rewrite/i)).toBeInTheDocument();
  });

  it("does not show attempt zero for a queued task that has not started yet", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "inspect workspace safely"
    });

    renderInspector(queued);

    expect(screen.getAllByText("inspect workspace safely").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Attempt 0 \/ 3/i)).not.toBeInTheDocument();
  });

  it("does not offer retry when a failed task already reached the maximum attempt count", () => {
    const firstFailed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "inspect workspace safely"
        })
      ),
      {
        summary: "Local task failed",
        detail: "The first attempt failed.",
        actionLabel: "Try again after inspection.",
        source: "local_task_runner"
      }
    );
    const secondFailed = createTaskExecutionFailedState(createTaskExecutionStartedState(createTaskExecutionRetriedState(firstFailed)), {
      summary: "Local task failed",
      detail: "The second attempt failed.",
      actionLabel: "Try again after inspection.",
      source: "local_task_runner"
    });
    const thirdFailed = createTaskExecutionFailedState(createTaskExecutionStartedState(createTaskExecutionRetriedState(secondFailed)), {
      summary: "Local task failed",
      detail: "The third attempt failed.",
      actionLabel: "Try again after inspection.",
      source: "local_task_runner"
    });

    renderInspector(thirdFailed);

    expect(screen.getAllByText(/Attempt 3 \/ 3/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "重试本地任务" })).not.toBeInTheDocument();
  });

  it("passes the selected failed task id when retrying from the local task list", () => {
    const onRetryLocalTask = vi.fn();
    const { state, firstTaskId } = createTwoFailedTasksState();

    render(<Inspector {...createInspectorProps(state)} onRetryLocalTask={onRetryLocalTask} />);

    const firstTaskSummary = screen.getByText("repair the local rag index");
    const firstTaskItem = firstTaskSummary.closest(".task-queue-item");

    expect(firstTaskItem).not.toBeNull();

    const retryButton = within(firstTaskItem as HTMLElement).getByRole("button", {
      name: "重试本地任务"
    });
    fireEvent.click(retryButton);

    expect(onRetryLocalTask).toHaveBeenCalledWith(firstTaskId);
  });

  it("keeps previous failure diagnostics collapsed for a retried local task", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "repair runtime registry"
        })
      ),
      {
        summary: "Local task failed",
        detail: "Runtime registry repair verification failed after rewrite.",
        actionLabel: "Check .opencow/runtime/workspace-project-runs.json first, then ask opencow to retry.",
        source: "opencow_self_repair_failure_analysis"
      }
    );
    const retried = createTaskExecutionRetriedState(failed);
    const { container } = render(<Inspector {...createInspectorProps(retried)} />);
    const taskItem = container.querySelector(".task-queue-item");

    expect(taskItem).not.toBeNull();
    expect(within(taskItem as HTMLElement).queryByText(
      "Previous failure source: opencow_self_repair_failure_analysis"
    )).not.toBeInTheDocument();
    expect(within(taskItem as HTMLElement).queryByText(
      "Previous failure detail: Runtime registry repair verification failed after rewrite."
    )).not.toBeInTheDocument();
    expect(within(taskItem as HTMLElement).queryByText(
      "Previous failure recovery hint: Check .opencow/runtime/workspace-project-runs.json first, then ask opencow to retry."
    )).not.toBeInTheDocument();

    fireEvent.click(within(taskItem as HTMLElement).getByRole("button", { name: "展开失败细节" }));

    expect(within(taskItem as HTMLElement).getByText(
      "来源：opencow_self_repair_failure_analysis"
    )).toBeInTheDocument();
    expect(within(taskItem as HTMLElement).getByText(
      "详情：Runtime registry repair verification failed after rewrite."
    )).toBeInTheDocument();
    expect(within(taskItem as HTMLElement).getByText(
      "建议：Check .opencow/runtime/workspace-project-runs.json first, then ask opencow to retry."
    )).toBeInTheDocument();
  });

  it("shows a single resumed task item after approval continuation instead of keeping a duplicate failed copy", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "create a temp-output folder for this workspace"
        })
      ),
      {
        summary: "Local task failed",
        detail: "Workspace-write command planning failed before permission could be requested.",
        actionLabel: "Inspect the approval continuation chain and retry explicitly.",
        source: "local_task_runner"
      }
    );
    const resumed = createUserTaskSubmittedState(failed, {
      message: "create a temp-output folder for this workspace",
      executionKind: "workspace-write-create-temp-output",
      executionTitle: "Create temp-output directory",
      executionAuditSummary: "Local assistant resumed the queued workspace-write temp-output task after approval.",
      executionAuditDetail: "Workspace-write shell command task: create temp-output directory",
      allowResumeFromFailedTask: true,
      preserveExistingUserMessage: true
    });

    const { container } = render(<Inspector {...createInspectorProps(resumed)} />);
    const matchingItems = Array.from(container.querySelectorAll(".task-queue-item")).filter((item) =>
      item.textContent?.includes("create a temp-output folder for this workspace")
    );

    expect(matchingItems).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "重试本地任务" })).not.toBeInTheDocument();
  });

  it("does not keep old failure details on a task item after an approved continuation succeeds", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "create a temp-output folder for this workspace"
        })
      ),
      {
        summary: "Local task failed",
        detail: "Workspace-write command planning failed before permission could be requested.",
        actionLabel: "Inspect the approval continuation chain and retry explicitly.",
        source: "local_task_runner"
      }
    );
    const resumed = createUserTaskSubmittedState(failed, {
      message: "create a temp-output folder for this workspace",
      executionKind: "workspace-write-create-temp-output",
      executionTitle: "Create temp-output directory",
      executionAuditSummary: "Local assistant resumed the queued workspace-write temp-output task after approval.",
      executionAuditDetail: "Workspace-write shell command task: create temp-output directory",
      allowResumeFromFailedTask: true,
      preserveExistingUserMessage: true
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(resumed), {
      resultTitle: "Create temp-output directory",
      resultSummary: "已创建 temp-output 目录。"
    });

    renderInspector(completed);

    expect(screen.queryByRole("button", { name: "展开失败细节" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试本地任务" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Workspace-write command planning failed before permission could be requested/i)).not.toBeInTheDocument();
  });

  it("routes tool error recovery actions through the inspector callback", () => {
    const onRecoverToolError = vi.fn();
    const failed = createToolExecutionErrorState(createInitialWorkbenchState(), {
      toolLabel: "RAG document parser",
      summary: "Document parsing failed",
      detail: "The selected PPTX could not be parsed.",
      actionLabel: "Try a smaller file or inspect the source document.",
      source: "rag_document_parser"
    });

    render(<Inspector {...createInspectorProps(failed)} onRecoverToolError={onRecoverToolError} />);

    fireEvent.click(screen.getByRole("button", {
      name: "Try a smaller file or inspect the source document."
    }));

    expect(onRecoverToolError).toHaveBeenCalledTimes(1);
  });

  it("keeps tool error details concise by default while logs remain traceable", () => {
    const failed = createToolExecutionErrorState(createInitialWorkbenchState(), {
      toolLabel: "RAG document parser",
      summary: "Document parsing failed",
      detail: "The selected PPTX could not be parsed. TOOL_ERROR_DETAIL_SENTINEL: parser stack, slide id, file path, and retry trace are kept for audit.",
      actionLabel: "Try a smaller file or inspect the source document.",
      source: "rag_document_parser"
    });

    renderInspector(failed);

    expect(screen.getAllByText("Document parsing failed").length).toBeGreaterThan(0);
    expect(screen.getByText("完整工具错误详情已保留在日志、错误详情和回退记录中。")).toBeInTheDocument();
    expect(screen.queryByText(/TOOL_ERROR_DETAIL_SENTINEL/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开配置与记录" }));
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));

    expect(screen.getByText(/TOOL_ERROR_DETAIL_SENTINEL/i)).toBeInTheDocument();
  });

  it("keeps recovered tool error output concise while logs retain recovery details", () => {
    const failed = createToolExecutionErrorState(createInitialWorkbenchState(), {
      toolLabel: "RAG document parser",
      summary: "Document parsing failed",
      detail: "The selected PPTX could not be parsed. TOOL_RECOVERED_DETAIL_SENTINEL.",
      actionLabel: "Try a smaller file or inspect the source document. TOOL_RECOVERED_HINT_SENTINEL.",
      source: "rag_document_parser"
    });
    const recovered = createToolExecutionRecoveredState(failed);

    renderInspector(recovered);

    expect(screen.getByText("工具错误已处理")).toBeInTheDocument();
    expect(screen.getByText(/完整恢复建议已保留在日志和展开详情中/)).toBeInTheDocument();
    expect(screen.queryByText(/TOOL_RECOVERED_DETAIL_SENTINEL/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/TOOL_RECOVERED_HINT_SENTINEL/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开配置与记录" }));
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));

    expect(screen.getByText(/TOOL_RECOVERED_DETAIL_SENTINEL/i)).toBeInTheDocument();
    expect(screen.getByText(/TOOL_RECOVERED_HINT_SENTINEL/i)).toBeInTheDocument();
  });

  it("does not repeat very long user input in the right task queue", () => {
    const longInput = Array.from({ length: 60 }, (_, index) => `第${index + 1}题 这是一段很长的题目正文和选项内容`).join(" ");
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: longInput
    });

    renderInspector(submitted);

    expect(screen.getByText("本地任务")).toBeInTheDocument();
    expect(screen.queryByText(longInput)).not.toBeInTheDocument();
    expect(screen.getByText("等待本地助手处理，不在右侧重复展示长输入。")).toBeInTheDocument();
  });

  it("keeps ordinary local-model chat input out of the quiet right inspector while generating", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "开源协议有哪些",
      executionKind: "local-model-chat",
      executionTitle: "本地模型对话",
      executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
      executionAuditDetail: "Local model chat task: 开源协议有哪些"
    });

    renderInspector(submitted);

    expect(screen.getByLabelText("右侧面板")).toBeInTheDocument();
    expect(screen.queryByText("本地任务")).not.toBeInTheDocument();
    expect(screen.queryByText("开源协议有哪些")).not.toBeInTheDocument();
    expect(screen.queryByText("正在生成")).not.toBeInTheDocument();
    expect(screen.queryByText(/右侧不重复展示/)).not.toBeInTheDocument();
  });

  it("keeps local-model progress heartbeat out of the right output summary", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "开源协议有哪些",
      executionKind: "local-model-chat",
      executionTitle: "本地模型对话",
      executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
      executionAuditDetail: "Local model chat task: 开源协议有哪些"
    });
    const running = createTaskExecutionStartedState(submitted);
    const activeTaskId = running.tasks.activeTaskId ?? "";
    const progressed = createTaskExecutionProgressState(running, {
      taskId: activeTaskId,
      progressSummary: "Ollama 仍在生成，已等待约 15 秒。"
    });

    renderInspector(progressed);

    expect(screen.getByLabelText("右侧面板")).toBeInTheDocument();
    expect(screen.queryByText("输出")).not.toBeInTheDocument();
    expect(screen.queryByText(/Ollama 仍在生成/)).not.toBeInTheDocument();
    expect(screen.queryByText("正在生成")).not.toBeInTheDocument();
  });

  it("keeps NPC config generation heartbeat out of the right output summary", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "你能帮我创建一个课程助手npc吗",
      executionKind: "npc-config-write",
      executionTitle: "大模型生成并保存 NPC 配置",
      executionAuditSummary: "Local assistant planned an LLM-generated NPC configuration write.",
      executionAuditDetail: "LLM-generated NPC configuration write task: 你能帮我创建一个课程助手npc吗"
    });
    const running = createTaskExecutionStartedState(submitted);
    const progressed = createTaskExecutionProgressState(running, {
      taskId: running.tasks.activeTaskId ?? "",
      progressSummary: "Ollama 已连接，正在等待首轮输出，已等待约 15 秒。"
    });

    renderInspector(progressed);

    expect(screen.getByLabelText("右侧面板")).toBeInTheDocument();
    expect(screen.queryByText("输出")).not.toBeInTheDocument();
    expect(screen.queryByText(/Ollama 已连接，正在等待首轮输出/)).not.toBeInTheDocument();
    expect(screen.queryByText("正在生成 NPC 配置")).not.toBeInTheDocument();
  });

  it("keeps the right inspector visually quiet while local model chat is generating", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "你能做什么",
        executionKind: "local-model-chat",
        executionTitle: "本地模型对话",
        executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
        executionAuditDetail: "Local model chat task: 你能做什么"
      })
    );

    renderInspector(running);

    expect(screen.getByLabelText("右侧面板")).toBeInTheDocument();
    expect(screen.queryByText("配置与记录")).not.toBeInTheDocument();
    expect(screen.queryByText("来源、日志和回退记录已收纳，配置入口在设置中。")).not.toBeInTheDocument();
    expect(screen.queryByText("本地任务")).not.toBeInTheDocument();
    expect(screen.queryByText("待处理 1 条")).not.toBeInTheDocument();
    expect(screen.queryByText("正在生成")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "停止任务" })).not.toBeInTheDocument();
  });

  it("keeps the right inspector visually quiet while NPC config generation is pending", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "你能帮我创建一个课程助手npc吗",
        executionKind: "npc-config-write",
        executionTitle: "大模型生成并保存 NPC 配置",
        executionAuditSummary: "Local assistant planned an LLM-generated NPC configuration write.",
        executionAuditDetail: "LLM-generated NPC configuration write task: 你能帮我创建一个课程助手npc吗"
      })
    );

    renderInspector(running);

    expect(screen.getByLabelText("右侧面板")).toBeInTheDocument();
    expect(screen.queryByText("配置与记录")).not.toBeInTheDocument();
    expect(screen.queryByText("本地任务")).not.toBeInTheDocument();
    expect(screen.queryByText("你能帮我创建一个课程助手npc吗")).not.toBeInTheDocument();
    expect(screen.queryByText("正在生成 NPC 配置")).not.toBeInTheDocument();
  });

  it("shows retried failure diagnostics with concise Chinese labels instead of raw previous-failure fields", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "repair runtime registry"
        })
      ),
      {
        summary: "本地模型对话失败",
        detail: "Local task exceeded the maximum execution time of 480 seconds.",
        actionLabel: "请检查 Ollama 是否正在运行、本地模型是否已拉取并已选中；如果仍失败，请重新检测 Ollama 或切换模型后重试。",
        source: "local_model_chat_runner"
      }
    );
    const retried = createTaskExecutionRetriedState(failed);

    renderInspector(retried);

    fireEvent.click(screen.getByRole("button", { name: "展开失败细节" }));

    expect(screen.getByText("来源：local_model_chat_runner")).toBeInTheDocument();
    expect(screen.getByText("摘要：本地模型对话失败")).toBeInTheDocument();
    expect(screen.getByText("详情：Local task exceeded the maximum execution time of 480 seconds.")).toBeInTheDocument();
    expect(screen.getByText(/建议：本地模型响应超时/)).toBeInTheDocument();
    expect(screen.queryByText(/Previous failure source:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Previous failure detail:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Previous failure recovery hint:/i)).not.toBeInTheDocument();
  });

  it("keeps cancelled task recovery concise in the default right error area", () => {
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

    renderInspector(cancelled);

    expect(screen.getAllByText("本地任务已停止").length).toBeGreaterThan(0);
    expect(screen.getByText("任务已停止，未继续执行。可以改写请求、缩小范围，或确认后重新提交。")).toBeInTheDocument();
    expect(screen.getByText("停止记录已保留在日志和回退记录中。")).toBeInTheDocument();
    expect(screen.queryByText(/Rewrite the request/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Input summary:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Execution kind:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Recovery visibility:/i)).not.toBeInTheDocument();
  });

  it("keeps retry-limit recovery concise in the default right error area", () => {
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

    renderInspector(retryLimited);

    expect(screen.getAllByText("本地任务已达到重试上限").length).toBeGreaterThan(0);
    expect(screen.getByText("已停止重复执行，避免死循环。请查看失败详情、改写请求，或先帮助 opencow 修复缺失依赖。")).toBeInTheDocument();
    expect(screen.getByText("重试上限记录已保留在日志和回退记录中。")).toBeInTheDocument();
    expect(screen.queryByText(/Local task retry limit reached/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Repeated execution was stopped/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Task exceeded the maximum retry limit/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开配置与记录" }));
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));

    expect(screen.getByText(/Task exceeded the maximum retry limit of 3 attempts/i)).toBeInTheDocument();
  });

  it("keeps local model raw diagnostics available in expanded task details", () => {
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
          "Local task exceeded the maximum execution time of 480 seconds. Local model chat diagnostics: model=qwen3.6:35b; timeout=480s; inputLength=7; streamPhase=waiting-first-chunk; elapsedMs=480000; firstChunkAfterMs=none; longAnswerProtection=enabled.",
        actionLabel: "inspect assistantTaskService result mapping for local-model-chat before retrying.",
        source: "local_model_chat_runner"
      }
    );

    renderInspector(failed);

    expect(screen.queryByText(/Local model chat diagnostics: model=qwen3\.6:35b/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(
      "本地模型本轮没有按时返回完整结果，详细诊断已保留在本地任务失败细节和日志中。"
    ).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "展开失败细节" }));

    expect(screen.getByText("摘要：本地模型对话失败")).toBeInTheDocument();
    expect(screen.getByText(/建议：本地模型首轮输出超时/)).toBeInTheDocument();
    expect(screen.queryByText(/结果映射/)).not.toBeInTheDocument();
    expect(screen.getByText(/Local model chat diagnostics: model=qwen3\.6:35b/i)).toBeInTheDocument();
    expect(screen.getByText(/timeout=480s/i)).toBeInTheDocument();
    expect(screen.getByText(/inputLength=7/i)).toBeInTheDocument();
  });

  it("points NPC config first-token failures toward a readonly draft before retrying writes", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "你能帮我创建一个课程助手npc吗",
          executionKind: "npc-config-write",
          executionTitle: "大模型生成并保存 NPC 配置",
          executionAuditSummary: "Local assistant planned an LLM-generated NPC configuration write.",
          executionAuditDetail: "LLM-generated NPC configuration write task: 你能帮我创建一个课程助手npc吗"
        })
      ),
      {
        summary: "NPC 配置生成失败",
        detail:
          "Local task exceeded the maximum execution time of 480 seconds. Local model chat diagnostics: executionKind=npc-config-write; model=qwen3.6:35b; timeout=480s; inputLength=15; streamPhase=waiting-first-chunk; elapsedMs=480000; firstChunkAfterMs=none; longAnswerProtection=enabled.",
        actionLabel: "NPC 配置生成卡在首轮输出前：配置尚未写入。请先把 NPC 职责缩小成一两句话，或改问“先给我课程助手 NPC 的只读草案”，确认方向后再保存；也可以切换更快的本地模型后重试。",
        source: "local_model_chat_runner"
      }
    );

    renderInspector(failed);

    fireEvent.click(screen.getByRole("button", { name: "展开失败细节" }));

    expect(screen.getByText("摘要：NPC 配置生成失败")).toBeInTheDocument();
    expect(screen.getByText(/建议：NPC 配置生成卡在首轮输出前/)).toBeInTheDocument();
    expect(screen.getAllByText(/只读草案/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/配置还没有写入/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/结果映射/)).not.toBeInTheDocument();
  });
});
