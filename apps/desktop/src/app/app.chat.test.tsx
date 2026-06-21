import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, getLocalModelChatTimeoutMs, resolveUsableOllamaChatModel } from "./App";

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

function setupUser() {
  return typeof vi.isFakeTimers === "function" && vi.isFakeTimers()
    ? userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    : userEvent.setup();
}

async function retryFailedChatThroughCurrentFlow() {
  const user = setupUser();
  await user.click(await screen.findByRole("button", { name: "重试本地任务" }));
}

describe("App chat fallback", () => {
  beforeEach(() => {
    cancelOllamaChatMock.mockReset();
    chatWithOllamaModelMock.mockReset();
    loadOllamaOverviewMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers ordinary Chinese questions through the selected local model without showing task chrome", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "享元模式通过共享不可变的内部状态来减少大量细粒度对象的内存占用。"
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "软件体系设计的享元模式易懂的解释,以及它的内部状态和外部状态是什么" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText(/享元模式通过共享不可变的内部状态/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen3.6:35b",
      message: "软件体系设计的享元模式易懂的解释,以及它的内部状态和外部状态是什么"
    }));
    expect(screen.queryByText(/本地助手能力说明/)).not.toBeInTheDocument();
    expect(screen.queryByText("本地任务执行失败")).not.toBeInTheDocument();
  });

  it("passes submitted image attachments into local model context", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "图片里写着：测试文字。"
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    const imageFile = new File(["image-bytes"], "capture.png", { type: "image/png" });

    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [imageFile]
      }
    });

    expect(await screen.findByText("capture.png")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "提取图中的文字" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText("图片里写着：测试文字。")).toBeInTheDocument();
    });

    const conversation = screen.getByLabelText("会话");
    expect(within(conversation).getByAltText("附件缩略图：capture.png")).toBeInTheDocument();
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      images: expect.arrayContaining([expect.any(String)])
    }));
    const requestMessage = chatWithOllamaModelMock.mock.calls[0]?.[0].message ?? "";
    expect(requestMessage).toContain("提取图中的文字");
    expect(requestMessage).toContain("capture.png");
    expect(requestMessage).toContain("Ollama images 字段");
  });

  it("keeps image history and warns when the selected Ollama model is likely text-only", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.5:9b",
      diagnostic: "",
      models: [{ name: "qwen3.5:9b", sizeLabel: "6.0 GB", capabilities: ["completion", "chat"] }]
    });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.5:9b",
      message: "我已收到图片，但当前模型可能不支持视觉输入，请切换视觉模型后重试。"
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.5:9b" });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    const imageFile = new File(["image-bytes"], "ocr.png", { type: "image/png" });

    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [imageFile]
      }
    });

    expect(await screen.findByText("ocr.png")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "提取图片中的文字" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText(/当前模型可能不支持视觉输入/)).toBeInTheDocument();
    });

    const conversation = screen.getByLabelText("会话");
    expect(within(conversation).getByAltText("附件缩略图：ocr.png")).toBeInTheDocument();
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen3.5:9b",
      images: expect.arrayContaining([expect.any(String)])
    }));
    const requestMessage = chatWithOllamaModelMock.mock.calls[0]?.[0].message ?? "";
    expect(requestMessage).toContain("当前所选模型：qwen3.5:9b");
    expect(requestMessage).toContain("当前模型可能不是视觉模型");
    expect(requestMessage).toContain("请切换到支持视觉输入的 Ollama 模型");
  });

  it("falls back to the first available Ollama model for ordinary chat when activeModel is still unselected", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "",
      diagnostic: "",
      models: [{ name: "gemma4:26b", sizeLabel: "17 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "gemma4:26b",
      message: "已通过首个可用模型完成回答。"
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：gemma4:26b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "软件体系设计的享元模式易懂的解释" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText("已通过首个可用模型完成回答。")).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "gemma4:26b",
      message: "软件体系设计的享元模式易懂的解释"
    }));
  });

  it("preflights Ollama once when the user submits before startup model detection finishes", async () => {
    let resolveStartupOverview: (overview: {
      reachable: boolean;
      endpoint: string;
      selectedModel: string;
      diagnostic: string;
      models: Array<{ name: string; sizeLabel: string }>;
    }) => void = () => {};
    loadOllamaOverviewMock
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveStartupOverview = resolve;
      }))
      .mockResolvedValueOnce({
        reachable: true,
        endpoint: "http://127.0.0.1:11434",
        selectedModel: "",
        diagnostic: "",
        models: [{ name: "gemma:26b", sizeLabel: "17 GB" }]
      });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "gemma:26b",
      message: "启动检测完成前也能通过预检模型完成回答。"
    });

    render(<App />);

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "解释一下享元模式" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText("启动检测完成前也能通过预检模型完成回答。")).toBeInTheDocument();
    });

    expect(loadOllamaOverviewMock).toHaveBeenCalledTimes(2);
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "gemma:26b",
      message: "解释一下享元模式"
    }));
    expect(screen.queryAllByText("本地模型对话失败")).toHaveLength(0);

    await act(async () => {
      resolveStartupOverview({
        reachable: true,
        endpoint: "http://127.0.0.1:11434",
        selectedModel: "",
        diagnostic: "",
        models: [{ name: "gemma:26b", sizeLabel: "17 GB" }]
      });
      await Promise.resolve();
    });
  });

  it("does not cancel an in-flight local-model chat when preflight refresh updates the selected model", async () => {
    loadOllamaOverviewMock
      .mockResolvedValueOnce({
        reachable: true,
        endpoint: "http://127.0.0.1:11434",
        selectedModel: "",
        diagnostic: "",
        models: []
      })
      .mockResolvedValueOnce({
        reachable: true,
        endpoint: "http://127.0.0.1:11434",
        selectedModel: "gemma:26b",
        diagnostic: "",
        models: [{ name: "gemma:26b", sizeLabel: "17 GB" }]
      });
    let resolveChat: (value: { model: string; message: string }) => void = () => {};
    const chatPromise = new Promise<{ model: string; message: string }>((resolve) => {
      resolveChat = resolve;
    });
    chatWithOllamaModelMock.mockReturnValue(chatPromise);

    render(<App />);

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "解释一下享元模式" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(loadOllamaOverviewMock).toHaveBeenCalledTimes(2);
      expect(chatWithOllamaModelMock).toHaveBeenCalledTimes(1);
    });

    const request = chatWithOllamaModelMock.mock.calls[0]?.[0] as { signal?: AbortSignal; model?: string };

    expect(request.model).toBe("gemma:26b");
    expect(request.signal?.aborted).toBe(false);
    expect(cancelOllamaChatMock).not.toHaveBeenCalled();

    await act(async () => {
      resolveChat({
        model: "gemma:26b",
        message: "预检刷新模型状态后，这次回答仍然正常完成。"
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("预检刷新模型状态后，这次回答仍然正常完成。")).toBeInTheDocument();
    });
    expect(cancelOllamaChatMock).not.toHaveBeenCalled();
  });

  it("routes capability questions through the selected local model instead of fixed help copy", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "我会根据当前问题和可用工具动态判断，而不是输出固定能力清单。"
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "你能帮我做什么" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText(/我会根据当前问题和可用工具动态判断/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen3.6:35b",
      message: "你能帮我做什么"
    }));
    expect(screen.queryByText("本地助手能力说明")).not.toBeInTheDocument();
    expect(screen.queryByText(/I can help with local chat/i)).not.toBeInTheDocument();
  });

  it("routes Chinese capability follow-up questions through the local model instead of fixed capability overviews", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "我会结合当前上下文解释 RAG 能力，而不是直接输出固定能力概览。"
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "RAG 能力怎么样，适合帮我做什么" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText(/结合当前上下文解释 RAG 能力/)).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen3.6:35b",
      message: "RAG 能力怎么样，适合帮我做什么"
    }));
    expect(screen.queryByText("OpenClaw RAG capability overview")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本地任务" })).not.toBeInTheDocument();
  });

  it("routes MCP startup troubleshooting questions through the local model instead of the controlled start chain", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "我会先分析浏览器 MCP 插件启动失败的真实原因，而不是直接进入高风险启动链。"
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "帮我检查 browser mcp plugin 为什么本地启动失败" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
        model: "qwen3.6:35b",
        message: "帮我检查 browser mcp plugin 为什么本地启动失败"
      }));
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen3.6:35b",
      message: "帮我检查 browser mcp plugin 为什么本地启动失败"
    }));
    expect(screen.queryByText(/Controlled full permission is required before starting a local MCP plugin process/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本地任务" })).not.toBeInTheDocument();
  });

  it("routes RAG troubleshooting questions through the local model instead of eager local retrieval execution", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "我会先分析本地 RAG 检索失败的原因，而不是直接重复触发同一条检索链。"
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "帮我检查本地 RAG rules search 为什么失败" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
        model: "qwen3.6:35b",
        message: "帮我检查本地 RAG rules search 为什么失败"
      }));
    });
    await waitFor(() => {
      expect(screen.getByText("我会先分析本地 RAG 检索失败的原因，而不是直接重复触发同一条检索链。")).toBeInTheDocument();
    });
    expect(screen.queryByText("Local RAG document search")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本地任务" })).not.toBeInTheDocument();
  });

  it("routes local project execution troubleshooting questions through the local model instead of project or NPC task chains", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "这类问题我会先从日志、权限链、运行时句柄和真实执行路径分析，而不是直接重新触发项目运行或截图任务。"
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "why did the desktop app fail to run locally" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
        model: "qwen3.6:35b",
        message: "why did the desktop app fail to run locally"
      }));
    });
    await waitFor(() => {
      expect(screen.getByText("这类问题我会先从日志、权限链、运行时句柄和真实执行路径分析，而不是直接重新触发项目运行或截图任务。")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Run matched local project|Matched local project status|Stop matched local project/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Workspace write permission is required before launching a matched local project/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本地任务" })).not.toBeInTheDocument();
  });

  it("shows user-actionable Ollama recovery guidance when ordinary chat fails", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockRejectedValue(new Error("fetch failed"));

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "解释一下享元模式" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.queryAllByText("本地模型对话失败").length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText(/无法连接本地 Ollama 服务/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/assistantTaskService/)).not.toBeInTheDocument();
  });

  it.each([
    {
      name: "timeout",
      error: new Error("Local task exceeded the maximum execution time of 45 seconds."),
      expectedHint: /本地模型响应超时/
    },
    {
      name: "connection refused",
      error: new Error("Ollama chat failed: error sending request for url (http://127.0.0.1:11434/api/chat): tcp connect error: No connection could be made because the target machine actively refused it."),
      expectedHint: /无法连接本地 Ollama 服务/
    },
    {
      name: "empty response",
      error: new Error("Ollama chat returned an empty assistant message."),
      expectedHint: /Ollama 返回了空内容/
    },
    {
      name: "context length exceeded",
      error: new Error("Ollama chat failed: context length exceeded"),
      expectedHint: /输入或上下文过长/
    },
    {
      name: "model not found",
      error: new Error("Ollama chat failed with HTTP 404: model missing:latest not found"),
      expectedHint: /model missing:latest not found/i
    }
  ])("shows specific Ollama recovery guidance for $name failures", async ({ error, expectedHint }) => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockRejectedValue(error);

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "解释一下享元模式" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.queryAllByText("本地模型对话失败").length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText(expectedHint).length).toBeGreaterThan(0);
  });

  it("does not call Ollama chat when the service is reachable but no local model is available", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "",
      diagnostic: "",
      models: []
    });

    render(<App />);

    await screen.findByText("默认使用本地 Ollama，当前未检测到可用模型。");

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "解释一下享元模式" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.queryAllByText("本地模型对话失败").length).toBeGreaterThan(0);
    });
    expect(chatWithOllamaModelMock).not.toHaveBeenCalled();
    expect(screen.queryAllByText(/当前没有可用的本地 Ollama 模型/).length).toBeGreaterThan(0);
  });

  it("recovers a no-model chat failure after Ollama models are detected and the task is retried", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "",
      diagnostic: "",
      models: []
    });

    render(<App />);

    await screen.findByText("默认使用本地 Ollama，当前未检测到可用模型。");

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "解释一下享元模式" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.queryAllByText("本地模型对话失败").length).toBeGreaterThan(0);
    });
    expect(chatWithOllamaModelMock).not.toHaveBeenCalled();

    loadOllamaOverviewMock
      .mockResolvedValueOnce({
        reachable: true,
        endpoint: "http://127.0.0.1:11434",
        selectedModel: "qwen3.6:35b",
        diagnostic: "",
        models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
      })
      .mockResolvedValueOnce({
        reachable: true,
        endpoint: "http://127.0.0.1:11434",
        selectedModel: "qwen3.6:35b",
        diagnostic: "",
        models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
      });
    chatWithOllamaModelMock.mockResolvedValueOnce({
      model: "qwen3.6:35b",
      message: "已在模型恢复后完成回答。"
    });

    await retryFailedChatThroughCurrentFlow();

    await waitFor(() => {
      expect(screen.getByText("已在模型恢复后完成回答。")).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen3.6:35b",
      message: "解释一下享元模式"
    }));
  }, 15_000);

  it("re-detects Ollama before retrying a failed local-model chat task", async () => {
    loadOllamaOverviewMock
      .mockResolvedValueOnce({
        reachable: true,
        endpoint: "http://127.0.0.1:11434",
        selectedModel: "qwen3.6:35b",
        diagnostic: "",
        models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
      })
      .mockResolvedValueOnce({
        reachable: true,
        endpoint: "http://127.0.0.1:11434",
        selectedModel: "qwen2.5-coder:7b",
        diagnostic: "",
        models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
      });
    chatWithOllamaModelMock
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce({
        model: "qwen2.5-coder:7b",
        message: "重新检测 Ollama 后已恢复回答。"
      });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "解释一下享元模式" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.queryAllByText("本地模型对话失败").length).toBeGreaterThan(0);
    });

    await retryFailedChatThroughCurrentFlow();

    await screen.findByRole("button", { name: "选择模型：qwen2.5-coder:7b" });
    await waitFor(() => {
      expect(screen.getByText("重新检测 Ollama 后已恢复回答。")).toBeInTheDocument();
    });
    expect(loadOllamaOverviewMock).toHaveBeenCalledTimes(2);
    expect(chatWithOllamaModelMock).toHaveBeenLastCalledWith(expect.objectContaining({
      model: "qwen2.5-coder:7b",
      message: "解释一下享元模式"
    }));
  }, 15_000);

  it("retries a failed local-model chat after self-check when Ollama returns models but no selectedModel", async () => {
    loadOllamaOverviewMock
      .mockResolvedValueOnce({
        reachable: true,
        endpoint: "http://127.0.0.1:11434",
        selectedModel: "qwen3.6:35b",
        diagnostic: "",
        models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
      })
      .mockResolvedValueOnce({
        reachable: true,
        endpoint: "http://127.0.0.1:11434",
        selectedModel: "",
        diagnostic: "",
        models: [
          { name: "gemma4:26b", sizeLabel: "17 GB" },
          { name: "qwen3.5:9b", sizeLabel: "6.6 GB" }
        ]
      });
    chatWithOllamaModelMock
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce({
        model: "gemma4:26b",
        message: "已在自动兜底模型上恢复回答。"
      });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "解释一下享元模式" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.queryAllByText("本地模型对话失败").length).toBeGreaterThan(0);
    });

    await retryFailedChatThroughCurrentFlow();

    await screen.findByRole("button", { name: "选择模型：gemma4:26b" });
    await waitFor(() => {
      expect(screen.getByText("已在自动兜底模型上恢复回答。")).toBeInTheDocument();
    });
    expect(chatWithOllamaModelMock).toHaveBeenLastCalledWith(expect.objectContaining({
      model: "gemma4:26b",
      message: "解释一下享元模式"
    }));
  }, 15_000);

  it("stops local-model retry when Ollama self-check fails instead of blindly calling chat again", async () => {
    loadOllamaOverviewMock
      .mockResolvedValueOnce({
        reachable: true,
        endpoint: "http://127.0.0.1:11434",
        selectedModel: "qwen3.6:35b",
        diagnostic: "",
        models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
      })
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:11434"));
    chatWithOllamaModelMock.mockRejectedValueOnce(new Error("fetch failed"));

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "解释一下享元模式" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.queryAllByText("本地模型对话失败").length).toBeGreaterThan(0);
    });

    await retryFailedChatThroughCurrentFlow();

    await screen.findByText("默认使用本地 Ollama，当前未检测到可用服务。");

    expect(loadOllamaOverviewMock).toHaveBeenCalledTimes(2);
    expect(chatWithOllamaModelMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "配置 Ollama" }));

    expect(screen.getByLabelText("设置")).toHaveTextContent("connect ECONNREFUSED 127.0.0.1:11434");
  });

  it("stops local-model retry when Ollama self-check returns offline instead of queuing another failed chat", async () => {
    loadOllamaOverviewMock
      .mockResolvedValueOnce({
        reachable: true,
        endpoint: "http://127.0.0.1:11434",
        selectedModel: "qwen3.6:35b",
        diagnostic: "",
        models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
      })
      .mockResolvedValueOnce({
        reachable: false,
        endpoint: "http://127.0.0.1:11434",
        selectedModel: "",
        diagnostic: "Ollama 未启动，请确认本地服务已运行。",
        models: []
      });
    chatWithOllamaModelMock.mockRejectedValueOnce(new Error("fetch failed"));

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "解释一下享元模式" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.queryAllByText("本地模型对话失败").length).toBeGreaterThan(0);
    });

    await retryFailedChatThroughCurrentFlow();

    await screen.findByText("默认使用本地 Ollama，当前未检测到可用服务。");

    expect(loadOllamaOverviewMock).toHaveBeenCalledTimes(2);
    expect(chatWithOllamaModelMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    expect(screen.queryByText("本地模型正在生成，右侧不重复展示你的问题原文。")).not.toBeInTheDocument();
  });

  it("falls back to a detected model when retry self-check no longer includes the selected model", async () => {
    loadOllamaOverviewMock
      .mockResolvedValueOnce({
        reachable: true,
        endpoint: "http://127.0.0.1:11434",
        selectedModel: "qwen3.6:35b",
        diagnostic: "",
        models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
      })
      .mockResolvedValueOnce({
        reachable: true,
        endpoint: "http://127.0.0.1:11434",
        selectedModel: "qwen3.6:35b",
        diagnostic: "",
        models: [{ name: "gemma4:26b", sizeLabel: "17 GB" }]
      });
    chatWithOllamaModelMock
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce({
        model: "gemma4:26b",
        message: "已切换到仍可用的本地模型继续回答。"
      });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "解释一下享元模式" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.queryAllByText("本地模型对话失败").length).toBeGreaterThan(0);
    });

    await retryFailedChatThroughCurrentFlow();

    await screen.findByRole("button", { name: "选择模型：gemma4:26b" });
    await waitFor(() => {
      expect(screen.getByText("已切换到仍可用的本地模型继续回答。")).toBeInTheDocument();
    });

    expect(loadOllamaOverviewMock).toHaveBeenCalledTimes(2);
    expect(chatWithOllamaModelMock).toHaveBeenCalledTimes(2);
    expect(chatWithOllamaModelMock).toHaveBeenLastCalledWith(expect.objectContaining({
      model: "gemma4:26b",
      message: "解释一下享元模式"
    }));
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
  }, 15_000);

  it("allows longer execution time for long local-model quiz requests", () => {
    const longQuizRequest = Array.from({ length: 16 }, (_, index) => `第${index + 1}题 请给出答案和简要解释`).join("\n");

    expect(getLocalModelChatTimeoutMs("解释一下享元模式")).toBe(480_000);
    expect(getLocalModelChatTimeoutMs(longQuizRequest)).toBeGreaterThanOrEqual(480_000);
  });

  it("keeps simple local-model knowledge questions away from the legacy 45 second timeout", () => {
    expect(getLocalModelChatTimeoutMs("开源协议有哪些")).toBe(480_000);
  });

  it("resolves the preferred default local model when chat starts from an unselected model state", () => {
    expect(resolveUsableOllamaChatModel("", [
      { name: "qwen3.6:35b", sizeLabel: "23 GB" },
      { name: "gemma:26b", sizeLabel: "17 GB" },
      { name: "gemma4:26b", sizeLabel: "17 GB" }
    ])).toBe("gemma:26b");
    expect(resolveUsableOllamaChatModel("未选择模型", [
      { name: "qwen3.6:35b", sizeLabel: "23 GB" },
      { name: "gemma4:26b", sizeLabel: "17 GB" }
    ])).toBe("gemma4:26b");
    expect(resolveUsableOllamaChatModel("", [
      { name: "qwen3.6:35b", sizeLabel: "23 GB" },
      { name: "qwen3.5:9b", sizeLabel: "6.6 GB" }
    ])).toBe("qwen3.6:35b");
    expect(resolveUsableOllamaChatModel("qwen3.6:35b", [
      { name: "gemma4:26b", sizeLabel: "17 GB" },
      { name: "qwen3.5:9b", sizeLabel: "6.6 GB" }
    ])).toBe("gemma4:26b");
  });

  it("normalizes stale local-model 45 second timeout diagnostics to the configured chat timeout", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockRejectedValue(
      new Error("Local task exceeded the maximum execution time of 45 seconds.")
    );

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "开源协议有哪些" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.queryAllByText("本地模型对话失败").length).toBeGreaterThan(0);
    });

    expect(screen.queryByText(/45 seconds/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/本地模型对话失败/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/timeout=45s/i)).not.toBeInTheDocument();
  });

  it("records the actual fallback model in local-model failure diagnostics", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "gemma:26b", sizeLabel: "17 GB" }]
    });
    chatWithOllamaModelMock.mockRejectedValue(new Error("fetch failed"));

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：gemma:26b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "解释一下享元模式" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.queryAllByText("本地模型对话失败").length).toBeGreaterThan(0);
    });

    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "gemma:26b"
    }));
    expect(screen.getAllByText(/本地模型对话失败/).length).toBeGreaterThan(0);
  });

  it("routes context-length local-model retries into readonly local RAG instead of calling Ollama again", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockRejectedValue(new Error("Ollama chat failed: context length exceeded"));

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "请总结这份超长输入，并提取关键结论。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.queryAllByText("本地模型对话失败").length).toBeGreaterThan(0);
    });

    await retryFailedChatThroughCurrentFlow();

    await waitFor(() => {
      expect(screen.getAllByText(/本地 RAG 文档检索|找到 2 条匹配片段/i).length).toBeGreaterThan(0);
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledTimes(1);
    expect(loadOllamaOverviewMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
  }, 15_000);

  it("does not fail a long numbered local-model request at the short 45 second timeout", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockReturnValue(new Promise(() => undefined));
    const longNumberedRequest = Array.from(
      { length: 16 },
      (_, index) => `${index + 1}. 这是一道需要回答和简要解释的题目。`
    ).join("\n");

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: `${longNumberedRequest}\n请逐题给出答案和简要解释。` }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
    });

    vi.useFakeTimers();

    act(() => {
      vi.advanceTimersByTime(45_000);
    });

    expect(screen.queryByText("本地模型对话失败")).not.toBeInTheDocument();
  });

  it("does not fail a short local-model question at the generic 45 second tool timeout", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockReturnValue(new Promise(() => undefined));

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "开源协议有哪些" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
    });

    vi.useFakeTimers();

    act(() => {
      vi.advanceTimersByTime(45_000);
    });

    expect(screen.queryByText("本地模型对话失败")).not.toBeInTheDocument();
  });

  it("shows a live local-model progress heartbeat before the timeout guard fires", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockReturnValue(new Promise(() => undefined));

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    vi.useFakeTimers();

    await act(async () => {
      fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
        target: { value: "开源协议有哪些" }
      });
      fireEvent.click(screen.getByRole("button", { name: "发送" }));
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    expect(screen.getByLabelText("assistant-pending")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    const pending = screen.getByLabelText("assistant-pending");
    expect(within(pending).getByText("正在思考")).toBeInTheDocument();
    expect(within(pending).getByText(/Ollama 已连接，正在等待首轮输出，已等待约 \d+ 秒。/)).toBeInTheDocument();
    expect(pending.querySelector(".task-inline-panel")).not.toBeInTheDocument();
    expect(screen.queryByText("本地模型对话失败")).not.toBeInTheDocument();
    expect(chatWithOllamaModelMock).toHaveBeenCalledTimes(1);
  });

  it("switches from waiting-for-first-chunk to generating progress after the first streamed chunk arrives", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    let emitChunk: ((chunk: string) => void) | undefined;
    chatWithOllamaModelMock.mockImplementation((request: { onChunk?: (chunk: string) => void }) => {
      emitChunk = request.onChunk;
      return new Promise(() => undefined);
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    vi.useFakeTimers();

    await act(async () => {
      fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
        target: { value: "解释一下享元模式" }
      });
      fireEvent.click(screen.getByRole("button", { name: "发送" }));
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
      await Promise.resolve();
      await Promise.resolve();
    });

    let pending = screen.getByLabelText("assistant-pending");
    expect(within(pending).getByText("正在思考")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    pending = screen.getByLabelText("assistant-pending");
    expect(within(pending).getByText(/Ollama 已连接，正在等待首轮输出，已等待约 \d+ 秒。/)).toBeInTheDocument();

    await act(async () => {
      emitChunk?.("第一段，");
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    pending = screen.getByLabelText("assistant-pending");
    expect(within(pending).getByText("第一段，")).toBeInTheDocument();
    expect(within(pending).queryByText(/Ollama 已连接，正在等待首轮输出/)).not.toBeInTheDocument();
  });

  it("records whether a local-model timeout happened before or after the first streamed chunk", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockImplementation(
      (request: { onChunk?: (chunk: string) => void }) =>
        new Promise((_, reject) => {
          request.onChunk?.("已经开始输出，");
          reject(new Error("Local task exceeded the maximum execution time of 480 seconds."));
        })
    );

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "开源协议有哪些" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.queryAllByText("本地模型对话失败").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/本地模型对话失败/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/streamPhase=streaming/i)).not.toBeInTheDocument();
  });

  it("uses first-token recovery guidance for ordinary chat stalls instead of result-mapping fallback", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockRejectedValueOnce(new Error("Request aborted before the first assistant token."));

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "解释一下课程助手 NPC 适合做什么" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.queryAllByText("本地模型对话失败").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/本地模型已连接，但首轮输出没有在本轮超时前返回/).length).toBeGreaterThan(0);

    expect(screen.getAllByText(/本地模型首轮输出超时|本地模型已连接，但首轮输出没有在本轮超时前返回/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/结果映射/)).not.toBeInTheDocument();
    expect(screen.queryByText(/streamPhase=waiting-first-chunk/i)).not.toBeInTheDocument();
  });

  it("shows streamed local-model chunks inside the pending assistant message before final completion", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    let resolveChat: (value: { model: string; message: string }) => void = () => {};
    chatWithOllamaModelMock.mockImplementation(
      (request: { onChunk?: (chunk: string) => void }) =>
        new Promise((resolve) => {
          resolveChat = resolve;
          request.onChunk?.("第一段，");
          request.onChunk?.("第二段。");
        })
    );

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "解释一下享元模式" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByLabelText("assistant-pending")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByLabelText("assistant-pending")).toHaveTextContent("第一段，第二段。");
    });

    await act(async () => {
      resolveChat({
        model: "qwen3.6:35b",
        message: "第一段，第二段。"
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    });
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
    expect(screen.getByText("第一段，第二段。")).toBeInTheDocument();
    expect(screen.getAllByText("第一段，第二段。")).toHaveLength(1);
  });

  it("aborts an in-flight local-model chat request when the user stops the task", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockReturnValue(new Promise(() => undefined));

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "简单解释一下 MIT 开源协议" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
    });

    const request = chatWithOllamaModelMock.mock.calls[0]?.[0] as { requestId?: string; signal?: AbortSignal };

    const stopButtons = screen.getAllByRole("button", { name: "停止任务" });
    fireEvent.click(stopButtons.find((button) => button.classList.contains("send-button")) ?? stopButtons[0]);

    expect(request.signal?.aborted).toBe(true);
  });

  it("asks the desktop Ollama bridge to cancel an in-flight local-model chat when the user stops the task", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockReturnValue(new Promise(() => undefined));

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "简单解释一下 MIT 开源协议" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
    });

    const request = chatWithOllamaModelMock.mock.calls[0]?.[0] as { requestId?: string };
    const stopButtons = screen.getAllByRole("button", { name: "停止任务" });
    fireEvent.click(stopButtons.find((button) => button.classList.contains("send-button")) ?? stopButtons[0]);

    expect(request.requestId).toMatch(/^local-model-chat-/);
    expect(cancelOllamaChatMock).toHaveBeenCalledWith(request.requestId);
  });

  it("ignores late local-model streaming chunks after the user stops the task", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    let onChunk: ((chunk: string) => void) | undefined;
    chatWithOllamaModelMock.mockImplementation((request: { onChunk?: (chunk: string) => void }) => {
      onChunk = request.onChunk;
      request.onChunk?.("停止前的片段。");
      return new Promise(() => undefined);
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "简单解释一下 MIT 开源协议" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
    });

    const stopButtons = screen.getAllByRole("button", { name: "停止任务" });
    fireEvent.click(stopButtons.find((button) => button.classList.contains("send-button")) ?? stopButtons[0]);

    await waitFor(() => {
      expect(screen.getAllByText(/本地任务已停止/).length).toBeGreaterThan(0);
    });

    await act(async () => {
      onChunk?.("停止后的迟到片段，不应该出现。");
      await Promise.resolve();
    });

    expect(screen.getAllByText(/本地任务已停止/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/停止后的迟到片段/)).not.toBeInTheDocument();
  });

  it("cancels an in-flight local-model chat when the app unmounts", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockReturnValue(new Promise(() => undefined));

    const { unmount } = render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "简单解释一下 MIT 开源协议" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
    });

    const request = chatWithOllamaModelMock.mock.calls[0]?.[0] as { requestId?: string; signal?: AbortSignal };

    unmount();

    expect(request.signal?.aborted).toBe(true);
    expect(request.requestId).toMatch(/^local-model-chat-/);
    expect(cancelOllamaChatMock).toHaveBeenCalledWith(request.requestId);
  });

  it("aborts an in-flight local-model chat request when the local-model timeout guard fires", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockReturnValue(new Promise(() => undefined));

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    vi.useFakeTimers();

    await act(async () => {
      fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
        target: { value: "简单解释一下 MIT 开源协议" }
      });
      fireEvent.click(screen.getByRole("button", { name: "发送" }));
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(80);
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(120);
      await Promise.resolve();
    });

    expect(chatWithOllamaModelMock).toHaveBeenCalled();

    const request = chatWithOllamaModelMock.mock.calls[0]?.[0] as { requestId?: string; signal?: AbortSignal };

    await act(async () => {
      vi.advanceTimersByTime(480_000);
      await Promise.resolve();
    });

    expect(request.signal?.aborted).toBe(true);
    expect(request.requestId).toMatch(/^local-model-chat-/);
    expect(cancelOllamaChatMock).toHaveBeenCalledWith(request.requestId);
  });

  it("ignores a stale local-model answer after the user stops it and asks a second question", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    let resolveFirstChat: (value: { model: string; message: string }) => void = () => {};
    const firstChatPromise = new Promise<{ model: string; message: string }>((resolve) => {
      resolveFirstChat = resolve;
    });
    chatWithOllamaModelMock
      .mockReturnValueOnce(firstChatPromise)
      .mockResolvedValueOnce({
        model: "qwen3.6:35b",
        message: "第二个问题的有效回答。"
      });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "第一个问题会被停止" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalledTimes(1);
    });

    const stopButtons = screen.getAllByRole("button", { name: "停止任务" });
    fireEvent.click(stopButtons.find((button) => button.classList.contains("send-button")) ?? stopButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "输入任务" })).not.toBeDisabled();
    });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "第二个问题应该正常回答" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText("第二个问题的有效回答。")).toBeInTheDocument();
    });

    await act(async () => {
      resolveFirstChat({
        model: "qwen3.6:35b",
        message: "第一个问题的迟到回答，不应该出现。"
      });
      await Promise.resolve();
    });

    expect(screen.getByText("第二个问题的有效回答。")).toBeInTheDocument();
    expect(screen.queryByText("第一个问题的迟到回答，不应该出现。")).not.toBeInTheDocument();
  });

  it("cancels an in-flight local-model chat when starting a new conversation", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    let resolveFirstChat: (value: { model: string; message: string }) => void = () => {};
    const firstChatPromise = new Promise<{ model: string; message: string }>((resolve) => {
      resolveFirstChat = resolve;
    });
    chatWithOllamaModelMock.mockReturnValueOnce(firstChatPromise);

    render(<App />);

    await screen.findByRole("button", { name: "\u9009\u62e9\u6a21\u578b\uff1aqwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "\u8f93\u5165\u4efb\u52a1" }), {
      target: { value: "\u8fd9\u662f\u4e00\u4e2a\u4f1a\u88ab\u65b0\u5bf9\u8bdd\u53d6\u6d88\u7684\u95ee\u9898" }
    });
    fireEvent.click(screen.getByRole("button", { name: "\u53d1\u9001" }));

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalledTimes(1);
    });

    const request = chatWithOllamaModelMock.mock.calls[0]?.[0] as { requestId?: string; signal?: AbortSignal };

    fireEvent.click(screen.getByRole("button", { name: "\u521b\u5efa\u65b0\u4f1a\u8bdd" }));

    expect(request.signal?.aborted).toBe(true);
    expect(request.requestId).toMatch(/^local-model-chat-/);
    expect(cancelOllamaChatMock).toHaveBeenCalledWith(request.requestId);

    await act(async () => {
      resolveFirstChat({
        model: "qwen3.6:35b",
        message: "\u65e7\u5bf9\u8bdd\u7684\u8fdf\u5230\u56de\u7b54\uff0c\u4e0d\u5e94\u8be5\u6c61\u67d3\u65b0\u5bf9\u8bdd\u3002"
      });
      await Promise.resolve();
    });

    expect(
      screen.queryByText("\u65e7\u5bf9\u8bdd\u7684\u8fdf\u5230\u56de\u7b54\uff0c\u4e0d\u5e94\u8be5\u6c61\u67d3\u65b0\u5bf9\u8bdd\u3002")
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("assistant-pending")).not.toBeInTheDocument();
  });

  it("surfaces long-answer recovery context when a long local-model quiz request times out", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockRejectedValue(
      new Error("Local task exceeded the maximum execution time of 480 seconds.")
    );
    const longNumberedRequest = Array.from(
      { length: 16 },
      (_, index) => `${index + 1}. 这是一道需要回答和简要解释的题目。`
    ).join("\n");

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: `${longNumberedRequest}\n请逐题给出答案和简要解释。` }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.queryAllByText("本地模型对话失败").length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText(/本地模型响应超时/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/长回答保护已启用/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/自动分段、缺题补写和显式重试/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/model=qwen3\.6:35b/i).length).toBe(0);
    expect(screen.queryAllByText(/timeout=480s/i).length).toBe(0);
  });

  it("warns when a local-model answer still hits the output length limit after bounded continuation", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "第一段。\n\n第二段。\n\n第三段。",
      doneReason: "length"
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "请完整写一篇很长的学习计划分析报告。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText(/第一段/)).toBeInTheDocument();
    });
    expect(screen.queryAllByText(/已自动续写到安全上限/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/如仍缺少后续内容，可以发送“继续”或缩小范围后重试/).length).toBeGreaterThan(0);
  });

  it("continues a bounded length-limit local-model answer with prior context", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock
      .mockResolvedValueOnce({
        model: "qwen3.6:35b",
        message: "第一段。\n\n第二段。\n\n第三段。",
        doneReason: "length"
      })
      .mockResolvedValueOnce({
        model: "qwen3.6:35b",
        message: "第四段。"
      });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "请完整写一篇很长的学习计划分析报告。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText(/已自动续写到安全上限/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "继续" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText(/第四段/)).toBeInTheDocument();
    });

    expect(chatWithOllamaModelMock).toHaveBeenLastCalledWith(expect.objectContaining({
      model: "qwen3.6:35b",
      message: expect.stringContaining("上一轮本地模型回答因为输出长度限制仍可能未完整")
    }));
    const continuationMessage = chatWithOllamaModelMock.mock.calls.at(-1)?.[0]?.message as string;

    expect(continuationMessage).toContain("原始用户请求：");
    expect(continuationMessage).toContain("请完整写一篇很长的学习计划分析报告。");
    expect(continuationMessage).toContain("上一轮回答末尾：");
    expect(continuationMessage).toContain("第三段。");
    expect(continuationMessage).not.toBe("继续");
  });

  it("keeps the visible continuation user message short while sending recovered context to Ollama", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock
      .mockResolvedValueOnce({
        model: "qwen3.6:35b",
        message: "第一段。\n\n第二段。\n\n第三段。",
        doneReason: "length"
      })
      .mockResolvedValueOnce({
        model: "qwen3.6:35b",
        message: "第四段。"
      });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "请完整写一篇很长的学习计划分析报告。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText(/已自动续写到安全上限/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "continue" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText(/第四段/)).toBeInTheDocument();
    });

    expect(screen.getAllByText("continue").length).toBeGreaterThan(0);
    expect(screen.queryByText(/上一轮本地模型回答因为输出长度限制仍可能未完整/)).not.toBeInTheDocument();
    expect(chatWithOllamaModelMock).toHaveBeenLastCalledWith(expect.objectContaining({
      message: expect.stringContaining("上一轮本地模型回答因为输出长度限制仍可能未完整")
    }));
  });

  it("keeps the original long request across repeated visible continue commands", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock
      .mockResolvedValueOnce({
        model: "qwen3.6:35b",
        message: "第一段。\n\n第二段。\n\n第三段。",
        doneReason: "length"
      })
      .mockResolvedValueOnce({
        model: "qwen3.6:35b",
        message: "第四段。\n\n第五段。",
        doneReason: "length"
      })
      .mockResolvedValueOnce({
        model: "qwen3.6:35b",
        message: "第六段。"
      });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "请完整写一篇很长的学习计划分析报告。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText(/已自动续写到安全上限/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "继续" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText(/第四段/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "继续" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText(/第六段/)).toBeInTheDocument();
    });

    const secondContinuationMessage = chatWithOllamaModelMock.mock.calls.at(-1)?.[0]?.message as string;

    expect(screen.getAllByText("继续").length).toBeGreaterThanOrEqual(2);
    expect(secondContinuationMessage).toContain("原始用户请求：");
    expect(secondContinuationMessage).toContain("请完整写一篇很长的学习计划分析报告。");
    expect(secondContinuationMessage).not.toContain("原始用户请求：\n继续");
  });
});
