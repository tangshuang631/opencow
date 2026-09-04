# WP1 Core Slice Regression Evidence

> Captured: 2026-09-04 (Asia/Shanghai)
>
> Scope: additive WP1A/WP1B core slice on `dev`; this is not a WP1A/WP1B exit claim.

## Source and runtime

| Field | Value |
| --- | --- |
| Branch | `dev` |
| Ollama | `0.33.2` |
| Chat model | `qwen3.5:9b` |
| Embedding model | `qwen3-embedding:8b-q4_K_M` |
| Host | macOS Apple Silicon, arm64, 24 GiB unified memory |
| Local endpoint | `http://127.0.0.1:11434` |
| Locality | Loopback transport; CowCore still blocks when cloud policy is unverified |

## Verified implementation surface

- `@opencow/cowcore`: native `/api/version`, `/api/tags`, `/api/show`, `/api/ps`, streaming `/api/chat`, `/api/embed`, locality enforcement, residency observation, adaptive context budget, stable prefix serializer, keep-alive policy, TaskClass router, zero-effect typed-tool loop, and Fast Lane orchestration.
- `apps/desktop/src/features/ollama/ollamaNativeProfile.ts`: additive runtime/model/locality profile wrapper; legacy service remains the compatibility seam.
- UI: deterministic conversation motion scope, reduced-motion guard, stable streaming conversation rendering, and Codex-inspired sidebar/inspector styling. No host execution capability is connected.

## Regression commands

| Command | Result |
| --- | --- |
| `npm run test:unit` | pass: 1,005 tests across packages, desktop, and web |
| `cargo test` (`apps/desktop/src-tauri`) | pass: 94 tests |
| `npm run build` | pass; first-build dependency order verified with CowCore `dist` removed |
| `npm run check:encoding` | pass |
| `npm run test:scripts` | pass: 22 tests |
| `npm run eval:wp0` | ready: 380 fixture cases (P0 130 / P1 150 / P2 100) |
| `npm run benchmark:vector` | pass: locked feasibility matrix, product backend intentionally not claimed |
| `npm run benchmark:ollama` | measured: native chat cold/warm and batched embedding; see Ollama embedding baseline |
| `npm run check:health` | pass after final macOS desktop sync |

## Browser smoke

Using the Playwright CLI against `npm --workspace apps/web run dev`:

1. Loaded the workbench and verified the sidebar, conversation, composer, inspector, favicon, and no console errors.
2. Sent `解释一下什么是向量数据库` to the selected local Ollama model.
3. Observed the user entry immediately, streamed local answer content, completed the task checklist, and rendered the output panel.
4. Confirmed no host process, MCP start, project run, shell capability, or external search was invoked.

Screenshots were kept as local QA artifacts under `output/playwright/`; they are not product data and are not required for runtime behavior.

## Known ceilings and next gate

- CowCore is additive; ordinary production chat is not yet switched to `cowcoreFastLane` because managed/external Ollama local-only lifecycle and cloud policy verification are not wired.
- `performanceProfiles` and metrics persistence, cache continuation benchmark, and WP1C SQLite memory MVP remain open.
- Model-specific MLX/MTP/DFlash behavior remains Ollama-owned; CowCore observes metadata and measured performance only.
- No WP2 registry/grant or WP3 sandbox/Host Apply work is enabled. The next permitted slice is WP1 runtime lifecycle/flag wiring, not host execution.
