import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Inspector } from "./Inspector";
import {
  createHighRiskConfirmationState,
  createInitialWorkbenchState,
  createTaskExecutionStartedState,
  createTaskExecutionSucceededState,
  createUserTaskSubmittedState,
  requestPermissionModeChangeState
} from "../workbenchState";

function createInspectorProps(state = createInitialWorkbenchState()) {
  const noop = vi.fn();

  return {
    state,
    onApproveDangerousAction: noop,
    onCancelDangerousAction: noop,
    onApprovePermissionRequest: noop,
    onCancelPermissionRequest: noop,
    onRetryOllamaCheck: noop,
    onRecoverToolError: noop,
    onPreviewRollback: noop,
    onApplyRollback: noop,
    onCancelRollback: noop,
    onRetryLocalTask: noop,
    onCancelActiveTask: noop,
    onUpdateRollbackLimit: noop,
    onCleanupStorage: noop,
    onToggleRemoteApi: noop,
    onToggleSearch: noop,
    onSaveRemoteApiConfig: noop,
    onSaveSearchProviderConfig: noop
  };
}

function renderInspector(state = createInitialWorkbenchState()) {
  return render(<Inspector {...createInspectorProps(state)} />);
}

describe("Inspector", () => {
  it("shows only task sheet and changes by default", () => {
    renderInspector();

    expect(screen.getByLabelText("右侧面板")).toBeInTheDocument();
    expect(screen.getByText("任务单")).toBeInTheDocument();
    expect(screen.getByText("变更")).toBeInTheDocument();
    expect(screen.getByText("还没有任务，发一条消息后会在这里生成任务单。")).toBeInTheDocument();
    expect(screen.getByText("当前还没有可展示的本地文件变更。")).toBeInTheDocument();
    expect(screen.queryByText("输出")).not.toBeInTheDocument();
    expect(screen.queryByText("配置与记录")).not.toBeInTheDocument();
  });

  it("renders a checklist for the active local task", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "整理桌面端右侧面板",
      executionKind: "local-model-chat",
      executionTitle: "本地模型对话"
    });
    const running = createTaskExecutionStartedState(queued);

    renderInspector(running);

    expect(screen.getByText("接收当前请求")).toBeInTheDocument();
    expect(screen.getByText("规划执行方式")).toBeInTheDocument();
    expect(screen.getByText("本地模型对话")).toBeInTheDocument();
    expect(screen.getByText("整理最终回复")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "停止" })).toBeInTheDocument();
  });

  it("surfaces pending permission confirmation inline above the task sheet", () => {
    const pending = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "Need workspace write access before creating temp-output.",
      riskSummary: "Creating temp-output writes files inside the workspace."
    });

    renderInspector(pending);

    expect(screen.getAllByText("等待权限确认").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "批准" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();
  });

  it("surfaces pending dangerous confirmation inline above the task sheet", () => {
    const pending = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "等待高风险确认",
      summary: "准备删除临时目录。",
      commandPreview: "rm -rf temp-output",
      impact: "删除 temp-output 目录",
      requiredMode: "controlled-full"
    });

    renderInspector(pending);

    expect(screen.getAllByText("等待高风险确认").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "批准" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();
  });

  it("lists file changes extracted from assistant results and expands details", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "写入展示站点"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "展示站点写入完成",
      resultSummary:
        "匹配项目：desktop。 变更路径：apps/desktop/src/app/App.tsx、apps/desktop/src/styles/global.css。 产物路径：.opencow/artifacts/demo/index.html。"
    });

    renderInspector(completed);

    expect(screen.getByText("App.tsx")).toBeInTheDocument();
    expect(screen.getByText("global.css")).toBeInTheDocument();
    expect(screen.getByText("index.html")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "App.tsx 改动" }));

    expect(screen.getByText("完整路径：apps/desktop/src/app/App.tsx")).toBeInTheDocument();
    expect(screen.getByText("来源任务：展示站点写入完成")).toBeInTheDocument();
  });
});
