# WP1 Core Slice Regression Evidence

> Captured: 2026-09-04 (Asia/Shanghai)
>
> Scope: additive WP1A/WP1B core slice on `dev`; this is not a WP1A/WP1B exit claim.

## Source and runtime

| Field | Value |
| --- | --- |
| Branch | `dev` |
| Ollama | `0.33.3` (local runtime observed on 2026-09-04) |
| Chat model | `gemma4:12b-mlx` (selected by current local tags) |
| Embedding model | `qwen3-embedding:8b-q4_K_M` |
| Host | macOS Apple Silicon, arm64, 24 GiB unified memory |
| Local endpoint | `http://127.0.0.1:11434` |
| Locality | Loopback transport; CowCore still blocks when cloud policy is unverified |

Latest same-host native baseline (one sampled run; not a release threshold): cold total `1,290.94ms` / load `2.62ms` / prompt `16.05 tok/s` / decode `19.72 tok/s`; warm total `135.57ms` / load `11.45ms` / decode `17.45 tok/s`; cache continuation candidate ratio `0.356` (`293.32ms → 104.37ms`, stable prefix `115` chars); embedding `3,022.84ms`, dimension `4,096`. Cold and warm values are kept separate and all measurements are machine-state dependent.

## Verified implementation surface

- `@opencow/cowcore`: native `/api/version`, `/api/tags`, `/api/show`, `/api/ps`, streaming `/api/chat`, `/api/embed`, locality enforcement, residency observation, adaptive context budget, stable prefix serializer, keep-alive policy, TaskClass router, zero-effect typed-tool loop, fail-closed runtime gate, performance-profile collector, and Fast Lane orchestration.
- `apps/desktop/src/features/ollama/ollamaNativeProfile.ts`: additive runtime/model/locality profile wrapper; legacy service remains the compatibility seam.
- UI: deterministic conversation motion scope, reduced-motion guard, stable streaming conversation rendering, and Codex-inspired sidebar/inspector styling. The WP1C memory slice adds an opt-in settings panel and a bounded untrusted dynamic suffix without changing the visual system. No host execution capability is connected.

## Regression commands

| Command | Result |
| --- | --- |
| `npm run test:unit` | pass: 1,027 tests across packages, desktop, and web |
| `cargo test` (`apps/desktop/src-tauri`) | pass: 102 tests |
| `npm run build` | pass; first-build dependency order verified with CowCore `dist` removed |
| `npm run check:encoding` | pass |
| `npm run test:scripts` | pass: 24 tests |
| `npm run eval:wp0` | ready: 380 fixture cases (P0 130 / P1 150 / P2 100) |
| `npm run benchmark:vector` | pass: locked feasibility matrix, product backend intentionally not claimed |
| `npm run benchmark:ollama` | measured: native chat cold/warm and batched embedding; see Ollama embedding baseline |
| `npm run check:health` | pass after final macOS desktop sync |

## Browser smoke

Using the Playwright CLI against `npm --workspace apps/web run dev`:

1. Loaded the workbench and verified the sidebar, conversation, composer, inspector, favicon, and no console errors.
2. Sent `用一句话说明什么是本地优先应用` to the selected local Ollama model.
3. Observed the user entry immediately, streamed local answer content, completed the task checklist, and rendered the output panel.
4. Opened Settings, verified the cross-session memory toggle is off by default, enabled it in browser preview (which reported the expected desktop-only boundary), disabled it again, and confirmed no console errors.
5. Confirmed no host process, MCP start, project run, shell capability, or external search was invoked.

Screenshots were kept as local QA artifacts under `output/playwright/`; they are not product data and are not required for runtime behavior.

## Known ceilings and next gate

- CowCore is additive; ordinary production chat is not yet switched to `cowcoreFastLane` because managed/external Ollama local-only lifecycle and cloud policy verification are not wired.
- The gate is now enforced inside `runFastLane`; default flags remain off. `performanceProfiles` persistence, the required 8K-token cache continuation benchmark, and WP1C formal evaluation/native-desktop/migration evidence remain open.
- WP1C implementation is present but remains behind the opt-in flag. Native commands enforce explicit top-level-user authority, sensitive-content rejection, user/workspace scope and expiry/revocation filters, and audit metadata without storing memory content. Prompt injection is bounded to an untrusted/none-authority suffix; the formal memory evaluation and native desktop E2E are still required before calling WP1C complete.
- The current local baseline moved to Ollama `0.33.3` and `gemma4:12b-mlx`; this is evidence only, not a hard-coded compatibility requirement. The `qwen3-embedding:8b-q4_K_M` candidate remains the separate embedding baseline.
- The cache continuation harness now keeps a deterministic stable prefix ahead of changing user content and reports `candidate-hit` only when repeated `prompt_eval_duration / cold prompt_eval_duration <= 0.70`. The latest local sample was `0.356` (`293.32ms → 104.37ms`, 115 prefix characters); it is a candidate observation, not an 8K-token release claim.
- Model-specific MLX/MTP/DFlash behavior remains Ollama-owned; CowCore observes metadata and measured performance only.
- No WP2 registry/grant or WP3 sandbox/Host Apply work is enabled. The next permitted slice is WP1 runtime lifecycle/flag wiring, not host execution.
