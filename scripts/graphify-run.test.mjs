import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGraphifyOutputDirName,
  collectCodeFiles,
  hasAnyLlmApiKey,
  normalizeModuleName
} from "./graphify-run.mjs";

test("buildGraphifyOutputDirName uses graphify for repo root", () => {
  assert.equal(buildGraphifyOutputDirName("."), "graphify");
  assert.equal(buildGraphifyOutputDirName(""), "graphify");
});

test("buildGraphifyOutputDirName uses graphify_<module> for submodules", () => {
  assert.equal(buildGraphifyOutputDirName("apps/desktop"), "graphify_apps_desktop");
  assert.equal(buildGraphifyOutputDirName("packages/openclaw-adapter"), "graphify_packages_openclaw_adapter");
});

test("normalizeModuleName strips unsafe path characters", () => {
  assert.equal(normalizeModuleName("../apps/desktop"), "apps_desktop");
  assert.equal(normalizeModuleName("packages/openclaw-adapter"), "packages_openclaw_adapter");
  assert.equal(normalizeModuleName("scripts///"), "scripts");
});

test("hasAnyLlmApiKey detects supported provider keys", () => {
  assert.equal(hasAnyLlmApiKey({}), false);
  assert.equal(hasAnyLlmApiKey({ OPENAI_API_KEY: "test" }), true);
  assert.equal(hasAnyLlmApiKey({ GEMINI_API_KEY: "test" }), true);
});

test("collectCodeFiles keeps supported source files and skips generated outputs", () => {
  const files = [
    "apps/desktop/src/main.tsx",
    "apps/desktop/src/styles/global.css",
    "packages/openclaw-adapter/dist/index.js",
    "docs/v1.0/02-architecture.md",
    "graphify/graph.json",
    "scripts/graphify-run.mjs",
    "node_modules/pkg/index.js"
  ];

  assert.deepEqual(collectCodeFiles(files), [
    "apps/desktop/src/main.tsx",
    "apps/desktop/src/styles/global.css"
  ]);
});
