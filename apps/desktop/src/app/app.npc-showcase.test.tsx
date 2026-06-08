import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const {
  loadOllamaOverviewMock,
  runWorkspaceProjectMock,
  captureNpcLocalProjectScreenshotMock,
  writeNpcLocalProjectShowcaseSiteMock,
  loadNpcLocalProjectShowcasePublishPreviewMock
} = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn(),
  runWorkspaceProjectMock: vi.fn(),
  captureNpcLocalProjectScreenshotMock: vi.fn(),
  writeNpcLocalProjectShowcaseSiteMock: vi.fn(),
  loadNpcLocalProjectShowcasePublishPreviewMock: vi.fn()
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
    captureNpcLocalProjectScreenshot: captureNpcLocalProjectScreenshotMock,
    writeNpcLocalProjectShowcaseSite: writeNpcLocalProjectShowcaseSiteMock,
    loadNpcLocalProjectShowcasePublishPreview: loadNpcLocalProjectShowcasePublishPreviewMock
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

    await screen.findAllByText("qwen2.5-coder:7b");

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "use npc collaboration to generate the showcase site for the matched cattle project now" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const permissionReasonMatches = await screen.findAllByText(
      /Workspace write permission is required before NPC collaboration can generate the showcase site for the matched local project\./i
    );
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    expect(permissionSection).not.toBeNull();
    expect(within(permissionSection as HTMLElement).getByText(/workspace-write/i)).toBeInTheDocument();

    fireEvent.click(within(permissionSection as HTMLElement).getAllByRole("button")[0]);

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

    const { container } = render(<App />);

    await screen.findAllByText("qwen2.5-coder:7b");

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
        screen.getAllByText(
          /NPC local project showcase publish preview|cattle|apps\/cattle|\.opencow\/artifacts\/npc-showcase\/sites\/cattle|index\.html|Git commit or push is still separate/i
        ).length
      ).toBeGreaterThan(0);
    });
  });
});
