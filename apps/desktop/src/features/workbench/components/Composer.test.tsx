import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";
import { createInitialWorkbenchState, createTaskExecutionStartedState, createUserTaskSubmittedState } from "../workbenchState";

describe("Composer", () => {
  it("does not submit blank input", () => {
    const onSubmitTask = vi.fn();
    const state = createInitialWorkbenchState();

    render(<Composer state={state} onSubmitTask={onSubmitTask} onCancelActiveTask={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: "输入任务" }), {
      target: { value: "   " }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmitTask).not.toHaveBeenCalled();
  });

  it("submits trimmed input once and clears the draft", () => {
    const onSubmitTask = vi.fn();
    const state = createInitialWorkbenchState();

    render(<Composer state={state} onSubmitTask={onSubmitTask} onCancelActiveTask={vi.fn()} />);

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

    render(<Composer state={running} onSubmitTask={vi.fn()} onCancelActiveTask={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "输入任务" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "停止任务" })).toBeInTheDocument();
  });
});
