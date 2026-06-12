import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const {
  cancelOllamaChatMock,
  loadOllamaOverviewMock,
  chatWithOllamaModelMock,
  runWorkspaceProjectMock,
  getWorkspaceProjectStatusMock,
  stopWorkspaceProjectMock
} = vi.hoisted(() => ({
  cancelOllamaChatMock: vi.fn(),
  loadOllamaOverviewMock: vi.fn(),
  chatWithOllamaModelMock: vi.fn(),
  runWorkspaceProjectMock: vi.fn(),
  getWorkspaceProjectStatusMock: vi.fn(),
  stopWorkspaceProjectMock: vi.fn()
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
    runWorkspaceProject: runWorkspaceProjectMock,
    getWorkspaceProjectStatus: getWorkspaceProjectStatusMock,
    stopWorkspaceProject: stopWorkspaceProjectMock
  };
});

const INSPECTOR_PANEL_NAME = "右侧面板";
const PERMISSION_HEADING_NAME = "权限确认";
const APPROVE_PERMISSION_NAME = "批准提权";
const SELECTED_LOCAL_MODEL_NAME = "\u9009\u62e9\u6a21\u578b\uff1aqwen2.5-coder:7b";

async function waitForSelectedLocalModel() {
  await screen.findByRole("button", { name: SELECTED_LOCAL_MODEL_NAME });
}

describe("App project run flow", () => {
  beforeEach(() => {
    cancelOllamaChatMock.mockReset();
    loadOllamaOverviewMock.mockReset();
    chatWithOllamaModelMock.mockReset();
    runWorkspaceProjectMock.mockReset();
    getWorkspaceProjectStatusMock.mockReset();
    stopWorkspaceProjectMock.mockReset();
  });

  it("runs a matched local project through permission approval and final assistant output", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    runWorkspaceProjectMock.mockResolvedValueOnce({
      project_name: "desktop",
      project_path: "apps/desktop",
      command_label: "npm run dev",
      working_directory: "apps/desktop",
      expected_url: "http://127.0.0.1:1420",
      pid: 4242,
      stdout_preview: "job:4242",
      summary: "Workspace project run started successfully and returned a live local process handle."
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message:
        "desktop 项目已在批准工作区读写后通过受控项目运行链路启动，命令是 npm run dev，PID 是 4242，预期地址是 http://127.0.0.1:1420；可以继续查看状态或停止它。"
    });

    const { container } = render(<App />);

    await waitForSelectedLocalModel();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "run the desktop app locally" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const inspectorPanel = await screen.findByRole("complementary", { name: INSPECTOR_PANEL_NAME });
    const permissionSection = within(inspectorPanel).getByRole("heading", { name: PERMISSION_HEADING_NAME }).closest("section");

    expect(permissionSection).not.toBeNull();
    expect(within(permissionSection as HTMLElement).getByText(/待切换权限: 工作区读写/i)).toBeInTheDocument();

    const approvePermissionButton = await within(permissionSection as HTMLElement).findByRole("button", {
      name: APPROVE_PERMISSION_NAME
    });
    fireEvent.click(approvePermissionButton);

    const conversation = screen.getByRole("region", { name: "会话" });

    await waitFor(() => {
      expect(within(conversation).getByText("本地项目启动结果说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/desktop 项目已在批准工作区读写后/)).toBeInTheDocument();
    });
    expect(runWorkspaceProjectMock).toHaveBeenCalledTimes(1);
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      requestId: expect.stringMatching(/^workspace-project-run-explanation-/),
      message: expect.stringContaining("用户批准 workspace-write")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("PID: 4242")
    }));
  });

  it("shows the final matched local project status result for an explicit readonly lifecycle request", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    getWorkspaceProjectStatusMock.mockResolvedValueOnce({
      project_name: "desktop",
      project_path: "apps/desktop",
      command_label: "npm run dev",
      working_directory: "apps/desktop",
      expected_url: "http://127.0.0.1:1420",
      pid: 4242,
      status: "running",
      stdout_preview: "pid:4242",
      summary: "Workspace project status found an active local process handle for the matched project."
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message: "desktop 项目的本地运行状态是 running，当前记录的 PID 是 4242，命令是 npm run dev，预期地址是 http://127.0.0.1:1420；这里只是读取状态，没有启动或停止进程。"
    });

    const { container } = render(<App />);

    await waitForSelectedLocalModel();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "show the status of the desktop app local run" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const conversation = screen.getByRole("region", { name: "会话" });

    await waitFor(() => {
      expect(within(conversation).getByText("本地项目状态说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/没有启动或停止进程/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen2.5-coder:7b",
      message: expect.stringContaining("PID: 4242")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("不要暗示已经启动或停止进程")
    }));
  });

  it("continues from matched local project stop permission approval into the final stopped result", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    stopWorkspaceProjectMock.mockResolvedValueOnce({
      project_name: "desktop",
      project_path: "apps/desktop",
      command_label: "npm run dev",
      working_directory: "apps/desktop",
      pid: 4242,
      status: "stopped",
      stdout_preview: "job:4242 stopped",
      summary: "Workspace project stop completed successfully and released the local process handle."
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message:
        "desktop 项目已在批准工作区读写后通过受控项目停止链路停止，PID 4242 已释放，状态是 stopped；这一步没有删除项目文件。"
    });

    const { container } = render(<App />);

    await waitForSelectedLocalModel();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "stop the desktop app local run" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const inspectorPanel = await screen.findByRole("complementary", { name: INSPECTOR_PANEL_NAME });
    const permissionSection = within(inspectorPanel).getByRole("heading", { name: PERMISSION_HEADING_NAME }).closest("section");

    expect(permissionSection).not.toBeNull();
    expect(within(permissionSection as HTMLElement).getByText(/待切换权限: 工作区读写/i)).toBeInTheDocument();

    const approvePermissionButton = await within(permissionSection as HTMLElement).findByRole("button", {
      name: APPROVE_PERMISSION_NAME
    });
    fireEvent.click(approvePermissionButton);

    const conversation = screen.getByRole("region", { name: "会话" });

    await waitFor(() => {
      expect(within(conversation).getByText("本地项目停止结果说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/desktop 项目已在批准工作区读写后/)).toBeInTheDocument();
    });
    expect(stopWorkspaceProjectMock).toHaveBeenCalledTimes(1);
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      requestId: expect.stringMatching(/^workspace-project-stop-explanation-/),
      message: expect.stringContaining("PID: 4242")
    }));
  });

  it("falls back to verified project run facts when post-approval explanation stalls", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    runWorkspaceProjectMock.mockResolvedValueOnce({
      project_name: "desktop",
      project_path: "apps/desktop",
      command_label: "npm run dev",
      working_directory: "apps/desktop",
      expected_url: "http://127.0.0.1:1420",
      pid: 4242,
      stdout_preview: "job:4242",
      summary: "Workspace project run started successfully and returned a live local process handle."
    });
    chatWithOllamaModelMock.mockReturnValueOnce(new Promise(() => undefined));

    const { container } = render(<App />);

    await waitForSelectedLocalModel();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "run the desktop app locally" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const inspectorPanel = await screen.findByRole("complementary", { name: INSPECTOR_PANEL_NAME });
    const permissionSection = within(inspectorPanel).getByRole("heading", { name: PERMISSION_HEADING_NAME }).closest("section");

    expect(permissionSection).not.toBeNull();

    const approvePermissionButton = await within(permissionSection as HTMLElement).findByRole("button", {
      name: APPROVE_PERMISSION_NAME
    });
    fireEvent.click(approvePermissionButton);

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
        requestId: expect.stringMatching(/^workspace-project-run-explanation-/)
      }));
    });

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(within(conversation).getByText("Run matched local project")).toBeInTheDocument();
      expect(within(conversation).getByText(/Workspace project run started successfully/)).toBeInTheDocument();
      expect(within(conversation).getByText(/npm run dev|http:\/\/127\.0\.0\.1:1420|4242/)).toBeInTheDocument();
    }, { timeout: 12_000 });
    expect(screen.queryByText(/本地任务执行失败|Local task execution timed out/i)).not.toBeInTheDocument();
    expect(cancelOllamaChatMock).toHaveBeenCalledWith(expect.stringMatching(/^workspace-project-run-explanation-/));
    expect(runWorkspaceProjectMock).toHaveBeenCalledTimes(1);
  }, 15_000);
});
