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
      requiredMode: "controlled-full",
      safetySummary: "执行前必须创建快照并展示预览。"
    });
  });

  it("blocks destructive commands when rollback snapshot capability is unavailable", () => {
    const upgradedState = approvePermissionModeChangeState(
      requestPermissionModeChangeState(createInitialWorkbenchState(), {
        targetMode: "controlled-full",
        reason: "需要执行受控高风险操作。",
        riskSummary: "允许受控高风险操作，但必须保留确认、日志、超时和回退。"
      })
    );

    const result = evaluateDangerousCommandPolicy(upgradedState, {
      snapshotAvailable: false
    });

    expect(result.kind).toBe("blocked");
    if (result.kind !== "blocked") {
      throw new Error(`Expected blocked policy result, received ${result.kind}`);
    }
    expect(result).toMatchObject({
      kind: "blocked",
      summary: "高风险命令已阻断",
      source: "safety_snapshot_unavailable"
    });
    expect(result.detail).toContain("无法创建回退快照");
    expect(result.actionLabel).toContain("不要执行删除命令");
  });

  it("uses the resolved workspace root as the command safety boundary", () => {
    const result = evaluateDangerousCommandPolicy(createInitialWorkbenchState(), {
      workspaceRoot: "D:\\other-opencow",
      commandCwd: "E:\\2026\\opencow"
    });

    expect(result.kind).toBe("blocked");
    if (result.kind !== "blocked") {
      throw new Error(`Expected blocked policy result, received ${result.kind}`);
    }
    expect(result.source).toBe("command_policy");
    expect(result.detail).toContain("e:/2026/opencow");
  });
});
