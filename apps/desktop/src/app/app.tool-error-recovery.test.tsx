import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const { loadOllamaOverviewMock } = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn()
}));

vi.mock("../features/ollama/ollamaService", () => ({
  loadOllamaOverview: loadOllamaOverviewMock
}));

vi.mock("../features/workbench/workbenchState", async () => {
  const actual = await vi.importActual<typeof import("../features/workbench/workbenchState")>(
    "../features/workbench/workbenchState"
  );

  return {
    ...actual,
    createInitialWorkbenchState: vi.fn(() =>
      actual.createToolExecutionErrorState(actual.createInitialWorkbenchState(), {
        toolLabel: "RAG document parser",
        summary: "Document parsing failed",
        detail: "The selected PPTX could not be parsed.",
        actionLabel: "Try a smaller file or inspect the source document.",
        source: "rag_document_parser"
      })
    )
  };
});

vi.mock("../features/workbench/Workbench", () => ({
  Workbench: ({
    state,
    onRecoverToolError
  }: {
    state: import("../features/workbench/workbenchState").WorkbenchState;
    onRecoverToolError: () => void;
  }) => (
    <section aria-label="mock workbench">
      <p>{state.error?.summary ?? "no active error"}</p>
      <p>{state.output.title}</p>
      <button type="button" onClick={onRecoverToolError}>
        recover tool error
      </button>
    </section>
  )
}));

describe("App tool error recovery", () => {
  it("clears an active tool error through the workbench recovery action", async () => {
    loadOllamaOverviewMock.mockReturnValue(new Promise(() => {}));

    render(<App />);

    expect(screen.getByText("Document parsing failed")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "recover tool error" }));
    });

    expect(screen.getByText("no active error")).toBeInTheDocument();
    expect(screen.getByText("工具错误已处理")).toBeInTheDocument();
  });
});
