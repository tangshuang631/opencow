import { describe, expect, it } from "vitest";
import { guardExecutionPlan } from "./index.js";

describe("guardExecutionPlan", () => {
  it("requires snapshot and preview for high-risk confirmed commands", () => {
    const result = guardExecutionPlan(
      {
        status: "needs-confirmation",
        requiresConfirmation: true,
        requiredPermission: "controlled-full",
        timeoutMs: 20_000,
        command: "Remove-Item .\\temp-output -Recurse",
        cwd: "E:\\2026\\opencow",
        auditEvent: {
          module: "shell-runtime",
          source: "command_policy",
          summary: "高风险命令等待确认",
          detail: "命令需二次确认后执行: Remove-Item .\\temp-output -Recurse",
          timestamp: "2026-06-06T01:30:00.000Z"
        }
      },
      { snapshotAvailable: true }
    );

    expect(result).toMatchObject({
      status: "requires-snapshot",
      requiresPreview: true,
      requiresSnapshot: true
    });
  });

  it("allows low-risk ready commands to proceed without snapshot", () => {
    const result = guardExecutionPlan(
      {
        status: "ready",
        requiresConfirmation: false,
        requiredPermission: "workspace-write",
        timeoutMs: 10_000,
        command: "Get-ChildItem .\\src",
        cwd: "E:\\2026\\opencow",
        auditEvent: {
          module: "shell-runtime",
          source: "command_policy",
          summary: "工作区命令已允许",
          detail: "低风险命令可在授权工作区执行: Get-ChildItem .\\src",
          timestamp: "2026-06-06T01:30:00.000Z"
        }
      },
      { snapshotAvailable: true }
    );

    expect(result).toMatchObject({
      status: "ready",
      requiresPreview: false,
      requiresSnapshot: false
    });
  });

  it("blocks destructive commands when snapshot capability is unavailable", () => {
    const result = guardExecutionPlan(
      {
        status: "needs-confirmation",
        requiresConfirmation: true,
        requiredPermission: "controlled-full",
        timeoutMs: 20_000,
        command: "Remove-Item .\\temp-output -Recurse",
        cwd: "E:\\2026\\opencow",
        auditEvent: {
          module: "shell-runtime",
          source: "command_policy",
          summary: "高风险命令等待确认",
          detail: "命令需二次确认后执行: Remove-Item .\\temp-output -Recurse",
          timestamp: "2026-06-06T01:30:00.000Z"
        }
      },
      { snapshotAvailable: false }
    );

    expect(result).toMatchObject({
      status: "blocked",
      reason: "snapshot-unavailable",
      requiresSnapshot: true
    });
  });
});
