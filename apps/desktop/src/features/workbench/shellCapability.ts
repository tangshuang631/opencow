export type ShellPermissionLevel = "readonly" | "workspace-write" | "controlled-full";

export type ShellCapabilityGroup = {
  title: string;
  permission: ShellPermissionLevel;
  summary: string;
  recovery: string;
};

export const shellCapabilityGroups: ShellCapabilityGroup[] = [
  {
    title: "只读 Shell",
    permission: "readonly",
    summary: "用于读取工作区状态、Git 状态、工作区根目录和 packages 目录，不会修改磁盘内容。",
    recovery: "失败时优先检查工作区根目录发现、命令白名单和审计记录，然后在对话里重新发起只读检查。"
  },
  {
    title: "写入 Shell",
    permission: "workspace-write",
    summary: "用于在工作区内创建或修改安全范围内的临时输出、修复草稿和可回退产物。",
    recovery: "失败时先检查权限是否已批准、工作区根目录是否正确、输出路径是否可写，再在对话里重试。"
  },
  {
    title: "高危 Shell",
    permission: "controlled-full",
    summary: "用于删除、清理或其他破坏性操作，必须先经过危险确认和回退检查。",
    recovery: "失败时优先确认快照是否存在、危险确认是否已批准、回退是否可用，然后再通过对话继续。"
  }
];

export function getShellCapabilitySummary(): string {
  return shellCapabilityGroups
    .map((group) => `${group.title} · ${group.permission}：${group.summary} 恢复路径：${group.recovery}`)
    .join("\n");
}

export function getShellRecoveryChecklist(): string[] {
  return [
    "先判断当前 shell 属于只读、写入还是高危。",
    "确认权限是否已经批准，或者是否需要先走危险确认。",
    "检查工作区根目录、命令白名单、输出路径和快照是否可用。",
    "如果失败来自只读或环境问题，优先通过对话重新发起检查。",
    "如果失败来自写入或高危操作，先补齐权限或回退条件，再继续对话修复。"
  ];
}

export function getShellDialogRecoveryNarrative(): string {
  const checklist = getShellRecoveryChecklist();

  return [
    "Shell 出问题时，可以把它当成一个可对话恢复的受控能力来处理：",
    ...checklist.map((item, index) => `${index + 1}. ${item}`)
  ].join("\n");
}
