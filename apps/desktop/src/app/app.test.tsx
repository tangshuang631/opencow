import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the local-first workbench shell", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "新对话" })).toBeInTheDocument();
    expect(screen.getAllByText("Ollama 本地优先").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("当前权限")).toHaveTextContent("只读");
    expect(screen.getByRole("textbox", { name: "输入任务" })).toBeInTheDocument();
    expect(screen.getByText("输出")).toBeInTheDocument();
  });
});
