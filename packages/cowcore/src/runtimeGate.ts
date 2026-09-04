import type { LocalityEnforcementState, ModelProfile, OllamaRuntimeProfile } from "./types.js";

export type CowCoreFeatureFlags = {
  cowcoreFastLane: boolean;
  ollamaNativeProfile: boolean;
  ollamaLocalOnly: boolean;
};

export const DEFAULT_COWCORE_FEATURE_FLAGS: Readonly<CowCoreFeatureFlags> = Object.freeze({
  cowcoreFastLane: false,
  ollamaNativeProfile: false,
  ollamaLocalOnly: false
});

export type FastLaneGateDecision = {
  allowed: boolean;
  reasons: readonly string[];
};

export function evaluateFastLaneGate(input: {
  flags: Readonly<CowCoreFeatureFlags>;
  runtime?: OllamaRuntimeProfile;
  model?: ModelProfile;
  locality: LocalityEnforcementState;
}): FastLaneGateDecision {
  const reasons: string[] = [];
  if (!input.flags.cowcoreFastLane) reasons.push("cowcoreFastLane flag is disabled");
  if (!input.flags.ollamaNativeProfile) reasons.push("ollamaNativeProfile flag is disabled");
  if (!input.flags.ollamaLocalOnly) reasons.push("ollamaLocalOnly flag is disabled");

  if (input.locality.state !== "enforced") reasons.push("locality enforcement is blocked");
  if (input.locality.cloudPolicy === "unverified") reasons.push("cloud policy is not confirmed local-only");
  if (!input.locality.modelInstalledLocally || !input.locality.modelDigest.trim()) reasons.push("local model identity is not verified");

  if (!input.runtime) {
    reasons.push("runtime profile is unavailable");
  } else {
    if (input.runtime.cloudFeatures === "enabled") reasons.push("runtime cloud features are enabled");
    if (input.runtime.cloudFeatures === "unknown" && input.locality.cloudPolicy !== "egress-blocked-confirmed") {
      reasons.push("runtime cloud features are not confirmed disabled");
    }
    if (!input.runtime.nativeApiCompatibility.chat) reasons.push("native chat capability is unavailable");
    if (!input.runtime.nativeApiCompatibility.streaming) reasons.push("native streaming capability is unavailable");
  }

  if (!input.model) {
    reasons.push("model profile is unavailable");
  } else {
    if (input.model.provider !== "ollama-native") reasons.push("model provider is not ollama-native");
    if (!input.model.modelDigest.trim() || input.model.modelDigest !== input.locality.modelDigest) reasons.push("model digest does not match locality state");
    if (input.runtime && input.model.ollamaVersion !== input.runtime.ollamaVersion) reasons.push("model profile/runtime version mismatch");
  }

  // ponytail: keep the security decision pure and single-pass; split policy objects only when another runtime is approved.
  return { allowed: reasons.length === 0, reasons };
}
