import {
  DEFAULT_COWCORE_FEATURE_FLAGS,
  createModelGateway,
  evaluateFastLaneGate,
  observeLocalOnlyPolicy,
  type PerformanceProfileStore,
  type LocalityEnforcementState,
  type CowCoreFeatureFlags,
  type FastLaneGateDecision,
  type ModelProfile,
  type OllamaRuntimeProfile
} from "@opencow/cowcore";

export type OllamaNativeProfileSnapshot = {
  runtime: OllamaRuntimeProfile;
  model: ModelProfile;
  locality: LocalityEnforcementState;
  fastLane: FastLaneGateDecision;
};

export async function loadOllamaNativeProfile(input: {
  model: string;
  endpoint?: string;
  cloudPolicy?: "disabled-confirmed" | "egress-blocked-confirmed" | "unverified";
  lifecycle?: Parameters<typeof observeLocalOnlyPolicy>[0];
  featureFlags?: Readonly<CowCoreFeatureFlags>;
  profileStore?: PerformanceProfileStore;
  fetch?: typeof fetch;
  runtime: {
    operatingSystem: "macos" | "windows" | "linux";
    hardwareArch: string;
    physicalMemoryBytes: number;
    availableMemoryBytes: number;
    memoryPressure: OllamaRuntimeProfile["memoryPressure"];
  };
}): Promise<OllamaNativeProfileSnapshot> {
  const cloudPolicy = input.lifecycle
    ? observeLocalOnlyPolicy(input.lifecycle).cloudPolicy
    : input.cloudPolicy ?? "unverified";
  const gateway = createModelGateway({ endpoint: input.endpoint, cloudPolicy, fetch: input.fetch, profileStore: input.profileStore });
  const model = await gateway.ollama.profileModel(input.model);
  const runtime = await gateway.createRuntimeProfile(input.runtime);
  const locality = gateway.ollama.getLocalityState(input.model);
  return {
    runtime,
    model,
    locality,
    fastLane: evaluateFastLaneGate({
      flags: input.featureFlags ?? DEFAULT_COWCORE_FEATURE_FLAGS,
      runtime,
      model,
      locality
    })
  };
}
