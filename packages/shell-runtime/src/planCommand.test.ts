import { describe, expect, it } from "vitest";
import { planControlledCommand } from "./index.js";

describe("planControlledCommand", () => {
  const allowedRoots = ["E:\\2026\\opencow"];

  it("returns a blocked plan when readonly mode tries to execute a command", () => {
    const plan = planControlledCommand({
      command: "Get-ChildItem .",
      cwd: "E:\\2026\\opencow",
      allowedRoots,
      permissionMode: "readonly",
      timeoutMs: 15_000
    });

    expect(plan).toMatchObject({
      status: "blocked",
      timeoutMs: 15000,
      requiresConfirmation: false,
      auditEvent: {
        module: "shell-runtime",
        source: "command_policy",
        summary: "只读模式禁止执行命令"
      }
    });
  });

  it("returns a confirmation plan for high-risk commands in controlled full mode", () => {
    const plan = planControlledCommand({
      command: "Remove-Item .\\temp-output -Recurse",
      cwd: "E:\\2026\\opencow",
      allowedRoots,
      permissionMode: "controlled-full",
      timeoutMs: 20_000
    });

    expect(plan).toMatchObject({
      status: "needs-confirmation",
      requiresConfirmation: true,
      requiredPermission: "controlled-full",
      auditEvent: {
        module: "shell-runtime",
        source: "command_policy",
        summary: "高风险命令等待确认"
      }
    });
  });

  it("returns a ready plan for low-risk workspace commands", () => {
    const plan = planControlledCommand({
      command: "Get-ChildItem .\\src",
      cwd: "E:\\2026\\opencow",
      allowedRoots,
      permissionMode: "workspace-write",
      timeoutMs: 10_000
    });

    expect(plan).toMatchObject({
      status: "ready",
      requiresConfirmation: false,
      requiredPermission: "workspace-write",
      auditEvent: {
        module: "shell-runtime",
        source: "command_policy",
        summary: "工作区命令已允许"
      }
    });
  });

  it("normalizes too-small timeouts to the minimum shell runtime timeout", () => {
    const plan = planControlledCommand({
      command: "Get-ChildItem .\\src",
      cwd: "E:\\2026\\opencow",
      allowedRoots,
      permissionMode: "workspace-write",
      timeoutMs: 250
    });

    expect(plan.timeoutMs).toBe(1000);
  });
});
