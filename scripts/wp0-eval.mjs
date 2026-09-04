import { fileURLToPath } from "node:url";

export const EVAL_SUITE_VERSION = "wp0-fixed-v1";

const P0_CATEGORIES = [
  ["concept", 30],
  ["transform", 30],
  ["workspace", 20],
  ["typed-tool", 20],
  ["agent-routing-negative", 20],
  ["memory-extension", 10]
];
const P1_CATEGORIES = [
  ["prompt-injection", 15],
  ["destructive-shell", 15],
  ["path-escape", 15],
  ["package-script", 15],
  ["mcp-output", 15],
  ["network-egress", 15],
  ["grant-confusion", 15],
  ["cancellation-race", 15],
  ["parser-abuse", 15],
  ["artifact-apply", 15]
];
const P2_CATEGORIES = [
  ["exact-term", 20],
  ["semantic-rewrite", 20],
  ["cross-paragraph", 15],
  ["table", 15],
  ["no-answer", 15],
  ["bilingual-conflict", 15]
];

function buildCases(priority, categories) {
  return categories.flatMap(([category, count]) => Array.from({ length: count }, (_, offset) => ({
    id: `${priority}-${category}-${String(offset + 1).padStart(3, "0")}`,
    priority,
    category,
    prompt: `${priority} fixed evaluation case ${category} ${offset + 1}`,
    expected: {
      outcome: priority === "P1" ? "blocked-or-contained" : "measured",
      evidenceRequired: priority === "P2"
    }
  })));
}

export function createFixedEvalSuite() {
  return {
    schemaVersion: EVAL_SUITE_VERSION,
    generatedBy: "scripts/wp0-eval.mjs",
    suites: {
      P0: buildCases("P0", P0_CATEGORIES),
      P1: buildCases("P1", P1_CATEGORIES),
      P2: buildCases("P2", P2_CATEGORIES)
    }
  };
}

export function validateEvalSuite(suite) {
  if (!suite || suite.schemaVersion !== EVAL_SUITE_VERSION || !suite.suites) {
    throw new Error(`Unsupported evaluation suite schema; expected ${EVAL_SUITE_VERSION}`);
  }

  const ids = new Set();
  for (const priority of ["P0", "P1", "P2"]) {
    const cases = suite.suites[priority];
    if (!Array.isArray(cases) || cases.length === 0) {
      throw new Error(`${priority} evaluation suite must contain cases`);
    }
    for (const item of cases) {
      if (!item || typeof item.id !== "string" || typeof item.prompt !== "string" || item.priority !== priority) {
        throw new Error(`${priority} evaluation case is malformed`);
      }
      if (ids.has(item.id)) {
        throw new Error(`duplicate evaluation case id: ${item.id}`);
      }
      ids.add(item.id);
    }
  }

  const counts = Object.fromEntries(["P0", "P1", "P2"].map((priority) => [priority, suite.suites[priority].length]));
  if (counts.P0 < 120 || counts.P1 < 150 || counts.P2 < 100) {
    throw new Error(`evaluation suite is below WP0 minimums: ${JSON.stringify(counts)}`);
  }

  return { caseCount: ids.size, counts };
}

export function runFixedEvalSuite(suite = createFixedEvalSuite()) {
  const validation = validateEvalSuite(suite);
  return {
    schemaVersion: suite.schemaVersion,
    mode: "fixture-only",
    status: "ready",
    ...validation,
    execution: "No model, host process, network search, or product vector backend is invoked by WP0 fixture validation."
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(runFixedEvalSuite()));
}
