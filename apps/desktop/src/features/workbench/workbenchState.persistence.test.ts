import { afterEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { createInitialWorkbenchState } from "./workbenchState.initial";
import {
  clearPersistedWorkbenchState,
  loadPersistedWorkbenchState,
  persistWorkbenchState
} from "./workbenchState.persistence";
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

  it("restores the most recent non-empty conversation after a blank new-conversation state was persisted", async () => {
    const populatedState = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "keep this history after a blank new conversation"
    });

    await persistWorkbenchState(populatedState);

    await persistWorkbenchState({
      ...populatedState,
      conversation: {
        entries: []
      },
      history: {
        lastNonEmptyConversationEntries: populatedState.conversation.entries
      }
    });

    const restored = await loadPersistedWorkbenchState();

    expect(restored.conversation.entries.some((entry) => entry.summary === "keep this history after a blank new conversation")).toBe(true);
    expect(restored.history.lastNonEmptyConversationEntries.some(
      (entry) => entry.summary === "keep this history after a blank new conversation"
    )).toBe(true);
  });
});
