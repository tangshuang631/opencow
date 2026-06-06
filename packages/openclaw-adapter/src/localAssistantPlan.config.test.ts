import { describe, expect, it } from "vitest";
import { planLocalAssistantTask } from "./index.js";

describe("local assistant task planner config overview", () => {
  it("plans a config overview for workspace configuration inspection requests", () => {
    const plan = planLocalAssistantTask({
      message: "inspect workspace config and root scripts",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "workspace-config-overview",
      title: "Workspace config overview"
    });
  });
});
