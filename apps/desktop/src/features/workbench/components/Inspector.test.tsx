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
  it("shows only task sheet, changes, and collapsed records entry by default", () => {
    renderInspector();

    expect(screen.getByLabelText("右侧面板")).toBeInTheDocument();
    expect(screen.getByText("任务单")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开变更" })).toBeInTheDocument();
    expect(screen.queryByText("还没有任务，发一条消息后会在这里生成任务单。")).not.toBeInTheDocument();
    expect(screen.getByText("暂无变更")).toBeInTheDocument();
    expect(screen.queryByText("当前还没有本地文件变更。")).not.toBeInTheDocument();
    expect(screen.queryByText("输出")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开配置与记录" })).toBeInTheDocument();
    expect(screen.queryByText("日志")).not.toBeInTheDocument();
  });

  it("renders a more specific checklist for the active local task", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "整理桌面端右侧面板",
      executionKind: "local-model-chat",
      executionTitle: "本地模型对话"
    });
    const running = createTaskExecutionStartedState(queued);

    renderInspector(running);

    expect(screen.queryByText(/任务摘要：/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "停止" })).not.toBeInTheDocument();
  });

  it("hides the task sheet when no processed planning summary can be produced for a long raw input", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message:
        "这是一个没有明确动作词、只是把很多背景连续堆在一起的超长输入，用来验证右侧任务单不会直接把原文塞进去而是选择不显示任务单，因为这种内容没有先被处理成可靠摘要之前不适合拿来直接展示在任务单里，否则后面还会出现更长的输入把右侧整个布局挤坏。",
      executionKind: "local-model-chat",
      executionTitle: "本地模型对话"
    });
    const running = createTaskExecutionStartedState(queued);

    renderInspector(running);

    expect(screen.queryByText("还没有任务，发一条消息后会在这里生成任务单。")).not.toBeInTheDocument();
    expect(screen.queryByText(/任务摘要：/)).not.toBeInTheDocument();
    expect(screen.queryByText(/这是一个没有明确动作词/)).not.toBeInTheDocument();
  });

  it("surfaces pending permission confirmation inline above the task sheet", () => {
    const pending = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "Need workspace write access before creating temp-output.",
      riskSummary: "Creating temp-output writes files inside the workspace."
    });

    renderInspector(pending);

    expect(screen.getAllByText("等待权限确认").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "批准提权" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消提权" })).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "批准高风险操作" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消高风险操作" })).toBeInTheDocument();
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

    expect(screen.getByText("3 个文件")).toBeInTheDocument();
    expect(screen.getAllByText("变更").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "展开变更" }));

    expect(screen.getByText("App.tsx")).toBeInTheDocument();
    expect(screen.getByText("global.css")).toBeInTheDocument();
    expect(screen.getByText("index.html")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "App.tsx 改动" }));

    expect(screen.getByText("完整路径：apps/desktop/src/app/App.tsx")).toBeInTheDocument();
    expect(screen.getByText("来源任务：展示站点写入完成")).toBeInTheDocument();
  });

  it("shows empty change detail only after expanding the change summary", () => {
    renderInspector();

    fireEvent.click(screen.getByRole("button", { name: "展开变更" }));

    expect(screen.getByText("当前没有新的本地文件改动。")).toBeInTheDocument();
  });

  it("shows compact added and removed line stats when the assistant result includes real diff numbers", () => {
    const submitted = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "整理变更摘要"
    });
    const completed = createTaskExecutionSucceededState(createTaskExecutionStartedState(submitted), {
      resultTitle: "变更整理完成",
      resultSummary:
        "变更路径：apps/desktop/src/app/App.tsx。 新增 117,043 行，删除 4,679 行。"
    });

    renderInspector(completed);

    expect(screen.getByText("+117,043")).toBeInTheDocument();
    expect(screen.getByText("-4,679")).toBeInTheDocument();
  });
});
