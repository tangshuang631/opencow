import { describe, expect, it } from "vitest";
import { routeTask } from "./taskRouter.js";

describe("routeTask", () => {
  it("keeps ordinary concept questions on the direct-chat lane", () => {
    expect(routeTask({ message: "解释一下什么是向量数据库" })).toBe("direct-chat");
  });

  it("uses deterministic signals for transforms, retrieval, and typed tools", () => {
    expect(routeTask({ message: "把这段内容总结成三点", selectedFiles: ["notes.md"] })).toBe("one-shot-transform");
    expect(routeTask({ message: "根据知识库回答这个问题", knowledgeEnabled: true })).toBe("retrieval-answer");
    expect(routeTask({ message: "查看当前工作区状态", explicitCapabilityId: "workspace.git.status" })).toBe("typed-tool-task");
  });

  it("only enters advanced-agent mode when the user explicitly requests it", () => {
    expect(routeTask({ message: "帮我持续规划并执行多步任务", advancedMode: false })).toBe("direct-chat");
    expect(routeTask({ message: "帮我持续规划并执行多步任务", advancedMode: true })).toBe("advanced-agent-task");
  });
});
