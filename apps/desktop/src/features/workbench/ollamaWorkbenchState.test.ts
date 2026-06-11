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

  it("falls back to a detected model while recording diagnostics when the selected model is no longer available", () => {
    const state = createInitialWorkbenchState();

    const updated = mergeOllamaOverview(state, {
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen3.6:35b",
      diagnostic: "",
      models: [{ name: "gemma4:26b", sizeLabel: "17 GB" }]
    });

    expect(updated.model.status).toBe("Ollama 已连接");
    expect(updated.model.activeModel).toBe("gemma4:26b");
    expect(updated.model.diagnostic).toContain("qwen3.6:35b");
    expect(updated.audit.summary).toBe("Ollama 模型需要重新选择");
    expect(updated.audit.lastEvent.detail).toContain("qwen3.6:35b");
    expect(updated.audit.lastEvent.detail).toContain("Choose one of the detected local models");
    expect(updated.rollback.entries[0]).toMatchObject({
      label: "Ollama 模型需要重新选择",
      summary: expect.stringContaining("qwen3.6:35b")
    });
  });

  it("prefers gemma 26b when Ollama is reachable but selectedModel is empty", () => {
    const state = createInitialWorkbenchState();

    const updated = mergeOllamaOverview(state, {
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "",
      diagnostic: "",
      models: [
        { name: "qwen3.6:35b", sizeLabel: "23 GB" },
        { name: "gemma:26b", sizeLabel: "17 GB" },
        { name: "gemma4:26b", sizeLabel: "17 GB" },
        { name: "qwen3.5:9b", sizeLabel: "6.6 GB" }
      ]
    });

    expect(updated.model.status).toBe("Ollama 已连接");
    expect(updated.model.activeModel).toBe("gemma:26b");
    expect(updated.model.diagnostic).toBe("");
    expect(updated.audit.summary).toBe("已读取 4 个本地模型");
  });

  it("falls back to gemma4 26b before the first detected model when gemma 26b is missing", () => {
    const state = createInitialWorkbenchState();

    const updated = mergeOllamaOverview(state, {
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "",
      diagnostic: "",
      models: [
        { name: "qwen3.6:35b", sizeLabel: "23 GB" },
        { name: "gemma4:26b", sizeLabel: "17 GB" },
        { name: "qwen3.5:9b", sizeLabel: "6.6 GB" }
      ]
    });

    expect(updated.model.activeModel).toBe("gemma4:26b");
  });

  it("falls back to the first detected model when no preferred default model is installed", () => {
    const state = createInitialWorkbenchState();

    const updated = mergeOllamaOverview(state, {
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "",
      diagnostic: "",
      models: [
        { name: "qwen3.6:35b", sizeLabel: "23 GB" },
        { name: "qwen3.5:9b", sizeLabel: "6.6 GB" }
      ]
    });

    expect(updated.model.activeModel).toBe("qwen3.6:35b");
  });
});
