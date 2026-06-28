import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";
import {
  createInitialWorkbenchState,
  createOllamaLoadErrorState,
  createTaskExecutionStartedState,
  createUserTaskSubmittedState,
  mergeOllamaOverview
} from "../workbenchState";

const sampleAttachment = {
  id: "attachment-1",
  name: "design.png",
  mimeType: "image/png",
  sizeBytes: 2048,
  kind: "image" as const,
  filePath: "/tmp/design.png",
  previewUrl: "blob:design-preview",
  source: "picker" as const
};

describe("Composer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
    expect(onSubmitTask).toHaveBeenCalledWith("scan local mcp plugins", []);
    expect((textbox as HTMLTextAreaElement).value).toBe("");
  });

  it("shows draft attachments above the text input and clears them after send", () => {
    const onSubmitTask = vi.fn();
    const state = {
      ...createInitialWorkbenchState(),
      composer: {
        draftAttachments: [sampleAttachment]
      }
    };

    render(
      <Composer
        state={state}
        onSubmitTask={onSubmitTask}
        onCancelActiveTask={vi.fn()}
        onSelectModel={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "带附件一起发出" }
    });

    expect(screen.getByText("design.png")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmitTask).toHaveBeenCalledWith("带附件一起发出", [sampleAttachment]);
  });

  it("renders image thumbnails and compact file type chips for draft attachments", () => {
    const state = {
      ...createInitialWorkbenchState(),
      composer: {
        draftAttachments: [
          sampleAttachment,
          {
            id: "attachment-pdf",
            name: "谭懿钧简历-AI方向.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1872 * 1024,
            kind: "file" as const,
            filePath: "/tmp/resume.pdf",
            source: "picker" as const
          },
          {
            id: "attachment-unknown",
            name: "archive.bin",
            mimeType: "application/octet-stream",
            sizeBytes: 512,
            kind: "file" as const,
            filePath: "/tmp/archive.bin",
            source: "picker" as const
          }
        ]
      }
    };

    render(
      <Composer
        state={state}
        onSubmitTask={vi.fn()}
        onCancelActiveTask={vi.fn()}
        onSelectModel={vi.fn()}
      />
    );

    expect(screen.getByAltText("附件缩略图：design.png")).toHaveAttribute("src", "blob:design-preview");
    expect(screen.queryByText(/图片 ·/)).not.toBeInTheDocument();
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
    expect(screen.getByText("谭懿钧简历-AI方向.pdf")).toBeInTheDocument();
  });

  it("submits attachments even when there is no text message", () => {
    const onSubmitTask = vi.fn();
    const state = {
      ...createInitialWorkbenchState(),
      composer: {
        draftAttachments: [sampleAttachment]
      }
    };

    render(
      <Composer
        state={state}
        onSubmitTask={onSubmitTask}
        onCancelActiveTask={vi.fn()}
        onSelectModel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmitTask).toHaveBeenCalledWith("", [sampleAttachment]);
  });

  it("accepts dropped files into the draft attachment strip", async () => {
    const onAddAttachments = vi.fn();

    render(
      <Composer
        state={createInitialWorkbenchState()}
        onSubmitTask={vi.fn()}
        onCancelActiveTask={vi.fn()}
        onSelectModel={vi.fn()}
        onAddAttachments={onAddAttachments}
      />
    );

    const textbox = screen.getByRole("textbox", { name: "输入任务" });
    const droppedFile = new File(["hello"], "notes.txt", { type: "text/plain" });

    fireEvent.drop(textbox, {
      dataTransfer: {
        files: [droppedFile],
        items: []
      }
    });

    await waitFor(() => {
      expect(onAddAttachments).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("notes.txt")).toBeInTheDocument();
  });

  it("shows browser-picked files immediately even before parent state syncs", async () => {
    const onAddAttachments = vi.fn();

    render(
      <Composer
        state={createInitialWorkbenchState()}
        onSubmitTask={vi.fn()}
        onCancelActiveTask={vi.fn()}
        onSelectModel={vi.fn()}
        onAddAttachments={onAddAttachments}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const pickedFile = new File(["hello"], "picked.txt", { type: "text/plain" });

    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [pickedFile]
      }
    });

    await waitFor(() => {
      expect(onAddAttachments).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("picked.txt")).toBeInTheDocument();
  });

  it("accepts pasted clipboard images into the draft attachment strip", async () => {
    const onAddAttachments = vi.fn();

    render(
      <Composer
        state={createInitialWorkbenchState()}
        onSubmitTask={vi.fn()}
        onCancelActiveTask={vi.fn()}
        onSelectModel={vi.fn()}
        onAddAttachments={onAddAttachments}
      />
    );

    const textbox = screen.getByRole("textbox", { name: "输入任务" });
    const clipboardImage = new File(["image"], "paste.png", { type: "image/png" });

    fireEvent.paste(textbox, {
      clipboardData: {
        files: [clipboardImage],
        items: []
      }
    });

    await waitFor(() => {
      expect(onAddAttachments).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("paste.png")).toBeInTheDocument();
  });

  it("shows pasted clipboard files from transfer items when files is empty", async () => {
    const onAddAttachments = vi.fn();

    render(
      <Composer
        state={createInitialWorkbenchState()}
        onSubmitTask={vi.fn()}
        onCancelActiveTask={vi.fn()}
        onSelectModel={vi.fn()}
        onAddAttachments={onAddAttachments}
      />
    );

    const textbox = screen.getByRole("textbox", { name: "输入任务" });
    const clipboardImage = new File(["image"], "paste-from-items.png", { type: "image/png" });

    fireEvent.paste(textbox, {
      clipboardData: {
        files: [],
        items: [
          {
            kind: "file",
            getAsFile: () => clipboardImage
          }
        ]
      }
    });

    await waitFor(() => {
      expect(onAddAttachments).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("paste-from-items.png")).toBeInTheDocument();
  });

  it("submits locally visible attachments before parent state syncs", async () => {
    const onSubmitTask = vi.fn();

    render(
      <Composer
        state={createInitialWorkbenchState()}
        onSubmitTask={onSubmitTask}
        onCancelActiveTask={vi.fn()}
        onSelectModel={vi.fn()}
        onAddAttachments={vi.fn()}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    const pickedFile = new File(["hello"], "local-only.txt", { type: "text/plain" });

    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [pickedFile]
      }
    });

    expect(await screen.findByText("local-only.txt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmitTask).toHaveBeenCalledTimes(1);
    expect(onSubmitTask.mock.calls[0]?.[0]).toBe("");
    expect(onSubmitTask.mock.calls[0]?.[1]).toEqual([
      expect.objectContaining({
        name: "local-only.txt",
        source: "picker"
      })
    ]);
  });

  it("waits for picked image attachments to finish importing before sending", async () => {
    const originalFileReader = globalThis.FileReader;
    const onSubmitTask = vi.fn();
    const finishReadCallbacks: Array<() => void> = [];

    class SlowFileReader {
      result: string | ArrayBuffer | null = null;
      private loadListener: (() => void) | null = null;

      addEventListener(type: string, listener: () => void) {
        if (type === "load") {
          this.loadListener = listener;
        }
      }

      readAsDataURL() {
        finishReadCallbacks.push(() => {
          this.result = "data:image/png;base64,aW1hZ2U=";
          this.loadListener?.();
        });
      }
    }

    Object.defineProperty(globalThis, "FileReader", {
      configurable: true,
      value: SlowFileReader
    });

    render(
      <Composer
        state={createInitialWorkbenchState()}
        onSubmitTask={onSubmitTask}
        onCancelActiveTask={vi.fn()}
        onSelectModel={vi.fn()}
        onAddAttachments={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "提取图片中的文字" }
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    const pickedFile = new File(["image"], "slow-capture.png", { type: "image/png" });

    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [pickedFile]
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(screen.getByText("正在添加附件…")).toBeInTheDocument();
    expect(onSubmitTask).not.toHaveBeenCalled();

    expect(finishReadCallbacks).toHaveLength(1);
    finishReadCallbacks[0]?.();
    expect(await screen.findByText("slow-capture.png")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmitTask).toHaveBeenCalledWith("提取图片中的文字", [
      expect.objectContaining({
        name: "slow-capture.png",
        base64Data: "aW1hZ2U="
      })
    ]);

    Object.defineProperty(globalThis, "FileReader", {
      configurable: true,
      value: originalFileReader
    });
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

  it("keeps only one model selector in the composer", () => {
    const onSelectNpcModel = vi.fn();
    const state = {
      ...createInitialWorkbenchState(),
      model: {
        ...createInitialWorkbenchState().model,
        status: "Ollama 已连接",
        activeModel: "qwen2.5-coder:7b",
        availableModels: [
          { name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" },
          { name: "gemma4:12b", sizeLabel: "7.2 GB" }
        ]
      },
      settings: {
        ...createInitialWorkbenchState().settings,
        npc: {
          localModel: "qwen2.5-coder:7b"
        }
      }
    };

    render(
      <Composer
        state={state}
        onSubmitTask={vi.fn()}
        onCancelActiveTask={vi.fn()}
        onSelectModel={vi.fn()}
        onSelectNpcModel={onSelectNpcModel}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "选择模型：qwen2.5-coder:7b" }));

    expect(screen.getByRole("menuitemradio", { name: "qwen2.5-coder:7b 4.1 GB" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "gemma4:12b 7.2 GB" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "选择 NPC 模型：qwen2.5-coder:7b" })).not.toBeInTheDocument();
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
