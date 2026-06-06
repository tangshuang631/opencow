import { describe, expect, it } from "vitest";
import { planLocalAssistantTask } from "./index.js";

describe("local assistant task planner project run workflow", () => {
  it("requests workspace-write before running a matched local desktop project", () => {
    const plan = planLocalAssistantTask({
      message: "run the desktop app locally",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "workspace-project-run",
      queuedExecutionTitle: "Run matched local project"
    });
  });

  it("plans the matched local desktop project run after workspace-write is approved", () => {
    const plan = planLocalAssistantTask({
      message: "run the desktop app locally",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "workspace-project-run",
      title: "Run matched local project"
    });
  });
});
