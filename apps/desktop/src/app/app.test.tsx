import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const { loadOllamaOverviewMock, enableLocalSkillMock } = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn(),
  enableLocalSkillMock: vi.fn()
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
    enableLocalSkill: enableLocalSkillMock
  };
});

function getComposerInput() {
  return screen.getByLabelText("输入任务");
}

function getComposerSendButton() {
  return screen.getByRole("button", { name: "发送" });
}

function getConversationRegion() {
  return screen.getByRole("region", { name: "会话" });
}

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
    expect(screen.getByRole("main", { name: /opencow/i })).toBeInTheDocument();
    expect(getComposerInput()).toBeInTheDocument();
  });

  it("surfaces a traceable error when loading Ollama overview throws", async () => {
    loadOllamaOverviewMock.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:11434"));

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("connect ECONNREFUSED 127.0.0.1:11434").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/ollama_overview/).length).toBeGreaterThan(0);
  });

  it("submits ordinary chat and shows a user message plus assistant reply without queue noise in the main transcript", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });

    render(<App />);

    await screen.findAllByText("qwen3.6:35b");

    const input = getComposerInput();
    fireEvent.change(input, {
      target: { value: "你能干什么" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = getConversationRegion();

    await waitFor(() => {
      expect(within(conversation).getAllByText("你能干什么").length).toBeGreaterThan(0);
      expect(within(conversation).getByText(/本地助手能力说明|Workspace overview|本地助手答复/)).toBeInTheDocument();
    });

    expect(within(conversation).queryByText(/任务已进入本地队列/)).not.toBeInTheDocument();
    expect(within(conversation).queryByText(/本地任务开始执行/)).not.toBeInTheDocument();
  });

  it("shows a visible assistant pending block while an ordinary chat request is still running", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });

    render(<App />);

    await screen.findAllByText("qwen3.6:35b");

    fireEvent.change(getComposerInput(), {
      target: { value: "你能干什么" }
    });
    fireEvent.click(getComposerSendButton());

    const pending = await screen.findByLabelText("assistant-pending");
    expect(within(pending).getByText("你能干什么")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    });
  }, 10000);

  it("keeps the composer available after an ordinary chat response returns", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });

    render(<App />);

    await screen.findAllByText("qwen3.6:35b");

    fireEvent.change(getComposerInput(), {
      target: { value: "你能干什么" }
    });
    fireEvent.click(getComposerSendButton());

    await waitFor(() => {
      expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    });

    expect(getComposerInput()).toBeEnabled();
    expect(getComposerSendButton()).toBeInTheDocument();
  }, 10000);

  it("continues from skill enable permission approval into the final enabled result", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    enableLocalSkillMock.mockResolvedValueOnce({
      query: "enable the coding-agent skill for this workspace",
      enabled_skill_name: "coding-agent",
      registry_path: ".opencow/skills/enabled-skills.json",
      status: "enabled",
      summary: "Local skill enablement registered coding-agent in the workspace skill registry."
    });

    render(<App />);

    await screen.findAllByText("qwen2.5-coder:7b");

    fireEvent.change(getComposerInput(), {
      target: { value: "enable the coding-agent skill for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    const approvePermissionButton = await screen.findByRole("button", { name: /批准提权/i });
    fireEvent.click(approvePermissionButton);

    await waitFor(() => {
      expect(screen.getAllByText(/Enable local skill|coding-agent|enabled-skills\.json/i).length).toBeGreaterThan(0);
    });
  });
});
