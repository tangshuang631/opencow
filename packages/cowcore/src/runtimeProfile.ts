import { normalizeLoopbackEndpoint } from "./locality.js";
import type { HardwareClass, OllamaRuntimeProfile, OperatingSystem } from "./types.js";

export function createRuntimeProfile(input: {
  endpoint: string;
  ollamaVersion: string;
  compatibilityManifestId?: string;
  operatingSystem: OperatingSystem;
  hardwareArch: string;
  hardwareClass?: HardwareClass;
  physicalMemoryBytes: number;
  availableMemoryBytes: number;
  memoryPressure: OllamaRuntimeProfile["memoryPressure"];
  cloudFeatures: OllamaRuntimeProfile["cloudFeatures"];
  nativeApiCompatibility: OllamaRuntimeProfile["nativeApiCompatibility"];
  profiledAt?: string;
}): OllamaRuntimeProfile {
  const endpoint = normalizeLoopbackEndpoint(input.endpoint);
  return {
    endpoint,
    endpointClass: "loopback",
    ollamaVersion: input.ollamaVersion.trim(),
    compatibilityManifestId: input.compatibilityManifestId ?? "unverified",
    operatingSystem: input.operatingSystem,
    hardwareArch: input.hardwareArch,
    hardwareClass: input.hardwareClass ?? inferHardwareClass(input.operatingSystem, input.hardwareArch),
    physicalMemoryBytes: Math.max(0, input.physicalMemoryBytes),
    availableMemoryBytes: Math.max(0, input.availableMemoryBytes),
    memoryPressure: input.memoryPressure,
    cloudFeatures: input.cloudFeatures,
    nativeApiCompatibility: input.nativeApiCompatibility,
    profiledAt: input.profiledAt ?? new Date().toISOString()
  };
}

function inferHardwareClass(operatingSystem: OperatingSystem, architecture: string): HardwareClass {
  return operatingSystem === "macos" && /^(?:arm64|aarch64)$/i.test(architecture) ? "apple-silicon" : "unknown";
}
