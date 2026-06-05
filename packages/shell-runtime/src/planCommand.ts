import { createAuditEvent } from "@opencow/audit-core";
import { analyzeControlledCommand } from "@opencow/openclaw-adapter/browser";
import type { ShellCommandPlan, ShellCommandPlanRequest } from "./types.js";

const minimumTimeoutMs = 1000;

export function planControlledCommand(request: ShellCommandPlanRequest): ShellCommandPlan {
  const analysis = analyzeControlledCommand({
    command: request.command,
    cwd: request.cwd,
    allowedRoots: request.allowedRoots,
    permissionMode: request.permissionMode
  });

  return {
    status: analysis.status,
    requiresConfirmation: analysis.requiresConfirmation,
    requiredPermission: analysis.requiredPermission,
    timeoutMs: normalizeTimeout(request.timeoutMs),
    command: request.command,
    cwd: request.cwd,
    auditEvent: createAuditEvent({
      module: "shell-runtime",
      source: "command_policy",
      summary: analysis.auditSummary,
      detail: analysis.auditDetail
    })
  };
}

function normalizeTimeout(timeoutMs: number): number {
  if (!Number.isFinite(timeoutMs) || timeoutMs < minimumTimeoutMs) {
    return minimumTimeoutMs;
  }

  return Math.floor(timeoutMs);
}
