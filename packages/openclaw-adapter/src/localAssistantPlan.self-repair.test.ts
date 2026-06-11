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
    expect(plan).toMatchObject({
      reason: expect.stringContaining(".opencow/skills/enabled-skills.json"),
      riskSummary: expect.stringContaining("verify the schema version and enabled entry count")
    });
  });

  it("requests workspace-write permission before continuing the workspace project runtime registry repair", () => {
    const plan = planLocalAssistantTask({
      message: "diagnose opencow and continue repairing its workspace project runtime registry",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "opencow-self-repair-workspace-project-runtime-registry"
    });
    expect(plan).toMatchObject({
      reason: expect.stringContaining(".opencow/runtime/workspace-project-runs.json"),
      riskSummary: expect.stringContaining("verify the schema version and runtime run count")
    });
  });

  it("requests workspace-write permission when continuing repair for the explicit runtime registry path", () => {
    const plan = planLocalAssistantTask({
      message: "diagnose opencow and continue repairing .opencow/runtime/workspace-project-runs.json",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "opencow-self-repair-workspace-project-runtime-registry"
    });
    expect(plan).toMatchObject({
      reason: expect.stringContaining(".opencow/runtime/workspace-project-runs.json"),
      riskSummary: expect.stringContaining("verify the schema version and runtime run count")
    });
  });

  it("stops a generic self-repair continue request and asks for a narrower repair target instead of looping the preview", () => {
    const plan = planLocalAssistantTask({
      message: "diagnose opencow and continue fixing its current local error",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "opencow-self-repair-target-guidance",
      title: "Clarify opencow self-repair target"
    });
  });
});
