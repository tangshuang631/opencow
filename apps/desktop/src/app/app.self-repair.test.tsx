import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const {
  chatWithOllamaModelMock,
  cancelOllamaChatMock,
  loadOllamaOverviewMock,
  loadWorkspaceOverviewMock,
  loadWorkspaceConfigOverviewMock,
  searchLocalKnowledgeMock,
  repairOpencowEnabledSkillsRegistryMock,
  repairOpencowWorkspaceProjectRuntimeRegistryMock
} = vi.hoisted(() => ({
  chatWithOllamaModelMock: vi.fn(),
  cancelOllamaChatMock: vi.fn(),
  loadOllamaOverviewMock: vi.fn(),
  loadWorkspaceOverviewMock: vi.fn(),
  loadWorkspaceConfigOverviewMock: vi.fn(),
  searchLocalKnowledgeMock: vi.fn(),
  repairOpencowEnabledSkillsRegistryMock: vi.fn(),
  repairOpencowWorkspaceProjectRuntimeRegistryMock: vi.fn()
}));

vi.mock("../features/ollama/ollamaService", () => ({
  chatWithOllamaModel: chatWithOllamaModelMock,
  cancelOllamaChat: cancelOllamaChatMock,
  loadOllamaOverview: loadOllamaOverviewMock
}));

vi.mock("../features/assistant/localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("../features/assistant/localAssistantService")>(
    "../features/assistant/localAssistantService"
  );

  return {
    ...actual,
    loadWorkspaceOverview: loadWorkspaceOverviewMock,
    loadWorkspaceConfigOverview: loadWorkspaceConfigOverviewMock,
    searchLocalKnowledge: searchLocalKnowledgeMock,
    repairOpencowEnabledSkillsRegistry: repairOpencowEnabledSkillsRegistryMock,
    repairOpencowWorkspaceProjectRuntimeRegistry: repairOpencowWorkspaceProjectRuntimeRegistryMock
  };
});

beforeEach(() => {
  chatWithOllamaModelMock.mockReset();
  cancelOllamaChatMock.mockReset();
  loadOllamaOverviewMock.mockReset();
  loadWorkspaceOverviewMock.mockReset();
  loadWorkspaceConfigOverviewMock.mockReset();
  searchLocalKnowledgeMock.mockReset();
  repairOpencowEnabledSkillsRegistryMock.mockReset();
  repairOpencowWorkspaceProjectRuntimeRegistryMock.mockReset();
  chatWithOllamaModelMock.mockResolvedValue({
    model: "qwen2.5-coder:7b",
    message: "这是本地模型解释的 OpenCow 自修复预览：当前只读取配置、脚本和本地文档，没有写文件；如果继续，需要先经过 workspace-write 提权、审计和回退保护。"
  });
});

function findModelPicker(modelName = "qwen2.5-coder:7b") {
  return screen.findByRole("button", { name: `选择模型：${modelName}` });
}

describe("App self-repair mutation continuation", () => {
  it("continues from self-repair preview into permission approval and final registry repair output", async () => {
    chatWithOllamaModelMock
      .mockResolvedValueOnce({
        model: "qwen2.5-coder:7b",
        message: "这是本地模型解释的 OpenCow 自修复预览：当前只读取配置、脚本和本地文档，没有写文件；如果继续，需要先经过 workspace-write 提权、审计和回退保护。"
      })
      .mockResolvedValueOnce({
        model: "qwen2.5-coder:7b",
        message: "Skills 注册表已在你批准工作区读写后完成受控修复：enabled-skills.json 恢复为可验证 schema，保留条目为 0，后续可以继续启用需要的 Skill。"
      });
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadWorkspaceOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      entry_count: 7,
      package_count: 3,
      package_names: ["openclaw-adapter", "permission-engine", "shell-runtime"],
      summary: "Workspace opencow currently contains 7 root entries and 3 local packages."
    });
    loadWorkspaceConfigOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      config_files: ["package.json", "apps/desktop/package.json", "apps/desktop/src-tauri/Cargo.toml"],
      root_script_names: ["dev", "desktop:dev", "verify:all"],
      root_script_count: 3,
      package_manager_files: ["package-lock.json"],
      summary: "Workspace config inspection found 3 key config files and 3 root scripts."
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "diagnose opencow and preview repairing its enabled skills registry",
      summary: "Local knowledge search found 2 matching passages across 7 indexed documents.",
      match_count: 2,
      indexed_document_count: 7,
      items: [
        {
          path: "OPENCOW_CORE_RULES.md",
          title: "OPENCOW_CORE_RULES.md",
          snippet: "When opencow itself fails, the assistant should prefer a staged self-repair flow.",
          score: 42
        },
        {
          path: "docs/v1.0/06-rag-skills-npc-mcp.md",
          title: "06-rag-skills-npc-mcp.md",
          snippet: "Every self-repair mutation must remain audit-visible and rollback-visible.",
          score: 38
        }
      ]
    });
    repairOpencowEnabledSkillsRegistryMock.mockResolvedValueOnce({
      query: "diagnose opencow and continue repairing its enabled skills registry",
      repair_target: "enabled-skills-registry",
      repaired_path: ".opencow/skills/enabled-skills.json",
      status: "repaired",
      preserved_entry_count: 0,
      verified_version: 1,
      verified_entry_count: 0,
      summary: "Opencow self-repair restored the enabled skills registry to a verified default schema."
    });

    const { container } = render(<App />);

    await findModelPicker();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "diagnose opencow and preview repairing its enabled skills registry" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getAllByText(/OpenCow 自修复预览说明/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/这是本地模型解释的 OpenCow 自修复预览/).length).toBeGreaterThan(0);
    });

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "继续" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(screen.getAllByText(/需要先授予工作区读写权限/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /\.opencow\/skills\/enabled-skills\.json|approve this only if you want opencow to rewrite that file and then verify the schema version and enabled entry count/i
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /This repair rewrites only \.opencow\/skills\/enabled-skills\.json through a narrow self-repair path and must remain audit-visible and rollback-visible\./i
      ).length
    ).toBeGreaterThan(0);

    const approvePermissionButton = await screen.findByRole("button", { name: /^批准提权$/i });
    fireEvent.click(approvePermissionButton as HTMLButtonElement);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          /OpenCow Skills 注册表修复说明|Skills 注册表已在你批准工作区读写后完成受控修复|enabled-skills\.json|保留条目为 0/i
        ).length
      ).toBeGreaterThan(0);
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("不要说这是只读预览")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("Verified enabled entries: 0")
    }));

  });

  it("falls back to verified self-repair facts when final local-model explanation stalls", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    repairOpencowEnabledSkillsRegistryMock.mockResolvedValueOnce({
      query: "diagnose opencow and continue repairing its enabled skills registry",
      repair_target: "enabled-skills-registry",
      repaired_path: ".opencow/skills/enabled-skills.json",
      status: "repaired",
      preserved_entry_count: 0,
      verified_version: 1,
      verified_entry_count: 0,
      summary: "Opencow self-repair restored the enabled skills registry to a verified default schema."
    });
    chatWithOllamaModelMock.mockReturnValueOnce(new Promise(() => undefined));

    const { container } = render(<App />);

    await findModelPicker();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "diagnose opencow and continue repairing its enabled skills registry" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const approvePermissionButton = await screen.findByRole("button", { name: /^批准提权$/i });

    vi.useFakeTimers();
    try {
      fireEvent.click(approvePermissionButton as HTMLButtonElement);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_500);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(repairOpencowEnabledSkillsRegistryMock).toHaveBeenCalled();
      expect(cancelOllamaChatMock).toHaveBeenCalledWith(
        expect.stringMatching(/^opencow-self-repair-enabled-skills-registry-explanation-/)
      );
      expect(
        screen.getAllByText(
          /Repair opencow enabled skills registry|enabled-skills\.json|verified default schema|Verified schema version: 1|Verified enabled entries: 0/i
        ).length
      ).toBeGreaterThan(0);
      expect(screen.queryByText(/OpenCow Skills 注册表修复说明/)).not.toBeInTheDocument();
      expect(screen.queryByText(/本地任务执行失败|Local task execution failed/i)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("App self-repair preview flow", () => {
  it("shows a readonly opencow self-repair preview through the conversation flow", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadWorkspaceOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      entry_count: 7,
      package_count: 3,
      package_names: ["openclaw-adapter", "permission-engine", "shell-runtime"],
      summary: "Workspace opencow currently contains 7 root entries and 3 local packages."
    });
    loadWorkspaceConfigOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      config_files: ["package.json", "apps/desktop/package.json", "apps/desktop/src-tauri/Cargo.toml"],
      root_script_names: ["dev", "desktop:dev", "verify:all"],
      root_script_count: 3,
      package_manager_files: ["package-lock.json"],
      summary: "Workspace config inspection found 3 key config files and 3 root scripts."
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "diagnose opencow and preview how to fix its current local error",
      summary: "Local knowledge search found 2 matching passages across 7 indexed documents.",
      match_count: 2,
      indexed_document_count: 7,
      items: [
        {
          path: "OPENCOW_CORE_RULES.md",
          title: "OPENCOW_CORE_RULES.md",
          snippet: "When opencow itself fails, the assistant should prefer a staged self-repair flow.",
          score: 42
        },
        {
          path: "docs/v1.0/04-permission-safety-shell.md",
          title: "04-permission-safety-shell.md",
          snippet: "Writable shell actions must continue to flow through the permission and audit chain.",
          score: 28
        }
      ]
    });

    const { container } = render(<App />);

    await findModelPicker();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "diagnose opencow and preview how to fix its current local error" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getAllByText(/OpenCow 自修复预览说明/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/这是本地模型解释的 OpenCow 自修复预览/).length).toBeGreaterThan(0);
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("重点解释当前只是 OpenCow 自修复只读预览")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("package.json")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("desktop:dev")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("OPENCOW_CORE_RULES.md")
    }));
    expect(screen.queryByText(/鏈湴浠诲姟鎵ц澶辫触/i)).not.toBeInTheDocument();
  });
});

describe("App self-repair generic target guidance", () => {
  it("stops a generic self-repair continue request with narrow target guidance instead of looping back into preview", async () => {
    chatWithOllamaModelMock
      .mockResolvedValueOnce({
        model: "qwen2.5-coder:7b",
        message: "这是本地模型解释的 OpenCow 自修复预览：当前只是读取配置和本地文档，没有写文件。"
      })
      .mockResolvedValueOnce({
        model: "qwen2.5-coder:7b",
        message:
          "这次不能泛化继续自修复：请先选择 enabled skills registry 或 workspace project runtime registry；本轮没有提权，也没有写入任何文件。"
      });
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadWorkspaceOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      entry_count: 7,
      package_count: 3,
      package_names: ["openclaw-adapter", "permission-engine", "shell-runtime"],
      summary: "Workspace opencow currently contains 7 root entries and 3 local packages."
    });
    loadWorkspaceConfigOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      config_files: ["package.json", "apps/desktop/package.json", "apps/desktop/src-tauri/Cargo.toml"],
      root_script_names: ["dev", "desktop:dev", "verify:all"],
      root_script_count: 3,
      package_manager_files: ["package-lock.json"],
      summary: "Workspace config inspection found 3 key config files and 3 root scripts."
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "diagnose opencow and preview how to fix its current local error",
      summary: "Local knowledge search found 2 matching passages across 7 indexed documents.",
      match_count: 2,
      indexed_document_count: 7,
      items: [
        {
          path: "OPENCOW_CORE_RULES.md",
          title: "OPENCOW_CORE_RULES.md",
          snippet: "When opencow itself fails, the assistant should prefer a staged self-repair flow.",
          score: 42
        },
        {
          path: "docs/v1.0/04-permission-safety-shell.md",
          title: "04-permission-safety-shell.md",
          snippet: "Writable shell actions must continue to flow through the permission and audit chain.",
          score: 28
        }
      ]
    });

    const { container } = render(<App />);

    await findModelPicker();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "diagnose opencow and preview how to fix its current local error" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getAllByText(/OpenCow 自修复预览说明/).length).toBeGreaterThan(0);
    });

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "continue" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getAllByText(/OpenCow 自修复目标说明/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/这次不能泛化继续自修复/).length).toBeGreaterThan(0);
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      requestId: expect.stringMatching(/^opencow-self-repair-target-guidance-explanation-/),
      message: expect.stringContaining("必须先选择 enabled skills registry 或 workspace project runtime registry")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("diagnose opencow and continue repairing its enabled skills registry")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("本轮没有提权、没有写文件")
    }));
    expect(screen.queryByText(/Workspace write permission is required before opencow can repair/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^批准提权$/i })).not.toBeInTheDocument();
  });
});

describe("App self-repair permission cancellation", () => {
  it("does not continue the self-repair mutation after permission is cancelled, but allows a later explicit retry", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadWorkspaceOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      entry_count: 7,
      package_count: 3,
      package_names: ["openclaw-adapter", "permission-engine", "shell-runtime"],
      summary: "Workspace opencow currently contains 7 root entries and 3 local packages."
    });
    loadWorkspaceConfigOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      config_files: ["package.json", "apps/desktop/package.json", "apps/desktop/src-tauri/Cargo.toml"],
      root_script_names: ["dev", "desktop:dev", "verify:all"],
      root_script_count: 3,
      package_manager_files: ["package-lock.json"],
      summary: "Workspace config inspection found 3 key config files and 3 root scripts."
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "diagnose opencow and preview repairing its enabled skills registry",
      summary: "Local knowledge search found 2 matching passages across 7 indexed documents.",
      match_count: 2,
      indexed_document_count: 7,
      items: [
        {
          path: "OPENCOW_CORE_RULES.md",
          title: "OPENCOW_CORE_RULES.md",
          snippet: "When opencow itself fails, the assistant should prefer a staged self-repair flow.",
          score: 42
        },
        {
          path: "docs/v1.0/06-rag-skills-npc-mcp.md",
          title: "06-rag-skills-npc-mcp.md",
          snippet: "Every self-repair mutation must remain audit-visible and rollback-visible.",
          score: 38
        }
      ]
    });
    repairOpencowEnabledSkillsRegistryMock.mockResolvedValueOnce({
      query: "diagnose opencow and continue repairing its enabled skills registry",
      repair_target: "enabled-skills-registry",
      repaired_path: ".opencow/skills/enabled-skills.json",
      status: "repaired",
      preserved_entry_count: 0,
      verified_version: 1,
      verified_entry_count: 0,
      summary: "Opencow self-repair restored the enabled skills registry to a verified default schema."
    });
    chatWithOllamaModelMock
      .mockResolvedValueOnce({
        model: "qwen2.5-coder:7b",
        message: "这是本地模型解释的 OpenCow 自修复预览：当前只读取配置、脚本和本地文档，没有写文件；如果继续，需要先经过 workspace-write 提权、审计和回退保护。"
      })
      .mockResolvedValueOnce({
        model: "qwen2.5-coder:7b",
        message: "Skills 注册表已完成受控修复：enabled-skills.json 已验证，后续可以继续启用需要的 Skill。"
      });

    const { container } = render(<App />);

    await findModelPicker();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "diagnose opencow and preview repairing its enabled skills registry" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getAllByText(/OpenCow 自修复预览说明/).length).toBeGreaterThan(0);
    });

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "continue" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(screen.getAllByText(/需要先授予工作区读写权限/i).length).toBeGreaterThan(0);

    const cancelPermissionButton = await screen.findByRole("button", { name: /^取消提权$/i });
    fireEvent.click(cancelPermissionButton as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getAllByText(/权限升级已取消/i).length).toBeGreaterThan(0);
    });

    expect(screen.queryByText(/Repair opencow enabled skills registry/i)).not.toBeInTheDocument();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "diagnose opencow and continue repairing its enabled skills registry" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const approvePermissionButton = await screen.findByRole("button", { name: /^批准提权$/i });
    fireEvent.click(approvePermissionButton as HTMLButtonElement);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          /OpenCow Skills 注册表修复说明|Skills 注册表已完成受控修复|enabled-skills\.json/i
        ).length
      ).toBeGreaterThan(0);
    });
  });
});

describe("App self-repair runtime registry continuation", () => {
  it("continues from self-repair preview into permission approval and final runtime registry repair output", async () => {
    chatWithOllamaModelMock
      .mockResolvedValueOnce({
        model: "qwen2.5-coder:7b",
        message: "这是本地模型解释的 OpenCow 自修复预览：当前只读取配置、脚本和本地文档，没有写文件；如果继续，需要先经过 workspace-write 提权、审计和回退保护。"
      })
      .mockResolvedValueOnce({
        model: "qwen2.5-coder:7b",
        message: "项目运行注册表已在你批准工作区读写后完成受控修复：workspace-project-runs.json 恢复为可验证 schema，当前运行记录为 0。"
      });
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadWorkspaceOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      entry_count: 7,
      package_count: 3,
      package_names: ["openclaw-adapter", "permission-engine", "shell-runtime"],
      summary: "Workspace opencow currently contains 7 root entries and 3 local packages."
    });
    loadWorkspaceConfigOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      config_files: ["package.json", "apps/desktop/package.json", "apps/desktop/src-tauri/Cargo.toml"],
      root_script_names: ["dev", "desktop:dev", "verify:all"],
      root_script_count: 3,
      package_manager_files: ["package-lock.json"],
      summary: "Workspace config inspection found 3 key config files and 3 root scripts."
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "diagnose opencow and preview repairing its workspace project runtime registry",
      summary: "Local knowledge search found 2 matching passages across 7 indexed documents.",
      match_count: 2,
      indexed_document_count: 7,
      items: [
        {
          path: "OPENCOW_CORE_RULES.md",
          title: "OPENCOW_CORE_RULES.md",
          snippet: "When opencow itself fails, the assistant should prefer a staged self-repair flow.",
          score: 42
        },
        {
          path: "docs/v1.0/10-openclaw-adapter.md",
          title: "10-openclaw-adapter.md",
          snippet: "The runtime registry is durable enough for the current desktop mainline.",
          score: 38
        }
      ]
    });
    repairOpencowWorkspaceProjectRuntimeRegistryMock.mockResolvedValueOnce({
      query: "diagnose opencow and continue repairing its workspace project runtime registry",
      repair_target: "workspace-project-runtime-registry",
      repaired_path: ".opencow/runtime/workspace-project-runs.json",
      status: "repaired",
      preserved_entry_count: 0,
      verified_version: 1,
      verified_run_count: 0,
      summary: "Opencow self-repair restored the workspace project runtime registry to a verified default schema."
    });

    const { container } = render(<App />);

    await findModelPicker();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "diagnose opencow and preview repairing its workspace project runtime registry" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getAllByText(/OpenCow 自修复预览说明/).length).toBeGreaterThan(0);
    });

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "continue" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(screen.getAllByText(/需要先授予工作区读写权限/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /\.opencow\/runtime\/workspace-project-runs\.json|approve this only if you want opencow to rewrite that file and then verify the schema version and runtime run count/i
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /This repair rewrites only \.opencow\/runtime\/workspace-project-runs\.json through a narrow self-repair path and must remain audit-visible and rollback-visible\./i
      ).length
    ).toBeGreaterThan(0);

    const approvePermissionButton = await screen.findByRole("button", { name: /^批准提权$/i });
    fireEvent.click(approvePermissionButton as HTMLButtonElement);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          /OpenCow 项目运行注册表修复说明|项目运行注册表已在你批准工作区读写后完成受控修复|workspace-project-runs\.json|当前运行记录为 0/i
        ).length
      ).toBeGreaterThan(0);
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("不要说这是只读预览")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("Verified runtime runs: 0")
    }));

  });
});
