import { describe, expect, it } from "vitest";
import { resolveOpencowSelfRepairTargetDescriptor } from "./selfRepairTargetDescriptor.js";

describe("opencow self-repair target descriptor", () => {
  it("resolves enabled skills registry metadata", () => {
    expect(
      resolveOpencowSelfRepairTargetDescriptor("diagnose opencow and continue repairing its enabled skills registry")
    ).toMatchObject({
      label: "enabled skills registry",
      path: ".opencow/skills/enabled-skills.json",
      continueRequest: "diagnose opencow and continue repairing its enabled skills registry"
    });
  });

  it("resolves enabled skills registry metadata from the explicit enabled skills path", () => {
    expect(
      resolveOpencowSelfRepairTargetDescriptor(
        "diagnose opencow and continue repairing .opencow/skills/enabled-skills.json"
      )
    ).toMatchObject({
      label: "enabled skills registry",
      path: ".opencow/skills/enabled-skills.json",
      continueRequest: "diagnose opencow and continue repairing its enabled skills registry"
    });
  });

  it("resolves workspace project runtime registry metadata", () => {
    expect(
      resolveOpencowSelfRepairTargetDescriptor(
        "diagnose opencow and continue repairing its workspace project runtime registry"
      )
    ).toMatchObject({
      label: "workspace project runtime registry",
      path: ".opencow/runtime/workspace-project-runs.json",
      continueRequest: "diagnose opencow and continue repairing its workspace project runtime registry"
    });
  });

  it("resolves workspace project runtime registry metadata from the explicit runtime registry path", () => {
    expect(
      resolveOpencowSelfRepairTargetDescriptor(
        "diagnose opencow and continue repairing .opencow/runtime/workspace-project-runs.json"
      )
    ).toMatchObject({
      label: "workspace project runtime registry",
      path: ".opencow/runtime/workspace-project-runs.json",
      continueRequest: "diagnose opencow and continue repairing its workspace project runtime registry"
    });
  });

  it("returns null metadata for generic self-repair wording", () => {
    expect(
      resolveOpencowSelfRepairTargetDescriptor("diagnose opencow and continue fixing its current local error")
    ).toEqual({
      label: null,
      path: null,
      continueRequest: null
    });
  });
});
