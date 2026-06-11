import { describe, expect, it } from "vitest";
import { createInitialWorkbenchState, createUserTaskSubmittedState } from "./workbenchState";

describe("conversation auto compression", () => {
  it("compresses older conversation entries once the desktop history grows too long", () => {
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
    expect(compressedEntry?.title).toBe("Conversation auto-compressed");
    expect(compressedEntry?.summary).toContain("Compressed");
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
    expect(compressedEntry?.summary).toContain("Compressed");
    expect(compressedEntry?.detailLines?.[0]).toContain("Older user messages:");
  });

  it("keeps readable snippets from compressed older messages", () => {
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
  });
});
