import { createLocalityEnforcement, normalizeLoopbackEndpoint, assertLocalityEnforced } from "./locality.js";
import { collectPerformanceProfile, type PerformanceSample } from "./metricsCollector.js";
import type { PerformanceProfileStore } from "./performanceProfileStore.js";
import { createModelProfile } from "./profile.js";
import { createRuntimeProfile } from "./runtimeProfile.js";
import type {
  OllamaChatRequest,
  OllamaChatResult,
  OllamaEmbedRequest,
  OllamaEmbedResult,
  OllamaMessage,
  OllamaPsResponse,
  OllamaRunningModel,
  OllamaRuntimeProfile,
  OllamaShowResponse,
  OllamaTagsResponse,
  OllamaToolCall,
  OllamaUsageMetrics,
  ModelProfile
} from "./types.js";
export type { OllamaPsResponse, OllamaShowResponse, OllamaTagsResponse } from "./types.js";

export type OllamaBenchmarkResult = {
  cold: OllamaChatResult;
  warm: OllamaChatResult;
  profile: ModelProfile;
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class OllamaNativeProvider {
  readonly endpoint: string;
  private readonly fetcher: FetchLike;
  private readonly cloudPolicy: "disabled-confirmed" | "egress-blocked-confirmed" | "unverified";
  private readonly performanceProfileStore?: PerformanceProfileStore;
  private readonly verifiedDigests = new Map<string, string>();
  private readonly profileCache = new Map<string, { ollamaVersion: string; digest: string; profile: ModelProfile }>();
  private lastVersion = "";

  constructor(options: {
    endpoint?: string;
    fetch?: FetchLike;
    cloudPolicy?: "disabled-confirmed" | "egress-blocked-confirmed" | "unverified";
    verifiedModels?: Record<string, string>;
    profileStore?: PerformanceProfileStore;
  } = {}) {
    this.endpoint = normalizeLoopbackEndpoint(options.endpoint ?? "http://127.0.0.1:11434");
    this.fetcher = options.fetch ?? fetch;
    this.cloudPolicy = options.cloudPolicy ?? "unverified";
    this.performanceProfileStore = options.profileStore;
    for (const [model, digest] of Object.entries(options.verifiedModels ?? {})) {
      if (model.trim() && digest.trim()) this.verifiedDigests.set(model.trim(), digest.trim());
    }
  }

  async getVersion(signal?: AbortSignal): Promise<string> {
    const payload = await this.json<{ version?: unknown }>("/api/version", { signal });
    if (typeof payload.version !== "string" || !payload.version.trim()) throw new Error("Ollama /api/version returned malformed metadata.");
    this.lastVersion = payload.version.trim();
    return this.lastVersion;
  }

  async listModels(signal?: AbortSignal): Promise<NonNullable<OllamaTagsResponse["models"]>> {
    const payload = await this.json<OllamaTagsResponse>("/api/tags", { signal });
    const models = (payload.models ?? []).filter((model) => typeof model.name === "string" && model.name.trim() && typeof model.digest === "string" && model.digest.trim());
    for (const model of models) this.verifiedDigests.set(model.name, model.digest);
    return models;
  }

  async showModel(model: string, signal?: AbortSignal): Promise<OllamaShowResponse> {
    return this.json<OllamaShowResponse>("/api/show", { method: "POST", body: { name: model }, signal });
  }

  async listRunning(signal?: AbortSignal): Promise<NonNullable<OllamaPsResponse["models"]>> {
    const payload = await this.json<OllamaPsResponse>("/api/ps", { signal });
    return payload.models ?? [];
  }

  async profileModel(modelId: string, signal?: AbortSignal): Promise<ModelProfile> {
    const model = modelId.trim();
    if (!model) throw new Error("Ollama model id is required.");
    const ollamaVersion = await this.getVersion(signal);
    const models = await this.listModels(signal);
    const tag = models.find((item) => item.name === model || item.model === model);
    if (!tag) throw new Error(`Ollama model is not installed locally: ${model}`);
    const cached = this.profileCache.get(model);
    if (cached?.ollamaVersion === ollamaVersion && cached.digest === tag.digest) return cached.profile;
    const show = await this.showModel(model, signal);
    if (typeof show.digest === "string" && show.digest.trim() && show.digest.trim() !== tag.digest) {
      throw new Error(`Ollama model digest identity mismatch for ${model}.`);
    }
    const running = (await this.listRunning(signal)).find((item) => item.name === model || item.model === model);
    const profile = createModelProfile({ modelId: model, modelDigest: tag.digest, ollamaVersion, tag, show, running });
    profile.performanceProfiles = this.performanceProfileStore?.read({ modelDigest: tag.digest, ollamaVersion }) ?? [];
    this.profileCache.set(model, { ollamaVersion, digest: tag.digest, profile });
    return profile;
  }

  recordPerformanceProfile(modelId: string, sample: PerformanceSample): ModelProfile {
    const model = modelId.trim();
    const cached = this.profileCache.get(model);
    if (!cached) throw new Error(`Ollama model profile is not loaded: ${model}`);
    const performanceProfile = collectPerformanceProfile(sample);
    const performanceProfiles = this.performanceProfileStore
      ?.append({ modelDigest: cached.digest, ollamaVersion: cached.ollamaVersion, profile: performanceProfile })
      ?? [...cached.profile.performanceProfiles, performanceProfile].slice(-24);
    const profile = { ...cached.profile, performanceProfiles };
    this.profileCache.set(model, { ...cached, profile });
    return profile;
  }

  async benchmarkModel(input: {
    model: string;
    scenario?: Exclude<PerformanceSample["scenario"], "embedding">;
    contextLength?: number;
    think?: OllamaChatRequest["think"];
    keepAlive?: string | number;
    signal?: AbortSignal;
  }): Promise<OllamaBenchmarkResult> {
    const model = input.model.trim();
    const profile = await this.profileModel(model, input.signal);
    const contextLength = resolveBenchmarkContextLength(profile, input.contextLength);
    const keepAlive = normalizeBenchmarkKeepAlive(input.keepAlive);
    const think = input.think ?? false;
    const messages: OllamaMessage[] = [{ role: "user", content: "OpenCow native runtime benchmark. Reply with OK." }];
    const options = { temperature: 0, seed: 0, num_predict: 16 };
    const cold = await this.chat({ model, messages, think, keepAlive: 0, options, signal: input.signal });
    const warm = await this.chat({ model, messages, think, keepAlive, options, signal: input.signal });
    const measuredProfile = this.recordPerformanceProfile(model, {
      scenario: input.scenario ?? "direct-chat",
      contextLength,
      thinkSetting: benchmarkThinkSetting(think),
      keepAlive,
      cold: cold.metrics,
      warm: warm.metrics
    });
    return { cold, warm, profile: measuredProfile };
  }

  async probeModelCapabilities(model: string, requested: { tools?: boolean; structuredOutput?: boolean; thinking?: boolean }, signal?: AbortSignal): Promise<ModelProfile["capabilities"]> {
    const unknown = (): ModelProfile["capabilities"] => ({
      completion: { state: "unknown", evidence: "not probed" },
      streaming: { state: "unknown", evidence: "not probed" },
      tools: { state: "unknown", evidence: "not probed" },
      structuredOutput: { state: "unknown", evidence: "not probed" },
      thinking: { state: "unknown", evidence: "not probed" },
      vision: { state: "unknown", evidence: "not probed" },
      embedding: { state: "unknown", evidence: "not probed" }
    });
    const result = unknown();
    if (requested.tools) {
      try {
        const response = await this.chat({
          model,
          messages: [{ role: "user", content: "Return one virtual tool call for the OpenCow capability probe." }],
          tools: [{ type: "function", function: { name: "opencow_probe_noop", description: "Virtual probe; never executed.", parameters: { type: "object", properties: {} } } }],
          think: false,
          signal
        });
        result.tools = response.toolCalls.some((call) => call.function.name === "opencow_probe_noop")
          ? { state: "probed-supported", evidence: "virtual tool call returned; no tool execution" }
          : { state: "probed-unsupported", evidence: "virtual tool call was not returned" };
      } catch (error) {
        result.tools = { state: "unknown", evidence: `probe failed: ${error instanceof Error ? error.message : "unknown error"}` };
      }
    }
    if (requested.structuredOutput) {
      try {
        const response = await this.chat({
          model,
          messages: [{ role: "user", content: "Return the JSON object {\"ok\":true}." }],
          format: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
          think: false,
          signal
        });
        const parsed = JSON.parse(response.content) as { ok?: unknown };
        result.structuredOutput = parsed.ok === true
          ? { state: "probed-supported", evidence: "JSON Schema probe validated" }
          : { state: "probed-unsupported", evidence: "JSON Schema probe returned invalid shape" };
      } catch (error) {
        result.structuredOutput = { state: "unknown", evidence: `probe failed: ${error instanceof Error ? error.message : "unknown error"}` };
      }
    }
    if (requested.thinking) {
      try {
        const response = await this.chat({ model, messages: [{ role: "user", content: "Briefly state OK." }], think: true, signal });
        result.thinking = response.thinking.trim()
          ? { state: "probed-supported", evidence: "thinking probe returned a distinct thinking field" }
          : { state: "probed-unsupported", evidence: "thinking probe returned no thinking field" };
      } catch (error) {
        result.thinking = { state: "unknown", evidence: `probe failed: ${error instanceof Error ? error.message : "unknown error"}` };
      }
    }
    return result;
  }

  getLocalityState(model: string) {
    const digest = this.verifiedDigests.get(model.trim());
    return createLocalityEnforcement({ endpoint: this.endpoint, cloudPolicy: this.cloudPolicy, modelDigest: digest, modelInstalledLocally: Boolean(digest) });
  }

  async profileRuntime(input: {
    operatingSystem: "macos" | "windows" | "linux";
    hardwareArch: string;
    physicalMemoryBytes: number;
    availableMemoryBytes: number;
    memoryPressure: OllamaRuntimeProfile["memoryPressure"];
    cloudFeatures?: OllamaRuntimeProfile["cloudFeatures"];
    compatibilityManifestId?: string;
    signal?: AbortSignal;
  }): Promise<OllamaRuntimeProfile> {
    const version = await this.getVersion(input.signal);
    return createRuntimeProfile({
      endpoint: this.endpoint,
      ollamaVersion: version,
      compatibilityManifestId: input.compatibilityManifestId,
      operatingSystem: input.operatingSystem,
      hardwareArch: input.hardwareArch,
      physicalMemoryBytes: input.physicalMemoryBytes,
      availableMemoryBytes: input.availableMemoryBytes,
      memoryPressure: input.memoryPressure,
      cloudFeatures: input.cloudFeatures ?? (this.cloudPolicy === "disabled-confirmed" || this.cloudPolicy === "egress-blocked-confirmed"
        ? "disabled"
        : this.cloudPolicy === "unverified" ? "unknown" : "enabled"),
      nativeApiCompatibility: { chat: true, streaming: true, show: true, ps: true, embed: true, cancellation: true }
    });
  }

  async chat(request: OllamaChatRequest): Promise<OllamaChatResult> {
    this.assertRequestAllowed(request.model);
    const startedAt = now();
    const response = await this.raw("/api/chat", {
      method: "POST",
      body: {
        model: request.model,
        messages: request.messages,
        ...(request.tools ? { tools: request.tools } : {}),
        ...(request.format ? { format: request.format } : {}),
        ...(request.think !== undefined ? { think: request.think } : {}),
        ...(request.keepAlive !== undefined ? { keep_alive: request.keepAlive } : {}),
        ...(request.options ? { options: request.options } : {}),
        stream: true
      },
      signal: request.signal
    });
    return readChatStream(response, request.model, request.onChunk, () => now() - startedAt);
  }

  async embed(request: OllamaEmbedRequest): Promise<OllamaEmbedResult> {
    this.assertRequestAllowed(request.model);
    if (request.input.length === 0) throw new Error("Ollama embedding input cannot be empty.");
    const payload = await this.json<{
      model?: string;
      embeddings?: unknown;
      total_duration?: number;
      load_duration?: number;
      prompt_eval_count?: number;
      prompt_eval_duration?: number;
    }>("/api/embed", {
      method: "POST",
      body: { model: request.model, input: request.input, truncate: false, ...(request.keepAlive !== undefined ? { keep_alive: request.keepAlive } : {}) },
      signal: request.signal
    });
    if (!Array.isArray(payload.embeddings) || !payload.embeddings.every((item) => Array.isArray(item) && item.every((value) => typeof value === "number" && Number.isFinite(value)))) {
      throw new Error("Ollama /api/embed returned malformed embeddings.");
    }
    return {
      model: typeof payload.model === "string" ? payload.model : undefined,
      embeddings: payload.embeddings as number[][],
      metrics: durations(payload)
    };
  }

  private assertRequestAllowed(model: string): void {
    assertLocalityEnforced(this.getLocalityState(model));
  }

  private async raw(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<Response> {
    const response = await this.fetcher(`${this.endpoint}${path}`, {
      method: options.method ?? "GET",
      headers: options.body === undefined ? undefined : { "content-type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: "error",
      signal: options.signal
    });
    if (!response.ok) throw new Error(`Ollama ${path} failed with HTTP ${response.status}: ${await response.text()}`);
    return response;
  }

  private async json<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
    const response = await this.raw(path, options);
    try {
      return await response.json() as T;
    } catch {
      throw new Error(`Ollama ${path} returned malformed JSON.`);
    }
  }
}

type ChatChunk = {
  model?: string;
  done?: boolean;
  done_reason?: string;
  error?: string;
  message?: { thinking?: string; content?: string; tool_calls?: OllamaToolCall[] };
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};

async function readChatStream(response: Response, fallbackModel: string, onChunk: OllamaChatRequest["onChunk"], elapsed: () => number): Promise<OllamaChatResult> {
  if (!response.body) throw new Error("Ollama /api/chat did not return a stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let model = fallbackModel;
  let thinking = "";
  let content = "";
  let toolCalls: OllamaToolCall[] = [];
  let doneReason: string | undefined;
  let metrics: OllamaUsageMetrics = {};
  let firstVisibleAt: number | undefined;

  const consume = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let chunk: ChatChunk;
    try { chunk = JSON.parse(trimmed) as ChatChunk; } catch { return; }
    if (chunk.error?.trim()) throw new Error(`Ollama stream returned an error: ${chunk.error.trim()}`);
    if (chunk.model?.trim()) model = chunk.model;
    if (chunk.done_reason) doneReason = chunk.done_reason;
    if (chunk.message?.thinking) thinking += chunk.message.thinking;
    if (chunk.message?.content) content += chunk.message.content;
    if (chunk.message?.tool_calls) toolCalls = [...toolCalls, ...chunk.message.tool_calls];
    if (chunk.message?.thinking || chunk.message?.content || chunk.message?.tool_calls?.length) {
      firstVisibleAt ??= elapsed();
      onChunk?.({ ...(chunk.message.thinking ? { thinking: chunk.message.thinking } : {}), ...(chunk.message.content ? { content: chunk.message.content } : {}), ...(chunk.message.tool_calls ? { toolCalls: chunk.message.tool_calls } : {}) });
    }
    if (chunk.done) metrics = { ...durations(chunk), ttftMs: firstVisibleAt };
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? "";
    lines.forEach(consume);
  }
  buffered += decoder.decode();
  consume(buffered);
  if (!thinking && !content && toolCalls.length === 0) throw new Error("Ollama /api/chat returned an empty assistant message.");
  return { model, thinking, content, toolCalls, doneReason, metrics: { ...metrics, ttftMs: metrics.ttftMs ?? firstVisibleAt ?? elapsed() } };
}

function durations(payload: { total_duration?: number; load_duration?: number; prompt_eval_count?: number; prompt_eval_duration?: number; eval_count?: number; eval_duration?: number }): OllamaUsageMetrics {
  const promptMs = millis(payload.prompt_eval_duration);
  const evalMs = millis(payload.eval_duration);
  return {
    ...(payload.total_duration !== undefined ? { totalDurationMs: millis(payload.total_duration) } : {}),
    ...(payload.load_duration !== undefined ? { loadDurationMs: millis(payload.load_duration) } : {}),
    ...(payload.prompt_eval_count !== undefined ? { promptEvalCount: payload.prompt_eval_count } : {}),
    ...(promptMs !== undefined ? { promptEvalDurationMs: promptMs } : {}),
    ...(payload.eval_count !== undefined ? { evalCount: payload.eval_count } : {}),
    ...(evalMs !== undefined ? { evalDurationMs: evalMs } : {}),
    ...(payload.prompt_eval_count && promptMs ? { promptTokensPerSecond: payload.prompt_eval_count / (promptMs / 1000) } : {}),
    ...(payload.eval_count && evalMs ? { decodeTokensPerSecond: payload.eval_count / (evalMs / 1000) } : {})
  };
}

function millis(nanoseconds: number | undefined): number | undefined {
  return typeof nanoseconds === "number" && Number.isFinite(nanoseconds) ? nanoseconds / 1_000_000 : undefined;
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function resolveBenchmarkContextLength(profile: ModelProfile, requested?: number): number {
  const contextLength = requested ?? Math.min(8192, profile.maxContextWindow || 8192);
  if (!Number.isFinite(contextLength) || contextLength < 1) throw new Error("benchmark context length must be positive.");
  return Math.min(Math.floor(contextLength), profile.maxContextWindow > 0 ? profile.maxContextWindow : Math.floor(contextLength));
}

function normalizeBenchmarkKeepAlive(value: string | number | undefined): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const normalized = typeof value === "string" ? value.trim() : undefined;
  return normalized || "10m";
}

function benchmarkThinkSetting(value: OllamaChatRequest["think"]): PerformanceSample["thinkSetting"] {
  if (value === undefined || value === false) return "off";
  if (value === true) return "on";
  return value;
}

export type { OllamaMessage };
export type { OllamaRunningModel };
