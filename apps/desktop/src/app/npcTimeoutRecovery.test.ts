import { describe, expect, it } from "vitest";
import { getNpcConfigReadonlyDraftRetryMessage } from "./npcTimeoutRecovery";
import type { LocalTaskItem } from "../features/workbench/workbenchState";

function createFailedTask(overrides: Partial<LocalTaskItem>): LocalTaskItem {
  return {
    id: "task-1",
    source: "composer",
    status: "failed",
    summary: "解释一下享元模式",
    attemptCount: 1,
    lastFailureDetail:
      "Local task exceeded the maximum execution time of 480 seconds. Local model chat diagnostics: executionKind=local-model-chat; streamPhase=waiting-first-chunk;",
    ...overrides
  };
}

describe("npcTimeoutRecovery", () => {
  it("routes ordinary local-model NPC config timeout retries into a readonly draft request", () => {
    const retryMessage = getNpcConfigReadonlyDraftRetryMessage(createFailedTask({
      executionKind: "local-model-chat",
      summary: "你能帮我创建一个课程助手npc吗"
    }));

    expect(retryMessage).toContain("先给我这个 NPC 的只读草案，不要保存配置。");
    expect(retryMessage).toContain("原始请求：你能帮我创建一个课程助手npc吗");
  });

  it("routes explicit npc-config-write timeout retries into a readonly draft request", () => {
    const retryMessage = getNpcConfigReadonlyDraftRetryMessage(createFailedTask({
      executionKind: "npc-config-write",
      summary: "帮我配置一个文档处理 NPC"
    }));

    expect(retryMessage).toContain("只读草案");
    expect(retryMessage).toContain("原始请求：帮我配置一个文档处理 NPC");
  });

  it("leaves ordinary local-model chat timeouts on the normal chat retry path", () => {
    const retryMessage = getNpcConfigReadonlyDraftRetryMessage(createFailedTask({
      executionKind: "local-model-chat",
      summary: "解释一下享元模式"
    }));

    expect(retryMessage).toBeNull();
  });

  it("does not route npc-like failures without timeout diagnostics into a readonly draft request", () => {
    const retryMessage = getNpcConfigReadonlyDraftRetryMessage(createFailedTask({
      executionKind: "local-model-chat",
      summary: "你能帮我创建一个课程助手npc吗",
      lastFailureDetail: "Local model returned an empty response."
    }));

    expect(retryMessage).toBeNull();
  });
});
