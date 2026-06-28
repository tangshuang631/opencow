import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const requiredPaths = [
  "OPENCOW_CORE_RULES.md",
  "start-opencow-test.bat",
  "scripts/OpenCow最新测试版.applescript",
  "scripts/start-opencow-latest-desktop-mac.command",
  "scripts/sync-opencow-mac-apps.py",
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

const generatedSourcePairs = [
  {
    source: "packages/openclaw-adapter/src/localAssistantPlan.ts",
    generated: "packages/openclaw-adapter/dist/localAssistantPlan.js"
  },
  {
    source: "packages/openclaw-adapter/src/types.ts",
    generated: "packages/openclaw-adapter/dist/types.d.ts"
  },
  {
    source: "packages/openclaw-adapter/src/browser.ts",
    generated: "packages/openclaw-adapter/dist/browser.js"
  }
];

export function findStaleGeneratedFiles(pairs, statFile = statSync) {
  return pairs.filter(({ source, generated }) => {
    const sourceMtime = statFile(source).mtimeMs;
    const generatedMtime = statFile(generated).mtimeMs;

    return generatedMtime + 1000 < sourceMtime;
  });
}

export function formatStaleGeneratedFilesError(staleGeneratedFiles) {
  const details = staleGeneratedFiles.map(({ source, generated }) => `${generated} is older than ${source}`);

  return [
    "OpenClaw adapter dist is stale.",
    ...details,
    "Run: npm --workspace packages/openclaw-adapter run build"
  ].join(" ");
}

export function runHealthCheck({
  existsPath = existsSync,
  readText = readFileSync,
  statFile = statSync
} = {}) {
  const missing = requiredPaths.filter((path) => !existsPath(path));

  if (missing.length > 0) {
    throw new Error(`Missing required paths: ${missing.join(", ")}`);
  }

  const launcher = readText("start-opencow-test.bat", "utf8");
  const checkModeExitIndex = launcher.indexOf('if /I "%MODE%"=="check"');
  const pauseIndex = launcher.indexOf("pause >nul");

  if (checkModeExitIndex === -1) {
    throw new Error("Desktop launcher check mode must exit without waiting for user input on failure");
  }

  if (pauseIndex === -1 || checkModeExitIndex > pauseIndex) {
    throw new Error("Desktop launcher pause must remain behind the check-mode failure exit");
  }

  const macLauncher = readText("scripts/start-opencow-latest-desktop-mac.command", "utf8");
  if (!macLauncher.includes('SYNC_SCRIPT="${REPO_ROOT}/scripts/sync-opencow-mac-apps.py"')) {
    throw new Error("Mac latest-test desktop launcher must sync the desktop app before opening it");
  }

  if (macLauncher.includes("python3 scripts/sync-opencow-mac-apps.py")) {
    throw new Error("Mac latest-test desktop launcher must use an absolute sync script path");
  }

  const staleGeneratedFiles = findStaleGeneratedFiles(generatedSourcePairs, statFile);

  if (staleGeneratedFiles.length > 0) {
    throw new Error(formatStaleGeneratedFilesError(staleGeneratedFiles));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runHealthCheck();
  console.log("health check passed");
}
