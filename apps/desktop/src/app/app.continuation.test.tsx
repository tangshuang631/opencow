import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const { loadOllamaOverviewMock } = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn()
}));

vi.mock("../features/ollama/ollamaService", () => ({
  loadOllamaOverview: loadOllamaOverviewMock
}));

const INSPECTOR_PANEL_NAME = "\u53f3\u4fa7\u9762\u677f";
const PERMISSION_HEADING_NAME = "\u6743\u9650\u786e\u8ba4";
const APPROVE_PERMISSION_NAME = "\u6279\u51c6\u63d0\u6743";
const APPROVE_DANGER_NAME = "\u6279\u51c6\u9ad8\u98ce\u9669\u64cd\u4f5c";

describe("App continuation flow", () => {
  it("continues from the latest local RAG shell handoff plan wording without repeating the full request", async () => {
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

  it("continues from the latest local RAG shell handoff preview without repeating the full request", async () => {
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

  it("continues from the latest npc-assisted RAG shell handoff preview without repeating the full request", async () => {
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

    await screen.findAllByText("qwen2.5-coder:7b");

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

    await screen.findAllByText("qwen2.5-coder:7b");

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

  it("continues from the latest skill-assisted destructive RAG shell handoff preview into dangerous confirmation", async () => {
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
