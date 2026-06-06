import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveOpenClawRoot } from "./upstreamRoot.js";
import type { OpenClawWorkspacePackage } from "./types.js";

interface PackageJsonShape {
  readonly name?: unknown;
  readonly version?: unknown;
  readonly private?: unknown;
}

export function listOpenClawWorkspacePackages(openClawRoot?: string): OpenClawWorkspacePackage[] {
  const root = resolveOpenClawRoot(openClawRoot);
  const packagesRoot = resolve(root, "packages");
  const directoryEntries = readdirSync(packagesRoot, { withFileTypes: true });

  return directoryEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => readWorkspacePackage(packagesRoot, entry.name))
    .sort((left, right) => left.directoryName.localeCompare(right.directoryName));
}

function readWorkspacePackage(packagesRoot: string, directoryName: string): OpenClawWorkspacePackage {
  const packagePath = resolve(packagesRoot, directoryName);
  const packageJsonPath = resolve(packagePath, "package.json");
  const raw = readFileSync(packageJsonPath, "utf8");
  const packageJson = JSON.parse(raw) as PackageJsonShape;

  return {
    directoryName,
    packageName: requireString(packageJson.name, `${directoryName}.name`),
    version: requireString(packageJson.version, `${directoryName}.version`),
    private: requireBoolean(packageJson.private, `${directoryName}.private`),
    packagePath
  };
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`OpenClaw workspace package metadata is missing ${fieldName}`);
  }

  return value;
}

function requireBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`OpenClaw workspace package metadata is missing ${fieldName}`);
  }

  return value;
}
