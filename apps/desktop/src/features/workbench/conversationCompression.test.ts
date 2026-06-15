import { describe, expect, it } from "vitest";
import { createInitialWorkbenchState, createUserTaskSubmittedState } from "./workbenchState";

describe("conversation auto compression", () => {
  it("compresses older conversation entries into a Chinese readable context summary", () => {
    let state = createInitialWorkbenchState();

    for (let index = 0; index < 16; index += 1) {
      state = createUserTaskSubmittedState(state, {
        message: `conversation compression message ${index}`
      });
    }

    expect(state.conversation.entries.length).toBeLessThanOrEqual(12);
    const compressedEntry = state.conversation.entries.find((entry) => entry.id === "conversation-auto-summary");

    expect(compressedEntry).toBeDefined();
    expect(compressedEntry?.kind).toBe("system");
    expect(compressedEntry?.title).toBe("已保留较早会话上下文");
    expect(compressedEntry?.summary).toContain("已压缩");
    expect(compressedEntry?.summary).toContain("条较早消息");
    expect(compressedEntry?.detailLines?.[0]).toContain("较早用户消息");
    expect(compressedEntry?.detailLines?.[1]).toContain("较早助手或系统消息");
  });

  it("keeps an auto-compressed summary present while the conversation continues to grow", () => {
    let state = createInitialWorkbenchState();

    for (let index = 0; index < 13; index += 1) {
      state = createUserTaskSubmittedState(state, {
        message: `persistent compression message ${index}`
      });
    }

    expect(state.conversation.entries.some((entry) => entry.id === "conversation-auto-summary")).toBe(true);
    expect(state.conversation.entries).toHaveLength(12);
    expect(state.conversation.entries.filter((entry) => entry.id === "conversation-auto-summary")).toHaveLength(1);
  });

  it("accumulates compression counts as older conversation history keeps getting folded", () => {
    let state = createInitialWorkbenchState();

    for (let index = 0; index < 18; index += 1) {
      state = createUserTaskSubmittedState(state, {
        message: `accumulated compression message ${index}`
      });
    }

    const compressedEntry = state.conversation.entries.find((entry) => entry.id === "conversation-auto-summary");

    expect(compressedEntry).toBeDefined();
    expect(compressedEntry?.summary).toContain("已压缩");
    expect(compressedEntry?.detailLines?.[0]).toContain("较早用户消息");
  });

  it("keeps readable Chinese-labeled snippets from compressed older messages", () => {
    let state = createInitialWorkbenchState();

    for (let index = 0; index < 16; index += 1) {
      state = createUserTaskSubmittedState(state, {
        message: index === 0
          ? "preserve workspace root repair context in the compressed summary"
          : `routine long conversation message ${index}`
      });
    }

    const compressedEntry = state.conversation.entries.find((entry) => entry.id === "conversation-auto-summary");
    const detail = compressedEntry?.detailLines?.join("\n") ?? "";

    expect(detail).toContain("preserve workspace root repair context in the compressed summary");
    expect(detail).toContain("保留片段");
  });

  it("migrates previously persisted English compression metadata into the Chinese summary", () => {
    const initial = createInitialWorkbenchState();
    const state = {
      ...initial,
      conversation: {
        entries: [
          {
            id: "conversation-auto-summary",
            kind: "system" as const,
            title: "Conversation auto-compressed",
            summary: "Compressed 5 older messages to keep the desktop context light.",
            detailLines: [
              "Older user messages: 4",
              "Older assistant or system messages: 1",
              "Compressed highlights: 用户, 模型答复",
              "Compressed snippets: [user] 用户: old persisted workspace context"
            ]
          },
          ...Array.from({ length: 11 }, (_, index) => ({
            id: `recent-entry-${index}`,
            kind: "user" as const,
            title: "用户",
            summary: `recent conversation ${index}`
          }))
        ]
      }
    };

    const next = createUserTaskSubmittedState(state, {
      message: "new message after old persisted compression"
    });
    const compressedEntry = next.conversation.entries.find((entry) => entry.id === "conversation-auto-summary");
    const detail = compressedEntry?.detailLines?.join("\n") ?? "";

    expect(compressedEntry?.title).toBe("已保留较早会话上下文");
    expect(compressedEntry?.summary).toContain("已压缩 6 条较早消息");
    expect(detail).toContain("较早用户消息：5");
    expect(detail).toContain("较早助手或系统消息：1");
    expect(detail).toContain("old persisted workspace context");
  });
});
