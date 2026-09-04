import { describe, expect, it } from "vitest";
import { decideContextBudget } from "./contextBudgeter.js";

describe("decideContextBudget", () => {
  it("keeps a large agent budget only when memory and residency permit it", () => {
    const decision = decideContextBudget({
      modelDigest: "sha256:model",
      taskClass: "typed-tool-task",
      modelMaxTokens: 131_072,
      requestedTokens: 65_536,
      reservedOutputTokens: 8_192,
      availableMemoryBytes: 24 * 1024 ** 3,
      modelSizeBytes: 6 * 1024 ** 3,
      acceleratorResidency: "full",
      processorPlacement: "accelerator",
      memoryPressure: "low",
      evidenceTokens: 0,
      historyTokens: 0
    });

    expect(decision.allocatedTokens).toBe(65_536);
    expect(decision.reductionReasons).toEqual([]);
  });

  it("reduces context before accepting mixed or critical placement", () => {
    const decision = decideContextBudget({
      modelDigest: "sha256:model",
      taskClass: "retrieval-answer",
      modelMaxTokens: 262_144,
      requestedTokens: 131_072,
      reservedOutputTokens: 4_096,
      availableMemoryBytes: 4 * 1024 ** 3,
      modelSizeBytes: 6 * 1024 ** 3,
      acceleratorResidency: "partial",
      processorPlacement: "mixed",
      memoryPressure: "critical",
      evidenceTokens: 2_000,
      historyTokens: 2_000
    });

    expect(decision.allocatedTokens).toBeLessThan(131_072);
    expect(decision.summaryApplied).toBe(true);
    expect(decision.reductionReasons.length).toBeGreaterThan(0);
  });
});
