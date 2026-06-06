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

  it("requests workspace-write permission before continuing the enabled skills registry repair", () => {
    const plan = planLocalAssistantTask({
      message: "diagnose opencow and continue repairing its enabled skills registry",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "opencow-self-repair-enabled-skills-registry"
    });
  });
});
