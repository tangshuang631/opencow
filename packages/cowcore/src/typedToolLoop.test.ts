import { describe, expect, it } from "vitest";
import { runTypedToolLoop, type ToolLoopTurn } from "./typedToolLoop.js";

describe("runTypedToolLoop", () => {
  it("executes only fixture tools and returns the final model turn", async () => {
    const turns: ToolLoopTurn[] = [
      { kind: "tool-call", calls: [{ id: "call-1", name: "diagnostic.read", arguments: { path: "." } }] },
      { kind: "final", content: "工作区可读。" }
    ];
    const result = await runTypedToolLoop({
      invokeModel: async () => turns.shift() ?? { kind: "final", content: "" },
      tools: [{ name: "diagnostic.read", effect: "readonly", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string" } } }, execute: async () => ({ ok: true }) }]
    });

    expect(result).toEqual({ status: "completed", content: "工作区可读。", toolCallCount: 1, turnCount: 2 });
  });

  it("fails closed on malformed arguments, duplicate call ids, and budget overflow", async () => {
    const malformed = await runTypedToolLoop({
      invokeModel: async () => ({ kind: "tool-call", calls: [{ id: "bad", name: "diagnostic.read", arguments: {} }] }),
      tools: [{ name: "diagnostic.read", effect: "readonly", inputSchema: { type: "object", required: ["path"], properties: { path: { type: "string" } } }, execute: async () => ({ ok: true }) }]
    });
    expect(malformed.status).toBe("blocked");
    expect(malformed.toolCallCount).toBe(0);

    const duplicate = await runTypedToolLoop({
      invokeModel: async () => ({ kind: "tool-call", calls: [{ id: "same", name: "diagnostic.read", arguments: { path: "." } }] }),
      tools: [{ name: "diagnostic.read", effect: "readonly", inputSchema: { type: "object", properties: { path: { type: "string" } } }, execute: async () => ({ ok: true }) }]
    });
    expect(duplicate.status).toBe("blocked");
    if (duplicate.status === "blocked") expect(duplicate.reason).toMatch(/duplicate|budget/i);

    const overflow = await runTypedToolLoop({
      maxTurns: 1,
      invokeModel: async () => ({ kind: "tool-call", calls: [{ id: crypto.randomUUID(), name: "diagnostic.read", arguments: { path: "." } }] }),
      tools: [{ name: "diagnostic.read", effect: "readonly", inputSchema: { type: "object", properties: { path: { type: "string" } } }, execute: async () => ({ ok: true }) }]
    });
    expect(overflow.status).toBe("blocked");
    if (overflow.status === "blocked") expect(overflow.reason).toContain("turn");
  });

  it("rejects non-fixture effects and observes cancellation before a tool runs", async () => {
    const hostTool = await runTypedToolLoop({
      invokeModel: async () => ({ kind: "tool-call", calls: [{ id: "host", name: "host.write", arguments: {} }] }),
      tools: [{ name: "host.write", effect: "write", inputSchema: { type: "object" }, execute: async () => ({ ok: true }) }]
    });
    expect(hostTool.status).toBe("blocked");

    const controller = new AbortController();
    controller.abort();
    const cancelled = await runTypedToolLoop({ invokeModel: async () => ({ kind: "final", content: "nope" }), signal: controller.signal });
    expect(cancelled.status).toBe("cancelled");
  });

  it("re-plans after a rejected final answer and exposes observations to the next turn", async () => {
    const feedback: Array<string | undefined> = [];
    const result = await runTypedToolLoop({
      maxTurns: 3,
      invokeModel: async ({ turn, feedback: nextFeedback, observations }) => {
        feedback.push(nextFeedback);
        expect(observations.length).toBe(turn - 1);
        return { kind: "final", content: turn === 1 ? "带来源 URL 的回答" : "干净的最终回答" };
      },
      validateFinal: (content) => content.includes("URL")
        ? { ok: false, reason: "answer-protocol-leak", feedback: "删除 URL，只输出正文。" }
        : { ok: true }
    });

    expect(result).toEqual({ status: "completed", content: "干净的最终回答", toolCallCount: 0, turnCount: 2 });
    expect(feedback).toEqual([undefined, "删除 URL，只输出正文。"]);
  });
});
