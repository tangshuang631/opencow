import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

async function click(element: Element) {
  const user =
    typeof vi.isFakeTimers === "function" && vi.isFakeTimers()
      ? userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      : userEvent.setup();
  await user.click(element);
}

async function change(element: Element, value: string) {
  const user =
    typeof vi.isFakeTimers === "function" && vi.isFakeTimers()
      ? userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      : userEvent.setup();
  await user.clear(element as HTMLElement);
  await user.type(element as HTMLElement, value);
}

function setupUser() {
  return typeof vi.isFakeTimers === "function" && vi.isFakeTimers()
    ? userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    : userEvent.setup();
}

const { minimizeMock, destroyMock, onCloseRequestedMock, listenMock, unlistenMock } = vi.hoisted(() => ({
  minimizeMock: vi.fn(),
  destroyMock: vi.fn(),
  onCloseRequestedMock: vi.fn(),
  listenMock: vi.fn(),
  unlistenMock: vi.fn()
}));

const {
  pickChatAttachmentsMock,
  cancelOllamaChatMock,
  chatWithOllamaModelMock,
  loadOllamaOverviewMock,
  loadKnowledgeInventoryMock,
  loadOpenClawCapabilityOverviewMock,
  loadWorkspaceOverviewMock,
  loadWorkspacePackagesOverviewMock,
  loadWorkspaceConfigOverviewMock,
  searchLocalKnowledgeMock,
  searchNetworkMock,
  scanLocalSkillsMock,
  inspectLocalSkillMock,
  scanLocalMcpPluginsMock,
  inspectLocalMcpPluginMock,
  previewLocalMcpPluginStartMock,
  enableLocalSkillMock,
  installLocalSkillMock,
  createKnowledgeLibraryMock,
  importKnowledgeFileMock,
  listEnabledLocalSkillsMock,
  removeKnowledgeFileMock,
  clearKnowledgeImportsMock,
  disableLocalSkillMock,
  matchEnabledLocalSkillsMock,
  runReadonlyShellCommandMock,
  runWorkspaceWriteShellCommandMock,
  runControlledFullShellCommandMock,
  restoreRollbackFilesMock,
  writeNpcConfigMock,
  loadNpcWorkspaceMock,
  loadNpcWorkspaceConfigMock,
  createNpcWorkspaceConfigMock,
  updateNpcWorkspaceConfigMock
} = vi.hoisted(() => ({
  pickChatAttachmentsMock: vi.fn(),
  cancelOllamaChatMock: vi.fn(),
  chatWithOllamaModelMock: vi.fn(),
  loadOllamaOverviewMock: vi.fn(),
  loadKnowledgeInventoryMock: vi.fn(),
  loadOpenClawCapabilityOverviewMock: vi.fn(),
  loadWorkspaceOverviewMock: vi.fn(),
  loadWorkspacePackagesOverviewMock: vi.fn(),
  loadWorkspaceConfigOverviewMock: vi.fn(),
  searchLocalKnowledgeMock: vi.fn(),
  searchNetworkMock: vi.fn(),
  scanLocalSkillsMock: vi.fn(),
  inspectLocalSkillMock: vi.fn(),
  scanLocalMcpPluginsMock: vi.fn(),
  inspectLocalMcpPluginMock: vi.fn(),
  previewLocalMcpPluginStartMock: vi.fn(),
  enableLocalSkillMock: vi.fn(),
  installLocalSkillMock: vi.fn(),
  createKnowledgeLibraryMock: vi.fn(),
  importKnowledgeFileMock: vi.fn(),
  listEnabledLocalSkillsMock: vi.fn(),
  removeKnowledgeFileMock: vi.fn(),
  clearKnowledgeImportsMock: vi.fn(),
  disableLocalSkillMock: vi.fn(),
  matchEnabledLocalSkillsMock: vi.fn(),
  runReadonlyShellCommandMock: vi.fn(),
  runWorkspaceWriteShellCommandMock: vi.fn(),
  runControlledFullShellCommandMock: vi.fn(),
  restoreRollbackFilesMock: vi.fn(),
  writeNpcConfigMock: vi.fn(),
  loadNpcWorkspaceMock: vi.fn(),
  loadNpcWorkspaceConfigMock: vi.fn(),
  createNpcWorkspaceConfigMock: vi.fn(),
  updateNpcWorkspaceConfigMock: vi.fn()
}));

vi.mock("../features/workbench/chatAttachments", async () => {
  const actual = await vi.importActual<typeof import("../features/workbench/chatAttachments")>(
    "../features/workbench/chatAttachments"
  );

  return {
    ...actual,
    pickChatAttachments: pickChatAttachmentsMock
  };
});

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: onCloseRequestedMock,
    listen: listenMock,
    minimize: minimizeMock,
    destroy: destroyMock
  })
}));

vi.mock("../features/ollama/ollamaService", () => ({
  cancelOllamaChat: cancelOllamaChatMock,
  chatWithOllamaModel: chatWithOllamaModelMock,
  loadOllamaOverview: loadOllamaOverviewMock
}));

vi.mock("../features/assistant/localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("../features/assistant/localAssistantService")>(
    "../features/assistant/localAssistantService"
  );

  return {
    ...actual,
    loadKnowledgeInventory: loadKnowledgeInventoryMock,
    loadOpenClawCapabilityOverview: loadOpenClawCapabilityOverviewMock,
    loadWorkspaceOverview: loadWorkspaceOverviewMock,
    loadWorkspacePackagesOverview: loadWorkspacePackagesOverviewMock,
    loadWorkspaceConfigOverview: loadWorkspaceConfigOverviewMock,
    searchLocalKnowledge: searchLocalKnowledgeMock,
    searchNetwork: searchNetworkMock,
    scanLocalSkills: scanLocalSkillsMock,
    inspectLocalSkill: inspectLocalSkillMock,
    scanLocalMcpPlugins: scanLocalMcpPluginsMock,
    inspectLocalMcpPlugin: inspectLocalMcpPluginMock,
    previewLocalMcpPluginStart: previewLocalMcpPluginStartMock,
    enableLocalSkill: enableLocalSkillMock,
    installLocalSkill: installLocalSkillMock,
    createKnowledgeLibrary: createKnowledgeLibraryMock,
    importKnowledgeFile: importKnowledgeFileMock,
    listEnabledLocalSkills: listEnabledLocalSkillsMock,
    removeKnowledgeFile: removeKnowledgeFileMock,
    clearKnowledgeImports: clearKnowledgeImportsMock,
    disableLocalSkill: disableLocalSkillMock,
    matchEnabledLocalSkills: matchEnabledLocalSkillsMock,
    runReadonlyShellCommand: runReadonlyShellCommandMock,
    runWorkspaceWriteShellCommand: runWorkspaceWriteShellCommandMock,
    runControlledFullShellCommand: runControlledFullShellCommandMock,
    restoreRollbackFiles: restoreRollbackFilesMock,
    writeNpcConfig: writeNpcConfigMock,
    loadNpcWorkspace: loadNpcWorkspaceMock,
    loadNpcWorkspaceConfig: loadNpcWorkspaceConfigMock,
    createNpcWorkspaceConfig: createNpcWorkspaceConfigMock,
    updateNpcWorkspaceConfig: updateNpcWorkspaceConfigMock
  };
});

function getComposerInput() {
  return screen.getByLabelText("输入任务");
}

function getComposerSendButton() {
  return screen.getByRole("button", { name: "发送" });
}

async function submitComposerMessage(message: string) {
  fireEvent.change(getComposerInput(), {
    target: { value: message }
  });
  await click(getComposerSendButton());
}

async function approvePermissionRequest(container?: HTMLElement) {
  const scope = container ? within(container) : screen;
  const button =
    scope.queryByRole("button", { name: "批准" })
    ?? scope.queryByRole("button", { name: "批准提权" })
    ?? screen.queryByRole("button", { name: "批准" })
    ?? screen.queryByRole("button", { name: "批准提权" })
    ?? await screen.findByRole("button", { name: /批准|批准提权/ });
  await click(button);
}

async function approveDangerousConfirmation(container?: HTMLElement) {
  const confirmationTitles = [
    ...screen.queryAllByText("等待高风险确认"),
    ...screen.queryAllByText(/待确认高风险操作/i)
  ];
  const confirmationSection =
    confirmationTitles
      .map((node) => node.closest("section") ?? node.closest("aside") ?? node.parentElement)
      .find((candidate): candidate is HTMLElement => {
        if (!(candidate instanceof HTMLElement)) {
          return false;
        }

        const scoped = within(candidate);
        return Boolean(
          scoped.queryByRole("button", { name: "批准高风险操作" })
          || scoped.queryByRole("button", { name: "批准" })
        );
      })
    ?? (container instanceof HTMLElement ? container : document.body);
  const scope = within(confirmationSection);
  const button =
    scope.queryByRole("button", { name: "批准高风险操作" })
    ?? scope.queryByRole("button", { name: "批准" })
    ?? screen.queryByRole("button", { name: "批准高风险操作" })
    ?? await screen.findByRole("button", { name: /批准高风险操作|批准/ });
  await click(button);
}

async function openSidebarDestination(name: string) {
  await click(screen.getByRole("button", { name }));
}

function submitComposerMessageFast(message: string) {
  fireEvent.change(getComposerInput(), {
    target: { value: message }
  });
  fireEvent.click(getComposerSendButton());
}

function getConversationRegion() {
  return screen.getByRole("region", { name: "会话" });
}

function findModelPicker(modelName: string) {
  return screen.findByRole("button", { name: `选择模型：${modelName}` });
}

describe("App", () => {
  beforeEach(() => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {
        metadata: { currentWindow: { label: "main" } },
        invoke: vi.fn()
      }
    });
    cancelOllamaChatMock.mockReset();
    chatWithOllamaModelMock.mockReset();
    loadOllamaOverviewMock.mockReset();
    loadKnowledgeInventoryMock.mockReset();
    pickChatAttachmentsMock.mockReset();
    loadOpenClawCapabilityOverviewMock.mockReset();
    loadWorkspaceOverviewMock.mockReset();
    loadWorkspacePackagesOverviewMock.mockReset();
    loadWorkspaceConfigOverviewMock.mockReset();
    searchLocalKnowledgeMock.mockReset();
    scanLocalSkillsMock.mockReset();
    inspectLocalSkillMock.mockReset();
    scanLocalMcpPluginsMock.mockReset();
    inspectLocalMcpPluginMock.mockReset();
    previewLocalMcpPluginStartMock.mockReset();
    enableLocalSkillMock.mockReset();
    installLocalSkillMock.mockReset();
    createKnowledgeLibraryMock.mockReset();
    importKnowledgeFileMock.mockReset();
    listEnabledLocalSkillsMock.mockReset();
    removeKnowledgeFileMock.mockReset();
    clearKnowledgeImportsMock.mockReset();
    disableLocalSkillMock.mockReset();
    matchEnabledLocalSkillsMock.mockReset();
    runReadonlyShellCommandMock.mockReset();
    runWorkspaceWriteShellCommandMock.mockReset();
    runControlledFullShellCommandMock.mockReset();
    restoreRollbackFilesMock.mockReset();
    writeNpcConfigMock.mockReset();
    loadNpcWorkspaceMock.mockReset();
    loadNpcWorkspaceConfigMock.mockReset();
    createNpcWorkspaceConfigMock.mockReset();
    updateNpcWorkspaceConfigMock.mockReset();
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadKnowledgeInventoryMock.mockResolvedValue({
      importedFiles: [],
      availableFiles: [],
      indexedDocumentCount: 0,
      registryPath: ".opencow/knowledge/imported-files.json",
      summary: "empty"
    });
    loadWorkspaceOverviewMock.mockResolvedValue({
      root_name: "opencow",
      root_path: "/workspace/opencow",
      entry_count: 12,
      package_count: 3,
      package_names: ["openclaw-adapter", "permission-engine", "shell-runtime"],
      summary: "Workspace overview found a desktop-first local assistant workspace with 3 packages."
    });
    loadNpcWorkspaceMock.mockResolvedValue({
      summary: "empty",
      selectedNpcId: null,
      items: []
    });
    loadNpcWorkspaceConfigMock.mockImplementation(async (npcId: string) => ({
      id: npcId,
      name: npcId === "writer-bot" ? "写作助手" : "研究助手",
      description: npcId === "writer-bot" ? "负责整理输出" : "负责资料整理",
      defaultModel: "qwen2.5-coder:7b",
      personaTitle: npcId === "writer-bot" ? "写作助手" : "资料研究员",
      personaPrompt: npcId === "writer-bot" ? "你负责整理输出" : "你负责整理资料",
      outputStyle: "简洁",
      agentDraft: "",
      rulesDraft: "",
      enabledSkillNames: [],
      knowledgeLibraryIds: [],
      updatedAt: npcId === "writer-bot" ? "2026-06-19T11:00:00.000Z" : "2026-06-19T10:00:00.000Z"
    }));
    restoreRollbackFilesMock.mockResolvedValue({
      restoredPathCount: 0,
      prunedSnapshotCount: 0
    });
    minimizeMock.mockReset();
    destroyMock.mockReset();
    onCloseRequestedMock.mockReset();
    onCloseRequestedMock.mockResolvedValue(() => undefined);
    listenMock.mockReset();
    unlistenMock.mockReset();
    listenMock.mockResolvedValue(unlistenMock);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("renders the desktop workbench shell after loading Ollama", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    render(<App />);

    expect(await findModelPicker("qwen2.5-coder:7b")).toBeInTheDocument();
    expect(screen.getByRole("main", { name: /opencow/i })).toBeInTheDocument();
    expect(getComposerInput()).toBeInTheDocument();
  });

  it("shows a close confirmation overlay and can minimize or exit the desktop window", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    expect(onCloseRequestedMock).not.toHaveBeenCalled();

    expect(listenMock).toHaveBeenCalledWith("app_close_requested", expect.any(Function));
    const closeListener = listenMock.mock.calls.find((call) => call[0] === "app_close_requested")?.[1] as
      | (() => void)
      | undefined;
    expect(closeListener).toBeDefined();

    await act(async () => {
      closeListener?.();
    });

    expect(await screen.findByRole("dialog", { name: "退出确认" })).toBeInTheDocument();

    await click(screen.getByRole("button", { name: "最小化" }));
    await waitFor(() => {
      expect(minimizeMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      closeListener?.();
    });
    await click(screen.getByRole("button", { name: "退出" }));
    await waitFor(() => {
      expect(destroyMock).toHaveBeenCalledTimes(1);
    });
  });

  it("loads the selected NPC from the dedicated config read path when switching cards", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadNpcWorkspaceMock.mockResolvedValueOnce({
      summary: "loaded",
      selectedNpcId: "research-bot",
      items: [
        {
          id: "research-bot",
          name: "研究助手",
          description: "列表摘要",
          defaultModel: "qwen2.5-coder:7b",
          personaTitle: "列表人设",
          personaPrompt: "列表提示词",
          outputStyle: "简洁",
          agentDraft: "",
          rulesDraft: "",
          enabledSkillNames: [],
          knowledgeLibraryIds: [],
          updatedAt: "2026-06-19T10:00:00.000Z"
        },
        {
          id: "writer-bot",
          name: "写作助手",
          description: "列表里只有短摘要",
          defaultModel: "qwen2.5-coder:7b",
          personaTitle: "列表标签",
          personaPrompt: "",
          outputStyle: "简洁",
          agentDraft: "",
          rulesDraft: "",
          enabledSkillNames: [],
          knowledgeLibraryIds: [],
          updatedAt: "2026-06-19T11:00:00.000Z"
        }
      ]
    });
    loadNpcWorkspaceConfigMock.mockImplementation(async (npcId: string) => {
      if (npcId === "writer-bot") {
        return {
          id: "writer-bot",
          name: "写作助手",
          description: "真实详情说明",
          defaultModel: "qwen2.5-coder:7b",
          personaTitle: "成稿编辑",
          personaPrompt: "你负责整理输出",
          outputStyle: "简洁",
          agentDraft: "writer agent draft",
          rulesDraft: "writer rules draft",
          enabledSkillNames: ["本地检索增强"],
          knowledgeLibraryIds: ["product-docs"],
          updatedAt: "2026-06-19T11:00:00.000Z"
        };
      }

      return {
        id: "research-bot",
        name: "研究助手",
        description: "负责资料整理",
        defaultModel: "qwen2.5-coder:7b",
        personaTitle: "资料研究员",
        personaPrompt: "你负责整理资料",
        outputStyle: "简洁",
        agentDraft: "",
        rulesDraft: "",
        enabledSkillNames: [],
        knowledgeLibraryIds: [],
        updatedAt: "2026-06-19T10:00:00.000Z"
      };
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");
    await click(screen.getByRole("button", { name: "NPC" }));
    await click(await screen.findByRole("button", { name: "写作助手" }));

    await waitFor(() => {
      expect(loadNpcWorkspaceConfigMock).toHaveBeenCalledWith("writer-bot");
    });

    const npcNavigation = await screen.findByLabelText("NPC 配置导航");
    expect(within(npcNavigation).getByText("成稿编辑")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "NPC 简介" })).toHaveValue("真实详情说明");
  });

  it("keeps the selected NPC workspace visible when the dedicated config read fails", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadNpcWorkspaceMock.mockResolvedValueOnce({
      summary: "loaded",
      selectedNpcId: "research-bot",
      items: [
        {
          id: "research-bot",
          name: "研究助手",
          description: "负责资料整理",
          defaultModel: "qwen2.5-coder:7b",
          personaTitle: "资料研究员",
          personaPrompt: "你负责整理资料",
          outputStyle: "简洁",
          agentDraft: "",
          rulesDraft: "",
          enabledSkillNames: [],
          knowledgeLibraryIds: [],
          updatedAt: "2026-06-19T10:00:00.000Z"
        },
        {
          id: "writer-bot",
          name: "写作助手",
          description: "列表里只有短摘要",
          defaultModel: "qwen2.5-coder:7b",
          personaTitle: "列表标签",
          personaPrompt: "",
          outputStyle: "简洁",
          agentDraft: "",
          rulesDraft: "",
          enabledSkillNames: [],
          knowledgeLibraryIds: [],
          updatedAt: "2026-06-19T11:00:00.000Z"
        }
      ]
    });
    loadNpcWorkspaceConfigMock.mockImplementation(async (npcId: string) => {
      if (npcId === "writer-bot") {
        throw new Error("npc read failed");
      }

      return {
        id: "research-bot",
        name: "研究助手",
        description: "负责资料整理",
        defaultModel: "qwen2.5-coder:7b",
        personaTitle: "资料研究员",
        personaPrompt: "你负责整理资料",
        outputStyle: "简洁",
        agentDraft: "",
        rulesDraft: "",
        enabledSkillNames: [],
        knowledgeLibraryIds: [],
        updatedAt: "2026-06-19T10:00:00.000Z"
      };
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");
    await click(screen.getByRole("button", { name: "NPC" }));
    await click(await screen.findByRole("button", { name: "写作助手" }));

    await waitFor(() => {
      expect(loadNpcWorkspaceConfigMock).toHaveBeenCalledWith("writer-bot");
    });

    const npcNavigation = await screen.findByLabelText("NPC 配置导航");
    expect(within(npcNavigation).getByText("列表标签")).toBeInTheDocument();
    expect(screen.getByText("列表里只有短摘要")).toBeInTheDocument();
    expect(screen.getByText("NPC 配置读取失败。")).toBeInTheDocument();
  });

  it("loads the initially selected NPC from the dedicated config read path after workspace load", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadNpcWorkspaceMock.mockResolvedValueOnce({
      summary: "loaded",
      selectedNpcId: "research-bot",
      items: [
        {
          id: "research-bot",
          name: "研究助手",
          description: "列表摘要",
          defaultModel: "qwen2.5-coder:7b",
          personaTitle: "列表人设",
          personaPrompt: "列表提示词",
          outputStyle: "简洁",
          agentDraft: "",
          rulesDraft: "",
          enabledSkillNames: [],
          knowledgeLibraryIds: [],
          updatedAt: "2026-06-19T10:00:00.000Z"
        }
      ]
    });
    loadNpcWorkspaceConfigMock.mockResolvedValueOnce({
      id: "research-bot",
      name: "研究助手",
      description: "真实详情说明",
      defaultModel: "qwen2.5-coder:7b",
      personaTitle: "资料研究员",
      personaPrompt: "你负责整理资料",
      outputStyle: "简洁",
      agentDraft: "",
      rulesDraft: "",
      enabledSkillNames: ["本地检索增强"],
      knowledgeLibraryIds: ["product-docs"],
      updatedAt: "2026-06-19T10:00:00.000Z"
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");
    await click(screen.getByRole("button", { name: "NPC" }));

    await waitFor(() => {
      expect(loadNpcWorkspaceConfigMock).toHaveBeenCalledWith("research-bot");
    });

    const npcNavigation = await screen.findByLabelText("NPC 配置导航");
    expect(within(npcNavigation).getByText("资料研究员")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "NPC 简介" })).toHaveValue("真实详情说明");
  });

  it("shows the close confirmation overlay when the native desktop close event is emitted", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    expect(listenMock).toHaveBeenCalledWith("app_close_requested", expect.any(Function));

    const closeListener = listenMock.mock.calls.find((call) => call[0] === "app_close_requested")?.[1] as
      | (() => void)
      | undefined;
    expect(closeListener).toBeDefined();

    await act(async () => {
      closeListener?.();
    });

    expect(await screen.findByRole("dialog", { name: "退出确认" })).toBeInTheDocument();
  });

  it("still registers desktop close listeners when tauri internals exist without currentWindow metadata", async () => {
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {
        invoke: vi.fn(),
        metadata: {}
      }
    });
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    expect(onCloseRequestedMock).not.toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalledWith("app_close_requested", expect.any(Function));
  });

  it("switches sidebar destinations from the app shell", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    const destinationHeadings: Record<string, string> = {
      "搜索": "搜索",
      "知识库": "知识库",
      "Skills": "技能",
      "NPC": "NPC",
      "MCP": "MCP",
      "审计": "审计",
      "安全": "安全",
      "设置": "设置"
    };

    for (const destination of ["搜索", "知识库", "Skills", "NPC", "MCP", "审计", "安全", "设置"]) {
      await user.click(screen.getByRole("button", { name: destination }));

      expect(screen.getByRole("heading", { name: destinationHeadings[destination] })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: destination })).toHaveAttribute("aria-pressed", "true");
    }

    await user.click(screen.getByRole("button", { name: "创建新会话" }));

    expect(getConversationRegion()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "会话" })).toHaveAttribute("aria-pressed", "true");
  });

  it("renders the single NPC workspace with compact navigation after loading NPC configs", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadNpcWorkspaceMock.mockResolvedValueOnce({
      summary: "loaded",
      selectedNpcId: "research-bot",
      items: [
        {
          id: "research-bot",
          name: "研究助手",
          description: "负责资料整理",
          defaultModel: "qwen2.5-coder:7b",
          personaTitle: "资料研究员",
          personaPrompt: "你负责整理资料",
          outputStyle: "简洁",
          agentDraft: "",
          rulesDraft: "",
          enabledSkillNames: ["本地检索增强"],
          knowledgeLibraryIds: ["product-docs"],
          updatedAt: "2026-06-19T10:00:00.000Z"
        }
      ]
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");
    await user.click(screen.getByRole("button", { name: "NPC" }));
    const npcNavigation = await screen.findByLabelText("NPC 配置导航");

    expect(await screen.findByRole("button", { name: "新建 NPC" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "研究助手" })).toBeInTheDocument();
    expect(within(npcNavigation).getByRole("button", { name: "概览" })).toBeInTheDocument();
    expect(within(npcNavigation).getByRole("button", { name: "人设" })).toBeInTheDocument();
    expect(within(npcNavigation).getByRole("button", { name: "技能" })).toBeInTheDocument();
    expect(within(npcNavigation).getByRole("button", { name: "知识库" })).toBeInTheDocument();
  });

  it("shows and persists a dedicated persona title separate from the NPC name", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadNpcWorkspaceMock.mockResolvedValueOnce({
      summary: "loaded",
      selectedNpcId: "research-bot",
      items: [
        {
          id: "research-bot",
          name: "研究助手",
          description: "负责资料整理",
          defaultModel: "qwen2.5-coder:7b",
          personaTitle: "资料研究员",
          personaPrompt: "你负责整理资料",
          outputStyle: "简洁",
          agentDraft: "",
          rulesDraft: "",
          enabledSkillNames: [],
          knowledgeLibraryIds: [],
          updatedAt: "2026-06-19T10:00:00.000Z"
        }
      ]
    });
    updateNpcWorkspaceConfigMock.mockResolvedValueOnce({
      summary: "updated",
      selectedNpcId: "research-bot",
      items: [
        {
          id: "research-bot",
          name: "研究助手",
          description: "负责资料整理",
          defaultModel: "qwen2.5-coder:7b",
          personaTitle: "事实核验官",
          personaPrompt: "你负责整理资料",
          outputStyle: "简洁",
          agentDraft: "",
          rulesDraft: "",
          enabledSkillNames: [],
          knowledgeLibraryIds: [],
          updatedAt: "2026-06-19T10:00:00.000Z"
        }
      ]
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");
    await user.click(screen.getByRole("button", { name: "NPC" }));
    const npcNavigation = await screen.findByLabelText("NPC 配置导航");
    await user.click(within(npcNavigation).getByRole("button", { name: "人设" }));

    const personaTitle = await screen.findByRole("textbox", { name: "人设标题" });
    expect(personaTitle).toHaveValue("资料研究员");
    expect(screen.getByRole("heading", { name: "资料研究员" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "研究助手" })).toBeInTheDocument();

    await user.clear(personaTitle);
    await user.type(personaTitle, "事实核验官");

    await waitFor(() => {
      expect(updateNpcWorkspaceConfigMock).toHaveBeenCalledWith(expect.objectContaining({
        id: "research-bot",
        name: "研究助手",
        personaTitle: "事实核验官"
      }), expect.objectContaining({
        conversationId: expect.any(String),
        rollbackEntryId: expect.any(String)
      }));
    }, { timeout: 1500 });
  });

  it("switches the NPC middle content between overview, skills, and knowledge", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadNpcWorkspaceMock.mockResolvedValueOnce({
      summary: "loaded",
      selectedNpcId: "research-bot",
      items: [
        {
          id: "research-bot",
          name: "研究助手",
          description: "负责资料整理",
          defaultModel: "qwen2.5-coder:7b",
          personaPrompt: "你负责整理资料",
          outputStyle: "简洁",
          agentDraft: "",
          rulesDraft: "",
          enabledSkillNames: ["本地检索增强"],
          knowledgeLibraryIds: ["product-docs"],
          updatedAt: "2026-06-19T10:00:00.000Z"
        }
      ]
    });
    loadKnowledgeInventoryMock.mockResolvedValueOnce({
      importedFiles: [],
      availableFiles: [],
      indexedDocumentCount: 0,
      registryPath: ".opencow/knowledge/imported-files.json",
      summary: "loaded",
      activeLibraryId: "product-docs",
      activeLibraryLabel: "产品文档库",
      libraries: [{ id: "product-docs", label: "产品文档库", description: "PRD 与说明" }]
    });
    scanLocalSkillsMock.mockResolvedValueOnce({
      summary: "loaded",
      total_count: 1,
      scanned_root_count: 1,
      items: [
        {
          name: "本地检索增强",
          path: "skills/rag/SKILL.md",
          source: "workspace",
          description: "读取本地文档",
          enabled: true
        }
      ]
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");
    await user.click(screen.getByRole("button", { name: "NPC" }));
    const npcNavigation = await screen.findByLabelText("NPC 配置导航");
    await user.click(within(npcNavigation).getByRole("button", { name: "技能" }));
    expect(await screen.findByText("已绑定技能")).toBeInTheDocument();
    await user.click(within(npcNavigation).getByRole("button", { name: "知识库" }));
    expect(await screen.findByText("已绑定知识库")).toBeInTheDocument();
    expect(screen.getByText("产品文档库")).toBeInTheDocument();
  });

  it("shows local skills as compact rows in the NPC skills section and opens detail text on selection", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadNpcWorkspaceMock.mockResolvedValueOnce({
      summary: "loaded",
      selectedNpcId: "research-bot",
      items: [
        {
          id: "research-bot",
          name: "研究助手",
          description: "负责资料整理",
          defaultModel: "qwen2.5-coder:7b",
          personaPrompt: "你负责整理资料",
          outputStyle: "简洁",
          agentDraft: "",
          rulesDraft: "",
          enabledSkillNames: ["本地检索增强"],
          knowledgeLibraryIds: ["product-docs"],
          updatedAt: "2026-06-19T10:00:00.000Z"
        }
      ]
    });
    scanLocalSkillsMock.mockResolvedValueOnce({
      summary: "loaded",
      total_count: 1,
      scanned_root_count: 1,
      items: [
        {
          name: "本地检索增强",
          path: "skills/rag/SKILL.md",
          source: "workspace",
          description: "读取本地文档",
          enabled: true
        }
      ]
    });
    inspectLocalSkillMock.mockResolvedValueOnce({
      query: "本地检索增强",
      summary: "loaded",
      match_count: 1,
      scanned_root_count: 1,
      items: [
        {
          name: "本地检索增强",
          path: "skills/rag/SKILL.md",
          source: "workspace",
          description: "读取本地文档",
          content_preview: "用于本地知识检索。",
          enabled: true
        }
      ]
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "NPC" }));
    });
    const npcNavigation = await screen.findByLabelText("NPC 配置导航");
    await act(async () => {
      fireEvent.click(within(npcNavigation).getByRole("button", { name: "技能" }));
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: /本地检索增强/ }));
    });
    expect(await screen.findByText("用于本地知识检索。")).toBeInTheDocument();
  });

  it("keeps the selected NPC skill detail after leaving and reopening the NPC workspace", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadNpcWorkspaceMock.mockResolvedValueOnce({
      summary: "loaded",
      selectedNpcId: "research-bot",
      items: [
        {
          id: "research-bot",
          name: "研究助手",
          description: "负责资料整理",
          defaultModel: "qwen2.5-coder:7b",
          personaPrompt: "你负责整理资料",
          outputStyle: "简洁",
          agentDraft: "",
          rulesDraft: "",
          enabledSkillNames: ["本地检索增强"],
          knowledgeLibraryIds: ["product-docs"],
          updatedAt: "2026-06-19T10:00:00.000Z"
        }
      ]
    });
    scanLocalSkillsMock.mockResolvedValueOnce({
      summary: "loaded",
      total_count: 1,
      scanned_root_count: 1,
      items: [
        {
          name: "本地检索增强",
          path: "skills/rag/SKILL.md",
          source: "workspace",
          description: "读取本地文档",
          enabled: true
        }
      ]
    });
    inspectLocalSkillMock.mockResolvedValueOnce({
      query: "本地检索增强",
      summary: "loaded",
      match_count: 1,
      scanned_root_count: 1,
      items: [
        {
          name: "本地检索增强",
          path: "skills/rag/SKILL.md",
          source: "workspace",
          description: "读取本地文档",
          content_preview: "用于本地知识检索。",
          enabled: true
        }
      ]
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");
    fireEvent.click(screen.getByRole("button", { name: "NPC" }));
    const npcNavigation = await screen.findByLabelText("NPC 配置导航");
    fireEvent.click(within(npcNavigation).getByRole("button", { name: "技能" }));
    fireEvent.click(await screen.findByRole("button", { name: /本地检索增强/ }));

    expect(await screen.findByText("用于本地知识检索。")).toBeInTheDocument();
    expect(inspectLocalSkillMock).toHaveBeenCalledWith("本地检索增强");

    fireEvent.click(screen.getByRole("button", { name: "会话" }));
    fireEvent.click(screen.getByRole("button", { name: "NPC" }));
    fireEvent.click(await screen.findByRole("button", { name: "技能" }));

    expect(screen.getByText("用于本地知识检索。")).toBeInTheDocument();
  });

  it("clears the previous NPC skill detail after switching to another NPC", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadNpcWorkspaceMock.mockResolvedValueOnce({
      summary: "loaded",
      selectedNpcId: "research-bot",
      items: [
        {
          id: "research-bot",
          name: "研究助手",
          description: "负责资料整理",
          defaultModel: "qwen2.5-coder:7b",
          personaPrompt: "你负责整理资料",
          outputStyle: "简洁",
          agentDraft: "",
          rulesDraft: "",
          enabledSkillNames: ["本地检索增强"],
          knowledgeLibraryIds: ["product-docs"],
          updatedAt: "2026-06-19T10:00:00.000Z"
        },
        {
          id: "writer-bot",
          name: "写作助手",
          description: "负责整理输出",
          defaultModel: "qwen2.5-coder:7b",
          personaPrompt: "你负责整理输出",
          outputStyle: "简洁",
          agentDraft: "",
          rulesDraft: "",
          enabledSkillNames: [],
          knowledgeLibraryIds: [],
          updatedAt: "2026-06-19T11:00:00.000Z"
        }
      ]
    });
    scanLocalSkillsMock.mockResolvedValueOnce({
      summary: "loaded",
      total_count: 1,
      scanned_root_count: 1,
      items: [
        {
          name: "本地检索增强",
          path: "skills/rag/SKILL.md",
          source: "workspace",
          description: "读取本地文档",
          enabled: true
        }
      ]
    });
    inspectLocalSkillMock.mockResolvedValueOnce({
      query: "本地检索增强",
      summary: "loaded",
      match_count: 1,
      scanned_root_count: 1,
      items: [
        {
          name: "本地检索增强",
          path: "skills/rag/SKILL.md",
          source: "workspace",
          description: "读取本地文档",
          content_preview: "用于本地知识检索。",
          enabled: true
        }
      ]
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");
    await user.click(screen.getByRole("button", { name: "NPC" }));
    const npcNavigation = await screen.findByLabelText("NPC 配置导航");
    await user.click(within(npcNavigation).getByRole("button", { name: "技能" }));
    await user.click(await screen.findByRole("button", { name: /本地检索增强/ }));

    expect(await screen.findByText("用于本地知识检索。")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "写作助手" }));

    expect(screen.queryByText("用于本地知识检索。")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "移除绑定" })).not.toBeInTheDocument();
  });

  it("creates a new NPC from the compact NPC rail", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    createNpcWorkspaceConfigMock.mockResolvedValueOnce({
      summary: "created",
      selectedNpcId: "writer-bot",
      items: [
        {
          id: "alpha-bot",
          name: "Alpha 助手",
          description: "已存在的 NPC",
          defaultModel: "qwen2.5-coder:7b",
          personaTitle: "Alpha",
          personaPrompt: "",
          outputStyle: "简洁",
          agentDraft: "",
          rulesDraft: "",
          enabledSkillNames: [],
          knowledgeLibraryIds: [],
          updatedAt: "2026-06-19T09:00:00.000Z"
        },
        {
          id: "writer-bot",
          name: "写作助手",
          description: "负责整理输出",
          defaultModel: "qwen2.5-coder:7b",
          personaTitle: "写作助手",
          personaPrompt: "",
          outputStyle: "简洁",
          agentDraft: "",
          rulesDraft: "",
          enabledSkillNames: [],
          knowledgeLibraryIds: [],
          updatedAt: "2026-06-19T10:00:00.000Z"
        }
      ]
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");
    await user.click(screen.getByRole("button", { name: "NPC" }));
    await user.click(await screen.findByRole("button", { name: "新建 NPC" }));
    const npcRail = screen.getByLabelText("NPC 列表");
    await user.type(within(npcRail).getByRole("textbox", { name: "新 NPC 名称" }), "写作助手");
    await user.type(within(npcRail).getByRole("textbox", { name: "新 NPC 简介" }), "负责整理输出");
    await user.click(within(npcRail).getByRole("button", { name: "创建" }));

    await waitFor(() => {
      expect(createNpcWorkspaceConfigMock).toHaveBeenCalledWith(expect.objectContaining({
        name: "写作助手",
        description: "负责整理输出"
      }), expect.objectContaining({
        conversationId: expect.any(String),
        rollbackEntryId: expect.any(String)
      }));
    });
    expect(await screen.findByRole("button", { name: "写作助手" }, { timeout: 12_000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "写作助手" }).closest(".npc-card-item")).toHaveClass("active");
  }, 15_000);

  it("reflects a newly created knowledge library inside the NPC knowledge section", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadNpcWorkspaceMock.mockResolvedValueOnce({
      summary: "loaded",
      selectedNpcId: "research-bot",
      items: [
        {
          id: "research-bot",
          name: "研究助手",
          description: "负责资料整理",
          defaultModel: "qwen2.5-coder:7b",
          personaPrompt: "你负责整理资料",
          outputStyle: "简洁",
          agentDraft: "",
          rulesDraft: "",
          enabledSkillNames: [],
          knowledgeLibraryIds: ["product-docs"],
          updatedAt: "2026-06-19T10:00:00.000Z"
        }
      ]
    });
    createKnowledgeLibraryMock.mockResolvedValueOnce({
      importedFiles: [],
      availableFiles: [],
      indexedDocumentCount: 0,
      registryPath: ".opencow/knowledge/imported-files.json",
      summary: "loaded",
      activeLibraryId: "product-docs",
      activeLibraryLabel: "产品文档库",
      libraries: [
        {
          id: "default-library",
          label: "默认知识库",
          description: "通用知识入口",
          documentCount: 0
        },
        {
          id: "product-docs",
          label: "产品文档库",
          description: "整理产品需求、PRD 和交互说明。",
          documentCount: 2
        }
      ]
    } as any);

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");
    await user.click(screen.getByRole("button", { name: "知识库" }));
    await user.click(await screen.findByRole("button", { name: "创建知识库" }));
    await user.type(screen.getByRole("textbox", { name: "知识库名称" }), "产品文档库");
    await user.type(screen.getByRole("textbox", { name: "知识库简介" }), "整理产品需求、PRD 和交互说明。");
    await user.click(screen.getByRole("button", { name: "确认创建知识库" }));

    await waitFor(() => {
      expect(createKnowledgeLibraryMock).toHaveBeenCalledWith(
        "产品文档库",
        "整理产品需求、PRD 和交互说明。",
        expect.objectContaining({
          conversationId: expect.any(String),
          rollbackEntryId: expect.any(String)
        })
      );
    });

    await user.click(screen.getByRole("button", { name: "NPC" }));
    const npcNavigation = await screen.findByLabelText("NPC 配置导航");
    await user.click(within(npcNavigation).getByRole("button", { name: "知识库" }));

    expect(await screen.findByText("产品文档库")).toBeInTheDocument();
    expect(screen.getByText("整理产品需求、PRD 和交互说明。")).toBeInTheDocument();
    expect(screen.getByText("2 篇文件")).toBeInTheDocument();
  }, 15_000);

  it("optimistically updates NPC knowledge binding before the save request resolves", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadNpcWorkspaceMock.mockResolvedValueOnce({
      summary: "loaded",
      selectedNpcId: "research-bot",
      items: [
        {
          id: "research-bot",
          name: "研究助手",
          description: "负责资料整理",
          defaultModel: "qwen2.5-coder:7b",
          personaPrompt: "你负责整理资料",
          outputStyle: "简洁",
          agentDraft: "",
          rulesDraft: "",
          enabledSkillNames: [],
          knowledgeLibraryIds: [],
          updatedAt: "2026-06-19T10:00:00.000Z"
        }
      ]
    });
    loadKnowledgeInventoryMock.mockResolvedValueOnce({
      importedFiles: [],
      availableFiles: [],
      indexedDocumentCount: 0,
      registryPath: ".opencow/knowledge/imported-files.json",
      summary: "loaded",
      activeLibraryId: "product-docs",
      activeLibraryLabel: "产品文档库",
      libraries: [
        {
          id: "product-docs",
          label: "产品文档库",
          description: "整理产品需求、PRD 和交互说明。",
          documentCount: 2
        }
      ]
    } as any);
    updateNpcWorkspaceConfigMock.mockImplementationOnce(() => new Promise(() => undefined));

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");
    await user.click(screen.getByRole("button", { name: "NPC" }));
    const npcNavigation = await screen.findByLabelText("NPC 配置导航");
    await user.click(within(npcNavigation).getByRole("button", { name: "知识库" }));
    await user.click(await screen.findByRole("button", { name: /产品文档库/ }));
    await user.click(await screen.findByRole("button", { name: "绑定知识库" }));

    expect(updateNpcWorkspaceConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      id: "research-bot",
      knowledgeLibraryIds: ["product-docs"]
    }), expect.objectContaining({
      conversationId: expect.any(String),
      rollbackEntryId: expect.any(String)
    }));
    expect(screen.getByText("1 项")).toBeInTheDocument();
    expect(screen.getByText("已绑定")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消绑定" })).toBeInTheDocument();
  });



  it("loads knowledge inventory into the knowledge workspace after startup", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadKnowledgeInventoryMock.mockResolvedValueOnce({
      importedFiles: [
        {
          path: "notes/guide.txt",
          title: "guide.txt",
          status: "ready"
        }
      ],
      availableFiles: [
        {
          path: "docs/rag-checklist.md",
          title: "rag-checklist.md"
        }
      ],
      indexedDocumentCount: 1,
      registryPath: ".opencow/knowledge/imported-files.json",
      summary: "loaded"
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    await click(screen.getByRole("button", { name: "知识库" }));

    await waitFor(() => {
      expect(screen.getByText("已索引文件 1")).toBeInTheDocument();
      expect(screen.getByText("guide.txt")).toBeInTheDocument();
      expect(screen.getByText("rag-checklist.md")).toBeInTheDocument();
    });
  });

  it("keeps knowledge inventory intact and surfaces an error when clearing imports fails", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadKnowledgeInventoryMock.mockResolvedValueOnce({
      importedFiles: [
        {
          path: "notes/guide.txt",
          title: "guide.txt",
          status: "ready"
        }
      ],
      availableFiles: [
        {
          path: "docs/rag-checklist.md",
          title: "rag-checklist.md"
        }
      ],
      indexedDocumentCount: 1,
      registryPath: ".opencow/knowledge/imported-files.json",
      summary: "loaded"
    });
    clearKnowledgeImportsMock.mockRejectedValueOnce(new Error("knowledge clear failed"));

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    await click(screen.getByRole("button", { name: "设置" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "回退与本地清理" })).toBeInTheDocument();
    });
    expect(screen.getByText("知识库索引 1")).toBeInTheDocument();
    await click(screen.getByRole("button", { name: "清空知识库索引" }));

    await waitFor(() => {
      expect(screen.getByText("知识库索引 1")).toBeInTheDocument();
      expect(clearKnowledgeImportsMock).toHaveBeenCalledWith(
        "default-library",
        expect.objectContaining({
          conversationId: expect.any(String),
          rollbackEntryId: expect.any(String)
        })
      );
    });

    await click(screen.getByRole("button", { name: "审计" }));

    await waitFor(() => {
      expect(screen.getByText("知识库索引清理失败")).toBeInTheDocument();
      expect(screen.getByText("knowledge clear failed")).toBeInTheDocument();
    });

    await click(screen.getByRole("button", { name: "知识库" }));

    await waitFor(() => {
      expect(screen.getByText("已索引文件 1")).toBeInTheDocument();
      expect(screen.getAllByText("guide.txt").length).toBeGreaterThan(0);
    });
  }, 10_000);

  it("keeps Ollama load details in settings while the main conversation stays minimal", async () => {
    loadOllamaOverviewMock.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:11434"));

    render(<App />);

    expect(await screen.findByText("默认使用本地 Ollama，当前未检测到可用服务。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "配置 Ollama" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "配置大模型 API" })).toBeInTheDocument();
    expect(screen.queryByText("connect ECONNREFUSED 127.0.0.1:11434")).not.toBeInTheDocument();
    expect(screen.queryByText(/ollama_overview/)).not.toBeInTheDocument();
    expect(within(getConversationRegion()).queryByText("需要配置模型")).not.toBeInTheDocument();

    await click(screen.getByRole("button", { name: "配置 Ollama" }));

    const settingsPanel = screen.getByLabelText("设置");
    expect(within(settingsPanel).getByText(/connect ECONNREFUSED 127\.0\.0\.1:11434/)).toBeInTheDocument();
  });

  it("submits ordinary chat and shows a user message plus assistant reply without queue noise in the main transcript", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "我会先理解你的问题，再结合本地模型、权限链路和可用工具给出答复。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    await submitComposerMessage("你能干什么");

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getAllByText("你能干什么").length).toBeGreaterThan(0);
      expect(
        within(conversation).getAllByText(/我会先理解你的问题/).length
      ).toBeGreaterThan(0);
    });

    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen3.6:35b",
      message: "你能干什么"
    }));
    expect(within(conversation).queryByText(/本地助手能力说明|Workspace overview|本地助手答复/)).not.toBeInTheDocument();
    expect(within(conversation).queryByText(/任务已进入本地队列/)).not.toBeInTheDocument();
    expect(within(conversation).queryByText(/本地任务开始执行/)).not.toBeInTheDocument();
  });

  it("automatically uses network search as context for ordinary chat after search is enabled", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    searchNetworkMock.mockResolvedValueOnce({
      query: "OpenAI 最近有什么新动态",
      provider: "OpenCow 默认搜索",
      effective_provider: "OpenCow 默认搜索",
      used_fallback: false,
      fallback_reason: null,
      items: [
        {
          title: "OpenAI News",
          url: "https://openai.com/news/",
          source_label: "OpenAI",
          summary: "OpenAI 官方新闻页。"
        },
        {
          title: "OpenAI Safety",
          url: "https://openai.com/safety/",
          source_label: "OpenAI",
          summary: "OpenAI 安全相关页面。"
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "我结合联网搜索参考做了整理。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    await user.click(screen.getByRole("button", { name: "开启联网搜索" }));
    await screen.findByRole("button", { name: "关闭联网搜索" });
    await user.click(screen.getByRole("button", { name: "会话" }));

    await user.type(getComposerInput(), "OpenAI 最近有什么新动态");
    await user.click(getComposerSendButton());

    await waitFor(() => {
      expect(searchNetworkMock).toHaveBeenCalledWith("OpenAI 最近有什么新动态", expect.objectContaining({
        providerLabel: ""
      }));
      expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringMatching(/联网搜索参考|联网搜索已开启，但本轮没有可用外部来源/)
      }));
      expect(within(getConversationRegion()).getByText("我结合联网搜索参考做了整理。")).toBeInTheDocument();
      expect(within(getConversationRegion()).queryByText("概览：本地模型答复")).not.toBeInTheDocument();
    });
  }, 10_000);

  it("does not keep unrelated old search sources in a later ordinary chat reply", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    searchNetworkMock
      .mockResolvedValueOnce({
        query: "豆包是什么",
        provider: "OpenCow 默认搜索",
        effective_provider: "OpenCow 默认搜索",
        used_fallback: false,
        fallback_reason: null,
        items: [
          {
            title: "豆包",
            url: "https://www.doubao.com/",
            source_label: "豆包官网",
            summary: "豆包是字节跳动推出的 AI 助手产品。"
          }
        ]
      })
      .mockResolvedValueOnce({
        query: "大模型应用里CLI",
        provider: "OpenCow 默认搜索",
        effective_provider: "OpenCow 默认搜索",
        used_fallback: false,
        fallback_reason: null,
        items: [
          {
            title: "Transformers CLI",
            url: "https://huggingface.co/docs/transformers/main/en/run_scripts",
            source_label: "Hugging Face",
            summary: "Transformers 提供命令行入口。"
          }
        ]
      });
    chatWithOllamaModelMock
      .mockResolvedValueOnce({
        model: "qwen3.6:35b",
        message: "这是关于豆包的整理。"
      })
      .mockResolvedValueOnce({
        model: "qwen3.6:35b",
        message: "这是关于大模型应用里 CLI 的整理。"
      });

    render(<App />);

    await findModelPicker("qwen3.6:35b");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    await user.click(screen.getByRole("button", { name: "开启联网搜索" }));
    await screen.findByRole("button", { name: "关闭联网搜索" });
    await user.click(screen.getByRole("button", { name: "会话" }));

    await user.type(getComposerInput(), "豆包是什么");
    await user.click(getComposerSendButton());
    await waitFor(() => {
      expect(within(getConversationRegion()).getByText("这是关于豆包的整理。")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "创建新会话" }));
    await user.type(getComposerInput(), "大模型应用里CLI");
    await user.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(getConversationRegion()).getByText("这是关于大模型应用里 CLI 的整理。")).toBeInTheDocument();
      expect(within(getConversationRegion()).queryByText("豆包")).not.toBeInTheDocument();
      expect(within(getConversationRegion()).queryByText("概览：本地模型答复")).not.toBeInTheDocument();
      expect(within(getConversationRegion()).getByText("1 条信息引用")).toBeInTheDocument();
    });

    await user.click(within(getConversationRegion()).getByRole("button", { name: "展开信息引用" }));
    expect(within(getConversationRegion()).getByText("联网搜索来源")).toBeInTheDocument();
    expect(
      within(getConversationRegion()).getByRole("button", { name: "打开条目：Transformers CLI" })
    ).toBeInTheDocument();
  }, 10_000);

  it("does not reuse stale network sources for a later chat when the current search request fails", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    searchNetworkMock
      .mockResolvedValueOnce({
        query: "豆包是什么",
        provider: "OpenCow 默认搜索",
        effective_provider: "OpenCow 默认搜索",
        used_fallback: false,
        fallback_reason: null,
        items: [
          {
            title: "豆包",
            url: "https://www.doubao.com/",
            source_label: "豆包官网",
            summary: "豆包是字节跳动推出的 AI 助手产品。"
          }
        ]
      })
      .mockRejectedValueOnce(new Error("OpenCow 默认搜索当前不可用"));
    chatWithOllamaModelMock
      .mockResolvedValueOnce({
        model: "qwen3.6:35b",
        message: "这是关于豆包的整理。"
      })
      .mockResolvedValueOnce({
        model: "qwen3.6:35b",
        message: "这次我只能基于已有知识谨慎回答。"
      });

    render(<App />);

    await findModelPicker("qwen3.6:35b");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    await user.click(screen.getByRole("button", { name: "开启联网搜索" }));
    await screen.findByRole("button", { name: "关闭联网搜索" });
    await user.click(screen.getByRole("button", { name: "会话" }));

    await user.type(getComposerInput(), "豆包是什么");
    await user.click(getComposerSendButton());
    await waitFor(() => {
      expect(within(getConversationRegion()).getByText("这是关于豆包的整理。")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "创建新会话" }));
    await user.type(getComposerInput(), "解释一下享元模式");
    await user.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(getConversationRegion()).getByText("这次我只能基于已有知识谨慎回答。")).toBeInTheDocument();
    });

    const secondPrompt = chatWithOllamaModelMock.mock.calls[1]?.[0]?.message ?? "";
    expect(secondPrompt).toContain("联网搜索已开启，但本轮没有可用外部来源");
    expect(secondPrompt).not.toContain("豆包官网");
    expect(secondPrompt).not.toContain("https://www.doubao.com/");
    expect(within(getConversationRegion()).queryByText("1 条信息引用")).not.toBeInTheDocument();
  }, 10_000);

  it("combines local RAG hits with ordinary chat context when search is enabled but no external source is available", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    searchNetworkMock.mockRejectedValueOnce(new Error("OpenCow 默认搜索当前不可用"));
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "享元模式的内部状态和外部状态是什么",
      summary: "Local knowledge search found 1 matching passage across 3 indexed documents.",
      match_count: 1,
      indexed_document_count: 3,
      items: [
        {
          path: "docs/v1.0/patterns.md",
          title: "patterns.md",
          snippet: "内部状态适合共享，外部状态由调用方按场景传入。",
          score: 41
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "享元模式会共享内部状态，并把外部状态交给调用方传入。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    await user.click(screen.getByRole("button", { name: "开启联网搜索" }));
    await screen.findByRole("button", { name: "关闭联网搜索" });
    await user.click(screen.getByRole("button", { name: "会话" }));

    await user.type(getComposerInput(), "享元模式的内部状态和外部状态是什么");
    await user.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(getConversationRegion()).getByText("享元模式会共享内部状态，并把外部状态交给调用方传入。")).toBeInTheDocument();
    });

    const prompt = chatWithOllamaModelMock.mock.calls[0]?.[0]?.message ?? "";
    expect(searchLocalKnowledgeMock).toHaveBeenCalledWith("享元模式的内部状态和外部状态是什么");
    expect(prompt).toContain("本地知识库参考");
    expect(prompt).toContain("联网搜索已开启，但本轮没有可用外部来源");
    expect(prompt).toContain("patterns.md");
    expect(prompt).toContain("内部状态适合共享，外部状态由调用方按场景传入。");
  }, 10_000);

  it("adds stricter anti-hallucination instructions when network sources are present", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    searchNetworkMock.mockResolvedValueOnce({
      query: "豆包和 DeepSeek 谁更好用",
      provider: "OpenCow 默认搜索",
      effective_provider: "OpenCow 默认搜索",
      used_fallback: false,
      fallback_reason: null,
      items: [
        {
          title: "豆包",
          url: "https://www.doubao.com/",
          source_label: "豆包官网",
          summary: "豆包提供智能问答、写作和多场景助手能力。"
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "我会基于现有资料谨慎比较。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    await user.click(screen.getByRole("button", { name: "开启联网搜索" }));
    await screen.findByRole("button", { name: "关闭联网搜索" });
    await user.click(screen.getByRole("button", { name: "会话" }));
    await user.type(getComposerInput(), "豆包和 DeepSeek 谁更好用");
    await user.click(getComposerSendButton());

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
    });

    const prompt = chatWithOllamaModelMock.mock.calls.at(-1)?.[0]?.message ?? "";
    expect(prompt).toContain("如果来源没有明确写出品牌归属、产品背景或主体关系，就不要自行补写");
    expect(prompt).toContain("如果现有来源不足以支持结论，请直接说明“现有来源不足以确认”");
    expect(prompt).not.toContain("豆包 (Baidu)");
  }, 10_000);

  it("forces comparison questions to degrade when evidence only covers one side", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    searchNetworkMock.mockResolvedValueOnce({
      query: "豆包和 DeepSeek 谁更好用",
      provider: "OpenCow 默认搜索",
      effective_provider: "OpenCow 默认搜索",
      used_fallback: false,
      fallback_reason: null,
      items: [
        {
          title: "豆包",
          url: "https://www.doubao.com/",
          source_label: "豆包官网",
          summary: "豆包提供智能问答、写作和多场景助手能力。"
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "现有来源不足以完成公平比较。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    await user.click(screen.getByRole("button", { name: "开启联网搜索" }));
    await screen.findByRole("button", { name: "关闭联网搜索" });
    await user.click(screen.getByRole("button", { name: "会话" }));
    await user.type(getComposerInput(), "豆包和 DeepSeek 谁更好用");
    await user.click(getComposerSendButton());

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
    });

    const prompt = chatWithOllamaModelMock.mock.calls.at(-1)?.[0]?.message ?? "";
    expect(prompt).toContain("当前问题是比较类问题");
    expect(prompt).toContain("仅找到与「豆包」相关的来源");
    expect(prompt).toContain("未找到与「DeepSeek」直接相关的来源");
    expect(prompt).toContain("不要直接下结论谁更好");
  }, 10_000);

  it("forces ownership questions to stay uncertain when sources do not state ownership explicitly", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    searchNetworkMock.mockResolvedValueOnce({
      query: "豆包是谁家的",
      provider: "OpenCow 默认搜索",
      effective_provider: "OpenCow 默认搜索",
      used_fallback: false,
      fallback_reason: null,
      items: [
        {
          title: "豆包功能介绍",
          url: "https://www.doubao.com/",
          source_label: "豆包官网",
          summary: "豆包提供智能问答、写作和多场景助手能力。"
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "现有来源不足以确认主体归属。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    await user.click(screen.getByRole("button", { name: "开启联网搜索" }));
    await screen.findByRole("button", { name: "关闭联网搜索" });
    await user.click(screen.getByRole("button", { name: "会话" }));
    await user.type(getComposerInput(), "豆包是谁家的");
    await user.click(getComposerSendButton());

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
    });

    const prompt = chatWithOllamaModelMock.mock.calls.at(-1)?.[0]?.message ?? "";
    expect(prompt).toContain("当前问题涉及主体归属或品牌关系");
    expect(prompt).toContain("现有来源没有直接写出归属关系");
    expect(prompt).toContain("不要补写公司名、品牌名或投资关系");
  }, 10_000);

  it("prefers structured fact snippets over freeform summaries in the network search prompt", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    searchNetworkMock.mockResolvedValueOnce({
      query: "豆包是什么",
      provider: "OpenCow 默认搜索",
      effective_provider: "OpenCow 默认搜索",
      used_fallback: false,
      fallback_reason: null,
      items: [
        {
          title: "豆包",
          url: "https://www.doubao.com/",
          source_label: "豆包官网",
          summary: "这是一段较长的综合摘要，可能混合介绍、评价和解释。",
          fact_snippets: [
            "豆包提供智能问答能力。",
            "豆包支持写作辅助。",
            "豆包覆盖多场景助手能力。"
          ]
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "我会优先基于事实片段回答。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    await user.click(screen.getByRole("button", { name: "开启联网搜索" }));
    await screen.findByRole("button", { name: "关闭联网搜索" });
    await user.click(screen.getByRole("button", { name: "会话" }));
    await user.type(getComposerInput(), "豆包是什么");
    await user.click(getComposerSendButton());

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
    });

    const prompt = chatWithOllamaModelMock.mock.calls.at(-1)?.[0]?.message ?? "";
    expect(prompt).toContain("事实片段");
    expect(prompt).toContain("豆包提供智能问答能力。");
    expect(prompt).toContain("豆包支持写作辅助。");
    expect(prompt).toContain("豆包覆盖多场景助手能力。");
    expect(prompt).not.toContain("这是一段较长的综合摘要，可能混合介绍、评价和解释。");
  }, 10_000);

  it("shows structured fact snippets in the visible information references when available", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    searchNetworkMock.mockResolvedValueOnce({
      query: "豆包是什么",
      provider: "OpenCow 默认搜索",
      effective_provider: "OpenCow 默认搜索",
      used_fallback: false,
      fallback_reason: null,
      items: [
        {
          title: "豆包",
          url: "https://www.doubao.com/",
          source_label: "豆包官网",
          summary: "综合摘要不该优先展示。",
          fact_snippets: [
            "豆包提供智能问答能力。",
            "豆包支持写作辅助。"
          ]
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "这是关于豆包的整理。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    await user.click(screen.getByRole("button", { name: "开启联网搜索" }));
    await screen.findByRole("button", { name: "关闭联网搜索" });
    await user.click(screen.getByRole("button", { name: "会话" }));
    await user.type(getComposerInput(), "豆包是什么");
    await user.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(getConversationRegion()).getByText("1 条信息引用")).toBeInTheDocument();
    });

    await user.click(within(getConversationRegion()).getByRole("button", { name: "展开信息引用" }));

    expect(within(getConversationRegion()).getByText("豆包提供智能问答能力。")).toBeInTheDocument();
    expect(within(getConversationRegion()).getByText("豆包支持写作辅助。")).toBeInTheDocument();
    expect(within(getConversationRegion()).queryByText("综合摘要不该优先展示。")).not.toBeInTheDocument();
  }, 10_000);

  it("combines network-search and local RAG context in the same ordinary chat prompt", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    searchNetworkMock.mockResolvedValueOnce({
      query: "享元模式的内部状态和外部状态是什么",
      provider: "OpenCow 默认搜索",
      effective_provider: "OpenCow 默认搜索",
      used_fallback: false,
      fallback_reason: null,
      items: [
        {
          title: "Flyweight pattern reference",
          url: "https://example.test/flyweight",
          source_label: "Refactoring Guru",
          summary: "享元模式把可共享的部分作为内部状态，把随场景变化的部分作为外部状态。"
        }
      ]
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "享元模式的内部状态和外部状态是什么",
      summary: "Local knowledge search found 1 matching passage across 3 indexed documents.",
      match_count: 1,
      indexed_document_count: 3,
      items: [
        {
          path: "docs/v1.0/patterns.md",
          title: "patterns.md",
          snippet: "内部状态适合共享，外部状态由调用方按场景传入。",
          score: 41
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "享元模式会共享内部状态，并把外部状态交给调用方传入。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    await user.click(screen.getByRole("button", { name: "开启联网搜索" }));
    await screen.findByRole("button", { name: "关闭联网搜索" });
    await user.click(screen.getByRole("button", { name: "会话" }));

    await user.type(getComposerInput(), "享元模式的内部状态和外部状态是什么");
    await user.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(getConversationRegion()).getByText("享元模式会共享内部状态，并把外部状态交给调用方传入。")).toBeInTheDocument();
    });

    const prompt = chatWithOllamaModelMock.mock.calls[0]?.[0]?.message ?? "";
    expect(searchNetworkMock).toHaveBeenCalledWith("享元模式的内部状态和外部状态是什么", expect.objectContaining({
      providerLabel: ""
    }));
    expect(searchLocalKnowledgeMock).toHaveBeenCalledWith("享元模式的内部状态和外部状态是什么");
    expect(prompt).toContain("联网搜索参考");
    expect(prompt).toContain("本地知识库参考");
    expect(prompt).toContain("patterns.md");
    expect(prompt).toContain("Flyweight pattern reference");
  }, 10_000);

  it("shows local RAG hits as structured information references in ordinary chat and deduplicates overlaps against search sources", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    searchNetworkMock.mockResolvedValueOnce({
      query: "解释享元模式",
      provider: "OpenCow 默认搜索",
      effective_provider: "OpenCow 默认搜索",
      used_fallback: false,
      fallback_reason: null,
      items: [
        {
          title: "Flyweight pattern reference",
          url: "https://example.test/flyweight",
          source_label: "Refactoring Guru",
          summary: "享元模式把可共享的部分作为内部状态，把随场景变化的部分作为外部状态。"
        }
      ]
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "解释享元模式",
      summary: "Local knowledge search found 2 matching passages across 4 indexed documents.",
      match_count: 2,
      indexed_document_count: 4,
      items: [
        {
          path: "docs/v1.0/flyweight.md",
          title: "Flyweight pattern reference",
          snippet: "享元模式把可共享的部分作为内部状态，把随场景变化的部分作为外部状态。",
          score: 52
        },
        {
          path: "docs/v1.0/patterns.md",
          title: "patterns.md",
          snippet: "内部状态适合共享，外部状态由调用方按场景传入。",
          score: 41
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "享元模式会共享内部状态，并把外部状态交给调用方传入。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    await user.click(screen.getByRole("button", { name: "开启联网搜索" }));
    await screen.findByRole("button", { name: "关闭联网搜索" });
    await user.click(screen.getByRole("button", { name: "会话" }));

    await user.type(getComposerInput(), "解释享元模式");
    await user.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(getConversationRegion()).getByText("享元模式会共享内部状态，并把外部状态交给调用方传入。")).toBeInTheDocument();
      expect(within(getConversationRegion()).getByText("2 条信息引用")).toBeInTheDocument();
    });

    const prompt = chatWithOllamaModelMock.mock.calls[0]?.[0]?.message ?? "";
    expect(prompt).toContain("Flyweight pattern reference");
    expect(prompt).toContain("patterns.md");
    expect(prompt.match(/Flyweight pattern reference/g)?.length ?? 0).toBe(1);

    await user.click(within(getConversationRegion()).getByRole("button", { name: "展开信息引用" }));

    expect(
      within(getConversationRegion()).getByRole("button", { name: "打开来源：Refactoring Guru" })
    ).toBeInTheDocument();
    expect(within(getConversationRegion()).getByText("来源文件：patterns.md")).toBeInTheDocument();
    expect(within(getConversationRegion()).queryByText("来源文件：Flyweight pattern reference")).not.toBeInTheDocument();
  }, 10_000);

  it("prefers local RAG context over overlapping network references for project-style questions", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    searchNetworkMock.mockResolvedValueOnce({
      query: "根据这个项目里的规则解释享元模式",
      provider: "OpenCow 默认搜索",
      effective_provider: "OpenCow 默认搜索",
      used_fallback: false,
      fallback_reason: null,
      items: [
        {
          title: "Flyweight pattern reference",
          url: "https://example.test/flyweight",
          source_label: "Refactoring Guru",
          summary: "享元模式把可共享的部分作为内部状态，把随场景变化的部分作为外部状态。"
        }
      ]
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "根据这个项目里的规则解释享元模式",
      summary: "Local knowledge search found 1 matching passage across 4 indexed documents.",
      match_count: 1,
      indexed_document_count: 4,
      items: [
        {
          path: "docs/v1.0/flyweight.md",
          title: "Flyweight pattern reference",
          snippet: "享元模式把可共享的部分作为内部状态，把随场景变化的部分作为外部状态。",
          score: 52
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "这个项目里的规则也是把可共享的部分当作内部状态。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    await user.click(screen.getByRole("button", { name: "开启联网搜索" }));
    await screen.findByRole("button", { name: "关闭联网搜索" });
    await user.click(screen.getByRole("button", { name: "会话" }));

    await user.type(getComposerInput(), "根据这个项目里的规则解释享元模式");
    await user.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(getConversationRegion()).getByText("这个项目里的规则也是把可共享的部分当作内部状态。")).toBeInTheDocument();
    });

    const prompt = chatWithOllamaModelMock.mock.calls[0]?.[0]?.message ?? "";
    expect(prompt).toContain("本地知识库参考");
    expect(prompt).not.toContain("联网搜索参考");
    expect(prompt).not.toContain("联网搜索已开启，但本轮没有可用外部来源");
    expect(prompt).toContain("本轮联网搜索已执行，但与本地知识命中重复");
    expect(within(getConversationRegion()).getByText("1 条信息引用")).toBeInTheDocument();

    await user.click(within(getConversationRegion()).getByRole("button", { name: "展开信息引用" }));

    expect(within(getConversationRegion()).getByText("来源文件：Flyweight pattern reference")).toBeInTheDocument();
    expect(within(getConversationRegion()).queryByText("来源：Refactoring Guru")).not.toBeInTheDocument();
  }, 10_000);

  it("prefers network references over overlapping local RAG hits for time-sensitive questions", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    searchNetworkMock.mockResolvedValueOnce({
      query: "OpenAI 最近有什么新动态",
      provider: "OpenCow 默认搜索",
      effective_provider: "OpenCow 默认搜索",
      used_fallback: false,
      fallback_reason: null,
      items: [
        {
          title: "OpenAI updates",
          url: "https://example.test/openai-updates",
          source_label: "OpenAI Blog",
          summary: "OpenAI 最近发布了新的模型更新与产品能力。"
        }
      ]
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "OpenAI 最近有什么新动态",
      summary: "Local knowledge search found 1 matching passage across 4 indexed documents.",
      match_count: 1,
      indexed_document_count: 4,
      items: [
        {
          path: "docs/reference/openai.md",
          title: "OpenAI updates",
          snippet: "OpenAI 最近发布了新的模型更新与产品能力。",
          score: 49
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "这是最近的 OpenAI 动态整理。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    await user.click(screen.getByRole("button", { name: "开启联网搜索" }));
    await screen.findByRole("button", { name: "关闭联网搜索" });
    await user.click(screen.getByRole("button", { name: "会话" }));

    await user.type(getComposerInput(), "OpenAI 最近有什么新动态");
    await user.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(getConversationRegion()).getByText("这是最近的 OpenAI 动态整理。")).toBeInTheDocument();
    });

    const prompt = chatWithOllamaModelMock.mock.calls[0]?.[0]?.message ?? "";
    expect(prompt).toContain("联网搜索参考");
    expect(prompt).not.toContain("本地知识库参考");
    expect(prompt).toContain("OpenAI Blog");
    expect(within(getConversationRegion()).getByText("1 条信息引用")).toBeInTheDocument();

    await user.click(within(getConversationRegion()).getByRole("button", { name: "展开信息引用" }));

    expect(
      within(getConversationRegion()).getByRole("button", { name: "打开来源：OpenAI Blog" })
    ).toBeInTheDocument();
    expect(within(getConversationRegion()).queryByText("知识库来源")).not.toBeInTheDocument();
  }, 10_000);

  it("routes an explicit network-search request to the real search task after search is enabled", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    searchNetworkMock.mockResolvedValueOnce({
      query: "帮我上网搜索豆包",
      provider: "OpenCow 默认搜索",
      effective_provider: "OpenCow 默认搜索",
      used_fallback: false,
      fallback_reason: null,
      items: [
        {
          title: "豆包",
          url: "https://www.doubao.com/",
          summary: "豆包是字节跳动推出的 AI 助手产品。"
        }
      ]
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    await user.click(screen.getByRole("button", { name: "开启联网搜索" }));
    await screen.findByRole("button", { name: "关闭联网搜索" });
    await user.click(screen.getByRole("button", { name: "会话" }));

    await user.type(getComposerInput(), "帮我上网搜索豆包");
    await user.click(getComposerSendButton());

    await waitFor(() => {
      expect(searchNetworkMock).toHaveBeenCalledWith("帮我上网搜索豆包", expect.objectContaining({
        providerLabel: ""
      }));
      expect(within(getConversationRegion()).getByText("联网搜索结果")).toBeInTheDocument();
      expect(within(getConversationRegion()).getByText(/已参考 1 条联网资料/)).toBeInTheDocument();
      expect(within(getConversationRegion()).queryByText(/来源：豆包/)).not.toBeInTheDocument();
    });

    expect(chatWithOllamaModelMock).not.toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("豆包 (mung bean)")
    }));
  }, 10_000);

  it("opens a visible rollback confirmation when clicking the user-message rollback button", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "第一轮回答。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    await user.type(getComposerInput(), "第一轮普通对话");
    await user.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(getConversationRegion()).getByText("第一轮回答。")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "回退到这条消息之前" }));

    expect(await screen.findByRole("dialog", { name: "回退确认" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认回退" })).toBeInTheDocument();
  });

  it("removes the later model reply from conversation after confirming rollback", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "这是一条应该被回退删除的模型回复。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    await user.type(getComposerInput(), "第一轮普通对话");
    await user.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(getConversationRegion()).getByText("这是一条应该被回退删除的模型回复。")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "回退到这条消息之前" }));
    expect(await screen.findByRole("button", { name: "确认回退" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "确认回退" }));

    await waitFor(() => {
      expect(within(getConversationRegion()).queryByText("这是一条应该被回退删除的模型回复。")).not.toBeInTheDocument();
      expect(within(getConversationRegion()).getAllByText("第一轮普通对话").length).toBeGreaterThan(0);
      expect(screen.queryByRole("button", { name: "确认回退" })).not.toBeInTheDocument();
    });
  }, 10_000);

  it("keeps the conversation unchanged when native rollback file restore fails", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "这是一条不应该被错误删掉的模型回复。"
    });
    restoreRollbackFilesMock.mockRejectedValueOnce(new Error("snapshot restore failed"));

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    await user.type(getComposerInput(), "第一轮普通对话");
    await user.click(getComposerSendButton());

    await waitFor(() => {
      expect(within(getConversationRegion()).getByText("这是一条不应该被错误删掉的模型回复。")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "回退到这条消息之前" }));
    expect(await screen.findByRole("button", { name: "确认回退" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "确认回退" }));

    await waitFor(() => {
      expect(restoreRollbackFilesMock).toHaveBeenCalled();
      expect(within(getConversationRegion()).getByText("这是一条不应该被错误删掉的模型回复。")).toBeInTheDocument();
      expect(within(getConversationRegion()).getAllByText("第一轮普通对话").length).toBeGreaterThan(0);
      expect(screen.getByText("本地文件未能完整恢复")).toBeInTheDocument();
    });
  }, 10_000);

  it("uses the local model to generate and save a requested NPC config after permission approval", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: JSON.stringify({
        name: "文档处理 NPC",
        purpose: "帮助用户整理、总结和追踪本地文档处理任务",
        persona: "中文、细致、先确认输入范围",
        capabilities: ["文档归类", "摘要提取"],
        workflow: ["询问文档来源", "生成处理计划"],
        required_inputs: ["文档路径", "输出格式"],
        permissions: {
          readonly: "可规划和总结",
          workspace_write: "批准后保存配置",
          network: "单独确认"
        },
        first_message: "请告诉我要处理的文档路径和输出要求。"
      })
    });
    writeNpcConfigMock.mockResolvedValueOnce({
      npc_name: "文档处理 NPC",
      config_path: ".opencow/npcs/document-npc.json",
      status: "saved",
      summary: "Saved LLM-generated NPC config."
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    await submitComposerMessage("你能帮我配置一个文档处理npc吗");
    await approvePermissionRequest();

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
      expect(writeNpcConfigMock).toHaveBeenCalledWith(expect.objectContaining({
        query: "你能帮我配置一个文档处理npc吗",
        config: expect.objectContaining({
          name: "文档处理 NPC"
        })
      }));
    });

    const conversation = getConversationRegion();
    expect(await within(conversation).findByText("NPC 配置已保存")).toBeInTheDocument();
    expect(within(conversation).getAllByText(/\.opencow\/npcs\/document-npc\.json/).length).toBeGreaterThan(0);
    expect(chatWithOllamaModelMock.mock.calls.at(-1)?.[0]?.message).toContain("只输出一个 JSON 对象");
    expect(within(conversation).queryByText("OpenClaw NPC capability overview")).not.toBeInTheDocument();
  });

  it("marks malformed local-model NPC config output as a reviewable wrapped config", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "我建议创建一个文档处理 NPC，但这次没有输出 JSON。"
    });
    writeNpcConfigMock.mockResolvedValueOnce({
      npc_name: "文档处理 NPC",
      config_path: ".opencow/npcs/document-npc.json",
      status: "saved",
      summary: "Saved wrapped LLM-generated NPC config."
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    await submitComposerMessage("你能帮我配置一个文档处理npc吗");
    await approvePermissionRequest();

    await waitFor(() => {
      expect(writeNpcConfigMock).toHaveBeenCalledWith(expect.objectContaining({
        config: expect.objectContaining({
          unparsed_model_output: "我建议创建一个文档处理 NPC，但这次没有输出 JSON。"
        })
      }));
    });

    const conversation = getConversationRegion();
    expect(await within(conversation).findByText("NPC 配置已保存")).toBeInTheDocument();
    expect(within(conversation).getByText(/没有输出可直接解析的 JSON/)).toBeInTheDocument();
    expect(within(conversation).getByText(/安全包装配置/)).toBeInTheDocument();
    expect(within(conversation).getByText(/请继续补充资料或让模型重新生成/)).toBeInTheDocument();
  });

  it("surfaces NPC config first-token timeouts with specific recovery guidance and does not write config", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockReturnValueOnce(new Promise(() => undefined));

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    submitComposerMessageFast("你能帮我创建一个课程助手npc吗");

    const approveButton = await screen.findByRole("button", { name: "批准" });

    vi.useFakeTimers();
    try {
      fireEvent.click(approveButton);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(480_500);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(within(getConversationRegion()).getByText("NPC 配置生成失败")).toBeInTheDocument();
      expect(
        within(getConversationRegion()).getByText(/本地模型已接到 NPC 配置生成请求，但首轮输出没有在本轮超时前返回/)
      ).toBeInTheDocument();
      expect(screen.getAllByText(/NPC 配置生成卡在首轮输出前/).length).toBeGreaterThan(0);
      expect(writeNpcConfigMock).not.toHaveBeenCalled();
      expect(screen.queryByText("NPC 配置已保存")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("recovers NPC config first-token timeouts through a readonly NPC draft preview instead of retrying the write", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock
      .mockReturnValueOnce(new Promise(() => undefined))
      .mockResolvedValueOnce({
        model: "qwen3.6:35b",
        message:
          "这次不要直接保存配置。先把课程助手 NPC 收敛成只读草案：定位是课程规划与资料整理，下一步确认角色、资料来源和权限边界后再保存。"
      });
    loadOpenClawCapabilityOverviewMock.mockResolvedValueOnce({
      capability_id: "npc",
      title: "OpenClaw NPC capability overview",
      status: "ready-foundation",
      required_package_count: 3,
      available_package_count: 3,
      available_packages: ["@openclaw/llm-core", "@openclaw/llm-runtime", "@openclaw/tool-call-repair"],
      missing_packages: [],
      summary: "NPC foundation packages are available for local collaboration preview."
    });
    listEnabledLocalSkillsMock.mockResolvedValueOnce({
      summary: "Found 1 enabled local skill entry in the workspace registry.",
      total_count: 1,
      registry_path: ".opencow/skills/enabled-skills.json",
      items: [
        {
          name: "course-docs-helper",
          path: "skills/course-docs-helper/SKILL.md",
          source: "workspace-skill",
          description: "Help organize course documents."
        }
      ]
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "先给我这个 NPC 的只读草案，不要保存配置。",
      summary: "Local knowledge search returned 1 matching passage across 7 indexed documents.",
      match_count: 1,
      indexed_document_count: 7,
      items: [
        {
          path: "docs/v1.0/06-rag-skills-npc-mcp.md",
          title: "06-rag-skills-npc-mcp.md",
          snippet: "NPC 是低代码人设和工作模式配置。",
          score: 37
        }
      ]
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    submitComposerMessageFast("你能帮我创建一个课程助手npc吗");

    const approveButton = await screen.findByRole("button", { name: "批准" });

    vi.useFakeTimers();
    try {
      fireEvent.click(approveButton);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(480_500);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(within(getConversationRegion()).getByText("NPC 配置生成失败")).toBeInTheDocument();
      expect(writeNpcConfigMock).not.toHaveBeenCalled();

      await act(async () => {
        const retryButtons = screen.getAllByRole("button", { name: "重试本地任务" });
        fireEvent.click(retryButtons[retryButtons.length - 1]);
        await Promise.resolve();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(90);
        await Promise.resolve();
        await Promise.resolve();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(130);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(loadOpenClawCapabilityOverviewMock).toHaveBeenCalledWith("npc");
      expect(
        within(getConversationRegion()).getByText(/这次不要直接保存配置。先把课程助手 NPC 收敛成只读草案/)
      ).toBeInTheDocument();

      expect(chatWithOllamaModelMock).toHaveBeenCalledTimes(2);
      expect(writeNpcConfigMock).not.toHaveBeenCalled();
      expect(screen.queryByText("NPC 配置已保存")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts an in-flight NPC config generation when the user stops the task", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    let resolveNpcConfigGeneration: (value: { model: string; message: string }) => void = () => undefined;
    chatWithOllamaModelMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveNpcConfigGeneration = resolve;
    }));

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    submitComposerMessageFast("你能帮我配置一个文档处理npc吗");
    const approveButton = await screen.findByRole("button", { name: "批准" });
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
    });

    const request = chatWithOllamaModelMock.mock.calls.at(-1)?.[0] as { requestId?: string; signal?: AbortSignal };

    const stopButtons = screen.getAllByRole("button", { name: "停止任务" });
    fireEvent.click(stopButtons.find((button) => button.classList.contains("send-button")) ?? stopButtons[0]);

    await waitFor(() => {
      expect(request.signal?.aborted).toBe(true);
    });
    expect(request.requestId).toMatch(/^local-model-chat-/);
    expect(cancelOllamaChatMock).toHaveBeenCalledWith(request.requestId);

    await act(async () => {
      resolveNpcConfigGeneration({
        model: "qwen3.6:35b",
        message: JSON.stringify({
          name: "迟到 NPC",
          purpose: "这次迟到成功不能覆盖停止状态"
        })
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getAllByText(/本地任务已停止/).length).toBeGreaterThan(0);
    });

    expect(writeNpcConfigMock).not.toHaveBeenCalled();
    expect(screen.queryByText("NPC 配置已保存")).not.toBeInTheDocument();
    expect(screen.queryByText("迟到 NPC")).not.toBeInTheDocument();
  });

  it("does not write a late NPC config result after starting a new conversation", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    let resolveNpcConfigGeneration: (value: { model: string; message: string }) => void = () => undefined;
    chatWithOllamaModelMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveNpcConfigGeneration = resolve;
    }));

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    submitComposerMessageFast("你能帮我配置一个文档处理npc吗");
    fireEvent.click(await screen.findByRole("button", { name: "批准" }));

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
    });

    const request = chatWithOllamaModelMock.mock.calls.at(-1)?.[0] as { requestId?: string; signal?: AbortSignal };

    fireEvent.click(screen.getByRole("button", { name: "创建新会话" }));

    await waitFor(() => {
      expect(request.signal?.aborted).toBe(true);
    });
    expect(request.requestId).toMatch(/^local-model-chat-/);
    expect(cancelOllamaChatMock).toHaveBeenCalledWith(request.requestId);

    await act(async () => {
      resolveNpcConfigGeneration({
        model: "qwen3.6:35b",
        message: JSON.stringify({
          name: "新对话后的迟到 NPC",
          purpose: "这次迟到成功不能写入配置"
        })
      });
      await Promise.resolve();
    });

    expect(writeNpcConfigMock).not.toHaveBeenCalled();
    expect(screen.queryByText("NPC 配置已保存")).not.toBeInTheDocument();
    expect(screen.queryByText("新对话后的迟到 NPC")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
  });

  it("routes an explicit workspace inspection request into the workspace overview result instead of generic help copy", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "这个项目是一个桌面优先的本地助手工作区，当前重点在对话主链、受控执行和恢复能力。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    submitComposerMessageFast("inspect the current workspace and summarize it");

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getAllByText("inspect the current workspace and summarize it").length).toBeGreaterThan(0);
      expect(within(conversation).getByText("工作区说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/桌面优先的本地助手工作区/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen3.6:35b",
      message: expect.stringContaining("只读工作区事实：")
    }));
  });

  it("routes a generic project summary request into the workspace overview result instead of generic help copy", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "这个项目目前更像在持续压实中的本地主机助手，重点模块围绕 OpenCow 桌面端、适配层和安全链路展开。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    submitComposerMessageFast("summarize this project");

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getAllByText("summarize this project").length).toBeGreaterThan(0);
      expect(within(conversation).getByText("工作区说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/持续压实中的本地主机助手/)).toBeInTheDocument();
    });
  });

  it("routes an explicit packages inspection request into the workspace packages overview result", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    loadWorkspacePackagesOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      package_count: 3,
      package_names: ["openclaw-adapter", "permission-engine", "shell-runtime"],
      total_script_count: 9,
      packages_with_scripts: ["openclaw-adapter", "permission-engine"],
      summary: "Workspace package inspection found 3 packages and 9 npm scripts."
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "这个工作区有 3 个本地包，脚本集中在适配层和权限/运行时链路，下一步应优先确认 verify:all 和桌面启动脚本。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    submitComposerMessageFast("inspect workspace packages and scripts");

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getAllByText("inspect workspace packages and scripts").length).toBeGreaterThan(0);
      expect(within(conversation).getByText("包与脚本说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/脚本集中在适配层和权限\/运行时链路/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen3.6:35b",
      message: expect.stringContaining("重点解释包结构、脚本数量、可运行入口")
    }));
  });

  it("routes an explicit config inspection request into the workspace config overview result", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    loadWorkspaceConfigOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      config_files: ["package.json", "apps/desktop/package.json", "apps/desktop/src-tauri/Cargo.toml"],
      root_script_names: ["dev", "desktop:dev", "verify:all"],
      root_script_count: 3,
      package_manager_files: ["package-lock.json"],
      summary: "Workspace config inspection found 3 key config files and 3 root scripts."
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "这个配置面说明根目录脚本已经覆盖开发、桌面启动和完整验证，排查报错时应先看 package.json 与 Tauri 配置。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    submitComposerMessageFast("inspect workspace config and root scripts");

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getAllByText("inspect workspace config and root scripts").length).toBeGreaterThan(0);
      expect(within(conversation).getByText("配置说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/根目录脚本已经覆盖开发、桌面启动和完整验证/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen3.6:35b",
      message: expect.stringContaining("重点解释配置文件、根脚本、包管理线索")
    }));
  });

  it("explains readonly shell git status results through the selected local model instead of fixed command preview", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    runReadonlyShellCommandMock.mockResolvedValueOnce({
      command_id: "git-status",
      command_label: "git status --short",
      permission: "readonly",
      stdout_preview: " M apps/desktop/src/app/App.tsx\n M apps/desktop/src/app/app.test.tsx",
      stderr_preview: "",
      status_code: 0,
      summary: "Readonly shell command completed."
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "当前只是只读查看 git 状态，工作区有 App 和测试文件变更；下一步应先跑相关测试，再决定是否提交。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    submitComposerMessageFast("check git status for this workspace");

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getAllByText("check git status for this workspace").length).toBeGreaterThan(0);
      expect(within(conversation).getByText("Git 状态诊断说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/当前只是只读查看 git 状态/)).toBeInTheDocument();
    });
    expect(within(conversation).queryByText(/命令：git status --short/)).not.toBeInTheDocument();
    expect(within(conversation).queryByText(/输出预览：\s+M apps\/desktop\/src\/app\/App\.tsx/)).not.toBeInTheDocument();
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen3.6:35b",
      message: expect.stringContaining("重点解释 git 状态只读诊断结果")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("命令：git status --short")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("为什么本轮没有执行写入")
    }));
  });

  it("falls back to readonly shell facts when local-model explanation stalls", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    runReadonlyShellCommandMock.mockResolvedValueOnce({
      command_id: "git-status",
      command_label: "git status --short",
      permission: "readonly",
      stdout_preview: " M apps/desktop/src/app/App.tsx",
      stderr_preview: "",
      status_code: 0,
      summary: "Readonly shell command completed."
    });
    chatWithOllamaModelMock.mockRejectedValueOnce(
      new Error("Assistant task result explanation exceeded 10 seconds.")
    );

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    await submitComposerMessage("check git status for this workspace");

    const conversation = getConversationRegion();
    await waitFor(() => {
      expect(within(conversation).getByText("Workspace git status")).toBeInTheDocument();
      expect(within(conversation).getByText(/命令：git status --short/)).toBeInTheDocument();
      expect(within(conversation).getByText(/输出预览：\s+M apps\/desktop\/src\/app\/App\.tsx/)).toBeInTheDocument();
    });
    expect(within(conversation).getByText(/Assistant task result explanation skipped after local model failure/i)).toBeInTheDocument();
    expect(screen.queryByText(/本地任务执行失败|Local task execution timed out/i)).not.toBeInTheDocument();
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      requestId: expect.stringMatching(/^readonly-shell-git-status-explanation-/)
    }));
  }, 15_000);

  it("explains local RAG shell handoff previews through the model while continue still requests permission", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "review local shell permission rules and preview the next safe shell step to create a temp-output folder",
      summary: "Local knowledge search returned 2 matching passages across 7 indexed documents.",
      match_count: 2,
      indexed_document_count: 7,
      items: [
        {
          path: "docs/v1.0/04-permission-safety-shell.md",
          title: "04-permission-safety-shell.md",
          snippet: "Shell execution must include permission checks and confirmation.",
          score: 42
        },
        {
          path: "OPENCOW_CORE_RULES.md",
          title: "OPENCOW_CORE_RULES.md",
          snippet: "Permissions, shell, safety, logs, and rollback are core safety paths.",
          score: 27
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message:
        "本轮只是基于本地 RAG 预览 Shell 交接计划，还没有创建 temp-output；如果继续，会先进入 workspace-write 提权审批，再按受控命令执行。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    await submitComposerMessage("review local shell permission rules and preview the next safe shell step to create a temp-output folder");

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getByText("RAG Shell 交接预览说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/本轮只是基于本地 RAG 预览 Shell 交接计划/)).toBeInTheDocument();
    });
    expect(within(conversation).queryByText("Local RAG shell handoff preview")).not.toBeInTheDocument();
    expect(runWorkspaceWriteShellCommandMock).not.toHaveBeenCalled();
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      requestId: expect.stringMatching(/^rag-local-shell-handoff-preview-explanation-/),
      message: expect.stringContaining("继续时仍必须经过权限审批")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("New-Item -ItemType Directory -Force temp-output")
    }));

    await submitComposerMessage("继续");

    expect(await screen.findByRole("button", { name: /批准|批准提权/ })).toBeInTheDocument();
    expect(screen.getByText(/workspace-write/i)).toBeInTheDocument();
    expect(runWorkspaceWriteShellCommandMock).not.toHaveBeenCalled();
  });

  it("explains an explicit RAG capability overview through the local model instead of fixed catalog copy", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    loadOpenClawCapabilityOverviewMock.mockResolvedValueOnce({
      capability_id: "rag",
      title: "OpenClaw RAG capability overview",
      status: "ready-foundation",
      required_package_count: 3,
      available_package_count: 3,
      available_packages: ["@openclaw/llm-core", "@openclaw/llm-runtime", "@openclaw/model-catalog-core"],
      missing_packages: [],
      summary: "OpenClaw RAG foundation check found 3 of 3 required packages."
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "RAG 基础包已经齐全，适合先做只读文档检索和索引自检，再逐步接入更深的本地知识库恢复链路。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    await submitComposerMessage("inspect the local rag capability wiring");

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getAllByText("inspect the local rag capability wiring").length).toBeGreaterThan(0);
      expect(within(conversation).getByText("RAG 能力说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/RAG 基础包已经齐全/)).toBeInTheDocument();
    });
    expect(within(conversation).queryByText("OpenClaw RAG capability overview")).not.toBeInTheDocument();
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen3.6:35b",
      message: expect.stringContaining("重点解释 RAG 能力当前可用基础")
    }));
  });

  it("explains readonly NPC collaboration previews through the selected local model", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    loadOpenClawCapabilityOverviewMock.mockResolvedValueOnce({
      capability_id: "npc",
      title: "OpenClaw NPC capability overview",
      status: "ready-foundation",
      required_package_count: 3,
      available_package_count: 3,
      available_packages: ["@openclaw/llm-core", "@openclaw/llm-runtime", "@openclaw/tool-call-repair"],
      missing_packages: [],
      summary: "NPC foundation packages are available for local collaboration preview."
    });
    listEnabledLocalSkillsMock.mockResolvedValueOnce({
      summary: "Found 2 enabled local skill entries in the workspace registry.",
      total_count: 2,
      registry_path: ".opencow/skills/enabled-skills.json",
      items: [
        {
          name: "coding-agent",
          path: "vendor/openclaw/skills/coding-agent/SKILL.md",
          source: "vendor-openclaw-skill",
          description: "OpenClaw coding agent workflow"
        },
        {
          name: "docs-helper",
          path: "skills/docs-helper/SKILL.md",
          source: "workspace-skill",
          description: "Help search local docs and rules."
        }
      ]
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "preview an npc collaboration plan for local shell permission rules",
      summary: "Local knowledge search returned 2 matching passages across 7 indexed documents.",
      match_count: 2,
      indexed_document_count: 7,
      items: [
        {
          path: "docs/v1.0/04-permission-safety-shell.md",
          title: "04-permission-safety-shell.md",
          snippet: "Shell execution must include permission checks and confirmation.",
          score: 42
        },
        {
          path: "OPENCOW_CORE_RULES.md",
          title: "OPENCOW_CORE_RULES.md",
          snippet: "Permissions, shell, safety, logs, and rollback are core safety paths.",
          score: 27
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "NPC 协作预览显示 ready-foundation 已具备，coding-agent 与 docs-helper 可以辅助读取仓库和规则；下一步如果要执行 Shell，仍必须走权限审批。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    await submitComposerMessage("preview an npc collaboration plan for local shell permission rules");

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getByText("NPC 协作预览说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/coding-agent 与 docs-helper/)).toBeInTheDocument();
    });
    expect(within(conversation).queryByText("NPC collaboration preview")).not.toBeInTheDocument();
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen3.6:35b",
      message: expect.stringContaining("04-permission-safety-shell.md")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("已启用 Skills")
    }));
  });

  it("runs real network search after enabling search from the search workspace", async () => {
    const user = setupUser();
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    searchNetworkMock.mockResolvedValueOnce({
      query: "search the web for latest local RAG indexing approaches",
      provider: "Tavily",
      effective_provider: "Tavily",
      used_fallback: false,
      fallback_reason: null,
      items: [
        {
          title: "Local RAG Indexing Guide",
          url: "https://example.com/rag-indexing",
          summary: "介绍本地 RAG 索引的常见方案。"
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "联网搜索结果\n已通过 Tavily 返回 1 条参考。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    await user.click(screen.getByRole("button", { name: "开启联网搜索" }));
    await screen.findByRole("button", { name: "关闭联网搜索" });
    await user.clear(screen.getByRole("textbox", { name: "联网搜索 Provider" }));
    await user.type(screen.getByRole("textbox", { name: "联网搜索 Provider" }), "Tavily");
    await user.click(screen.getByRole("button", { name: "保存联网搜索配置" }));
    await user.click(screen.getByRole("button", { name: "创建新会话" }));

    await user.type(getComposerInput(), "search the web for latest local RAG indexing approaches");
    await user.click(getComposerSendButton());

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getAllByText("search the web for latest local RAG indexing approaches").length).toBeGreaterThan(0);
      expect(within(conversation).queryByText("概览：联网搜索结果")).not.toBeInTheDocument();
      expect(
        within(conversation).getByText((_, element) =>
          Boolean(element?.classList.contains("message-title") && element.textContent === "联网搜索结果")
        )
      ).toBeInTheDocument();
      expect(within(conversation).getByText(/已参考 1 条联网资料/)).toBeInTheDocument();
    });
  }, 10_000);

  it("shows a visible assistant pending block while an ordinary chat request is still running", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    let resolveChat: (value: { model: string; message: string }) => void = () => undefined;
    chatWithOllamaModelMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveChat = resolve;
    }));

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    submitComposerMessageFast("你能干什么");

    const pending = await screen.findByLabelText("assistant-pending");
    expect(within(pending).getByText("正在思考")).toBeInTheDocument();
    expect(within(pending).queryByText(/本地模型首轮响应可能较慢/)).not.toBeInTheDocument();
    expect(within(pending).queryByText("你能干什么")).not.toBeInTheDocument();
    expect(within(pending).queryByText(/已进入本地任务队列|正在本地执行链中处理/)).not.toBeInTheDocument();
    expect(within(pending).queryByText(/不会重复提交同一请求|请稍候/)).not.toBeInTheDocument();
    expect(within(pending).queryByRole("button", { name: "停止任务" })).not.toBeInTheDocument();

    await act(async () => {
      resolveChat({
        model: "qwen3.6:35b",
        message: "我会通过本地模型继续处理你的请求。"
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    });
  }, 10000);

  it("keeps the composer available after an ordinary chat response returns", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    await submitComposerMessage("你能干什么");

    await waitFor(() => {
      expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    });

    expect(getComposerInput()).toBeEnabled();
    expect(getComposerSendButton()).toBeInTheDocument();
  }, 10000);

  it("starts a visually blank new conversation while keeping model selection available", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    await submitComposerMessage("你能干什么");

    await waitFor(() => {
      expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    });

    expect(within(getConversationRegion()).getAllByText("你能干什么").length).toBeGreaterThan(0);

    await click(screen.getByRole("button", { name: "创建新会话" }));

    const conversation = getConversationRegion();
    expect(within(conversation).queryAllByText("你能干什么")).toHaveLength(0);
    expect(within(conversation).queryAllByText(/本地助手能力说明|Workspace overview|本地助手答复/)).toHaveLength(0);
    expect(within(conversation).queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByText("本地任务")).not.toBeInTheDocument();
    expect(await findModelPicker("qwen3.6:35b")).toBeInTheDocument();
    expect(getComposerInput()).toBeEnabled();
  }, 10000);

  it("continues from skill enable permission approval into the final enabled result", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    enableLocalSkillMock.mockResolvedValueOnce({
      query: "enable the coding-agent skill for this workspace",
      enabled_skill_name: "coding-agent",
      registry_path: ".opencow/skills/enabled-skills.json",
      status: "enabled",
      summary: "Local skill enablement registered coding-agent in the workspace skill registry."
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message:
        "coding-agent 已在批准工作区读写后写入 enabled skills 注册表。下一步可以让它参与代码任务，但这一步只是启用注册表，没有执行 Skill。"
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "enable the coding-agent skill for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    const approvePermissionButton = await screen.findByRole("button", { name: "批准" });
    fireEvent.click(approvePermissionButton);

    await waitFor(() => {
      expect(within(getConversationRegion()).getByText("Skill 启用结果说明")).toBeInTheDocument();
      expect(within(getConversationRegion()).getByText(/coding-agent 已在批准工作区读写后写入 enabled skills 注册表/)).toBeInTheDocument();
    });
    expect(enableLocalSkillMock).toHaveBeenCalledTimes(1);
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen2.5-coder:7b",
      message: expect.stringContaining("用户批准 workspace-write")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("目标 Skill：coding-agent")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("状态：enabled")
    }));
  });

  it("falls back to verified skill enable facts when post-approval explanation stalls", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    enableLocalSkillMock.mockResolvedValueOnce({
      query: "enable the coding-agent skill for this workspace",
      enabled_skill_name: "coding-agent",
      registry_path: ".opencow/skills/enabled-skills.json",
      status: "enabled",
      summary: "Local skill enablement registered coding-agent in the workspace skill registry."
    });
    chatWithOllamaModelMock.mockReturnValueOnce(new Promise(() => undefined));

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "enable the coding-agent skill for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    fireEvent.click(await screen.findByRole("button", { name: "批准" }));

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
        requestId: expect.stringMatching(/^skills-local-enable-explanation-/)
      }));
    });

    const conversation = getConversationRegion();
    expect(await within(conversation).findByText("本地 Skill 启用结果", {}, { timeout: 12_000 })).toBeInTheDocument();
    expect(within(conversation).getByText(/目标 Skill：coding-agent/)).toBeInTheDocument();
    expect(within(conversation).getByText(/注册表：\.opencow\/skills\/enabled-skills\.json/)).toBeInTheDocument();
    expect(screen.queryByText(/本地任务执行失败|Local task execution timed out/i)).not.toBeInTheDocument();
    expect(cancelOllamaChatMock).toHaveBeenCalledWith(expect.stringMatching(/^skills-local-enable-explanation-/));
    expect(enableLocalSkillMock).toHaveBeenCalledTimes(1);
  }, 15_000);

  it("continues from skill install permission approval into the final installed result", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    installLocalSkillMock.mockResolvedValueOnce({
      query: "install the gpt-taste skill into this workspace skills folder",
      installed_skill_name: "gpt-taste",
      installed_skill_path: "skills/gpt-taste/SKILL.md",
      source_skill_path: "vendor/openclaw/skills/gpt-taste/SKILL.md",
      status: "installed",
      summary: "Local skill installation copied gpt-taste into the workspace skills directory."
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message:
        "gpt-taste 已在批准工作区读写后复制到 workspace skills 目录。下一步可以检查 Skill 内容并决定是否启用，但这一步没有执行 Skill。"
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "install the gpt-taste skill into this workspace skills folder" }
    });
    fireEvent.click(getComposerSendButton());

    const permissionReasonMatches = await screen.findAllByText(/需要先授予工作区读写权限/i);
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    expect(permissionSection).not.toBeNull();

    fireEvent.click(within(permissionSection as HTMLElement).getAllByRole("button")[0]);

    await waitFor(() => {
      expect(within(getConversationRegion()).getByText("Skill 安装结果说明")).toBeInTheDocument();
      expect(within(getConversationRegion()).getByText(/gpt-taste 已在批准工作区读写后复制到 workspace skills 目录/)).toBeInTheDocument();
    });
    expect(installLocalSkillMock).toHaveBeenCalledTimes(1);
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen2.5-coder:7b",
      message: expect.stringContaining("用户批准 workspace-write")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("目标 Skill：gpt-taste")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("vendor/openclaw/skills/gpt-taste/SKILL.md")
    }));
  });

  it("falls back to verified skill install facts when post-approval explanation stalls", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    installLocalSkillMock.mockResolvedValueOnce({
      query: "install the gpt-taste skill into this workspace skills folder",
      installed_skill_name: "gpt-taste",
      installed_skill_path: "skills/gpt-taste/SKILL.md",
      source_skill_path: "vendor/openclaw/skills/gpt-taste/SKILL.md",
      status: "installed",
      summary: "Local skill installation copied gpt-taste into the workspace skills directory."
    });
    chatWithOllamaModelMock.mockReturnValueOnce(new Promise(() => undefined));

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "install the gpt-taste skill into this workspace skills folder" }
    });
    fireEvent.click(getComposerSendButton());

    const permissionReasonMatches = await screen.findAllByText(/需要先授予工作区读写权限/i);
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    expect(permissionSection).not.toBeNull();

    fireEvent.click(within(permissionSection as HTMLElement).getAllByRole("button")[0]);

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
        requestId: expect.stringMatching(/^skills-local-install-explanation-/)
      }));
    });

    const conversation = getConversationRegion();
    expect(await within(conversation).findByText("本地 Skill 安装结果", {}, { timeout: 12_000 })).toBeInTheDocument();
    expect(within(conversation).getByText(/目标 Skill：gpt-taste/)).toBeInTheDocument();
    expect(within(conversation).getByText(/安装路径：skills\/gpt-taste\/SKILL\.md/)).toBeInTheDocument();
    expect(screen.queryByText(/本地任务执行失败|Local task execution timed out/i)).not.toBeInTheDocument();
    expect(cancelOllamaChatMock).toHaveBeenCalledWith(expect.stringMatching(/^skills-local-install-explanation-/));
    expect(installLocalSkillMock).toHaveBeenCalledTimes(1);
  }, 15_000);

  it("explains approved temp-output creation through the local model instead of fixed command text", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    runWorkspaceWriteShellCommandMock.mockResolvedValueOnce({
      command_id: "create-temp-output-dir",
      command_label: "New-Item -ItemType Directory -Force temp-output",
      stdout_preview: "temp-output",
      line_count: 1,
      summary: "Workspace write shell command completed successfully."
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message:
        "temp-output 已在你批准工作区读写后由受控 shell runner 创建，命令只作用于工作区内这个输出目录；后续可以把临时产物放进去，删除仍要走确认边界。"
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "create a temp-output folder for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    const permissionReasonMatches = await screen.findAllByText(/需要先授予工作区读写权限/i);
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    expect(permissionSection).not.toBeNull();
    expect(runWorkspaceWriteShellCommandMock).not.toHaveBeenCalled();

    fireEvent.click(within(permissionSection as HTMLElement).getAllByRole("button")[0]);

    await waitFor(() => {
      expect(within(getConversationRegion()).getByText("temp-output 创建结果说明")).toBeInTheDocument();
      expect(within(getConversationRegion()).getByText(/temp-output 已在你批准工作区读写后/)).toBeInTheDocument();
    });
    expect(runWorkspaceWriteShellCommandMock).toHaveBeenCalledWith(
      "create-temp-output-dir",
      expect.objectContaining({
        conversationId: expect.any(String),
        rollbackEntryId: expect.any(String)
      })
    );
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      requestId: expect.stringMatching(/^workspace-write-create-temp-output-explanation-/),
      message: expect.stringContaining("用户批准 workspace-write")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("New-Item -ItemType Directory -Force temp-output")
    }));
    expect(within(getConversationRegion()).queryByText(/Workspace write shell command completed successfully/)).not.toBeInTheDocument();
  });

  it("imports selected local knowledge files into the OpenCow file pool from the knowledge page", async () => {
    pickChatAttachmentsMock.mockResolvedValueOnce([
      {
        id: "knowledge-1",
        name: "faq.md",
        mimeType: "text/markdown",
        sizeBytes: 128,
        kind: "file",
        filePath: "/tmp/faq.md",
        source: "picker"
      },
      {
        id: "knowledge-2",
        name: "ignore.pdf",
        mimeType: "application/pdf",
        sizeBytes: 256,
        kind: "file",
        filePath: "/tmp/ignore.pdf",
        source: "picker"
      }
    ]);
    importKnowledgeFileMock.mockResolvedValueOnce({
      importedFiles: [],
      availableFiles: [{ path: "knowledge/files/faq.md", title: "faq.md" }],
      indexedDocumentCount: 0,
      registryPath: "knowledge/imported-files.json",
      summary: "Knowledge file copied into OpenCow file pool.",
      activeLibraryId: "default-library",
      activeLibraryLabel: "默认知识库",
      libraries: [{ id: "default-library", label: "默认知识库", description: "系统默认知识库", documentCount: 0 }]
    });

    render(<App />);

    await click(await screen.findByRole("button", { name: "知识库" }));
    await click(await screen.findByRole("button", { name: "上传文件到文件库" }));

    await waitFor(() => {
      expect(importKnowledgeFileMock).toHaveBeenCalledWith(
        "/tmp/faq.md",
        "default-library",
        expect.objectContaining({
          conversationId: expect.any(String),
          rollbackEntryId: expect.any(String)
        })
      );
    });
    expect(importKnowledgeFileMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to verified temp-output command facts when post-approval explanation stalls", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    runWorkspaceWriteShellCommandMock.mockResolvedValueOnce({
      command_id: "create-temp-output-dir",
      command_label: "New-Item -ItemType Directory -Force temp-output",
      stdout_preview: "temp-output",
      line_count: 1,
      summary: "Workspace write shell command completed successfully."
    });
    chatWithOllamaModelMock.mockReturnValueOnce(new Promise(() => undefined));

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "create a temp-output folder for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    const permissionReasonMatches = await screen.findAllByText(/需要先授予工作区读写权限/i);
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    expect(permissionSection).not.toBeNull();

    fireEvent.click(within(permissionSection as HTMLElement).getAllByRole("button")[0]);

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
        requestId: expect.stringMatching(/^workspace-write-create-temp-output-explanation-/)
      }));
    });

    const conversation = getConversationRegion();
    expect(await within(conversation).findByText("Create temp-output directory", {}, { timeout: 12_000 })).toBeInTheDocument();
    expect(within(conversation).getByText(/工作区写入命令已完成/)).toBeInTheDocument();
    expect(within(conversation).queryByText(/Workspace write shell command completed successfully/)).not.toBeInTheDocument();
    expect(within(conversation).getByText(/New-Item -ItemType Directory -Force temp-output/)).toBeInTheDocument();
    expect(screen.queryByText(/本地任务执行失败|Local task execution timed out/i)).not.toBeInTheDocument();
    expect(cancelOllamaChatMock).toHaveBeenCalledWith(expect.stringMatching(/^workspace-write-create-temp-output-explanation-/));
    expect(runWorkspaceWriteShellCommandMock).toHaveBeenCalledTimes(1);
  }, 15_000);

  it("shows the final enabled skills list result for an explicit readonly skills registry request", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    listEnabledLocalSkillsMock.mockResolvedValueOnce({
      summary: "Enabled local skills registry currently contains 1 enabled skill entry.",
      total_count: 1,
      registry_path: ".opencow/skills/enabled-skills.json",
      items: [
        {
          name: "coding-agent",
          path: "vendor/openclaw/skills/coding-agent/SKILL.md",
          source: "vendor-openclaw-skill",
          description: "OpenClaw coding agent workflow"
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message: "当前只启用了 coding-agent，它适合代码实现与仓库上下文协作；注册表在 .opencow/skills/enabled-skills.json，后续安装或改配置仍要走审批。"
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    await submitComposerMessage("show enabled skills for this workspace");

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getByText("已启用 Skills 说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/只启用了 coding-agent/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen2.5-coder:7b",
      message: expect.stringContaining("coding-agent")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining(".opencow/skills/enabled-skills.json")
    }));
  });

  it("shows the final enabled skill recommendation result for an explicit readonly match request", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "which enabled skill should handle shell automation in this workspace",
      summary: "Enabled local skill matching found 1 recommended skill across 2 enabled entries.",
      registry_path: ".opencow/skills/enabled-skills.json",
      enabled_skill_count: 2,
      match_count: 1,
      items: [
        {
          name: "shell-automation",
          path: "skills/shell-automation/SKILL.md",
          source: "workspace-skill",
          description: "Run safe local shell automation tasks.",
          content_preview: "Use this skill when the task needs shell automation with local safety rails."
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message: "推荐使用 shell-automation，因为它明确面向带安全护栏的本地 Shell 自动化；真正执行写入或清理时仍必须进入权限审批和高风险确认链。"
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    await submitComposerMessage("which enabled skill should handle shell automation in this workspace");

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getByText("已启用 Skill 推荐")).toBeInTheDocument();
      expect(within(conversation).getByText(/推荐使用 shell-automation/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen2.5-coder:7b",
      message: expect.stringContaining("shell-automation")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("权限边界")
    }));
  });

  it("explains local skill scan results through the selected local model", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    scanLocalSkillsMock.mockResolvedValueOnce({
      summary: "Local skills scan found 3 skills across 2 scanned roots.",
      total_count: 3,
      scanned_root_count: 2,
      items: [
        {
          name: "coding-agent",
          path: "vendor/openclaw/skills/coding-agent/SKILL.md",
          source: "vendor-openclaw-skill",
          description: "OpenClaw coding agent workflow",
          enabled: true
        },
        {
          name: "browser-automation",
          path: "vendor/openclaw/extensions/browser/skills/browser-automation/SKILL.md",
          source: "vendor-openclaw-extension-skill",
          description: "OpenClaw browser automation skill",
          enabled: false
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message: "当前扫描到 3 个本地 Skills，其中 coding-agent 已启用，browser-automation 还只是可用候选；后续启用或安装仍要经过权限链。"
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    await submitComposerMessage("scan local skills and list available skill entries");

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getByText("本地 Skills 扫描说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/coding-agent 已启用/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen2.5-coder:7b",
      message: expect.stringContaining("browser-automation")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("已启用项")
    }));
  });

  it("shows the final local skill detail result for an explicit readonly skill inspection request", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    inspectLocalSkillMock.mockResolvedValueOnce({
      query: "show details for the coding-agent skill",
      summary: "Local skill detail lookup found 1 matching skill across 2 scanned roots.",
      match_count: 1,
      scanned_root_count: 2,
      items: [
        {
          name: "coding-agent",
          path: "vendor/openclaw/skills/coding-agent/SKILL.md",
          source: "vendor-openclaw-skill",
          description: "OpenClaw coding agent workflow",
          content_preview: "Use this skill when implementing focused coding tasks with tight repo context.",
          enabled: true
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message: "coding-agent 是一个已启用的 OpenClaw 编码协作 Skill，适合实现聚焦代码任务和读取仓库上下文，但真正修改文件仍要进入受控权限链。"
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    await submitComposerMessage("show details for the coding-agent skill");

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getByText("Skill 详情说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/coding-agent 是一个已启用/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen2.5-coder:7b",
      message: expect.stringContaining("Use this skill when implementing focused coding tasks")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("启用状态")
    }));
  });

  it("explains local MCP plugin scan results through the selected local model", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    scanLocalMcpPluginsMock.mockResolvedValueOnce({
      summary: "Local MCP plugin scan found 2 plugin entries across 2 scanned roots.",
      total_count: 2,
      scanned_root_count: 2,
      items: [
        {
          id: "browser",
          path: "vendor/openclaw/extensions/browser/openclaw.plugin.json",
          source: "vendor-openclaw-extension-plugin",
          activation: "startup",
          tool_count: 1,
          skill_count: 1
        },
        {
          id: "codex-supervisor",
          path: "vendor/openclaw/extensions/codex-supervisor/openclaw.plugin.json",
          source: "vendor-openclaw-extension-plugin",
          activation: "manual",
          tool_count: 5,
          skill_count: 0
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message: "当前扫描到 browser 和 codex-supervisor 两个本地 MCP 插件入口；browser 是 startup 激活线索，但真正启动仍要经过受控权限链。"
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    await submitComposerMessage("scan local mcp plugins and list available model context protocol entries");

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getByText("本地 MCP 插件扫描说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/browser 和 codex-supervisor/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen2.5-coder:7b",
      message: expect.stringContaining("codex-supervisor")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("可用工具边界")
    }));
  });

  it("explains local MCP plugin detail results through the selected local model", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    inspectLocalMcpPluginMock.mockResolvedValueOnce({
      query: "show details for the browser mcp plugin",
      summary: "Local MCP plugin detail lookup found 1 matching plugin across 2 scanned roots.",
      match_count: 1,
      scanned_root_count: 2,
      items: [
        {
          id: "browser",
          path: "vendor/openclaw/extensions/browser/openclaw.plugin.json",
          source: "vendor-openclaw-extension-plugin",
          activation: "startup",
          tool_count: 1,
          skill_count: 1,
          description: "Browser automation plugin entry.",
          tool_names: ["browser"],
          skill_paths: ["./skills"]
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message: "browser MCP 插件暴露 browser 工具和 ./skills 目录，适合浏览器自动化；当前只是读取 manifest 详情，不能绕过配置和权限边界。"
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    await submitComposerMessage("show details for the browser mcp plugin");

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getByText("MCP 插件详情说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/browser MCP 插件暴露 browser 工具/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen2.5-coder:7b",
      message: expect.stringContaining("Browser automation plugin entry")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("配置边界")
    }));
  });

  it("explains local MCP plugin start previews through the selected local model without running the plugin", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    previewLocalMcpPluginStartMock.mockResolvedValueOnce({
      query: "preview starting the browser mcp plugin locally",
      summary: "Local MCP plugin start preview found 1 matching plugin across 2 scanned roots.",
      match_count: 1,
      scanned_root_count: 2,
      items: [
        {
          id: "browser",
          path: "vendor/openclaw/extensions/browser/openclaw.plugin.json",
          source: "vendor-openclaw-extension-plugin",
          activation: "startup",
          startup_allowed: false,
          command_preview: "No resolved executable launcher for this local MCP plugin in the current desktop slice.",
          working_directory: "vendor/openclaw/extensions/browser",
          risk_summary:
            "Preview only. The current desktop slice can inspect this plugin manifest, but it does not yet resolve or launch a real local MCP plugin process.",
          requires_config: false,
          config_hint: "No required config schema fields were detected."
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message: "这是 browser MCP 插件的启动预览：当前没有已验证的 executable launcher，所以没有启动真实进程；继续启动前必须补齐启动器并走受控权限确认。"
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    await submitComposerMessage("preview starting the browser mcp plugin locally");

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getByText("MCP 插件启动预览说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/没有启动真实进程/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen2.5-coder:7b",
      message: expect.stringContaining("当前桌面端尚未实现已验证的 MCP 插件启动器")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("为什么只是预览")
    }));
    expect(runControlledFullShellCommandMock).not.toHaveBeenCalled();
  });

  it("shows the final skill-assisted readonly RAG result for an explicit enabled docs skill request", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use the enabled docs skill to search local rules for shell permission guidance",
      summary: "Enabled local skill matching found 1 recommended skill across 2 enabled entries.",
      registry_path: ".opencow/skills/enabled-skills.json",
      enabled_skill_count: 2,
      match_count: 1,
      items: [
        {
          name: "docs-helper",
          path: "skills/docs-helper/SKILL.md",
          source: "workspace-skill",
          description: "Help search local docs, rules, and knowledge files.",
          content_preview: "Use this skill when the task needs local document lookup and rule retrieval."
        }
      ]
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "use the enabled docs skill to search local rules for shell permission guidance",
      summary: "Local knowledge search returned 2 matching passages across 7 indexed documents.",
      match_count: 2,
      indexed_document_count: 7,
      items: [
        {
          path: "docs/v1.0/04-permission-safety-shell.md",
          title: "04-permission-safety-shell.md",
          snippet: "Shell execution must include permission checks and confirmation.",
          score: 42
        },
        {
          path: "OPENCOW_CORE_RULES.md",
          title: "OPENCOW_CORE_RULES.md",
          snippet: "Permissions, shell, safety, logs, and rollback are core safety paths.",
          score: 27
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message: "根据 docs-helper 匹配结果和本地规则文档，Shell 权限链路必须先走权限检查、确认、审计和超时保护，再执行受控命令。"
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    await submitComposerMessage("use the enabled docs skill to search local rules for shell permission guidance");

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getByText("Skill 辅助 RAG 说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/Shell 权限链路必须先走权限检查/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen2.5-coder:7b",
      message: expect.stringContaining("docs-helper")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("04-permission-safety-shell.md")
    }));
  });

  it("shows the final readonly local RAG result for an explicit local knowledge request", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "search local knowledge for shell permission rules",
      summary: "Local knowledge search found 2 matching passages across 7 indexed documents.",
      match_count: 2,
      indexed_document_count: 7,
      items: [
        {
          path: "docs/v1.0/04-permission-safety-shell.md",
          title: "04-permission-safety-shell.md",
          snippet: "Shell execution must include permission checks, confirmation, audit logs, timeout, and working-directory limits.",
          score: 42
        },
        {
          path: "OPENCOW_CORE_RULES.md",
          title: "OPENCOW_CORE_RULES.md",
          snippet: "Permissions, shell, safety, logs, and rollback are core safety paths.",
          score: 27
        }
      ]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message: "本地 RAG 命中的规则说明 Shell 执行必须带权限检查、确认、审计日志、超时和工作目录限制。"
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    await submitComposerMessage("search local knowledge for shell permission rules");

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getByText("本地 RAG 说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/权限检查、确认、审计日志、超时和工作目录限制/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen2.5-coder:7b",
      message: expect.stringContaining("本地 RAG 命中文档")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("OPENCOW_CORE_RULES.md")
    }));
  });

  it("continues from skill disable permission approval into the final disabled result", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    disableLocalSkillMock.mockResolvedValueOnce({
      query: "disable the coding-agent skill for this workspace",
      disabled_skill_name: "coding-agent",
      registry_path: ".opencow/skills/enabled-skills.json",
      status: "disabled",
      summary: "Local skill disablement removed coding-agent from the workspace skill registry."
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message:
        "coding-agent 已在批准工作区读写后从 enabled skills 注册表停用。Skill 文件没有被删除，之后可以重新启用或选择其他 Skill。"
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "disable the coding-agent skill for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    const permissionReasonMatches = await screen.findAllByText(/需要先授予工作区读写权限/i);
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    expect(permissionSection).not.toBeNull();

    fireEvent.click(within(permissionSection as HTMLElement).getAllByRole("button")[0]);

    await waitFor(() => {
      expect(within(getConversationRegion()).getByText("Skill 停用结果说明")).toBeInTheDocument();
      expect(within(getConversationRegion()).getByText(/coding-agent 已在批准工作区读写后从 enabled skills 注册表停用/)).toBeInTheDocument();
    });
    expect(disableLocalSkillMock).toHaveBeenCalledTimes(1);
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen2.5-coder:7b",
      message: expect.stringContaining("用户批准 workspace-write")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("目标 Skill：coding-agent")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("状态：disabled")
    }));
  });

  it("continues from a skill-assisted workspace-write request into the final temp-output creation result", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use the enabled shell automation skill to create a temp-output folder for this workspace",
      summary: "Enabled local skill matching found 1 recommended skill across 2 enabled entries.",
      registry_path: ".opencow/skills/enabled-skills.json",
      enabled_skill_count: 2,
      match_count: 1,
      items: [
        {
          name: "shell-automation",
          path: "skills/shell-automation/SKILL.md",
          source: "workspace-skill",
          description: "Run safe local shell automation tasks.",
          content_preview: "Use this skill when the task needs shell automation with local safety rails."
        }
      ]
    });
    runWorkspaceWriteShellCommandMock.mockResolvedValueOnce({
      command_id: "create-temp-output-dir",
      command_label: "New-Item -ItemType Directory -Force temp-output",
      stdout_preview: "temp-output",
      line_count: 1,
      summary: "Workspace write shell command completed successfully."
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message:
        "shell-automation 只是用于匹配已启用的本地能力；temp-output 已在你批准工作区读写后通过受控 shell runner 创建，命令只作用于工作区内这个目录。"
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "use the enabled shell automation skill to create a temp-output folder for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    const permissionReasonMatches = await screen.findAllByText(/需要先授予工作区读写权限/i);
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    expect(permissionSection).not.toBeNull();

    fireEvent.click(within(permissionSection as HTMLElement).getAllByRole("button")[0]);

    await waitFor(() => {
      expect(screen.getAllByText("Skill 辅助创建结果说明").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/shell-automation 只是用于匹配已启用的本地能力/).length).toBeGreaterThan(0);
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      requestId: expect.stringMatching(/^skills-local-enabled-shell-create-temp-output-explanation-/),
      message: expect.stringContaining("已启用 Skill 只是用于匹配合适的本地能力")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("New-Item -ItemType Directory -Force temp-output")
    }));
    expect(screen.queryByText(/Workspace write shell command completed successfully/)).not.toBeInTheDocument();
  });

  it("continues from a skill-assisted destructive request through permission and dangerous confirmation into the final removal result", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use the enabled shell automation skill to delete temp-output and clean temporary files",
      summary: "Enabled local skill matching found 1 recommended skill across 2 enabled entries.",
      registry_path: ".opencow/skills/enabled-skills.json",
      enabled_skill_count: 2,
      match_count: 1,
      items: [
        {
          name: "shell-automation",
          path: "skills/shell-automation/SKILL.md",
          source: "workspace-skill",
          description: "Run safe local shell automation tasks.",
          content_preview: "Use this skill when the task needs shell automation with local safety rails."
        }
      ]
    });
    runControlledFullShellCommandMock.mockResolvedValueOnce({
      command_id: "remove-temp-output-dir",
      command_label: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      stdout_preview: "temp-output removed",
      line_count: 1,
      summary: "Controlled full shell command completed successfully."
    });
    chatWithOllamaModelMock.mockReturnValueOnce(new Promise(() => undefined));

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "use the enabled shell automation skill to delete temp-output and clean temporary files" }
    });
    fireEvent.click(getComposerSendButton());

    const permissionReasonMatches = await screen.findAllByText(/需要先授予受控完全访问权限/i);
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    expect(permissionSection).not.toBeNull();

    await approvePermissionRequest(permissionSection as HTMLElement);
    await approveDangerousConfirmation(permissionSection as HTMLElement);

    await waitFor(() => {
      expect(
        within(getConversationRegion()).getByText(/执行摘要：受控高风险命令已完成/)
      ).toBeInTheDocument();
      expect(
        within(getConversationRegion()).getByText(/Assistant task result explanation skipped after local model failure/)
      ).toBeInTheDocument();
    }, { timeout: 12_000 });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      requestId: expect.stringMatching(/^skills-local-enabled-shell-remove-temp-output-explanation-/),
      message: expect.stringContaining("授予 controlled-full 并确认高风险操作")
    }));
    expect(screen.queryByText(/本地任务执行失败|Local task execution timed out/i)).not.toBeInTheDocument();
    expect(runControlledFullShellCommandMock).toHaveBeenCalledTimes(1);
  }, 20_000);

  it("explains NPC-assisted shell creation through the local model after workspace-write approval", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use npc collaboration to create a temp-output folder with shell automation",
      summary: "Enabled local skill matching found 1 recommended skill across 2 enabled entries.",
      registry_path: ".opencow/skills/enabled-skills.json",
      enabled_skill_count: 2,
      match_count: 1,
      items: [
        {
          name: "shell-automation",
          path: "skills/shell-automation/SKILL.md",
          source: "workspace-skill",
          description: "Run safe local shell automation tasks.",
          content_preview: "Use this skill when the task needs shell automation with local safety rails."
        }
      ]
    });
    runWorkspaceWriteShellCommandMock.mockResolvedValueOnce({
      command_id: "create-temp-output-dir",
      command_label: "New-Item -ItemType Directory -Force temp-output",
      stdout_preview: "temp-output",
      line_count: 1,
      summary: "Workspace write shell command completed successfully."
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message:
        "NPC 协作只是帮你组织本地能力并匹配 shell-automation；temp-output 已在批准工作区读写后通过受控 shell runner 创建，不是 NPC 或模型拿到了任意 shell 权限。"
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "use npc collaboration to create a temp-output folder with shell automation" }
    });
    fireEvent.click(getComposerSendButton());

    const permissionReasonMatches = await screen.findAllByText(/需要先授予工作区读写权限/i);
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    expect(permissionSection).not.toBeNull();

    await approvePermissionRequest(permissionSection as HTMLElement);

    await waitFor(() => {
      expect(screen.getAllByText("NPC 辅助创建结果说明").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/NPC 协作只是帮你组织本地能力/).length).toBeGreaterThan(0);
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      requestId: expect.stringMatching(/^npc-local-enabled-shell-create-temp-output-explanation-/),
      message: expect.stringContaining("NPC 协作只是用于组织本地能力")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("New-Item -ItemType Directory -Force temp-output")
    }));
    expect(screen.queryByText(/Workspace write shell command completed successfully/)).not.toBeInTheDocument();
  });

  it("falls back to verified NPC-assisted shell removal facts when post-confirmation explanation stalls", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    matchEnabledLocalSkillsMock.mockResolvedValueOnce({
      query: "use npc collaboration to delete temp-output with shell automation",
      summary: "Enabled local skill matching found 1 recommended skill across 2 enabled entries.",
      registry_path: ".opencow/skills/enabled-skills.json",
      enabled_skill_count: 2,
      match_count: 1,
      items: [
        {
          name: "shell-automation",
          path: "skills/shell-automation/SKILL.md",
          source: "workspace-skill",
          description: "Run safe local shell automation tasks.",
          content_preview: "Use this skill when the task needs shell automation with local safety rails."
        }
      ]
    });
    runControlledFullShellCommandMock.mockResolvedValueOnce({
      command_id: "remove-temp-output-dir",
      command_label: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      stdout_preview: "temp-output removed",
      line_count: 1,
      summary: "Controlled full shell command completed successfully."
    });
    chatWithOllamaModelMock.mockReturnValueOnce(new Promise(() => undefined));

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "use npc collaboration to delete temp-output with shell automation" }
    });
    fireEvent.click(getComposerSendButton());

    const permissionReasonMatches = await screen.findAllByText(/需要先授予受控完全访问权限/i);
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    expect(permissionSection).not.toBeNull();

    await approvePermissionRequest(permissionSection as HTMLElement);
    await approveDangerousConfirmation(permissionSection as HTMLElement);

    await waitFor(() => {
      expect(
        within(getConversationRegion()).getByText(/执行摘要：受控高风险命令已完成/)
      ).toBeInTheDocument();
      expect(
        within(getConversationRegion()).getByText(/Assistant task result explanation skipped after local model failure/)
      ).toBeInTheDocument();
    }, { timeout: 12_000 });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      requestId: expect.stringMatching(/^npc-local-enabled-shell-remove-temp-output-explanation-/),
      message: expect.stringContaining("授予 controlled-full 并确认高风险操作")
    }));
    expect(cancelOllamaChatMock).toHaveBeenCalledWith(
      expect.stringMatching(/^npc-local-enabled-shell-remove-temp-output-explanation-/)
    );
    expect(runControlledFullShellCommandMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/本地任务执行失败|Local task execution timed out/i)).not.toBeInTheDocument();
  }, 20_000);
});
