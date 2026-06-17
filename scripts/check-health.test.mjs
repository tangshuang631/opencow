import assert from "node:assert/strict";
import test from "node:test";
import {
  findStaleGeneratedFiles,
  formatStaleGeneratedFilesError
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
