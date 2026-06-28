import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  createInitialWorkbenchState,
  createRollbackLimitUpdatedState,
  requestRollbackPreviewState
} from "../workbenchState";
import { RollbackPanel } from "./RollbackPanel";

function renderRollbackPanel(state = createRollbackLimitUpdatedState(createInitialWorkbenchState(), 15)) {
  const onPreviewRollback = vi.fn();
  const onApplyRollback = vi.fn();
  const onCancelRollback = vi.fn();

  const view = render(
    <RollbackPanel
      state={state}
      onPreviewRollback={onPreviewRollback}
      onApplyRollback={onApplyRollback}
      onCancelRollback={onCancelRollback}
    />
  );

  return {
    ...view,
    onPreviewRollback,
    onApplyRollback,
    onCancelRollback
  };
}

describe("RollbackPanel", () => {
  it("does not render rollback history controls when no rollback preview is pending", () => {
    const { container, onPreviewRollback } = renderRollbackPanel();

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("回退记录")).not.toBeInTheDocument();
    expect(screen.queryByText("当前没有待确认的回退操作")).not.toBeInTheDocument();
    expect(screen.queryByText("已记录 2 个回退点，详情已收纳。")).not.toBeInTheDocument();
    expect(screen.queryByText("回退点上限调整")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "展开回退记录" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /预览回退到/i })).not.toBeInTheDocument();
    expect(onPreviewRollback).not.toHaveBeenCalled();
  });

  it("keeps pending rollback confirmation visible without expanding history", () => {
    const stateWithEntries = createRollbackLimitUpdatedState(createInitialWorkbenchState(), 15);
    const pending = requestRollbackPreviewState(stateWithEntries, "startup-baseline");

    renderRollbackPanel(pending);

    expect(screen.getByText("目标回退点: 启动基线")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认回退" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消回退" })).toBeInTheDocument();
    expect(screen.queryByText("已记录 2 个回退点，详情已收纳。")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "展开回退记录" })).not.toBeInTheDocument();
    expect(screen.queryByText("回退点上限调整")).not.toBeInTheDocument();
  });
});
