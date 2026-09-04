import type { ModelPerformanceProfile, OllamaUsageMetrics, ResidencyObservation } from "./types.js";

export type PerformanceSample = {
  scenario: ModelPerformanceProfile["scenario"];
  contextLength: number;
  thinkSetting: ModelPerformanceProfile["thinkSetting"];
  keepAlive: string;
  cold: OllamaUsageMetrics;
  warm: OllamaUsageMetrics;
  residency?: ResidencyObservation;
  prefixTokens?: number;
  coldPrefixPromptEvalMs?: number;
  repeatedPrefixPromptEvalMs?: number;
  sampleCount?: number;
  measuredAt?: string;
};

export function collectPerformanceProfile(input: PerformanceSample): ModelPerformanceProfile {
  const coldTtftMs = required(input.cold.ttftMs, "cold.ttftMs");
  const warmTtftMs = required(input.warm.ttftMs, "warm.ttftMs");
  const loadDurationMs = required(input.warm.loadDurationMs ?? input.cold.loadDurationMs, "loadDurationMs");
  const totalLatencyMs = required(input.warm.totalDurationMs ?? input.cold.totalDurationMs, "totalDurationMs");
  const promptTokensPerSecond = required(input.warm.promptTokensPerSecond ?? input.cold.promptTokensPerSecond, "promptTokensPerSecond");
  const decodeTokensPerSecond = input.scenario === "embedding"
    ? input.warm.decodeTokensPerSecond ?? input.cold.decodeTokensPerSecond ?? 0
    : required(input.warm.decodeTokensPerSecond ?? input.cold.decodeTokensPerSecond, "decodeTokensPerSecond");
  const residency = input.residency;
  const sampleCount = input.sampleCount ?? 1;
  if (!Number.isInteger(sampleCount) || sampleCount < 1) throw new Error("sampleCount must be a positive integer.");
  if (!Number.isFinite(input.contextLength) || input.contextLength < 1) throw new Error("contextLength must be positive.");

  return {
    scenario: input.scenario,
    contextLength: input.contextLength,
    thinkSetting: input.thinkSetting,
    keepAlive: input.keepAlive,
    ...(input.prefixTokens === undefined ? {} : { prefixTokens: nonNegative(input.prefixTokens, "prefixTokens") }),
    sampleCount,
    coldTtftMs,
    warmTtftMs,
    loadDurationMs,
    promptTokensPerSecond,
    decodeTokensPerSecond: nonNegative(decodeTokensPerSecond, "decodeTokensPerSecond"),
    totalLatencyMs,
    ...(residency?.modelSizeBytes === undefined ? {} : { residentModelBytes: nonNegative(residency.modelSizeBytes, "modelSizeBytes") }),
    ...(residency?.acceleratorResidentBytes === undefined ? {} : { acceleratorResidentBytes: nonNegative(residency.acceleratorResidentBytes, "acceleratorResidentBytes") }),
    ...(residency?.acceleratorResidentRatio === undefined ? {} : { acceleratorResidentRatio: boundedRatio(residency.acceleratorResidentRatio) }),
    acceleratorResidency: residencyState(residency),
    processorPlacement: residency?.processorPlacement ?? "unknown",
    ...(residency?.cpuExecutionShare === undefined ? {} : { cpuExecutionShare: boundedRatio(residency.cpuExecutionShare) }),
    ...(input.coldPrefixPromptEvalMs === undefined ? {} : { coldPrefixPromptEvalMs: nonNegative(input.coldPrefixPromptEvalMs, "coldPrefixPromptEvalMs") }),
    ...(input.repeatedPrefixPromptEvalMs === undefined ? {} : { repeatedPrefixPromptEvalMs: nonNegative(input.repeatedPrefixPromptEvalMs, "repeatedPrefixPromptEvalMs") }),
    measuredAt: input.measuredAt ?? new Date().toISOString()
  };
}

function residencyState(observation: ResidencyObservation | undefined): ModelPerformanceProfile["acceleratorResidency"] {
  if (!observation) return "unknown";
  if (observation.processorPlacement === "cpu") return "cpu";
  if (observation.acceleratorResidentRatio === undefined) return "unknown";
  return observation.acceleratorResidentRatio >= 1 ? "full" : observation.acceleratorResidentRatio > 0 ? "partial" : "unknown";
}

function required(value: number | undefined, label: string): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) throw new Error(`${label} is required and must be non-negative.`);
  return value;
}

function nonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be non-negative.`);
  return value;
}

function boundedRatio(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error("residency ratios must be between 0 and 1.");
  return value;
}
