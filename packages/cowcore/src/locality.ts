import type { LocalityEnforcementState } from "./types.js";

export function normalizeLoopbackEndpoint(endpoint: string): string {
  const url = new URL(endpoint);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Ollama endpoint must use HTTP(S) loopback transport.");
  }
  if (url.username || url.password) {
    throw new Error("Ollama endpoint credentials are not allowed in local mode.");
  }
  if (!isLoopbackHost(url.hostname)) {
    throw new Error("Ollama endpoint must be loopback in local mode.");
  }
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

export function createLocalityEnforcement(input: {
  endpoint: string;
  cloudPolicy: "disabled-confirmed" | "egress-blocked-confirmed" | "unverified";
  modelDigest?: string;
  modelInstalledLocally?: boolean;
}): LocalityEnforcementState {
  const endpoint = normalizeLoopbackEndpoint(input.endpoint);
  const installed = input.modelInstalledLocally === true && Boolean(input.modelDigest?.trim());
  const enforced = input.cloudPolicy !== "unverified" && installed;
  return {
    endpointPolicy: "loopback-only",
    redirectsAllowed: false,
    cloudPolicy: input.cloudPolicy,
    modelDigest: input.modelDigest?.trim() ?? "",
    modelInstalledLocally: installed,
    state: enforced ? "enforced" : "blocked",
    evidence: [
      `endpoint=${endpoint}`,
      `cloudPolicy=${input.cloudPolicy}`,
      installed ? "modelIdentity=local-digest" : "modelIdentity=missing"
    ]
  };
}

export function assertLocalityEnforced(state: LocalityEnforcementState): void {
  if (state.state !== "enforced") {
    throw new Error("Locality enforcement is blocked: cloud policy or local model identity is unverified.");
  }
}
