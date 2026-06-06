import type { PermissionEscalationRequest, PermissionPlanInput } from "./types.js";

export function createPermissionEscalationRequest(
  plan: PermissionPlanInput
): PermissionEscalationRequest | null {
  if (plan.status !== "blocked") {
    return null;
  }

  if (plan.requiredPermission === "controlled-full") {
    return {
      targetMode: "controlled-full",
      reason: "需要执行受控高风险操作。",
      riskSummary: "允许受控高风险操作，但必须保留确认、日志、超时和回退。"
    };
  }

  if (plan.requiredPermission === "workspace-write") {
    return {
      targetMode: "workspace-write",
      reason: "需要在授权工作区内执行写入操作。",
      riskSummary: "允许在授权工作区内创建和修改文件，但仍禁止高风险删除。"
    };
  }

  return null;
}
