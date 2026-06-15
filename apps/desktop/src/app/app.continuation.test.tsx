import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

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

const INSPECTOR_PANEL_NAME = "\u53f3\u4fa7\u9762\u677f";
const PERMISSION_HEADING_NAME = "\u6743\u9650\u786e\u8ba4";
const APPROVE_PERMISSION_NAME = "\u6279\u51c6\u63d0\u6743";
const APPROVE_DANGER_NAME = "\u6279\u51c6\u9ad8\u98ce\u9669\u64cd\u4f5c";
const CANCEL_DANGER_NAME = "\u53d6\u6d88\u9ad8\u98ce\u9669\u64cd\u4f5c";
const SELECTED_LOCAL_MODEL_NAME = "\u9009\u62e9\u6a21\u578b\uff1aqwen2.5-coder:7b";

async function waitForSelectedLocalModel() {
  await screen.findByRole("button", { name: SELECTED_LOCAL_MODEL_NAME });
}

describe("App continuation flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    cancelOllamaChatMock.mockReset();
    chatWithOllamaModelMock.mockReset();
    loadOllamaOverviewMock.mockReset();
    chatWithOllamaModelMock.mockRejectedValue(new Error("local model explanation disabled in this test"));
  });

  it("continues from the latest local RAG shell handoff plan wording without repeating the full request", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    const { container } = render(<App />);

    await waitForSelectedLocalModel();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: {
        value: "review local shell permission rules and plan the next safe shell step to create a temp-output folder"
      }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect((await screen.findAllByText(/Local RAG shell handoff preview/)).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(
        screen.getAllByText(/04-permission-safety-shell\.md|OPENCOW_CORE_RULES\.md|New-Item|workspace-write/i).length
      ).toBeGreaterThan(0);
    });
    chatWithOllamaModelMock.mockClear();
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen2.5-coder:7b",
      message:
        "本地 RAG 只提供了权限规则依据；temp-output 是在你批准工作区读写后由受控 shell runner 创建，命令只作用于工作区内目录。"
    });

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "continue" }
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
      expect(within(permissionSection as HTMLElement).queryByRole("button", { name: APPROVE_PERMISSION_NAME })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getAllByText("RAG 交接创建结果说明").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/本地 RAG 只提供了权限规则依据/).length).toBeGreaterThan(0);
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      requestId: expect.stringMatching(/^rag-local-shell-create-temp-output-explanation-/),
      message: expect.stringContaining("本地 RAG 只提供规则依据和交接计划")
    }));
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("New-Item -ItemType Directory -Force temp-output")
    }));
    expect(screen.queryByText(/Workspace write shell command completed successfully/)).not.toBeInTheDocument();
  });

  it("continues from the latest local RAG shell handoff preview without repeating the full request", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    const { container } = render(<App />);

    await waitForSelectedLocalModel();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: {
        value: "review local shell permission rules and preview the next safe shell step to create a temp-output folder"
      }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect((await screen.findAllByText(/Local RAG shell handoff preview/)).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(
        screen.getAllByText(/04-permission-safety-shell\.md|OPENCOW_CORE_RULES\.md|New-Item|workspace-write/i).length
      ).toBeGreaterThan(0);
    });

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "continue" }
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
      expect(within(permissionSection as HTMLElement).queryByRole("button", { name: APPROVE_PERMISSION_NAME })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(
        screen.getAllByText(/04-permission-safety-shell\.md|temp-output|Local RAG handoff temp-output creation/i).length
      ).toBeGreaterThan(0);
    });
  });

  it("does not reuse a cancelled permission continuation when the user sends continue again", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    const { container } = render(<App />);

    await waitForSelectedLocalModel();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: {
        value: "review local shell permission rules and preview the next safe shell step to create a temp-output folder"
      }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect((await screen.findAllByText(/Local RAG shell handoff preview/)).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(
        screen.getAllByText(/04-permission-safety-shell\.md|OPENCOW_CORE_RULES\.md|New-Item|workspace-write/i).length
      ).toBeGreaterThan(0);
    });

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "continue" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const inspectorPanel = screen.getByRole("complementary", { name: INSPECTOR_PANEL_NAME });
    const permissionSection = within(inspectorPanel).getByRole("heading", { name: PERMISSION_HEADING_NAME }).closest("section");

    expect(permissionSection).not.toBeNull();
    const cancelPermissionButton = await within(permissionSection as HTMLElement).findByRole("button", {
      name: "\u53d6\u6d88\u63d0\u6743"
    });
    fireEvent.click(cancelPermissionButton);

    await waitFor(() => {
      expect(within(permissionSection as HTMLElement).queryByRole("button", { name: APPROVE_PERMISSION_NAME })).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/temp-output created/i)).not.toBeInTheDocument();

    const conversation = container.querySelector(".conversation");
    expect(conversation).not.toBeNull();
    expect(within(conversation as HTMLElement).getByText("权限升级已取消，当前权限保持不变。")).toBeInTheDocument();
    expect(within(conversation as HTMLElement).queryByText(/Permission mode was not changed/i)).not.toBeInTheDocument();
    expect(within(conversation as HTMLElement).queryByText(/send a narrower request/i)).not.toBeInTheDocument();
    expect(within(conversation as HTMLElement).queryByText(/ask again with explicit permission intent/i)).not.toBeInTheDocument();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "continue" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getAllByText(/continue/i).length).toBeGreaterThan(0);
    });

    expect(within(permissionSection as HTMLElement).queryByRole("button", { name: APPROVE_PERMISSION_NAME })).not.toBeInTheDocument();
    expect(screen.queryByText(/temp-output created/i)).not.toBeInTheDocument();
  });

  it("continues from the latest npc-assisted RAG shell handoff preview without repeating the full request", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    const { container } = render(<App />);

    await waitForSelectedLocalModel();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: {
        value: "use npc collaboration to review local shell permission rules and preview the next safe shell step to create a temp-output folder"
      }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect((await screen.findAllByText(/NPC-assisted RAG shell handoff preview/)).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(
        screen.getAllByText(/docs-helper|04-permission-safety-shell\.md|OPENCOW_CORE_RULES\.md|New-Item|workspace-write/i).length
      ).toBeGreaterThan(0);
    });

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "continue" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const inspectorPanel = screen.getByRole("complementary", { name: INSPECTOR_PANEL_NAME });
    const permissionSection = within(inspectorPanel).getByRole("heading", { name: PERMISSION_HEADING_NAME }).closest("section");

    expect(permissionSection).not.toBeNull();
    const approvePermissionButton = await within(permissionSection as HTMLElement).findByRole("button", {
      name: APPROVE_PERMISSION_NAME
    });
    fireEvent.click(approvePermissionButton);

    await waitFor(() => {
      expect(within(permissionSection as HTMLElement).queryByRole("button", { name: APPROVE_PERMISSION_NAME })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(
        screen.getAllByText(/docs-helper|04-permission-safety-shell\.md|temp-output|NPC-assisted RAG handoff temp-output creation/i).length
      ).toBeGreaterThan(0);
    });
  });

  it("continues from the latest skill-assisted RAG shell handoff preview without repeating the full request", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    const { container } = render(<App />);

    await waitForSelectedLocalModel();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: {
        value: "use the enabled docs skill to review local shell permission rules and preview the next safe shell step to create a temp-output folder"
      }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect((await screen.findAllByText(/Skill-assisted RAG shell handoff preview/)).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(
        screen.getAllByText(/docs-helper|04-permission-safety-shell\.md|OPENCOW_CORE_RULES\.md|New-Item|workspace-write/i).length
      ).toBeGreaterThan(0);
    });

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "continue" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const inspectorPanel = screen.getByRole("complementary", { name: INSPECTOR_PANEL_NAME });
    const permissionSection = within(inspectorPanel).getByRole("heading", { name: PERMISSION_HEADING_NAME }).closest("section");

    expect(permissionSection).not.toBeNull();
    const approvePermissionButton = await within(permissionSection as HTMLElement).findByRole("button", {
      name: APPROVE_PERMISSION_NAME
    });
    fireEvent.click(approvePermissionButton);

    await waitFor(() => {
      expect(within(permissionSection as HTMLElement).queryByRole("button", { name: APPROVE_PERMISSION_NAME })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(
        screen.getAllByText(/docs-helper|04-permission-safety-shell\.md|temp-output|Skill-assisted RAG handoff temp-output creation/i).length
      ).toBeGreaterThan(0);
    });
  });

  it("continues from the latest npc-assisted destructive RAG shell handoff preview into dangerous confirmation", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    const { container } = render(<App />);

    await waitForSelectedLocalModel();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: {
        value: "use npc collaboration to review local shell permission rules and preview the next safe shell step to delete temp-output"
      }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect((await screen.findAllByText(/NPC-assisted RAG shell handoff preview/)).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(
        screen.getAllByText(/docs-helper|04-permission-safety-shell\.md|OPENCOW_CORE_RULES\.md|Remove-Item|controlled-full/i).length
      ).toBeGreaterThan(0);
    });

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "continue" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const inspectorPanel = screen.getByRole("complementary", { name: INSPECTOR_PANEL_NAME });
    const permissionSection = within(inspectorPanel).getByRole("heading", { name: PERMISSION_HEADING_NAME }).closest("section");

    expect(permissionSection).not.toBeNull();
    const approvePermissionButton = await within(permissionSection as HTMLElement).findByRole("button", {
      name: APPROVE_PERMISSION_NAME
    });
    fireEvent.click(approvePermissionButton);

    const approveDangerButton = await within(permissionSection as HTMLElement).findByRole("button", {
      name: APPROVE_DANGER_NAME
    });
    expect(screen.queryByText(/temp-output removed/i)).not.toBeInTheDocument();

    fireEvent.click(approveDangerButton);

    await waitFor(() => {
      expect(
        screen.getAllByText(/docs-helper|04-permission-safety-shell\.md|temp-output removed|NPC-assisted RAG handoff temp-output removal/i).length
      ).toBeGreaterThan(0);
    });
  });

  it("does not reuse a cancelled dangerous continuation when the user sends continue again", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    const { container } = render(<App />);

    await waitForSelectedLocalModel();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: {
        value: "use npc collaboration to review local shell permission rules and preview the next safe shell step to delete temp-output"
      }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect((await screen.findAllByText(/NPC-assisted RAG shell handoff preview/)).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(
        screen.getAllByText(/docs-helper|04-permission-safety-shell\.md|OPENCOW_CORE_RULES\.md|Remove-Item|controlled-full/i).length
      ).toBeGreaterThan(0);
    });

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "continue" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const inspectorPanel = screen.getByRole("complementary", { name: INSPECTOR_PANEL_NAME });
    const permissionSection = within(inspectorPanel).getByRole("heading", { name: PERMISSION_HEADING_NAME }).closest("section");

    expect(permissionSection).not.toBeNull();
    const approvePermissionButton = await within(permissionSection as HTMLElement).findByRole("button", {
      name: APPROVE_PERMISSION_NAME
    });
    fireEvent.click(approvePermissionButton);

    const cancelDangerButton = await within(permissionSection as HTMLElement).findByRole("button", {
      name: CANCEL_DANGER_NAME
    });
    fireEvent.click(cancelDangerButton);

    await waitFor(() => {
      expect(within(permissionSection as HTMLElement).queryByRole("button", { name: CANCEL_DANGER_NAME })).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/temp-output removed/i)).not.toBeInTheDocument();

    const conversation = container.querySelector(".conversation");
    expect(conversation).not.toBeNull();
    expect(within(conversation as HTMLElement).getByText("高风险操作已取消，没有执行命令。")).toBeInTheDocument();
    expect(within(conversation as HTMLElement).queryByText(/No command was executed/i)).not.toBeInTheDocument();
    expect(within(conversation as HTMLElement).queryByText(/rewrite the request/i)).not.toBeInTheDocument();
    expect(within(conversation as HTMLElement).queryByText(/preview the safe step again/i)).not.toBeInTheDocument();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "continue" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getAllByText(/continue/i).length).toBeGreaterThan(0);
    });

    expect(within(permissionSection as HTMLElement).queryByRole("button", { name: APPROVE_DANGER_NAME })).not.toBeInTheDocument();
    expect(within(permissionSection as HTMLElement).queryByRole("button", { name: CANCEL_DANGER_NAME })).not.toBeInTheDocument();
    expect(screen.queryByText(/temp-output removed/i)).not.toBeInTheDocument();
  });

  it("continues from the latest skill-assisted destructive RAG shell handoff preview into dangerous confirmation", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    const { container } = render(<App />);

    await waitForSelectedLocalModel();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: {
        value: "use the enabled docs skill to review local shell permission rules and preview the next safe shell step to delete temp-output"
      }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect((await screen.findAllByText(/Skill-assisted RAG shell handoff preview/)).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(
        screen.getAllByText(/docs-helper|04-permission-safety-shell\.md|OPENCOW_CORE_RULES\.md|Remove-Item|controlled-full/i).length
      ).toBeGreaterThan(0);
    });

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "continue" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const inspectorPanel = screen.getByRole("complementary", { name: INSPECTOR_PANEL_NAME });
    const permissionSection = within(inspectorPanel).getByRole("heading", { name: PERMISSION_HEADING_NAME }).closest("section");

    expect(permissionSection).not.toBeNull();
    const approvePermissionButton = await within(permissionSection as HTMLElement).findByRole("button", {
      name: APPROVE_PERMISSION_NAME
    });
    fireEvent.click(approvePermissionButton);

    const approveDangerButton = await within(permissionSection as HTMLElement).findByRole("button", {
      name: APPROVE_DANGER_NAME
    });
    expect(screen.queryByText(/temp-output removed/i)).not.toBeInTheDocument();

    fireEvent.click(approveDangerButton);

    await waitFor(() => {
      expect(
        screen.getAllByText(/docs-helper|04-permission-safety-shell\.md|temp-output removed|Skill-assisted RAG handoff temp-output removal/i).length
      ).toBeGreaterThan(0);
    });
  });
});
