import { describe, expect, it } from "vitest";
import { classifyIntent } from "./intentRouter.js";
import { validateAssistantAnswer } from "./answerValidation.js";

describe("assistant answer contract", () => {
  it("rejects empty answers and leaked citation markup", () => {
    const intent = classifyIntent({ message: "解释 MCP" });
    expect(validateAssistantAnswer({ content: "", intent, hasEvidence: false }).ok).toBe(false);
    expect(validateAssistantAnswer({ content: "答案\n参考来源：\nhttps://example.test", intent, hasEvidence: true }).reason).toBe("answer-protocol-leak");
  });

  it("requires evidence for fresh research but not for ordinary chat", () => {
    const fresh = classifyIntent({ message: "Ollama 最新稳定版是什么" });
    expect(validateAssistantAnswer({ content: "当前版本信息", intent: fresh, hasEvidence: false }).reason).toBe("missing-network-evidence");
    const ordinary = classifyIntent({ message: "MCP 是什么" });
    expect(validateAssistantAnswer({ content: "MCP 是连接模型和外部系统的协议。", intent: ordinary, hasEvidence: false }).ok).toBe(true);
  });

  it("retries an unsupported evidence refusal when both comparison sides are covered", () => {
    const intent = classifyIntent({ message: "LangGraph 和 LangChain 的区别" });
    const result = validateAssistantAnswer({
      content: "现有来源不足以确认两者的具体区别。",
      intent,
      hasEvidence: true,
      evidenceCoverage: "complete"
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "unsupported-evidence-refusal"
    });
  });
});
