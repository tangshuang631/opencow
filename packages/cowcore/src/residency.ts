import type { ProcessorPlacement, ResidencyObservation } from "./types.js";

export function observeResidency(input: {
  platform: "macos" | "windows" | "linux";
  architecture: string;
  modelSizeBytes?: number;
  sizeVramBytes?: number;
  sizeBytes?: number;
  contextLength?: number;
  observedAt?: string;
}): ResidencyObservation {
  const unifiedMemory = input.platform === "macos" && /^arm64|aarch64$/i.test(input.architecture);
  const modelSize = finitePositive(input.sizeBytes ?? input.modelSizeBytes);
  const resident = finitePositive(input.sizeVramBytes);
  const ratio = modelSize && resident ? Math.min(1, resident / modelSize) : undefined;
  const processorPlacement: ProcessorPlacement = unifiedMemory ? "unknown" : resident && modelSize && ratio === 1 ? "accelerator" : "unknown";

  return {
    source: "ollama-ps",
    unifiedMemory,
    ...(modelSize ? { modelSizeBytes: modelSize } : {}),
    ...(resident ? { acceleratorResidentBytes: resident } : {}),
    ...(ratio !== undefined ? { acceleratorResidentRatio: ratio } : {}),
    processorPlacement,
    ...(input.contextLength ? { contextLength: input.contextLength } : {}),
    observedAt: input.observedAt ?? new Date().toISOString()
  };
}

function finitePositive(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}
