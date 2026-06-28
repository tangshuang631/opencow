import { describe, expect, it } from "vitest";
import {
  getShellCapabilitySummary,
  getShellDialogRecoveryNarrative,
  getShellRecoveryChecklist,
  shellCapabilityGroups
} from "./shellCapability";

describe("shellCapability", () => {
  it("describes all shell capability tiers and recovery paths", () => {
    expect(shellCapabilityGroups).toHaveLength(3);

    expect(shellCapabilityGroups.map((group) => group.permission)).toEqual([
      "readonly",
      "workspace-write",
      "controlled-full"
    ]);

    expect(shellCapabilityGroups.map((group) => group.title)).toEqual([
      "只读 Shell",
      "写入 Shell",
      "高危 Shell"
    ]);

    for (const group of shellCapabilityGroups) {
      expect(group.summary).toMatch(/用于/);
      expect(group.recovery).toMatch(/失败时/);
    }
  });

  it("builds a single readable capability summary for dialog surfaces", () => {
    const summary = getShellCapabilitySummary();

    expect(summary).toContain("只读 Shell · readonly");
    expect(summary).toContain("写入 Shell · workspace-write");
    expect(summary).toContain("高危 Shell · controlled-full");
    expect(summary).toContain("恢复路径");
    expect(summary.split("\n")).toHaveLength(3);
  });

  it("provides a shared recovery checklist for settings and dialog surfaces", () => {
    const checklist = getShellRecoveryChecklist();

    expect(checklist).toHaveLength(5);
    expect(checklist[0]).toContain("只读、写入还是高危");
    expect(checklist[1]).toContain("危险确认");
    expect(checklist[2]).toContain("工作区根目录");
    expect(checklist[3]).toContain("重新发起检查");
    expect(checklist[4]).toContain("补齐权限或回退条件");
  });

  it("provides a dialog-ready recovery narrative that mirrors the checklist", () => {
    const narrative = getShellDialogRecoveryNarrative();

    expect(narrative).toContain("Shell 出问题时，可以把它当成一个可对话恢复的受控能力来处理");
    expect(narrative).toContain("1. 先判断当前 shell 属于只读、写入还是高危。");
    expect(narrative).toContain("5. 如果失败来自写入或高危操作，先补齐权限或回退条件，再继续对话修复。");
  });
});
