import { describe, expect, it } from "vitest";
import { planLocalAssistantTask } from "./index.js";

describe("local assistant task planner writable shell commands", () => {
  it("requests workspace-write permission before creating the temp-output directory", () => {
    const plan = planLocalAssistantTask({
      message: "create a temp-output folder for this workspace",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "workspace-write-create-temp-output"
    });
  });

  it("plans the temp-output directory creation after workspace-write permission is available", () => {
    const plan = planLocalAssistantTask({
      message: "create a temp-output folder for this workspace",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "workspace-write-create-temp-output",
      title: "Create temp-output directory"
    });
  });
});
