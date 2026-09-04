import { describe, expect, it, vi } from "vitest";
import {
  OllamaNativeProvider,
  type OllamaShowResponse,
  type OllamaTagsResponse
} from "./ollamaNativeProvider.js";
import { createPerformanceProfileStore, type ProfileStorage } from "./performanceProfileStore.js";

const version = { version: "0.33.2" };
const tags: OllamaTagsResponse = {
  models: [{
    name: "qwen3.5:9b",
    model: "qwen3.5:9b",
    digest: "sha256:chat-digest",
    size: 6_500_000_000,
    details: {
      format: "gguf",
      family: "qwen3",
      families: ["qwen3"],
      parameter_size: "9B",
      quantization_level: "Q4_K_M"
    }
  }, {
    name: "qwen3-embedding:8b-q4_K_M",
    model: "qwen3-embedding:8b-q4_K_M",
    digest: "sha256:embed-digest",
    size: 4_700_000_000,
    details: {
      format: "gguf",
      family: "qwen3",
      families: ["qwen3"],
      parameter_size: "8B",
      quantization_level: "Q4_K_M"
    }
  }]
};
const show: OllamaShowResponse = {
  details: {
    format: "gguf",
    family: "qwen3",
    families: ["qwen3"],
    parameter_size: "9B",
    quantization_level: "Q4_K_M"
  },
  capabilities: ["completion", "tools", "thinking", "vision"],
  model_info: {
    "general.architecture": "qwen3",
    "qwen3.context_length": 262_144,
    "qwen3.embedding_length": 4096
  }
};

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

describe("OllamaNativeProvider", () => {
  it("discovers metadata in deterministic order without guessing model capabilities", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      calls.push(path);
      if (path === "/api/version") return jsonResponse(version);
      if (path === "/api/tags") return jsonResponse(tags);
      if (path === "/api/show") return jsonResponse(show);
      if (path === "/api/ps") return jsonResponse({ models: [] });
      throw new Error(`unexpected path ${path}`);
    });
    const provider = new OllamaNativeProvider({
      fetch: fetchMock,
      cloudPolicy: "disabled-confirmed",
      verifiedModels: { "qwen3.5:9b": "sha256:chat-digest" }
    });

    const profile = await provider.profileModel("qwen3.5:9b");

    expect(calls).toEqual(["/api/version", "/api/tags", "/api/show", "/api/ps"]);
    expect(profile).toMatchObject({
      modelId: "qwen3.5:9b",
      modelDigest: "sha256:chat-digest",
      provider: "ollama-native",
      maxContextWindow: 262_144,
      architecture: "qwen3",
      embeddingDimensions: 4096
    });
    expect(profile.capabilities.tools.state).toBe("declared");
    expect(profile.executionEngine).toBe("unknown");
    expect(profile.runtimeOptimizations).toEqual([]);
  });

  it("preserves native streaming thinking, content, tool calls and usage metrics", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(new URL(String(input)).pathname).toBe("/api/chat");
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        model: "qwen3.5:9b",
        stream: true,
        think: true,
        keep_alive: "10m",
        format: { type: "object", properties: { answer: { type: "string" } } },
        tools: [{ type: "function", function: { name: "diagnostic" } }]
      });
      const encoder = new TextEncoder();
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('{"model":"qwen3.5:9b","message":{"thinking":"检查中"}}\n'));
          controller.enqueue(encoder.encode('{"model":"qwen3.5:9b","message":{"content":"完成","tool_calls":[{"function":{"name":"diagnostic","arguments":{"path":"."}}}]}}\n'));
          controller.enqueue(encoder.encode('{"model":"qwen3.5:9b","done":true,"done_reason":"stop","total_duration":1000000,"load_duration":100000,"prompt_eval_count":20,"prompt_eval_duration":200000,"eval_count":4,"eval_duration":400000}\n'));
          controller.close();
        }
      }), { status: 200 });
    });
    const provider = new OllamaNativeProvider({
      fetch: fetchMock,
      cloudPolicy: "disabled-confirmed",
      verifiedModels: { "qwen3.5:9b": "sha256:chat-digest" }
    });
    const chunks: Array<{ thinking?: string; content?: string; toolCalls?: unknown[] }> = [];

    const result = await provider.chat({
      model: "qwen3.5:9b",
      messages: [{ role: "user", content: "你好" }],
      think: true,
      keepAlive: "10m",
      format: { type: "object", properties: { answer: { type: "string" } } },
      tools: [{ type: "function", function: { name: "diagnostic", parameters: {} } }],
      onChunk: (chunk) => chunks.push(chunk)
    });

    expect(result.thinking).toBe("检查中");
    expect(result.content).toBe("完成");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.metrics).toMatchObject({
      totalDurationMs: 1,
      loadDurationMs: 0.1,
      promptEvalCount: 20,
      evalCount: 4
    });
    expect(chunks).toEqual([
      { thinking: "检查中" },
      { content: "完成", toolCalls: [{ function: { name: "diagnostic", arguments: { path: "." } } }] }
    ]);
  });

  it("uses batched native embeddings with truncation disabled", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(new URL(String(input)).pathname).toBe("/api/embed");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        model: "qwen3-embedding:8b-q4_K_M",
        input: ["第一段", "第二段"],
        truncate: false,
        keep_alive: "5m"
      });
      return jsonResponse({ embeddings: [[1, 2], [3, 4]], total_duration: 10_000_000, load_duration: 2_000_000, prompt_eval_count: 8, prompt_eval_duration: 4_000_000 });
    });
    const provider = new OllamaNativeProvider({
      fetch: fetchMock,
      cloudPolicy: "disabled-confirmed",
      verifiedModels: { "qwen3-embedding:8b-q4_K_M": "sha256:embed-digest" }
    });

    const result = await provider.embed({ model: "qwen3-embedding:8b-q4_K_M", input: ["第一段", "第二段"], keepAlive: "5m" });

    expect(result.embeddings).toEqual([[1, 2], [3, 4]]);
    expect(result.metrics.promptEvalCount).toBe(8);
  });

  it("fails closed for non-loopback endpoints and unverified cloud policy", async () => {
    const fetchMock = vi.fn();
    expect(() => new OllamaNativeProvider({ endpoint: "https://example.com", fetch: fetchMock })).toThrow(/loopback/i);
    const provider = new OllamaNativeProvider({ fetch: fetchMock, cloudPolicy: "unverified" });

    await expect(provider.chat({ model: "qwen3.5:9b", messages: [{ role: "user", content: "x" }] })).rejects.toThrow(/locality|cloud/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a model identity mismatch between tags and show metadata", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path === "/api/version") return jsonResponse(version);
      if (path === "/api/tags") return jsonResponse(tags);
      if (path === "/api/show") return jsonResponse({ ...show, digest: "sha256:wrong" });
      if (path === "/api/ps") return jsonResponse({ models: [] });
      throw new Error(`unexpected path ${path}`);
    });
    const provider = new OllamaNativeProvider({ fetch: fetchMock, cloudPolicy: "disabled-confirmed" });

    await expect(provider.profileModel("qwen3.5:9b")).rejects.toThrow(/digest|identity/i);
  });

  it("reuses a profile after version and digest remain unchanged", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      calls.push(path);
      if (path === "/api/version") return jsonResponse(version);
      if (path === "/api/tags") return jsonResponse(tags);
      if (path === "/api/show") return jsonResponse(show);
      if (path === "/api/ps") return jsonResponse({ models: [] });
      throw new Error(`unexpected path ${path}`);
    });
    const provider = new OllamaNativeProvider({ fetch: fetchMock, cloudPolicy: "disabled-confirmed" });

    await provider.profileModel("qwen3.5:9b");
    await provider.profileModel("qwen3.5:9b");

    expect(calls).toEqual(["/api/version", "/api/tags", "/api/show", "/api/ps", "/api/version", "/api/tags"]);
  });

  it("records validated performance samples and restores them by model digest/version", async () => {
    const storage = new TestStorage();
    const profileStore = createPerformanceProfileStore(storage, "profile:");
    const provider = new OllamaNativeProvider({ fetch: createProfileFetchMock(), cloudPolicy: "disabled-confirmed", profileStore });
    await provider.profileModel("qwen3.5:9b");

    const updated = provider.recordPerformanceProfile("qwen3.5:9b", {
      scenario: "direct-chat",
      contextLength: 8192,
      thinkSetting: "off",
      keepAlive: "10m",
      cold: { ttftMs: 900, totalDurationMs: 1_200, loadDurationMs: 40, promptTokensPerSecond: 80, decodeTokensPerSecond: 20 },
      warm: { ttftMs: 120, totalDurationMs: 120, loadDurationMs: 10, promptTokensPerSecond: 100, decodeTokensPerSecond: 25 },
      measuredAt: "2026-09-04T00:00:00.000Z"
    });

    expect(updated.performanceProfiles).toHaveLength(1);
    const restored = new OllamaNativeProvider({ fetch: createProfileFetchMock(), cloudPolicy: "disabled-confirmed", profileStore });
    const restoredProfile = await restored.profileModel("qwen3.5:9b");
    expect(restoredProfile.performanceProfiles).toEqual(updated.performanceProfiles);
  });

  it("runs a bounded cold/warm native benchmark and persists the measured profile", async () => {
    const storage = new TestStorage();
    const profileStore = createPerformanceProfileStore(storage, "profile:");
    const chatBodies: Array<Record<string, unknown>> = [];
    const fetchMock = createBenchmarkFetchMock(chatBodies);
    const provider = new OllamaNativeProvider({ fetch: fetchMock, cloudPolicy: "disabled-confirmed", profileStore });

    const result = await provider.benchmarkModel({ model: "qwen3.5:9b", contextLength: 8192, keepAlive: "10m" });

    expect(chatBodies).toHaveLength(2);
    expect(chatBodies[0]).toMatchObject({ model: "qwen3.5:9b", keep_alive: 0, stream: true });
    expect(chatBodies[1]).toMatchObject({ model: "qwen3.5:9b", keep_alive: "10m", stream: true });
    expect(result.profile.performanceProfiles).toHaveLength(1);
    expect(result.profile.performanceProfiles[0]).toMatchObject({
      scenario: "direct-chat",
      contextLength: 8192,
      keepAlive: "10m",
      sampleCount: 1
    });
    expect(result.cold.metrics.promptEvalCount).toBe(10);
    expect(result.warm.metrics.evalCount).toBe(5);
  });

  it("can probe an unknown tool capability with a virtual tool and never execute it", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(new URL(String(input)).pathname).toBe("/api/chat");
      const body = JSON.parse(String(init?.body));
      expect(body.tools[0].function.name).toBe("opencow_probe_noop");
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"model":"qwen3.5:9b","message":{"tool_calls":[{"function":{"name":"opencow_probe_noop","arguments":{}}}]},"done":true,"done_reason":"stop","eval_count":1,"eval_duration":1000000}\n'));
          controller.close();
        }
      }), { status: 200 });
    });
    const provider = new OllamaNativeProvider({
      fetch: fetchMock,
      cloudPolicy: "disabled-confirmed",
      verifiedModels: { "qwen3.5:9b": "sha256:chat-digest" }
    });

    const result = await provider.probeModelCapabilities("qwen3.5:9b", { tools: true, structuredOutput: false, thinking: false });

    expect(result.tools.state).toBe("probed-supported");
    expect(result.tools.evidence).toMatch(/virtual/i);
  });
});

class TestStorage implements ProfileStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

function createProfileFetchMock() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/version") return jsonResponse(version);
    if (path === "/api/tags") return jsonResponse(tags);
    if (path === "/api/show") return jsonResponse(show);
    if (path === "/api/ps") return jsonResponse({ models: [] });
    throw new Error(`unexpected path ${path}`);
  });
}

function createBenchmarkFetchMock(chatBodies: Array<Record<string, unknown>>) {
  let chatCount = 0;
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/version") return jsonResponse(version);
    if (path === "/api/tags") return jsonResponse(tags);
    if (path === "/api/show") return jsonResponse(show);
    if (path === "/api/ps") return jsonResponse({ models: [] });
    if (path !== "/api/chat") throw new Error(`unexpected path ${path}`);
    chatBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    chatCount += 1;
    const duration = chatCount === 1 ? 1_000_000_000 : 200_000_000;
    const loadDuration = chatCount === 1 ? 100_000_000 : 10_000_000;
    const encoder = new TextEncoder();
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"model":"qwen3.5:9b","message":{"content":"ok"}}\n'));
        controller.enqueue(encoder.encode(`{"model":"qwen3.5:9b","done":true,"done_reason":"stop","total_duration":${duration},"load_duration":${loadDuration},"prompt_eval_count":10,"prompt_eval_duration":200000000,"eval_count":5,"eval_duration":250000000}\n`));
        controller.close();
      }
    }), { status: 200 });
  });
}
