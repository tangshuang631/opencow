import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const { loadOllamaOverviewMock, runWorkspaceProjectMock, captureNpcLocalProjectScreenshotMock } = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn(),
  runWorkspaceProjectMock: vi.fn(),
  captureNpcLocalProjectScreenshotMock: vi.fn()
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
    captureNpcLocalProjectScreenshot: captureNpcLocalProjectScreenshotMock
  };
});

describe("App npc local run flow", () => {
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

    await screen.findAllByText("qwen2.5-coder:7b");

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "use npc collaboration to run the matched cattle project now" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const permissionReasonMatches = await screen.findAllByText(
      /Workspace write permission is required before NPC collaboration can launch the matched local project\./i
    );
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    expect(permissionSection).not.toBeNull();
    expect(within(permissionSection as HTMLElement).getByText(/workspace-write/i)).toBeInTheDocument();

    fireEvent.click(within(permissionSection as HTMLElement).getAllByRole("button")[0]);

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

    await screen.findAllByText("qwen2.5-coder:7b");

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "use npc collaboration to capture a screenshot from the matched cattle project now" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const permissionReasonMatches = await screen.findAllByText(
      /Workspace write permission is required before NPC collaboration can capture a screenshot from the matched local project\./i
    );
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    expect(permissionSection).not.toBeNull();
    expect(within(permissionSection as HTMLElement).getByText(/workspace-write/i)).toBeInTheDocument();

    fireEvent.click(within(permissionSection as HTMLElement).getAllByRole("button")[0]);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          /NPC local project screenshot capture|cattle|apps\/cattle|http:\/\/127\.0\.0\.1:3000|\.opencow\/artifacts\/npc-showcase/i
        ).length
      ).toBeGreaterThan(0);
    });
  });
});
