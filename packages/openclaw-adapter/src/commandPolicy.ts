import type {
  ControlledCommandAnalysis,
  ControlledCommandRequest,
  ControlledPermissionMode
} from "./types.js";

const highRiskPatterns = [/remove-item/i, /\brm\b/i, /-recurse/i, /del\s+/i, /rmdir/i, /taskkill/i];

export function analyzeControlledCommand(request: ControlledCommandRequest): ControlledCommandAnalysis {
  const cwd = normalizePath(request.cwd);
  const allowedRoots = request.allowedRoots.map((root) => normalizePath(root));
  const normalizedCommand = request.command.trim();
  const highRisk = highRiskPatterns.some((pattern) => pattern.test(normalizedCommand));

  if (!isWithinAllowedRoots(cwd, allowedRoots)) {
    return {
      status: "blocked",
      riskLevel: "high",
      reasonCode: "cwd_outside_allowed_roots",
      requiresConfirmation: false,
      requiredPermission: request.permissionMode,
      auditSummary: "命令执行被阻止",
      auditDetail: `工作目录超出授权范围: ${cwd}`
    };
  }

  if (request.permissionMode === "readonly") {
    return {
      status: "blocked",
      riskLevel: highRisk ? "high" : "low",
      reasonCode: "permission_denied",
      requiresConfirmation: false,
      requiredPermission: highRisk ? "controlled-full" : "workspace-write",
      auditSummary: "只读模式禁止执行命令",
      auditDetail: `只读模式拒绝命令: ${normalizedCommand}`
    };
  }

  if (highRisk && request.permissionMode !== "controlled-full") {
    return {
      status: "blocked",
      riskLevel: "high",
      reasonCode: "permission_upgrade_required",
      requiresConfirmation: false,
      requiredPermission: "controlled-full",
      auditSummary: "命令需要更高权限",
      auditDetail: `高风险命令需要受控完全访问: ${normalizedCommand}`
    };
  }

  if (highRisk) {
    return {
      status: "needs-confirmation",
      riskLevel: "high",
      reasonCode: "high_risk_confirmation_required",
      requiresConfirmation: true,
      requiredPermission: "controlled-full",
      auditSummary: "高风险命令等待确认",
      auditDetail: `命令需二次确认后执行: ${normalizedCommand}`
    };
  }

  return {
    status: "ready",
    riskLevel: "low",
    reasonCode: "allowed",
    requiresConfirmation: false,
    requiredPermission: getRequiredPermission(request.permissionMode),
    auditSummary: "工作区命令已允许",
    auditDetail: `低风险命令可在授权工作区执行: ${normalizedCommand}`
  };
}

function isWithinAllowedRoots(cwd: string, allowedRoots: readonly string[]): boolean {
  return allowedRoots.some((root) => cwd === root || cwd.startsWith(`${root}/`));
}

function getRequiredPermission(mode: ControlledPermissionMode): ControlledPermissionMode {
  return mode === "readonly" ? "workspace-write" : mode;
}

function normalizePath(input: string): string {
  return input.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
}
