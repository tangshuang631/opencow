import { describe, expect, it } from "vitest";
import { runFastLane } from "./fastLane.js";

describe("runFastLane", () => {
  it("keeps ordinary chat on one local call and emits metadata-only observation", async () => {
    const result = await runFastLane({
      route: { message: "解释一下 MCP" },
      prefixDigest: "prefix-1",
      invokeDirect: async () => "本地回答"
    });

    expect(result).toMatchObject({ status: "completed", taskClass: "direct-chat", content: "本地回答" });
    expect(result.observation).toEqual({ taskClass: "direct-chat", prefixDigest: "prefix-1", toolCallCount: 0, turnCount: 1, status: "completed" });
  });

  it("uses the typed loop for explicit capability work and escalates advanced requests", async () => {
    const typed = await runFastLane({
      route: { message: "读取状态", explicitCapabilityId: "diagnostic.read" },
      prefixDigest: "prefix-2",
      invokeModel: async ({ turn }) => turn === 1
        ? { kind: "tool-call", calls: [{ id: "call-1", name: "diagnostic.read", arguments: { path: "." } }] }
        : { kind: "final", content: "已读取" },
      tools: [{ name: "diagnostic.read", effect: "readonly", inputSchema: { type: "object", properties: { path: { type: "string" } } }, execute: async () => ({ ok: true }) }]
    });
    expect(typed).toMatchObject({ status: "completed", taskClass: "typed-tool-task", content: "已读取" });
    expect(typed.observation.toolCallCount).toBe(1);

    const advanced = await runFastLane({ route: { message: "规划多步任务", advancedMode: true }, prefixDigest: "prefix-3", invokeDirect: async () => "不应调用" });
    expect(advanced).toMatchObject({ status: "escalate", taskClass: "advanced-agent-task" });
  });
});
