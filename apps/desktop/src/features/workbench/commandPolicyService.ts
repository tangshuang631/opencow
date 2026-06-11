import { createPermissionEscalationRequest } from "@opencow/permission-engine";
import { guardExecutionPlan } from "@opencow/safety-engine";
import { planControlledCommand } from "@opencow/shell-runtime";
import type { WorkbenchState } from "./workbenchState";

const fallbackDesktopWorkspaceRoot = "E:\\2026\\opencow";

export type DangerousCommandPolicyResult =
  | {
      kind: "permission-request";
      targetMode: "controlled-full";
      reason: string;
      riskSummary: string;
    }
  | {
      kind: "confirmation";
      title: string;
      summary: string;
      commandPreview: string;
      impact: string;
      requiredMode: "controlled-full";
      safetySummary: string;
    }
  | {
      kind: "blocked";
      summary: string;
      detail: string;
      actionLabel: string;
      source: string;
    };

export function evaluateDangerousCommandPolicy(
  state: WorkbenchState,
  options: { snapshotAvailable?: boolean; workspaceRoot?: string; commandCwd?: string } = {}
): DangerousCommandPolicyResult {
  const command = "Remove-Item .\\temp-output -Recurse";
  const snapshotAvailable = options.snapshotAvailable ?? true;
  const workspaceRoot = options.workspaceRoot?.trim() || fallbackDesktopWorkspaceRoot;
  const commandCwd = options.commandCwd?.trim() || workspaceRoot;

  const plan = planControlledCommand({
    command,
    cwd: commandCwd,
    allowedRoots: [workspaceRoot],
    permissionMode: state.permission.mode,
    timeoutMs: 20_000
  });

  const escalation = createPermissionEscalationRequest(plan);

  if (escalation) {
    return {
      kind: "permission-request",
      targetMode: "controlled-full",
      reason: escalation.reason,
      riskSummary: escalation.riskSummary
    };
  }

  if (plan.status === "needs-confirmation") {
    const safety = guardExecutionPlan(plan, { snapshotAvailable });

    if (safety.status === "blocked") {
      return {
        kind: "blocked",
        summary: "高风险命令已阻断",
        detail: "无法创建回退快照，安全链路已阻断高风险删除命令。",
        actionLabel: "不要执行删除命令；请先恢复快照能力，或改为只读预览。",
        source: "safety_snapshot_unavailable"
      };
    }

    return {
      kind: "confirmation",
      title: "确认删除临时目录",
      summary: "模型计划删除工作区内的 temp-output 目录。",
      commandPreview: command,
      impact: "将删除 12 个文件，写入回退快照后才可执行。",
      requiredMode: "controlled-full",
      safetySummary:
        safety.status === "requires-snapshot"
          ? "执行前必须创建快照并展示预览。"
          : "当前无需额外快照。"
    };
  }

  return {
    kind: "blocked",
    summary: plan.auditEvent.summary,
    detail: plan.auditEvent.detail,
    actionLabel: "检查工作目录与权限范围",
    source: plan.auditEvent.source
  };
}
