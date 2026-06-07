import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const {
  loadOllamaOverviewMock,
  runWorkspaceProjectMock,
  getWorkspaceProjectStatusMock,
  stopWorkspaceProjectMock
} = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn(),
  runWorkspaceProjectMock: vi.fn(),
  getWorkspaceProjectStatusMock: vi.fn(),
  stopWorkspaceProjectMock: vi.fn()
}));

vi.mock("../features/ollama/ollamaService", () => ({
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

describe("App project run flow", () => {
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

    const { container } = render(<App />);

    await screen.findAllByText("qwen2.5-coder:7b");

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
    expect(within(permissionSection as HTMLElement).getByText(/workspace-write/i)).toBeInTheDocument();

    const approvePermissionButton = await within(permissionSection as HTMLElement).findByRole("button", {
      name: APPROVE_PERMISSION_NAME
    });
    fireEvent.click(approvePermissionButton);

    await waitFor(() => {
      expect(
        screen.getAllByText(/Run matched local project|apps\/desktop|npm run dev|http:\/\/127\.0\.0\.1:1420|4242/i).length
      ).toBeGreaterThan(0);
    });
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

    const { container } = render(<App />);

    await screen.findAllByText("qwen2.5-coder:7b");

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "show the status of the desktop app local run" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    await waitFor(() => {
      expect(
        screen.getAllByText(/Matched local project status|apps\/desktop|npm run dev|http:\/\/127\.0\.0\.1:1420|4242|running/i)
          .length
      ).toBeGreaterThan(0);
    });
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

    const { container } = render(<App />);

    await screen.findAllByText("qwen2.5-coder:7b");

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
    expect(within(permissionSection as HTMLElement).getByText(/workspace-write/i)).toBeInTheDocument();

    const approvePermissionButton = await within(permissionSection as HTMLElement).findByRole("button", {
      name: APPROVE_PERMISSION_NAME
    });
    fireEvent.click(approvePermissionButton);

    await waitFor(() => {
      expect(
        screen.getAllByText(/Stop matched local project|apps\/desktop|npm run dev|4242|stopped|job:4242 stopped/i).length
      ).toBeGreaterThan(0);
    });
  });
});
