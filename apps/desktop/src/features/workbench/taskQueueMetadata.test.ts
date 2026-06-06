import { describe, expect, it } from "vitest";
import { createInitialWorkbenchState, createUserTaskSubmittedState } from "./workbenchState";

describe("task queue metadata", () => {
  it("stores readonly assistant execution metadata on queued tasks", () => {
    const state = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "inspect workspace config and root scripts",
      executionKind: "workspace-config-overview",
      executionTitle: "Workspace config overview",
      executionAuditSummary: "Local assistant planned a workspace config overview task.",
      executionAuditDetail: "Readonly workspace config overview task."
    });

    expect(state.tasks.items[0]).toMatchObject({
      executionKind: "workspace-config-overview",
      executionTitle: "Workspace config overview",
      executionAuditSummary: "Local assistant planned a workspace config overview task.",
      executionAuditDetail: "Readonly workspace config overview task."
    });
  });

  it("stores readonly shell assistant execution kinds on queued tasks", () => {
    const state = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "check git status for this workspace",
      executionKind: "readonly-shell-git-status",
      executionTitle: "Workspace git status",
      executionAuditSummary: "Local assistant planned a readonly git status command.",
      executionAuditDetail: "Readonly shell command task: git status --short"
    });

    expect(state.tasks.items[0]).toMatchObject({
      executionKind: "readonly-shell-git-status",
      executionTitle: "Workspace git status",
      executionAuditSummary: "Local assistant planned a readonly git status command.",
      executionAuditDetail: "Readonly shell command task: git status --short"
    });
  });

  it("stores preview continuation metadata on queued tasks", () => {
    const state = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "use npc collaboration to review local shell permission rules and preview the next safe shell step to create a temp-output folder",
      executionKind: "npc-local-enabled-rag-shell-handoff-preview",
      executionTitle: "NPC-assisted RAG shell handoff preview",
      executionAuditSummary: "Local assistant planned a readonly NPC-assisted RAG shell handoff preview.",
      executionAuditDetail: "NPC-assisted readonly RAG shell handoff preview task",
      continuationMessage:
        "use npc collaboration to review local shell permission rules and continue to create a temp-output folder"
    });

    expect(state.tasks.items[0]).toMatchObject({
      executionKind: "npc-local-enabled-rag-shell-handoff-preview",
      continuationMessage:
        "use npc collaboration to review local shell permission rules and continue to create a temp-output folder"
    });
  });

  it("stores continuation metadata generated from plan wording on queued preview tasks", () => {
    const state = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "review local shell permission rules and plan the next safe shell step to create a temp-output folder",
      executionKind: "rag-local-shell-handoff-preview",
      executionTitle: "Local RAG shell handoff preview",
      executionAuditSummary: "Local assistant planned a readonly local RAG shell handoff preview.",
      executionAuditDetail: "Readonly local RAG shell handoff preview task",
      continuationMessage:
        "review local shell permission rules and continue to create a temp-output folder with shell automation"
    });

    expect(state.tasks.items[0]).toMatchObject({
      executionKind: "rag-local-shell-handoff-preview",
      continuationMessage:
        "review local shell permission rules and continue to create a temp-output folder with shell automation"
    });
  });
});
