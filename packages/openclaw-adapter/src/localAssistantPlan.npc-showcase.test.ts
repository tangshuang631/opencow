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
    if (plan.kind !== "npc-local-project-showcase-preview") {
      throw new Error(`Unexpected plan kind: ${plan.kind}`);
    }

    expect(plan.summary).toContain("Shell 出问题时，可以把它当成一个可对话恢复的受控能力来处理");
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
    if (plan.kind !== "permission-request") {
      throw new Error(`Unexpected plan kind: ${plan.kind}`);
    }
    expect(plan.reason).toContain("Shell 出问题时，可以把它当成一个可对话恢复的受控能力来处理");
    expect(plan.riskSummary).toContain("Shell 出问题时，可以把它当成一个可对话恢复的受控能力来处理");
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

  it("requests workspace-write before capturing a matched npc showcase screenshot", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to capture a screenshot from the matched cattle project now",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "npc-local-project-screenshot-capture",
      queuedExecutionTitle: "NPC local project screenshot capture"
    });
    if (plan.kind !== "permission-request") {
      throw new Error(`Unexpected plan kind: ${plan.kind}`);
    }
    expect(plan.reason).toContain("Shell 出问题时，可以把它当成一个可对话恢复的受控能力来处理");
    expect(plan.riskSummary).toContain("Shell 出问题时，可以把它当成一个可对话恢复的受控能力来处理");
  });

  it("plans npc screenshot capture after workspace-write is approved", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to capture a screenshot from the matched cattle project now",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-project-screenshot-capture",
      title: "NPC local project screenshot capture"
    });
  });

  it("requests workspace-write before generating a matched npc showcase site", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to generate the showcase site for the matched cattle project now",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "npc-local-project-showcase-site-write",
      queuedExecutionTitle: "NPC local project showcase-site write"
    });
    if (plan.kind !== "permission-request") {
      throw new Error(`Unexpected plan kind: ${plan.kind}`);
    }
    expect(plan.reason).toContain("Shell 出问题时，可以把它当成一个可对话恢复的受控能力来处理");
    expect(plan.riskSummary).toContain("Shell 出问题时，可以把它当成一个可对话恢复的受控能力来处理");
  });

  it("plans npc showcase-site write after workspace-write is approved", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to generate the showcase site for the matched cattle project now",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-project-showcase-site-write",
      title: "NPC local project showcase-site write"
    });
  });

  it("plans a readonly npc showcase publish preview for explicit post-write review wording", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to preview the generated showcase output for the matched cattle project before git",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-project-showcase-publish-preview",
      title: "NPC local project showcase publish preview"
    });
    if (plan.kind !== "npc-local-project-showcase-publish-preview") {
      throw new Error(`Unexpected plan kind: ${plan.kind}`);
    }
    expect(plan.summary).toContain("Shell 出问题时，可以把它当成一个可对话恢复的受控能力来处理");
  });

  it("includes the shared recovery narrative in npc git confirmation preview wording", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to prepare the showcase changes for commit for the matched cattle project",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-project-showcase-git-confirmation-preview",
      title: "NPC local project showcase git confirmation preview"
    });
    if (plan.kind !== "npc-local-project-showcase-git-confirmation-preview") {
      throw new Error(`Unexpected plan kind: ${plan.kind}`);
    }
    expect(plan.summary).toContain("Shell 出问题时，可以把它当成一个可对话恢复的受控能力来处理");
  });

  it("keeps publish preview for showcase artifact review wording without switching to the git confirmation stage", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to review the generated showcase artifacts and changed output files for the matched cattle project",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-project-showcase-publish-preview",
      title: "NPC local project showcase publish preview"
    });
  });

  it("plans a readonly npc showcase git confirmation preview for explicit commit-stage wording", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to prepare the showcase changes for commit for the matched cattle project",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-project-showcase-git-confirmation-preview",
      title: "NPC local project showcase git confirmation preview"
    });
  });

  it("does not collapse npc showcase git confirmation preview wording into generic git status", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to preview the git step for the matched cattle showcase before push",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-project-showcase-git-confirmation-preview",
      title: "NPC local project showcase git confirmation preview"
    });
  });
});
