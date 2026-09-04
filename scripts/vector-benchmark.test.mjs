import assert from "node:assert/strict";
import test from "node:test";
import { createVectorBenchmarkMatrix, runVectorBenchmark } from "./vector-benchmark.mjs";

test("creates the locked 10k/50k/100k by 384/768/1024 matrix", () => {
  const matrix = createVectorBenchmarkMatrix();
  assert.equal(matrix.length, 9);
  assert.deepEqual(matrix[0], {
    chunkCount: 10_000,
    dimensions: 384,
    backend: "feasibility-inmemory",
    backendVersion: "node-stdlib-v1",
    indexFormat: "dense-row-major",
    distance: "cosine",
    quantization: "none",
    embeddingModelDigest: "fixture-not-an-embedding-model",
    status: "planned"
  });
});

test("runs only a bounded feasibility sample and keeps report metadata", () => {
  const report = runVectorBenchmark({ sampleRows: 2 });
  assert.equal(report.mode, "feasibility-microbenchmark");
  assert.equal(report.cells.length, 9);
  assert.ok(report.cells.every((cell) => cell.sampleRows === 2 && cell.status === "sampled"));
});
