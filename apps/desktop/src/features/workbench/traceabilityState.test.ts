import { describe, expect, it } from "vitest";
import {
  createInitialWorkbenchState,
  mergeOllamaOverview,
  type WorkbenchState
} from "./workbenchState";

describe("traceability workbench state", () => {
  it("starts with a visible log summary and no active error", () => {
    const state = createInitialWorkbenchState();

    expect(state.audit.summary).toBe("等待本地事件");
    expect(state.audit.lastEvent.module).toBe("startup");
    expect(state.audit.lastEvent.timestamp).toBe("未记录");
    expect(state.audit.lastEvent.source).toBe("desktop-bootstrap");
    expect(state.error).toBeNull();
  });

  it("records an actionable error when Ollama is offline", () => {
    const state = createInitialWorkbenchState();

    const updated = mergeOllamaOverview(state, {
      reachable: false,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "",
      diagnostic: "Ollama 未启动，请确认本地服务已运行。",
      models: []
    });

    expect(updated.error).toMatchObject({
      module: "ollama",
      summary: "无法连接本地 Ollama",
      detail: "Ollama 未启动，请确认本地服务已运行。",
      actionLabel: "检查 Ollama 服务",
      source: "ollama_overview",
      timestamp: "本地最近一次检查"
    });
    expect(updated.audit.summary).toContain("Ollama 离线");
    expect(updated.audit.lastEvent.source).toBe("ollama_overview");
  });

  it("clears the active error and writes a healthy audit summary when Ollama is reachable", () => {
    const withError = mergeOllamaOverview(createInitialWorkbenchState(), {
      reachable: false,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "",
      diagnostic: "Ollama 未启动，请确认本地服务已运行。",
      models: []
    });

    const recovered = mergeOllamaOverview(withError as WorkbenchState, {
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    expect(recovered.error).toBeNull();
    expect(recovered.audit.summary).toContain("已读取 1 个本地模型");
    expect(recovered.audit.lastEvent.module).toBe("ollama");
    expect(recovered.audit.lastEvent.source).toBe("ollama_overview");
    expect(recovered.audit.lastEvent.timestamp).toBe("本地最近一次检查");
  });
});
