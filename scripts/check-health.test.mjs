import assert from "node:assert/strict";
import test from "node:test";
import {
  findStaleGeneratedFiles,
  formatStaleGeneratedFilesError,
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
    ["scripts/sync-opencow-mac-apps.py", "# sync script"]
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
