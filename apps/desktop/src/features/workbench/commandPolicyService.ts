import { planControlledCommand } from "@opencow/shell-runtime";
import type { WorkbenchState } from "./workbenchState";

const desktopWorkspaceRoot = "E:\\2026\\opencow";

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
    }
  | {
      kind: "blocked";
      summary: string;
      detail: string;
      actionLabel: string;
      source: string;
    };

export function evaluateDangerousCommandPolicy(state: WorkbenchState): DangerousCommandPolicyResult {
  const command = "Remove-Item .\\temp-output -Recurse";

  const plan = planControlledCommand({
    command,
    cwd: desktopWorkspaceRoot,
    allowedRoots: [desktopWorkspaceRoot],
    permissionMode: state.permission.mode,
    timeoutMs: 20_000
  });

  if (plan.status === "blocked" && plan.requiredPermission === "controlled-full") {
    return {
      kind: "permission-request",
      targetMode: "controlled-full",
      reason: "需要执行受控高风险操作。",
      riskSummary: "允许受控高风险操作，但必须保留确认、日志、超时和回退。"
    };
  }

  if (plan.status === "needs-confirmation") {
    return {
      kind: "confirmation",
      title: "确认删除临时目录",
      summary: "模型计划删除工作区内的 temp-output 目录。",
      commandPreview: command,
      impact: "将删除 12 个文件，写入回退快照后才可执行。",
      requiredMode: "controlled-full"
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
