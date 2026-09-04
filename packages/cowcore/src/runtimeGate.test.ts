import { describe, expect, it } from "vitest";
import { DEFAULT_COWCORE_FEATURE_FLAGS, evaluateFastLaneGate } from "./runtimeGate.js";
import type { LocalityEnforcementState, ModelProfile, OllamaRuntimeProfile } from "./types.js";

const runtime: OllamaRuntimeProfile = {
  endpoint: "http://127.0.0.1:11434",
  endpointClass: "loopback",
  ollamaVersion: "0.33.2",
  compatibilityManifestId: "ollama-0.33.x",
  operatingSystem: "macos",
  hardwareArch: "arm64",
  hardwareClass: "apple-silicon",
  physicalMemoryBytes: 24 * 1024 ** 3,
  availableMemoryBytes: 18 * 1024 ** 3,
  memoryPressure: "low",
  cloudFeatures: "disabled",
  nativeApiCompatibility: { chat: true, streaming: true, show: true, ps: true, embed: true, cancellation: true },
  profiledAt: "2026-09-04T00:00:00.000Z"
};

const model = {
  modelId: "qwen3.5:9b",
  modelDigest: "sha256:model",
  provider: "ollama-native",
  ollamaVersion: "0.33.2",
  families: ["qwen3"],
  maxContextWindow: 32_768,
  capabilities: {
    completion: { state: "declared", evidence: "metadata" },
    streaming: { state: "declared", evidence: "native api" },
    tools: { state: "declared", evidence: "metadata" },
    structuredOutput: { state: "unknown", evidence: "not declared" },
    thinking: { state: "declared", evidence: "metadata" },
    vision: { state: "unknown", evidence: "not declared" },
    embedding: { state: "unknown", evidence: "not declared" }
  },
  executionEngine: "unknown",
  executionEngineEvidence: [],
  runtimeOptimizations: ["snapshot-cache"],
  preferredRoles: ["chat", "tool"],
  performanceProfiles: [],
  profileSchemaVersion: 1,
  probeVersion: 1,
  probedAt: "2026-09-04T00:00:00.000Z"
} satisfies ModelProfile;

const locality: LocalityEnforcementState = {
  endpointPolicy: "loopback-only",
  redirectsAllowed: false,
  cloudPolicy: "disabled-confirmed",
  modelDigest: "sha256:model",
  modelInstalledLocally: true,
  state: "enforced",
  evidence: ["endpoint=loopback", "cloudPolicy=disabled-confirmed", "modelIdentity=local-digest"]
};

describe("evaluateFastLaneGate", () => {
  it("defaults every new fast-lane flag off", () => {
    expect(DEFAULT_COWCORE_FEATURE_FLAGS).toEqual({
      cowcoreFastLane: false,
      ollamaNativeProfile: false,
      ollamaLocalOnly: false
    });
    expect(evaluateFastLaneGate({ flags: DEFAULT_COWCORE_FEATURE_FLAGS, runtime, model, locality })).toEqual({
      allowed: false,
      reasons: [
        "cowcoreFastLane flag is disabled",
        "ollamaNativeProfile flag is disabled",
        "ollamaLocalOnly flag is disabled"
      ]
    });
  });

  it("allows only a profiled native Ollama model under enforced locality", () => {
    const decision = evaluateFastLaneGate({
      flags: { cowcoreFastLane: true, ollamaNativeProfile: true, ollamaLocalOnly: true },
      runtime,
      model,
      locality
    });

    expect(decision).toEqual({ allowed: true, reasons: [] });
  });

  it("fails closed when cloud policy, identity, or native runtime evidence is incomplete", () => {
    const decision = evaluateFastLaneGate({
      flags: { cowcoreFastLane: true, ollamaNativeProfile: true, ollamaLocalOnly: true },
      runtime: { ...runtime, cloudFeatures: "unknown", nativeApiCompatibility: { ...runtime.nativeApiCompatibility, streaming: false } },
      model: { ...model, modelDigest: "sha256:other", provider: "ollama-native" },
      locality: { ...locality, cloudPolicy: "unverified", modelDigest: "sha256:missing", modelInstalledLocally: false, state: "blocked" }
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toEqual([
      "locality enforcement is blocked",
      "cloud policy is not confirmed local-only",
      "local model identity is not verified",
      "runtime cloud features are not confirmed disabled",
      "native streaming capability is unavailable",
      "model digest does not match locality state"
    ]);
  });

  it("accepts an explicit egress-blocked locality policy when runtime cloud state is unknown", () => {
    const decision = evaluateFastLaneGate({
      flags: { cowcoreFastLane: true, ollamaNativeProfile: true, ollamaLocalOnly: true },
      runtime: { ...runtime, cloudFeatures: "unknown" },
      model,
      locality: { ...locality, cloudPolicy: "egress-blocked-confirmed" }
    });

    expect(decision).toEqual({ allowed: true, reasons: [] });
  });
});
