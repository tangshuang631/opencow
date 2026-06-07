import { describe, expect, it } from "vitest";
import { planLocalAssistantTask } from "./index.js";

describe("local assistant task planner project status workflow", () => {
  it("plans a readonly matched local desktop project status lookup without permission escalation", () => {
    const plan = planLocalAssistantTask({
      message: "show the status of the desktop app local run",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "workspace-project-status",
      title: "Matched local project status"
    });
  });
});
