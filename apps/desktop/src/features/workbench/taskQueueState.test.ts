import { describe, expect, it } from "vitest";
import {
  createInitialWorkbenchState,
  createTaskExecutionFailedState,
  createTaskExecutionRetriedState,
  createTaskExecutionStartedState,
  createTaskExecutionSucceededState,
  createUserTaskSubmittedState
} from "./workbenchState";

describe("task queue state", () => {
  it("starts with an empty local task queue", () => {
    const state = createInitialWorkbenchState();

    expect(state.tasks.pendingCount).toBe(0);
    expect(state.tasks.activeTaskId).toBeNull();
    expect(state.tasks.items).toHaveLength(0);
  });

  it("queues a submitted local task for desktop execution", () => {
    const state = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "请检查当前工作区并整理待办"
    });

    expect(state.tasks.pendingCount).toBe(1);
    expect(state.tasks.activeTaskId).toBeNull();
    expect(state.tasks.items).toHaveLength(1);
    expect(state.tasks.items[0]).toMatchObject({
      status: "queued",
      source: "composer",
      summary: "请检查当前工作区并整理待办"
    });
    expect(state.output.title).toBe("本地任务队列");
    expect(state.output.summary).toBe("当前有 1 条待处理的本地任务。");
  });

  it("marks the oldest queued task as running", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "请检查当前工作区并整理待办"
    });

    const running = createTaskExecutionStartedState(queued);

    expect(running.tasks.pendingCount).toBe(0);
    expect(running.tasks.activeTaskId).toBe(queued.tasks.items[0].id);
    expect(running.tasks.items[0]).toMatchObject({
      status: "running",
      summary: "请检查当前工作区并整理待办"
    });
    expect(running.output.title).toBe("本地任务执行中");
    expect(running.output.summary).toBe("正在使用本地 Ollama 处理当前任务。");
  });

  it("completes the active task and records a local result", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "请检查当前工作区并整理待办"
    });
    const running = createTaskExecutionStartedState(queued);

    const succeeded = createTaskExecutionSucceededState(running, {
      resultTitle: "工作区整理建议",
      resultSummary: "已生成 3 条本地整理建议。"
    });

    expect(succeeded.tasks.pendingCount).toBe(0);
    expect(succeeded.tasks.activeTaskId).toBeNull();
    expect(succeeded.tasks.items[0]).toMatchObject({
      status: "completed",
      summary: "请检查当前工作区并整理待办"
    });
    expect(succeeded.output.title).toBe("工作区整理建议");
    expect(succeeded.output.summary).toBe("已生成 3 条本地整理建议。");
    expect(succeeded.audit.summary).toBe("本地任务执行完成");
  });

  it("marks the active task as failed and exposes a traceable error", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "请检查当前工作区并整理待办"
    });
    const running = createTaskExecutionStartedState(queued);

    const failed = createTaskExecutionFailedState(running, {
      summary: "本地任务执行失败",
      detail: "Ollama 响应超时，请检查本地模型状态。",
      actionLabel: "检查 Ollama 服务并重试",
      source: "local_task_runner"
    });

    expect(failed.tasks.pendingCount).toBe(0);
    expect(failed.tasks.activeTaskId).toBeNull();
    expect(failed.tasks.items[0]).toMatchObject({
      status: "failed",
      summary: "请检查当前工作区并整理待办"
    });
    expect(failed.error).toMatchObject({
      module: "tasks",
      summary: "本地任务执行失败",
      detail: "Ollama 响应超时，请检查本地模型状态。",
      actionLabel: "检查 Ollama 服务并重试",
      source: "local_task_runner"
    });
    expect(failed.audit.summary).toBe("本地任务执行失败");
  });

  it("requeues a failed local task for retry and clears the blocking error", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "请检查当前工作区并整理待办"
    });
    const running = createTaskExecutionStartedState(queued);
    const failed = createTaskExecutionFailedState(running, {
      summary: "本地任务执行失败",
      detail: "Ollama 响应超时，请检查本地模型状态。",
      actionLabel: "检查 Ollama 服务并重试",
      source: "local_task_runner"
    });

    const retried = createTaskExecutionRetriedState(failed);

    expect(retried.tasks.pendingCount).toBe(1);
    expect(retried.tasks.activeTaskId).toBeNull();
    expect(retried.tasks.items[0]).toMatchObject({
      id: failed.tasks.items[0]?.id,
      status: "queued",
      summary: "请检查当前工作区并整理待办"
    });
    expect(retried.output.title).toBe("本地任务队列");
    expect(retried.output.summary).toBe("当前有 1 条待处理的本地任务。");
    expect(retried.error).toBeNull();
    expect(retried.audit.summary).toBe("已重试本地任务");
  });
});
