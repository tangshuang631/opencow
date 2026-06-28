import type { LocalTaskItem } from "../features/workbench/workbenchState";

type NpcTimeoutRecoveryTask = Pick<
  LocalTaskItem,
  "executionKind" | "summary" | "executionMessage" | "executionAuditDetail" | "lastFailureDetail"
>;

export function isLocalModelTimeoutFailure(
  task: NpcTimeoutRecoveryTask | undefined
): task is NpcTimeoutRecoveryTask & { lastFailureDetail: string } {
  if (!task?.lastFailureDetail) {
    return false;
  }

  const normalizedDetail = task.lastFailureDetail.toLowerCase();

  return normalizedDetail.includes("streamphase=waiting-first-chunk")
    || normalizedDetail.includes("streamphase=streaming")
    || normalizedDetail.includes("maximum execution time")
    || normalizedDetail.includes("timed out");
}

export function looksLikeNpcConfigRequest(task: NpcTimeoutRecoveryTask): boolean {
  const normalizedRequest = `${task.summary}\n${task.executionMessage ?? ""}\n${task.executionAuditDetail ?? ""}`.toLowerCase();

  return /\bnpc\b/i.test(normalizedRequest)
    && (
      /配置|创建|设定|设置|帮我/.test(normalizedRequest)
      || /\bconfig(?:ure)?\b/i.test(normalizedRequest)
      || /\bcreate\b/i.test(normalizedRequest)
      || /\bsetup\b/i.test(normalizedRequest)
      || /\bset up\b/i.test(normalizedRequest)
    );
}

export function getNpcConfigReadonlyDraftRetryMessage(task: NpcTimeoutRecoveryTask | undefined): string | null {
  if (!task?.lastFailureDetail) {
    return null;
  }

  const isNpcConfigTimeout =
    task.executionKind === "npc-config-write"
    || (task.executionKind === "local-model-chat" && looksLikeNpcConfigRequest(task));

  if (!isNpcConfigTimeout || !isLocalModelTimeoutFailure(task)) {
    return null;
  }

  return [
    "先给我这个 NPC 的只读草案，不要保存配置。",
    "请基于上一次失败的创建请求，先说明角色定位、能力边界、需要哪些本地资料、以及确认后再保存的下一步。",
    `原始请求：${task.summary}`
  ].join(" ");
}
