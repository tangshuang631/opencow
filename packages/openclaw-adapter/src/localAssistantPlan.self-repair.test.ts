import { describe, expect, it } from "vitest";
import { planLocalAssistantTask } from "./index.js";

describe("local assistant task planner self-repair preview", () => {
  it("plans a readonly opencow self-repair preview for explicit self-fix requests", () => {
    const plan = planLocalAssistantTask({
      message: "diagnose opencow and preview how to fix its current local error",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "opencow-self-repair-preview",
      title: "Opencow self-repair preview"
    });
  });
});
