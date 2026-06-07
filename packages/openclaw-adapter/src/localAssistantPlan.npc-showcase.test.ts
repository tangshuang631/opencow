import { describe, expect, it } from "vitest";
import { planLocalAssistantTask } from "./index.js";

describe("local assistant task planner npc showcase workflow", () => {
  it("plans a readonly npc showcase workflow preview for explicit local project showcase requests", () => {
    const plan = planLocalAssistantTask({
      message:
        "use npc collaboration to inspect and run the local cattle project, capture screenshots, and generate a resume-ready showcase website in my git repo",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-project-showcase-preview",
      title: "NPC local project showcase preview"
    });
  });

  it("requests workspace-write before running a matched npc showcase project", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to run the matched cattle project now",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "npc-local-project-run",
      queuedExecutionTitle: "NPC local project run"
    });
  });

  it("plans the npc local project run after workspace-write is approved", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to run the matched cattle project now",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-project-run",
      title: "NPC local project run"
    });
  });
});
