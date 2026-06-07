import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

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
    expect(screen.getAllByText("qwen2.5-coder:7b").length).toBeGreaterThan(0);

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
    expect(screen.getAllByText("qwen2.5-coder:7b").length).toBeGreaterThan(0);

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
      })
    );
  });
});
