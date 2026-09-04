import type { MemoryPressure, ProcessorPlacement, ResidencyState, TaskClass } from "./types.js";

export type ContextBudgetDecision = {
  modelDigest: string;
  taskClass: TaskClass;
  modelMaxTokens: number;
  requestedTokens: number;
  allocatedTokens: number;
  reservedOutputTokens: number;
  availableMemoryBytes: number;
  acceleratorResidency: ResidencyState;
  processorPlacement: ProcessorPlacement;
  memoryPressure: MemoryPressure;
  evidenceTokens: number;
  historyTokens: number;
  summaryApplied: boolean;
  reductionReasons: string[];
};

export function decideContextBudget(input: {
  modelDigest: string;
  taskClass: TaskClass;
  modelMaxTokens: number;
  requestedTokens: number;
  reservedOutputTokens: number;
  availableMemoryBytes: number;
  modelSizeBytes: number;
  acceleratorResidency: ResidencyState;
  processorPlacement: ProcessorPlacement;
  memoryPressure: MemoryPressure;
  evidenceTokens: number;
  historyTokens: number;
}): ContextBudgetDecision {
  const reasons: string[] = [];
  let allocated = Math.min(Math.max(1, input.requestedTokens), Math.max(1, input.modelMaxTokens));
  const pressureCap = input.memoryPressure === "critical" ? 16_384 : input.memoryPressure === "high" ? 32_768 : Number.POSITIVE_INFINITY;
  const placementCap = input.processorPlacement === "mixed" || input.acceleratorResidency === "partial" ? 32_768 : input.processorPlacement === "cpu" || input.acceleratorResidency === "cpu" ? 16_384 : Number.POSITIVE_INFINITY;
  const memoryCap = input.availableMemoryBytes < input.modelSizeBytes * 1.35 ? 32_768 : Number.POSITIVE_INFINITY;
  const cap = Math.min(allocated, pressureCap, placementCap, memoryCap);

  if (cap < allocated) {
    allocated = cap;
    if (pressureCap < input.requestedTokens) reasons.push("memory-pressure");
    if (placementCap < input.requestedTokens) reasons.push("non-accelerator-residency");
    if (memoryCap < input.requestedTokens) reasons.push("model-memory-headroom");
  }

  const summaryApplied = allocated < input.requestedTokens || input.evidenceTokens + input.historyTokens > allocated * 0.55;
  if (summaryApplied && !reasons.includes("retrieval-summary")) reasons.push("retrieval-summary");

  return {
    modelDigest: input.modelDigest,
    taskClass: input.taskClass,
    modelMaxTokens: input.modelMaxTokens,
    requestedTokens: input.requestedTokens,
    allocatedTokens: Math.max(1, allocated),
    reservedOutputTokens: Math.max(0, input.reservedOutputTokens),
    availableMemoryBytes: Math.max(0, input.availableMemoryBytes),
    acceleratorResidency: input.acceleratorResidency,
    processorPlacement: input.processorPlacement,
    memoryPressure: input.memoryPressure,
    evidenceTokens: Math.max(0, input.evidenceTokens),
    historyTokens: Math.max(0, input.historyTokens),
    summaryApplied,
    reductionReasons: reasons
  };
}
