import assert from "node:assert/strict";
import test from "node:test";
import {
  findStaleGeneratedFiles,
  findStaleTargets,
  formatStaleGeneratedFilesError,
  formatStaleTargetsError,
  runHealthCheck
} from "./check-health.mjs";

test("findStaleGeneratedFiles reports generated adapter files older than their source", () => {
  const pairs = [
    {
      source: "packages/openclaw-adapter/src/localAssistantPlan.ts",
      generated: "packages/openclaw-adapter/dist/localAssistantPlan.js"
    },
    {
      source: "packages/openclaw-adapter/src/browser.ts",
      generated: "packages/openclaw-adapter/dist/browser.js"
    }
  ];
  const mtimes = new Map([
    ["packages/openclaw-adapter/src/localAssistantPlan.ts", 20_000],
    ["packages/openclaw-adapter/dist/localAssistantPlan.js", 10_000],
    ["packages/openclaw-adapter/src/browser.ts", 20_000],
    ["packages/openclaw-adapter/dist/browser.js", 19_500]
  ]);

  const stale = findStaleGeneratedFiles(pairs, (path) => ({
    mtimeMs: mtimes.get(path)
  }));

  assert.deepEqual(stale, [pairs[0]]);
  assert.match(
    formatStaleGeneratedFilesError(stale),
    /Run: npm --workspace packages\/openclaw-adapter run build/
  );
});

test("runHealthCheck rejects Mac latest launcher that uses a relative sync script path", () => {
  const files = new Map([
    ["start-opencow-test.bat", 'if /I "%MODE%"=="check"\npause >nul'],
    [
      "scripts/start-opencow-latest-desktop-mac.command",
      'SYNC_SCRIPT="${REPO_ROOT}/scripts/sync-opencow-mac-apps.py"\npython3 scripts/sync-opencow-mac-apps.py'
    ],
    ["scripts/sync-opencow-mac-apps.py", "# sync script"],
    ["apps/desktop/src-tauri/src/workspace.rs", "const LEGACY_HOST_EXECUTION_ENABLED: bool = false;"]
  ]);

  assert.throws(
    () =>
      runHealthCheck({
        existsPath: () => true,
        readText: (path) => files.get(path) ?? "",
        statFile: () => ({ mtimeMs: 20_000 })
      }),
    /absolute sync script path/
  );
});

test("runHealthCheck rejects a missing WP0 legacy host execution kill switch", () => {
  const files = new Map([
    ["start-opencow-test.bat", 'if /I "%MODE%"=="check"\npause >nul'],
    [
      "scripts/start-opencow-latest-desktop-mac.command",
      'SYNC_SCRIPT="${REPO_ROOT}/scripts/sync-opencow-mac-apps.py"\npython3 "${SYNC_SCRIPT}"'
    ],
    ["scripts/sync-opencow-mac-apps.py", "# sync script"]
  ]);

  assert.throws(
    () =>
      runHealthCheck({
        existsPath: () => true,
        readText: (path) => files.get(path) ?? "",
        statFile: () => ({ mtimeMs: 20_000 })
      }),
    /legacy host execution kill switch/
  );
});

test("findStaleTargets reports optional install and release targets older than their source", () => {
  const pairs = [
    {
      source: "apps/desktop/src/app/App.tsx",
      target: "apps/desktop/src-tauri/target/release/bundle/macos/opencow.app/Contents/MacOS/opencow-desktop",
      command: "npm run desktop:sync:mac"
    },
    {
      source: "apps/desktop/src-tauri/target/release/bundle/macos/opencow.app/Contents/MacOS/opencow-desktop",
      target: "/Users/apple/Desktop/OpenCow桌面端.app/Contents/MacOS/opencow-desktop",
      command: "npm run desktop:sync:mac"
    },
    {
      source: "scripts/start-opencow-latest-desktop-mac.command",
      target: "/Users/apple/Desktop/opencow最新测试版.app/Contents/MacOS/opencow-latest-launcher",
      command: "npm run desktop:sync:mac"
    }
  ];
  const mtimes = new Map([
    ["apps/desktop/src/app/App.tsx", 30_000],
    [
      "apps/desktop/src-tauri/target/release/bundle/macos/opencow.app/Contents/MacOS/opencow-desktop",
      20_000
    ],
    ["/Users/apple/Desktop/OpenCow桌面端.app/Contents/MacOS/opencow-desktop", 20_500],
    ["scripts/start-opencow-latest-desktop-mac.command", 10_000],
    ["/Users/apple/Desktop/opencow最新测试版.app/Contents/MacOS/opencow-latest-launcher", 11_000]
  ]);

  const stale = findStaleTargets(
    pairs,
    (path) => mtimes.has(path),
    (path) => ({ mtimeMs: mtimes.get(path) })
  );

  assert.deepEqual(stale, [pairs[0]]);
  assert.match(formatStaleTargetsError("Mac desktop release/install is stale.", stale), /npm run desktop:sync:mac/);
});

test("runHealthCheck rejects stale Mac desktop release or install targets when they exist", () => {
  const files = new Map([
    ["start-opencow-test.bat", 'if /I "%MODE%"=="check"\npause >nul'],
    [
      "scripts/start-opencow-latest-desktop-mac.command",
      'SYNC_SCRIPT="${REPO_ROOT}/scripts/sync-opencow-mac-apps.py"\npython3 "${SYNC_SCRIPT}"'
    ],
    ["scripts/sync-opencow-mac-apps.py", "# sync script"],
    ["apps/desktop/src-tauri/src/workspace.rs", "const LEGACY_HOST_EXECUTION_ENABLED: bool = false;"]
  ]);
  const mtimes = new Map([
    ["packages/openclaw-adapter/src/localAssistantPlan.ts", 20_000],
    ["packages/openclaw-adapter/dist/localAssistantPlan.js", 20_000],
    ["packages/openclaw-adapter/src/types.ts", 20_000],
    ["packages/openclaw-adapter/dist/types.d.ts", 20_000],
    ["packages/openclaw-adapter/src/browser.ts", 20_000],
    ["packages/openclaw-adapter/dist/browser.js", 20_000],
    ["apps/desktop/src/app/App.tsx", 30_000],
    [
      "apps/desktop/src-tauri/target/release/bundle/macos/opencow.app/Contents/MacOS/opencow-desktop",
      20_000
    ],
    ["/Users/apple/Desktop/OpenCow桌面端.app/Contents/MacOS/opencow-desktop", 20_000],
    ["scripts/start-opencow-latest-desktop-mac.command", 20_000],
    ["/Users/apple/Desktop/opencow最新测试版.app/Contents/MacOS/opencow-latest-launcher", 20_000]
  ]);

  assert.throws(
    () =>
      runHealthCheck({
        existsPath: (path) => files.has(path) || mtimes.has(path) || !path.startsWith("/Users/apple/Desktop/"),
        readText: (path) => files.get(path) ?? "",
        statFile: (path) => ({ mtimeMs: mtimes.get(path) ?? 20_000 })
      }),
    /Mac desktop release\/install is stale/
  );
});
