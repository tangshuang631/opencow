import { describe, expect, it } from "vitest";
import {
  createInitialWorkbenchState,
  createTaskMissingExecutionKindFailedState,
  createTaskExecutionCancelledState,
  createTaskExecutionFailedState,
  createTaskExecutionProgressState,
  createTaskExecutionRetriedState,
  createTaskExecutionStartedState,
  createTaskExecutionStreamingChunkState,
  createTaskExecutionSucceededState,
  createAssistantPlanningFailedState,
  createDuplicatePlanningFailureSkippedState,
  createStaleActiveTaskSlotRecoveredState,
  createUserTaskSubmittedState
} from "./workbenchState";

describe("task queue state", () => {
  it("starts with an empty local task queue", () => {
    const state = createInitialWorkbenchState();

    expect(state.tasks).toMatchObject({
      pendingCount: 0,
      activeTaskId: null
    });
    expect(state.tasks.items).toEqual([]);
  });

  it("queues a submitted task with attempt count reset to zero", () => {
    const state = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "run the desktop app locally"
    });

    expect(state.tasks.pendingCount).toBe(1);
    expect(state.tasks.activeTaskId).toBeNull();
    expect(state.tasks.items).toHaveLength(1);
    expect(state.tasks.items[0]).toMatchObject({
      status: "queued",
      summary: "run the desktop app locally",
      attemptCount: 0
    });
    expect(state.audit.lastEvent.source).toBe("composer_submit");
    expect(state.rollback.entries[0]?.label.length).toBeGreaterThan(0);
  });

  it("clears the previous task error when a fresh local task is submitted again", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "inspect the workspace"
        })
      ),
      {
        summary: "Local task failed",
        detail: "The readonly workspace inspection failed.",
        actionLabel: "Review the readonly bridge before retrying.",
        source: "local_task_runner"
      }
    );

    expect(failed.error).toMatchObject({
      module: "tasks",
      source: "local_task_runner"
    });

    const resubmitted = createUserTaskSubmittedState(failed, {
      message: "inspect the workspace with a narrower request"
    });

    expect(resubmitted.tasks.items[0]).toMatchObject({
      status: "queued",
      summary: "inspect the workspace with a narrower request",
      attemptCount: 0
    });
    expect(resubmitted.error).toBeNull();
    expect(resubmitted.output.title).toBe("本地任务队列");
    expect(resubmitted.output.summary).toContain("当前有 1 条待处理任务");
  });

  it("keeps duplicate planning failure default output concise while audit keeps diagnostics", () => {
    const failed = createAssistantPlanningFailedState(createInitialWorkbenchState(), {
      message: "inspect repeated planner failure",
      detail: "Planner route table could not resolve the requested local assistant action."
    });
    const skipped = createDuplicatePlanningFailureSkippedState(failed, {
      message: "inspect repeated planner failure"
    });

    expect(skipped.output.title).toBe("重复规划失败已跳过");
    expect(skipped.output.summary).toBe(
      "相同请求刚刚发生规划失败，已跳过重复规划。请查看上一条失败详情、改写请求，或从只读预览重新开始。"
    );
    expect(skipped.output.summary).not.toContain("Input summary:");
    expect(skipped.output.summary).not.toContain("Previous planner failure detail:");
    expect(skipped.output.summary).not.toContain("Recovery visibility:");
    expect(skipped.audit.lastEvent.detail).toContain("Input summary: inspect repeated planner failure");
    expect(skipped.audit.lastEvent.detail).toContain("Previous planner failure detail:");
    expect(skipped.conversation.entries[0]?.detailLines?.join("\n")).toContain("Previous planner failure detail:");
  });

  it("keeps the first planning failure default output concise while audit keeps diagnostics", () => {
    const failed = createAssistantPlanningFailedState(createInitialWorkbenchState(), {
      message: "inspect workspace route failure",
      detail: "Planner route table could not resolve the requested local assistant action."
    });

    expect(failed.output.title).toBe("本地助手规划失败");
    expect(failed.output.summary).toBe("本地助手暂时无法理解这次请求，未排队、未执行任何命令。请改写得更具体，或从只读预览重新开始。");
    expect(failed.output.summary).not.toContain("Input summary:");
    expect(failed.output.summary).not.toContain("Planner failure detail:");
    expect(failed.output.summary).not.toContain("Recovery visibility:");
    expect(failed.conversation.entries[0]).toMatchObject({
      kind: "system",
      title: "本地助手规划失败",
      summary: "本地助手暂时无法理解这次请求，未排队、未执行任何命令。"
    });
    expect(failed.conversation.entries[0]?.detailLines?.join("\n")).toContain("Input summary: inspect workspace route failure");
    expect(failed.conversation.entries[0]?.detailLines?.join("\n")).toContain("Planner failure detail:");
    expect(failed.conversation.entries[0]?.detailLines?.join("\n")).toContain("Shell 出问题时，可以把它当成一个可对话恢复的受控能力来处理");
    expect(failed.audit.lastEvent.detail).toContain("Input summary: inspect workspace route failure");
    expect(failed.audit.lastEvent.detail).toContain("Planner failure detail:");
    expect(failed.audit.lastEvent.detail).toContain("Shell 出问题时，可以把它当成一个可对话恢复的受控能力来处理");
  });

  it("starts the next queued task and increments its attempt count", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "inspect workspace state"
    });

    const running = createTaskExecutionStartedState(queued);

    expect(running.tasks.pendingCount).toBe(0);
    expect(running.tasks.activeTaskId).toBe(queued.tasks.items[0]?.id ?? null);
    expect(running.tasks.items[0]).toMatchObject({
      status: "running",
      attemptCount: 1,
      summary: "inspect workspace state"
    });
    expect(running.audit.lastEvent.source).toBe("local_task_runner");
    expect(running.error).toBeNull();
    expect(running.storage.logCount).toBeGreaterThan(queued.storage.logCount);
  });

  it("records visible progress for the active local-model chat task without completing it", () => {
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

    expect(progressed.tasks.activeTaskId).toBe(running.tasks.activeTaskId);
    expect(progressed.tasks.items[0]).toMatchObject({
      status: "running",
      executionKind: "local-model-chat",
      progressSummary: "Ollama 仍在生成，已等待约 15 秒。"
    });
    expect(progressed.audit.lastEvent.source).toBe("local_model_chat_progress");
    expect(progressed.output.summary).toBe("Ollama 仍在生成，已等待约 15 秒。");
    expect(progressed.rollback.entries).toHaveLength(running.rollback.entries.length);
  });

  it("fails a running task without an execution kind instead of fabricating a fixed assistant reply", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "legacy queued task without a planner execution kind"
      })
    );

    const failed = createTaskMissingExecutionKindFailedState(running);

    expect(failed.output.title).toBe("本地任务缺少执行类型");
    expect(failed.output.summary).toContain("请改写请求后重新提交");
    expect(failed.output.summary).not.toContain("已基于本地 Ollama 完成当前输入的初步处理");
    expect(failed.audit.lastEvent.source).toBe("local_task_missing_execution_kind");
    expect(failed.tasks.activeTaskId).toBeNull();
    expect(failed.tasks.items[0]).toMatchObject({
      status: "failed",
      lastFailureSource: "local_task_missing_execution_kind"
    });
  });

  it("recovers a stale active task slot before starting the next queued task", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "inspect workspace state"
    });
    const staleActive = {
      ...queued,
      tasks: {
        ...queued.tasks,
        activeTaskId: "missing-active-task"
      }
    };

    const running = createTaskExecutionStartedState(staleActive);

    expect(running).not.toBe(staleActive);
    expect(running.tasks.pendingCount).toBe(0);
    expect(running.tasks.activeTaskId).toBe(queued.tasks.items[0]?.id ?? null);
    expect(running.tasks.items[0]).toMatchObject({
      status: "running",
      attemptCount: 1,
      summary: "inspect workspace state"
    });
    expect(running.output.summary).toContain("正在使用本地助手处理当前请求");
    expect(running.output.summary).toContain("已清理失效的本地任务占用状态");
    expect(running.output.summary).not.toContain("Recovered stale active local task slot: missing-active-task");
    expect(running.output.summary).not.toContain("Stale active task record was missing.");
    expect(running.audit.lastEvent.detail).toContain("Recovered stale active local task slot: missing-active-task");
  });

  it("clears a stale active task slot when no queued task can be started", () => {
    const staleActive = {
      ...createInitialWorkbenchState(),
      tasks: {
        pendingCount: 0,
        activeTaskId: "missing-active-task",
        items: []
      }
    };

    const recovered = createStaleActiveTaskSlotRecoveredState(staleActive);

    expect(recovered).not.toBe(staleActive);
    expect(recovered.tasks.activeTaskId).toBeNull();
    expect(recovered.tasks.pendingCount).toBe(0);
    expect(recovered.output.title).toBe("本地任务队列已恢复");
    expect(recovered.output.summary).toBe("已清理失效的本地任务占用状态，队列可继续调度。完整恢复诊断已保留在日志和展开详情中。");
    expect(recovered.output.summary).not.toContain("Recovered stale active local task slot: missing-active-task");
    expect(recovered.output.summary).not.toContain("Stale active task record was missing.");
    expect(recovered.audit.lastEvent.source).toBe("local_task_stale_active_recovered");
    expect(recovered.audit.lastEvent.detail).toContain("No queued local task was available to start.");
    expect(recovered.audit.lastEvent.detail).toContain("Recovered stale active local task slot: missing-active-task");
    expect(recovered.conversation.entries[0]?.detailLines?.join("\n")).toContain(
      "Recovered stale active local task slot: missing-active-task"
    );
    expect(recovered.storage.logCount).toBeGreaterThan(staleActive.storage.logCount);
  });

  it("keeps previous failure diagnostics visible when a retried task starts again", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "diagnose opencow and continue repairing its workspace project runtime registry"
        })
      ),
      {
        summary: "Opencow self-repair stopped after failure analysis",
        detail: "Runtime registry repair verification failed after rewrite.",
        actionLabel: "Check .opencow/runtime/workspace-project-runs.json first, then ask opencow to retry.",
        source: "opencow_self_repair_failure_analysis"
      }
    );
    const retried = createTaskExecutionRetriedState(failed);

    const running = createTaskExecutionStartedState(retried);

    expect(running.tasks.items[0]).toMatchObject({
      status: "running",
      attemptCount: 2,
      lastFailureSource: "opencow_self_repair_failure_analysis"
    });
    expect(running.output.summary).toContain("正在使用本地助手处理当前请求");
    expect(running.output.summary).toContain("上次失败诊断已保留在日志和展开详情中。");
    expect(running.output.summary).not.toContain("Previous failure source:");
    expect(running.output.summary).not.toContain("Previous failure detail:");
    expect(running.output.summary).not.toContain("Previous failure recovery hint:");
    expect(running.audit.lastEvent.detail).toContain(
      "Previous failure source: opencow_self_repair_failure_analysis"
    );
  });

  it("clears stale local-model progress and streaming residue before retrying a failed task", () => {
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
    const streamed = createTaskExecutionStreamingChunkState(progressed, {
      taskId: progressed.tasks.activeTaskId ?? "",
      chunk: "第一段回答片段。"
    });
    const failed = createTaskExecutionFailedState(streamed, {
      summary: "本地模型对话失败",
      detail: "Local task exceeded the maximum execution time of 480 seconds.",
      actionLabel: "检查 Ollama、模型选择或缩小问题范围后重试。",
      source: "local_model_chat_runner"
    });

    expect(failed.tasks.items[0]).toMatchObject({
      status: "failed",
      progressSummary: "Ollama 仍在生成，已等待约 15 秒。",
      streamingSummary: "第一段回答片段。"
    });

    const retried = createTaskExecutionRetriedState(failed);

    expect(retried.tasks.items[0]).toMatchObject({
      status: "queued",
      progressSummary: undefined,
      streamingSummary: undefined
    });

    const restarted = createTaskExecutionStartedState(retried);

    expect(restarted.tasks.items[0]).toMatchObject({
      status: "running",
      progressSummary: undefined,
      streamingSummary: undefined
    });
    expect(restarted.output.summary).not.toContain("Ollama 仍在生成");
    expect(restarted.output.summary).not.toContain("第一段回答片段。");
  });

  it("preserves whitespace-only local-model streaming chunks between words", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "explain flyweight",
        executionKind: "local-model-chat",
        executionTitle: "Local model chat",
        executionAuditSummary: "Local assistant planned an ordinary local model chat response.",
        executionAuditDetail: "Local model chat task: explain flyweight"
      })
    );
    const first = createTaskExecutionStreamingChunkState(running, {
      taskId: running.tasks.activeTaskId ?? "",
      chunk: "Hello"
    });
    const space = createTaskExecutionStreamingChunkState(first, {
      taskId: first.tasks.activeTaskId ?? "",
      chunk: " "
    });
    const second = createTaskExecutionStreamingChunkState(space, {
      taskId: space.tasks.activeTaskId ?? "",
      chunk: "world"
    });

    expect(second.tasks.items[0]?.streamingSummary).toBe("Hello world");
    expect(second.output.summary).toBe("Hello world");
  });

  it("marks the active task as completed and clears the active slot", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "summarize the workspace"
      })
    );

    const completed = createTaskExecutionSucceededState(running, {
      resultTitle: "Workspace summary",
      resultSummary: "Finished the requested local assistant task."
    });

    expect(completed.tasks.pendingCount).toBe(0);
    expect(completed.tasks.activeTaskId).toBeNull();
    expect(completed.tasks.items[0]).toMatchObject({
      status: "completed",
      attemptCount: 1
    });
    expect(completed.conversation.entries[0]).toMatchObject({
      kind: "assistant",
      title: "Workspace summary",
      summary: "Finished the requested local assistant task."
    });
    expect(completed.audit.lastEvent.source).toBe("local_task_runner");
    expect(completed.error).toBeNull();
    expect(completed.storage.logCount).toBeGreaterThan(running.storage.logCount);
  });

  it("keeps previous failure diagnostics when a retried task completes", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "diagnose opencow and continue repairing its enabled skills registry"
        })
      ),
      {
        summary: "Opencow self-repair stopped after failure analysis",
        detail: "Enabled skills registry repair verification failed after rewrite.",
        actionLabel: "Check .opencow/skills/enabled-skills.json first, then ask opencow to retry.",
        source: "opencow_self_repair_failure_analysis"
      }
    );
    const runningAgain = createTaskExecutionStartedState(createTaskExecutionRetriedState(failed));

    const completed = createTaskExecutionSucceededState(runningAgain, {
      resultTitle: "Repair opencow enabled skills registry",
      resultSummary: "Self-repair completed and verified after explicit retry."
    });
    const detail = completed.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(completed.audit.lastEvent.detail).toContain(
      "Previous failure source: opencow_self_repair_failure_analysis"
    );
    expect(completed.audit.lastEvent.detail).toContain(
      "Previous failure detail: Enabled skills registry repair verification failed after rewrite."
    );
    expect(detail).toContain("Previous failure source: opencow_self_repair_failure_analysis");
    expect(detail).toContain("Previous failure recovery hint: Check .opencow/skills/enabled-skills.json first, then ask opencow to retry.");
    expect(completed.tasks.items[0]).toMatchObject({
      status: "completed",
      lastFailureSource: undefined,
      lastFailureSummary: undefined,
      lastFailureDetail: undefined,
      lastFailureActionLabel: undefined
    });
  });

  it("keeps task-specific audit summary and detail when a controlled task completes", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "diagnose opencow and continue repairing its enabled skills registry",
        executionKind: "opencow-self-repair-enabled-skills-registry",
        executionTitle: "Repair opencow enabled skills registry",
        executionAuditSummary: "Local assistant planned an opencow enabled skills registry self-repair.",
        executionAuditDetail:
          "Opencow self-repair task: enabled skills registry | request=diagnose opencow and continue repairing its enabled skills registry"
      })
    );

    const completed = createTaskExecutionSucceededState(running, {
      resultTitle: "Repair opencow enabled skills registry",
      resultSummary: "Self-repair completed and verified."
    });

    expect(completed.audit.summary).toBe("Local assistant planned an opencow enabled skills registry self-repair.");
    expect(completed.audit.lastEvent.source).toBe("local_task_runner");
    expect(completed.audit.lastEvent.detail).toContain(
      "Input summary: diagnose opencow and continue repairing its enabled skills registry"
    );
    expect(completed.audit.lastEvent.detail).toContain(
      "Execution kind: opencow-self-repair-enabled-skills-registry"
    );
    expect(completed.audit.lastEvent.detail).toContain("Execution title: Repair opencow enabled skills registry");
    expect(completed.audit.lastEvent.detail).toContain(
      "Execution audit detail: Opencow self-repair task: enabled skills registry | request=diagnose opencow and continue repairing its enabled skills registry"
    );
    expect(completed.audit.lastEvent.detail).toContain("Result summary: Self-repair completed and verified.");
    expect(completed.conversation.entries[0]?.detailLines?.join("\n")).toContain(
      "Input summary: diagnose opencow and continue repairing its enabled skills registry"
    );
    expect(completed.conversation.entries[0]?.detailLines?.join("\n")).toContain(
      "Execution kind: opencow-self-repair-enabled-skills-registry"
    );
    expect(completed.conversation.entries[0]?.detailLines?.join("\n")).toContain(
      "Opencow self-repair task: enabled skills registry | request=diagnose opencow and continue repairing its enabled skills registry"
    );
    expect(completed.conversation.entries[0]?.detailLines?.join("\n")).toContain(
      "Result summary: Self-repair completed and verified."
    );
  });

  it("marks the active task as failed and records a traceable error", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "repair the local logs"
      })
    );

    const failed = createTaskExecutionFailedState(running, {
      summary: "Local task failed",
      detail: "The local assistant could not finish the repair preview.",
      actionLabel: "Review the task plan and try again.",
      source: "local_task_runner"
    });

    expect(failed.tasks.pendingCount).toBe(0);
    expect(failed.tasks.activeTaskId).toBeNull();
    expect(failed.tasks.items[0]).toMatchObject({
      status: "failed",
      attemptCount: 1,
      summary: "repair the local logs"
    });
    expect(failed.error).toMatchObject({
      module: "tasks",
      summary: "Local task failed",
      source: "local_task_runner"
    });
    expect(failed.error?.detail).toContain("Input summary: repair the local logs");
    expect(failed.error?.detail).toContain("Attempt: 1/3");
    expect(failed.error?.detail).toContain("The local assistant could not finish the repair preview.");
    expect(failed.audit.lastEvent.detail).toContain("Input summary: repair the local logs");
    expect(failed.audit.lastEvent.detail).toContain("Attempt: 1/3");
    expect(failed.audit.lastEvent.detail).toContain("The local assistant could not finish the repair preview.");
    expect(failed.audit.lastEvent.detail).toContain("Recovery hint: Review the task plan and try again.");
    expect(failed.conversation.entries[0]).toMatchObject({
      kind: "system",
      title: "Local task failed",
      summary: "repair the local logs"
    });
    expect(failed.conversation.entries[0]?.actionLabel).toContain("预览回退");
    expect(failed.conversation.entries[0]?.rollbackTargetId).toBe(failed.rollback.entries[0]?.id);
    expect(failed.conversation.entries[0]?.detailLines?.join("\n")).toContain("Input summary: repair the local logs");
    expect(failed.conversation.entries[0]?.detailLines?.join("\n")).toContain("Attempt: 1/3");
    expect(failed.conversation.entries[0]?.detailLines?.join("\n")).toContain(
      "Failure detail: The local assistant could not finish the repair preview."
    );
    expect(failed.storage.logCount).toBeGreaterThan(running.storage.logCount);
  });

  it("keeps failed task default output concise while audit and details keep diagnostics", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "repair opencow runtime registry"
      })
    );

    const failed = createTaskExecutionFailedState(running, {
      summary: "Opencow self-repair stopped after failure analysis",
      detail: "Runtime registry repair verification failed after rewrite.",
      actionLabel: "Check .opencow/runtime/workspace-project-runs.json first, then ask opencow to retry.",
      source: "opencow_self_repair_failure_analysis"
    });

    expect(failed.output.title).toBe("Opencow self-repair stopped after failure analysis");
    expect(failed.output.summary).toContain(
      "Check .opencow/runtime/workspace-project-runs.json first, then ask opencow to retry."
    );
    expect(failed.output.summary).toContain("完整失败详情已保留在日志和展开详情中。");
    expect(failed.output.summary).not.toContain("Failure detail:");
    expect(failed.output.summary).not.toContain("Runtime registry repair verification failed after rewrite.");
    expect(failed.output.summary).not.toContain("Recovery visibility:");
    expect(failed.audit.lastEvent.detail).toContain("Runtime registry repair verification failed after rewrite.");
    expect(failed.audit.lastEvent.detail).toContain("Recovery visibility: rollback preview is available");
    expect(failed.error?.detail).toContain("Runtime registry repair verification failed after rewrite.");
    expect(failed.conversation.entries[0]?.detailLines?.join("\n")).toContain(
      "Failure detail: Runtime registry repair verification failed after rewrite."
    );
  });

  it("requeues the latest failed task without resetting its attempt count", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "run a local assistant task"
        })
      ),
      {
        summary: "Local task failed",
        detail: "The first run timed out.",
        actionLabel: "Try a smaller task.",
        source: "local_task_timeout"
      }
    );

    const retried = createTaskExecutionRetriedState(failed);

    expect(retried.tasks.pendingCount).toBe(1);
    expect(retried.tasks.activeTaskId).toBeNull();
    expect(retried.tasks.items[0]).toMatchObject({
      status: "queued",
      attemptCount: 1,
      summary: "run a local assistant task"
    });
    expect(retried.audit.lastEvent.source).toBe("local_task_retry");
    expect(retried.error).toBeNull();
    expect(retried.storage.logCount).toBeGreaterThan(failed.storage.logCount);
  });

  it("keeps retry diagnostics tied to the previous failure source and recovery hint", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "diagnose opencow and continue repairing its enabled skills registry",
          executionKind: "opencow-self-repair-enabled-skills-registry",
          executionTitle: "Repair opencow enabled skills registry",
          executionAuditDetail:
            "Opencow self-repair task: enabled skills registry | request=diagnose opencow and continue repairing its enabled skills registry"
        })
      ),
      {
        summary: "Opencow self-repair stopped after failure analysis",
        detail: "Enabled skills registry repair verification failed after rewrite.",
        actionLabel: "Check .opencow/skills/enabled-skills.json first, then ask opencow to retry.",
        source: "opencow_self_repair_failure_analysis"
      }
    );

    const retried = createTaskExecutionRetriedState(failed);
    const detail = retried.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(detail).toContain("Previous failure source: opencow_self_repair_failure_analysis");
    expect(detail).toContain("Previous failure summary: Opencow self-repair stopped after failure analysis");
    expect(detail).toContain("Previous failure detail: Enabled skills registry repair verification failed after rewrite.");
    expect(detail).toContain(
      "Previous failure recovery hint: Check .opencow/skills/enabled-skills.json first, then ask opencow to retry."
    );
    expect(retried.audit.lastEvent.detail).toContain(
      "Previous failure source: opencow_self_repair_failure_analysis"
    );
    expect(retried.tasks.items[0]).toMatchObject({
      status: "queued",
      lastFailureSource: "opencow_self_repair_failure_analysis"
    });
  });

  it("keeps retry diagnostics out of the default output panel after explicit retry", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "diagnose opencow and continue repairing its workspace project runtime registry"
        })
      ),
      {
        summary: "Opencow self-repair stopped after failure analysis",
        detail: "Runtime registry repair verification failed after rewrite.",
        actionLabel: "Check .opencow/runtime/workspace-project-runs.json first, then ask opencow to retry.",
        source: "opencow_self_repair_failure_analysis"
      }
    );

    const retried = createTaskExecutionRetriedState(failed);

    expect(retried.output.summary).toContain("当前有 1 条待处理任务");
    expect(retried.output.summary).toContain("上次失败诊断已保留在日志和展开详情中。");
    expect(retried.output.summary).not.toContain("Previous failure source:");
    expect(retried.output.summary).not.toContain("Previous failure detail:");
    expect(retried.output.summary).not.toContain("Previous failure recovery hint:");
    expect(retried.audit.lastEvent.detail).toContain("Previous failure source: opencow_self_repair_failure_analysis");
    expect(retried.audit.lastEvent.detail).toContain("Previous failure detail: Runtime registry repair verification failed after rewrite.");
  });

  it("keeps duplicate skips after explicit retry tied to the previous failure diagnostics", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "diagnose opencow and continue repairing its enabled skills registry"
        })
      ),
      {
        summary: "Opencow self-repair stopped after failure analysis",
        detail: "Enabled skills registry repair verification failed after rewrite.",
        actionLabel: "Check .opencow/skills/enabled-skills.json first, then ask opencow to retry.",
        source: "opencow_self_repair_failure_analysis"
      }
    );
    const retried = createTaskExecutionRetriedState(failed);

    const deduplicated = createUserTaskSubmittedState(retried, {
      message: "diagnose opencow and continue repairing its enabled skills registry"
    });
    const detail = deduplicated.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(deduplicated.tasks.pendingCount).toBe(1);
    expect(deduplicated.tasks.items[0]).toMatchObject({
      status: "queued",
      lastFailureSource: "opencow_self_repair_failure_analysis"
    });
    expect(deduplicated.output.summary).toContain("已有相同任务正在排队或执行");
    expect(deduplicated.output.summary).toContain("上次失败诊断已保留在日志和展开详情中。");
    expect(deduplicated.output.summary).not.toContain("Previous failure source:");
    expect(deduplicated.output.summary).not.toContain("Previous failure detail:");
    expect(detail).toContain("Existing task status: queued");
    expect(detail).toContain("Previous failure source: opencow_self_repair_failure_analysis");
    expect(detail).toContain("Previous failure detail: Enabled skills registry repair verification failed after rewrite.");
    expect(detail).toContain(
      "Previous failure recovery hint: Check .opencow/skills/enabled-skills.json first, then ask opencow to retry."
    );
    expect(deduplicated.audit.lastEvent.detail).toContain(
      "Previous failure source: opencow_self_repair_failure_analysis"
    );
  });

  it("keeps long duplicate task text out of default output while preserving it in audit", () => {
    const longMessage = [
      "请分析这段非常长的本地资料并生成摘要。",
      "第一部分内容需要保留在审计里。",
      "第二部分内容也需要保留在审计里。",
      "第三部分内容继续拉长输入，避免默认输出面板摊开完整用户问题。",
      "这是长文本尾部标记：DO_NOT_SHOW_IN_DEFAULT_OUTPUT_BUT_KEEP_IN_AUDIT"
    ].join("\n");
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: longMessage
    });

    const deduplicated = createUserTaskSubmittedState(queued, {
      message: longMessage
    });
    const detail = deduplicated.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(deduplicated.output.summary).toContain("已有相同任务正在排队或执行");
    expect(deduplicated.output.summary).not.toContain("DO_NOT_SHOW_IN_DEFAULT_OUTPUT_BUT_KEEP_IN_AUDIT");
    expect(deduplicated.conversation.entries[0]?.summary).not.toContain(
      "DO_NOT_SHOW_IN_DEFAULT_OUTPUT_BUT_KEEP_IN_AUDIT"
    );
    expect(deduplicated.audit.lastEvent.detail).toContain("DO_NOT_SHOW_IN_DEFAULT_OUTPUT_BUT_KEEP_IN_AUDIT");
    expect(detail).toContain("DO_NOT_SHOW_IN_DEFAULT_OUTPUT_BUT_KEEP_IN_AUDIT");
  });

  it("requeues the selected failed task when multiple failed tasks are visible", () => {
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

    const retried = createTaskExecutionRetriedState(secondFailed, firstTaskId);

    expect(retried.tasks.pendingCount).toBe(1);
    expect(retried.tasks.items.find((item) => item.id === firstTaskId)).toMatchObject({
      status: "queued",
      attemptCount: 1,
      summary: "repair the local rag index"
    });
    expect(retried.tasks.items.find((item) => item.id !== firstTaskId && item.status === "failed")).toMatchObject({
      summary: "repair the enabled skills registry"
    });
    expect(retried.audit.lastEvent.detail).toContain("repair the local rag index");
    expect(retried.audit.lastEvent.detail).toContain("Previous failure source: local_task_runner");
    expect(retried.audit.lastEvent.detail).toContain(
      "Previous failure detail: The local RAG index could not be read."
    );
  });

  it("allows approval continuation to requeue the same failed task without hitting duplicate failed-task blocking", () => {
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

    expect(resumed.tasks.pendingCount).toBe(1);
    expect(resumed.tasks.items[0]).toMatchObject({
      status: "queued",
      summary: "create a temp-output folder for this workspace",
      executionKind: "workspace-write-create-temp-output",
      executionTitle: "Create temp-output directory",
      attemptCount: 1,
      lastFailureSource: "local_task_runner",
      lastFailureDetail: "Workspace-write command planning failed before permission could be requested."
    });
    expect(
      resumed.tasks.items.filter((item) => item.summary === "create a temp-output folder for this workspace")
    ).toHaveLength(1);
    expect(resumed.output.title).toBe("本地任务队列");
    expect(resumed.output.summary).toContain("当前有 1 条待处理任务");
    expect(resumed.audit.lastEvent.source).toBe("composer_submit");
    expect(
      resumed.conversation.entries.filter(
        (entry) => entry.kind === "user" && entry.summary === "create a temp-output folder for this workspace"
      )
    ).toHaveLength(1);
  });

  it("does not append a second user message or session rollback anchor when approval continuation requeues the same task", () => {
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

    const matchingUserEntries = resumed.conversation.entries.filter(
      (entry) => entry.kind === "user" && entry.summary === "create a temp-output folder for this workspace"
    );
    const matchingSessionRollbacks = resumed.rollback.entries.filter(
      (entry) =>
        entry.label === "会话输入"
        && entry.summary === "提交本地任务：create a temp-output folder for this workspace"
    );

    expect(matchingUserEntries).toHaveLength(1);
    expect(matchingSessionRollbacks).toHaveLength(1);
  });

  it("generates unique conversation entry ids across repeated retry transitions", () => {
    const firstFailed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "retry the same task safely"
        })
      ),
      {
        summary: "Local task failed",
        detail: "The first attempt failed.",
        actionLabel: "Try again after inspection.",
        source: "local_task_runner"
      }
    );
    const firstRetried = createTaskExecutionRetriedState(firstFailed);
    const secondFailed = createTaskExecutionFailedState(createTaskExecutionStartedState(firstRetried), {
      summary: "Local task failed",
      detail: "The second attempt failed.",
      actionLabel: "Try again after inspection.",
      source: "local_task_runner"
    });
    const secondRetried = createTaskExecutionRetriedState(secondFailed);

    const retryConversationIds = secondRetried.conversation.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("running") || id.includes("failed") || id.includes("retried"));

    expect(new Set(retryConversationIds).size).toBe(retryConversationIds.length);
  });

  it("generates unique conversation entry ids across repeated duplicate skips", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "scan local mcp plugins"
    });
    const firstSkipped = createUserTaskSubmittedState(queued, {
      message: "scan local mcp plugins"
    });
    const secondSkipped = createUserTaskSubmittedState(firstSkipped, {
      message: "scan local mcp plugins"
    });

    const duplicateSkipIds = secondSkipped.conversation.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("duplicate-skipped"));

    expect(duplicateSkipIds).toHaveLength(2);
    expect(new Set(duplicateSkipIds).size).toBe(duplicateSkipIds.length);
    expect(secondSkipped.rollback.entries.map((entry) => entry.id)).toContain(duplicateSkipIds[0]);
    expect(secondSkipped.rollback.entries.map((entry) => entry.id)).toContain(duplicateSkipIds[1]);
  });

  it("does not requeue a failed task again after the maximum retry limit is already reached", () => {
    const thirdFailed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createTaskExecutionRetriedState(
          createTaskExecutionFailedState(
            createTaskExecutionStartedState(
              createTaskExecutionRetriedState(
                createTaskExecutionFailedState(
                  createTaskExecutionStartedState(
                    createUserTaskSubmittedState(createInitialWorkbenchState(), {
                      message: "inspect the workspace and keep going"
                    })
                  ),
                  {
                    summary: "Local task failed",
                    detail: "The first attempt failed.",
                    actionLabel: "Try again after inspection.",
                    source: "local_task_runner"
                  }
                )
              )
            ),
            {
              summary: "Local task failed",
              detail: "The second attempt failed.",
              actionLabel: "Try again after inspection.",
              source: "local_task_runner"
            }
          )
        )
      ),
      {
        summary: "Local task failed",
        detail: "The third attempt failed.",
        actionLabel: "Try again after inspection.",
        source: "local_task_runner"
      }
    );

    const blockedRetry = createTaskExecutionRetriedState(thirdFailed);

    expect(blockedRetry.tasks.pendingCount).toBe(0);
    expect(blockedRetry.tasks.activeTaskId).toBeNull();
    expect(blockedRetry.tasks.items[0]).toMatchObject({
      status: "failed",
      attemptCount: 3,
      summary: "inspect the workspace and keep going"
    });
    expect(blockedRetry.error).toMatchObject({
      summary: "Local task retry limit reached and execution was stopped",
      source: "local_task_attempt_guard"
    });
  });

  it("does not append another retry-limit event when the max-attempt guard is already recorded", () => {
    const thirdFailed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createTaskExecutionRetriedState(
          createTaskExecutionFailedState(
            createTaskExecutionStartedState(
              createTaskExecutionRetriedState(
                createTaskExecutionFailedState(
                  createTaskExecutionStartedState(
                    createUserTaskSubmittedState(createInitialWorkbenchState(), {
                      message: "inspect the workspace and keep going"
                    })
                  ),
                  {
                    summary: "Local task failed",
                    detail: "The first attempt failed.",
                    actionLabel: "Try again after inspection.",
                    source: "local_task_runner"
                  }
                )
              )
            ),
            {
              summary: "Local task failed",
              detail: "The second attempt failed.",
              actionLabel: "Try again after inspection.",
              source: "local_task_runner"
            }
          )
        )
      ),
      {
        summary: "Local task failed",
        detail: "The third attempt failed.",
        actionLabel: "Try again after inspection.",
        source: "local_task_runner"
      }
    );

    const blockedRetry = createTaskExecutionRetriedState(thirdFailed);
    const repeatedBlockedRetry = createTaskExecutionRetriedState(blockedRetry);

    expect(repeatedBlockedRetry).toBe(blockedRetry);
    expect(repeatedBlockedRetry.conversation.entries).toHaveLength(blockedRetry.conversation.entries.length);
    expect(repeatedBlockedRetry.rollback.entries).toHaveLength(blockedRetry.rollback.entries.length);
  });

  it("explains that a duplicate max-attempt failed request needs review or rewrite instead of another retry", () => {
    const thirdFailed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createTaskExecutionRetriedState(
          createTaskExecutionFailedState(
            createTaskExecutionStartedState(
              createTaskExecutionRetriedState(
                createTaskExecutionFailedState(
                  createTaskExecutionStartedState(
                    createUserTaskSubmittedState(createInitialWorkbenchState(), {
                      message: "inspect the workspace and keep going"
                    })
                  ),
                  {
                    summary: "Local task failed",
                    detail: "The first attempt failed.",
                    actionLabel: "Try again after inspection.",
                    source: "local_task_runner"
                  }
                )
              )
            ),
            {
              summary: "Local task failed",
              detail: "The second attempt failed.",
              actionLabel: "Try again after inspection.",
              source: "local_task_runner"
            }
          )
        )
      ),
      {
        summary: "Local task failed",
        detail: "The third attempt failed.",
        actionLabel: "Try again after inspection.",
        source: "local_task_runner"
      }
    );

    const deduplicated = createUserTaskSubmittedState(thirdFailed, {
      message: "inspect the workspace and keep going"
    });

    expect(deduplicated.tasks.pendingCount).toBe(0);
    expect(deduplicated.tasks.items[0]).toMatchObject({
      status: "failed",
      attemptCount: 3
    });
    expect(deduplicated.output.summary).toContain("retry limit");
    expect(deduplicated.output.summary).toContain("rewrite the request");
    expect(deduplicated.output.summary).not.toContain("retry local task");
    expect(deduplicated.conversation.entries[0]?.detailLines?.join("\n")).toContain("retry limit");
    expect(deduplicated.conversation.entries[0]?.detailLines?.join("\n")).toContain("Review the latest failure");
  });

  it("keeps retry-limit conversation diagnostics aligned with the normalized recovery guidance", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "inspect the workspace and keep going"
      })
    );

    const failed = createTaskExecutionFailedState(running, {
      summary: "Original retry guard summary",
      detail: "Task exceeded the maximum retry limit of 3 attempts.",
      actionLabel: "Original unnormalized retry hint",
      source: "local_task_attempt_guard"
    });

    const latestEntry = failed.conversation.entries[0];

    expect(latestEntry.title).toBe("Local task retry limit reached and execution was stopped");
    expect(latestEntry.detailLines?.join("\n")).toContain(
      "Repeated execution was stopped to avoid a retry loop. Review the latest failure detail, simplify the request, or help opencow restore the missing dependency or permission before retrying again."
    );
    expect(latestEntry.detailLines?.join("\n")).not.toContain("Original unnormalized retry hint");
  });

  it("does not enqueue the same composer request again while a matching failed task is waiting for explicit retry", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "inspect the workspace and keep going"
        })
      ),
      {
        summary: "Local task failed",
        detail: "A required local dependency could not be loaded.",
        actionLabel: "Review the failure and retry explicitly.",
        source: "local_task_runner"
      }
    );

    const deduplicated = createUserTaskSubmittedState(failed, {
      message: "inspect the workspace and keep going"
    });

    expect(deduplicated.tasks.pendingCount).toBe(0);
    expect(deduplicated.tasks.activeTaskId).toBeNull();
    expect(deduplicated.tasks.items).toHaveLength(1);
    expect(deduplicated.tasks.items[0]).toMatchObject({
      status: "failed",
      attemptCount: 1,
      summary: "inspect the workspace and keep going"
    });
    expect(deduplicated.audit.lastEvent.source).toBe("composer_submit_deduplicated");
  });

  it("keeps duplicate failed task skips tied to the previous execution trace", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "create a temp-output folder for this workspace",
          executionKind: "workspace-write-create-temp-output",
          executionTitle: "Create temp-output directory",
          executionAuditDetail: "Workspace write shell command task: create temp-output directory"
        })
      ),
      {
        summary: "Local task failed",
        detail: "Workspace write command failed after approval.",
        actionLabel: "Review the permission and shell bridge before retrying.",
        source: "local_task_runner"
      }
    );

    const deduplicated = createUserTaskSubmittedState(failed, {
      message: "create a temp-output folder for this workspace"
    });
    const detail = deduplicated.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(detail).toContain("Existing task status: failed");
    expect(detail).toContain("Existing task attempts: 1/3");
    expect(detail).toContain("Execution kind: workspace-write-create-temp-output");
    expect(detail).toContain("Execution title: Create temp-output directory");
    expect(detail).toContain("Execution audit detail: Workspace write shell command task: create temp-output directory");
    expect(detail).toContain(
      "Previous failure recovery: use explicit retry or rollback preview after reviewing the audit trail."
    );
  });

  it("keeps duplicate failed task skips tied to the previous failure source and recovery hint", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "diagnose opencow and continue repairing its workspace project runtime registry",
          executionKind: "opencow-self-repair-workspace-project-runtime-registry",
          executionTitle: "Repair opencow workspace project runtime registry",
          executionAuditDetail:
            "Opencow self-repair task: workspace project runtime registry | request=diagnose opencow and continue repairing its workspace project runtime registry"
        })
      ),
      {
        summary: "Opencow self-repair stopped after failure analysis",
        detail: "Runtime registry repair verification failed after rewrite.",
        actionLabel: "Check .opencow/runtime/workspace-project-runs.json first, then ask opencow to retry.",
        source: "opencow_self_repair_failure_analysis"
      }
    );

    expect(failed.tasks.items[0]).toMatchObject({
      status: "failed",
      lastFailureSource: "opencow_self_repair_failure_analysis",
      lastFailureSummary: "Opencow self-repair stopped after failure analysis",
      lastFailureDetail: "Runtime registry repair verification failed after rewrite.",
      lastFailureActionLabel: "Check .opencow/runtime/workspace-project-runs.json first, then ask opencow to retry."
    });

    const deduplicated = createUserTaskSubmittedState(failed, {
      message: "diagnose opencow and continue repairing its workspace project runtime registry"
    });
    const detail = deduplicated.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(detail).toContain("Previous failure source: opencow_self_repair_failure_analysis");
    expect(detail).toContain("Previous failure summary: Opencow self-repair stopped after failure analysis");
    expect(detail).toContain("Previous failure detail: Runtime registry repair verification failed after rewrite.");
    expect(detail).toContain(
      "Previous failure recovery hint: Check .opencow/runtime/workspace-project-runs.json first, then ask opencow to retry."
    );
    expect(deduplicated.audit.lastEvent.detail).toContain(
      "Previous failure source: opencow_self_repair_failure_analysis"
    );
  });

  it("explains that a duplicate failed request is waiting for explicit retry instead of saying it is still queued or running", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "inspect the workspace and keep going"
        })
      ),
      {
        summary: "Local task failed",
        detail: "A required local dependency could not be loaded.",
        actionLabel: "Review the failure and retry explicitly.",
        source: "local_task_runner"
      }
    );

    const deduplicated = createUserTaskSubmittedState(failed, {
      message: "inspect the workspace and keep going"
    });

    expect(deduplicated.output.summary).toContain(
      "相同任务已经失败，正在等待用户点击重试本地任务或改写请求"
    );
    expect(deduplicated.output.summary).not.toContain("正在排队或执行");
    expect(deduplicated.conversation.entries[0]?.detailLines?.join("\n")).toContain(
      "相同任务已经失败，正在等待显式重试或新的请求内容"
    );
  });

  it("cancels the active task cleanly without leaving the queue locked", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "long running local assistant task",
        executionKind: "workspace-overview",
        executionTitle: "Workspace overview",
        executionAuditDetail: "Readonly workspace overview task."
      })
    );

    const cancelled = createTaskExecutionCancelledState(running);

    expect(cancelled.tasks.pendingCount).toBe(0);
    expect(cancelled.tasks.activeTaskId).toBeNull();
    expect(cancelled.tasks.items[0]).toMatchObject({
      status: "cancelled",
      attemptCount: 1,
      summary: "long running local assistant task"
    });
    expect(cancelled.error).toMatchObject({
      module: "tasks",
      source: "local_task_cancelled"
    });
    expect(cancelled.error?.detail).toContain("Input summary: long running local assistant task");
    expect(cancelled.error?.detail).toContain("Attempt: 1/3");
    expect(cancelled.error?.detail).toContain("Execution kind: workspace-overview");
    expect(cancelled.error?.detail).toContain("Execution title: Workspace overview");
    expect(cancelled.error?.detail).toContain("Execution audit detail: Readonly workspace overview task.");
    expect(cancelled.error?.detail).toContain("No further local execution was started after cancellation.");
    expect(cancelled.error?.detail).toContain("Recovery visibility: rollback preview is available");
    expect(cancelled.error?.actionLabel).toContain("Rewrite the request");
    expect(cancelled.audit.lastEvent.detail).toContain("Input summary: long running local assistant task");
    expect(cancelled.audit.lastEvent.detail).toContain("Attempt: 1/3");
    expect(cancelled.audit.lastEvent.detail).toContain("Execution kind: workspace-overview");
    expect(cancelled.audit.lastEvent.detail).toContain("Execution title: Workspace overview");
    expect(cancelled.audit.lastEvent.detail).toContain("Execution audit detail: Readonly workspace overview task.");
    expect(cancelled.audit.lastEvent.detail).toContain("No further local execution was started after cancellation.");
    expect(cancelled.audit.lastEvent.detail).toContain("Recovery visibility: rollback preview is available");
    expect(cancelled.conversation.entries[0]?.detailLines?.join("\n")).toContain(
      "Input summary: long running local assistant task"
    );
    expect(cancelled.conversation.entries[0]?.detailLines?.join("\n")).toContain("Attempt: 1/3");
    expect(cancelled.conversation.entries[0]?.detailLines?.join("\n")).toContain(
      "Execution kind: workspace-overview"
    );
    expect(cancelled.conversation.entries[0]?.detailLines?.join("\n")).toContain(
      "Execution title: Workspace overview"
    );
    expect(cancelled.conversation.entries[0]?.detailLines?.join("\n")).toContain(
      "Execution audit detail: Readonly workspace overview task."
    );
    expect(cancelled.conversation.entries[0]?.detailLines?.join("\n")).toContain(
      "No further local execution was started after cancellation."
    );
    expect(cancelled.conversation.entries[0]?.detailLines?.join("\n")).toContain(
      "Recovery visibility: rollback preview is available"
    );
    expect(cancelled.conversation.entries[0]?.actionLabel).toContain("预览回退");
    expect(cancelled.conversation.entries[0]?.rollbackTargetId).toBe(cancelled.rollback.entries[0]?.id);
    expect(cancelled.output.title.length).toBeGreaterThan(0);
    expect(cancelled.output.summary).toContain("本地任务已停止");
    expect(cancelled.output.summary).toContain("取消详情已保留在日志和展开详情中。");
    expect(cancelled.output.summary).not.toContain("Recovery visibility:");
    expect(cancelled.output.summary.length).toBeGreaterThan(0);
    expect(cancelled.storage.logCount).toBeGreaterThan(running.storage.logCount);
  });

  it("recovers a stale active task slot when cancellation is requested", () => {
    const staleActive = {
      ...createInitialWorkbenchState(),
      tasks: {
        pendingCount: 0,
        activeTaskId: "missing-active-task",
        items: []
      }
    };

    const recovered = createTaskExecutionCancelledState(staleActive);

    expect(recovered).not.toBe(staleActive);
    expect(recovered.tasks.activeTaskId).toBeNull();
    expect(recovered.output.title).toBe("本地任务队列已恢复");
    expect(recovered.output.summary).toBe("已清理失效的本地任务占用状态，队列可继续调度。完整恢复诊断已保留在日志和展开详情中。");
    expect(recovered.output.summary).not.toContain("Recovered stale active local task slot: missing-active-task");
    expect(recovered.audit.lastEvent.source).toBe("local_task_stale_active_recovered");
    expect(recovered.storage.logCount).toBeGreaterThan(staleActive.storage.logCount);
  });

  it("does not cancel a completed task when the active slot points to history", () => {
    const completed = createTaskExecutionSucceededState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "inspect workspace state"
        })
      ),
      {
        resultTitle: "Workspace summary",
        resultSummary: "Completed before the active slot became stale."
      }
    );
    const completedTaskId = completed.tasks.items[0]?.id ?? "";
    const staleCompletedActive = {
      ...completed,
      tasks: {
        ...completed.tasks,
        activeTaskId: completedTaskId
      }
    };

    const recovered = createTaskExecutionCancelledState(staleCompletedActive);

    expect(recovered.tasks.activeTaskId).toBeNull();
    expect(recovered.tasks.items[0]).toMatchObject({
      status: "completed",
      summary: "inspect workspace state"
    });
    expect(recovered.output.title).toBe("本地任务队列已恢复");
    expect(recovered.output.summary).toBe("已清理失效的本地任务占用状态，队列可继续调度。完整恢复诊断已保留在日志和展开详情中。");
    expect(recovered.output.summary).not.toContain(`Recovered stale active local task slot: ${completedTaskId}`);
    expect(recovered.audit.lastEvent.detail).toContain(`Recovered stale active local task slot: ${completedTaskId}`);
    expect(recovered.audit.lastEvent.source).toBe("local_task_stale_active_recovered");
  });

  it("ignores late success and failure results for a stale cancelled active task slot", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "long running local assistant task",
      executionKind: "workspace-overview",
      executionTitle: "Workspace overview",
      executionAuditSummary: "Local assistant planned a workspace overview task.",
      executionAuditDetail: "Readonly workspace overview task."
    });
    const running = createTaskExecutionStartedState(queued);
    const cancelled = createTaskExecutionCancelledState(running);
    const cancelledTaskId = cancelled.tasks.items[0]?.id ?? "";
    const staleCancelled = {
      ...cancelled,
      tasks: {
        ...cancelled.tasks,
        activeTaskId: cancelledTaskId
      }
    };

    const lateSuccess = createTaskExecutionSucceededState(staleCancelled, {
      resultTitle: "Late success",
      resultSummary: "This late result must not overwrite cancellation."
    });
    const lateFailure = createTaskExecutionFailedState(staleCancelled, {
      summary: "Late failure",
      detail: "This late failure must not overwrite cancellation.",
      actionLabel: "Ignore the stale result.",
      source: "late_task_result"
    });

    expect(lateSuccess).toBe(staleCancelled);
    expect(lateFailure).toBe(staleCancelled);
    expect(lateSuccess.tasks.items[0]?.status).toBe("cancelled");
    expect(lateFailure.tasks.items[0]?.status).toBe("cancelled");
  });

  it("keeps previous failure diagnostics when a retried task is cancelled", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "diagnose opencow and continue repairing its workspace project runtime registry"
        })
      ),
      {
        summary: "Opencow self-repair stopped after failure analysis",
        detail: "Runtime registry repair verification failed after rewrite.",
        actionLabel: "Check .opencow/runtime/workspace-project-runs.json first, then ask opencow to retry.",
        source: "opencow_self_repair_failure_analysis"
      }
    );
    const runningAgain = createTaskExecutionStartedState(createTaskExecutionRetriedState(failed));

    const cancelled = createTaskExecutionCancelledState(runningAgain);
    const detail = cancelled.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(cancelled.output.summary).toContain("本地任务已停止");
    expect(cancelled.output.summary).toContain("上次失败诊断已保留在日志和展开详情中。");
    expect(cancelled.output.summary).not.toContain("Previous failure source:");
    expect(cancelled.output.summary).not.toContain("Previous failure detail:");
    expect(cancelled.error?.detail).toContain("Previous failure source: opencow_self_repair_failure_analysis");
    expect(cancelled.audit.lastEvent.detail).toContain(
      "Previous failure source: opencow_self_repair_failure_analysis"
    );
    expect(detail).toContain("Previous failure source: opencow_self_repair_failure_analysis");
    expect(detail).toContain(
      "Previous failure recovery hint: Check .opencow/runtime/workspace-project-runs.json first, then ask opencow to retry."
    );
  });

  it("allows a cancelled task to be submitted again as a fresh request", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "long running local assistant task"
      })
    );
    const cancelled = createTaskExecutionCancelledState(running);

    const resubmitted = createUserTaskSubmittedState(cancelled, {
      message: "long running local assistant task"
    });

    expect(resubmitted.tasks.pendingCount).toBe(1);
    expect(resubmitted.tasks.items[0]).toMatchObject({
      status: "queued",
      attemptCount: 0,
      summary: "long running local assistant task"
    });
    expect(resubmitted.audit.lastEvent.source).toBe("composer_submit");
  });
});
