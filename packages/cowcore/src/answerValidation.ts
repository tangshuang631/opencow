import type { IntentDecision } from "./intentRouter.js";
import type { ReActValidation } from "./reactLoop.js";

/** Final-answer contract used after a model/capability execution. */
export function validateAssistantAnswer(input: {
  content: string;
  intent: IntentDecision;
  hasEvidence: boolean;
  evidenceCoverage?: "none" | "partial" | "complete";
}): ReActValidation {
  const content = input.content.trim();
  if (!content) {
    return { ok: false, reason: "empty-answer", feedback: "Return a concise final answer instead of an empty response." };
  }

  if (/https?:\/\/\S+|(?:信息引用|联网搜索来源|参考来源|来源清单|参考资料)/i.test(content)) {
    return {
      ok: false,
      reason: "answer-protocol-leak",
      feedback: "Remove URLs and citation/source sections. Return only the natural-language answer body; references are rendered by the dedicated panel."
    };
  }

  if (input.intent.needsNetwork && !input.hasEvidence) {
    return {
      ok: false,
      reason: "missing-network-evidence",
      feedback: "The request requires fresh external evidence. Do not claim a current result without a usable network source."
    };
  }

  if (input.evidenceCoverage === "complete" && /(?:现有来源|当前来源|资料|证据).{0,12}(?:不足|无法确认|不能确认|不够|缺少)/i.test(content)) {
    return {
      ok: false,
      reason: "unsupported-evidence-refusal",
      feedback: "Both comparison subjects are covered by usable evidence. Give the supported differences and conclusion directly; mention only the specific facts that remain uncertain instead of refusing the whole answer."
    };
  }

  return { ok: true };
}
