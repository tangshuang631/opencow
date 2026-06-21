import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { createInitialWorkbenchState } from "../features/workbench/workbenchState.initial";
import * as workbenchPersistence from "../features/workbench/workbenchState.persistence";

const tauriInternals = "__TAURI_INTERNALS__" as const;
const tauriEventPluginInternals = "__TAURI_EVENT_PLUGIN_INTERNALS__" as const;

const { cancelOllamaChatMock, chatWithOllamaModelMock, loadOllamaOverviewMock } = vi.hoisted(() => ({
  cancelOllamaChatMock: vi.fn(),
  chatWithOllamaModelMock: vi.fn(),
  loadOllamaOverviewMock: vi.fn()
}));

vi.mock("../features/ollama/ollamaService", () => ({
  cancelOllamaChat: cancelOllamaChatMock,
  chatWithOllamaModel: chatWithOllamaModelMock,
  loadOllamaOverview: loadOllamaOverviewMock
}));

function getComposerInput() {
  return screen.getByLabelText("输入任务");
}

function getComposerSendButton() {
  return screen.getByRole("button", { name: "发送" });
}

function getConversationRegion() {
  return screen.getByRole("region", { name: "会话" });
}

function openConversationDropdown() {
  fireEvent.click(screen.getByRole("button", { name: "会话" }));
}

function openSettingsRestorePanel() {
  fireEvent.click(screen.getByRole("button", { name: "设置" }));
  return screen.getByLabelText("设置");
}

function getPersistedConversationEntries(
  state: Awaited<ReturnType<typeof workbenchPersistence.readPersistedWorkbenchState>>
) {
  return state?.conversation.entries.map((entry) => entry.summary) ?? [];
}

describe("App workbench persistence", () => {
  beforeEach(() => {
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals];
    (window as typeof window & { __TAURI_EVENT_PLUGIN_INTERNALS__?: unknown })[tauriEventPluginInternals] = {
      unregisterListener: vi.fn()
    };
    window.localStorage.clear();
    cancelOllamaChatMock.mockReset();
    chatWithOllamaModelMock.mockReset();
    loadOllamaOverviewMock.mockReset();
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
  });

  afterEach(() => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {
      transformCallback: vi.fn((callback: unknown) => callback),
      invoke: vi.fn(async () => null),
      metadata: {
        currentWindow: {
          label: "main"
        }
      }
    };
  });

  it("restores conversation history after the app remounts", async () => {
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "历史记录恢复测试回答。"
    });

    const firstRender = render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(getComposerInput(), {
      target: { value: "帮我记住这一轮对话" }
    });
    fireEvent.click(getComposerSendButton());

    const firstConversation = getConversationRegion();
    await waitFor(() => {
      expect(within(firstConversation).getAllByText("帮我记住这一轮对话").length).toBeGreaterThan(0);
      expect(within(firstConversation).getByText("历史记录恢复测试回答。")).toBeInTheDocument();
    });

    firstRender.unmount();

    render(<App />);

    const restoredConversation = await screen.findByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(restoredConversation).getAllByText("帮我记住这一轮对话").length).toBeGreaterThan(0);
      expect(within(restoredConversation).getByText("历史记录恢复测试回答。")).toBeInTheDocument();
    });
  });

  it("keeps the conversation cleared across remounts after the user manually clears it", async () => {
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "这条历史稍后应该被手动清掉。"
    });

    const firstRender = render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(getComposerInput(), {
      target: { value: "生成一条会被清空的历史" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(screen.getAllByText("生成一条会被清空的历史").length).toBeGreaterThan(0);
      expect(screen.getByText("这条历史稍后应该被手动清掉。")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.click(screen.getByRole("button", { name: "清空会话" }));
    fireEvent.click(screen.getByRole("button", { name: "创建新会话" }));

    const clearedConversation = getConversationRegion();
    await waitFor(() => {
      expect(within(clearedConversation).queryByText("最近会话")).not.toBeInTheDocument();
      expect(within(clearedConversation).queryByText("生成一条会被清空的历史")).not.toBeInTheDocument();
      expect(within(clearedConversation).queryByText("这条历史稍后应该被手动清掉。")).not.toBeInTheDocument();
    });

    firstRender.unmount();

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "创建新会话" }));

    const restoredConversation = getConversationRegion();
    await waitFor(() => {
      expect(within(restoredConversation).queryByText("最近会话")).not.toBeInTheDocument();
      expect(within(restoredConversation).queryByText("生成一条会被清空的历史")).not.toBeInTheDocument();
      expect(within(restoredConversation).queryByText("这条历史稍后应该被手动清掉。")).not.toBeInTheDocument();
    });
  });

  it("does not overwrite persisted history with the initial blank state during hydration", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {
      transformCallback: vi.fn((callback: unknown) => callback),
      invoke: vi.fn(async (cmd: string) => {
        if (cmd === "plugin:event|listen") {
          return 1;
        }

        if (cmd === "plugin:event|unlisten") {
          return null;
        }

        if (cmd === "workbench_state_load") {
          return { found: false, payload: null };
        }

        return null;
      }),
      unregisterListener: vi.fn(),
      metadata: {
        currentWindow: {
          label: "main"
        }
      }
    };
    const readPersistedSpy = vi.spyOn(workbenchPersistence, "readPersistedWorkbenchState");
    const persistSpy = vi.spyOn(workbenchPersistence, "persistWorkbenchState");
    const deferred = {} as {
      resolve: (value: Awaited<ReturnType<typeof workbenchPersistence.readPersistedWorkbenchState>>) => void;
      promise: Promise<Awaited<ReturnType<typeof workbenchPersistence.readPersistedWorkbenchState>>>;
    };

    deferred.promise = new Promise((resolve) => {
      deferred.resolve = resolve;
    });

    const persistedState = {
      ...createInitialWorkbenchState(),
      conversation: {
        entries: [
          {
            id: "restored-entry",
            kind: "user" as const,
            title: "用户",
            summary: "保留的历史记录"
          }
        ]
      }
    };

    readPersistedSpy.mockReturnValueOnce(deferred.promise);
    persistSpy.mockResolvedValue(undefined);

    render(<App />);

    await act(async () => {
      deferred.resolve(persistedState);
      await Promise.resolve();
    });

    const restoredConversation = await screen.findByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(restoredConversation).getAllByText("保留的历史记录").length).toBeGreaterThan(0);
    });
    expect(
      persistSpy.mock.calls.some(([state]) => getPersistedConversationEntries(state).includes("保留的历史记录"))
    ).toBe(true);
    expect(
      persistSpy.mock.calls.some(([state]) =>
        getPersistedConversationEntries(state).length === 0
        && state.history.lastNonEmptyConversationEntries.length === 0
      )
    ).toBe(false);

    await waitFor(() => {
      expect(loadOllamaOverviewMock).toHaveBeenCalled();
    });

    readPersistedSpy.mockRestore();
    persistSpy.mockRestore();
  }, 15_000);

  it("keeps a persisted blank conversation blank after remount while preserving the archived conversation in settings restore", async () => {
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "这段答复应该在重新进入后继续保留。"
    });

    const firstRender = render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(getComposerInput(), {
      target: { value: "请保留这次会话历史" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(screen.getAllByText("请保留这次会话历史").length).toBeGreaterThan(0);
      expect(screen.getByText("这段答复应该在重新进入后继续保留。")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "归档当前会话" }));
    const settingsPanel = openSettingsRestorePanel();

    await waitFor(() => {
      expect(within(settingsPanel).getByText("请保留这次会话历史")).toBeInTheDocument();
      expect(within(settingsPanel).getByRole("button", { name: "恢复会话" })).toBeInTheDocument();
    });

    await waitFor(() => {
      const persisted = workbenchPersistence.loadPersistedWorkbenchStateFromBrowserStorage(createInitialWorkbenchState);

      expect(persisted.conversation.entries).toHaveLength(0);
      expect(persisted.history.archivedConversations.length).toBeGreaterThan(0);
      expect(persisted.history.archivedConversations[0]?.entries.some((entry) =>
        entry.summary.includes("请保留这次会话历史")
      )).toBe(true);
      expect(persisted.history.archivedConversations[0]?.entries.some((entry) =>
        entry.summary.includes("这段答复应该在重新进入后继续保留。")
      )).toBe(true);
    });

    firstRender.unmount();

    render(<App />);

    const restoredConversation = await screen.findByRole("region", { name: "会话" });
    const restoredSettingsPanel = openSettingsRestorePanel();
    await waitFor(() => {
      expect(within(restoredConversation).queryByText("请保留这次会话历史")).not.toBeInTheDocument();
      expect(within(restoredConversation).queryByText("这段答复应该在重新进入后继续保留。")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(within(restoredSettingsPanel).getByText("请保留这次会话历史")).toBeInTheDocument();
      expect(within(restoredSettingsPanel).getByRole("button", { name: "恢复会话" })).toBeInTheDocument();
    });
  }, 15_000);

  it("restores a recent conversation from the blank conversation history list", async () => {
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "恢复后应该重新看到这段答复。"
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(getComposerInput(), {
      target: { value: "请把这段对话放进最近会话" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(screen.getAllByText("请把这段对话放进最近会话").length).toBeGreaterThan(0);
      expect(screen.getByText("恢复后应该重新看到这段答复。")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "归档当前会话" }));
    const settingsPanel = openSettingsRestorePanel();

    await waitFor(() => {
      expect(within(settingsPanel).getByText("请把这段对话放进最近会话")).toBeInTheDocument();
    });

    fireEvent.click(within(settingsPanel).getByRole("button", { name: "恢复会话" }));

    await waitFor(() => {
      expect(screen.getAllByText("请把这段对话放进最近会话").length).toBeGreaterThan(0);
      expect(screen.getByText("恢复后应该重新看到这段答复。")).toBeInTheDocument();
    });
  });

  it("keeps a deleted recent conversation removed after remount", async () => {
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "这段会话删除后不应该再从最近会话里恢复。"
    });

    const firstRender = render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(getComposerInput(), {
      target: { value: "删除后不要再看到这段最近会话" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(screen.getAllByText("删除后不要再看到这段最近会话").length).toBeGreaterThan(0);
      expect(screen.getByText("这段会话删除后不应该再从最近会话里恢复。")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "创建新会话" }));
    const settingsPanel = openSettingsRestorePanel();

    await waitFor(() => {
      expect(within(settingsPanel).getByText("删除后不要再看到这段最近会话")).toBeInTheDocument();
    });

    fireEvent.click(within(settingsPanel).getByRole("button", { name: "永久删除" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

    await waitFor(() => {
      expect(screen.queryByText("删除后不要再看到这段最近会话")).not.toBeInTheDocument();
    });

    firstRender.unmount();

    render(<App />);

    const restoredConversation = await screen.findByRole("region", { name: "会话" });
    const restoredSettingsPanel = openSettingsRestorePanel();
    await waitFor(() => {
      expect(within(restoredSettingsPanel).queryByText("删除后不要再看到这段最近会话")).not.toBeInTheDocument();
      expect(within(restoredConversation).queryByText("删除后不要再看到这段最近会话")).not.toBeInTheDocument();
    });
  });
});
