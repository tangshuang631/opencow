import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveOpenClawRoot } from "./upstreamRoot.js";
import type { OpenClawCapabilities, OpenClawCapability } from "./types.js";

const capabilityPackages = {
  llmCore: { directoryName: "llm-core" },
  llmRuntime: {
    directoryName: "llm-runtime",
    missingCompatibility: "relocated-or-removed",
    replacementPackageNames: ["@openclaw/llm-core"]
  },
  modelCatalog: { directoryName: "model-catalog-core" },
  pluginSdk: { directoryName: "plugin-sdk" },
  terminalCore: { directoryName: "terminal-core" },
  toolCallRepair: { directoryName: "tool-call-repair" }
} as const;

export function inspectOpenClawCapabilities(openClawRoot?: string): OpenClawCapabilities {
  const root = resolveOpenClawRoot(openClawRoot);

  return {
    llmCore: inspectPackage(root, capabilityPackages.llmCore),
    llmRuntime: inspectPackage(root, capabilityPackages.llmRuntime),
    modelCatalog: inspectPackage(root, capabilityPackages.modelCatalog),
    pluginSdk: inspectPackage(root, capabilityPackages.pluginSdk),
    terminalCore: inspectPackage(root, capabilityPackages.terminalCore),
    toolCallRepair: inspectPackage(root, capabilityPackages.toolCallRepair)
  };
}

function inspectPackage(
  openClawRoot: string,
  definition: {
    readonly directoryName: string;
    readonly missingCompatibility?: "relocated-or-removed";
    readonly replacementPackageNames?: readonly string[];
  }
): OpenClawCapability {
  const packagePath = resolve(openClawRoot, "packages", definition.directoryName);
  const packageJsonPath = resolve(packagePath, "package.json");

  if (!existsSync(packageJsonPath)) {
    return {
      available: false,
      packageName: `@openclaw/${definition.directoryName}`,
      packagePath,
      compatibility: definition.missingCompatibility ?? "native",
      ...(definition.replacementPackageNames
        ? { replacementPackageNames: definition.replacementPackageNames }
        : {})
    };
  }

  return {
    available: true,
    packageName: readPackageName(packageJsonPath),
    packagePath,
    compatibility: "native"
  };
}

function readPackageName(packageJsonPath: string): string {
  const raw = readFileSync(packageJsonPath, "utf8");
  const packageJson = JSON.parse(raw) as { readonly name?: unknown };

  if (typeof packageJson.name !== "string" || packageJson.name.length === 0) {
    throw new Error(`OpenClaw capability package is missing name: ${packageJsonPath}`);
  }

  return packageJson.name;
}
