import { describe, expect, it } from "vitest";
import {
  createInitialWorkbenchState,
  createTaskExecutionCancelledState,
  createTaskExecutionFailedState,
  createTaskExecutionRetriedState,
  createTaskExecutionStartedState,
  createTaskExecutionSucceededState,
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
    expect(failed.conversation.entries[0]).toMatchObject({
      kind: "system",
      title: "Local task failed",
      summary: "repair the local logs"
    });
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
  });

  it("cancels the active task cleanly without leaving the queue locked", () => {
    const running = createTaskExecutionStartedState(
      createUserTaskSubmittedState(createInitialWorkbenchState(), {
        message: "long running local assistant task"
      })
    );

    const cancelled = createTaskExecutionCancelledState(running);

    expect(cancelled.tasks.pendingCount).toBe(0);
    expect(cancelled.tasks.activeTaskId).toBeNull();
    expect(cancelled.tasks.items[0]).toMatchObject({
      status: "failed",
      attemptCount: 1,
      summary: "long running local assistant task"
    });
    expect(cancelled.error).toMatchObject({
      module: "tasks",
      source: "local_task_cancelled"
    });
    expect(cancelled.output.title.length).toBeGreaterThan(0);
    expect(cancelled.output.summary.length).toBeGreaterThan(0);
  });
});
