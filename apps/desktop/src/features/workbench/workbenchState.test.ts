import { describe, expect, it } from "vitest";
import {
  createInitialWorkbenchState,
  createOllamaLoadErrorState
} from "./workbenchState";

describe("createInitialWorkbenchState", () => {
  it("uses local Ollama, read-only permission, and 10 rollback points by default", () => {
    const state = createInitialWorkbenchState();

    expect(state.model.label).toBe("Ollama 本地优先");
    expect(state.model.remoteApiEnabled).toBe(false);
    expect(state.settings.remoteApi.baseUrl).toBe("");
    expect(state.settings.remoteApi.collapsed).toBe(true);
    expect(state.permission.mode).toBe("readonly");
    expect(state.rollback.defaultLimit).toBe(10);
    expect(state.rollback.maxLimit).toBe(20);
    expect(state.rollback.entries).toHaveLength(1);
    expect(state.rollback.entries[0]?.label).toBe("启动基线");
  });

  it("keeps a safe rollback record when ollama loading throws", () => {
    const state = createInitialWorkbenchState();

    const updated = createOllamaLoadErrorState(state, "connect ECONNREFUSED 127.0.0.1:11434");

    expect(updated.error?.summary).toBe("无法连接本地 Ollama");
    expect(updated.audit.summary).toBe("Ollama 状态读取失败，工作台保持可用");
    expect(updated.rollback.entries).toHaveLength(2);
    expect(updated.rollback.entries[1]?.label).toBe("异常保护");
  });
});
