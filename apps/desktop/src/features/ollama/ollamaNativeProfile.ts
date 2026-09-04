import {
  createModelGateway,
  type LocalityEnforcementState,
  type ModelProfile,
  type OllamaRuntimeProfile
} from "@opencow/cowcore";

export type OllamaNativeProfileSnapshot = {
  runtime: OllamaRuntimeProfile;
  model: ModelProfile;
  locality: LocalityEnforcementState;
};

export async function loadOllamaNativeProfile(input: {
  model: string;
  endpoint?: string;
  cloudPolicy: "disabled-confirmed" | "egress-blocked-confirmed" | "unverified";
  fetch?: typeof fetch;
  runtime: {
    operatingSystem: "macos" | "windows" | "linux";
    hardwareArch: string;
    physicalMemoryBytes: number;
    availableMemoryBytes: number;
    memoryPressure: OllamaRuntimeProfile["memoryPressure"];
  };
}): Promise<OllamaNativeProfileSnapshot> {
  const gateway = createModelGateway({ endpoint: input.endpoint, cloudPolicy: input.cloudPolicy, fetch: input.fetch });
  const model = await gateway.ollama.profileModel(input.model);
  const runtime = await gateway.createRuntimeProfile(input.runtime);
  return {
    runtime,
    model,
    locality: gateway.ollama.getLocalityState(input.model)
  };
}
