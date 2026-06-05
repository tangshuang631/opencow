import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveOpenClawRoot } from "./upstreamRoot.js";
import type { OpenClawMetadata } from "./types.js";

interface PackageJsonShape {
  readonly name?: unknown;
  readonly version?: unknown;
  readonly license?: unknown;
  readonly repository?: {
    readonly url?: unknown;
  };
}

export function readOpenClawMetadata(openClawRoot?: string): OpenClawMetadata {
  const root = resolveOpenClawRoot(openClawRoot);
  const raw = readFileSync(resolve(root, "package.json"), "utf8");
  const packageJson = JSON.parse(raw) as PackageJsonShape;

  return {
    name: requireString(packageJson.name, "name"),
    version: requireString(packageJson.version, "version"),
    license: requireString(packageJson.license, "license"),
    repositoryUrl: requireString(packageJson.repository?.url, "repository.url")
  };
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`OpenClaw package metadata is missing ${fieldName}`);
  }

  return value;
}
