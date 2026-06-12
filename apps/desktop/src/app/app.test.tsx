import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const {
  cancelOllamaChatMock,
  chatWithOllamaModelMock,
  loadOllamaOverviewMock,
  loadWorkspacePackagesOverviewMock,
  loadWorkspaceConfigOverviewMock,
  searchLocalKnowledgeMock,
  inspectLocalSkillMock,
  enableLocalSkillMock,
  installLocalSkillMock,
  listEnabledLocalSkillsMock,
  disableLocalSkillMock,
  matchEnabledLocalSkillsMock,
  runWorkspaceWriteShellCommandMock,
  runControlledFullShellCommandMock,
  writeNpcConfigMock
} = vi.hoisted(() => ({
  cancelOllamaChatMock: vi.fn(),
  chatWithOllamaModelMock: vi.fn(),
  loadOllamaOverviewMock: vi.fn(),
  loadWorkspacePackagesOverviewMock: vi.fn(),
  loadWorkspaceConfigOverviewMock: vi.fn(),
  searchLocalKnowledgeMock: vi.fn(),
  inspectLocalSkillMock: vi.fn(),
  enableLocalSkillMock: vi.fn(),
  installLocalSkillMock: vi.fn(),
  listEnabledLocalSkillsMock: vi.fn(),
  disableLocalSkillMock: vi.fn(),
  matchEnabledLocalSkillsMock: vi.fn(),
  runWorkspaceWriteShellCommandMock: vi.fn(),
  runControlledFullShellCommandMock: vi.fn(),
  writeNpcConfigMock: vi.fn()
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
    loadWorkspacePackagesOverview: loadWorkspacePackagesOverviewMock,
    loadWorkspaceConfigOverview: loadWorkspaceConfigOverviewMock,
    searchLocalKnowledge: searchLocalKnowledgeMock,
    inspectLocalSkill: inspectLocalSkillMock,
    enableLocalSkill: enableLocalSkillMock,
    installLocalSkill: installLocalSkillMock,
    listEnabledLocalSkills: listEnabledLocalSkillsMock,
    disableLocalSkill: disableLocalSkillMock,
    matchEnabledLocalSkills: matchEnabledLocalSkillsMock,
    runWorkspaceWriteShellCommand: runWorkspaceWriteShellCommandMock,
    runControlledFullShellCommand: runControlledFullShellCommandMock,
    writeNpcConfig: writeNpcConfigMock
  };
});

function getComposerInput() {
  return screen.getByLabelText("输入任务");
}

function getComposerSendButton() {
  return screen.getByRole("button", { name: "发送" });
}

function getConversationRegion() {
  return screen.getByRole("region", { name: "会话" });
}

function findModelPicker(modelName: string) {
  return screen.findByRole("button", { name: `选择模型：${modelName}` });
}

describe("App", () => {
  beforeEach(() => {
    cancelOllamaChatMock.mockReset();
    chatWithOllamaModelMock.mockReset();
    loadOllamaOverviewMock.mockReset();
    loadWorkspacePackagesOverviewMock.mockReset();
    loadWorkspaceConfigOverviewMock.mockReset();
    searchLocalKnowledgeMock.mockReset();
    inspectLocalSkillMock.mockReset();
    enableLocalSkillMock.mockReset();
    installLocalSkillMock.mockReset();
    listEnabledLocalSkillsMock.mockReset();
    disableLocalSkillMock.mockReset();
    matchEnabledLocalSkillsMock.mockReset();
    runWorkspaceWriteShellCommandMock.mockReset();
    runControlledFullShellCommandMock.mockReset();
    writeNpcConfigMock.mockReset();
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

  it("switches sidebar destinations from the app shell", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    for (const destination of ["搜索", "知识库", "Skills", "NPC", "MCP", "审计", "安全", "设置"]) {
      fireEvent.click(screen.getByRole("button", { name: destination }));

      expect(screen.getByRole("heading", { name: destination })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: destination })).toHaveAttribute("aria-pressed", "true");
    }

    fireEvent.click(screen.getByRole("button", { name: "新对话" }));

    expect(getConversationRegion()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新对话" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps Ollama load details in settings while the main conversation stays minimal", async () => {
    loadOllamaOverviewMock.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:11434"));

    render(<App />);

    expect(await screen.findByText("默认使用本地 Ollama，当前未检测到可用服务。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "配置 Ollama" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "配置大模型 API" })).toBeInTheDocument();
    expect(screen.queryByText("connect ECONNREFUSED 127.0.0.1:11434")).not.toBeInTheDocument();
    expect(screen.queryByText(/ollama_overview/)).not.toBeInTheDocument();
    expect(within(getConversationRegion()).queryByText("需要配置模型")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "配置 Ollama" }));

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

    const input = getComposerInput();
    fireEvent.change(input, {
      target: { value: "你能干什么" }
    });
    fireEvent.click(getComposerSendButton());

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

    fireEvent.change(getComposerInput(), {
      target: { value: "你能帮我配置一个文档处理npc吗" }
    });
    fireEvent.click(getComposerSendButton());

    fireEvent.click(await screen.findByRole("button", { name: "批准提权" }));

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

    fireEvent.change(getComposerInput(), {
      target: { value: "你能帮我配置一个文档处理npc吗" }
    });
    fireEvent.click(getComposerSendButton());

    fireEvent.click(await screen.findByRole("button", { name: "批准提权" }));

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

    fireEvent.change(getComposerInput(), {
      target: { value: "你能帮我配置一个文档处理npc吗" }
    });
    fireEvent.click(getComposerSendButton());
    const approveButton = await screen.findByRole("button", { name: "批准提权" });
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

    fireEvent.change(getComposerInput(), {
      target: { value: "你能帮我配置一个文档处理npc吗" }
    });
    fireEvent.click(getComposerSendButton());
    fireEvent.click(await screen.findByRole("button", { name: "批准提权" }));

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
    });

    const request = chatWithOllamaModelMock.mock.calls.at(-1)?.[0] as { requestId?: string; signal?: AbortSignal };

    fireEvent.click(screen.getByRole("button", { name: "新对话" }));

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

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    fireEvent.change(getComposerInput(), {
      target: { value: "inspect the current workspace and summarize it" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getAllByText("inspect the current workspace and summarize it").length).toBeGreaterThan(0);
      expect(within(conversation).getByText("Workspace overview")).toBeInTheDocument();
    });
  });

  it("routes a generic project summary request into the workspace overview result instead of generic help copy", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    fireEvent.change(getComposerInput(), {
      target: { value: "summarize this project" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getAllByText("summarize this project").length).toBeGreaterThan(0);
      expect(within(conversation).getByText("Workspace overview")).toBeInTheDocument();
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

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    fireEvent.change(getComposerInput(), {
      target: { value: "inspect workspace packages and scripts" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getAllByText("inspect workspace packages and scripts").length).toBeGreaterThan(0);
      expect(within(conversation).getByText("Workspace packages overview")).toBeInTheDocument();
    });
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

    render(<App />);

    await findModelPicker("qwen3.6:35b");

    fireEvent.change(getComposerInput(), {
      target: { value: "inspect workspace config and root scripts" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getAllByText("inspect workspace config and root scripts").length).toBeGreaterThan(0);
      expect(within(conversation).getByText("Workspace config overview")).toBeInTheDocument();
    });
  });

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

    fireEvent.change(getComposerInput(), {
      target: { value: "你能干什么" }
    });
    fireEvent.click(getComposerSendButton());

    const pending = await screen.findByLabelText("assistant-pending");
    expect(within(pending).getByText("Ollama 正在生成")).toBeInTheDocument();
    expect(within(pending).getByText(/本地模型首轮响应可能较慢/)).toBeInTheDocument();
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

    fireEvent.change(getComposerInput(), {
      target: { value: "你能干什么" }
    });
    fireEvent.click(getComposerSendButton());

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

    fireEvent.change(getComposerInput(), {
      target: { value: "你能干什么" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    });

    expect(within(getConversationRegion()).getAllByText("你能干什么").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "新对话" }));

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

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "enable the coding-agent skill for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    const approvePermissionButton = await screen.findByRole("button", { name: /批准提权/i });
    fireEvent.click(approvePermissionButton);

    await waitFor(() => {
      expect(screen.getAllByText(/Enable local skill|coding-agent|enabled-skills\.json/i).length).toBeGreaterThan(0);
    });
  });

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

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "install the gpt-taste skill into this workspace skills folder" }
    });
    fireEvent.click(getComposerSendButton());

    const permissionReasonMatches = await screen.findAllByText(
      /Workspace write permission is required before installing a local skill/i
    );
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    expect(permissionSection).not.toBeNull();

    fireEvent.click(within(permissionSection as HTMLElement).getAllByRole("button")[0]);

    await waitFor(() => {
      expect(screen.getAllByText(/Install local skill|gpt-taste|skills\/gpt-taste\/SKILL\.md/i).length).toBeGreaterThan(0);
    });
  });

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

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "show enabled skills for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(screen.getAllByText(/Enabled local skills|coding-agent|enabled-skills\.json/i).length).toBeGreaterThan(0);
    });
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

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "which enabled skill should handle shell automation in this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(
        screen.getAllByText(/Match enabled local skills|shell-automation|enabled-skills\.json/i).length
      ).toBeGreaterThan(0);
    });
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

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "show details for the coding-agent skill" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(
        screen.getAllByText(/Local Skill detail|coding-agent|OpenClaw coding agent workflow|Enabled: yes/i).length
      ).toBeGreaterThan(0);
    });
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

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "use the enabled docs skill to search local rules for shell permission guidance" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(
        screen.getAllByText(/Skill-assisted local RAG document search|docs-helper|enabled-skills\.json|04-permission-safety-shell\.md/i)
          .length
      ).toBeGreaterThan(0);
    });
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

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "search local knowledge for shell permission rules" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(
        screen.getAllByText(/Local RAG document search|04-permission-safety-shell\.md|OPENCOW_CORE_RULES\.md/i).length
      ).toBeGreaterThan(0);
    });
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

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "disable the coding-agent skill for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    const permissionReasonMatches = await screen.findAllByText(
      /Workspace write permission is required before disabling a local skill/i
    );
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    expect(permissionSection).not.toBeNull();

    fireEvent.click(within(permissionSection as HTMLElement).getAllByRole("button")[0]);

    await waitFor(() => {
      expect(screen.getAllByText(/Disable local skill|coding-agent|enabled-skills\.json/i).length).toBeGreaterThan(0);
    });
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

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "use the enabled shell automation skill to create a temp-output folder for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    const permissionReasonMatches = await screen.findAllByText(
      /Workspace write permission is required before a skill-assisted temp-output creation task can modify the workspace/i
    );
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    expect(permissionSection).not.toBeNull();

    fireEvent.click(within(permissionSection as HTMLElement).getAllByRole("button")[0]);

    await waitFor(() => {
      expect(
        screen.getAllByText(/Skill-assisted temp-output creation|shell-automation|temp-output|enabled-skills\.json/i)
          .length
      ).toBeGreaterThan(0);
    });
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

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "use the enabled shell automation skill to delete temp-output and clean temporary files" }
    });
    fireEvent.click(getComposerSendButton());

    const permissionReasonMatches = await screen.findAllByText(
      /Controlled full permission is required before a skill-assisted destructive shell cleanup task can continue/i
    );
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    expect(permissionSection).not.toBeNull();

    fireEvent.click(within(permissionSection as HTMLElement).getAllByRole("button")[0]);

    const approveDangerButton = await within(permissionSection as HTMLElement).findByRole("button", {
      name: "批准高风险操作"
    });
    fireEvent.click(approveDangerButton);

    await waitFor(() => {
      expect(
        screen.getAllByText(/Skill-assisted temp-output removal|shell-automation|temp-output removed|enabled-skills\.json/i)
          .length
      ).toBeGreaterThan(0);
    });
  });
});
