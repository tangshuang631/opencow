import { describe, expect, it } from "vitest";
import { createPermissionEscalationRequest } from "./index.js";

describe("createPermissionEscalationRequest", () => {
  it("creates a controlled-full escalation request for blocked high-risk command plans", () => {
    const request = createPermissionEscalationRequest({
      status: "blocked",
      requiresConfirmation: false,
      requiredPermission: "controlled-full",
      timeoutMs: 20_000,
      command: "Remove-Item .\\temp-output -Recurse",
      cwd: "E:\\2026\\opencow",
      auditEvent: {
        module: "shell-runtime",
        source: "command_policy",
        summary: "命令需要更高权限",
        detail: "高风险命令需要受控完全访问: Remove-Item .\\temp-output -Recurse",
        timestamp: "2026-06-06T01:20:00.000Z"
      }
    });

    expect(request).toEqual({
      targetMode: "controlled-full",
      reason: "需要执行受控高风险操作。",
      riskSummary: "允许受控高风险操作，但必须保留确认、日志、超时和回退。"
    });
  });

  it("returns null for plans that are already executable", () => {
    const request = createPermissionEscalationRequest({
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
        timestamp: "2026-06-06T01:20:00.000Z"
      }
    });

    expect(request).toBeNull();
  });
});
