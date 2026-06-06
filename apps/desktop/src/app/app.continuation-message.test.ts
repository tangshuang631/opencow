import { describe, expect, it } from "vitest";
import { createContinuationMessageFromPreview, resolveContinuationMessage } from "./App";
import { createInitialWorkbenchState, createUserTaskSubmittedState } from "../features/workbench/workbenchState";

describe("createContinuationMessageFromPreview", () => {
  it("converts preview wording into a continuation shell request", () => {
    expect(
      createContinuationMessageFromPreview(
        "rag-local-shell-handoff-preview",
        "review local shell permission rules and preview the next safe shell step to create a temp-output folder"
      )
    ).toBe("review local shell permission rules and continue to create a temp-output folder with shell automation");
  });

  it("converts plan wording into a continuation shell request", () => {
    expect(
      createContinuationMessageFromPreview(
        "rag-local-shell-handoff-preview",
        "review local shell permission rules and plan the next safe shell step to create a temp-output folder"
      )
    ).toBe("review local shell permission rules and continue to create a temp-output folder with shell automation");
  });

  it("converts workflow wording into a continuation shell request", () => {
    expect(
      createContinuationMessageFromPreview(
        "rag-local-shell-handoff-preview",
        "review local shell permission rules and workflow the next safe shell step to create a temp-output folder"
      )
    ).toBe("review local shell permission rules and continue to create a temp-output folder with shell automation");
  });

  it("resolves continue from the latest preview task even when the continuation is derived from summary text", () => {
    const withPreviewTask = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "review local shell permission rules and plan the next safe shell step to create a temp-output folder",
      executionKind: "rag-local-shell-handoff-preview",
      executionTitle: "Local RAG shell handoff preview",
      executionAuditSummary: "Local assistant planned a readonly local RAG shell handoff preview.",
      executionAuditDetail: "Readonly local RAG shell handoff preview task"
    });

    expect(resolveContinuationMessage("continue", withPreviewTask)).toBe(
      "review local shell permission rules and continue to create a temp-output folder with shell automation"
    );
  });
});
