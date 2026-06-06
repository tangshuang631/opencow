import { describe, expect, it } from "vitest";
import { planLocalAssistantTask } from "./index.js";

describe("local assistant task planner packages overview", () => {
  it("plans a packages overview for package inspection requests", () => {
    const plan = planLocalAssistantTask({
      message: "inspect workspace packages and scripts",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "packages-overview",
      title: "Workspace packages overview"
    });
  });
});
