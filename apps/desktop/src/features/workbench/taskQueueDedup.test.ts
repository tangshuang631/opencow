import { describe, expect, it } from "vitest";
import { createInitialWorkbenchState, createUserTaskSubmittedState } from "./workbenchState";

describe("task queue deduplication", () => {
  it("does not queue an identical task twice while the original task is still queued", () => {
    const first = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "scan local mcp plugins"
    });

    const second = createUserTaskSubmittedState(first, {
      message: "scan local mcp plugins"
    });

    expect(second.tasks.pendingCount).toBe(1);
    expect(second.tasks.items).toHaveLength(1);
    expect(second.tasks.items[0]).toMatchObject({
      status: "queued",
      summary: "scan local mcp plugins"
    });
  });
});
