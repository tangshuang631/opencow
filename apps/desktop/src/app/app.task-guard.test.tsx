import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const APPROVE_PERMISSION_NAME = "\u6279\u51c6\u63d0\u6743";
const APPROVE_DANGEROUS_NAME = "\u6279\u51c6\u9ad8\u98ce\u9669\u64cd\u4f5c";
const APPROVE_CAPABILITY_NAME = "\u6279\u51c6\u80fd\u529b\u53d8\u66f4";
const PLANNING_FAILURE_TITLE = "\u672c\u5730\u52a9\u624b\u89c4\u5212\u5931\u8d25";
const PLANNING_FAILURE_SUMMARY =
  "\u672c\u5730\u52a9\u624b\u6682\u65f6\u65e0\u6cd5\u7406\u89e3\u8fd9\u6b21\u8bf7\u6c42\uff0c\u672a\u6392\u961f\u3001\u672a\u6267\u884c\u4efb\u4f55\u547d\u4ee4\u3002";
const PLANNING_FAILURE_ACTION =
  "\u8bf7\u6539\u5199\u8bf7\u6c42\uff0c\u6216\u4ece\u53ea\u8bfb\u9884\u89c8\u91cd\u65b0\u5f00\u59cb\u3002";

function expectWorkbenchReady() {
  expect(screen.getByRole("main", { name: "opencow 工作台" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "输入任务" })).toBeInTheDocument();
}

function expandInspectorRecords() {
  if (screen.queryByText("来源") === null) {
    fireEvent.click(screen.getByRole("button", { name: "展开配置与记录" }));
  }
}

function expandInspectorAdvancedSettings() {
  fireEvent.click(screen.getByRole("button", { name: "\u8bbe\u7f6e" }));
}

function expandInspectorRollbackRecords() {
  expandInspectorRecords();
  fireEvent.click(screen.getByRole("button", { name: "展开回退记录" }));
}

const { loadOllamaOverviewMock, planAssistantTaskMock, executeAssistantTaskMock } = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn(),
  planAssistantTaskMock: vi.fn(),
  executeAssistantTaskMock: vi.fn()
}));

vi.mock("../features/ollama/ollamaService", () => ({
  loadOllamaOverview: loadOllamaOverviewMock
}));

vi.mock("../features/assistant/assistantTaskService", async () => {
  const actual = await vi.importActual<typeof import("../features/assistant/assistantTaskService")>(
    "../features/assistant/assistantTaskService"
  );

  return {
    ...actual,
    planAssistantTask: planAssistantTaskMock,
    executeAssistantTask: executeAssistantTaskMock
  };
});

describe("App local task guard", () => {
  beforeEach(() => {
    vi.useRealTimers();
    loadOllamaOverviewMock.mockReset();
    planAssistantTaskMock.mockReset();
    executeAssistantTaskMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("surfaces timeout-style failures through the task guard UI instead of leaving the page stuck", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "workspace-overview",
      title: "Workspace overview",
      summary: "Inspect the current workspace",
      auditSummary: "Local assistant planned a workspace overview task.",
      auditDetail: "Readonly workspace overview task."
    });
    executeAssistantTaskMock.mockRejectedValueOnce(
      new Error("Local task exceeded the maximum execution time of 45 seconds.")
    );

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });
    expectWorkbenchReady();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect the workspace and keep going" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByLabelText("assistant-pending")).toBeInTheDocument();
    expect(await screen.findAllByText(/Local task execution timed out/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/Execution was stopped after the timeout limit/i)).not.toHaveLength(0);
  });

  it("surfaces project run timeout failures through the task guard UI instead of leaving the lifecycle flow stuck", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "workspace-project-run",
      title: "Run matched local project",
      summary: "Run the matched local project through the fixed workspace lifecycle path.",
      auditSummary: "Local assistant planned a workspace project run task.",
      auditDetail: "Workspace project run task: run the desktop app locally"
    });
    executeAssistantTaskMock.mockRejectedValueOnce(
      new Error("Local task exceeded the maximum execution time of 45 seconds.")
    );

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });
    expectWorkbenchReady();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "run the desktop app locally" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByLabelText("assistant-pending")).toBeInTheDocument();
    expect(await screen.findAllByText(/Local task execution timed out/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/Execution was stopped after the timeout limit/i)).not.toHaveLength(0);
    expect(executeAssistantTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "workspace-project-run",
        title: "Run matched local project"
      }),
      expect.objectContaining({
        snapshotAvailable: true
      })
    );
  });

  it("surfaces readonly shell diagnostics and recovery guidance through the task guard UI", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "readonly-shell-git-status",
      title: "Workspace git status",
      summary: "Inspect current workspace git changes before deeper assistant execution.",
      auditSummary: "Local assistant planned a readonly git status command.",
      auditDetail: "Readonly shell command task: git status --short"
    });
    executeAssistantTaskMock.mockRejectedValueOnce(
      new Error(
        "Shell execution failed in assistantTaskService. Command id: git-status. Required permission: readonly. Underlying error: Tauri readonly_command failed: git executable unavailable. Next step: verify the readonly shell bridge, workspace root, command whitelist, and audit trail before retrying."
      )
    );

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "check git status for this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByLabelText("assistant-pending")).toBeInTheDocument();
    expect(await screen.findAllByText(/本地任务执行失败/)).not.toHaveLength(0);
    expect(await screen.findAllByText(/请先检查只读 shell 桥接、工作区根目录、命令白名单和审计记录，再重试。/)).not.toHaveLength(0);
    expect(screen.queryByText(/Local task execution failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Command id: git-status/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Required permission: readonly/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Underlying error: Tauri readonly_command failed/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /verify the readonly shell bridge, workspace root, command whitelist, and audit trail before retrying/i
      )
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Execution kind: readonly-shell-git-status/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Execution title: Workspace git status/i)).not.toBeInTheDocument();
    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));
    expect(await screen.findAllByText(/Command id: git-status/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/Required permission: readonly/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/Underlying error: Tauri readonly_command failed/i)).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /verify the readonly shell bridge, workspace root, command whitelist, and audit trail before retrying/i
      )
    ).not.toHaveLength(0);
    expect(await screen.findAllByText(/Execution kind: readonly-shell-git-status/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/Execution title: Workspace git status/i)).not.toHaveLength(0);
    expect(
      await screen.findAllByText(/Execution audit detail: Readonly shell command task: git status --short/i)
    ).not.toHaveLength(0);
    expect(screen.queryByText(/Check the local execution chain and try again\./i)).not.toBeInTheDocument();
  });

  it("surfaces malformed local assistant execution results instead of crashing the page", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "workspace-overview",
      title: "Workspace overview",
      summary: "Inspect the current workspace",
      auditSummary: "Local assistant planned a workspace overview task.",
      auditDetail: "Readonly workspace overview task."
    });
    executeAssistantTaskMock.mockResolvedValueOnce(undefined);

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect the workspace and keep going" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByLabelText("assistant-pending")).toBeInTheDocument();
    expect(await screen.findAllByText(/本地任务执行失败/)).not.toHaveLength(0);
    expect(await screen.findAllByText(/请先检查本地助手执行结果映射，再重试。/)).not.toHaveLength(0);
    expect(screen.queryByText(/Local task execution failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid local assistant execution result/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/inspect assistantTaskService result mapping for workspace-overview before retrying/i)
    ).not.toBeInTheDocument();
    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));
    expect(await screen.findAllByText(/Invalid local assistant execution result/i)).not.toHaveLength(0);
    expect(
      await screen.findAllByText(/inspect assistantTaskService result mapping for workspace-overview before retrying/i)
    ).not.toHaveLength(0);
  });

  it("preserves object-shaped local execution failure fields for recovery analysis", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "workspace-overview",
      title: "Workspace overview",
      summary: "Inspect the current workspace",
      auditSummary: "Local assistant planned a workspace overview task.",
      auditDetail: "Readonly workspace overview task."
    });
    executeAssistantTaskMock.mockRejectedValueOnce({
      code: "tauri-command-bridge-error",
      detail: "workspace command bridge returned object failure detail",
      route: "readonly-shell-git-status",
      source: "assistantTaskService",
      stdout: "git status stdout preview: M apps/desktop/src/app/App.tsx",
      stderr: "git status stderr preview: fatal bridge diagnostic",
      statusCode: 502,
      responseSummary: "upstream model gateway refused request"
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect execution object failure" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByLabelText("assistant-pending")).toBeInTheDocument();
    expect(await screen.findAllByText(/本地任务执行失败/)).not.toHaveLength(0);
    expect(await screen.findAllByText(/请先检查只读 shell 桥接、工作区根目录、命令白名单和审计记录，再重试。/)).not.toHaveLength(0);
    expect(screen.queryByText(/Local task execution failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/workspace command bridge returned object failure detail/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tauri-command-bridge-error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/readonly-shell-git-status/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /verify the readonly shell bridge, workspace root, command whitelist, and audit trail before retrying/i
      )
    ).not.toBeInTheDocument();
    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));
    expect(await screen.findAllByText(/workspace command bridge returned object failure detail/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/tauri-command-bridge-error/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/readonly-shell-git-status/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/stdout: git status stdout preview/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/stderr: git status stderr preview/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/statusCode: 502/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/responseSummary: upstream model gateway refused request/i)).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /verify the readonly shell bridge, workspace root, command whitelist, and audit trail before retrying/i
      )
    ).not.toHaveLength(0);
    expect(screen.queryByText(/Unknown local assistant execution error/i)).not.toBeInTheDocument();
  });

  it("preserves nested causes inside object-shaped local execution failures", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "workspace-overview",
      title: "Workspace overview",
      summary: "Inspect the current workspace",
      auditSummary: "Local assistant planned a workspace overview task.",
      auditDetail: "Readonly workspace overview task."
    });
    executeAssistantTaskMock.mockRejectedValueOnce({
      code: "assistant-service-wrapper",
      detail: "assistant service received a bridge object error",
      cause: {
        code: "tauri-workspace-command-denied",
        detail: "nested tauri command cause detail",
        source: "workspace_write_command"
      }
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect nested execution object failure" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByLabelText("assistant-pending")).toBeInTheDocument();
    expect(await screen.findAllByText(/本地任务执行失败/)).not.toHaveLength(0);
    expect(screen.queryByText(/Local task execution failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/assistant service received a bridge object error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nested tauri command cause detail/i)).not.toBeInTheDocument();

    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));

    expect(await screen.findAllByText(/assistant service received a bridge object error/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/nested tauri command cause detail/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/tauri-workspace-command-denied/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/workspace_write_command/i)).not.toHaveLength(0);
  });

  it("uses an execution-specific fallback when a local execution Error has no message", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "workspace-overview",
      title: "Workspace overview",
      summary: "Inspect the current workspace",
      auditSummary: "Local assistant planned a workspace overview task.",
      auditDetail: "Readonly workspace overview task."
    });
    executeAssistantTaskMock.mockRejectedValueOnce(new Error(""));

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect empty execution error" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByLabelText("assistant-pending")).toBeInTheDocument();
    expect(await screen.findAllByText(/本地任务执行失败/)).not.toHaveLength(0);
    expect(await screen.findAllByText(/请先检查本地助手执行结果映射，再重试。/)).not.toHaveLength(0);
    expect(screen.queryByText(/Local task execution failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Unknown local assistant execution error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Error$/i)).not.toBeInTheDocument();
    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));
    expect(await screen.findAllByText(/Unknown local assistant execution error/i)).not.toHaveLength(0);
  });

  it("surfaces planner failures instead of crashing before a local task is queued", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockImplementation(() => {
      throw new Error("Planner route table could not resolve the requested local assistant action.");
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect workspace route failure" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findAllByText(PLANNING_FAILURE_TITLE)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_SUMMARY)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_ACTION)).not.toHaveLength(0);
    expect(screen.queryByText(/Local assistant planning failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Input summary: inspect workspace route failure/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Planner route table could not resolve the requested local assistant action/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Review planner routing, rewrite the request, or restart from a readonly preview before retrying/i)
    ).not.toBeInTheDocument();
    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));
    expect(await screen.findAllByText(/Input summary: inspect workspace route failure/i)).not.toHaveLength(0);
    expect(
      await screen.findAllByText(/Planner route table could not resolve the requested local assistant action/i)
    ).not.toHaveLength(0);
    expect(
      await screen.findAllByText(/Review planner routing, rewrite the request, or restart from a readonly preview before retrying/i)
    ).not.toHaveLength(0);
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
  });

  it("skips repeating the same planner failure instead of calling the planner again", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockImplementation(() => {
      throw new Error("Planner route table could not resolve the requested local assistant action.");
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect repeated planner failure" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findAllByText(PLANNING_FAILURE_TITLE)).not.toHaveLength(0);

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect repeated planner failure" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findAllByText(/重复规划失败已跳过/i)).not.toHaveLength(0);
    expect(screen.queryByText(/相同请求刚刚发生规划失败，未再次调用 planner，也未排队或执行命令。/i)).not.toBeInTheDocument();
    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));
    expect(
      await screen.findAllByText(/相同请求刚刚发生规划失败，未再次调用 planner，也未排队或执行命令。/i)
    ).not.toHaveLength(0);
    expect(await screen.findAllByText(/Previous planner failure detail:/i)).not.toHaveLength(0);
    expect(planAssistantTaskMock).toHaveBeenCalledTimes(1);
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
  });

  it("preserves non-Error planner failure details for recovery analysis", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockImplementation(() => {
      throw "planner route registry returned a string failure";
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect string planner failure" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findAllByText(PLANNING_FAILURE_TITLE)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_SUMMARY)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_ACTION)).not.toHaveLength(0);
    expect(screen.queryByText(/Local assistant planning failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Input summary: inspect string planner failure/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/planner route registry returned a string failure/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Unknown local assistant planner error/i)).not.toBeInTheDocument();
    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));
    expect(await screen.findAllByText(/Local assistant planning failed/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/Input summary: inspect string planner failure/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/planner route registry returned a string failure/i)).not.toHaveLength(0);
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
  });

  it("preserves object-shaped planner failure fields for recovery analysis", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockImplementation(() => {
      throw {
        code: "planner-route-registry-error",
        detail: "planner registry object failure detail",
        route: "workspace-write-create-temp-output"
      };
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect object planner failure" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findAllByText(PLANNING_FAILURE_TITLE)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_SUMMARY)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_ACTION)).not.toHaveLength(0);
    expect(screen.queryByText(/Local assistant planning failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Input summary: inspect object planner failure/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/planner registry object failure detail/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/planner-route-registry-error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\[object Object\]/i)).not.toBeInTheDocument();
    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));
    expect(await screen.findAllByText(/Local assistant planning failed/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/Input summary: inspect object planner failure/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/planner registry object failure detail/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/planner-route-registry-error/i)).not.toHaveLength(0);
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
  });

  it("preserves nested planner failure causes for recovery analysis", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockImplementation(() => {
      const error = new Error("planner wrapper failed");
      (error as Error & { cause?: unknown }).cause = {
        code: "tauri-bridge-cause",
        detail: "nested planner cause detail",
        source: "workspace-root-resolver"
      };
      throw error;
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect nested planner failure" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findAllByText(PLANNING_FAILURE_TITLE)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_SUMMARY)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_ACTION)).not.toHaveLength(0);
    expect(screen.queryByText(/Local assistant planning failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Input summary: inspect nested planner failure/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/planner wrapper failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nested planner cause detail/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tauri-bridge-cause/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/workspace-root-resolver/i)).not.toBeInTheDocument();
    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));
    expect(await screen.findAllByText(/Local assistant planning failed/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/Input summary: inspect nested planner failure/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/planner wrapper failed/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/nested planner cause detail/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/tauri-bridge-cause/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/workspace-root-resolver/i)).not.toHaveLength(0);
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
  });

  it("surfaces malformed planner results instead of crashing before branching on kind", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValueOnce(undefined);

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect malformed planner result" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findAllByText(PLANNING_FAILURE_TITLE)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_SUMMARY)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_ACTION)).not.toHaveLength(0);
    expect(screen.queryByText(/Local assistant planning failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Input summary: inspect malformed planner result/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid local assistant plan result/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Review planner routing, rewrite the request, or restart from a readonly preview before retrying/i)
    ).not.toBeInTheDocument();
    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));
    expect(await screen.findAllByText(/Local assistant planning failed/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/Input summary: inspect malformed planner result/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/Invalid local assistant plan result/i)).not.toHaveLength(0);
    expect(
      await screen.findAllByText(/Review planner routing, rewrite the request, or restart from a readonly preview before retrying/i)
    ).not.toHaveLength(0);
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
  });

  it("surfaces unknown planner result kinds before queuing a local task", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValueOnce({
      kind: "unknown-local-task",
      title: "Unknown local task",
      summary: "This kind is not supported by the desktop task queue.",
      auditSummary: "Malformed planner result.",
      auditDetail: "Unknown planner kind test fixture."
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect unknown planner kind" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findAllByText(PLANNING_FAILURE_TITLE)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_SUMMARY)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_ACTION)).not.toHaveLength(0);
    expect(screen.queryByText(/Local assistant planning failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Input summary: inspect unknown planner kind/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Unsupported local assistant plan kind: unknown-local-task/i)).not.toBeInTheDocument();
    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));
    expect(await screen.findAllByText(/Local assistant planning failed/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/Input summary: inspect unknown planner kind/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/Unsupported local assistant plan kind: unknown-local-task/i)).not.toHaveLength(0);
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
  });

  it("surfaces next repair step guidance from local assistant failures instead of a generic fallback", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "workspace-overview",
      title: "Workspace overview",
      summary: "inspect local assistant repair diagnostics",
      auditSummary: "Local assistant planned a workspace overview task.",
      auditDetail: "Readonly workspace overview task."
    });
    executeAssistantTaskMock.mockRejectedValueOnce(
      new Error(
        "Local assistant diagnostic failed in assistantTaskService. Provider status: not configured. Next repair step: configure a search provider in advanced settings, approve network search capability, then retry the request."
      )
    );

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect local assistant repair diagnostics" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByLabelText("assistant-pending")).toBeInTheDocument();
    expect(await screen.findAllByText(/Local task execution failed/i)).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /configure a search provider in advanced settings, approve network search capability, then retry the request/i
      )
    ).not.toHaveLength(0);
    expect(screen.queryByText(/Check the local execution chain and try again\./i)).not.toBeInTheDocument();
  });

  it("keeps permission-approved executions under the same timeout guard instead of leaving the approved chain stuck", async () => {
    vi.useFakeTimers();
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock
      .mockReturnValueOnce({
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before opencow can run the matched local project.",
        riskSummary: "Allow a fixed workspace-local run command only after user approval.",
        queuedExecutionKind: "workspace-project-run",
        queuedExecutionTitle: "Run matched local project",
        queuedExecutionAuditSummary: "Local assistant planned a workspace project run task.",
        queuedExecutionAuditDetail: "Workspace project run task: run the desktop app locally",
        queuedMessage: "run the desktop app locally"
      })
      .mockReturnValueOnce({
        kind: "workspace-project-run",
        title: "Run matched local project",
        summary: "Run the matched local project through the fixed workspace lifecycle path.",
        auditSummary: "Local assistant planned a workspace project run task.",
        auditDetail: "Workspace project run task: run the desktop app locally"
      });
    executeAssistantTaskMock.mockReturnValue(new Promise(() => {}));

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });
    expectWorkbenchReady();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "run the desktop app locally" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const approvePermissionButton = screen.getByRole("button", { name: /^批准提权$/i });
    fireEvent.click(approvePermissionButton as HTMLButtonElement);

    await act(async () => {
      vi.advanceTimersByTime(80);
      await Promise.resolve();
    });
    expect(screen.getByLabelText("assistant-pending")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(120);
      await Promise.resolve();
    });
    expect(executeAssistantTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "workspace-project-run",
        title: "Run matched local project"
      }),
      expect.objectContaining({
        snapshotAvailable: true
      })
    );
    expect(screen.getAllByText(/Attempt 1 \/ 3/i)).not.toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(45_000);
      await Promise.resolve();
    });

    expect(screen.getAllByText(/Local task execution timed out/i)).not.toHaveLength(0);
    expect(screen.getAllByText(/Execution was stopped after the timeout limit/i)).not.toHaveLength(0);
    expect(planAssistantTaskMock).toHaveBeenCalledTimes(1);
    expect(executeAssistantTaskMock).toHaveBeenCalledTimes(1);
  });

  it("runs the queued permission execution after approval instead of re-planning into a different task", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock
      .mockReturnValueOnce({
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before creating temp-output.",
        riskSummary: "Allow the fixed workspace-local temp-output creation command only after user approval.",
        queuedExecutionKind: "workspace-write-create-temp-output",
        queuedExecutionTitle: "Create temp-output directory",
        queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output creation command.",
        queuedExecutionAuditDetail: "Workspace write shell command task: create temp-output directory",
        queuedMessage: "create a temp-output folder for this workspace"
      })
      .mockReturnValueOnce({
        kind: "workspace-overview",
        title: "Workspace overview",
        summary: "Inspect the current workspace",
        auditSummary: "Local assistant planned a workspace overview task.",
        auditDetail: "Readonly workspace overview task."
      });
    executeAssistantTaskMock.mockResolvedValueOnce({
      resultTitle: "Create temp-output directory",
      resultSummary: "temp-output created from the approved queued permission task."
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "create a temp-output folder for this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const approvePermissionButton = await screen.findByRole("button", { name: APPROVE_PERMISSION_NAME });
    fireEvent.click(approvePermissionButton as HTMLButtonElement);

    await screen.findByLabelText("assistant-pending");
    await screen.findAllByText(/temp-output created from the approved queued permission task/i);

    expect(planAssistantTaskMock).toHaveBeenCalledTimes(1);
    expect(executeAssistantTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "workspace-write-create-temp-output",
        title: "Create temp-output directory",
        auditDetail: "Workspace write shell command task: create temp-output directory"
      }),
      expect.objectContaining({
        snapshotAvailable: true
      })
    );

    const conversation = screen.getByRole("region", { name: "会话" });
    const userMessageSummaries = Array.from(conversation.querySelectorAll(".user-message-bubble .message-summary"))
      .map((node) => node.textContent?.trim());

    expect(
      userMessageSummaries.filter((text) => text === "create a temp-output folder for this workspace")
    ).toHaveLength(1);
  });

  it("surfaces workspace-write object-shaped shell failures with permission recovery guidance after approval", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "permission-request",
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before creating temp-output.",
      riskSummary: "Allow the fixed workspace-local temp-output creation command only after user approval.",
      queuedExecutionKind: "workspace-write-create-temp-output",
      queuedExecutionTitle: "Create temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output creation command.",
      queuedExecutionAuditDetail: "Workspace write shell command task: create temp-output directory",
      queuedMessage: "create a temp-output folder for this workspace"
    });
    executeAssistantTaskMock.mockRejectedValueOnce({
      code: "tauri-workspace-write-bridge-error",
      detail: "workspace write bridge returned object failure detail",
      route: "workspace-write-create-temp-output",
      source: "workspace_write_command",
      stderr: "access denied while creating temp-output"
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "create a temp-output folder for this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const approvePermissionButton = await screen.findByRole("button", { name: APPROVE_PERMISSION_NAME });
    fireEvent.click(approvePermissionButton as HTMLButtonElement);

    expect(await screen.findAllByText(/本地任务执行失败/)).not.toHaveLength(0);
    expect(await screen.findAllByText(/请先检查权限审批、工作区根目录、命令白名单和审计记录，再重试。/)).not.toHaveLength(0);
    expect(screen.queryByText(/Local task execution failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/workspace write bridge returned object failure detail/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/workspace-write-create-temp-output/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /verify the permission approval, workspace root, command whitelist, and audit trail before retrying/i
      )
    ).not.toBeInTheDocument();
    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));
    expect(await screen.findAllByText(/workspace write bridge returned object failure detail/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/workspace-write-create-temp-output/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/tauri-workspace-write-bridge-error/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/stderr: access denied while creating temp-output/i)).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /verify the permission approval, workspace root, command whitelist, and audit trail before retrying/i
      )
    ).not.toHaveLength(0);
    expect(screen.queryByText(/inspect assistantTaskService result mapping for workspace-write-create-temp-output/i)).not.toBeInTheDocument();
  });

  it("passes snapshot availability into approved controlled-full executions after snapshots are cleared", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "confirmation",
      title: "Confirm temp-output removal",
      summary: "Remove temp-output inside the approved workspace.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Delete temp-output only after explicit confirmation.",
      requiredMode: "controlled-full",
      safetySummary: "Requires rollback snapshot availability before destructive execution.",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a controlled-full temp-output removal task.",
      queuedExecutionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
      queuedMessage: "remove the temp-output folder from this workspace"
    });
    executeAssistantTaskMock.mockResolvedValueOnce({
      resultTitle: "Remove temp-output directory",
      resultSummary: "destructive cleanup received snapshot guard context."
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.click(screen.getByRole("button", { name: "清空快照" }));

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "remove the temp-output folder from this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const approveDangerousButton = await screen.findByRole("button", { name: APPROVE_DANGEROUS_NAME });
    fireEvent.click(approveDangerousButton as HTMLButtonElement);

    expect(await screen.findAllByText(/destructive cleanup received snapshot guard context/i)).not.toHaveLength(0);
    expect(executeAssistantTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "controlled-full-remove-temp-output",
        title: "Remove temp-output directory"
      }),
      expect.objectContaining({
        snapshotAvailable: false
      })
    );
  });

  it("surfaces controlled-full object-shaped shell failures with rollback recovery guidance after confirmation", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "confirmation",
      title: "Confirm temp-output removal",
      summary: "Remove temp-output inside the approved workspace.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Delete temp-output only after explicit confirmation.",
      requiredMode: "controlled-full",
      safetySummary: "Requires rollback snapshot availability before destructive execution.",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a controlled-full temp-output removal task.",
      queuedExecutionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
      queuedMessage: "remove the temp-output folder from this workspace"
    });
    executeAssistantTaskMock.mockRejectedValueOnce({
      code: "tauri-controlled-full-bridge-error",
      detail: "controlled full bridge returned object failure detail",
      route: "controlled-full-remove-temp-output",
      source: "controlled_full_command",
      stderr: "rollback snapshot check failed before removal"
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "remove the temp-output folder from this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const approveDangerousButton = await screen.findByRole("button", { name: APPROVE_DANGEROUS_NAME });
    fireEvent.click(approveDangerousButton as HTMLButtonElement);

    expect(await screen.findAllByText(/本地任务执行失败/)).not.toHaveLength(0);
    expect(await screen.findAllByText(/请先检查高风险确认、回退快照、工作区根目录、命令白名单和审计记录，再重试。/)).not.toHaveLength(0);
    expect(screen.queryByText(/Local task execution failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/controlled full bridge returned object failure detail/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/controlled-full-remove-temp-output/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /verify the dangerous confirmation, rollback snapshot availability, workspace root, command whitelist, and audit trail before retrying/i
      )
    ).not.toBeInTheDocument();
    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));
    expect(await screen.findAllByText(/controlled full bridge returned object failure detail/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/controlled-full-remove-temp-output/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/tauri-controlled-full-bridge-error/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/source: controlled_full_command/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/stderr: rollback snapshot check failed before removal/i)).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /verify the dangerous confirmation, rollback snapshot availability, workspace root, command whitelist, and audit trail before retrying/i
      )
    ).not.toHaveLength(0);
    expect(screen.queryByText(/inspect assistantTaskService result mapping for controlled-full-remove-temp-output/i)).not.toBeInTheDocument();
  });

  it("blocks a controlled-full execution hidden inside a readonly dangerous confirmation", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "confirmation",
      title: "Confirm suspicious readonly action",
      summary: "Readonly confirmation must not hide a destructive command.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "This intentionally mismatches the required mode and queued execution kind.",
      requiredMode: "readonly",
      safetySummary: "Planner bug: destructive execution was queued behind readonly confirmation.",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant incorrectly planned a controlled-full execution behind readonly confirmation.",
      queuedExecutionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
      queuedMessage: "remove the temp-output folder from this workspace"
    });
    executeAssistantTaskMock.mockResolvedValueOnce({
      resultTitle: "Remove temp-output directory",
      resultSummary: "This destructive execution must not run."
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "remove the temp-output folder from this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const approveDangerousButton = await screen.findByRole("button", { name: APPROVE_DANGEROUS_NAME });
    fireEvent.click(approveDangerousButton as HTMLButtonElement);

    expect(await screen.findAllByText(/Dangerous confirmation execution scope mismatch stopped/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/queued controlled-full-remove-temp-output behind readonly confirmation/i)).not.toHaveLength(0);
    expect(screen.queryByText(/This destructive execution must not run/i)).not.toBeInTheDocument();
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
  });

  it("runs a readonly shell self-check before retrying a failed controlled-full shell command", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock
      .mockReturnValueOnce({
        kind: "confirmation",
        title: "Confirm temp-output removal",
        summary: "Remove temp-output inside the approved workspace.",
        commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
        impact: "Delete temp-output only after explicit confirmation.",
        requiredMode: "controlled-full",
        safetySummary: "Requires rollback snapshot availability before destructive execution.",
        queuedExecutionKind: "controlled-full-remove-temp-output",
        queuedExecutionTitle: "Remove temp-output directory",
        queuedExecutionAuditSummary: "Local assistant planned a controlled-full temp-output removal task.",
        queuedExecutionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
        queuedMessage: "remove the temp-output folder from this workspace"
      })
      .mockReturnValueOnce({
        kind: "readonly-shell-workspace-root",
        title: "Readonly shell diagnostics",
        summary: "Run a readonly shell diagnostic by listing the workspace root before retrying command execution.",
        auditSummary: "Local assistant planned readonly shell diagnostics.",
        auditDetail: "Readonly shell diagnostics task: workspace root listing"
      });
    executeAssistantTaskMock
      .mockRejectedValueOnce(
        new Error(
          "Shell execution failed in assistantTaskService. Command id: remove-temp-output-dir. Required permission: controlled-full. Underlying error: Tauri controlled_full_command failed: snapshot unavailable. Next step: verify the dangerous confirmation, rollback snapshot availability, workspace root, command whitelist, and audit trail before retrying."
        )
      )
      .mockResolvedValueOnce({
        resultTitle: "Readonly shell diagnostics",
        resultSummary:
          "Self-check report: shell bridge reachable; workspace root accessible; command whitelist accepted workspace-root-list; audit trail retained readonly shell diagnostics."
      });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "remove the temp-output folder from this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    fireEvent.click(await screen.findByRole("button", { name: APPROVE_DANGEROUS_NAME }));

    expect(await screen.findAllByText(/本地任务执行失败/)).not.toHaveLength(0);
    expect(screen.queryByText(/Local task execution failed/i)).not.toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole("button", { name: /重试本地任务/i }))[0] as HTMLButtonElement);

    expect(await screen.findAllByText(/Self-check report: shell bridge reachable/i)).not.toHaveLength(0);
    expect(planAssistantTaskMock).toHaveBeenNthCalledWith(
      2,
      "verify the dangerous confirmation, rollback snapshot availability, workspace root, command whitelist, and audit trail before retrying.",
      "readonly"
    );
    expect(executeAssistantTaskMock).toHaveBeenCalledTimes(2);
    expect(executeAssistantTaskMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ kind: "readonly-shell-workspace-root" }),
      expect.any(Object)
    );
  });

  it("stops a repeated same-mode permission request after approval instead of asking for the same approval again", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock
      .mockReturnValueOnce({
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before creating temp-output.",
        riskSummary: "Allow the fixed workspace-local temp-output creation command only after user approval.",
        queuedMessage: "create a temp-output folder for this workspace"
      })
      .mockReturnValueOnce({
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is still requested after approval.",
        riskSummary: "This repeated same-mode request should be stopped to avoid a permission loop.",
        queuedExecutionKind: "workspace-write-create-temp-output",
        queuedExecutionTitle: "Create temp-output directory",
        queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output creation command.",
        queuedExecutionAuditDetail: "Workspace write shell command task: create temp-output directory",
        queuedMessage: "create a temp-output folder for this workspace"
      });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "create a temp-output folder for this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const approvePermissionButton = await screen.findByRole("button", { name: APPROVE_PERMISSION_NAME });
    fireEvent.click(approvePermissionButton as HTMLButtonElement);

    expect(await screen.findAllByText(/Permission escalation loop stopped/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/planner requested workspace-write again after workspace-write was already approved/i)).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: APPROVE_PERMISSION_NAME })).not.toBeInTheDocument();
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
  });

  it("blocks queued controlled-full execution hidden inside a workspace-write permission approval", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValueOnce({
      kind: "permission-request",
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before creating temp-output.",
      riskSummary: "This buggy plan hides a destructive cleanup behind a workspace-write prompt.",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant incorrectly queued a controlled-full cleanup.",
      queuedExecutionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
      queuedMessage: "create a temp-output folder for this workspace"
    });
    executeAssistantTaskMock.mockResolvedValueOnce({
      resultTitle: "Remove temp-output directory",
      resultSummary: "This must never run after workspace-write approval."
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "create a temp-output folder for this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    fireEvent.click(await screen.findByRole("button", { name: APPROVE_PERMISSION_NAME }));

    expect(await screen.findAllByText(/Permission execution scope mismatch stopped/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/queued controlled-full-remove-temp-output after workspace-write approval/i)).not.toHaveLength(0);
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
  });

  it("blocks controlled-full approval when re-planning does not return a dangerous confirmation", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock
      .mockReturnValueOnce({
        kind: "permission-request",
        targetMode: "controlled-full",
        reason: "Controlled full permission is required before starting a local MCP plugin process.",
        riskSummary: "Starting a local process must keep permission, confirmation, audit, timeout, and rollback protections.",
        queuedExecutionKind: "mcp-local-plugin-start",
        queuedExecutionTitle: "Local MCP plugin start",
        queuedExecutionAuditSummary: "Local assistant planned a controlled local MCP plugin start task.",
        queuedExecutionAuditDetail: "Controlled local MCP plugin start task: start local mcp plugin",
        queuedMessage: "start local mcp plugin"
      })
      .mockReturnValueOnce({
        kind: "mcp-local-plugin-start",
        title: "Local MCP plugin start",
        summary: "Start the local MCP plugin process.",
        auditSummary: "Local assistant planned a controlled local MCP plugin start task.",
        auditDetail: "Controlled local MCP plugin start task: start local mcp plugin"
      });
    executeAssistantTaskMock.mockResolvedValueOnce({
      resultTitle: "Local MCP plugin start",
      resultSummary: "Started local MCP plugin process."
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "start local mcp plugin" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const approvePermissionButton = await screen.findByRole("button", { name: APPROVE_PERMISSION_NAME });
    fireEvent.click(approvePermissionButton as HTMLButtonElement);

    expect(await screen.findAllByText(/Dangerous confirmation required after controlled-full approval/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/planner returned mcp-local-plugin-start instead of a dangerous confirmation/i)).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: APPROVE_DANGEROUS_NAME })).not.toBeInTheDocument();
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
  });

  it("does not re-plan the same request while a matching permission approval is already pending", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "permission-request",
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before creating temp-output.",
      riskSummary: "Allow the fixed workspace-local temp-output creation command only after user approval.",
      queuedExecutionKind: "workspace-write-create-temp-output",
      queuedExecutionTitle: "Create temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output creation command.",
      queuedExecutionAuditDetail: "Workspace write shell command task: create temp-output directory",
      queuedMessage: "create a temp-output folder for this workspace"
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "create a temp-output folder for this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByRole("button", { name: APPROVE_PERMISSION_NAME })).toBeInTheDocument();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "create a temp-output folder for this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(planAssistantTaskMock).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(/需要先授予工作区读写权限/i)).not.toHaveLength(0);
    expect(screen.getAllByRole("button", { name: APPROVE_PERMISSION_NAME })).toHaveLength(1);
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
  });

  it("does not re-plan the same request while a matching dangerous confirmation is already pending", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "confirmation",
      title: "Confirm temp-output removal",
      summary: "Remove temp-output inside the approved workspace.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Delete temp-output only after explicit confirmation.",
      requiredMode: "controlled-full",
      safetySummary: "Requires explicit dangerous confirmation before execution.",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a controlled-full temp-output removal task.",
      queuedExecutionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
      queuedMessage: "remove the temp-output folder from this workspace"
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "remove the temp-output folder from this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByRole("button", { name: APPROVE_DANGEROUS_NAME })).toBeInTheDocument();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "remove the temp-output folder from this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(planAssistantTaskMock).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(/Remove temp-output inside the approved workspace\./i)).not.toHaveLength(0);
    expect(screen.getAllByRole("button", { name: APPROVE_DANGEROUS_NAME })).toHaveLength(1);
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
  });

  it("stops a repeated dangerous confirmation after approval instead of asking for the same approval again", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock
      .mockReturnValueOnce({
        kind: "confirmation",
        title: "Confirm temp-output removal",
        summary: "Remove temp-output inside the approved workspace.",
        commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
        impact: "Delete temp-output only after explicit confirmation.",
        requiredMode: "controlled-full",
        safetySummary: "Requires explicit dangerous confirmation before execution.",
        queuedMessage: "remove the temp-output folder from this workspace"
      })
      .mockReturnValueOnce({
        kind: "confirmation",
        title: "Confirm temp-output removal",
        summary: "Remove temp-output inside the approved workspace.",
        commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
        impact: "Delete temp-output only after explicit confirmation.",
        requiredMode: "controlled-full",
        safetySummary: "Requires explicit dangerous confirmation before execution.",
        queuedMessage: "remove the temp-output folder from this workspace"
      });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "remove the temp-output folder from this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const approveDangerousButton = await screen.findByRole("button", { name: APPROVE_DANGEROUS_NAME });
    fireEvent.click(approveDangerousButton as HTMLButtonElement);

    expect(await screen.findAllByText(/Dangerous confirmation loop stopped/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/planner requested the same dangerous confirmation again after approval/i)).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: APPROVE_DANGEROUS_NAME })).not.toBeInTheDocument();
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
  });

  it("does not refresh the same capability toggle confirmation while it is already pending", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "\u5f00\u542f\u8054\u7f51\u641c\u7d22" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByRole("button", { name: APPROVE_CAPABILITY_NAME })).toBeInTheDocument();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "\u5f00\u542f\u8054\u7f51\u641c\u7d22" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(planAssistantTaskMock).not.toHaveBeenCalled();
    expect(await screen.findAllByText("重复审批请求已跳过")).not.toHaveLength(0);
    expect(screen.queryByText(/Duplicate pending approval request skipped/i)).not.toBeInTheDocument();
    expect(await screen.findAllByText("已有能力变更确认正在等待处理，已跳过这次重复请求。")).not.toHaveLength(0);
    expect(screen.queryByText(/already waiting for capability confirmation/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: APPROVE_CAPABILITY_NAME })).toHaveLength(1);
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
  });

  it("requests capability confirmation for natural network search requests before planning", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "\u8054\u7f51\u641c\u7d22\u4e00\u4e0b\u6700\u65b0\u8d44\u6599" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByRole("button", { name: APPROVE_CAPABILITY_NAME })).toBeInTheDocument();
    expect(planAssistantTaskMock).not.toHaveBeenCalled();
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
  });

  it("stops a natural network search after approval when no provider is configured", async () => {
    const message = "\u8054\u7f51\u641c\u7d22\u4e00\u4e0b\u6700\u65b0\u8d44\u6599";

    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "network-search-guidance",
      title: "Network search guidance",
      summary: message,
      auditSummary: "Local assistant planned readonly network search guidance.",
      auditDetail: "Readonly network search guidance task."
    });
    executeAssistantTaskMock.mockResolvedValue({
      resultTitle: "Network search guidance",
      resultSummary: "No external network search was run."
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: message }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const approveCapabilityButton = await screen.findByRole("button", { name: APPROVE_CAPABILITY_NAME });
    fireEvent.click(approveCapabilityButton as HTMLButtonElement);

    expect(await screen.findAllByText("Search provider is not configured")).not.toHaveLength(0);
    expect(await screen.findAllByText(/Configure a search provider/i)).not.toHaveLength(0);
    expect(planAssistantTaskMock).not.toHaveBeenCalled();
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
  });

  it("continues a natural network search request after capability approval", async () => {
    const message = "\u8054\u7f51\u641c\u7d22\u4e00\u4e0b\u6700\u65b0\u8d44\u6599";

    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "network-search-guidance",
      title: "Network search guidance",
      summary: message,
      auditSummary: "Local assistant planned readonly network search guidance.",
      auditDetail: "Readonly network search guidance task."
    });
    executeAssistantTaskMock.mockResolvedValue({
      resultTitle: "Network search guidance",
      resultSummary: "No external network search was run. Configure and approve a network search provider first."
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    expandInspectorAdvancedSettings();
    fireEvent.change(screen.getByRole("textbox", { name: "\u8054\u7f51\u641c\u7d22 Provider" }), {
      target: { value: "Tavily" }
    });
    fireEvent.click(screen.getByRole("button", { name: "\u4fdd\u5b58\u8054\u7f51\u641c\u7d22\u914d\u7f6e" }));

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: message }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const approveCapabilityButton = await screen.findByRole("button", { name: APPROVE_CAPABILITY_NAME });
    fireEvent.click(approveCapabilityButton as HTMLButtonElement);

    expect(await screen.findByLabelText("assistant-pending")).toBeInTheDocument();
    expect(await screen.findAllByText(/No external network search was run/i)).not.toHaveLength(0);
    expect(planAssistantTaskMock).toHaveBeenCalledWith(message, "readonly");
    expect(executeAssistantTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "network-search-guidance",
        title: "Network search guidance",
        summary: message
      }),
      expect.objectContaining({
        snapshotAvailable: true
      })
    );
  });

  it("surfaces shell diagnostic next steps after an approved workspace-write command fails", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock
      .mockReturnValueOnce({
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before creating temp-output.",
        riskSummary: "Allow the fixed workspace-local temp-output creation command only after user approval.",
        queuedExecutionKind: "workspace-write-create-temp-output",
        queuedExecutionTitle: "Create temp-output directory",
        queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output creation command.",
        queuedExecutionAuditDetail: "Workspace write shell command task: create temp-output directory",
        queuedMessage: "create a temp-output folder for this workspace"
      })
      .mockReturnValueOnce({
        kind: "workspace-write-create-temp-output",
        title: "Create temp-output directory",
        summary: "Create the temp-output workspace directory through the controlled shell runner.",
        auditSummary: "Local assistant planned a workspace-write temp-output creation command.",
        auditDetail: "Workspace write shell command task: create temp-output directory"
      });
    executeAssistantTaskMock.mockRejectedValueOnce(
      new Error(
        "Shell execution failed in assistantTaskService. Command id: create-temp-output-dir. Required permission: workspace-write. Underlying error: Tauri workspace_write_command failed: access denied. Next step: verify the permission approval, workspace root, command whitelist, and audit trail before retrying."
      )
    );

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "create a temp-output folder for this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const approvePermissionButton = await screen.findByRole("button", { name: /^批准提权$/i });
    fireEvent.click(approvePermissionButton as HTMLButtonElement);

    expect(await screen.findByLabelText("assistant-pending")).toBeInTheDocument();
    expect(await screen.findAllByText(/本地任务执行失败/)).not.toHaveLength(0);
    expect(await screen.findAllByText(/请先检查权限审批、工作区根目录、命令白名单和审计记录，再重试。/)).not.toHaveLength(0);
    expect(screen.queryByText(/Local task execution failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Command id: create-temp-output-dir/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Required permission: workspace-write/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Underlying error: Tauri workspace_write_command failed: access denied/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /verify the permission approval, workspace root, command whitelist, and audit trail before retrying/i
      )
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Recovery visibility: rollback preview is available for this failed task/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/audit trail keeps the input, execution kind, execution title, audit detail, and failure detail/i)
    ).not.toBeInTheDocument();
    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));
    expect(await screen.findAllByText(/Command id: create-temp-output-dir/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/Required permission: workspace-write/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/Underlying error: Tauri workspace_write_command failed: access denied/i)).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /verify the permission approval, workspace root, command whitelist, and audit trail before retrying/i
      )
    ).not.toHaveLength(0);
    expect(
      await screen.findAllByText(/Recovery visibility: rollback preview is available for this failed task/i)
    ).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /audit trail keeps the input, execution kind, execution title, audit detail, and failure detail/i
      )
    ).not.toHaveLength(0);
    expect(screen.queryByText(/Check the local execution chain and try again\./i)).not.toBeInTheDocument();
  });

  it("clears the local execution timeout guard after an executed task succeeds", async () => {
    vi.useFakeTimers();
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "workspace-overview",
      title: "Workspace overview",
      summary: "Inspect the current workspace",
      auditSummary: "Local assistant planned a workspace overview task.",
      auditDetail: "Readonly workspace overview task."
    });
    executeAssistantTaskMock.mockResolvedValueOnce({
      resultTitle: "Workspace overview complete",
      resultSummary: "The workspace overview finished before the timeout guard fired."
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect the workspace and keep going" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    await act(async () => {
      vi.advanceTimersByTime(80);
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(120);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getAllByText(/Workspace overview complete/i)).not.toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the local execution timeout guard when the user cancels an active executed task", async () => {
    vi.useFakeTimers();
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "workspace-overview",
      title: "Workspace overview",
      summary: "Inspect the current workspace",
      auditSummary: "Local assistant planned a workspace overview task.",
      auditDetail: "Readonly workspace overview task."
    });
    executeAssistantTaskMock.mockReturnValueOnce(new Promise(() => {}));

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect the workspace and keep going" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    await act(async () => {
      vi.advanceTimersByTime(80);
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(120);
      await Promise.resolve();
    });

    expect(vi.getTimerCount()).toBe(1);

    fireEvent.click(screen.getAllByRole("button", { name: /停止任务/i })[0] as HTMLButtonElement);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getAllByText(/本地任务已停止/i)).not.toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("passes an abort signal into local assistant execution and aborts it when the user stops the task", async () => {
    vi.useFakeTimers();
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "workspace-overview",
      title: "Workspace overview",
      summary: "Inspect the current workspace",
      auditSummary: "Local assistant planned a workspace overview task.",
      auditDetail: "Readonly workspace overview task."
    });
    executeAssistantTaskMock.mockReturnValueOnce(new Promise(() => {}));

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect the workspace and keep going" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    await act(async () => {
      vi.advanceTimersByTime(80);
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(120);
      await Promise.resolve();
    });

    expect(executeAssistantTaskMock).toHaveBeenCalledTimes(1);
    const executionContext = executeAssistantTaskMock.mock.calls[0]?.[1] as { signal?: AbortSignal };
    expect(executionContext.signal).toBeInstanceOf(AbortSignal);
    expect(executionContext.signal?.aborted).toBe(false);

    fireEvent.click(screen.getAllByRole("button", { name: /停止任务/i })[0] as HTMLButtonElement);

    await act(async () => {
      await Promise.resolve();
    });

    expect(executionContext.signal?.aborted).toBe(true);
    expect(screen.getAllByText(/本地任务已停止/i)).not.toHaveLength(0);
  });

  it("ignores a stale task result after the user cancels that task and starts another one", async () => {
    vi.useFakeTimers();
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock
      .mockReturnValueOnce({
        kind: "workspace-overview",
        title: "First workspace overview",
        summary: "Inspect the first workspace request",
        auditSummary: "Local assistant planned the first workspace overview task.",
        auditDetail: "Readonly first workspace overview task."
      })
      .mockReturnValueOnce({
        kind: "workspace-overview",
        title: "Second workspace overview",
        summary: "Inspect the second workspace request",
        auditSummary: "Local assistant planned the second workspace overview task.",
        auditDetail: "Readonly second workspace overview task."
      });

    let resolveFirstTask: (value: { resultTitle: string; resultSummary: string }) => void = () => {};
    const firstTaskPromise = new Promise<{ resultTitle: string; resultSummary: string }>((resolve) => {
      resolveFirstTask = resolve;
    });
    const secondTaskPromise = new Promise<{ resultTitle: string; resultSummary: string }>(() => {});
    executeAssistantTaskMock.mockReturnValueOnce(firstTaskPromise).mockReturnValueOnce(secondTaskPromise);

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    expect(composerInput).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect the first workspace request" }
    });
    fireEvent.click(container.querySelector("button.send-button") as HTMLButtonElement);

    await act(async () => {
      vi.advanceTimersByTime(80);
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(120);
      await Promise.resolve();
    });
    expect(executeAssistantTaskMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("assistant-pending")).toBeInTheDocument();

    fireEvent.click(container.querySelector("button.send-button") as HTMLButtonElement);

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect the second workspace request" }
    });
    fireEvent.click(container.querySelector("button.send-button") as HTMLButtonElement);

    await act(async () => {
      vi.advanceTimersByTime(80);
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(120);
      await Promise.resolve();
    });
    expect(executeAssistantTaskMock).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("assistant-pending")).toBeInTheDocument();
    expect(screen.getAllByText(/inspect the second workspace request/i)).not.toHaveLength(0);

    await act(async () => {
      resolveFirstTask({
        resultTitle: "Stale first task result",
        resultSummary: "The cancelled first task finished after the second task had already started."
      });
      await Promise.resolve();
    });

    expect(screen.getByLabelText("assistant-pending")).toBeInTheDocument();
    expect(screen.getAllByText(/inspect the second workspace request/i)).not.toHaveLength(0);
    expect(screen.queryByText(/Stale first task result/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/The cancelled first task finished after the second task/i)).not.toBeInTheDocument();
  });

  it("keeps a timed-out local task failed when its underlying execution resolves late", async () => {
    vi.useFakeTimers();
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "workspace-overview",
      title: "Workspace overview",
      summary: "Inspect the current workspace",
      auditSummary: "Local assistant planned a workspace overview task.",
      auditDetail: "Readonly workspace overview task."
    });
    let resolveTask: (value: { resultTitle: string; resultSummary: string }) => void = () => {};
    executeAssistantTaskMock.mockReturnValueOnce(
      new Promise<{ resultTitle: string; resultSummary: string }>((resolve) => {
        resolveTask = resolve;
      })
    );

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });
    expectWorkbenchReady();

    fireEvent.change(container.querySelector("textarea") as HTMLTextAreaElement, {
      target: { value: "inspect the workspace but the execution hangs" }
    });
    fireEvent.click(container.querySelector("button.send-button") as HTMLButtonElement);

    await act(async () => {
      vi.advanceTimersByTime(80);
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(120);
      await Promise.resolve();
    });
    expect(executeAssistantTaskMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(45_000);
      await Promise.resolve();
    });

    expect(screen.queryAllByText(/Local task execution timed out/i).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();

    await act(async () => {
      resolveTask({
        resultTitle: "Late workspace overview success",
        resultSummary: "This late success must not overwrite the timeout failure."
      });
      await Promise.resolve();
    });

    expect(screen.queryAllByText(/Local task execution timed out/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Late workspace overview success/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/This late success must not overwrite/i)).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("surfaces self-repair failure analysis and a concrete user-help next step instead of looping", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "opencow-self-repair-workspace-project-runtime-registry",
      title: "Repair opencow workspace project runtime registry",
      summary: "Repair the workspace project runtime registry through the controlled self-repair chain.",
      auditSummary: "Local assistant planned an opencow workspace project runtime registry self-repair.",
      auditDetail:
        "Opencow self-repair task: workspace project runtime registry | request=diagnose opencow and continue repairing its workspace project runtime registry"
    });
    executeAssistantTaskMock.mockRejectedValueOnce(
      new Error(
        "Runtime registry repair verification failed because the repaired schema could not be validated after rewrite."
      )
    );

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });
    expectWorkbenchReady();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "diagnose opencow and continue repairing its workspace project runtime registry" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByLabelText("assistant-pending")).toBeInTheDocument();
    expect(await screen.findAllByText(/Opencow self-repair stopped after failure analysis/i)).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /Automatic self-repair was stopped to avoid retry loops\. Check \.opencow\/runtime\/workspace-project-runs\.json first\./i
      )
    ).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /\.opencow\/runtime\/workspace-project-runs\.json|diagnose opencow and continue repairing its workspace project runtime registry/i
      )
    ).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /Check \.opencow\/runtime\/workspace-project-runs\.json first\. If you want opencow to try again after you review it, say: diagnose opencow and continue repairing its workspace project runtime registry\./i
      )
    ).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /Runtime registry repair verification failed because the repaired schema could not be validated after rewrite\./i
      )
    ).not.toHaveLength(0);

    const conversation = container.querySelector(".conversation");
    expect(conversation).not.toBeNull();
    expect(
      within(conversation as HTMLElement).getByText(/Opencow self-repair stopped after failure analysis/i)
    ).toBeInTheDocument();
    expect(
      within(conversation as HTMLElement).getByText(
        /Check \.opencow\/runtime\/workspace-project-runs\.json first\./i
      )
    ).toBeInTheDocument();
    expect(
      within(conversation as HTMLElement).getByText(
        /Runtime registry repair verification failed because the repaired schema could not be validated after rewrite\./i
      )
    ).toBeInTheDocument();
  });

  it("tailors self-repair failure guidance to the enabled skills registry target", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "opencow-self-repair-enabled-skills-registry",
      title: "Repair opencow enabled skills registry",
      summary: "Repair the workspace-local enabled skills registry through the controlled self-repair chain.",
      auditSummary: "Local assistant planned an opencow enabled skills registry self-repair.",
      auditDetail:
        "Opencow self-repair task: enabled skills registry | request=diagnose opencow and continue repairing its enabled skills registry"
    });
    executeAssistantTaskMock.mockRejectedValueOnce(
      new Error("Enabled skills registry repair verification failed because the rewritten schema remained invalid.")
    );

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });
    expectWorkbenchReady();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "diagnose opencow and continue repairing its enabled skills registry" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByLabelText("assistant-pending")).toBeInTheDocument();
    expect(await screen.findAllByText(/Opencow self-repair stopped after failure analysis/i)).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /\.opencow\/skills\/enabled-skills\.json|diagnose opencow and continue repairing its enabled skills registry/i
      )
    ).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /Check \.opencow\/skills\/enabled-skills\.json first\. If you want opencow to try again after you review it, say: diagnose opencow and continue repairing its enabled skills registry\./i
      )
    ).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /Enabled skills registry repair verification failed because the rewritten schema remained invalid\./i
      )
    ).not.toHaveLength(0);
  });

  it("tailors self-repair preview failure guidance to the enabled skills registry target", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "opencow-self-repair-preview",
      title: "Opencow self-repair preview",
      summary: "Preview a readonly opencow self-repair workflow by inspecting local docs, config surfaces, and likely repair boundaries before any mutation is approved.",
      auditSummary: "Local assistant planned a readonly opencow self-repair preview.",
      auditDetail:
        "Readonly opencow self-repair preview task: diagnose opencow and preview repairing its enabled skills registry"
    });
    executeAssistantTaskMock.mockRejectedValueOnce(
      new Error("Readonly self-repair preview failed because the local knowledge search index could not be opened.")
    );

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });
    expectWorkbenchReady();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "diagnose opencow and preview repairing its enabled skills registry" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByLabelText("assistant-pending")).toBeInTheDocument();
    expect(await screen.findAllByText(/Opencow self-repair stopped after failure analysis/i)).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /Automatic self-repair was stopped to avoid retry loops\. Check \.opencow\/skills\/enabled-skills\.json first\./i
      )
    ).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /diagnose opencow and continue repairing its enabled skills registry|\.opencow\/skills\/enabled-skills\.json/i
      )
    ).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /Readonly self-repair preview failed because the local knowledge search index could not be opened\./i
      )
    ).not.toHaveLength(0);
  });

  it("tailors self-repair preview failure guidance to the runtime registry target", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "opencow-self-repair-preview",
      title: "Opencow self-repair preview",
      summary: "Preview a readonly opencow self-repair workflow by inspecting local docs, config surfaces, and likely repair boundaries before any mutation is approved.",
      auditSummary: "Local assistant planned a readonly opencow self-repair preview.",
      auditDetail:
        "Readonly opencow self-repair preview task: diagnose opencow and preview repairing its workspace project runtime registry"
    });
    executeAssistantTaskMock.mockRejectedValueOnce(
      new Error("Readonly self-repair preview failed because the local knowledge search index could not be opened.")
    );

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });
    expectWorkbenchReady();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "diagnose opencow and preview repairing its workspace project runtime registry" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByLabelText("assistant-pending")).toBeInTheDocument();
    expect(await screen.findAllByText(/Opencow self-repair stopped after failure analysis/i)).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /Automatic self-repair was stopped to avoid retry loops\. Check \.opencow\/runtime\/workspace-project-runs\.json first\./i
      )
    ).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /diagnose opencow and continue repairing its workspace project runtime registry|\.opencow\/runtime\/workspace-project-runs\.json/i
      )
    ).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /Readonly self-repair preview failed because the local knowledge search index could not be opened\./i
      )
    ).not.toHaveLength(0);
  });

  it("stops a generic self-repair preview failure with concrete next-target guidance instead of a vague fallback", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "opencow-self-repair-preview",
      title: "Opencow self-repair preview",
      summary: "Preview a readonly opencow self-repair workflow by inspecting local docs, config surfaces, and likely repair boundaries before any mutation is approved.",
      auditSummary: "Local assistant planned a readonly opencow self-repair preview.",
      auditDetail:
        "Readonly opencow self-repair preview task: diagnose opencow and preview how to fix its current local error"
    });
    executeAssistantTaskMock.mockRejectedValueOnce(
      new Error("Readonly self-repair preview failed because the local knowledge search index could not be opened.")
    );

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });
    expectWorkbenchReady();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "diagnose opencow and preview how to fix its current local error" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByLabelText("assistant-pending")).toBeInTheDocument();
    expect(await screen.findAllByText(/Opencow self-repair stopped after failure analysis/i)).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /enabled skills registry|workspace project runtime registry|diagnose opencow and continue repairing its enabled skills registry|diagnose opencow and continue repairing its workspace project runtime registry/i
      )
    ).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /Readonly self-repair preview failed because the local knowledge search index could not be opened\./i
      )
    ).not.toHaveLength(0);
  });

  it("stops a short Chinese continue after a failed self-repair preview instead of re-planning hidden repair", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock
      .mockReturnValueOnce({
        kind: "opencow-self-repair-preview",
        title: "Opencow self-repair preview",
        summary: "Preview a readonly opencow self-repair workflow by inspecting local docs, config surfaces, and likely repair boundaries before any mutation is approved.",
        auditSummary: "Local assistant planned a readonly opencow self-repair preview.",
        auditDetail:
          "Readonly opencow self-repair preview task: diagnose opencow and preview repairing its enabled skills registry"
      })
      .mockReturnValue({
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before opencow can repair its enabled skills registry.",
        riskSummary: "This would rewrite a workspace-local opencow registry file.",
        auditSummary: "Local assistant task requires workspace-write permission for opencow self-repair.",
        auditDetail: "Opencow self-repair is waiting for workspace-write permission: hidden retry",
        queuedExecutionKind: "opencow-self-repair-enabled-skills-registry",
        queuedExecutionTitle: "Repair opencow enabled skills registry",
        queuedExecutionAuditSummary: "Local assistant planned an opencow enabled skills registry self-repair.",
        queuedExecutionAuditDetail: "Opencow self-repair task: enabled skills registry | request=hidden retry",
        queuedMessage: "diagnose opencow and continue repairing its enabled skills registry"
      });
    executeAssistantTaskMock.mockRejectedValueOnce(
      new Error("Readonly self-repair preview failed because the local knowledge search index could not be opened.")
    );

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });
    expectWorkbenchReady();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "diagnose opencow and preview repairing its enabled skills registry" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByLabelText("assistant-pending")).toBeInTheDocument();
    expect(await screen.findAllByText(/Opencow self-repair stopped after failure analysis/i)).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /Readonly self-repair preview failed because the local knowledge search index could not be opened\./i
      )
    ).not.toHaveLength(0);

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "继续" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findAllByText(/Preview continuation was stopped/i)).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        /The latest preview task already failed or was cancelled\. Review its failure detail, fix the blocking condition, or ask for a narrower explicit repair target before continuing\./i
      )
    ).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: APPROVE_PERMISSION_NAME })).not.toBeInTheDocument();
    expect(planAssistantTaskMock).toHaveBeenCalledTimes(1);
    expect(executeAssistantTaskMock).toHaveBeenCalledTimes(1);
  });

  it("stops retrying after the maximum attempt limit and tells the user how to help instead of looping forever", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "workspace-overview",
      title: "Workspace overview",
      summary: "Inspect the current workspace",
      auditSummary: "Local assistant planned a workspace overview task.",
      auditDetail: "Readonly workspace overview task."
    });
    executeAssistantTaskMock.mockRejectedValue(
      new Error("Workspace overview failed because a required local dependency could not be loaded.")
    );

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });
    expectWorkbenchReady();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect the workspace and keep going" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      expect(
        await screen.findAllByText(/Workspace overview failed because a required local dependency could not be loaded\./i)
      ).not.toHaveLength(0);

      const retryButtons = await screen.findAllByRole("button", { name: /重试本地任务/i });
      fireEvent.click(retryButtons[0] as HTMLButtonElement);
    }

    expect(await screen.findAllByText("本地任务已达到重试上限")).not.toHaveLength(0);
    expect(
      await screen.findAllByText(
        "已停止重复执行，避免死循环。请查看失败详情、改写请求，或先帮助 opencow 修复缺失依赖。"
      )
    ).not.toHaveLength(0);
    expect(await screen.findAllByText("重试上限记录已保留在日志和回退记录中。")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: /重试本地任务/i })).not.toBeInTheDocument();
    expect(executeAssistantTaskMock).toHaveBeenCalledTimes(3);
  });

  it("does not emit duplicate React key warnings while retrying the same local task", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      loadOllamaOverviewMock.mockResolvedValue({
        reachable: true,
        endpoint: "http://127.0.0.1:11434",
        selectedModel: "qwen2.5-coder:7b",
        diagnostic: "",
        models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
      });
      planAssistantTaskMock.mockReturnValue({
        kind: "workspace-overview",
        title: "Workspace overview",
        summary: "Inspect the current workspace",
        auditSummary: "Local assistant planned a workspace overview task.",
        auditDetail: "Readonly workspace overview task."
      });
      executeAssistantTaskMock.mockRejectedValue(
        new Error("Workspace overview failed because a required local dependency could not be loaded.")
      );

      const { container } = render(<App />);

      await act(async () => {
        await Promise.resolve();
      });

      const composerInput = container.querySelector("textarea");
      const sendButton = container.querySelector("button.send-button");

      expect(composerInput).not.toBeNull();
      expect(sendButton).not.toBeNull();

      fireEvent.change(composerInput as HTMLTextAreaElement, {
        target: { value: "inspect the workspace and keep going" }
      });
      fireEvent.click(sendButton as HTMLButtonElement);

      for (let attempt = 0; attempt < 2; attempt += 1) {
        expect(
          await screen.findAllByText(/Workspace overview failed because a required local dependency could not be loaded\./i)
        ).not.toHaveLength(0);

        const retryButtons = await screen.findAllByRole("button", { name: /重试本地任务/i });
        fireEvent.click(retryButtons[0] as HTMLButtonElement);
      }

      expect(await screen.findAllByText("本地任务已达到重试上限")).not.toHaveLength(0);
      expect(screen.queryByRole("button", { name: /重试本地任务/i })).not.toBeInTheDocument();
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/Encountered two children with the same key/i),
        expect.anything()
      );
      expect(
        consoleErrorSpy.mock.calls.some((call) =>
          call.some((argument) => typeof argument === "string" && /Encountered two children with the same key/i.test(argument))
        )
      ).toBe(false);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("keeps previous failure diagnostics collapsed into task details after retry", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "workspace-overview",
      title: "Workspace overview",
      summary: "Inspect the current workspace",
      auditSummary: "Local assistant planned a workspace overview task.",
      auditDetail: "Readonly workspace overview task."
    });
    executeAssistantTaskMock.mockRejectedValue(
      new Error("Workspace overview failed because a required local dependency could not be loaded.")
    );

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect the workspace and keep going" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(
      await screen.findAllByText(/Workspace overview failed because a required local dependency could not be loaded\./i)
    ).not.toHaveLength(0);

    const retryButtons = await screen.findAllByRole("button", { name: /重试本地任务/i });
    fireEvent.click(retryButtons[0] as HTMLButtonElement);

    const pending = await screen.findByLabelText("assistant-pending");

    expect(within(pending).queryByText(/Previous failure source: local_task_runner/i)).not.toBeInTheDocument();
    expect(
      within(pending).queryByText(
        /Previous failure detail: Workspace overview failed because a required local dependency could not be loaded\./i
      )
    ).not.toBeInTheDocument();
    expect(
      within(pending).queryByText(/Previous failure recovery hint: inspect assistantTaskService result mapping/i)
    ).not.toBeInTheDocument();

    const inspector = screen.getByLabelText("右侧面板");
    const taskSummary = within(inspector).getByText("inspect the workspace and keep going");
    const taskItem = taskSummary.closest(".task-queue-item");

    expect(taskItem).not.toBeNull();
    fireEvent.click(within(taskItem as HTMLElement).getByRole("button", { name: "展开失败细节" }));

    expect(within(taskItem as HTMLElement).getByText(/来源：local_task_runner/i)).toBeInTheDocument();
    expect(
      within(taskItem as HTMLElement).getByText(
        /详情：Workspace overview failed because a required local dependency could not be loaded\./i
      )
    ).toBeInTheDocument();
    expect(
      within(taskItem as HTMLElement).getByText(/建议：inspect assistantTaskService result mapping/i)
    ).toBeInTheDocument();
  });

  it("runs a readonly shell self-check before retrying a failed workspace-write shell command", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock
      .mockReturnValueOnce({
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before creating temp-output.",
        riskSummary: "Allow the fixed workspace-local temp-output creation command only after user approval.",
        queuedExecutionKind: "workspace-write-create-temp-output",
        queuedExecutionTitle: "Create temp-output directory",
        queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output creation command.",
        queuedExecutionAuditDetail: "Workspace write shell command task: create temp-output directory",
        queuedMessage: "create a temp-output folder for this workspace"
      })
      .mockReturnValueOnce({
        kind: "readonly-shell-workspace-root",
        title: "Readonly shell diagnostics",
        summary: "Run a readonly shell diagnostic by listing the workspace root before retrying command execution.",
        auditSummary: "Local assistant planned readonly shell diagnostics.",
        auditDetail: "Readonly shell diagnostics task: workspace root listing"
      });
    executeAssistantTaskMock
      .mockRejectedValueOnce(
        new Error(
          "Shell execution failed in assistantTaskService. Command id: create-temp-output-dir. Required permission: workspace-write. Underlying error: Tauri workspace_write_command failed: access denied. Next step: verify the permission approval, workspace root, command whitelist, and audit trail before retrying."
        )
      )
      .mockResolvedValueOnce({
        resultTitle: "Readonly shell diagnostics",
        resultSummary:
          "Self-check report: shell bridge reachable; workspace root accessible; command whitelist accepted workspace-root-list; audit trail retained readonly shell diagnostics."
      });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "create a temp-output folder for this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    fireEvent.click(await screen.findByRole("button", { name: APPROVE_PERMISSION_NAME }));

    expect(await screen.findAllByText(/本地任务执行失败/)).not.toHaveLength(0);
    expect(screen.queryByText(/Local task execution failed/i)).not.toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole("button", { name: /重试本地任务/i }))[0] as HTMLButtonElement);

    expect(await screen.findAllByText(/Self-check report: shell bridge reachable/i)).not.toHaveLength(0);
    expect(planAssistantTaskMock).toHaveBeenNthCalledWith(
      2,
      "verify the permission approval, workspace root, command whitelist, and audit trail before retrying.",
      "readonly"
    );
    expect(executeAssistantTaskMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ kind: "readonly-shell-workspace-root" }),
      expect.any(Object)
    );
  });

  it("runs a readonly RAG capability self-check before retrying a failed local RAG search", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock
      .mockReturnValueOnce({
        kind: "rag-local-doc-search",
        title: "Local RAG document search",
        summary: "summarize the long pptx docx and md documents in this workspace",
        auditSummary: "Local assistant planned a local RAG document search.",
        auditDetail: "Readonly local RAG search task."
      })
      .mockReturnValueOnce({
        kind: "capability-rag-overview",
        title: "OpenClaw RAG capability overview",
        summary: "Inspect local OpenClaw RAG package foundations before retrying the failed document query.",
        auditSummary: "Local assistant planned an OpenClaw RAG capability overview.",
        auditDetail: "Readonly capability catalog task: rag"
      });
    executeAssistantTaskMock
      .mockRejectedValueOnce(
        new Error(
          "Local RAG search failed in assistantTaskService. Query: summarize the long pptx docx and md documents in this workspace. Underlying error: local knowledge index could not be opened. Next step: verify the local RAG index, document parsers for pptx/docx/md, workspace root discovery, and retry with a narrower document query before continuing."
        )
      )
      .mockResolvedValueOnce({
        resultTitle: "OpenClaw RAG capability overview",
        resultSummary: "RAG capability self-check completed. Required packages are present; inspect the local knowledge index next."
      });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });
    expectWorkbenchReady();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "summarize the long pptx docx and md documents in this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findAllByText(/本地 RAG 检索失败/)).not.toHaveLength(0);
    expect(await screen.findAllByText(/请先检查本地 RAG 索引、pptx\/docx\/md 解析器和工作区根目录，再缩小文档范围重试。/)).not.toHaveLength(0);
    expect(screen.queryByText(/Local task execution failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/local knowledge index could not be opened/i)).not.toBeInTheDocument();

    const retryButtons = await screen.findAllByRole("button", { name: /重试本地任务/i });
    fireEvent.click(retryButtons[0] as HTMLButtonElement);

    expect(await screen.findAllByText(/RAG capability self-check completed/i)).not.toHaveLength(0);
    expect(planAssistantTaskMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("inspect local OpenClaw RAG capability wiring"),
      "readonly"
    );
    expect(executeAssistantTaskMock).toHaveBeenCalledTimes(2);
    expect(executeAssistantTaskMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ kind: "capability-rag-overview" }),
      expect.any(Object)
    );
  });

  it("runs a readonly RAG capability self-check before retrying a failed skill-assisted local RAG search", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock
      .mockReturnValueOnce({
        kind: "skills-local-enabled-rag-doc-search",
        title: "Skill-assisted local RAG document search",
        summary: "use the enabled docs skill to summarize the pptx docx md workspace docs",
        auditSummary: "Local assistant planned a skill-assisted readonly local RAG document search.",
        auditDetail: "Skill-assisted readonly local RAG search task"
      })
      .mockReturnValueOnce({
        kind: "capability-rag-overview",
        title: "OpenClaw RAG capability overview",
        summary: "Inspect local OpenClaw RAG package foundations before retrying the failed skill-assisted document query.",
        auditSummary: "Local assistant planned an OpenClaw RAG capability overview.",
        auditDetail: "Readonly capability catalog task: rag"
      });
    executeAssistantTaskMock
      .mockRejectedValueOnce(
        new Error(
          "Local RAG search failed in assistantTaskService. Query: use the enabled docs skill to summarize the pptx docx md workspace docs. Underlying error: document parsers for pptx/docx/md are unavailable. Next step: verify the local RAG index, document parsers for pptx/docx/md, workspace root discovery, and retry with a narrower document query before continuing."
        )
      )
      .mockResolvedValueOnce({
        resultTitle: "OpenClaw RAG capability overview",
        resultSummary: "RAG capability self-check completed. Skill-assisted retrieval can retry after parser/index diagnostics."
      });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });
    expectWorkbenchReady();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "use the enabled docs skill to summarize the pptx docx md workspace docs" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findAllByText(/本地 RAG 检索失败/)).not.toHaveLength(0);
    expect(await screen.findAllByText(/请先检查本地 RAG 索引、pptx\/docx\/md 解析器和工作区根目录，再缩小文档范围重试。/)).not.toHaveLength(0);
    expect(screen.queryByText(/Local task execution failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/document parsers for pptx\/docx\/md are unavailable/i)).not.toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole("button", { name: /重试本地任务/i }))[0] as HTMLButtonElement);

    expect(await screen.findAllByText(/RAG capability self-check completed/i)).not.toHaveLength(0);
    expect(planAssistantTaskMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("inspect local OpenClaw RAG capability wiring"),
      "readonly"
    );
    expect(executeAssistantTaskMock).toHaveBeenCalledTimes(2);
    expect(executeAssistantTaskMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ kind: "capability-rag-overview" }),
      expect.any(Object)
    );
  });

  it("stops retrying a failed local RAG search when the readonly RAG self-check planner returns a gated action", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock
      .mockReturnValueOnce({
        kind: "rag-local-doc-search",
        title: "Local RAG document search",
        summary: "summarize the long pptx docx and md documents in this workspace",
        auditSummary: "Local assistant planned a local RAG document search.",
        auditDetail: "Readonly local RAG search task."
      })
      .mockReturnValueOnce({
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Incorrectly requests workspace-write before inspecting RAG capability wiring.",
        riskSummary: "This should not happen during readonly RAG retry self-check.",
        queuedExecutionKind: "workspace-write-create-temp-output",
        queuedExecutionTitle: "Create temp-output directory",
        queuedExecutionAuditSummary: "Local assistant incorrectly planned a workspace-write retry.",
        queuedExecutionAuditDetail: "Workspace write shell command task: create temp-output directory",
        queuedMessage: "create a temp-output folder for this workspace"
      });
    executeAssistantTaskMock.mockRejectedValueOnce(
      new Error(
        "Local RAG search failed in assistantTaskService. Query: summarize the long pptx docx and md documents in this workspace. Underlying error: local knowledge index could not be opened. Next step: verify the local RAG index, document parsers for pptx/docx/md, workspace root discovery, and retry with a narrower document query before continuing."
      )
    );

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });
    expectWorkbenchReady();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "summarize the long pptx docx and md documents in this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findAllByText(/本地 RAG 检索失败/)).not.toHaveLength(0);
    expect(await screen.findAllByText(/请先检查本地 RAG 索引、pptx\/docx\/md 解析器和工作区根目录，再缩小文档范围重试。/)).not.toHaveLength(0);
    expect(screen.queryByText(/Local task execution failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/local knowledge index could not be opened/i)).not.toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole("button", { name: /重试本地任务/i }))[0] as HTMLButtonElement);

    expect(await screen.findAllByText(/本地助手规划失败/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_TITLE)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_SUMMARY)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_ACTION)).not.toHaveLength(0);
    expect(screen.queryByText(/RAG retry self-check must stay readonly/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));
    expect(await screen.findAllByText(/RAG retry self-check must stay readonly/i)).not.toHaveLength(0);
    expect(planAssistantTaskMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("inspect local OpenClaw RAG capability wiring"),
      "readonly"
    );
    expect(executeAssistantTaskMock).toHaveBeenCalledTimes(1);
  });

  it("runs a readonly shell self-check before retrying a blocked controlled-full command without snapshots", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock
      .mockReturnValueOnce({
        kind: "confirmation",
        title: "Confirm temp-output removal",
        summary: "Remove temp-output inside the approved workspace.",
        commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
        impact: "Delete temp-output only after explicit confirmation.",
        requiredMode: "controlled-full",
        safetySummary: "Requires rollback snapshot availability before destructive execution.",
        queuedExecutionKind: "controlled-full-remove-temp-output",
        queuedExecutionTitle: "Remove temp-output directory",
        queuedExecutionAuditSummary: "Local assistant planned a controlled-full temp-output removal task.",
        queuedExecutionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
        queuedMessage: "remove the temp-output folder from this workspace"
      })
      .mockReturnValueOnce({
        kind: "readonly-shell-workspace-root",
        title: "Readonly shell diagnostics",
        summary: "Run a readonly shell diagnostic by listing the workspace root before retrying command execution.",
        auditSummary: "Local assistant planned readonly shell diagnostics.",
        auditDetail: "Readonly shell diagnostics task: workspace root listing"
      });
    executeAssistantTaskMock
      .mockRejectedValueOnce(
        new Error(
          "Shell execution blocked in assistantTaskService. Command id: remove-temp-output-dir. Required permission: controlled-full. Reason: rollback snapshot unavailable. Next step: restore snapshot capability or run a readonly preview before retrying destructive execution."
        )
      )
      .mockResolvedValueOnce({
        resultTitle: "Readonly shell diagnostics",
        resultSummary:
          "Self-check report: shell bridge reachable; workspace root accessible; command whitelist accepted workspace-root-list; audit trail retained readonly shell diagnostics."
      });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "remove the temp-output folder from this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    fireEvent.click(await screen.findByRole("button", { name: APPROVE_DANGEROUS_NAME }));

    expect(await screen.findAllByText(/本地任务执行失败/)).not.toHaveLength(0);
    expect(await screen.findAllByText(/请先恢复回退快照能力，或先运行只读预览再重试高风险执行。/)).not.toHaveLength(0);
    expect(screen.queryByText(/Local task execution failed/i)).not.toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole("button", { name: /重试本地任务/i }))[0] as HTMLButtonElement);

    expect(await screen.findAllByText(/Self-check report: shell bridge reachable/i)).not.toHaveLength(0);
    expect(planAssistantTaskMock).toHaveBeenNthCalledWith(
      2,
      "restore snapshot capability or run a readonly preview before retrying destructive execution.",
      "readonly"
    );
    expect(executeAssistantTaskMock).toHaveBeenCalledTimes(2);
    expect(executeAssistantTaskMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ kind: "readonly-shell-workspace-root" }),
      expect.any(Object)
    );
  });

  it("stops retrying a failed workspace-write shell command when the readonly self-check planner fails", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock
      .mockReturnValueOnce({
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before creating temp-output.",
        riskSummary: "Allow the fixed workspace-local temp-output creation command only after user approval.",
        queuedExecutionKind: "workspace-write-create-temp-output",
        queuedExecutionTitle: "Create temp-output directory",
        queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output creation command.",
        queuedExecutionAuditDetail: "Workspace write shell command task: create temp-output directory",
        queuedMessage: "create a temp-output folder for this workspace"
      })
      .mockImplementationOnce(() => {
        throw new Error("Readonly shell self-check planner route is unavailable.");
      });
    executeAssistantTaskMock.mockRejectedValueOnce(
      new Error(
        "Shell execution failed in assistantTaskService. Command id: create-temp-output-dir. Required permission: workspace-write. Underlying error: Tauri workspace_write_command failed: access denied. Next step: verify the permission approval, workspace root, command whitelist, and audit trail before retrying."
      )
    );

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "create a temp-output folder for this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    fireEvent.click(await screen.findByRole("button", { name: APPROVE_PERMISSION_NAME }));

    expect(await screen.findAllByText(/本地任务执行失败/)).not.toHaveLength(0);
    expect(screen.queryByText(/Local task execution failed/i)).not.toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole("button", { name: /重试本地任务/i }))[0] as HTMLButtonElement);

    expect(await screen.findAllByText(/本地助手规划失败/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_TITLE)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_SUMMARY)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_ACTION)).not.toHaveLength(0);
    expect(screen.queryByText(/Readonly shell self-check planner route is unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));
    expect(await screen.findAllByText(/Readonly shell self-check planner route is unavailable/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/local_task_retry_self_check_planner/i)).not.toHaveLength(0);
    expect(planAssistantTaskMock).toHaveBeenNthCalledWith(
      2,
      "verify the permission approval, workspace root, command whitelist, and audit trail before retrying.",
      "readonly"
    );
    expect(executeAssistantTaskMock).toHaveBeenCalledTimes(1);
  });

  it("stops retrying when the readonly self-check planner returns a mutating task kind", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock
      .mockReturnValueOnce({
        kind: "permission-request",
        targetMode: "workspace-write",
        reason: "Workspace write permission is required before creating temp-output.",
        riskSummary: "Allow the fixed workspace-local temp-output creation command only after user approval.",
        queuedExecutionKind: "workspace-write-create-temp-output",
        queuedExecutionTitle: "Create temp-output directory",
        queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output creation command.",
        queuedExecutionAuditDetail: "Workspace write shell command task: create temp-output directory",
        queuedMessage: "create a temp-output folder for this workspace"
      })
      .mockReturnValueOnce({
        kind: "workspace-write-create-temp-output",
        title: "Create temp-output directory",
        summary: "Create temp-output instead of running readonly diagnostics.",
        auditSummary: "Local assistant incorrectly planned a workspace-write retry.",
        auditDetail: "Workspace write shell command task: create temp-output directory"
      });
    executeAssistantTaskMock.mockRejectedValueOnce(
      new Error(
        "Shell execution failed in assistantTaskService. Command id: create-temp-output-dir. Required permission: workspace-write. Underlying error: Tauri workspace_write_command failed: access denied. Next step: verify the permission approval, workspace root, command whitelist, and audit trail before retrying."
      )
    );

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "create a temp-output folder for this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    fireEvent.click(await screen.findByRole("button", { name: APPROVE_PERMISSION_NAME }));

    expect(await screen.findAllByText(/本地任务执行失败/)).not.toHaveLength(0);
    expect(screen.queryByText(/Local task execution failed/i)).not.toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole("button", { name: /重试本地任务/i }))[0] as HTMLButtonElement);

    expect(await screen.findAllByText(/本地助手规划失败/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_TITLE)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_SUMMARY)).not.toHaveLength(0);
    expect(await screen.findAllByText(PLANNING_FAILURE_ACTION)).not.toHaveLength(0);
    expect(screen.queryByText(/Shell retry self-check must return a readonly shell diagnostic task/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));
    expect(
      await screen.findAllByText(/Shell retry self-check must return a readonly shell diagnostic task/i)
    ).not.toHaveLength(0);
    expect(planAssistantTaskMock).toHaveBeenNthCalledWith(
      2,
      "verify the permission approval, workspace root, command whitelist, and audit trail before retrying.",
      "readonly"
    );
    expect(executeAssistantTaskMock).toHaveBeenCalledTimes(1);
  });

  it("skips a duplicate queued request and tells the user why instead of enqueuing it again", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "workspace-overview",
      title: "Workspace overview",
      summary: "Inspect the current workspace",
      auditSummary: "Local assistant planned a workspace overview task.",
      auditDetail: "Readonly workspace overview task."
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "scan local mcp plugins" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "scan local mcp plugins" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findAllByText(/重复任务已跳过/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/已有相同任务正在排队或执行，已跳过这次重复提交。/i)).not.toHaveLength(0);
    expect(screen.queryByText(/已有相同任务正在排队或执行：scan local mcp plugins/i)).not.toBeInTheDocument();
    expandInspectorRecords();
    fireEvent.click(screen.getByRole("button", { name: "展开日志细节" }));
    expect(await screen.findAllByText(/Existing task status: queued/i)).not.toHaveLength(0);
    expect(await screen.findAllByText(/待处理 1 条/i)).not.toHaveLength(0);
  });

  it("skips resubmitting the same failed request until the user explicitly retries or changes the request", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "workspace-overview",
      title: "Workspace overview",
      summary: "Inspect the current workspace",
      auditSummary: "Local assistant planned a workspace overview task.",
      auditDetail: "Readonly workspace overview task."
    });
    executeAssistantTaskMock.mockRejectedValue(
      new Error("Workspace overview failed because a required local dependency could not be loaded.")
    );

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect the workspace and keep going" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(
      await screen.findAllByText(/Workspace overview failed because a required local dependency could not be loaded\./i)
    ).not.toHaveLength(0);

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "inspect the workspace and keep going" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findAllByText(/重复任务已跳过|inspect the workspace and keep going/i)).not.toHaveLength(0);
    expect(executeAssistantTaskMock).toHaveBeenCalledTimes(1);
  });

  it("shows visible guidance when the same permission request is submitted while approval is pending", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "permission-request",
      targetMode: "workspace-write",
      reason: "Need workspace write access before creating temp-output.",
      riskSummary: "Allow write actions inside the approved workspace only.",
      queuedExecutionKind: "workspace-write-create-temp-output",
      queuedExecutionTitle: "Create temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output directory task.",
      queuedExecutionAuditDetail: "Workspace-write shell command task: create temp-output directory",
      queuedMessage: "create a temp-output folder for this workspace"
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "create a temp-output folder for this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByRole("button", { name: APPROVE_PERMISSION_NAME })).toBeInTheDocument();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "create a temp-output folder for this workspace" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findAllByText("重复审批请求已跳过")).not.toHaveLength(0);
    expect(screen.queryByText(/Duplicate pending approval request skipped/i)).not.toBeInTheDocument();
    expect(await screen.findAllByText("已有权限审批正在等待处理，已跳过这次重复请求。")).not.toHaveLength(0);
    expect(screen.queryByText(/already waiting for permission approval/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "展开回退记录" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /预览回退到重复审批请求已跳过/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "回退到这条消息之前" })).toHaveLength(1);
    expect(planAssistantTaskMock).toHaveBeenCalledTimes(1);
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
  });

  it("shows visible guidance when the same dangerous confirmation request is submitted while confirmation is pending", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    planAssistantTaskMock.mockReturnValue({
      kind: "confirmation",
      title: "Confirm temp-output cleanup",
      summary: "Remove the temp-output directory only after explicit confirmation.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Deletes the workspace-local temp-output directory.",
      requiredMode: "controlled-full",
      safetySummary: "A destructive cleanup requires explicit confirmation.",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a controlled-full temp-output cleanup task.",
      queuedExecutionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
      queuedMessage: "remove the temp-output folder"
    });

    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "remove the temp-output folder" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findByRole("button", { name: APPROVE_DANGEROUS_NAME })).toBeInTheDocument();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "remove the temp-output folder" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(await screen.findAllByText("重复审批请求已跳过")).not.toHaveLength(0);
    expect(screen.queryByText(/Duplicate pending approval request skipped/i)).not.toBeInTheDocument();
    expect(await screen.findAllByText("已有高风险确认正在等待处理，已跳过这次重复请求。")).not.toHaveLength(0);
    expect(screen.queryByText(/already waiting for dangerous confirmation/i)).not.toBeInTheDocument();
    expect(planAssistantTaskMock).toHaveBeenCalledTimes(1);
    expect(executeAssistantTaskMock).not.toHaveBeenCalled();
  });
});
