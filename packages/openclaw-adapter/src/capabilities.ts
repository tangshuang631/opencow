import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveOpenClawRoot } from "./upstreamRoot.js";
import type { OpenClawCapabilities, OpenClawCapability } from "./types.js";

const capabilityPackages = {
  llmCore: "llm-core",
  llmRuntime: "llm-runtime",
  modelCatalog: "model-catalog-core",
  pluginSdk: "plugin-sdk",
  terminalCore: "terminal-core",
  toolCallRepair: "tool-call-repair"
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

function inspectPackage(openClawRoot: string, directoryName: string): OpenClawCapability {
  const packagePath = resolve(openClawRoot, "packages", directoryName);
  const packageJsonPath = resolve(packagePath, "package.json");

  if (!existsSync(packageJsonPath)) {
    return {
      available: false,
      packageName: `@openclaw/${directoryName}`,
      packagePath
    };
  }

  return {
    available: true,
    packageName: readPackageName(packageJsonPath),
    packagePath
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
