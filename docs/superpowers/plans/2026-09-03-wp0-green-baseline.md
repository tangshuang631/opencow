# WP0 Green Baseline Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with test-first changes. Keep all work on `dev`; do not commit until the user explicitly authorizes a milestone commit.

**Goal:** Establish the first WP0 compatibility slice for the vendored OpenClaw 2026.8.2 source, then continue toward a reproducible green baseline without enabling legacy host execution.

**Architecture:** Treat the vendored OpenClaw tree as an inspected, versioned boundary. Capability readiness is derived from discovered package metadata and explicit compatibility aliases, never from model/package name guessing. WP0 adds measurement and safety gates only; real CowCore runtime and host tools remain disabled until their later work-package exits.

**Tech Stack:** TypeScript, Node.js 24, Vitest, npm workspaces, vendored OpenClaw source archive.

---

### Task 1: OpenClaw 2026.8.2 metadata compatibility

**Files:**
- Modify: `packages/openclaw-adapter/src/types.ts`
- Modify: `packages/openclaw-adapter/src/capabilities.ts`
- Modify: `packages/openclaw-adapter/src/capabilityFamilies.ts`
- Modify: `packages/openclaw-adapter/src/workspaceCatalog.ts`
- Modify: `packages/openclaw-adapter/src/capabilityFamilies.test.ts`
- Modify: `packages/openclaw-adapter/src/upstreamMetadata.test.ts`
- Modify: `packages/openclaw-adapter/src/workspaceCatalog.test.ts`

  - [x] **Step 1: Write the failing compatibility assertions**

  Assert that the 2026.8.2 package topology reports `llmCore`, `modelCatalog`, `pluginSdk`, `terminalCore`, and `toolCallRepair`; treat the removed `llm-runtime` as an explicit compatibility alias rather than a required physical package. Assert that workspace metadata accepts packages where `private` is absent and records `private: false`.

  - [x] **Step 2: Run the focused tests and verify the expected failure**

  Run: `npm --workspace packages/openclaw-adapter test -- src/capabilityFamilies.test.ts src/upstreamMetadata.test.ts src/workspaceCatalog.test.ts`

  Expected: failure only in the old `llm-runtime` and `private` expectations.

  - [x] **Step 3: Implement the smallest compatibility mapping**

  Add a stable `llmRuntime` capability record with `available: false`, `compatibility: "relocated-or-removed"`, and a replacement list containing `@openclaw/llm-core`; exclude that alias from families that only need the current package topology. Normalize missing `private` metadata to `false` while preserving strict validation for malformed values.

  - [x] **Step 4: Run the focused tests and verify the green result**

  Run the same focused Vitest command. Expected: all selected tests pass and no legacy runtime import is executed.

  - [x] **Step 5: Run the adapter type build**

  Run: `npm --workspace packages/openclaw-adapter run build`

  Expected: TypeScript exits 0.

### Task 2: WP0 reproducibility manifest and checks

**Files:**
- Create: `scripts/wp0-baseline.mjs`
- Create: `scripts/wp0-baseline.test.mjs`
- Modify: `package.json`

  - [x] **Step 1: Write failing tests for deterministic baseline metadata**

  Test that a supplied snapshot contains branch, commit SHA, Node version, OpenClaw version, and test command names; reject missing or non-hex commit SHAs; serialize keys in a fixed order.

  - [x] **Step 2: Run the new script test and verify it fails because the module is absent**

  Run: `node --test scripts/wp0-baseline.test.mjs`

  Expected: module-not-found failure.

  - [x] **Step 3: Implement a pure snapshot/serialization helper and CLI**

  Use Node stdlib only. The CLI writes a report to stdout and never mutates source files. Include the current Git branch/commit, Node version, vendored OpenClaw metadata, and explicitly selected targeted test commands.

  - [x] **Step 4: Run the script test and verify it passes**

  Run: `node --test scripts/wp0-baseline.test.mjs`

  Expected: all tests pass.

  - [x] **Step 5: Add a package script**

  Add `"check:wp0-baseline": "node scripts/wp0-baseline.mjs"` and run it once to capture the report without committing it.

### Task 3: WP0 gate sequencing

**Files:**
- Modify: `scripts/check-health.mjs`
- Modify: `scripts/check-health.test.mjs`

- [x] **Step 1: Add a failing assertion that legacy host execution remains disabled**

  Feed the health checker a fixture with the kill-switch marker absent and assert that it fails closed.

- [x] **Step 2: Run the focused health tests and verify red**

  Run: `node --test scripts/check-health.test.mjs`

  Expected: the new kill-switch test fails.

- [x] **Step 3: Add the minimal marker/config check**

  Require one explicit repository-local kill-switch configuration marker and reject `enabled: true` in WP0. Keep this check read-only and independent of any runtime invocation.

- [x] **Step 4: Run focused health tests green**

  Run: `node --test scripts/check-health.test.mjs`

  Expected: all health tests pass.

### Task 4: WP0 exit verification

**Files:**
- No source changes unless a preceding test identifies a concrete defect.

  - [x] **Step 1: Run targeted package tests for each changed unit**

  Run the exact Vitest or Node test command recorded by each task and require zero failures.

  - [x] **Step 2: Run encoding and workspace build checks**

  Run: `npm run check:encoding` and `npm run build`.

  Expected: both commands exit 0; if they fail, stop and repair the failing unit before proceeding.

  - [x] **Step 3: Run the WP0 baseline report**

  Run: `npm run check:wp0-baseline`.

  Expected: deterministic report includes the exact current `dev` SHA and OpenClaw version; no commit or push is performed.

### Task 5: Fixed P0/P1/P2 evaluation runner

**Files:**
- Create: `scripts/wp0-eval.mjs`
- Create: `scripts/wp0-eval.test.mjs`
- Modify: `package.json`

- [x] Add deterministic, schema-versioned fixture generation and validation for P0 (130 including the 10-case memory extension), P1 (150), and P2 (100).
- [x] Keep WP0 runner fixture-only: it validates coverage and IDs without invoking a model, network search, host process, or product vector backend.

### Task 6: Ollama Native same-host baseline harness

**Files:**
- Create: `scripts/ollama-baseline.mjs`
- Create: `scripts/ollama-baseline.test.mjs`
- Modify: `package.json`

- [x] Cover `/api/version`, `/api/tags`, `/api/show`, `/api/ps`, native `/api/chat`, and `/api/embed` with loopback-only enforcement.
- [x] Record model digest/metadata, capability observations, cold/warm usage metrics, keep-alive controls, residency observation, and processor placement without inventing CPU-offload estimates.
- [x] Verify the request builder and mocked API path without requiring a running Ollama daemon.

### Task 7: Vector benchmark harness

**Files:**
- Create: `scripts/vector-benchmark.mjs`
- Create: `scripts/vector-benchmark.test.mjs`
- Modify: `package.json`

- [x] Generate the locked 10k/50k/100k × 384/768/1024 matrix and report backend/version/index-format/distance/quantization/embedding-digest metadata.
- [x] Provide a bounded deterministic feasibility sample only; do not implement or claim product `VectorIndexBackend` performance.

### Current checkpoint

- Task 1, Task 2, and Task 4 are complete on `dev` with no commit.
- Desktop unit suite is green: 66 files, 774 tests passed; Web unit suite is green: 49 tests passed.
- Workspace build, encoding check, adapter tests/build, script tests, and WP0 baseline report are green.
- Task 3 implementation and focused verification are complete: the legacy host-execution kill switch is explicit and fail-closed; full `check:health` remains blocked only by stale optional macOS release/install artifacts.
- Tasks 5–7 are complete with 20 script tests passing; `eval:wp0`, Ollama Native request/metadata harness, and Vector feasibility matrix are runnable without enabling WP1 execution.
- `npm run check:health` currently reports stale optional macOS release/install artifacts; this checkpoint does not overwrite them. Web historical fixture drift and the task/conversation identity regressions are resolved.
