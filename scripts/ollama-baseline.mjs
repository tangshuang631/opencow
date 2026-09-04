import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

export const DEFAULT_OLLAMA_ENDPOINT = "http://127.0.0.1:11434";

function assertLocalEndpoint(endpoint) {
  const url = new URL(endpoint);
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error("WP0 Ollama baseline requires a loopback endpoint; cloud/remote endpoints are refused");
  }
  return url;
}

function durationMs(value) {
  return typeof value === "number" && Number.isFinite(value) ? value / 1e6 : null;
}

function throughput(count, duration) {
  return count > 0 && duration > 0 ? count / (duration / 1e9) : null;
}

export function buildNativeChatRequest({ model, message, context, keepAlive = "10m", think = false }) {
  return {
    model,
    messages: [{ role: "user", content: message }],
    stream: false,
    think,
    keep_alive: keepAlive,
    options: { num_ctx: context }
  };
}

export function buildCacheContinuationRequests({ model, stablePrefix, firstMessage, secondMessage, context, keepAlive = "10m", think = false }) {
  const base = { model, stream: false, think, keep_alive: keepAlive, options: { num_ctx: context } };
  return [
    { ...base, messages: [{ role: "system", content: stablePrefix }, { role: "user", content: firstMessage }] },
    { ...base, messages: [{ role: "system", content: stablePrefix }, { role: "user", content: secondMessage }] }
  ];
}

function resolveContextWindow(show) {
  const info = show?.model_info ?? {};
  const known = info["general.context_length"] ?? info["llama.context_length"] ?? info.context_length;
  if (known != null) return known;
  const key = Object.keys(info).find((name) => name.endsWith(".context_length"));
  return key ? info[key] : null;
}

export function buildNativeEmbedRequest({ model, input, truncate = false, keepAlive = "5m" }) {
  return { model, input, truncate, keep_alive: keepAlive };
}

function advertisesEmbedding(model) {
  return model?.capabilities?.some((capability) => capability.toLowerCase() === "embedding") ?? false;
}

export function parseChatMetrics(payload, wallClockMs) {
  const promptEvalDuration = durationMs(payload.prompt_eval_duration);
  const evalDuration = durationMs(payload.eval_duration);
  return {
    totalLatencyMs: wallClockMs,
    ttftMs: wallClockMs,
    ttftSource: "non-streaming-request-latency-upper-bound",
    loadDurationMs: durationMs(payload.load_duration),
    promptEvalCount: payload.prompt_eval_count ?? null,
    promptEvalDurationMs: promptEvalDuration,
    promptTokensPerSecond: throughput(payload.prompt_eval_count ?? 0, payload.prompt_eval_duration ?? 0),
    evalCount: payload.eval_count ?? null,
    evalDurationMs: evalDuration,
    generationTokensPerSecond: throughput(payload.eval_count ?? 0, payload.eval_duration ?? 0),
    doneReason: payload.done_reason ?? null
  };
}

export function parseCacheContinuation(cold, repeated) {
  const coldDuration = Number.isFinite(cold?.promptEvalDurationMs) && cold.promptEvalDurationMs > 0 ? cold.promptEvalDurationMs : null;
  const repeatedDuration = Number.isFinite(repeated?.promptEvalDurationMs) && repeated.promptEvalDurationMs >= 0 ? repeated.promptEvalDurationMs : null;
  const ratio = coldDuration !== null && repeatedDuration !== null ? repeatedDuration / coldDuration : null;
  return {
    status: ratio !== null && ratio <= 0.7 ? "candidate-hit" : "unverified",
    promptEvalDurationRatio: ratio
  };
}

async function runChatProbe(fetchImpl, base, request) {
  const startedAt = performance.now();
  const payload = await requestJson(fetchImpl, `${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request)
  });
  return parseChatMetrics(payload, performance.now() - startedAt);
}

async function requestJson(fetchImpl, url, init = {}) {
  const response = await fetchImpl(url, init);
  if (!response.ok) throw new Error(`Ollama ${response.status} ${response.statusText || "request failed"}`);
  return response.json();
}

export async function collectOllamaBaseline({
  endpoint = DEFAULT_OLLAMA_ENDPOINT,
  model,
  embeddingModel,
  context = 8192,
  keepAlive = "10m",
  think = false,
  includeEmbedding = true,
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch is required to collect an Ollama baseline");
  const base = assertLocalEndpoint(endpoint).toString().replace(/\/$/, "");
  const version = await requestJson(fetchImpl, `${base}/api/version`);
  const tags = await requestJson(fetchImpl, `${base}/api/tags`);
  const selected = model || tags.models?.find((item) => !advertisesEmbedding(item))?.name || tags.models?.[0]?.name;
  if (!selected) throw new Error("Ollama returned no local model for baseline");
  const show = await requestJson(fetchImpl, `${base}/api/show`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: selected })
  });
  const ps = await requestJson(fetchImpl, `${base}/api/ps`);
  const chatRequest = buildNativeChatRequest({ model: selected, message: "Reply with one short word.", context, keepAlive, think });
  const cold = await runChatProbe(fetchImpl, base, { ...chatRequest, keep_alive: "0s" });
  await runChatProbe(fetchImpl, base, chatRequest);
  const warm = await runChatProbe(fetchImpl, base, chatRequest);
  const [cacheColdRequest, cacheRepeatedRequest] = buildCacheContinuationRequests({
    model: selected,
    stablePrefix: "OpenCow stable system contract v1\nCapability schema order: retrieval.answer, diagnostic.read\nTask mode: direct-chat",
    firstMessage: "cache continuation first turn",
    secondMessage: "cache continuation second turn",
    context,
    keepAlive,
    think
  });
  const cacheCold = await runChatProbe(fetchImpl, base, cacheColdRequest);
  const cacheRepeated = await runChatProbe(fetchImpl, base, cacheRepeatedRequest);
  let embedding = null;
  const selectedEmbedding = embeddingModel || tags.models?.find(advertisesEmbedding)?.name || null;
  if (includeEmbedding && selectedEmbedding) {
    try {
      const embeddingShow = selectedEmbedding === selected
        ? show
        : await requestJson(fetchImpl, `${base}/api/show`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ model: selectedEmbedding })
          });
      const embedStartedAt = performance.now();
      const embed = await requestJson(fetchImpl, `${base}/api/embed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildNativeEmbedRequest({ model: selectedEmbedding, input: ["wp0 baseline"], truncate: false }))
      });
      embedding = {
        status: "measured",
        modelId: selectedEmbedding,
        latencyMs: performance.now() - embedStartedAt,
        dimensions: Array.isArray(embed.embeddings?.[0]) ? embed.embeddings[0].length : null,
        modelDigest: embeddingShow.digest ?? tags.models?.find((item) => item.name === selectedEmbedding)?.digest ?? null
      };
    } catch (error) {
      embedding = { status: "unavailable", modelId: selectedEmbedding, reason: error.message };
    }
  } else if (includeEmbedding) {
    embedding = { status: "unavailable", modelId: null, reason: "no local model advertises embedding capability" };
  }

  return {
    schemaVersion: "ollama-baseline-v1",
    endpoint: base,
    locality: "loopback-enforced",
    ollamaVersion: version.version ?? null,
    model: {
      id: selected,
      digest: show.digest ?? tags.models?.find((item) => item.name === selected)?.digest ?? null,
      architecture: show.details?.family ?? show.model_info?.general?.architecture ?? null,
      quantization: show.details?.quantization_level ?? null,
      contextWindow: resolveContextWindow(show),
      context
    },
    capabilities: {
      tools: show.capabilities?.includes("tools") ?? null,
      structuredOutput: show.capabilities?.includes("structured_output") ?? null,
      thinking: show.capabilities?.includes("thinking") ?? null,
      vision: show.capabilities?.includes("vision") ?? null,
      embedding: embedding?.status === "measured"
    },
    runtimePath: "ollama-native-api",
    residencyObservation: ps.models ?? [],
    processorPlacement: ps.models?.[0]?.details?.processor ?? null,
    memoryPressure: null,
    cold,
    warm,
    cacheObservation: {
      ...parseCacheContinuation(cacheCold, cacheRepeated),
      stablePrefixChars: cacheColdRequest.messages[0].content.length,
      coldPromptEvalDurationMs: cacheCold.promptEvalDurationMs,
      repeatedPromptEvalDurationMs: cacheRepeated.promptEvalDurationMs
    },
    embedding
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const endpoint = process.env.OPENCOW_OLLAMA_ENDPOINT || DEFAULT_OLLAMA_ENDPOINT;
  collectOllamaBaseline({
    endpoint,
    model: process.env.OPENCOW_OLLAMA_MODEL,
    embeddingModel: process.env.OPENCOW_OLLAMA_EMBED_MODEL
  })
    .then((report) => console.log(JSON.stringify(report)))
    .catch((error) => {
      console.error(`ollama baseline unavailable: ${error.message}`);
      process.exitCode = 1;
    });
}
