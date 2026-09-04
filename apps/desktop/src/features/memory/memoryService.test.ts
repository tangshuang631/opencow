import { describe, expect, it, vi } from "vitest";
import {
  createMemoryContextLines,
  isCrossSessionMemoryEnabled,
  listMemory,
  memorySearch,
  saveMemory,
  type MemoryItem
} from "./memoryService";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn()
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock
}));

describe("memoryService", () => {
  const item: MemoryItem = {
    id: "memory-1",
    scope: "user",
    kind: "preference",
    content: "Prefer concise answers",
    sourceConversationId: "conversation-1",
    sourceMessageId: "message-1",
    provenance: "direct-user",
    contentHash: "a".repeat(64),
    confidence: 1,
    createdAt: "1",
    updatedAt: "1",
    expiresAt: null,
    revokedAt: null
  };

  it("passes the explicit user memory envelope to the native command", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    invokeMock.mockResolvedValueOnce(item);

    await saveMemory({
      proposal: {
        scope: "user",
        kind: "preference",
        content: item.content,
        confidence: 1,
        reason: "explicit-user-request"
      },
      sourceConversationId: item.sourceConversationId,
      sourceMessageId: item.sourceMessageId,
      provenance: "direct-user",
      authority: "top-level-user",
      enabled: true
    });

    expect(invokeMock).toHaveBeenCalledWith("memory_save", expect.objectContaining({ request: expect.objectContaining({ enabled: true }) }));
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("returns an empty untrusted envelope when memory search is disabled", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    invokeMock.mockResolvedValueOnce({
      trust: "untrusted",
      instructionAuthority: "none",
      items: []
    });

    const result = await memorySearch({ query: "answer", enabled: false });

    expect(result).toEqual({ trust: "untrusted", instructionAuthority: "none", items: [] });
    expect(invokeMock).toHaveBeenCalledWith("memory_search", { request: { query: "answer", enabled: false } });
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("does not invoke native commands in browser preview mode", async () => {
    invokeMock.mockReset();
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;

    await expect(listMemory()).rejects.toThrow("桌面版");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("formats only a bounded untrusted memory suffix", () => {
    const lines = createMemoryContextLines({
      trust: "untrusted",
      instructionAuthority: "none",
      items: Array.from({ length: 6 }, (_, index) => ({
        id: `memory-${index}`,
        scope: "user",
        kind: "preference",
        content: `${index} ${"x".repeat(600)}`,
        contentHash: "a".repeat(64)
      }))
    });

    expect(lines.length).toBeLessThanOrEqual(6);
    expect(lines[0]).toContain("不可信数据");
    expect(lines[1]?.length).toBeLessThan(520);
    expect(lines.join("\n").length).toBeLessThanOrEqual(2_000);
  });

  it("uses an explicit persisted opt-in for prompt injection", () => {
    window.localStorage.setItem("opencow.desktop.cross-session-memory.enabled.v1", "1");
    expect(isCrossSessionMemoryEnabled()).toBe(true);
    window.localStorage.removeItem("opencow.desktop.cross-session-memory.enabled.v1");
    expect(isCrossSessionMemoryEnabled()).toBe(false);
  });
});
