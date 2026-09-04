# WP0 Green Baseline Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with test-first changes. Keep all work on `dev`; commit and push each verified medium/large milestone. Keep `main` untouched until WP7 release approval.

**Goal:** Establish the first WP0 compatibility slice for the vendored OpenClaw 2026.8.2 source, then deliver the CowCore/Ollama Fast Lane in gated slices without enabling legacy host execution.

**Architecture:** Treat the vendored OpenClaw tree as an inspected, versioned boundary. Capability readiness is derived from discovered package metadata and explicit compatibility aliases, never from model/package name guessing. WP0 adds measurement and safety gates; WP1 adds an additive native Ollama/CowCore path while the legacy transport remains a compatibility seam until native parity is verified.

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

  Expected: deterministic report includes the exact current `dev` SHA and OpenClaw version; the report command itself does not mutate Git state (milestone saving follows the global execution contract).

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

- Task 1, Task 2, and Task 4 are complete on `dev`; the verified WP0 checkpoint is pushed as `3b55668`.
- Desktop unit suite is green: 66 files, 774 tests passed; Web unit suite is green: 49 tests passed.
- Workspace build, encoding check, adapter tests/build, script tests, and WP0 baseline report are green.
- Task 3 implementation and focused verification are complete: the legacy host-execution kill switch is explicit and fail-closed; macOS release/install artifacts were synchronized after explicit authorization and full `check:health` is green.
- Tasks 5–7 are complete with 20 script tests passing; `eval:wp0`, Ollama Native request/metadata harness, and Vector feasibility matrix are runnable without enabling WP1 execution.
- `npm run check:health` passes after the authorized macOS release/install synchronization. Web historical fixture drift and the task/conversation identity regressions are resolved.
- The first WP1 implementation slice is saved on `dev` in milestone `0657186`: `@opencow/cowcore` exposes the native Ollama provider, runtime/model profiles, locality enforcement, residency observation, adaptive context budget, stable prefix serialization, keep-alive policy, deterministic task routing, bounded zero-effect typed-tool loop, and Fast Lane orchestration. The desktop wrapper provides a native profile smoke path without replacing the legacy transport.
- The next WP1 gate slice adds fail-closed `cowcoreFastLane`/`ollamaNativeProfile`/`ollamaLocalOnly` evaluation, requires an allowed gate before Fast Lane execution, and normalizes Ollama usage plus Residency Observation into a performance profile without deriving Apple unified-memory CPU offload. This slice is not yet an exit claim until runtime lifecycle/configuration, cache continuation, metrics persistence, and formal WP1C evidence are complete.
- The same WP1 slice adds a stable-prefix/cache-continuation harness with an explicit `prompt_eval_duration` ratio; the latest local run on Ollama `0.33.3` produced a `0.436` candidate ratio. It is evidence only and does not replace the required 8K-token multi-turn release benchmark.
- The desktop conversation now follows the newest message on the compositor frame only while the reader is near the bottom; a reader who scrolls upward is not pulled back during streaming. Reduced-motion behavior remains guarded.
- UI smoke coverage includes the motion scope, reduced-motion guard, Codex-inspired sidebar/inspector styling, and a real Playwright web chat round-trip against local Ollama. No host execution, MCP start, project run, or shell capability is connected to the new loop.
- WP1C now has an additive implementation slice behind `crossSessionMemory`: versioned SQLite/FTS5 storage, bounded audit metadata, explicit top-level-user save/edit/revoke/list/export/clear commands, user/workspace and expiry filtering, untrusted-context formatting, and a settings-panel opt-in. Local chat reads memory only when the persisted opt-in is enabled; the dynamic suffix is capped at five items and a conservative 2,000-character budget. This is implementation evidence, not the WP1C exit: the formal 10-case memory evaluation, desktop-native E2E, and release evidence remain open.
- Profile/metrics persistence now has a bounded, digest/version-keyed `PerformanceProfileStore` (24 samples, schema-versioned, no prompt/evidence text) and Ollama Native Provider restores and records validated samples. Streaming UI updates now coalesce chunks on the compositor frame and flush on completion/cancellation; this is an interaction-smoothness improvement, not a visual redesign.

## Full implementation roadmap: WP1–WP7

This section is the execution companion to the single frozen architecture Spec. It does not change the architecture or open a second implementation route. Every task below is gated by the preceding exit, uses test-first changes, and stays on `dev` until its milestone evidence is complete.

### Global execution contract

- `dev` is the only integration branch. Each medium/large milestone is saved with a descriptive commit and pushed; `main` is untouched until WP7 release approval.
- A package task must pass its focused unit test before its neighboring integration test. Full `npm run test:unit`, `npm run build`, `npm run check:encoding`, `npm run check:health`, and the relevant Rust tests run at every WP exit.
- No task may enable `workspace.project.run`, `sandbox.shell.execute`, `mcp.server.start`, or any legacy host process path before WP3D security exit. WP1 tool loops use pure fixtures only.
- Every persistent format has a schema version, deterministic serialization, migration, rollback, and a fixture. Every runtime/network boundary fails closed on malformed metadata, non-loopback Ollama endpoints, missing locality proof, or unknown capability.
- New feature flags default off; `cowcoreFastLane` remains disabled until `ollamaNativeProfile` and `ollamaLocalOnly` are both verified. A flag cannot weaken an existing security invariant and must have a kill-switch test.
- `ponytail:` comments are required only where a deliberate bounded simplification remains (for example, a global lock or bounded linear scan); each names the measurable ceiling and upgrade trigger.

### Dependency and milestone order

```text
WP0 (green, complete)
  ├─ WP1A Ollama Runtime ─┬─ WP1B Fast Lane ─┐
  │                       └─ WP1C Memory MVP ─┤
  ├─ WP2A Registry ─ WP2B Grants ─────────────┤
  └────────────────────────────── WP3A → WP3B → WP3C → WP3D
                                                ├─ WP4 RAG 2.0
                                                ├─ WP5 Web Research
                                                └─ WP6 Sidecar
WP4 + WP5 + WP6 → WP7 Migration / Release
```

No branch may skip a parent exit. WP1C can ship independently behind its flag, but it never blocks the P0 direct-chat path.

### WP1 — CowCore contract and local Fast Lane

#### WP1A — Ollama Native Runtime

**Implementation surface:** introduce one small `@opencow/cowcore` package (split only when a module becomes independently testable), with `modelGateway`, `ollamaNativeProvider`, `runtimeProfile`, `modelProfile`, `contextBudgeter`, `prefixSerializer`, `localityEnforcement`, `residencyController`, and `metricsCollector`. Keep the existing Rust Ollama transport as a compatibility seam until the native provider has parity.

**Tasks:**

1. Define versioned types for RuntimeProfile/ModelProfile, capability evidence, hardware snapshot, cold/warm metrics, processor placement, and `runtimeOptimizations`; reject unknown security fields rather than guessing.
2. Implement native `/api/version`, `/api/tags`, `/api/show`, `/api/ps`, `/api/chat`, `/api/embed`; preserve streaming, structured output, tools, thinking, vision, `keep_alive`, cancellation, and usage metrics.
3. Implement Locality Enforcement separately from Residency Observation. Require loopback plus cloud-disabled/verified egress policy; never use `/api/ps` as a locality attestation. Preserve Apple unified-memory `acceleratorResidentRatio` as placement observation only; never derive or expose a CPU offload estimate without an explicit Runtime signal.
4. Build capability probes from metadata, a bounded probe, and cached same-machine benchmark evidence. Never infer MLX/MTP/DFlash/tools from a model-name suffix.
5. Implement Context Budgeter and keep-alive policy using model context, unified memory/VRAM, model size, task class, current pressure, and measured offload risk. Use 64K+ only when the decision function accepts it.
6. Serialize stable system contract and ordered Capability Schema once per security-contract version; append volatile request/Evidence data after the stable prefix.

**Tests and exit:** native request/stream/JSON-schema/tool/thinking/embed fixtures; locality redirect/cloud-disabled tests; metadata and malformed-response tests; cold/warm and cache-prefix comparison; context-budget property tests; Apple offload semantic tests. Exit requires direct-chat and one-shot transform working with OpenClaw disabled, no host effects, and a repeatable Profile report.

#### WP1B — Fast Lane protocol

**Tasks:**

1. Add deterministic TaskClass routing for chat, transform, extraction, summarize, retrieval-answer, and simple workbench actions.
2. Add a bounded typed-tool loop using only pure-function and readonly diagnostic fixtures. Validate JSON Schema, tool order, cancellation, timeout, duplicate result, and malformed model output.
3. Keep retrieval adapter input at the interface boundary; do not claim RAG 2.0 until WP4. Preserve stable prefix and put changing evidence at the tail.
4. Add an observability record without raw user text, thinking, system prompt, or evidence body.

**Tests and exit:** route matrix, structured-output, streaming, cache continuation, cancellation, failure-closed, and zero-effect proof tests. Exit requires the Fast Lane to remain usable with Sidecar disabled and all tools to have zero side effects.

#### WP1C — Cross-session Memory MVP

**Tasks:**

1. Add versioned SQLite tables and FTS5 for `MemoryItem`, user/workspace scope, source conversation, confidence, created/updated/expiry, revoked, and export state.
2. Add explicit `MemoryProposal` review/save flow; no silent extraction from arbitrary model text. User confirmation is the write authority.
3. Inject memories as an untrusted context block after the stable prefix, with scope and expiry filters; never let memory content alter Capability/Grant policy.
4. Add settings list/search/revoke/delete/export and a migration rollback.

**Tests and exit:** scope isolation, prompt-injection memory, expiry/revocation, deletion/export, disabled-flag no-write/no-inject, and cross-session property tests. The 10-case memory extension in the WP0 eval must pass; the feature remains independently toggleable. The current slice covers the native schema/commands and desktop settings/chat wiring, but does not claim the exit until the 10-case eval, native desktop E2E, migration/rollback rehearsal, and evidence bundle are complete.

### WP2 — Capability and authorization foundation

#### WP2A — Registry and Broker

**Implementation surface:** extend `packages/permission-engine` and `packages/safety-engine`; add `capabilityRegistry`, `capabilityBroker`, `jcsCanonicalizer`, and versioned registry fixtures rather than a new framework package.

**Tasks:**

1. Define Capability records whose effect/risk/execution zone are registry-owned and immutable to model input.
2. Implement RFC 8785 JCS plus SHA-256 `securityContractHash` with Rust/TypeScript golden vectors and invalid I-JSON rejection.
3. Implement capability-specific scope comparator and containment relation; add only typed, non-arbitrary host capabilities (reveal/open/fixed application actions/read-only diagnostics).
4. Keep project.run, sandbox.shell.execute, and mcp.server.start disabled and add a negative reachability test from every Fast Lane route.

**Exit:** Registry/Broker tests pass; model cannot self-report effect/risk/zone; `SEC-35` is green.

#### WP2B — Grant and Authorization

**Tasks:**

1. Add versioned Grant records, revocation, expiry, device/user scope, capability scope, sandbox policy hash, artifact policy hash, and audit linkage.
2. Implement equivalence matching with no string/semantic-language matching; persistent grants are denied for shell, project run, MCP start, credential access, and broad network/filesystem effects.
3. Add separate Sandbox Execute and Host Apply approvals; implement UI settings for review/revoke without changing broker decisions.

**Tests and exit:** property tests prove equivalent requests reuse safely and every scope/policy/hash expansion mismatches 100%; crash/restart and clock-skew cases remain fail closed.

### WP3 — Certified Sandbox, Artifact, and Host Apply

#### WP3A — Backend feasibility spike

Evaluate one macOS and one Windows candidate with a disposable guest runner. Measure process-tree containment, I/O, cancellation, resource limits, network policy, artifact channel, and platform prerequisites. Produce a signed decision record; if a platform cannot satisfy the contract, leave execution disabled there. No user shell is opened in the spike.

#### WP3B — Mirror and immutable artifact protocol

Add the sandbox backend interface, workspace mirror, sanitized Git context, content-addressed Artifact Store, ChangeSet schema, guest protocol, parser-zone boundary, network proxy, and resource/process-tree limits. Tests must prove no guest-visible host path and no read-write workspace mount.

#### WP3C — TOCTOU-safe Host Apply

Implement descriptor/handle-relative traversal, file identity and policy rechecks, staged writes, atomic replacement, rollback snapshots, durable Apply Journal, idempotency, and crash recovery. Add symlink/junction/hardlink/reparse races, filesystem fuzz, and fault injection at every commit point.

#### WP3D — Enable typed execution

Only after WP3A–C exits, map `sandbox.shell.execute`, `workspace.project.run`, and `mcp.server.start` to Certified Sandbox. Keep execute and Host Apply grants separate; unsupported platforms remain disabled. Exit requires all P1 tests and `SEC-10…SEC-12`, `SEC-21…SEC-26` green.

### WP4 — Local RAG 2.0

**Implementation surface:** split the monolithic Rust workspace responsibilities into focused modules (`document_parser_zone`, `knowledge_index`, `vector_index`, `evidence_store`) without changing public behavior until tests cover each seam.

**Tasks:**

1. Add parser-zone adapters for md/txt first, then PDF/HTML/code as individually gated formats; enforce schema, byte/token/time/memory limits and malformed-document fuzzing.
2. Add SQLite metadata/FTS5, deterministic chunk IDs, source offsets, and versioned index tables. Keep embedding calls exclusively on Ollama `/api/embed` with batched input, `truncate: false`, explicit `keep_alive`, model digest, dimensions, and index version.
3. Implement dense retrieval, lexical retrieval, reciprocal-rank/weighted fusion, optional rerank hook, deduplication, confidence, and claim-to-Evidence spans. A stale or mismatched vector index is `stale`, never silently mixed.
4. Implement rebuild/resume/cancel/rollback, memory-aware batch sizing, 10k/50k/100k × 384/768/1024 VectorIndexBackend runs, and source-locator UI. The WP0 feasibility harness is not a product performance claim.

**Tests and exit:** parser fuzz/resource tests, digest/dimension mismatch tests, hybrid ranking goldens, source-span verification, cancellation/rebuild recovery, and the formal matrix. Exit requires the P2 local-RAG thresholds from the Spec.

### WP5 — Web Research

**Implementation surface:** add a small native research provider boundary; retain OpenClaw only as an adapter. Do not extend the old keyword planner as the primary path.

**Tasks:**

1. Run independent providers concurrently with bounded deadlines, cancellation, per-provider quotas, cache TTL, and stale-cache labels.
2. Normalize result identity, canonical URL, title, publication/update time, author, content type, retrieval time, and extraction confidence.
3. Use safe fetching with redirect/size/content-type limits, parser zone, robots/credential rules, and no arbitrary page execution.
4. Classify query freshness and required source diversity; rank by time/relevance/provider agreement and bind every displayed claim to Evidence spans.
5. Keep unavailable/contradictory sources visible; never fabricate current facts or silently fall back to old cached content.

**Tests and exit:** provider timeout/partial failure, stale cache, date extraction, duplicate canonicalization, prompt injection in pages, claim-to-evidence, and P2 freshness/relevance goldens.

### WP6 — OpenClaw Sidecar

**Tasks:**

1. Generate and review the `2026.8.2` vendor manifest, dependency integrity, Node engine check, start/stop health, backup/restore, and rollback before behavior changes.
2. Complete package-topology and metadata compatibility against actual manifests; missing `llm-runtime` remains an explicit partial alias and missing non-security fields use versioned compatibility parsing.
3. Add an `AdvancedRuntime` sidecar protocol with lifecycle, session visibility/recovery, approvals, credentials, plugin SDK and update events. Disable cloud/channel/node/plugin surfaces not needed by OpenCow.
4. Route every OpenClaw tool/exec/approval event through CowCore Capability/Grant and Certified Sandbox; direct host execution is impossible even if Sidecar is compromised at the protocol boundary.
5. Keep the migration rollback switch and prove P0 still works with Sidecar stopped.

**Tests and exit:** vendor/manifest tests, sidecar lifecycle/recovery, protocol fuzz, capability projection, approval/credential isolation, sandbox routing, and P0-offline parity. Exit requires no P0 regression and the WP6 security evaluation green.

### WP7 — Migration, soak, and release

**Tasks:**

1. Add JSON→SQLite migrations with preflight, backup, checksum, resumability, rollback, and idempotent rerun. Never mutate user data irreversibly in place.
2. Run macOS/Windows install, upgrade, uninstall, low-memory, low-disk, offline, Ollama-missing, and sandbox-missing scenarios.
3. For every new Ollama stable, run the compatibility pipeline: native API, streaming, Schema, tools, thinking, embedding, cancellation, Profile, Fast Lane, RAG, cache, and Apple Silicon path; update the recommendation range only after all pass.
4. Run long-session, memory-pressure, cancellation, crash-journal, index rebuild, and authorization-revocation soak tests. Review UX for runtime, sandbox, grant, memory, and Evidence status.
5. Produce release notes, threat-model delta, migration guide, signed artifacts, rollback rehearsal, and the `dev`→`main` merge approval record.

**Exit:** full workspace/Rust tests, build, encoding, health, P0/P1/P2 evals, platform matrix, security review, rollback rehearsal, and install smoke all pass. Only then merge `dev` to `main`.

### Per-work-package evidence bundle

Each WP exit must attach, in its milestone commit or release artifact:

1. exact source/model/runtime versions and digests;
2. focused test output and full-gate output;
3. benchmark/eval JSON with schema version and hardware metadata;
4. feature-flag state and rollback command;
5. known ceilings (never hidden by timeout increases) and the next permitted work package.

The current pass implements additive WP1 core, gate, interaction-smoothness, profile persistence, and WP1C memory slices only; it does not claim the WP1A/WP1B/WP1C exits or enable new host effects. Remaining WP1 exit work is production native-runtime wiring behind `cowcoreFastLane`, verified local-only lifecycle/configuration, actual runtime sample capture, the required 8K-token cache continuation benchmark, and WP1C formal 10-case/native-desktop/migration evidence. WP2–WP7 remain gated by the dependency order above.
