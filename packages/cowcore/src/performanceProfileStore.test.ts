import { describe, expect, it } from "vitest";
import { createPerformanceProfileStore, type ProfileStorage } from "./performanceProfileStore.js";
import type { ModelPerformanceProfile } from "./types.js";

class MemoryStorage implements ProfileStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const profile: ModelPerformanceProfile = {
  scenario: "direct-chat",
  contextLength: 8192,
  thinkSetting: "off",
  keepAlive: "10m",
  sampleCount: 1,
  coldTtftMs: 900,
  warmTtftMs: 120,
  loadDurationMs: 40,
  promptTokensPerSecond: 80,
  decodeTokensPerSecond: 20,
  totalLatencyMs: 1200,
  acceleratorResidency: "full",
  processorPlacement: "accelerator",
  measuredAt: "2026-09-04T00:00:00.000Z"
};

describe("performance profile store", () => {
  it("persists only matching model digest/version and bounds history", () => {
    const storage = new MemoryStorage();
    const store = createPerformanceProfileStore(storage, "test-profile:");

    for (let index = 0; index < 30; index += 1) {
      store.append({ modelDigest: "sha256:model", ollamaVersion: "0.33.3", profile: { ...profile, measuredAt: `${index}` } });
    }

    expect(store.read({ modelDigest: "sha256:model", ollamaVersion: "0.33.3" })).toHaveLength(24);
    expect(store.read({ modelDigest: "sha256:other", ollamaVersion: "0.33.3" })).toEqual([]);
    expect(store.read({ modelDigest: "sha256:model", ollamaVersion: "0.33.2" })).toEqual([]);
    expect(JSON.stringify(storage.getItem("test-profile:sha256%3Amodel"))).not.toContain("用户");
  });

  it("drops malformed or newer records instead of trusting storage", () => {
    const storage = new MemoryStorage();
    const store = createPerformanceProfileStore(storage, "test-profile:");
    storage.setItem("test-profile:sha256%3Amodel", JSON.stringify({ schemaVersion: 99, modelDigest: "sha256:model", ollamaVersion: "0.33.3", profiles: [profile] }));

    expect(store.read({ modelDigest: "sha256:model", ollamaVersion: "0.33.3" })).toEqual([]);
  });

  it("drops profiles with unknown enum values", () => {
    const storage = new MemoryStorage();
    const store = createPerformanceProfileStore(storage, "test-profile:");
    storage.setItem("test-profile:sha256%3Amodel", JSON.stringify({
      schemaVersion: 1,
      modelDigest: "sha256:model",
      ollamaVersion: "0.33.3",
      profiles: [{ ...profile, scenario: "future-scenario" }]
    }));

    expect(store.read({ modelDigest: "sha256:model", ollamaVersion: "0.33.3" })).toEqual([]);
  });
});
