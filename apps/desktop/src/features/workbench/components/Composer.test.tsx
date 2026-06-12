import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";
import {
  createInitialWorkbenchState,
  createOllamaLoadErrorState,
  createTaskExecutionStartedState,
  createUserTaskSubmittedState,
  mergeOllamaOverview
} from "../workbenchState";

describe("Composer", () => {
  it("keeps composer status metadata to one concise line", () => {
    const state = createInitialWorkbenchState();

    render(
      <Composer
        state={state}
        onSubmitTask={vi.fn()}
        onCancelActiveTask={vi.fn()}
        onSelectModel={vi.fn()}
      />
    );

    expect(screen.getByText("本地优先 · 只读 · 回退 10/20")).toBeInTheDocument();
    expect(screen.queryByText("llama3.1:8b")).not.toBeInTheDocument();
    expect(screen.queryByText("仅允许读取已授权目录与附件。")).not.toBeInTheDocument();
  });

  it("does not submit blank input", () => {
    const onSubmitTask = vi.fn();
    const state = createInitialWorkbenchState();

    render(
      <Composer
        state={state}
        onSubmitTask={onSubmitTask}
        onCancelActiveTask={vi.fn()}
        onSelectModel={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "   " }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmitTask).not.toHaveBeenCalled();
  });

  it("submits trimmed input once and clears the draft", () => {
    const onSubmitTask = vi.fn();
    const state = createInitialWorkbenchState();

    render(
      <Composer
        state={state}
        onSubmitTask={onSubmitTask}
        onCancelActiveTask={vi.fn()}
        onSelectModel={vi.fn()}
      />
    );

    const textbox = screen.getByRole("textbox", { name: "输入任务" });
    fireEvent.change(textbox, {
      target: { value: "  scan local mcp plugins  " }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmitTask).toHaveBeenCalledTimes(1);
    expect(onSubmitTask).toHaveBeenCalledWith("scan local mcp plugins");
    expect((textbox as HTMLTextAreaElement).value).toBe("");
  });

  it("disables input while a task is running", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "scan local mcp plugins"
    });
    const running = createTaskExecutionStartedState(queued);

    render(
      <Composer
        state={running}
        onSubmitTask={vi.fn()}
        onCancelActiveTask={vi.fn()}
        onSelectModel={vi.fn()}
      />
    );

    expect(screen.getByRole("textbox", { name: "输入任务" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "停止任务" })).toBeInTheDocument();
  });

  it("shows stop controls once an approved NPC config task starts execution", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "你能帮我配置一个文档处理npc吗",
      executionKind: "npc-config-write",
      executionTitle: "大模型生成并保存 NPC 配置",
      executionAuditSummary: "Local assistant planned an LLM-generated NPC configuration write.",
      executionAuditDetail: "LLM-generated NPC configuration write task."
    });
    const running = createTaskExecutionStartedState(queued);

    render(
      <Composer
        state={running}
        onSubmitTask={vi.fn()}
        onCancelActiveTask={vi.fn()}
        onSelectModel={vi.fn()}
      />
    );

    expect(screen.getByRole("textbox", { name: "输入任务" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "停止任务" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "发送" })).not.toBeInTheDocument();
  });

  it("keeps input usable when the active task slot is stale", () => {
    const staleActive = {
      ...createInitialWorkbenchState(),
      tasks: {
        pendingCount: 0,
        activeTaskId: "missing-active-task",
        items: []
      }
    };

    render(
      <Composer
        state={staleActive}
        onSubmitTask={vi.fn()}
        onCancelActiveTask={vi.fn()}
        onSelectModel={vi.fn()}
      />
    );

    expect(screen.getByRole("textbox", { name: "输入任务" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "发送" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "停止任务" })).not.toBeInTheDocument();
  });

  it("opens a Codex-style local model menu and selects an Ollama model", () => {
    const onSelectModel = vi.fn();
    const state = {
      ...createInitialWorkbenchState(),
      model: {
        ...createInitialWorkbenchState().model,
        status: "Ollama 已连接",
        activeModel: "qwen2.5-coder:7b",
        availableModels: [
          { name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" },
          { name: "qwen3.6:35b", sizeLabel: "20 GB" }
        ]
      }
    };

    render(
      <Composer
        state={state}
        onSubmitTask={vi.fn()}
        onCancelActiveTask={vi.fn()}
        onSelectModel={onSelectModel}
      />
    );

    expect(screen.getByRole("button", { name: "选择模型：qwen2.5-coder:7b" })).toBeInTheDocument();
    expect(screen.queryByText("qwen2.5-coder:7b")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "选择模型：qwen2.5-coder:7b" }));

    expect(screen.getByRole("menu", { name: "模型" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "qwen2.5-coder:7b 4.1 GB" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "qwen3.6:35b 20 GB" })).toHaveAttribute("aria-checked", "false");

    fireEvent.click(screen.getByRole("menuitemradio", { name: "qwen3.6:35b 20 GB" }));

    expect(onSelectModel).toHaveBeenCalledWith("qwen3.6:35b");
  });

  it("shows a lightweight setup prompt near the composer when Ollama cannot be reached", () => {
    const onOpenModelSettings = vi.fn();
    const state = createOllamaLoadErrorState(
      createInitialWorkbenchState(),
      "Ollama startup check failed: connection refused on 127.0.0.1:11434."
    );

    render(
      <Composer
        state={state}
        onSubmitTask={vi.fn()}
        onCancelActiveTask={vi.fn()}
        onSelectModel={vi.fn()}
        onOpenModelSettings={onOpenModelSettings}
      />
    );

    expect(screen.getByText("默认使用本地 Ollama，当前未检测到可用服务。")).toBeInTheDocument();
    expect(screen.queryByText(/connection refused on 127\.0\.0\.1:11434/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "配置 Ollama" }));
    fireEvent.click(screen.getByRole("button", { name: "配置大模型 API" }));

    expect(onOpenModelSettings).toHaveBeenNthCalledWith(1, "ollama");
    expect(onOpenModelSettings).toHaveBeenNthCalledWith(2, "remote-api");
  });

  it("shows a lightweight setup prompt near the composer when Ollama has no local models", () => {
    const onOpenModelSettings = vi.fn();
    const state = mergeOllamaOverview(createInitialWorkbenchState(), {
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "",
      diagnostic: "",
      models: []
    });

    render(
      <Composer
        state={state}
        onSubmitTask={vi.fn()}
        onCancelActiveTask={vi.fn()}
        onSelectModel={vi.fn()}
        onOpenModelSettings={onOpenModelSettings}
      />
    );

    expect(screen.getByText("默认使用本地 Ollama，当前未检测到可用模型。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "配置大模型 API" }));

    expect(onOpenModelSettings).toHaveBeenCalledWith("remote-api");
  });
});
