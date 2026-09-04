import type { ModelPerformanceProfile } from "./types.js";

const PROFILE_SCHEMA_VERSION = 1;
const MAX_PROFILE_HISTORY = 24;
const SCENARIOS = new Set(["direct-chat", "long-prompt", "rag", "structured-output", "tool-loop", "embedding"]);
const THINK_SETTINGS = new Set(["off", "on", "low", "medium", "high", "unsupported"]);
const RESIDENCY_STATES = new Set(["full", "partial", "cpu", "unknown"]);
const PROCESSOR_PLACEMENTS = new Set(["accelerator", "mixed", "cpu", "unknown"]);

export type ProfileStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type PerformanceProfileStore = {
  read(input: { modelDigest: string; ollamaVersion: string }): ModelPerformanceProfile[];
  append(input: { modelDigest: string; ollamaVersion: string; profile: ModelPerformanceProfile }): ModelPerformanceProfile[];
  clear(input: { modelDigest: string; ollamaVersion: string }): void;
};

type StoredProfiles = {
  schemaVersion: number;
  modelDigest: string;
  ollamaVersion: string;
  profiles: ModelPerformanceProfile[];
};

export function createPerformanceProfileStore(
  storage: ProfileStorage | undefined = resolveGlobalStorage(),
  keyPrefix = "opencow.cowcore.performance-profile.v1:"
): PerformanceProfileStore {
  const keyFor = (modelDigest: string) => `${keyPrefix}${encodeURIComponent(modelDigest)}`;

  function read(input: { modelDigest: string; ollamaVersion: string }): ModelPerformanceProfile[] {
    const digest = input.modelDigest.trim();
    const version = input.ollamaVersion.trim();
    if (!storage || !digest || !version) return [];

    let raw: string | null;
    try {
      raw = storage.getItem(keyFor(digest));
    } catch {
      return [];
    }
    if (!raw) return [];

    try {
      const record = JSON.parse(raw) as Partial<StoredProfiles>;
      if (record.schemaVersion !== PROFILE_SCHEMA_VERSION || record.modelDigest !== digest || record.ollamaVersion !== version || !Array.isArray(record.profiles)) {
        return [];
      }
      return record.profiles.filter(isPerformanceProfile).slice(-MAX_PROFILE_HISTORY);
    } catch {
      return [];
    }
  }

  function append(input: { modelDigest: string; ollamaVersion: string; profile: ModelPerformanceProfile }): ModelPerformanceProfile[] {
    const digest = input.modelDigest.trim();
    const version = input.ollamaVersion.trim();
    if (!digest || !version) throw new Error("model digest and Ollama version are required");
    if (!isPerformanceProfile(input.profile)) throw new Error("invalid performance profile");

    const profiles = [...read({ modelDigest: digest, ollamaVersion: version }), input.profile].slice(-MAX_PROFILE_HISTORY);
    if (storage) {
      const record: StoredProfiles = { schemaVersion: PROFILE_SCHEMA_VERSION, modelDigest: digest, ollamaVersion: version, profiles };
      try {
        storage.setItem(keyFor(digest), JSON.stringify(record));
      } catch {
        // Persistence is best effort; the in-memory return value remains usable for this request.
      }
    }
    return profiles;
  }

  function clear(input: { modelDigest: string; ollamaVersion: string }): void {
    const digest = input.modelDigest.trim();
    if (!storage || !digest) return;
    try {
      storage.removeItem(keyFor(digest));
    } catch {
      // Storage may be unavailable in a restricted preview; there is nothing else to mutate.
    }
  }

  return { read, append, clear };
}

function resolveGlobalStorage(): ProfileStorage | undefined {
  try {
    const candidate = (globalThis as { localStorage?: ProfileStorage }).localStorage;
    return candidate && typeof candidate.getItem === "function" && typeof candidate.setItem === "function" && typeof candidate.removeItem === "function"
      ? candidate
      : undefined;
  } catch {
    return undefined;
  }
}

function isPerformanceProfile(value: unknown): value is ModelPerformanceProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<ModelPerformanceProfile>;
  return typeof profile.scenario === "string" && SCENARIOS.has(profile.scenario)
    && typeof profile.contextLength === "number" && Number.isFinite(profile.contextLength) && profile.contextLength > 0
    && typeof profile.thinkSetting === "string" && THINK_SETTINGS.has(profile.thinkSetting)
    && typeof profile.keepAlive === "string" && profile.keepAlive.length <= 32
    && typeof profile.sampleCount === "number" && Number.isInteger(profile.sampleCount) && profile.sampleCount > 0
    && isNonNegative(profile.coldTtftMs)
    && isNonNegative(profile.warmTtftMs)
    && isNonNegative(profile.loadDurationMs)
    && isNonNegative(profile.promptTokensPerSecond)
    && isNonNegative(profile.decodeTokensPerSecond)
    && isNonNegative(profile.totalLatencyMs)
    && typeof profile.acceleratorResidency === "string" && RESIDENCY_STATES.has(profile.acceleratorResidency)
    && typeof profile.processorPlacement === "string" && PROCESSOR_PLACEMENTS.has(profile.processorPlacement)
    && typeof profile.measuredAt === "string" && profile.measuredAt.length <= 64;
}

function isNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
