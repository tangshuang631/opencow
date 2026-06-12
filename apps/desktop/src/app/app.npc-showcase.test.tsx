import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const {
  loadOllamaOverviewMock,
  chatWithOllamaModelMock,
  runWorkspaceProjectMock,
  captureNpcLocalProjectScreenshotMock,
  writeNpcLocalProjectShowcaseSiteMock,
  loadNpcLocalProjectShowcasePublishPreviewMock,
  loadNpcLocalProjectShowcaseGitConfirmationPreviewMock
} = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn(),
  chatWithOllamaModelMock: vi.fn(),
  runWorkspaceProjectMock: vi.fn(),
  captureNpcLocalProjectScreenshotMock: vi.fn(),
  writeNpcLocalProjectShowcaseSiteMock: vi.fn(),
  loadNpcLocalProjectShowcasePublishPreviewMock: vi.fn(),
  loadNpcLocalProjectShowcaseGitConfirmationPreviewMock: vi.fn()
}));

vi.mock("../features/ollama/ollamaService", () => ({
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
    captureNpcLocalProjectScreenshot: captureNpcLocalProjectScreenshotMock,
    writeNpcLocalProjectShowcaseSite: writeNpcLocalProjectShowcaseSiteMock,
    loadNpcLocalProjectShowcasePublishPreview: loadNpcLocalProjectShowcasePublishPreviewMock,
    loadNpcLocalProjectShowcaseGitConfirmationPreview: loadNpcLocalProjectShowcaseGitConfirmationPreviewMock
  };
});

const SELECTED_LOCAL_MODEL_NAME = "\u9009\u62e9\u6a21\u578b\uff1aqwen2.5-coder:7b";

async function waitForSelectedLocalModel() {
  await screen.findByRole("button", { name: SELECTED_LOCAL_MODEL_NAME });
}

describe("App npc local run flow", () => {
  beforeEach(() => {
    loadOllamaOverviewMock.mockReset();
    chatWithOllamaModelMock.mockReset();
    runWorkspaceProjectMock.mockReset();
    captureNpcLocalProjectScreenshotMock.mockReset();
    writeNpcLocalProjectShowcaseSiteMock.mockReset();
    loadNpcLocalProjectShowcasePublishPreviewMock.mockReset();
    loadNpcLocalProjectShowcaseGitConfirmationPreviewMock.mockReset();
  });

  it("continues from npc showcase run permission approval into the final run result", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    runWorkspaceProjectMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "projects/cattle",
      command_label: "npm run dev",
      working_directory: "projects/cattle",
      expected_url: "http://127.0.0.1:3000",
      pid: 5252,
      stdout_preview: "cattle dev server started",
      summary: "Workspace project run started successfully and returned a live local process handle."
    });

    const { container } = render(<App />);

    await waitForSelectedLocalModel();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "use npc collaboration to run the matched cattle project now" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const approvePermissionButton = await screen.findByRole("button", { name: "批准提权" });
    const permissionSection = approvePermissionButton.closest("section");

    expect(permissionSection).not.toBeNull();
    expect(within(permissionSection as HTMLElement).getByText(/待切换权限: 工作区读写/i)).toBeInTheDocument();

    fireEvent.click(approvePermissionButton);

    await waitFor(() => {
      expect(
        screen.getAllByText(/NPC local project run|cattle|projects\/cattle|npm run dev|http:\/\/127\.0\.0\.1:3000|5252/i)
          .length
      ).toBeGreaterThan(0);
    });
  });

  it("continues from npc screenshot permission approval into the final screenshot result", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    captureNpcLocalProjectScreenshotMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "apps/cattle",
      expected_url: "http://127.0.0.1:3000",
      artifact_path: ".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png",
      artifact_directory: ".opencow/artifacts/npc-showcase",
      capture_target: "http://127.0.0.1:3000",
      summary: "NPC local project screenshot capture completed successfully and wrote a workspace-local artifact."
    });

    const { container } = render(<App />);

    await waitForSelectedLocalModel();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "use npc collaboration to capture a screenshot from the matched cattle project now" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const approvePermissionButton = await screen.findByRole("button", { name: "批准提权" });
    const permissionSection = approvePermissionButton.closest("section");

    expect(permissionSection).not.toBeNull();
    expect(within(permissionSection as HTMLElement).getByText(/待切换权限: 工作区读写/i)).toBeInTheDocument();

    fireEvent.click(approvePermissionButton);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          /NPC local project screenshot capture|cattle|apps\/cattle|http:\/\/127\.0\.0\.1:3000|\.opencow\/artifacts\/npc-showcase/i
        ).length
      ).toBeGreaterThan(0);
    });
  });

  it("continues from npc showcase-site permission approval into the final changed-file result", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    writeNpcLocalProjectShowcaseSiteMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "apps/cattle",
      site_root: ".opencow/artifacts/npc-showcase/sites/cattle",
      entry_file: ".opencow/artifacts/npc-showcase/sites/cattle/index.html",
      changed_paths: [".opencow/artifacts/npc-showcase/sites/cattle/index.html"],
      source_screenshot_path: ".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png",
      summary: "NPC local project showcase-site write completed successfully and returned a changed-file summary."
    });

    const { container } = render(<App />);

    await waitForSelectedLocalModel();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "use npc collaboration to generate the showcase site for the matched cattle project now" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const approvePermissionButton = await screen.findByRole("button", { name: "批准提权" });
    const permissionSection = approvePermissionButton.closest("section");

    expect(permissionSection).not.toBeNull();
    expect(within(permissionSection as HTMLElement).getByText(/待切换权限: 工作区读写/i)).toBeInTheDocument();

    fireEvent.click(approvePermissionButton);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          /NPC local project showcase-site write|cattle|apps\/cattle|\.opencow\/artifacts\/npc-showcase\/sites\/cattle|index\.html/i
      ).length
      ).toBeGreaterThan(0);
    });
  });

  it("continues from readonly npc showcase publish-preview into the final result", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadNpcLocalProjectShowcasePublishPreviewMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "apps/cattle",
      site_root: ".opencow/artifacts/npc-showcase/sites/cattle",
      entry_file: ".opencow/artifacts/npc-showcase/sites/cattle/index.html",
      changed_paths: [".opencow/artifacts/npc-showcase/sites/cattle/index.html"],
      source_screenshot_path: ".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png",
      next_git_step: "Git commit or push is still separate and requires its own explicit confirmation stage.",
      summary: "NPC local project showcase publish-preview loaded the latest generated showcase outputs without entering git."
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message: "这是 cattle 项目的展示发布预览：站点产物已经在 .opencow/artifacts/npc-showcase/sites/cattle，下一步 Git commit 或 push 仍然需要单独确认，本轮没有执行提交或推送。"
    });

    const { container } = render(<App />);

    await waitForSelectedLocalModel();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "use npc collaboration to preview the generated showcase output for the matched cattle project before git" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    await waitFor(() => {
      expect(
        screen.queryByText(
          /Workspace write permission is required before NPC collaboration can/i
        )
      ).toBeNull();
    });

    const conversation = screen.getByRole("region", { name: "会话" });

    await waitFor(() => {
      expect(within(conversation).getByText("NPC 展示发布预览说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/本轮没有执行提交或推送/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen2.5-coder:7b",
      message: expect.stringContaining("Git commit or push is still separate")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("为什么本轮没有进入提交或推送")
    }));
  });

  it("continues from readonly npc showcase git confirmation preview into the final result without permission prompts", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadNpcLocalProjectShowcaseGitConfirmationPreviewMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "apps/cattle",
      site_root: ".opencow/artifacts/npc-showcase/sites/cattle",
      entry_file: ".opencow/artifacts/npc-showcase/sites/cattle/index.html",
      changed_paths: [".opencow/artifacts/npc-showcase/sites/cattle/index.html"],
      source_screenshot_path: ".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png",
      recommended_git_action: "commit",
      required_confirmation_stage: "Git commit or push still requires its own explicit confirmation and execution stage.",
      summary: "NPC local project showcase git confirmation preview summarized the current showcase-related changes without executing git."
    });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message: "这是 cattle 展示站点的 Git 确认预览：推荐动作是 commit，但还没有执行 git；继续前必须由用户显式确认提交或推送范围。"
    });

    const { container } = render(<App />);

    await waitForSelectedLocalModel();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "use npc collaboration to prepare the showcase changes for commit for the matched cattle project" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    await waitFor(() => {
      expect(
        screen.queryByText(
          /Workspace write permission is required before NPC collaboration can|需要权限|dangerous confirmation/i
        )
      ).toBeNull();
    });

    const conversation = screen.getByRole("region", { name: "会话" });

    await waitFor(() => {
      expect(within(conversation).getByText("NPC Git 确认预览说明")).toBeInTheDocument();
      expect(within(conversation).getByText(/还没有执行 git/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen2.5-coder:7b",
      message: expect.stringContaining("explicit confirmation")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("为什么还没有执行 commit/push")
    }));
  });
});
