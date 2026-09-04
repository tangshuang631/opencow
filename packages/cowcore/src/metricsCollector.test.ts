import { describe, expect, it } from "vitest";
import { collectPerformanceProfile } from "./metricsCollector.js";

describe("collectPerformanceProfile", () => {
  it("records cold/warm TTFT and Ollama usage without inventing offload metrics", () => {
    const profile = collectPerformanceProfile({
      scenario: "tool-loop",
      contextLength: 8_192,
      thinkSetting: "off",
      keepAlive: "10m",
      prefixTokens: 9_000,
      coldPrefixPromptEvalMs: 120,
      repeatedPrefixPromptEvalMs: 60,
      cold: {
        ttftMs: 900,
        totalDurationMs: 1_400,
        loadDurationMs: 700,
        promptEvalCount: 100,
        promptEvalDurationMs: 200,
        promptTokensPerSecond: 500,
        evalCount: 40,
        evalDurationMs: 400,
        decodeTokensPerSecond: 100
      },
      warm: {
        ttftMs: 180,
        totalDurationMs: 500,
        loadDurationMs: 5,
        promptEvalCount: 100,
        promptEvalDurationMs: 100,
        promptTokensPerSecond: 1_000,
        evalCount: 40,
        evalDurationMs: 400,
        decodeTokensPerSecond: 100
      },
      residency: {
        source: "ollama-ps",
        unifiedMemory: true,
        modelSizeBytes: 10_000,
        acceleratorResidentBytes: 8_000,
        acceleratorResidentRatio: 0.8,
        processorPlacement: "unknown",
        observedAt: "2026-09-04T00:00:00.000Z"
      },
      sampleCount: 2,
      measuredAt: "2026-09-04T00:00:00.000Z"
    });

    expect(profile).toMatchObject({
      scenario: "tool-loop",
      coldTtftMs: 900,
      warmTtftMs: 180,
      loadDurationMs: 5,
      promptTokensPerSecond: 1_000,
      decodeTokensPerSecond: 100,
      totalLatencyMs: 500,
      acceleratorResidency: "partial",
      processorPlacement: "unknown",
      acceleratorResidentRatio: 0.8,
      repeatedPrefixPromptEvalMs: 60,
      coldPrefixPromptEvalMs: 120
    });
    expect(profile.residentModelBytes).toBe(10_000);
    expect(Object.hasOwn(profile, "estimatedCpuOffloadRatio")).toBe(false);
  });

  it("rejects incomplete latency metrics instead of serializing NaN or a fake zero", () => {
    expect(() => collectPerformanceProfile({
      scenario: "direct-chat",
      contextLength: 4_096,
      thinkSetting: "off",
      keepAlive: "5m",
      cold: { totalDurationMs: 100 },
      warm: { totalDurationMs: 50 }
    })).toThrow(/ttft/i);
  });
});
