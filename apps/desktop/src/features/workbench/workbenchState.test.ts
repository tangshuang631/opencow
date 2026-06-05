import { describe, expect, it } from "vitest";
import { createInitialWorkbenchState } from "./workbenchState";

describe("createInitialWorkbenchState", () => {
  it("uses local Ollama, read-only permission, and 10 rollback points by default", () => {
    const state = createInitialWorkbenchState();

    expect(state.model.label).toBe("Ollama 本地优先");
    expect(state.model.remoteApiEnabled).toBe(false);
    expect(state.permission.mode).toBe("readonly");
    expect(state.rollback.defaultLimit).toBe(10);
    expect(state.rollback.maxLimit).toBe(20);
  });
});
