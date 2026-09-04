import type { OllamaModelSummary, OllamaRunningModel, OllamaShowResponse, ModelCapabilityState, ModelProfile } from "./types.js";

export function createModelProfile(input: {
  modelId: string;
  modelDigest: string;
  ollamaVersion: string;
  tag: OllamaModelSummary;
  show: OllamaShowResponse;
  running?: OllamaRunningModel;
  probedAt?: string;
}): ModelProfile {
  const capabilities = new Set([...(input.tag.details?.capabilities ?? []), ...(input.show.capabilities ?? [])].map((value) => value.toLowerCase()));
  const modelInfo = input.show.model_info ?? {};
  const contextEntry = Object.entries(modelInfo).find(([key]) => key.endsWith(".context_length"));
  const embeddingEntry = Object.entries(modelInfo).find(([key]) => key.endsWith(".embedding_length"));
  const maxContextWindow = positiveNumber(contextEntry?.[1]) ?? 0;
  const embeddingDimensions = positiveNumber(embeddingEntry?.[1]);
  const architecture = stringValue(modelInfo["general.architecture"]) ?? input.tag.details?.family;
  const parameterCount = positiveNumber(modelInfo["general.parameter_count"]);
  const executionEngineValue = stringValue(modelInfo["general.execution_engine"]) ?? stringValue(modelInfo["general.engine"]);
  const executionEngine = executionEngineValue === "mlx" || executionEngineValue === "llama.cpp" || executionEngineValue === "other" ? executionEngineValue : "unknown";
  const runningModel = input.running;
  const profile: ModelProfile = {
    modelId: input.modelId,
    modelDigest: input.modelDigest,
    provider: "ollama-native",
    ollamaVersion: input.ollamaVersion,
    format: input.show.details?.format ?? input.tag.details?.format,
    families: input.show.details?.families ?? input.tag.details?.families ?? (input.tag.details?.family ? [input.tag.details.family] : []),
    architecture,
    ...(parameterCount ? { parameterCount } : {}),
    parameterSizeLabel: input.show.details?.parameter_size ?? input.tag.details?.parameter_size,
    quantization: input.show.details?.quantization_level ?? input.tag.details?.quantization_level,
    maxContextWindow,
    ...(runningModel?.context_length ? { allocatedContextWindow: runningModel.context_length } : {}),
    capabilities: {
      completion: capability(capabilities.has("completion"), "Ollama metadata capabilities"),
      streaming: { state: "declared", evidence: "Ollama native /api/chat supports stream" },
      tools: capability(capabilities.has("tools"), "Ollama /api/show capabilities"),
      structuredOutput: capability(capabilities.has("structured_output") || capabilities.has("json"), "Ollama metadata capabilities"),
      thinking: capability(capabilities.has("thinking"), "Ollama /api/show capabilities"),
      vision: capability(capabilities.has("vision"), "Ollama /api/show capabilities"),
      embedding: capability(capabilities.has("embedding"), "Ollama metadata capabilities")
    },
    ...(embeddingDimensions ? { embeddingDimensions } : {}),
    executionEngine,
    executionEngineEvidence: executionEngineValue ? [`model_info.execution_engine=${executionEngineValue}`] : [],
    runtimeOptimizations: stringArray(modelInfo["general.runtime_optimizations"]),
    preferredRoles: preferredRoles(capabilities),
    performanceProfiles: [],
    profileSchemaVersion: 1,
    probeVersion: 1,
    probedAt: input.probedAt ?? new Date().toISOString()
  };
  return profile;
}

function capability(declared: boolean, evidence: string): ModelCapabilityState {
  return declared ? { state: "declared", evidence } : { state: "unknown", evidence: "Ollama metadata did not declare this capability" };
}

function preferredRoles(capabilities: Set<string>): ModelProfile["preferredRoles"] {
  const roles: ModelProfile["preferredRoles"] = [];
  if (capabilities.has("embedding")) roles.push("embedding");
  if (capabilities.has("tools") || capabilities.has("structured_output")) roles.push("tool");
  if (capabilities.has("completion") || roles.length === 0) roles.push("chat");
  return roles;
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
}
