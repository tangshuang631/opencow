import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(thisFile), "..");
const workspaceRoot = resolve(packageRoot, "..", "..");
const defaultOpenClawRoot = resolve(workspaceRoot, "vendor", "openclaw");

export function resolveOpenClawRoot(openClawRoot = defaultOpenClawRoot): string {
  const packageJsonPath = resolve(openClawRoot, "package.json");

  if (!existsSync(packageJsonPath)) {
    throw new Error(`OpenClaw root is not available: ${openClawRoot}`);
  }

  return openClawRoot;
}
