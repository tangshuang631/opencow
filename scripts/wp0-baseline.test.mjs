import assert from "node:assert/strict";
import test from "node:test";
import { createBaselineSnapshot, serializeBaselineSnapshot } from "./wp0-baseline.mjs";

test("createBaselineSnapshot validates the immutable commit identity", () => {
  const snapshot = createBaselineSnapshot({
    branch: "dev",
    commitSha: "a".repeat(40),
    nodeVersion: "v24.16.0",
    openclawVersion: "2026.8.2",
    testCommands: ["npm run check:encoding", "npm run test:unit"]
  });

  assert.deepEqual(snapshot, {
    branch: "dev",
    commitSha: "a".repeat(40),
    nodeVersion: "v24.16.0",
    openclawVersion: "2026.8.2",
    testCommands: ["npm run check:encoding", "npm run test:unit"]
  });
});

test("createBaselineSnapshot rejects a non-hex commit SHA", () => {
  assert.throws(
    () =>
      createBaselineSnapshot({
        branch: "dev",
        commitSha: "not-a-sha",
        nodeVersion: "v24.16.0",
        openclawVersion: "2026.8.2",
        testCommands: []
      }),
    /commitSha must be a 40-character lowercase hexadecimal SHA/
  );
});

test("serializeBaselineSnapshot uses a stable key order", () => {
  const snapshot = createBaselineSnapshot({
    branch: "dev",
    commitSha: "b".repeat(40),
    nodeVersion: "v24.16.0",
    openclawVersion: "2026.8.2",
    testCommands: ["npm run test:unit"]
  });

  assert.equal(
    serializeBaselineSnapshot(snapshot),
    '{"branch":"dev","commitSha":"' + "b".repeat(40) + '","nodeVersion":"v24.16.0","openclawVersion":"2026.8.2","testCommands":["npm run test:unit"]}\n'
  );
});
