import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const { chatWithOllamaModelMock, loadOllamaOverviewMock, searchNetworkMock } = vi.hoisted(() => ({
  chatWithOllamaModelMock: vi.fn(),
  loadOllamaOverviewMock: vi.fn(),
  searchNetworkMock: vi.fn()
}));

vi.mock("../features/ollama/ollamaService", () => ({
  chatWithOllamaModel: chatWithOllamaModelMock,
  loadOllamaOverview: loadOllamaOverviewMock
}));

vi.mock("../features/assistant/localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("../features/assistant/localAssistantService")>(
    "../features/assistant/localAssistantService"
  );

  return {
    ...actual,
    searchNetwork: searchNetworkMock
  };
});

vi.mock("../features/workbench/workbenchState", async () => {
  const actual = await vi.importActual<typeof import("../features/workbench/workbenchState")>(
    "../features/workbench/workbenchState"
  );

  return {
    ...actual,
    createInitialWorkbenchState: () =>
      actual.createSearchEnabledState(actual.createInitialWorkbenchState(), {
        provider: "Tavily",
        query: "软件体系设计 享元模式 内部状态 外部状态",
        sourceTitle: "Flyweight pattern reference",
        sourceUrl: "https://example.test/flyweight",
        summary: "享元模式通常把可共享且不随上下文变化的数据称为内部状态，把随使用场景变化的数据称为外部状态。"
      })
  };
});

describe("App chat search context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes compressed enabled-search references to the selected local model for ordinary chat", async () => {
    searchNetworkMock.mockResolvedValue({
      query: "软件体系设计的享元模式易懂的解释,以及它的内部状态和外部状态是什么",
      provider: "Tavily",
      effective_provider: "Tavily",
      used_fallback: false,
      fallback_reason: null,
      items: [
        {
          title: "Flyweight pattern reference",
          url: "https://example.test/flyweight",
          summary: "享元模式通常把可共享且不随上下文变化的数据称为内部状态，把随使用场景变化的数据称为外部状态。"
        }
      ]
    });
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "享元模式会共享内部状态，并把场景相关的外部状态从调用处传入。"
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "软件体系设计的享元模式易懂的解释,以及它的内部状态和外部状态是什么" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
    });
    expect(chatWithOllamaModelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen3.6:35b",
      message: expect.stringContaining("联网搜索参考")
    }));
    expect(chatWithOllamaModelMock.mock.calls[0]?.[0].requestId).toMatch(/^local-model-chat-/);
    expect(chatWithOllamaModelMock.mock.calls[0]?.[0].signal).toBeInstanceOf(AbortSignal);
    expect(chatWithOllamaModelMock.mock.calls[0]?.[0].message).toContain("只作为参考，不要盲信");
    expect(chatWithOllamaModelMock.mock.calls[0]?.[0].message).toContain("Flyweight pattern reference");
    expect(chatWithOllamaModelMock.mock.calls[0]?.[0].message).toContain("https://example.test/flyweight");
    expect(chatWithOllamaModelMock.mock.calls[0]?.[0].message).toContain("用户问题：软件体系设计的享元模式");
  });

  it("records selected Ollama model and bounded search context in the audit log", async () => {
    searchNetworkMock.mockResolvedValue({
      query: "软件体系设计的享元模式",
      provider: "Tavily",
      effective_provider: "Tavily",
      used_fallback: false,
      fallback_reason: null,
      items: [
        {
          title: "Flyweight pattern reference",
          url: "https://example.test/flyweight",
          summary: "享元模式通常把可共享且不随上下文变化的数据称为内部状态，把随使用场景变化的数据称为外部状态。"
        }
      ]
    });
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "享元模式会共享内部状态，并把场景相关的外部状态从调用处传入。"
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "软件体系设计的享元模式" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText(/享元模式会共享内部状态/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "审计" }));

    const auditPanel = await screen.findByRole("region", { name: "审计" });

    expect(within(auditPanel).getAllByText(/Ollama model: qwen3\.6:35b/).length).toBeGreaterThan(0);
    expect(within(auditPanel).getAllByText(/Search context items: 1\/3/).length).toBeGreaterThan(0);
    expect(within(auditPanel).getAllByText(/Search provider: Tavily/).length).toBeGreaterThan(0);
  });

  it("guides local models to compare explicit evidence instead of overusing insufficient-source refusals", async () => {
    searchNetworkMock.mockResolvedValueOnce({
      query: "python和java哪个历史更悠久",
      provider: "Tavily",
      effective_provider: "Tavily",
      used_fallback: false,
      fallback_reason: null,
      items: [
        {
          title: "Python history",
          url: "https://example.test/python-history",
          source_label: "Python Docs",
          summary: "Python started development in 1989 and was first released in 1991."
        },
        {
          title: "Java history",
          url: "https://example.test/java-history",
          source_label: "Oracle",
          summary: "Java was released by Sun Microsystems in 1995."
        }
      ]
    });
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "qwen3.6:35b", sizeLabel: "20 GB" }]
    });
    chatWithOllamaModelMock.mockResolvedValue({
      model: "qwen3.6:35b",
      message: "Python 更早：Python 1989 年开始开发，Java 1995 年发布。"
    });

    render(<App />);

    await screen.findByRole("button", { name: "选择模型：qwen3.6:35b" });

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "python和java哪个历史更悠久" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(chatWithOllamaModelMock).toHaveBeenCalled();
    });

    const prompt = chatWithOllamaModelMock.mock.calls[0]?.[0].message ?? "";
    expect(prompt).toContain("已找到与「python」相关的来源。只用这些来源中明确写出的事实比较。不要因为比较对象数量多就直接回答无法确认。");
    expect(prompt).toContain("已找到与「java」相关的来源。只用这些来源中明确写出的事实比较。不要因为比较对象数量多就直接回答无法确认。");
    expect(prompt).toContain("如果来源已经明确给出年份、版本号、发布时间、候选名称或否定关系，请先比较这些明确事实，再给出有条件结论。");
  });
});
