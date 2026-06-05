import { describe, expect, it } from "vitest";
import { analyzeControlledCommand } from "./index.js";

describe("controlled command policy", () => {
  const allowedRoots = ["E:\\2026\\opencow"];

  it("blocks shell commands in readonly mode", () => {
    const result = analyzeControlledCommand({
      command: "Get-ChildItem .",
      cwd: "E:\\2026\\opencow",
      allowedRoots,
      permissionMode: "readonly"
    });

    expect(result).toMatchObject({
      status: "blocked",
      riskLevel: "low",
      reasonCode: "permission_denied",
      requiresConfirmation: false
    });
  });

  it("blocks commands outside the authorized workspace", () => {
    const result = analyzeControlledCommand({
      command: "Get-ChildItem C:\\Windows",
      cwd: "C:\\Windows",
      allowedRoots,
      permissionMode: "workspace-write"
    });

    expect(result).toMatchObject({
      status: "blocked",
      riskLevel: "high",
      reasonCode: "cwd_outside_allowed_roots",
      requiresConfirmation: false
    });
  });

  it("requires confirmation for destructive commands in controlled full mode", () => {
    const result = analyzeControlledCommand({
      command: "Remove-Item .\\temp-output -Recurse",
      cwd: "E:\\2026\\opencow",
      allowedRoots,
      permissionMode: "controlled-full"
    });

    expect(result).toMatchObject({
      status: "needs-confirmation",
      riskLevel: "high",
      reasonCode: "high_risk_confirmation_required",
      requiresConfirmation: true
    });
    expect(result.auditDetail).toContain("Remove-Item");
  });

  it("allows low-risk workspace commands with an audit summary", () => {
    const result = analyzeControlledCommand({
      command: "Get-ChildItem .\\src",
      cwd: "E:\\2026\\opencow",
      allowedRoots,
      permissionMode: "workspace-write"
    });

    expect(result).toMatchObject({
      status: "ready",
      riskLevel: "low",
      reasonCode: "allowed",
      requiresConfirmation: false
    });
    expect(result.auditSummary).toContain("工作区命令");
  });

  it("blocks high-risk commands when permission is below controlled full", () => {
    const result = analyzeControlledCommand({
      command: "Remove-Item .\\temp-output -Recurse",
      cwd: "E:\\2026\\opencow",
      allowedRoots,
      permissionMode: "workspace-write"
    });

    expect(result).toMatchObject({
      status: "blocked",
      riskLevel: "high",
      reasonCode: "permission_upgrade_required",
      requiresConfirmation: false,
      requiredPermission: "controlled-full"
    });
  });
});
