import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { Inspector } from "../features/workbench/components/Inspector";
import {
  createCapabilityToggleRequestState,
  createInitialWorkbenchState,
  createRollbackLimitUpdatedState,
  createSearchEnabledState,
  createStorageCleanupState,
  createTaskExecutionFailedState,
  createTaskExecutionStartedState,
  createUserTaskSubmittedState
} from "../features/workbench/workbenchState";

const { loadOllamaOverviewMock } = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn()
}));

vi.mock("../features/ollama/ollamaService", () => ({
  loadOllamaOverview: loadOllamaOverviewMock
}));

const inspectorActions = {
  onApproveDangerousAction: vi.fn(),
  onCancelDangerousAction: vi.fn(),
  onApprovePermissionRequest: vi.fn(),
  onCancelPermissionRequest: vi.fn(),
  onPreviewRollback: vi.fn(),
  onApplyRollback: vi.fn(),
  onCancelRollback: vi.fn(),
  onRetryLocalTask: vi.fn(),
  onCancelActiveTask: vi.fn(),
  onUpdateRollbackLimit: vi.fn(),
  onCleanupStorage: vi.fn(),
  onToggleRemoteApi: vi.fn(),
  onToggleSearch: vi.fn(),
  onSaveRemoteApiConfig: vi.fn(),
  onSaveSearchProviderConfig: vi.fn()
};

describe("App", () => {
  it("renders the desktop workbench shell after loading Ollama", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    render(<App />);

    expect(await screen.findAllByText("qwen2.5-coder:7b")).not.toHaveLength(0);
    expect(screen.getByRole("main", { name: "opencow 工作台" })).toBeInTheDocument();
  });

  it("surfaces a traceable error when loading Ollama overview throws", async () => {
    loadOllamaOverviewMock.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:11434"));

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("connect ECONNREFUSED 127.0.0.1:11434").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/ollama_overview/).length).toBeGreaterThan(0);
    expect(screen.getByText(/无法连接本地 Ollama/)).toBeInTheDocument();
  });

  it("shows search sources and tool results after desktop demo actions", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "模拟联网搜索" }));
    await waitFor(() => {
      expect(screen.getAllByText(/OpenClaw GitHub/).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "模拟工具结果" }));
    expect(screen.getAllByText(/skills_scan|Skill/).length).toBeGreaterThan(0);
  });

  it("submits a local task from the composer into the workbench flow", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    render(<App />);

    await screen.findAllByText("qwen2.5-coder:7b");

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "请检查当前工作区并整理待办" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText(/任务已进入本地队列/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText(/本地任务执行完成|local_task_runner/).length).toBeGreaterThan(0);
    });
  });

  it("requires confirmation before enabling network search from conversation", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    render(<App />);

    await screen.findAllByText("qwen2.5-coder:7b");

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "请先开启联网搜索" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect((await screen.findAllByText(/确认开启联网搜索/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/等待用户确认能力变更/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/任务已进入本地队列/)).not.toBeInTheDocument();
  });

  it("requires confirmation before enabling remote api from conversation", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    render(<App />);

    await screen.findAllByText("qwen2.5-coder:7b");

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "请开启远程 API" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect((await screen.findAllByText(/确认开启远程 API/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/等待用户确认能力变更/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/任务已进入本地队列/)).not.toBeInTheDocument();
  });

  it("shows a traceable local task failure after desktop demo action", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "模拟本地任务失败" }));

    await waitFor(() => {
      expect(screen.getAllByText(/本地任务执行失败/).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/local_task_runner/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ollama 响应超时/).length).toBeGreaterThan(0);
  });

  it("requeues a failed local task after retrying from the inspector", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "模拟本地任务失败" }));

    await waitFor(() => {
      expect(screen.getAllByText(/本地任务执行失败/).length).toBeGreaterThan(0);
    });

    const taskSection = screen.getByRole("heading", { name: "本地任务" }).closest("section");

    expect(taskSection).not.toBeNull();
    fireEvent.click(within(taskSection as HTMLElement).getByRole("button", { name: "重试本地任务" }));

    await waitFor(() => {
      expect(screen.getAllByText(/已重试本地任务/).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/Ollama 响应超时/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/队列中/).length).toBeGreaterThan(0);
  });

  it("stops the active local task from the composer without freezing the workbench", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    render(<App />);

    await screen.findAllByText("qwen2.5-coder:7b");

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "请检查当前工作区并整理待办" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    const composerInput = screen.getByRole("textbox", { name: "输入任务" });
    const composerSection = composerInput.closest("section");

    expect(composerSection).not.toBeNull();
    const stopButton = await within(composerSection as HTMLElement).findByRole("button", { name: "停止任务" });
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(screen.getAllByText(/本地任务已停止/).length).toBeGreaterThan(0);
    });
    expect(screen.getByRole("button", { name: "发送" })).toBeInTheDocument();
    expect(screen.getByText(/当前任务已中断/)).toBeInTheDocument();
  });

  it("renders queued local tasks in the inspector", () => {
    const state = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "请检查当前工作区并整理待办"
    });

    render(<Inspector state={state} {...inspectorActions} />);

    const taskSection = screen.getByText("本地任务").closest("section");

    expect(taskSection).not.toBeNull();
    expect(within(taskSection as HTMLElement).getByText("待处理 1 条")).toBeInTheDocument();
    expect(within(taskSection as HTMLElement).getByText("队列中")).toBeInTheDocument();
  });

  it("shows a stop action for the running local task inside the inspector queue", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "请检查当前工作区并整理待办"
    });
    const running = createTaskExecutionStartedState(queued);

    render(<Inspector state={running} {...inspectorActions} />);

    const taskSection = screen.getByText("本地任务").closest("section");

    expect(taskSection).not.toBeNull();
    expect(within(taskSection as HTMLElement).getByRole("button", { name: "停止任务" })).toBeInTheDocument();
  });

  it("shows a retry action for the failed local task inside the inspector queue", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "请检查当前工作区并整理待办"
    });
    const running = createTaskExecutionStartedState(queued);
    const failed = createTaskExecutionFailedState(running, {
      summary: "本地任务执行失败",
      detail: "Ollama 响应超时，请检查本地模型状态。",
      actionLabel: "检查 Ollama 服务并重试",
      source: "local_task_runner"
    });

    render(<Inspector state={failed} {...inspectorActions} />);

    const taskSection = screen.getByText("本地任务").closest("section");

    expect(taskSection).not.toBeNull();
    expect(within(taskSection as HTMLElement).getByRole("button", { name: "重试本地任务" })).toBeInTheDocument();
  });

  it("renders multiple search sources in the inspector", () => {
    const searchedOnce = createSearchEnabledState(createInitialWorkbenchState(), {
      provider: "Tavily",
      query: "OpenClaw Windows 本地助手",
      sourceTitle: "OpenClaw GitHub",
      sourceUrl: "https://github.com/example/openclaw",
      summary: "已启用联网搜索，并注入 1 条来源摘要。"
    });
    const searchedTwice = createSearchEnabledState(searchedOnce, {
      provider: "Bocha",
      query: "OpenCow 桌面端",
      sourceTitle: "OpenCow Desktop Spec",
      sourceUrl: "https://example.com/opencow-desktop",
      summary: "已追加 1 条桌面端参考来源。"
    });

    render(<Inspector state={searchedTwice} {...inspectorActions} />);

    const sourceSection = screen.getByText("来源").closest("section");

    expect(sourceSection).not.toBeNull();
    expect(within(sourceSection as HTMLElement).getAllByText(/OpenCow Desktop Spec/).length).toBeGreaterThan(0);
    expect(within(sourceSection as HTMLElement).getAllByText(/OpenClaw GitHub/).length).toBeGreaterThan(0);
  });

  it("shows the updated rollback limit in the desktop workbench chrome", () => {
    const state = createRollbackLimitUpdatedState(createInitialWorkbenchState(), 18);

    render(<Inspector state={state} {...inspectorActions} />);

    const settingsSection = screen.getByText("高级设置").closest("section");

    expect(settingsSection).not.toBeNull();
    expect(within(settingsSection as HTMLElement).getByText("回退点上限 18 / 20")).toBeInTheDocument();
    expect(within(settingsSection as HTMLElement).getByText("当前最多保留 18 段可回退点。")).toBeInTheDocument();
  });

  it("shows local cleanup entries in advanced settings", () => {
    const state = createStorageCleanupState(createInitialWorkbenchState(), "cache");

    render(<Inspector state={state} {...inspectorActions} />);

    const settingsSection = screen.getByText("高级设置").closest("section");

    expect(settingsSection).not.toBeNull();
    expect(within(settingsSection as HTMLElement).getByText("清空会话")).toBeInTheDocument();
    expect(within(settingsSection as HTMLElement).getByText("清空日志")).toBeInTheDocument();
    expect(within(settingsSection as HTMLElement).getByText("清空缓存")).toBeInTheDocument();
    expect(within(settingsSection as HTMLElement).getByText("清空快照")).toBeInTheDocument();
    expect(within(settingsSection as HTMLElement).getByText("清空知识库索引")).toBeInTheDocument();
    expect(within(settingsSection as HTMLElement).getByText("缓存条目 0")).toBeInTheDocument();
  });

  it("shows remote api and network toggles in advanced settings", () => {
    render(<Inspector state={createInitialWorkbenchState()} {...inspectorActions} />);

    const settingsSection = screen.getByText("高级设置").closest("section");

    expect(settingsSection).not.toBeNull();
    expect(within(settingsSection as HTMLElement).getByRole("button", { name: "开启远程 API" })).toBeInTheDocument();
    expect(within(settingsSection as HTMLElement).getByRole("button", { name: "开启联网搜索" })).toBeInTheDocument();
  });

  it("shows remote api config inputs in advanced settings", () => {
    render(<Inspector state={createInitialWorkbenchState()} {...inspectorActions} />);

    const settingsSection = screen.getByText("高级设置").closest("section");

    expect(settingsSection).not.toBeNull();
    expect(within(settingsSection as HTMLElement).getByLabelText("远程 API Base URL")).toBeInTheDocument();
    expect(within(settingsSection as HTMLElement).getByLabelText("远程 API Provider")).toBeInTheDocument();
    expect(within(settingsSection as HTMLElement).getByLabelText("远程 API Key")).toBeInTheDocument();
    expect(within(settingsSection as HTMLElement).getByRole("button", { name: "保存远程 API 配置" })).toBeInTheDocument();
  });

  it("shows search provider config inputs in advanced settings", () => {
    render(<Inspector state={createInitialWorkbenchState()} {...inspectorActions} />);

    const settingsSection = screen.getByText("高级设置").closest("section");

    expect(settingsSection).not.toBeNull();
    expect(within(settingsSection as HTMLElement).getByLabelText("联网搜索 Provider")).toBeInTheDocument();
    expect(within(settingsSection as HTMLElement).getByRole("button", { name: "保存联网搜索配置" })).toBeInTheDocument();
  });
});

describe("capability toggle cancellation flow", () => {
  it("cancels a requested network search enablement without enabling the capability", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    const { container } = render(<App />);

    await screen.findAllByText("qwen2.5-coder:7b");

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "请先开启联网搜索" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect((await screen.findAllByText(/确认开启联网搜索/)).length).toBeGreaterThan(0);

    const permissionSection = screen.getByRole("heading", { name: "权限确认" }).closest("section");
    const cancelButton = permissionSection?.querySelectorAll(".action-row button")[1] ?? null;

    expect(cancelButton).not.toBeNull();
    fireEvent.click(cancelButton as HTMLButtonElement);

    await waitFor(() => {
      expect(within(permissionSection as HTMLElement).getByText("当前没有待确认的能力变更")).toBeInTheDocument();
    });
    expect(screen.getAllByText(/capability_toggle_cancelled/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/联网搜索默认关闭/).length).toBeGreaterThan(0);
  });
});

describe("capability toggle confirmation coverage", () => {
  it("requires confirmation before disabling network search from conversation", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    const { container } = render(<App />);

    await screen.findAllByText("qwen2.5-coder:7b");
    fireEvent.click(screen.getByRole("button", { name: "开启联网搜索" }));

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "关闭联网搜索" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect((await screen.findAllByText(/确认关闭联网搜索/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/等待用户确认能力变更/).length).toBeGreaterThan(0);
  });

  it("requires confirmation before disabling remote api from conversation", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    const { container } = render(<App />);

    await screen.findAllByText("qwen2.5-coder:7b");
    fireEvent.click(screen.getByRole("button", { name: "开启远程 API" }));

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "关闭远程 API" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect((await screen.findAllByText(/确认关闭远程 API/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/等待用户确认能力变更/).length).toBeGreaterThan(0);
  });

  it("shows capability-specific confirmation actions in the inspector", () => {
    const state = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "用户要求开启联网搜索以补充最新来源。",
      providerLabel: "Tavily"
    });

    render(<Inspector state={state} {...inspectorActions} />);

    const permissionSection = screen.getByRole("heading", { name: "权限确认" }).closest("section");

    expect(permissionSection).not.toBeNull();
    expect(within(permissionSection as HTMLElement).getByRole("button", { name: "批准能力变更" })).toBeInTheDocument();
    expect(within(permissionSection as HTMLElement).getByRole("button", { name: "取消能力变更" })).toBeInTheDocument();
  });

  it("shows a capability-specific empty state after a capability toggle is cancelled", () => {
    const requested = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "用户要求开启联网搜索以补充最新来源。",
      providerLabel: "Tavily"
    });
    const state = {
      ...requested,
      confirmation: {
        pending: null
      },
      audit: {
        ...requested.audit,
        summary: "用户已取消能力变更",
        lastEvent: {
          ...requested.audit.lastEvent,
          source: "capability_toggle_cancelled"
        }
      }
    };

    render(<Inspector state={state} {...inspectorActions} />);

    const permissionSection = screen.getByRole("heading", { name: "权限确认" }).closest("section");

    expect(permissionSection).not.toBeNull();
    expect(within(permissionSection as HTMLElement).getByText("当前没有待确认的能力变更")).toBeInTheDocument();
  });
});
