import { describe, expect, it } from "vitest";
import { createInitialWorkbenchState, createUserTaskSubmittedState } from "./workbenchState";

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
});
