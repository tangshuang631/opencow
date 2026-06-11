import { describe, expect, it } from "vitest";
import { planLocalAssistantTask } from "./index.js";

describe("local assistant task planner capability catalogs", () => {
  it("plans a RAG capability overview for retrieval requests", () => {
    const plan = planLocalAssistantTask({
      message: "inspect the local RAG capability wiring",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "capability-rag-overview",
      title: "OpenClaw RAG capability overview"
    });
  });

  it("plans a Skills capability overview for skill ecosystem requests", () => {
    const plan = planLocalAssistantTask({
      message: "check local skills capability readiness",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "capability-skills-overview",
      title: "OpenClaw Skills capability overview"
    });
  });

  it("plans a real local skills scan for explicit skills inventory requests", () => {
    const plan = planLocalAssistantTask({
      message: "scan local skills and list available skill entries",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "skills-local-scan",
      title: "Local Skills scan"
    });
  });

  it("plans a real local skill detail lookup for explicit skill inspection requests", () => {
    const plan = planLocalAssistantTask({
      message: "show details for the coding-agent skill",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "skills-local-inspect",
      title: "Local Skill detail"
    });
  });

  it("requests workspace-write permission before enabling a local skill", () => {
    const plan = planLocalAssistantTask({
      message: "enable the coding-agent skill for this workspace",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "skills-local-enable",
      queuedExecutionTitle: "Enable local skill"
    });
  });

  it("plans a real local skill enable task after workspace-write permission is available", () => {
    const plan = planLocalAssistantTask({
      message: "enable the coding-agent skill for this workspace",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "skills-local-enable",
      title: "Enable local skill"
    });
  });

  it("requests workspace-write permission before installing a local skill into the workspace", () => {
    const plan = planLocalAssistantTask({
      message: "install the gpt-taste skill into this workspace skills folder",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "skills-local-install",
      queuedExecutionTitle: "Install local skill"
    });
  });

  it("plans a real local skill install task after workspace-write permission is available", () => {
    const plan = planLocalAssistantTask({
      message: "install the gpt-taste skill into this workspace skills folder",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "skills-local-install",
      title: "Install local skill"
    });
  });

  it("requests workspace-write permission before disabling a local skill", () => {
    const plan = planLocalAssistantTask({
      message: "disable the coding-agent skill for this workspace",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "skills-local-disable",
      queuedExecutionTitle: "Disable local skill"
    });
  });

  it("plans a real local skill disable task after workspace-write permission is available", () => {
    const plan = planLocalAssistantTask({
      message: "disable the coding-agent skill for this workspace",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "skills-local-disable",
      title: "Disable local skill"
    });
  });

  it("requests workspace-write permission before a skill-assisted temp-output creation task", () => {
    const plan = planLocalAssistantTask({
      message: "use the enabled shell automation skill to create a temp-output folder for this workspace",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "skills-local-enabled-shell-create-temp-output",
      queuedExecutionTitle: "Skill-assisted temp-output creation"
    });
  });

  it("plans a skill-assisted temp-output creation task after workspace-write permission is available", () => {
    const plan = planLocalAssistantTask({
      message: "use the enabled shell automation skill to create a temp-output folder for this workspace",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "skills-local-enabled-shell-create-temp-output",
      title: "Skill-assisted temp-output creation"
    });
  });

  it("requests controlled-full permission before a skill-assisted destructive temp-output cleanup task", () => {
    const plan = planLocalAssistantTask({
      message: "use the enabled shell automation skill to delete temp-output and clean temporary files",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "controlled-full"
    });
  });

  it("requests destructive confirmation after controlled-full permission is available for a skill-assisted cleanup task", () => {
    const plan = planLocalAssistantTask({
      message: "use the enabled shell automation skill to delete temp-output and clean temporary files",
      permissionMode: "controlled-full"
    });

    expect(plan).toMatchObject({
      kind: "confirmation",
      queuedExecutionKind: "skills-local-enabled-shell-remove-temp-output",
      queuedExecutionTitle: "Skill-assisted temp-output removal"
    });
  });

  it("plans a real local enabled skills list for explicit enabled skill requests", () => {
    const plan = planLocalAssistantTask({
      message: "show enabled skills for this workspace",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "skills-local-enabled-list",
      title: "Enabled local skills"
    });
  });

  it("plans a readonly enabled local skill match for explicit recommendation requests", () => {
    const plan = planLocalAssistantTask({
      message: "which enabled skill should handle shell automation in this workspace",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "skills-local-enabled-match",
      title: "Match enabled local skills"
    });
  });

  it("plans a skill-assisted readonly local RAG search for enabled skill doc lookup requests", () => {
    const plan = planLocalAssistantTask({
      message: "use the enabled docs skill to search local rules for shell permission guidance",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "skills-local-enabled-rag-doc-search",
      title: "Skill-assisted local RAG document search"
    });
  });

  it("requests workspace-write permission before a skill-assisted RAG handoff temp-output creation task", () => {
    const plan = planLocalAssistantTask({
      message: "use the enabled docs skill to review local shell permission rules and continue to create a temp-output folder with shell automation",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "skills-local-enabled-rag-shell-create-temp-output",
      queuedExecutionTitle: "Skill-assisted RAG handoff temp-output creation"
    });
  });

  it("plans a skill-assisted RAG handoff temp-output creation task after workspace-write permission is available", () => {
    const plan = planLocalAssistantTask({
      message: "use the enabled docs skill to review local shell permission rules and continue to create a temp-output folder with shell automation",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "skills-local-enabled-rag-shell-create-temp-output",
      title: "Skill-assisted RAG handoff temp-output creation"
    });
  });

  it("requests destructive confirmation after controlled-full permission is available for a skill-assisted RAG handoff cleanup task", () => {
    const plan = planLocalAssistantTask({
      message: "use the enabled docs skill to review local shell permission rules and continue to delete temp-output with shell automation",
      permissionMode: "controlled-full"
    });

    expect(plan).toMatchObject({
      kind: "confirmation",
      queuedExecutionKind: "skills-local-enabled-rag-shell-remove-temp-output",
      queuedExecutionTitle: "Skill-assisted RAG handoff temp-output removal"
    });
  });

  it("plans an NPC capability overview for npc collaboration requests", () => {
    const plan = planLocalAssistantTask({
      message: "inspect npc collaboration readiness",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "capability-npc-overview",
      title: "OpenClaw NPC capability overview"
    });
  });

  it("plans a Chinese course assistant NPC configuration instead of a generic capability overview", () => {
    const plan = planLocalAssistantTask({
      message: "你能帮我配置一个课程助手npc吗",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "npc-course-assistant-config",
      title: "课程助手 NPC 配置方案"
    });
  });

  it("plans a readonly npc collaboration preview for explicit npc planning requests", () => {
    const plan = planLocalAssistantTask({
      message: "preview an npc collaboration plan for local shell permission rules",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-collaboration-preview",
      title: "NPC collaboration preview"
    });
  });

  it("plans a readonly npc collaboration shell plan preview for explicit shell planning requests", () => {
    const plan = planLocalAssistantTask({
      message: "preview an npc collaboration shell plan to delete temp-output",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-shell-plan-preview",
      title: "NPC shell plan preview"
    });
  });

  it("requests workspace-write permission before an npc-assisted temp-output creation task", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to create a temp-output folder with shell automation",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "npc-local-enabled-shell-create-temp-output",
      queuedExecutionTitle: "NPC-assisted temp-output creation"
    });
  });

  it("plans an npc-assisted temp-output creation task after workspace-write permission is available", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to create a temp-output folder with shell automation",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-enabled-shell-create-temp-output",
      title: "NPC-assisted temp-output creation"
    });
  });

  it("requests controlled-full permission before an npc-assisted destructive temp-output cleanup task", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to delete temp-output with shell automation",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "controlled-full"
    });
  });

  it("requests destructive confirmation after controlled-full permission is available for an npc-assisted cleanup task", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to delete temp-output with shell automation",
      permissionMode: "controlled-full"
    });

    expect(plan).toMatchObject({
      kind: "confirmation",
      queuedExecutionKind: "npc-local-enabled-shell-remove-temp-output",
      queuedExecutionTitle: "NPC-assisted temp-output removal"
    });
  });

  it("requests workspace-write permission before an npc-assisted RAG handoff temp-output creation task", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to review local shell permission rules and continue to create a temp-output folder with shell automation",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "npc-local-enabled-rag-shell-create-temp-output",
      queuedExecutionTitle: "NPC-assisted RAG handoff temp-output creation"
    });
  });

  it("plans an npc-assisted RAG handoff temp-output creation task after workspace-write permission is available", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to review local shell permission rules and continue to create a temp-output folder with shell automation",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-enabled-rag-shell-create-temp-output",
      title: "NPC-assisted RAG handoff temp-output creation"
    });
  });

  it("requests destructive confirmation after controlled-full permission is available for an npc-assisted RAG handoff cleanup task", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to review local shell permission rules and continue to delete temp-output with shell automation",
      permissionMode: "controlled-full"
    });

    expect(plan).toMatchObject({
      kind: "confirmation",
      queuedExecutionKind: "npc-local-enabled-rag-shell-remove-temp-output",
      queuedExecutionTitle: "NPC-assisted RAG handoff temp-output removal"
    });
  });

  it("plans an MCP capability overview for model context protocol requests", () => {
    const plan = planLocalAssistantTask({
      message: "inspect local mcp capability setup",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "capability-mcp-overview",
      title: "OpenClaw MCP capability overview"
    });
  });

  it("plans a real local MCP plugin scan for explicit MCP inventory requests", () => {
    const plan = planLocalAssistantTask({
      message: "scan local mcp plugins and list available model context protocol entries",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "mcp-local-plugin-scan",
      title: "Local MCP plugin scan"
    });
  });

  it("plans a real local MCP plugin detail lookup for explicit MCP inspection requests", () => {
    const plan = planLocalAssistantTask({
      message: "show details for the browser mcp plugin",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "mcp-local-plugin-inspect",
      title: "Local MCP plugin detail"
    });
  });

  it("plans a readonly local MCP plugin startup preview for explicit MCP launch planning requests", () => {
    const plan = planLocalAssistantTask({
      message: "preview starting the browser mcp plugin locally",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "mcp-local-plugin-start-preview",
      title: "Local MCP plugin start preview"
    });
  });

  it("requests controlled-full permission before a real local MCP plugin start task", () => {
    const plan = planLocalAssistantTask({
      message: "start the browser mcp plugin locally",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "controlled-full",
      queuedExecutionKind: "mcp-local-plugin-start",
      queuedExecutionTitle: "Local MCP plugin start"
    });
  });

  it("requests dangerous confirmation after controlled-full permission is available for a real local MCP plugin start task", () => {
    const plan = planLocalAssistantTask({
      message: "start the browser mcp plugin locally",
      permissionMode: "controlled-full"
    });

    expect(plan).toMatchObject({
      kind: "confirmation",
      queuedExecutionKind: "mcp-local-plugin-start",
      queuedExecutionTitle: "Local MCP plugin start"
    });
  });
});
