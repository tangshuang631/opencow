import type { TaskClass } from "./types.js";

export function routeTask(input: {
  message: string;
  selectedFiles?: string[];
  knowledgeEnabled?: boolean;
  explicitCapabilityId?: string;
  viewAction?: string;
  advancedMode?: boolean;
}): TaskClass {
  if (input.advancedMode === true) return "advanced-agent-task";
  if (input.explicitCapabilityId?.trim() || input.viewAction?.trim()) return "typed-tool-task";
  if (input.knowledgeEnabled === true || /知识库|本地资料|引用来源|evidence|retrieval/i.test(input.message)) return "retrieval-answer";
  if ((input.selectedFiles?.length ?? 0) > 0 && /总结|改写|翻译|提取|整理|summari[sz]e|rewrite|translate|extract/i.test(input.message)) return "one-shot-transform";
  return "direct-chat";
}
