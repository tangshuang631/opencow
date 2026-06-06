import { describe, expect, it } from "vitest";
import { createInitialWorkbenchState, mergeOllamaOverview } from "./workbenchState";

describe("mergeOllamaOverview", () => {
  it("updates the workbench state with reachable local models", () => {
    const state = createInitialWorkbenchState();

    const updated = mergeOllamaOverview(state, {
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [
        { name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" },
        { name: "bge-m3:latest", sizeLabel: "1.2 GB" }
      ]
    });

    expect(updated.model.status).toBe("Ollama 已连接");
    expect(updated.model.activeModel).toBe("qwen2.5-coder:7b");
    expect(updated.model.availableModels).toHaveLength(2);
    expect(updated.model.diagnostic).toBe("");
  });

  it("keeps a clear diagnostic when Ollama is offline", () => {
    const state = createInitialWorkbenchState();

    const updated = mergeOllamaOverview(state, {
      reachable: false,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "",
      diagnostic: "Ollama 未启动，请检查本地服务。",
      models: []
    });

    expect(updated.model.status).toBe("等待 Ollama");
    expect(updated.model.activeModel).toBe("未选择模型");
    expect(updated.model.diagnostic).toContain("Ollama");
  });
});
