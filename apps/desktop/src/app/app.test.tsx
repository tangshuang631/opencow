import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const {
  cancelOllamaChatMock,
  chatWithOllamaModelMock,
  loadOllamaOverviewMock,
  loadOpenClawCapabilityOverviewMock,
  loadWorkspacePackagesOverviewMock,
  loadWorkspaceConfigOverviewMock,
  searchLocalKnowledgeMock,
  scanLocalSkillsMock,
  inspectLocalSkillMock,
  scanLocalMcpPluginsMock,
  inspectLocalMcpPluginMock,
  previewLocalMcpPluginStartMock,
  enableLocalSkillMock,
  installLocalSkillMock,
  listEnabledLocalSkillsMock,
  disableLocalSkillMock,
  matchEnabledLocalSkillsMock,
  runReadonlyShellCommandMock,
  runWorkspaceWriteShellCommandMock,
  runControlledFullShellCommandMock,
  writeNpcConfigMock
} = vi.hoisted(() => ({
  cancelOllamaChatMock: vi.fn(),
  chatWithOllamaModelMock: vi.fn(),
  loadOllamaOverviewMock: vi.fn(),
  loadOpenClawCapabilityOverviewMock: vi.fn(),
  loadWorkspacePackagesOverviewMock: vi.fn(),
  loadWorkspaceConfigOverviewMock: vi.fn(),
  searchLocalKnowledgeMock: vi.fn(),
  scanLocalSkillsMock: vi.fn(),
  inspectLocalSkillMock: vi.fn(),
  scanLocalMcpPluginsMock: vi.fn(),
  inspectLocalMcpPluginMock: vi.fn(),
  previewLocalMcpPluginStartMock: vi.fn(),
  enableLocalSkillMock: vi.fn(),
  installLocalSkillMock: vi.fn(),
  listEnabledLocalSkillsMock: vi.fn(),
  disableLocalSkillMock: vi.fn(),
  matchEnabledLocalSkillsMock: vi.fn(),
  runReadonlyShellCommandMock: vi.fn(),
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
    loadOpenClawCapabilityOverview: loadOpenClawCapabilityOverviewMock,
    loadWorkspacePackagesOverview: loadWorkspacePackagesOverviewMock,
    loadWorkspaceConfigOverview: loadWorkspaceConfigOverviewMock,
    searchLocalKnowledge: searchLocalKnowledgeMock,
    scanLocalSkills: scanLocalSkillsMock,
    inspectLocalSkill: inspectLocalSkillMock,
    scanLocalMcpPlugins: scanLocalMcpPluginsMock,
    inspectLocalMcpPlugin: inspectLocalMcpPluginMock,
    previewLocalMcpPluginStart: previewLocalMcpPluginStartMock,
    enableLocalSkill: enableLocalSkillMock,
    installLocalSkill: installLocalSkillMock,
    listEnabledLocalSkills: listEnabledLocalSkillsMock,
    disableLocalSkill: disableLocalSkillMock,
    matchEnabledLocalSkills: matchEnabledLocalSkillsMock,
    runReadonlyShellCommand: runReadonlyShellCommandMock,
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
    loadOpenClawCapabilityOverviewMock.mockReset();
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
    listEnabledLocalSkillsMock.mockReset();
    disableLocalSkillMock.mockReset();
    matchEnabledLocalSkillsMock.mockReset();
    runReadonlyShellCommandMock.mockReset();
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

    fireEvent.change(getComposerInput(), {
      target: { value: "你能帮我创建一个课程助手npc吗" }
    });
    fireEvent.click(getComposerSendButton());

    const approveButton = await screen.findByRole("button", { name: "批准提权" });

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
      fireEvent.click(screen.getByRole("button", { name: "展开失败细节" }));
      expect(screen.getAllByText(/executionKind=npc-config-write/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/streamPhase=waiting-first-chunk/).length).toBeGreaterThan(0);
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
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "这个项目是一个桌面优先的本地助手工作区，当前重点在对话主链、受控执行和恢复能力。"
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

    fireEvent.change(getComposerInput(), {
      target: { value: "summarize this project" }
    });
    fireEvent.click(getComposerSendButton());

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

    fireEvent.change(getComposerInput(), {
      target: { value: "inspect workspace packages and scripts" }
    });
    fireEvent.click(getComposerSendButton());

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

    fireEvent.change(getComposerInput(), {
      target: { value: "inspect workspace config and root scripts" }
    });
    fireEvent.click(getComposerSendButton());

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

    fireEvent.change(getComposerInput(), {
      target: { value: "check git status for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getAllByText("check git status for this workspace").length).toBeGreaterThan(0);
      expect(within(conversation).getByText("Git 状态诊断说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/当前只是只读查看 git 状态/)).toBeInTheDocument();
    });
    expect(within(conversation).queryByText(/Command: git status --short/)).not.toBeInTheDocument();
    expect(within(conversation).queryByText(/Preview:  M apps\/desktop\/src\/app\/App\.tsx/)).not.toBeInTheDocument();
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen3.6:35b",
      message: expect.stringContaining("重点解释 git 状态只读诊断结果")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("Command: git status --short")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("为什么本轮没有执行写入")
    }));
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

    fireEvent.change(getComposerInput(), {
      target: { value: "inspect the local rag capability wiring" }
    });
    fireEvent.click(getComposerSendButton());

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

    fireEvent.change(getComposerInput(), {
      target: { value: "preview an npc collaboration plan for local shell permission rules" }
    });
    fireEvent.click(getComposerSendButton());

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

  it("explains disabled network search guidance through the local model without claiming a web search ran", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "本轮没有执行外部联网搜索，因为搜索 provider 还未配置；如果你需要最新资料，需要先在高级设置里配置并批准联网搜索，也可以先用本地 RAG 查工作区资料。"
    });

    render(<App />);

    await findModelPicker("qwen3.6:35b");
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.change(screen.getByRole("textbox", { name: "联网搜索 Provider" }), {
      target: { value: "Tavily" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存联网搜索配置" }));
    fireEvent.click(screen.getByRole("button", { name: "新对话" }));

    fireEvent.change(getComposerInput(), {
      target: { value: "search the web for latest local RAG indexing approaches" }
    });
    fireEvent.click(getComposerSendButton());

    fireEvent.click(await screen.findByRole("button", { name: "批准能力变更" }));

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getAllByText("search the web for latest local RAG indexing approaches").length).toBeGreaterThan(0);
      expect(within(conversation).getByText("联网搜索说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/本轮没有执行外部联网搜索/)).toBeInTheDocument();
    });
    expect(within(conversation).queryByText(/No external network search was run/)).not.toBeInTheDocument();
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen3.6:35b",
      message: expect.stringContaining("重点解释本轮没有执行外部联网搜索")
    }));
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

    const permissionReasonMatches = await screen.findAllByText(/需要先授予工作区读写权限/i);
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
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message: "当前只启用了 coding-agent，它适合代码实现与仓库上下文协作；注册表在 .opencow/skills/enabled-skills.json，后续安装或改配置仍要走审批。"
    });

    render(<App />);

    await findModelPicker("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "show enabled skills for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

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

    fireEvent.change(getComposerInput(), {
      target: { value: "which enabled skill should handle shell automation in this workspace" }
    });
    fireEvent.click(getComposerSendButton());

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

    fireEvent.change(getComposerInput(), {
      target: { value: "scan local skills and list available skill entries" }
    });
    fireEvent.click(getComposerSendButton());

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

    fireEvent.change(getComposerInput(), {
      target: { value: "show details for the coding-agent skill" }
    });
    fireEvent.click(getComposerSendButton());

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

    fireEvent.change(getComposerInput(), {
      target: { value: "scan local mcp plugins and list available model context protocol entries" }
    });
    fireEvent.click(getComposerSendButton());

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

    fireEvent.change(getComposerInput(), {
      target: { value: "show details for the browser mcp plugin" }
    });
    fireEvent.click(getComposerSendButton());

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

    fireEvent.change(getComposerInput(), {
      target: { value: "preview starting the browser mcp plugin locally" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getByText("MCP 插件启动预览说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/没有启动真实进程/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen2.5-coder:7b",
      message: expect.stringContaining("No resolved executable launcher")
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

    fireEvent.change(getComposerInput(), {
      target: { value: "use the enabled docs skill to search local rules for shell permission guidance" }
    });
    fireEvent.click(getComposerSendButton());

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

    fireEvent.change(getComposerInput(), {
      target: { value: "search local knowledge for shell permission rules" }
    });
    fireEvent.click(getComposerSendButton());

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

    const permissionReasonMatches = await screen.findAllByText(/需要先授予工作区读写权限/i);
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

    const permissionReasonMatches = await screen.findAllByText(/需要先授予受控完全访问权限/i);
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
