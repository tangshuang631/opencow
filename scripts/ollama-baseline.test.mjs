import assert from "node:assert/strict";
import test from "node:test";
import { buildNativeChatRequest, buildNativeEmbedRequest, collectOllamaBaseline, parseChatMetrics } from "./ollama-baseline.mjs";

test("builds native Ollama chat and embed requests with cache-friendly controls", () => {
  assert.equal(buildNativeChatRequest({ model: "m", message: "x", context: 4096 }).keep_alive, "10m");
  assert.equal(buildNativeChatRequest({ model: "m", message: "x", context: 4096 }).options.num_ctx, 4096);
  assert.equal(buildNativeEmbedRequest({ model: "e", input: ["x"] }).truncate, false);
});

test("parses Ollama usage metrics without inventing offload estimates", () => {
  const metrics = parseChatMetrics({ prompt_eval_count: 20, prompt_eval_duration: 2e9, eval_count: 10, eval_duration: 1e9 }, 50);
  assert.equal(metrics.promptTokensPerSecond, 10);
  assert.equal(metrics.generationTokensPerSecond, 10);
  assert.equal(Object.hasOwn(metrics, "estimatedCpuOffloadRatio"), false);
});

test("collects native metadata and refuses remote endpoints", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push([url, init]);
    if (url.endsWith("/api/version")) return { ok: true, json: async () => ({ version: "test" }) };
    if (url.endsWith("/api/tags")) return { ok: true, json: async () => ({ models: [{ name: "m", digest: "sha", capabilities: ["embedding"] }] }) };
    if (url.endsWith("/api/show")) return { ok: true, json: async () => ({ digest: "sha", model_info: { "qwen35.context_length": 32768 }, details: { family: "llama", quantization_level: "Q4" }, capabilities: ["tools", "embedding"] }) };
    if (url.endsWith("/api/ps")) return { ok: true, json: async () => ({ models: [] }) };
    if (url.endsWith("/api/chat")) return { ok: true, json: async () => ({ prompt_eval_count: 1, prompt_eval_duration: 1e6, eval_count: 1, eval_duration: 1e6, done_reason: "stop" }) };
    return { ok: true, json: async () => ({ embeddings: [[0, 1]] }) };
  };
  const report = await collectOllamaBaseline({ fetchImpl });
  assert.equal(report.runtimePath, "ollama-native-api");
  assert.equal(report.model.digest, "sha");
  assert.equal(report.model.contextWindow, 32768);
  assert.equal(report.cold.ttftSource, "non-streaming-request-latency-upper-bound");
  assert.ok(report.warm);
  assert.ok(calls.some(([url]) => url.endsWith("/api/embed")));
  await assert.rejects(() => collectOllamaBaseline({ endpoint: "https://example.com", fetchImpl }), /loopback endpoint/);
});

test("selects a chat model separately from an embedding model", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/api/version")) return { ok: true, json: async () => ({ version: "test" }) };
    if (url.endsWith("/api/tags")) {
      return {
        ok: true,
        json: async () => ({
          models: [
            { name: "embed", digest: "embed-sha", capabilities: ["embedding"] },
            { name: "chat", digest: "sha", capabilities: ["completion"] }
          ]
        })
      };
    }
    if (url.endsWith("/api/show")) return { ok: true, json: async () => ({ digest: "sha", capabilities: ["completion"] }) };
    if (url.endsWith("/api/ps")) return { ok: true, json: async () => ({ models: [] }) };
    return { ok: true, json: async () => ({ prompt_eval_count: 1, prompt_eval_duration: 1e6, eval_count: 1, eval_duration: 1e6 }) };
  };
  const report = await collectOllamaBaseline({ fetchImpl });
  assert.equal(report.model.id, "chat");
  assert.equal(report.embedding.status, "measured");
  assert.equal(report.embedding.modelId, "embed");
  assert.equal(report.capabilities.embedding, true);
});

test("keeps chat baseline usable when no local embedding model is installed", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/api/version")) return { ok: true, json: async () => ({ version: "test" }) };
    if (url.endsWith("/api/tags")) return { ok: true, json: async () => ({ models: [{ name: "chat", digest: "sha", capabilities: ["completion"] }] }) };
    if (url.endsWith("/api/show")) return { ok: true, json: async () => ({ digest: "sha", capabilities: ["completion"] }) };
    if (url.endsWith("/api/ps")) return { ok: true, json: async () => ({ models: [] }) };
    return { ok: true, json: async () => ({ prompt_eval_count: 1, prompt_eval_duration: 1e6, eval_count: 1, eval_duration: 1e6 }) };
  };
  const report = await collectOllamaBaseline({ fetchImpl });
  assert.equal(report.embedding.status, "unavailable");
  assert.equal(report.capabilities.embedding, false);
});
