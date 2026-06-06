import { describe, expect, it } from "vitest";
import { planLocalAssistantTask } from "./index.js";

describe("local assistant task planner", () => {
  it("plans a readonly workspace overview for ordinary local assistant requests", () => {
    const plan = planLocalAssistantTask({
      message: "inspect the current workspace and summarize it",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "workspace-overview",
      title: "Workspace overview"
    });
  });

  it("requests controlled full permission for destructive cleanup tasks", () => {
    const plan = planLocalAssistantTask({
      message: "delete temp-output and clean temporary files",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "controlled-full",
      queuedMessage: "delete temp-output and clean temporary files"
    });
  });

  it("requires confirmation for destructive cleanup after permission is available", () => {
    const plan = planLocalAssistantTask({
      message: "delete temp-output and clean temporary files",
      permissionMode: "controlled-full"
    });

    expect(plan).toMatchObject({
      kind: "confirmation",
      requiredMode: "controlled-full",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory"
    });
  });
});
