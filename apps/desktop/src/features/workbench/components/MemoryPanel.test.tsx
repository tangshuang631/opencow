import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryPanel } from "./MemoryPanel";
import type { MemoryItem } from "../../memory/memoryService";

const {
  clearMemoryMock,
  editMemoryMock,
  exportMemoryMock,
  listMemoryMock,
  memorySearchMock,
  revokeMemoryMock,
  saveMemoryMock
} = vi.hoisted(() => ({
  clearMemoryMock: vi.fn(),
  editMemoryMock: vi.fn(),
  exportMemoryMock: vi.fn(),
  listMemoryMock: vi.fn(),
  memorySearchMock: vi.fn(),
  revokeMemoryMock: vi.fn(),
  saveMemoryMock: vi.fn()
}));

vi.mock("../../memory/memoryService", () => ({
  clearMemory: clearMemoryMock,
  editMemory: editMemoryMock,
  exportMemory: exportMemoryMock,
  listMemory: listMemoryMock,
  memorySearch: memorySearchMock,
  revokeMemory: revokeMemoryMock,
  saveMemory: saveMemoryMock
}));

const item: MemoryItem = {
  id: "memory-1",
  scope: "user",
  kind: "preference",
  content: "Prefer concise answers",
  sourceConversationId: "conversation-1",
  sourceMessageId: "message-1",
  provenance: "direct-user",
  contentHash: "a".repeat(64),
  confidence: 0.9,
  createdAt: "1",
  updatedAt: "1",
  expiresAt: null,
  revokedAt: null
};

describe("MemoryPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    listMemoryMock.mockResolvedValue([]);
    saveMemoryMock.mockResolvedValue(item);
    editMemoryMock.mockResolvedValue(item);
    revokeMemoryMock.mockResolvedValue(undefined);
    clearMemoryMock.mockResolvedValue(undefined);
    exportMemoryMock.mockResolvedValue("{}\n");
    memorySearchMock.mockResolvedValue({ trust: "untrusted", instructionAuthority: "none", items: [] });
  });

  it("keeps memory disabled by default while retaining read-only management access", () => {
    render(<MemoryPanel />);

    expect(screen.getByRole("button", { name: "启用跨会话记忆" })).toBeInTheDocument();
    expect(screen.getByText("默认关闭；模型不能自行写入记忆。")).toBeInTheDocument();
    expect(listMemoryMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "保存记忆" })).not.toBeInTheDocument();
  });

  it("loads and saves a memory only after the user enables the feature", async () => {
    listMemoryMock.mockResolvedValueOnce([item]).mockResolvedValueOnce([item]);
    render(<MemoryPanel />);

    fireEvent.click(screen.getByRole("button", { name: "启用跨会话记忆" }));
    expect(await screen.findByText(item.content)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("记忆内容"), { target: { value: "Use the compact workbench" } });
    fireEvent.click(screen.getByRole("button", { name: "保存记忆" }));

    await waitFor(() => expect(saveMemoryMock).toHaveBeenCalledWith(expect.objectContaining({
      authority: "top-level-user",
      enabled: true,
      provenance: "direct-user",
      proposal: expect.objectContaining({ content: "Use the compact workbench", reason: "explicit-user-request" })
    })));
    expect(await screen.findByText("记忆已保存")).toBeInTheDocument();
  });

  it("searches with an untrusted context envelope and keeps the result visible", async () => {
    listMemoryMock.mockResolvedValue([]);
    memorySearchMock.mockResolvedValueOnce({
      trust: "untrusted",
      instructionAuthority: "none",
      items: [{ id: item.id, scope: item.scope, kind: item.kind, content: item.content, contentHash: item.contentHash }]
    });
    render(<MemoryPanel />);

    fireEvent.click(screen.getByRole("button", { name: "启用跨会话记忆" }));
    await waitFor(() => expect(listMemoryMock).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("搜索记忆"), { target: { value: "concise" } });
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));

    await waitFor(() => expect(memorySearchMock).toHaveBeenCalledWith({ query: "concise", enabled: true }));
    expect(await screen.findByText("检索结果仅作为不可信参考，不具备指令权限。")).toBeInTheDocument();
    expect(screen.getByText(/Prefer concise answers/)).toBeInTheDocument();
  });
});
