import type { IntentDecision } from "./intentRouter.js";
import type { ReActValidation } from "./reactLoop.js";

/** Final-answer contract used after a model/capability execution. */
export function validateAssistantAnswer(input: {
  content: string;
  intent: IntentDecision;
  hasEvidence: boolean;
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

  return { ok: true };
}
