import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Inspector } from "../features/workbench/components/Inspector";
import {
  approvePendingConfirmationState,
  approvePermissionModeChangeState,
  cancelPendingConfirmationState,
  cancelPermissionModeChangeState,
  createHighRiskConfirmationState,
  createInitialWorkbenchState,
  requestPermissionModeChangeState
} from "../features/workbench/workbenchState";

const { loadOllamaOverviewMock } = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn()
}));

vi.mock("../features/ollama/ollamaService", () => ({
  loadOllamaOverview: loadOllamaOverviewMock
}));

import { App } from "./App";

describe("App", () => {
  it("keeps the workbench visible and shows rollback records", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    render(<App />);

    expect(screen.getByRole("button", { name: "新对话" })).toBeInTheDocument();
    expect(screen.getByText("回退记录")).toBeInTheDocument();
    expect(screen.getByText("启动基线")).toBeInTheDocument();
    expect(await screen.findByText("来源: ollama_overview")).toBeInTheDocument();
  });

  it("renders the local-first workbench shell", async () => {
    loadOllamaOverviewMock.mockResolvedValueOnce({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

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
    expect(screen.getAllByText("来源: ollama_overview").length).toBeGreaterThan(0);
    expect(screen.getByText("高风险操作需确认")).toBeInTheDocument();
    expect(screen.getByText("Shell 受权限、超时与工作目录限制")).toBeInTheDocument();
    expect(screen.getAllByText("仅允许读取已授权目录与附件。").length).toBeGreaterThan(0);
    expect(screen.getByText("当前权限: 只读 · 敏感操作需弹窗确认")).toBeInTheDocument();
    expect(screen.getByText("权限确认")).toBeInTheDocument();
    expect(screen.getByText("删除、覆盖、递归删除、进程结束前必须弹窗确认。")).toBeInTheDocument();
    expect(screen.getByText("当前没有待确认的高风险操作")).toBeInTheDocument();
    expect(screen.getByText("当前没有待确认的权限升级")).toBeInTheDocument();
  });

  it("surfaces a traceable error when loading Ollama overview throws", async () => {
    loadOllamaOverviewMock.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:11434"));

    render(<App />);

    expect(screen.getByRole("button", { name: "新对话" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("无法连接本地 Ollama")).toBeInTheDocument();
    });

    expect(screen.getAllByText("来源: ollama_overview").length).toBeGreaterThan(0);
    expect(screen.getByText("建议: 检查 Ollama 服务")).toBeInTheDocument();
  });

  it("renders pending confirmation details for dangerous actions", () => {
    const state = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "确认删除临时目录",
      summary: "模型计划删除工作区内的 temp-output 目录。",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "将删除 12 个文件，写入回退快照后才可执行。",
      requiredMode: "controlled-full"
    });

    render(<Inspector state={state} />);

    expect(screen.getByText("确认删除临时目录")).toBeInTheDocument();
    expect(screen.getAllByText("模型计划删除工作区内的 temp-output 目录。").length).toBeGreaterThan(0);
    expect(screen.getByText("命令预览: Remove-Item .\\temp-output -Recurse")).toBeInTheDocument();
    expect(screen.getByText("影响范围: 将删除 12 个文件，写入回退快照后才可执行。")).toBeInTheDocument();
    expect(screen.getByText("所需权限: controlled-full")).toBeInTheDocument();
  });

  it("shows an approved confirmation as cleared and traceable", () => {
    const pending = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "确认删除临时目录",
      summary: "模型计划删除工作区内的 temp-output 目录。",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "将删除 12 个文件，写入回退快照后才可执行。",
      requiredMode: "controlled-full"
    });

    const approved = approvePendingConfirmationState(pending);

    render(<Inspector state={approved} />);

    expect(screen.getByText("当前没有待确认的高风险操作")).toBeInTheDocument();
    expect(screen.getByText("用户已批准高风险操作")).toBeInTheDocument();
    expect(screen.getByText("已批准操作")).toBeInTheDocument();
  });

  it("shows a cancelled confirmation as cleared and safe", () => {
    const pending = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "确认删除临时目录",
      summary: "模型计划删除工作区内的 temp-output 目录。",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "将删除 12 个文件，写入回退快照后才可执行。",
      requiredMode: "controlled-full"
    });

    const cancelled = cancelPendingConfirmationState(pending);

    render(<Inspector state={cancelled} />);

    expect(screen.getByText("当前没有待确认的高风险操作")).toBeInTheDocument();
    expect(screen.getByText("用户已取消高风险操作")).toBeInTheDocument();
    expect(screen.getByText("已取消操作")).toBeInTheDocument();
  });

  it("renders a pending permission mode change request", () => {
    const requested = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "需要在工作区内写入修复文件。",
      riskSummary: "允许在授权工作区内创建和修改文件，但仍禁止高风险删除。"
    });

    render(<Inspector state={requested} />);

    expect(screen.getByText("待切换权限: workspace-write")).toBeInTheDocument();
    expect(screen.getByText("提权原因: 需要在工作区内写入修复文件。")).toBeInTheDocument();
    expect(screen.getByText("风险说明: 允许在授权工作区内创建和修改文件，但仍禁止高风险删除。")).toBeInTheDocument();
  });

  it("renders an approved permission mode change", () => {
    const requested = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "需要在工作区内写入修复文件。",
      riskSummary: "允许在授权工作区内创建和修改文件，但仍禁止高风险删除。"
    });
    const approved = approvePermissionModeChangeState(requested);

    render(<Inspector state={approved} />);

    expect(screen.getByText("权限: 工作区读写")).toBeInTheDocument();
    expect(screen.getByText("允许在授权工作区内创建和修改文件。")).toBeInTheDocument();
    expect(screen.getByText("用户已批准权限升级")).toBeInTheDocument();
    expect(screen.getByText("当前没有待确认的权限升级")).toBeInTheDocument();
  });

  it("renders a cancelled permission mode change", () => {
    const requested = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "controlled-full",
      reason: "需要执行受控高风险操作。",
      riskSummary: "允许受控高风险操作，但必须保留确认、日志、超时和回退。"
    });
    const cancelled = cancelPermissionModeChangeState(requested);

    render(<Inspector state={cancelled} />);

    expect(screen.getByText("权限: 只读")).toBeInTheDocument();
    expect(screen.getByText("用户已取消权限升级")).toBeInTheDocument();
    expect(screen.getByText("当前没有待确认的权限升级")).toBeInTheDocument();
  });
});
