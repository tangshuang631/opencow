import { describe, expect, it } from "vitest";
import { observeResidency } from "./residency.js";

describe("observeResidency", () => {
  it("treats Apple unified-memory size_vram as placement observation, not CPU offload", () => {
    const observation = observeResidency({
      platform: "macos",
      architecture: "arm64",
      modelSizeBytes: 10,
      sizeVramBytes: 7,
      sizeBytes: 10,
      contextLength: 32_768
    });

    expect(observation.unifiedMemory).toBe(true);
    expect(observation.acceleratorResidentRatio).toBe(0.7);
    expect(observation.processorPlacement).toBe("unknown");
    expect(observation.cpuExecutionShare).toBeUndefined();
  });

  it("does not classify a non-canonical architecture suffix as Apple Silicon", () => {
    const observation = observeResidency({
      platform: "macos",
      architecture: "vendor-aarch64",
      modelSizeBytes: 10,
      sizeVramBytes: 7
    });

    expect(observation.unifiedMemory).toBe(false);
  });
});
