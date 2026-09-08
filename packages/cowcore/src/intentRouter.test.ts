import { describe, expect, it } from "vitest";
import {
  classifyIntent,
  createIntentRoutingPrompt,
  resolveIntentTaskClass,
  validateIntentProposal
} from "./intentRouter.js";

describe("generic assistant intent router", () => {
  it.each([
    ["解释一下什么是 MCP", "conversation", "general", false],
    ["今天深圳天气怎么样", "structured-fact", "weather", true],
    ["现在几点", "structured-fact", "time", false],
    ["Ollama 最新稳定版是什么", "fresh-research", "news", true],
    ["比特币现在价格", "fresh-research", "finance", true],
    ["根据本地知识库回答 shell 隔离规则", "retrieval", "knowledge", false],
    ["总结已选文件", "transform", "files", false],
    ["查看当前工作区状态", "workspace-read", "workspace", false],
    ["在工作区创建一个目录", "workspace-write", "workspace", false]
  ] as const)("classifies %s without a provider-specific planner", (message, kind, domain, needsNetwork) => {
    const intent = classifyIntent({
      message,
      selectedFiles: message === "总结已选文件" ? ["notes.md"] : undefined
    });
    expect(intent.kind).toBe(kind);
    expect(intent.domain).toBe(domain);
    expect(intent.needsNetwork).toBe(needsNetwork);
  });

  it("recognizes project-bound rule questions as local retrieval", () => {
    expect(classifyIntent({ message: "根据这个项目里的规则解释享元模式" })).toMatchObject({
      kind: "retrieval",
      domain: "knowledge",
      needsLocalRetrieval: true,
      needsNetwork: false,
      requiredCapabilities: ["knowledge.search"]
    });
  });

  it("does not mistake a current workspace failure for fresh web research", () => {
    expect(classifyIntent({
      message: "diagnose opencow and preview how to fix its current local error"
    })).toMatchObject({
      kind: "conversation",
      needsNetwork: false,
      requiresFreshData: false
    });
  });

  it("keeps ambiguous multi-domain requests safe", () => {
    const intent = classifyIntent({ message: "现在深圳天气和项目状态都查一下" });
    expect(intent.kind).toBe("unknown");
    expect(intent.sideEffect).toBe("none");
    expect(intent.requiredCapabilities).toEqual([]);
  });

  it("does not escalate multi-step wording without explicit advanced mode", () => {
    const intent = classifyIntent({ message: "帮我持续规划并执行多步任务", advancedMode: false });
    expect(intent.kind).toBe("conversation");
    expect(resolveIntentTaskClass(intent, { advancedMode: false })).toBe("direct-chat");
  });

  it("accepts only bounded model proposals and rejects host effects", () => {
    const valid = validateIntentProposal({
      kind: "structured-fact",
      domain: "weather",
      confidence: 0.9,
      requiresFreshData: true,
      needsLocalRetrieval: false,
      needsNetwork: true,
      sideEffect: "none",
      requiredCapabilities: ["network.weather"],
      entities: { location: "深圳" },
      reasonCodes: ["model-proposal"]
    });
    expect(valid?.domain).toBe("weather");
    expect(validateIntentProposal({
      kind: "workspace-write",
      domain: "workspace",
      confidence: 0.9,
      requiresFreshData: false,
      needsLocalRetrieval: false,
      needsNetwork: false,
      sideEffect: "host-effect",
      requiredCapabilities: ["sandbox.shell"]
    })).toBeNull();
  });

  it("keeps the routing prompt explicit about unknown and host safety", () => {
    expect(createIntentRoutingPrompt()).toContain("Never propose host-effect");
  });
});
