import { describe, expect, it } from "vitest";
import { planLocalAssistantTask } from "./index.js";

describe("local assistant task planner skill-assisted rag shell handoff preview", () => {
  it("plans a readonly local RAG shell handoff preview for explicit docs-to-shell requests without skill or npc mediation", () => {
    const plan = planLocalAssistantTask({
      message: "review local shell permission rules and preview the next safe shell step to create a temp-output folder",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "rag-local-shell-handoff-preview",
      title: "Local RAG shell handoff preview"
    });
  });

  it("plans a readonly skill-assisted rag shell handoff preview for explicit docs-to-shell requests", () => {
    const plan = planLocalAssistantTask({
      message: "use the enabled docs skill to review local shell permission rules and preview the next safe shell step to delete temp-output",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "skills-local-enabled-rag-shell-handoff-preview",
      title: "Skill-assisted RAG shell handoff preview"
    });
  });

  it("plans a readonly npc-assisted rag shell handoff preview for explicit npc docs-to-shell requests", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to review local shell permission rules and preview the next safe shell step to delete temp-output",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-enabled-rag-shell-handoff-preview",
      title: "NPC-assisted RAG shell handoff preview"
    });
  });

  it("requests workspace-write permission before a local RAG handoff temp-output creation task can continue", () => {
    const plan = planLocalAssistantTask({
      message: "review local shell permission rules and continue to create a temp-output folder with shell automation",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "rag-local-shell-create-temp-output",
      queuedExecutionTitle: "Local RAG handoff temp-output creation"
    });
  });

  it("requests destructive confirmation after controlled-full permission is available for a local RAG handoff cleanup task", () => {
    const plan = planLocalAssistantTask({
      message: "review local shell permission rules and continue to delete temp-output with shell automation",
      permissionMode: "controlled-full"
    });

    expect(plan).toMatchObject({
      kind: "confirmation",
      queuedExecutionKind: "rag-local-shell-remove-temp-output",
      queuedExecutionTitle: "Local RAG handoff temp-output removal"
    });
  });
});
