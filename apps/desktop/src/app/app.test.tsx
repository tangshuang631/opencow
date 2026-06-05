import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { Inspector } from "../features/workbench/components/Inspector";
import {
  createInitialWorkbenchState,
  createSearchEnabledState,
  createUserTaskSubmittedState
} from "../features/workbench/workbenchState";

const { loadOllamaOverviewMock } = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn()
}));

vi.mock("../features/ollama/ollamaService", () => ({
  loadOllamaOverview: loadOllamaOverviewMock
}));

const inspectorActions = {
  onApproveDangerousAction: vi.fn(),
  onCancelDangerousAction: vi.fn(),
  onApprovePermissionRequest: vi.fn(),
  onCancelPermissionRequest: vi.fn(),
  onPreviewRollback: vi.fn(),
  onApplyRollback: vi.fn(),
  onCancelRollback: vi.fn()
};

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
    expect(screen.getByRole("main", { name: "opencow 工作台" })).toBeInTheDocument();
  });

  it("surfaces a traceable error when loading Ollama overview throws", async () => {
    loadOllamaOverviewMock.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:11434"));

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("connect ECONNREFUSED 127.0.0.1:11434").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/ollama_overview/).length).toBeGreaterThan(0);
    expect(screen.getByText(/无法连接本地 Ollama/)).toBeInTheDocument();
  });

  it("shows search sources and tool results after desktop demo actions", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "模拟联网搜索" }));
    await waitFor(() => {
      expect(screen.getAllByText(/OpenClaw GitHub/).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "模拟工具结果" }));
    expect(screen.getAllByText(/skills_scan|Skill/).length).toBeGreaterThan(0);
  });

  it("submits a local task from the composer into the workbench flow", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    render(<App />);

    await screen.findAllByText("qwen2.5-coder:7b");

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "请检查当前工作区并整理待办" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText(/任务已进入本地队列/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText(/本地任务执行完成|local_task_runner/).length).toBeGreaterThan(0);
    });
  });

  it("shows a traceable local task failure after desktop demo action", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "模拟本地任务失败" }));

    await waitFor(() => {
      expect(screen.getAllByText(/本地任务执行失败/).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/local_task_runner/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ollama 响应超时/).length).toBeGreaterThan(0);
  });

  it("renders queued local tasks in the inspector", () => {
    const state = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "请检查当前工作区并整理待办"
    });

    render(<Inspector state={state} {...inspectorActions} />);

    const taskSection = screen.getByText("本地任务").closest("section");

    expect(taskSection).not.toBeNull();
    expect(within(taskSection as HTMLElement).getByText("待处理 1 条")).toBeInTheDocument();
    expect(within(taskSection as HTMLElement).getByText("队列中")).toBeInTheDocument();
  });

  it("renders multiple search sources in the inspector", () => {
    const searchedOnce = createSearchEnabledState(createInitialWorkbenchState(), {
      provider: "Tavily",
      query: "OpenClaw Windows 本地助手",
      sourceTitle: "OpenClaw GitHub",
      sourceUrl: "https://github.com/example/openclaw",
      summary: "已启用联网搜索，并注入 1 条来源摘要。"
    });
    const searchedTwice = createSearchEnabledState(searchedOnce, {
      provider: "Bocha",
      query: "OpenCow 桌面端",
      sourceTitle: "OpenCow Desktop Spec",
      sourceUrl: "https://example.com/opencow-desktop",
      summary: "已追加 1 条桌面端参考来源。"
    });

    render(<Inspector state={searchedTwice} {...inspectorActions} />);

    const sourceSection = screen.getByText("来源").closest("section");

    expect(sourceSection).not.toBeNull();
    expect(within(sourceSection as HTMLElement).getAllByText(/OpenCow Desktop Spec/).length).toBeGreaterThan(0);
    expect(within(sourceSection as HTMLElement).getAllByText(/OpenClaw GitHub/).length).toBeGreaterThan(0);
  });
});
