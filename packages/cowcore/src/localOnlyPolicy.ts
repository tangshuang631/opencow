export type OllamaLifecycleMode = "managed" | "external";
export type EgressPolicyObservation = "blocked-confirmed" | "unknown";
export type LocalOnlyPolicyObservation = {
  mode: OllamaLifecycleMode;
  cloudPolicy: "disabled-confirmed" | "egress-blocked-confirmed" | "unverified";
  evidence: string[];
};

export function observeLocalOnlyPolicy(input: {
  mode: OllamaLifecycleMode;
  noCloudEnv?: string;
  egressPolicy?: EgressPolicyObservation;
}): LocalOnlyPolicyObservation {
  const evidence = [`mode=${input.mode}`];
  if (input.egressPolicy === "blocked-confirmed") {
    evidence.push("egress=blocked-confirmed");
    return { mode: input.mode, cloudPolicy: "egress-blocked-confirmed", evidence };
  }
  if (isEnabled(input.noCloudEnv)) {
    evidence.push("OLLAMA_NO_CLOUD=enabled");
    return { mode: input.mode, cloudPolicy: "disabled-confirmed", evidence };
  }
  evidence.push("cloud=unverified");
  return { mode: input.mode, cloudPolicy: "unverified", evidence };
}

function isEnabled(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}
