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
  "apps/desktop/src-tauri/src/workspace.rs",
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

const macDesktopBinary =
  "apps/desktop/src-tauri/target/release/bundle/macos/opencow.app/Contents/MacOS/opencow-desktop";
const desktopInstallBinary = "/Users/apple/Desktop/OpenCow桌面端.app/Contents/MacOS/opencow-desktop";
const latestLauncherBinary = "/Users/apple/Desktop/opencow最新测试版.app/Contents/MacOS/opencow-latest-launcher";

const macFreshnessPairs = [
  {
    source: "apps/desktop/src/app/App.tsx",
    target: macDesktopBinary,
    command: "npm run desktop:sync:mac"
  },
  {
    source: "apps/desktop/src-tauri/tauri.conf.json",
    target: macDesktopBinary,
    command: "npm run desktop:sync:mac"
  },
  {
    source: "package-lock.json",
    target: macDesktopBinary,
    command: "npm run desktop:sync:mac"
  },
  {
    source: macDesktopBinary,
    target: desktopInstallBinary,
    command: "npm run desktop:sync:mac"
  },
  {
    source: "scripts/start-opencow-latest-desktop-mac.command",
    target: latestLauncherBinary,
    command: "npm run desktop:sync:mac"
  },
  {
    source: "scripts/sync-opencow-mac-apps.py",
    target: latestLauncherBinary,
    command: "npm run desktop:sync:mac"
  }
];

export function findStaleGeneratedFiles(pairs, statFile = statSync) {
  return pairs.filter(({ source, generated }) => {
    const sourceMtime = statFile(source).mtimeMs;
    const generatedMtime = statFile(generated).mtimeMs;

    return generatedMtime + 1000 < sourceMtime;
  });
}

export function findStaleTargets(pairs, existsPath = existsSync, statFile = statSync) {
  return pairs.filter(({ source, target }) => {
    if (!existsPath(source) || !existsPath(target)) {
      return false;
    }

    const sourceMtime = statFile(source).mtimeMs;
    const targetMtime = statFile(target).mtimeMs;

    return targetMtime + 1000 < sourceMtime;
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

export function formatStaleTargetsError(title, staleTargets) {
  const details = staleTargets.map(({ source, target }) => `${target} is older than ${source}`);
  const commands = [...new Set(staleTargets.map(({ command }) => command).filter(Boolean))];

  return [title, ...details, ...commands.map((command) => `Run: ${command}`)].join(" ");
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

  const workspaceRuntime = readText("apps/desktop/src-tauri/src/workspace.rs", "utf8");
  if (!workspaceRuntime.includes("const LEGACY_HOST_EXECUTION_ENABLED: bool = false;")) {
    throw new Error("WP0 legacy host execution kill switch must remain explicitly disabled");
  }

  const staleGeneratedFiles = findStaleGeneratedFiles(generatedSourcePairs, statFile);

  if (staleGeneratedFiles.length > 0) {
    throw new Error(formatStaleGeneratedFilesError(staleGeneratedFiles));
  }

  const staleMacTargets = findStaleTargets(macFreshnessPairs, existsPath, statFile);

  if (staleMacTargets.length > 0) {
    throw new Error(formatStaleTargetsError("Mac desktop release/install is stale.", staleMacTargets));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runHealthCheck();
  console.log("health check passed");
}
