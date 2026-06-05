import { describe, expect, it } from "vitest";
import { evaluateDangerousCommandPolicy } from "./commandPolicyService";
import {
  approvePermissionModeChangeState,
  createInitialWorkbenchState,
  requestPermissionModeChangeState
} from "./workbenchState";

describe("evaluateDangerousCommandPolicy", () => {
  it("requests a permission upgrade when the workspace is below controlled full", () => {
    const result = evaluateDangerousCommandPolicy(createInitialWorkbenchState());

    expect(result).toMatchObject({
      kind: "permission-request",
      targetMode: "controlled-full",
      reason: "需要执行受控高风险操作。"
    });
  });

  it("returns a confirmation payload after controlled full has been approved", () => {
    const upgradedState = approvePermissionModeChangeState(
      requestPermissionModeChangeState(createInitialWorkbenchState(), {
        targetMode: "controlled-full",
        reason: "需要执行受控高风险操作。",
        riskSummary: "允许受控高风险操作，但必须保留确认、日志、超时和回退。"
      })
    );

    const result = evaluateDangerousCommandPolicy(upgradedState);

    expect(result).toMatchObject({
      kind: "confirmation",
      title: "确认删除临时目录",
      requiredMode: "controlled-full"
    });
  });
});
