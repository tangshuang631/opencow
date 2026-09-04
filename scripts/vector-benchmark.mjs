import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

export const VECTOR_CHUNK_COUNTS = [10_000, 50_000, 100_000];
export const VECTOR_DIMENSIONS = [384, 768, 1024];

export function createVectorBenchmarkMatrix() {
  return VECTOR_CHUNK_COUNTS.flatMap((chunkCount) => VECTOR_DIMENSIONS.map((dimensions) => ({
    chunkCount,
    dimensions,
    backend: "feasibility-inmemory",
    backendVersion: "node-stdlib-v1",
    indexFormat: "dense-row-major",
    distance: "cosine",
    quantization: "none",
    embeddingModelDigest: "fixture-not-an-embedding-model",
    status: "planned"
  })));
}

function fixtureValue(index) {
  let value = (index + 1) >>> 0;
  value = (value * 1664525 + 1013904223) >>> 0;
  return (value / 0xffffffff) * 2 - 1;
}

function runCell(cell, sampleRows) {
  const vector = Float32Array.from({ length: cell.dimensions }, (_, index) => fixtureValue(index));
  const startedAt = performance.now();
  let checksum = 0;
  for (let row = 0; row < sampleRows; row += 1) {
    let dot = 0;
    for (let index = 0; index < vector.length; index += 1) dot += vector[index] * fixtureValue(index + row);
    checksum += dot;
  }
  return {
    ...cell,
    status: "sampled",
    sampleRows,
    elapsedMs: performance.now() - startedAt,
    checksum: Number(checksum.toFixed(6))
  };
}

export function runVectorBenchmark({ sampleRows = 32 } = {}) {
  if (!Number.isInteger(sampleRows) || sampleRows < 1) throw new Error("sampleRows must be a positive integer");
  return {
    schemaVersion: "vector-benchmark-v1",
    mode: "feasibility-microbenchmark",
    warning: "This does not implement or measure the product VectorIndexBackend.",
    cells: createVectorBenchmarkMatrix().map((cell) => runCell(cell, sampleRows))
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sampleRows = Number(process.env.OPENCOW_VECTOR_SAMPLE_ROWS || 32);
  console.log(JSON.stringify(runVectorBenchmark({ sampleRows })));
}
