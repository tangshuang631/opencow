import { existsSync, readFileSync } from "node:fs";

const requiredPaths = [
  "OPENCOW_CORE_RULES.md",
  "start-opencow-test.bat",
  "docs/v1.0/00-overview.md",
  "docs/v1.0/10-openclaw-adapter.md",
  "apps/desktop/package.json",
  "apps/desktop/src/app/App.tsx",
  "apps/desktop/src/features/workbench/Workbench.tsx",
  "apps/desktop/src-tauri/tauri.conf.json",
  "packages/openclaw-adapter/package.json",
  "packages/openclaw-adapter/src/index.ts",
  "packages/openclaw-adapter/src/upstreamMetadata.ts",
  "packages/audit-core/package.json",
  "packages/audit-core/src/index.ts",
  "packages/audit-core/src/eventFactory.ts",
  "packages/permission-engine/package.json",
  "packages/permission-engine/src/index.ts",
  "packages/permission-engine/src/escalation.ts",
  "packages/rollback-core/package.json",
  "packages/rollback-core/src/index.ts",
  "packages/rollback-core/src/rollbackJournal.ts",
  "packages/safety-engine/package.json",
  "packages/safety-engine/src/index.ts",
  "packages/safety-engine/src/guardPlan.ts",
  "packages/shell-runtime/package.json",
  "packages/shell-runtime/src/index.ts",
  "packages/shell-runtime/src/planCommand.ts",
  "vendor"
];

const missing = requiredPaths.filter((path) => !existsSync(path));

if (missing.length > 0) {
  throw new Error(`Missing required paths: ${missing.join(", ")}`);
}

const launcher = readFileSync("start-opencow-test.bat", "utf8");
const checkModeExitIndex = launcher.indexOf('if /I "%MODE%"=="check"');
const pauseIndex = launcher.indexOf("pause >nul");

if (checkModeExitIndex === -1) {
  throw new Error("Desktop launcher check mode must exit without waiting for user input on failure");
}

if (pauseIndex === -1 || checkModeExitIndex > pauseIndex) {
  throw new Error("Desktop launcher pause must remain behind the check-mode failure exit");
}

console.log("health check passed");
