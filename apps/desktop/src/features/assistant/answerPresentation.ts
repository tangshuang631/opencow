/**
 * Keep machine-provided evidence in the dedicated information-reference panel.
 * The model may still see URLs as evidence, but the transcript never renders
 * automatically generated citation blocks or raw links in the answer body.
 */
export function normalizeSearchGroundedAnswer(message: string): string {
  const normalized = message
    .replace(/^根据提供的来源[，,]?\s*/gm, "")
    .replace(/^根据以上来源[，,]?\s*/gm, "")
    .replace(/^结合以上来源[，,]?\s*/gm, "")
    .replace(/^以下结论来自.*$/gm, "")
    .replace(/\n\s*参考来源：[\s\S]*$/m, "")
    .replace(/\n\s*来源清单：[\s\S]*$/m, "")
    .replace(/\n\s*参考资料：[\s\S]*$/m, "")
    .replace(/\n\s*\d+\.\s*.+?\|\s*url=https?:\/\/\S+.*$/gm, "")
    .replace(/\n\s*\d+\.\s*.+?\s+url=https?:\/\/\S+.*$/gm, "")
    .replace(/（?来自(?:[^）\n。；;]*?)来源）?/g, "")
    .replace(/\(?来自(?:[^\)\n。；;]*?)来源\)?/g, "")
    .replace(/^\s*（?基于(?:以上|提供|相关|这些|上述)[^）\n。；;]*来源）?\s*/gm, "")
    .trim();
  const answerLines: string[] = [];

  for (const line of normalized.split(/\r?\n/)) {
    const plainLine = line.replace(/[\*_`#]/g, "").trim();

    if (/^(?:\d+\s*条信息引用|信息引用|联网搜索来源|参考来源|来源清单|参考资料)$/i.test(plainLine)) {
      break;
    }

    if (/^(?:[-*•]\s*)?(?:查询|地址|网址|URL|来源|提供方|source|provider)\s*[：:=]/i.test(plainLine)) {
      continue;
    }

    if (/^(?:[-*•]\s*|\d+[.)]\s*)?.*\|\s*(?:source|provider|url)\s*[=:]/i.test(plainLine)) {
      continue;
    }

    answerLines.push(
      line
        .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/gi, "$1")
        // Stop at sentence punctuation so a URL immediately followed by CJK text
        // cannot swallow the rest of an otherwise valid answer sentence.
        .replace(/https?:\/\/[^\s，。；;、！？)）\]}]+/gi, "")
        .replace(/\s{2,}/g, " ")
        .trimEnd()
    );
  }

  return answerLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
