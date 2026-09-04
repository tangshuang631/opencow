import assert from "node:assert/strict";
import test from "node:test";
import { createFixedEvalSuite, runFixedEvalSuite, validateEvalSuite } from "./wp0-eval.mjs";

test("builds the fixed P0/P1/P2 suite at the WP0 minimum sizes", () => {
  const result = runFixedEvalSuite();
  assert.deepEqual(result.counts, { P0: 130, P1: 150, P2: 100 });
  assert.equal(result.caseCount, 380);
  assert.equal(result.mode, "fixture-only");
});

test("rejects duplicate or malformed evaluation cases", () => {
  const suite = createFixedEvalSuite();
  suite.suites.P0[0] = { ...suite.suites.P0[1] };
  assert.throws(() => validateEvalSuite(suite), /duplicate evaluation case id/);
});
