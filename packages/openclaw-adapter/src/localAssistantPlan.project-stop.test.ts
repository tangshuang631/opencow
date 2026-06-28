import { describe, expect, it } from "vitest";
import { planLocalAssistantTask } from "./index.js";

describe("local assistant task planner project stop workflow", () => {
  it("requests workspace-write before stopping a matched local desktop project", () => {
    const plan = planLocalAssistantTask({
      message: "stop the desktop app local run",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "workspace-project-stop",
      queuedExecutionTitle: "Stop matched local project"
    });
  });

  it("plans the matched local desktop project stop after workspace-write is approved", () => {
    const plan = planLocalAssistantTask({
      message: "stop the desktop app local run",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "workspace-project-stop",
      title: "Stop matched local project"
    });
  });
});
