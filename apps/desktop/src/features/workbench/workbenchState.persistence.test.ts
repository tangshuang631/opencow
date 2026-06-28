import { afterEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { createInitialWorkbenchState } from "./workbenchState.initial";
import {
  clearPersistedWorkbenchState,
  loadPersistedWorkbenchState,
  persistWorkbenchState
} from "./workbenchState.persistence";
import { createNewConversationState } from "./workbenchState.conversation";
import { createUserTaskSubmittedState } from "./workbenchState.tasks";

const tauriInternals = "__TAURI_INTERNALS__" as const;

describe("workbenchState.persistence", () => {
  afterEach(() => {
    clearMocks();
    vi.restoreAllMocks();
    window.localStorage.clear();
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals];
  });

  it("loads persisted workbench state through the Tauri command when desktop IPC is available", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};

    const persistedState = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "desktop persisted history"
    });

    mockIPC((cmd) => {
      if (cmd === "workbench_state_load") {
        return {
          found: true,
          payload: {
            version: 1,
            state: persistedState
          }
        };
      }

      return null;
    });

    const restored = await loadPersistedWorkbenchState();

    expect(restored.conversation.entries.some((entry) => entry.summary === "desktop persisted history")).toBe(true);
  });

  it("migrates legacy browser persistence into the native desktop store when no native payload exists yet", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};

    const persistedState = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "legacy browser persisted history"
    });
    window.localStorage.setItem("opencow.desktop.workbench-state.v1", JSON.stringify({
      version: 1,
      state: persistedState
    }));

    const saveSpy = vi.fn();
    mockIPC((cmd, payload) => {
      if (cmd === "workbench_state_load") {
        return {
          found: false,
          payload: null
        };
      }

      if (cmd === "workbench_state_save") {
        saveSpy(payload);
        return null;
      }

      return null;
    });

    const restored = await loadPersistedWorkbenchState();

    expect(restored.conversation.entries.some((entry) => entry.summary === "legacy browser persisted history")).toBe(true);
    expect(saveSpy).toHaveBeenCalledWith({
      payload: {
        version: 1,
        state: persistedState
      }
    });
    expect(window.localStorage.getItem("opencow.desktop.workbench-state.v1")).toBeNull();
  });

  it("falls back to legacy browser persistence when desktop state load fails transiently", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};

    const persistedState = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "recover from desktop persistence failure"
    });
    window.localStorage.setItem("opencow.desktop.workbench-state.v1", JSON.stringify({
      version: 1,
      state: persistedState
    }));

    mockIPC((cmd) => {
      if (cmd === "workbench_state_load") {
        throw new Error("desktop state load failed");
      }

      return null;
    });

    const restored = await loadPersistedWorkbenchState();

    expect(restored.conversation.entries.some(
      (entry) => entry.summary === "recover from desktop persistence failure"
    )).toBe(true);
    expect(window.localStorage.getItem("opencow.desktop.workbench-state.v1")).not.toBeNull();
  });

  it("falls back to browser storage persistence when Tauri desktop IPC is unavailable", async () => {
    const persistedState = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "browser persisted history"
    });

    await persistWorkbenchState(persistedState);

    const restored = await loadPersistedWorkbenchState();

    expect(restored.conversation.entries.some((entry) => entry.summary === "browser persisted history")).toBe(true);

    await clearPersistedWorkbenchState();
    expect(window.localStorage.getItem("opencow.desktop.workbench-state.v1")).toBeNull();
  });

  it("keeps a persisted blank new conversation blank while preserving history for manual restore", async () => {
    const populatedState = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "keep this history after a blank new conversation"
    });

    await persistWorkbenchState(populatedState);

    await persistWorkbenchState(createNewConversationState(populatedState));

    const restored = await loadPersistedWorkbenchState();

    expect(restored.conversation.entries).toHaveLength(0);
    expect(restored.conversation.mode).toBe("blank");
    expect(restored.history.lastNonEmptyConversationEntries.some(
      (entry) => entry.summary === "keep this history after a blank new conversation"
    )).toBe(true);
  });

  it("keeps a restored recent conversation in restored mode after reload", async () => {
    const currentEntries = [
      {
        id: "recent-entry-user",
        kind: "user" as const,
        title: "用户",
        summary: "恢复这段历史会话"
      }
    ];
    const persistedState = {
      ...createInitialWorkbenchState(),
      conversation: {
        entries: currentEntries,
        npcId: "research-bot",
        mode: "restored" as const,
        restoredFromConversationId: "recent-conversation-1"
      },
      npcWorkspace: {
        ...createInitialWorkbenchState().npcWorkspace,
        items: [
          {
            id: "research-bot",
            name: "研究助手",
            description: "负责资料整理",
            defaultModel: "qwen2.5-coder:7b",
            personaPrompt: "",
            outputStyle: "简洁",
            agentDraft: "",
            rulesDraft: "",
            enabledSkillNames: [],
            knowledgeLibraryIds: []
          }
        ]
      },
      history: {
        lastNonEmptyConversationEntries: currentEntries,
        draftConversations: [
          {
            id: "recent-conversation-1",
            title: "恢复这段历史会话",
            summary: "恢复后刷新也应保持恢复态。",
            entries: currentEntries,
            npcId: "research-bot"
          }
        ],
        archivedConversations: []
      }
    };

    await persistWorkbenchState(persistedState);

    const restored = await loadPersistedWorkbenchState();

    expect(restored.conversation.entries[0]?.summary).toBe("恢复这段历史会话");
    expect(restored.conversation.npcId).toBe("research-bot");
    expect(restored.conversation.mode).toBe("restored");
    expect(restored.conversation.restoredFromConversationId).toBe("recent-conversation-1");
  });

  it("drops a persisted conversation NPC when that NPC no longer exists", async () => {
    const persistedState = {
      ...createInitialWorkbenchState(),
      conversation: {
        ...createInitialWorkbenchState().conversation,
        npcId: "missing-bot"
      },
      history: {
        ...createInitialWorkbenchState().history,
        draftConversations: [
          {
            id: "recent-conversation-1",
            title: "旧 NPC 会话",
            summary: "应当静默回退。",
            entries: [],
            npcId: "missing-bot"
          }
        ]
      }
    };

    await persistWorkbenchState(persistedState);

    const restored = await loadPersistedWorkbenchState();

    expect(restored.conversation.npcId).toBeNull();
    expect(restored.history.draftConversations[0]?.npcId).toBeNull();
  });

  it("restores persisted conversation attachments after reload", async () => {
    const persistedState = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "恢复带附件的历史",
      attachments: [
        {
          id: "attachment-1",
          name: "capture.png",
          mimeType: "image/png",
          sizeBytes: 4096,
          kind: "image",
          filePath: "/tmp/capture.png",
          previewUrl: "blob:capture-preview",
          source: "drop"
        }
      ]
    });

    await persistWorkbenchState(persistedState);

    const restored = await loadPersistedWorkbenchState();

    expect(restored.conversation.entries[0]?.attachments?.[0]?.name).toBe("capture.png");
  });

  it("restores persisted ollama long-answer settings after reload", async () => {
    const persistedState = {
      ...createInitialWorkbenchState(),
      settings: {
        ...createInitialWorkbenchState().settings,
        ollama: {
          longAnswerNumPredict: 12288,
          autoContinuationLimit: 7,
          continuationTailLimit: 3600
        }
      }
    };

    await persistWorkbenchState(persistedState);

    const restored = await loadPersistedWorkbenchState();

    expect(restored.settings.ollama.longAnswerNumPredict).toBe(12288);
    expect(restored.settings.ollama.autoContinuationLimit).toBe(7);
    expect(restored.settings.ollama.continuationTailLimit).toBe(3600);
  });

  it("deduplicates repeated draft conversations during persistence restore", async () => {
    const repeatedEntries = [
      {
        id: "recent-entry-user",
        kind: "user" as const,
        title: "用户",
        summary: "哈吉米是什么"
      }
    ];
    const persistedState = {
      ...createInitialWorkbenchState(),
      conversation: {
        entries: repeatedEntries,
        mode: "restored" as const,
        restoredFromConversationId: "recent-conversation-1"
      },
      history: {
        lastNonEmptyConversationEntries: repeatedEntries,
        draftConversations: [
          {
            id: "recent-conversation-1",
            title: "哈吉米是什么",
            summary: "同一条最近会话被重复写入。",
            entries: repeatedEntries,
            archivedAt: null
          },
          {
            id: "recent-conversation-1",
            title: "哈吉米是什么",
            summary: "同一条最近会话被重复写入。",
            entries: repeatedEntries,
            archivedAt: null
          }
        ],
        archivedConversations: []
      }
    };

    await persistWorkbenchState(persistedState);

    const restored = await loadPersistedWorkbenchState();

    expect(restored.history.draftConversations).toHaveLength(1);
    expect(restored.history.draftConversations[0]?.id).toBe("recent-conversation-1");
  });
});
