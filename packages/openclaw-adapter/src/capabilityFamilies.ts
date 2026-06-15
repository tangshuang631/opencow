import { inspectOpenClawCapabilities } from "./capabilities.js";
import type {
  OpenClawCapabilities,
  OpenClawCapability,
  OpenClawCapabilityFamily,
  OpenClawCapabilityFamilyReadiness
} from "./types.js";

type OpenClawCapabilityKey = keyof OpenClawCapabilities;

const capabilityFamilyPackages: Record<OpenClawCapabilityFamily, readonly OpenClawCapabilityKey[]> = {
  rag: ["llmCore", "llmRuntime", "modelCatalog"],
  skills: ["pluginSdk", "toolCallRepair"],
  npc: ["llmCore", "llmRuntime", "toolCallRepair"],
  mcp: ["pluginSdk", "terminalCore", "toolCallRepair"]
} as const;

const capabilityFamilyTitles: Record<OpenClawCapabilityFamily, string> = {
  rag: "RAG",
  skills: "Skills",
  npc: "NPC",
  mcp: "MCP"
} as const;

export function inspectOpenClawCapabilityFamilies(
  openClawRoot?: string
): OpenClawCapabilityFamilyReadiness[] {
  const capabilities = inspectOpenClawCapabilities(openClawRoot);

  return (Object.keys(capabilityFamilyPackages) as OpenClawCapabilityFamily[]).map((capabilityId) => {
    const requiredCapabilityKeys = capabilityFamilyPackages[capabilityId];
    const requiredPackages = requiredCapabilityKeys.map((key) => capabilities[key]);
    const availablePackages = requiredPackages.filter((capability) => capability.available);
    const missingPackages = requiredPackages.filter((capability) => !capability.available);

    return {
      capabilityId,
      title: capabilityFamilyTitles[capabilityId],
      status: missingPackages.length === 0 ? "ready-foundation" : "partial-foundation",
      requiredPackageCount: requiredPackages.length,
      availablePackageCount: availablePackages.length,
      availablePackages,
      missingPackages
    };
  });
}

export function inspectOpenClawCapabilityFamily(
  capabilityId: OpenClawCapabilityFamily,
  openClawRoot?: string
): OpenClawCapabilityFamilyReadiness {
  const families = inspectOpenClawCapabilityFamilies(openClawRoot);
  const found = families.find((family) => family.capabilityId === capabilityId);

  if (!found) {
    throw new Error(`Unknown OpenClaw capability family: ${capabilityId}`);
  }

  return found;
}

export function formatOpenClawCapabilityPackages(capabilities: OpenClawCapability[]): string[] {
  return capabilities.map((capability) => capability.packageName);
}
