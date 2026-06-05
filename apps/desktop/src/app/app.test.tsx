import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../features/ollama/ollamaService", () => ({
  loadOllamaOverview: vi.fn().mockResolvedValue({
    reachable: true,
    endpoint: "http://127.0.0.1:11434",
    selectedModel: "qwen2.5-coder:7b",
    diagnostic: "",
    models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
  })
}));

import { App } from "./App";

describe("App", () => {
  it("renders the local-first workbench shell", async () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "新对话" })).toBeInTheDocument();
    expect(screen.getAllByText("Ollama 本地优先").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("当前权限")).toHaveTextContent("只读");
    expect(screen.getByRole("textbox", { name: "输入任务" })).toBeInTheDocument();
    expect(screen.getByText("输出")).toBeInTheDocument();
    expect((await screen.findAllByText("qwen2.5-coder:7b")).length).toBeGreaterThan(0);
    expect(screen.getByText("高级设置")).toBeInTheDocument();
    expect(screen.getByText("远程 API 默认关闭")).toBeInTheDocument();
    expect(screen.getByText("已读取 1 个本地模型")).toBeInTheDocument();
    expect(screen.getByText("来源: ollama_overview")).toBeInTheDocument();
  });
});
