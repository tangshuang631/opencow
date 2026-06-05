import { existsSync } from "node:fs";

const requiredPaths = [
  "OPENCOW_CORE_RULES.md",
  "docs/v1.0/00-overview.md",
  "apps/desktop/package.json",
  "apps/desktop/src/app/App.tsx",
  "apps/desktop/src/features/workbench/Workbench.tsx",
  "apps/desktop/src-tauri/tauri.conf.json",
  "vendor"
];

const missing = requiredPaths.filter((path) => !existsSync(path));

if (missing.length > 0) {
  throw new Error(`Missing required paths: ${missing.join(", ")}`);
}

console.log("health check passed");
