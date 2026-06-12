## DEBUG REPORT

- Symptom: Local-model timeout failures still looked vague. Even after adding pending heartbeat text, a failure could still collapse into a generic timeout-style message, so users could not tell whether Ollama never produced the first chunk or whether it started streaming and then stalled before completion.
- Root cause: `apps/desktop/src/app/App.tsx` tracked `hasReceivedFirstChunk` only for pending progress rendering, but that phase information was discarded when constructing the final failure detail. The visible fallback copy in the conversation also did not surface the difference between "waiting for first chunk" and "already streaming".
- Fix: Updated [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx) to include `streamPhase`, `elapsedMs`, and `firstChunkAfterMs` in local-model failure diagnostics, while recording the first non-empty chunk arrival timestamp. Updated [apps/desktop/src/features/workbench/workbenchText.ts](E:/2026/opencow/apps/desktop/src/features/workbench/workbenchText.ts) and [apps/desktop/src/features/workbench/components/MainConversation.tsx](E:/2026/opencow/apps/desktop/src/features/workbench/components/MainConversation.tsx) so the default visible error can explain whether the model never produced the first output or started streaming and then failed to finish.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.chat.test.tsx` passed with 46 tests.
  - `npm --workspace apps/desktop exec vitest run src/features/workbench/components/MainConversation.test.tsx src/app/app.chat.test.tsx` passed with 74 tests.
  - `npm run verify:all` passed, including 577 desktop tests, repository build, encoding check, health check, and 71 desktop tauri tests.
- Regression test: `apps/desktop/src/app/app.chat.test.tsx`
- Related: This extends the anti-stall local-model mainline after the earlier slow-start pending-state work, and gives future timeout recovery or local-model explanation flows a cleaner phase signal to build on.
- Status: DONE

## Follow-up: workspace overview local-model explanation guard

- Symptom: After routing workspace overview answers through the local model, two task-guard regressions appeared: malformed assistant execution results no longer surfaced the expected "Invalid local assistant execution result" diagnostic, and a successful readonly workspace overview could remain pending while optional model explanation ran.
- Root cause: The optional local-model explanation path consumed the raw `executeAssistantTask` result before `assertValidAssistantTaskExecutionResult` validated it. It also replaced the fallback title with a generic title when the local-model bridge was unavailable in test/runtime mocks.
- Fix: Updated [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx) so generic assistant execution validates the raw result first, only runs workspace-overview explanation after a valid readonly result exists, preserves the original safe result when explanation is unavailable or fails, and keeps audit detail for skipped explanation.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.task-guard.test.tsx -- --testNamePattern "malformed local assistant execution results|clears the local execution timeout guard after an executed task succeeds"` passed.
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/app/app.chat.test.tsx src/app/app.task-guard.test.tsx src/features/workbench/components/MainConversation.test.tsx` passed with 159 tests.
  - `npm run verify:all` passed, including 579 desktop tests, repository build, encoding check, health check, and 71 desktop tauri tests.
- Regression test: `apps/desktop/src/app/app.task-guard.test.tsx`
- Related: This preserves the model-first answer direction for ordinary/explain outputs without weakening malformed-result diagnostics, task timeout cleanup, or permission-guard recovery behavior.
- Status: DONE

## Follow-up: packages/config readonly overviews also use local-model explanation

- Symptom: `packages-overview` and `workspace-config-overview` still returned fixed readonly summaries directly, while `workspace-overview` had already moved to "readonly facts + local-model explanation". This left ordinary inspection-style answers inconsistent and more template-like than the product goal.
- Root cause: The optional explanation hook in [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx) was hard-coded to `workspace-overview`, so package and config inspection tasks never asked the selected local model to explain the readonly facts.
- Fix: Generalized the explanation hook to `workspace-overview`, `packages-overview`, and `workspace-config-overview`. Each still validates the assistant task result first, keeps the original readonly result when the model is unavailable or fails, and uses a focused Chinese prompt so the model explains package/script or config/root-script facts instead of emitting fixed overview copy.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/app/app.task-guard.test.tsx` passed with 83 tests.
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/app/app.chat.test.tsx src/app/app.task-guard.test.tsx src/features/workbench/components/MainConversation.test.tsx` passed with 159 tests.
  - `npm run verify:all` passed, including 579 desktop tests, repository build, encoding check, health check, and 71 desktop tauri tests.
- Regression test: `apps/desktop/src/app/app.test.tsx`
- Related: This further reduces fixed/template-like ordinary inspection answers while preserving the anti-stall fallback behavior and readonly safety boundary.
- Status: DONE

## Follow-up: capability overviews use local-model explanation

- Symptom: OpenClaw capability catalog tasks such as `capability-rag-overview` still surfaced fixed catalog copy (`OpenClaw RAG capability overview`) in ordinary inspection flows, even after workspace/packages/config overviews moved to readonly facts plus local-model explanation.
- Root cause: The App-level explanation hook only recognized workspace/package/config overview kinds. Capability overview tasks already collected readonly facts safely, but the final user-facing response bypassed the selected local model.
- Fix: Extended the explainable readonly result kinds in [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx) to include RAG, Skills, NPC, and MCP capability overviews. Each gets a focused Chinese explanation title and prompt while preserving the original readonly result if the local model bridge is unavailable or fails.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/app/app.task-guard.test.tsx` passed with 84 tests.
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/app/app.chat.test.tsx src/app/app.task-guard.test.tsx src/features/workbench/components/MainConversation.test.tsx src/features/assistant/assistantTaskService.capabilities.test.ts` passed with 166 tests.
  - `npm run verify:all` passed, including 580 desktop tests, repository build, encoding check, health check, and 71 desktop tauri tests.
- Regression test: `apps/desktop/src/app/app.test.tsx`
- Related: This keeps RAG retry self-check readonly and recoverable while reducing fixed/template-like capability answers in explicit capability inspection flows.
- Status: DONE

## Follow-up: network search guidance uses local-model explanation and audit-only facts

- Symptom: Explicit web/latest search requests that reach `network-search-guidance` still exposed fixed English guidance such as "No external network search was run" in the main conversation. When the explanation hook was extended, raw readonly facts could also leak into the main conversation detail lines.
- Root cause: `network-search-guidance` was not part of the App-level readonly explanation hook, and `auditDetailLines` were used for both main conversation details and audit detail. That made raw execution facts visible in the default conversation surface even when the model-generated answer was present.
- Fix: Added `network-search-guidance` to the explainable readonly result kinds in [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx). Added `auditOnlyDetailLines` to [apps/desktop/src/features/assistant/assistantTaskService.ts](E:/2026/opencow/apps/desktop/src/features/assistant/assistantTaskService.ts) and [apps/desktop/src/features/workbench/workbenchState.tasks.ts](E:/2026/opencow/apps/desktop/src/features/workbench/workbenchState.tasks.ts), so raw readonly facts stay in audit while the main conversation shows the local-model explanation.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/app/app.task-guard.test.tsx src/features/assistant/assistantTaskService.rag-search.test.ts src/features/workbench/taskQueueState.test.ts` passed with 135 tests.
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/app/app.chat.test.tsx src/app/app.task-guard.test.tsx src/features/workbench/components/MainConversation.test.tsx src/features/workbench/taskQueueState.test.ts src/features/assistant/assistantTaskService.rag-search.test.ts` passed with 211 tests.
  - `npm run verify:all` passed, including 582 desktop tests, repository build, encoding check, health check, and 71 desktop tauri tests.
- Regression test: `apps/desktop/src/app/app.test.tsx`
- Related: This preserves the required capability approval and provider-configuration gate for network search, while making the visible response model-generated and keeping raw diagnostics audit-only.
- Status: DONE

## Follow-up: explicit local RAG results use local-model explanation without weakening overflow recovery

- Symptom: Explicit local RAG and Skill-assisted RAG requests still surfaced the deterministic retrieval summary as the final visible answer. That was traceable, but it felt like another fixed result path rather than a model-explained answer.
- Root cause: The App-level readonly explanation hook covered workspace/package/config/capability/network guidance, but not `rag-local-doc-search` or `skills-local-enabled-rag-doc-search`.
- Fix: Added both RAG result kinds to the readonly explanation hook in [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx). The prompt now asks the selected local model to explain the retrieved local facts, sources, limits, and next steps. Raw RAG facts remain available as audit-only detail through the existing successful-task path.
- Safety boundary: Context-length local-model failures that auto-route into readonly RAG intentionally skip this second local-model explanation. This preserves the anti-stall rule that overflow recovery must not immediately call Ollama again.
- Extra guard: Added an App-level regression for a late underlying task rejection after timeout, proving it cannot overwrite the visible timeout failure with a new confusing error.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/app/app.task-guard.test.tsx` passed with 86 tests.
  - `npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.rag-search.test.ts src/features/assistant/assistantTaskService.skills-rag.test.ts` passed with 11 tests.
  - `npm --workspace apps/desktop exec vitest run src/app/app.chat.test.tsx src/app/app.test.tsx src/app/app.task-guard.test.tsx` passed with 132 tests.
  - `npm --workspace apps/desktop run test:unit` passed with 583 tests.
  - `npm run build`, `npm run check:encoding`, and `npm run check:health` passed.
  - `npm run verify:all` passed, including 583 desktop tests, repository build, encoding check, health check, and 71 desktop tauri tests.
- Regression tests: `apps/desktop/src/app/app.test.tsx`, `apps/desktop/src/app/app.chat.test.tsx`, `apps/desktop/src/app/app.task-guard.test.tsx`
- Related: This moves more ordinary readonly output through the local model while keeping context-overflow recovery bounded and non-looping.
- Status: DONE

## Follow-up: enabled Skills readback and matching use local-model explanation

- Symptom: Explicit enabled Skills list and recommendation requests returned deterministic registry summaries such as enabled count, registry path, and recommended skill directly in the main conversation. The facts were useful, but the visible answer still felt like a fixed readback path.
- Root cause: `skills-local-enabled-list` and `skills-local-enabled-match` were not included in the App-level readonly explanation hook, even though they are readonly user-facing information tasks.
- Fix: Added both execution kinds to the local-model explanation hook in [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx). The visible answer now asks the selected local model to explain enabled Skill purpose, matching rationale, registry location, next steps, and permission boundaries from readonly facts.
- Safety boundary: The underlying `assistantTaskService` still returns structured registry and matching facts. The App-level model explanation is only applied after the readonly facts exist, so install/enable/disable mutations and shell execution remain gated by the existing permission chain.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx` passed with 27 tests.
  - `npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.skills-enabled-list.test.ts src/features/assistant/assistantTaskService.skills-enabled-match.test.ts` passed with 4 tests.
  - `npm --workspace apps/desktop exec vitest run src/app/app.chat.test.tsx src/app/app.task-guard.test.tsx src/app/app.chat-search-context.test.tsx src/app/app.chat-search-empty-context.test.tsx` passed with 108 tests.
  - `npm run build`, `npm run check:encoding`, and `npm run check:health` passed.
  - `npm run verify:all` passed, including 583 desktop tests, repository build, encoding check, health check, and 71 desktop tauri tests.
- Regression tests: `apps/desktop/src/app/app.test.tsx`, `apps/desktop/src/features/assistant/assistantTaskService.skills-enabled-list.test.ts`, `apps/desktop/src/features/assistant/assistantTaskService.skills-enabled-match.test.ts`
- Related: This removes another ordinary readonly fixed-output path while keeping the registry facts auditable and bounded.
- Status: DONE

## Follow-up: local Skill scan and detail readbacks use local-model explanation

- Symptom: Explicit local Skill inventory and Skill detail requests still surfaced deterministic scan/detail strings directly in the main conversation, including raw names, enabled flags, descriptions, and previews.
- Root cause: `skills-local-scan` and `skills-local-inspect` were readonly user-facing information tasks, but they were not part of the App-level readonly explanation hook.
- Fix: Added both execution kinds to [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx). The selected local model now explains scanned local Skills, enabled status, intended use, content preview, and safe next steps from readonly facts instead of showing field-concatenated summaries as the final answer.
- Safety boundary: The desktop assistant service still returns structured scan/detail facts, and mutation paths such as install, enable, disable, shell execution, and NPC config writes remain outside this readonly explanation hook.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx` passed with 28 tests.
  - `npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.skills-scan.test.ts src/features/assistant/assistantTaskService.skills-inspect.test.ts` passed with 4 tests.
  - `npm --workspace apps/desktop exec vitest run src/app/app.chat.test.tsx src/app/app.task-guard.test.tsx src/features/assistant/assistantTaskService.skills-enabled-list.test.ts src/features/assistant/assistantTaskService.skills-enabled-match.test.ts src/features/assistant/assistantTaskService.skills-rag.test.ts` passed with 112 tests.
  - `npm run verify:all` passed, including 584 desktop tests, repository build, encoding check, health check, and 71 desktop tauri tests.
- Regression tests: `apps/desktop/src/app/app.test.tsx`, `apps/desktop/src/features/assistant/assistantTaskService.skills-scan.test.ts`, `apps/desktop/src/features/assistant/assistantTaskService.skills-inspect.test.ts`
- Related: This further reduces ordinary fixed readback paths while preserving auditable local Skill facts and permission-gated mutations.
- Status: DONE

## Follow-up: local-model timeout task details avoid misleading mapping recovery

- Symptom: A waiting-first-chunk local model failure could show the correct Chinese timeout detail in the main conversation while the right-side local task failure details still suggested checking `assistantTaskService` result mapping. That was misleading for real Ollama stalls.
- Root cause: The Inspector task-list failure details rendered `lastFailureActionLabel` through generic normalization. If an older or fallback action label contained the generic result-mapping hint, the local-model-specific timeout phase diagnostics did not override it.
- Fix: Added source-aware Inspector recovery labels for `local_model_chat_runner`, using `streamPhase=waiting-first-chunk`, `streamPhase=streaming`, and timeout diagnostics to show concrete Chinese Ollama recovery guidance. The raw diagnostic detail remains available in expanded failure details for debugging.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/features/workbench/components/Inspector.test.tsx` passed with 33 tests.
  - `npm --workspace apps/desktop exec vitest run src/features/workbench/components/Inspector.test.tsx src/features/workbench/components/MainConversation.test.tsx src/app/app.chat.test.tsx src/app/app.task-guard.test.tsx` passed with 168 tests.
  - `npm run verify:all` passed, including 584 desktop tests, repository build, encoding check, health check, and 71 desktop tauri tests.
- Regression tests: `apps/desktop/src/features/workbench/components/Inspector.test.tsx`, `apps/desktop/src/app/app.task-guard.test.tsx`
- Related: This keeps timeout failures recoverable and Chinese-first, without hiding the low-level Ollama diagnostics needed for deeper troubleshooting.
- Status: DONE

## Follow-up: readonly MCP plugin outputs use local-model explanation

- Symptom: Explicit readonly MCP plugin requests such as local plugin scan, plugin detail lookup, and start preview still surfaced deterministic English summaries like `Local MCP plugin scan` or `No resolved executable launcher` directly in the main conversation.
- Root cause: `mcp-local-plugin-scan`, `mcp-local-plugin-inspect`, and `mcp-local-plugin-start-preview` were safe readonly information tasks, but they were not part of the App-level readonly explanation hook.
- Fix: Added those three execution kinds to [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx). The selected local model now explains MCP plugin inventory, manifest details, activation/tool/Skill boundaries, and start-preview limitations from readonly facts. The real controlled `mcp-local-plugin-start` path remains outside this hook and still requires permission and dangerous confirmation.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx` passed with 31 tests.
  - `npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.capabilities.test.ts` passed with 6 tests.
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/app/app.chat.test.tsx src/app/app.task-guard.test.tsx src/app/app.mcp-start.test.tsx src/features/workbench/components/MainConversation.test.tsx` passed with 167 tests.
  - `npm run verify:all` passed, including 587 desktop tests, repository build, encoding check, health check, and 71 desktop tauri tests.
- Regression tests: `apps/desktop/src/app/app.test.tsx`, `apps/desktop/src/app/app.mcp-start.test.tsx`, `apps/desktop/src/features/assistant/assistantTaskService.capabilities.test.ts`
- Related: This removes another ordinary readonly fixed-output path while keeping MCP process startup gated by the controlled execution chain.
- Status: DONE

## Follow-up: readonly NPC previews use local-model explanation

- Symptom: NPC collaboration and showcase preview flows still surfaced deterministic staged summaries directly in the main conversation, including English labels such as `NPC collaboration preview`, `readonly publish-preview stage`, and `explicit confirmation`.
- Root cause: Several NPC preview execution kinds were safe readonly information tasks but were not included in the App-level readonly explanation hook.
- Fix: Added `npc-local-collaboration-preview`, `npc-local-project-showcase-preview`, `npc-local-project-showcase-publish-preview`, `npc-local-project-showcase-git-confirmation-preview`, and `npc-local-shell-plan-preview` to the local-model explanation hook in [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx). The prompt now asks the selected local model to explain NPC readiness, enabled Skills, local doc evidence, showcase stages, shell-plan permission boundaries, and Git confirmation boundaries from readonly facts.
- Safety boundary: Actual project launch, screenshot capture, showcase-site writes, and git execution are not included in this readonly hook. Those paths remain permission-backed or explicitly confirmable through the existing task guard chain.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/app/app.npc-showcase.test.tsx` passed with 37 tests.
  - `npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-preview.test.ts src/features/assistant/assistantTaskService.npc-showcase.test.ts` passed with 16 tests.
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/app/app.npc-showcase.test.tsx src/app/app.chat.test.tsx src/app/app.task-guard.test.tsx src/features/workbench/components/MainConversation.test.tsx` passed with 172 tests.
  - `npm run verify:all` passed, including 588 desktop tests, repository build, encoding check, health check, and 71 desktop tauri tests.
- Regression tests: `apps/desktop/src/app/app.test.tsx`, `apps/desktop/src/app/app.npc-showcase.test.tsx`, `apps/desktop/src/features/assistant/assistantTaskService.npc-preview.test.ts`, `apps/desktop/src/features/assistant/assistantTaskService.npc-showcase.test.ts`
- Related: This removes another user-visible fixed-output path in the NPC workflow while preserving the safety gates around real local process, artifact, and git side effects.
- Status: DONE

## Follow-up: readonly workspace project status uses local-model explanation

- Symptom: Explicit local project lifecycle status requests still surfaced deterministic fields such as `Matched local project status`, `Command`, `PID`, `Status`, and `Preview` directly in the main conversation.
- Root cause: `workspace-project-status` is a readonly information task, but it was not included in the App-level readonly explanation hook.
- Fix: Added `workspace-project-status` to [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx). The selected local model now explains the matched project, run command, PID/status, expected URL, preview output, and safe next step from readonly status facts.
- Safety boundary: `workspace-project-run` and `workspace-project-stop` remain outside this hook and still use the existing permission-backed lifecycle chain.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.project-run.test.tsx` passed with 3 tests.
  - `npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.project-status.test.ts src/features/assistant/assistantTaskService.project-run.test.ts src/features/assistant/assistantTaskService.project-stop.test.ts` passed with 6 tests.
  - `npm --workspace apps/desktop exec vitest run src/app/app.project-run.test.tsx src/app/app.test.tsx src/app/app.chat.test.tsx src/app/app.task-guard.test.tsx src/features/workbench/components/MainConversation.test.tsx` passed with 170 tests.
  - `npm run verify:all` passed, including 588 desktop tests, repository build, encoding check, health check, and 71 desktop tauri tests.
- Regression tests: `apps/desktop/src/app/app.project-run.test.tsx`, `apps/desktop/src/features/assistant/assistantTaskService.project-status.test.ts`
- Related: This reduces fixed lifecycle readbacks while preserving permission gates around starting and stopping local processes.
- Status: DONE

## Follow-up: NPC config first-token timeout diagnosis is specific and non-templated

- Symptom: Creating an NPC such as `课程助手npc` could fail after the selected local model connected but did not return a first chunk before the timeout. The visible failure still looked like a generic local task failure and could point users toward result mapping instead of the real Ollama first-token stall.
- Root cause: `npc-config-write` reused the local model chat runner diagnostics, but the failure detail did not include the execution kind. The visible workbench text therefore could not distinguish ordinary local chat timeout from NPC config generation timeout.
- Fix: Added `executionKind=npc-config-write` to local model timeout diagnostics in [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx), then made [apps/desktop/src/features/workbench/workbenchText.ts](E:/2026/opencow/apps/desktop/src/features/workbench/workbenchText.ts) and [apps/desktop/src/features/workbench/components/Inspector.tsx](E:/2026/opencow/apps/desktop/src/features/workbench/components/Inspector.tsx) show NPC-specific Chinese title, detail, concise output, and recovery guidance for waiting-first-chunk and streaming timeouts.
- Safety boundary: The assistant still does not write NPC config unless the selected local model returns content and the existing permission-approved write path succeeds. No fixed NPC template or fake success fallback was introduced.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx -t "surfaces NPC config first-token" --pool forks --poolOptions.forks.singleFork` passed with the full `app.test.tsx` file reporting 33 tests passed.
  - `npm --workspace apps/desktop exec vitest run src/features/workbench/components/Inspector.test.tsx src/features/workbench/workbenchState.conversation.test.ts --pool forks --poolOptions.forks.singleFork` passed with 37 tests.
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/app/app.chat.test.tsx src/app/app.task-guard.test.tsx src/features/workbench/components/MainConversation.test.tsx src/features/workbench/components/Inspector.test.tsx --pool forks --poolOptions.forks.singleFork` passed with 201 tests.
  - `npm --workspace packages/openclaw-adapter run build` passed, confirming the startup-blocking adapter TypeScript build no longer reproduces.
  - `npm run verify:all` passed, including 589 desktop tests, repository build, encoding check, health check, and 71 desktop tauri tests.
- Regression test: `apps/desktop/src/app/app.test.tsx`
- Related: This keeps the user-facing path model-first for NPC creation while making the no-first-token failure actionable, auditable, Chinese-first, and explicit that no config was written.
- Status: DONE

## Follow-up: readonly shell success outputs use local-model explanation

- Symptom: Successful readonly shell diagnostics such as git status could still surface fixed concatenated text like `Command: git status --short` and `Preview: ...` as the main assistant answer.
- Root cause: `readonly-shell-git-status`, `readonly-shell-workspace-root`, and `readonly-shell-packages-dir` were supported readonly execution kinds, but they were not included in the App-level readonly explanation hook.
- Fix: Added all three readonly shell success kinds to the local-model explanation hook in [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx). The prompt now asks the selected local model to explain the readonly shell diagnostic, why no write was performed, and the safe next step from the raw facts.
- Safety boundary: This only changes successful readonly presentation. Shell mutations, workspace-write commands, controlled-full commands, permission approval, dangerous confirmation, audit details, and retry self-check behavior remain unchanged.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx -t "readonly shell git status" --pool forks --poolOptions.forks.singleFork` passed with 34 tests.
  - `npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.shell.test.ts src/app/app.task-guard.test.tsx --pool forks --poolOptions.forks.singleFork` passed with 64 tests.
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/app/app.chat.test.tsx src/app/app.task-guard.test.tsx src/features/workbench/components/MainConversation.test.tsx src/features/workbench/components/Inspector.test.tsx --pool forks --poolOptions.forks.singleFork` passed with 202 tests.
  - `npm run verify:all` passed, including 590 desktop tests, repository build, encoding check, health check, and 71 desktop tauri tests.
- Regression test: `apps/desktop/src/app/app.test.tsx`
- Related: This removes another ordinary fixed readonly output path while keeping shell execution auditable and permission-bounded.
- Status: DONE

## Follow-up: readonly local-model explanations cannot stall successful tasks

- Symptom: After a readonly shell task succeeded, the optional local-model explanation could hang indefinitely until the broader local task timeout. In that case the user saw a failed local task even though the underlying readonly diagnostic, such as `git status --short`, had already completed successfully.
- Root cause: The readonly explanation pass shared the parent local task cancellation path and had no shorter per-explanation time budget. A selected Ollama model that connected but never produced explanation output could therefore block the visible completion of an otherwise successful readonly result.
- Fix: Added a dedicated 10-second explanation timeout in [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx). The explanation now runs with a child `AbortController`, cancels the specific Ollama explanation request on timeout or parent abort, and lets the existing fallback render the original readonly facts instead of marking the successful task as failed.
- Safety boundary: This only affects optional presentation for already-completed readonly tasks. Permission requests, shell writes, controlled-full commands, workspace project start/stop, MCP plugin start, and NPC config writes still use their existing guarded execution paths.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx -t "falls back to readonly shell facts" --pool forks --poolOptions.forks.singleFork` passed with 35 tests reported.
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/app/app.chat.test.tsx src/app/app.task-guard.test.tsx src/features/workbench/components/MainConversation.test.tsx src/features/workbench/components/Inspector.test.tsx --pool forks --poolOptions.forks.singleFork` passed with 203 tests.
  - `npm run verify:all` passed, including 591 desktop tests, repository build, encoding check, health check, and 71 desktop Tauri tests.
- Regression test: `apps/desktop/src/app/app.test.tsx`
- Related: This keeps the product model-first for safe readonly explanations without allowing a slow local model to make OpenCow feel frozen.
- Status: DONE

## Follow-up: RAG shell handoff previews use local-model explanation without bypassing permission

- Symptom: RAG-to-shell handoff previews were correctly treated as readonly continuation previews, but their visible result could still surface deterministic handoff summaries such as command preview, required permission, and safety status directly in the main conversation.
- Root cause: `rag-local-shell-handoff-preview`, `skills-local-enabled-rag-shell-handoff-preview`, and `npc-local-enabled-rag-shell-handoff-preview` were already supported preview task kinds and continuation kinds, but they were not part of the App-level explainable readonly result whitelist.
- Fix: Added all three handoff preview kinds to the local-model explanation hook in [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx). Their prompts now ask the selected local model to explain the local RAG evidence, shell handoff plan, suggested command, permission level, and explicitly state that no command was executed and continuation still requires permission approval and any high-risk confirmation.
- Safety boundary: Only the readonly preview presentation changed. The stored preview continuation metadata is unchanged, and the regression test proves that sending `继续` after the model-explained preview still surfaces `批准提权` without calling the workspace-write shell runner.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx -t "local RAG shell handoff" --pool forks --poolOptions.forks.singleFork` passed with 36 tests reported.
  - `npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.skills-rag-shell-handoff.test.ts src/features/assistant/assistantTaskService.npc-shell-preview.test.ts --pool forks --poolOptions.forks.singleFork` passed with 8 tests.
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/app/app.task-guard.test.tsx src/app/app.continuation-message.test.ts src/features/workbench/taskQueueMetadata.test.ts src/features/workbench/components/MainConversation.test.tsx --pool forks --poolOptions.forks.singleFork` passed with 146 tests.
  - `npm run verify:all` passed, including 592 desktop tests, repository build, encoding check, health check, and 71 desktop Tauri tests.
- Regression test: `apps/desktop/src/app/app.test.tsx`
- Related: This removes another ordinary fixed-output preview path while preserving the controlled permission chain around real shell execution.
- Status: DONE

## Follow-up: OpenCow self-repair previews use local-model explanation

- Symptom: Successful `opencow-self-repair-preview` tasks were safe readonly previews, but the main conversation could still show deterministic preview text such as config files, root scripts, RAG matches, and suggested repair flow directly.
- Root cause: `opencow-self-repair-preview` was in the continuation-preview set, but it was not included in the App-level explainable readonly result whitelist. The service returned useful structured facts, yet the visible response did not pass through the selected local model.
- Fix: Added `opencow-self-repair-preview` to the local-model explanation hook in [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx). The prompt now asks the selected local model to explain the readonly self-repair evidence, likely repair target, why no file was written, and why continuation still requires `workspace-write` permission plus audit/rollback protection.
- Safety boundary: Failed self-repair previews still use the existing failure-analysis path. Successful previews only change presentation; the stored continuation metadata is unchanged, and App regression coverage confirms `继续` still surfaces permission approval before registry repair. Permission cancellation still prevents hidden mutation.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.self-repair.test.tsx --pool forks --poolOptions.forks.singleFork` passed with 5 tests.
  - `npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.self-repair.test.ts src/app/app.continuation-message.test.ts src/app/app.task-guard.test.tsx -t "self-repair|continue|failed self-repair" --pool forks --poolOptions.forks.singleFork` passed with 88 tests.
  - `npm --workspace apps/desktop exec vitest run src/app/app.self-repair.test.tsx src/app/app.test.tsx src/app/app.chat.test.tsx src/app/app.task-guard.test.tsx src/features/workbench/components/MainConversation.test.tsx src/features/workbench/components/Inspector.test.tsx --pool forks --poolOptions.forks.singleFork` passed with 209 tests.
  - `npm run verify:all` passed, including 592 desktop tests, repository build, encoding check, health check, and 71 desktop Tauri tests.
- Regression test: `apps/desktop/src/app/app.self-repair.test.tsx`
- Related: This removes another high-frequency fixed-output preview while keeping self-repair explicitly staged, permission-scoped, audit-visible, and rollback-visible.
- Status: DONE

## Follow-up: OpenCow self-repair target guidance uses local-model explanation

- Symptom: When the user sent a generic `continue` after a broad self-repair preview, OpenCow correctly stopped the chain instead of looping into hidden repair, but the visible target guidance still surfaced deterministic English text such as `Clarify opencow self-repair target` and fixed next-request examples.
- Root cause: `opencow-self-repair-target-guidance` is a safe readonly guard result, but it was not included in the App-level explainable readonly result whitelist. That left a common recovery guard outside the model-first presentation path.
- Fix: Added `opencow-self-repair-target-guidance` to the local-model explanation hook in [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx). The prompt now asks the selected local model to explain, in Chinese, why generic self-repair cannot continue, why one of the two concrete targets must be chosen, and that no permission escalation or file write happened in this turn.
- Safety boundary: This remains a stop/clarification guard only. The App regression proves the model-explained guidance does not show `批准提权` and does not run hidden registry repair; the raw target guidance facts remain audit-visible and fallback-safe if the model explanation fails or stalls.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.self-repair.test.tsx --pool forks --poolOptions.forks.singleFork` passed with 5 tests.
  - `npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.self-repair.test.ts src/app/app.continuation-message.test.ts src/app/app.task-guard.test.tsx -t "self-repair|continue|failed self-repair" --pool forks --poolOptions.forks.singleFork` passed with 88 tests.
  - `npm --workspace apps/desktop exec vitest run src/app/app.self-repair.test.tsx src/app/app.test.tsx src/app/app.chat.test.tsx src/app/app.task-guard.test.tsx src/features/workbench/components/MainConversation.test.tsx src/features/workbench/components/Inspector.test.tsx --pool forks --poolOptions.forks.singleFork` passed with 209 tests.
  - `npm run verify:all` passed, including 592 desktop tests, repository build, encoding check, health check, and 71 desktop Tauri tests.
- Regression test: `apps/desktop/src/app/app.self-repair.test.tsx`
- Related: This removes another recovery-path fixed output while preserving anti-loop behavior and permission boundaries.
- Status: DONE

## Follow-up: NPC config generation timeout keeps local-model heartbeat and readonly draft recovery

- Symptom: Creating a Chinese NPC such as `课程助手npc` could still appear stuck and then fail after the local model connected but produced no first token before the timeout. The right task rail showed another failed local task, and the suggested recovery still pushed the user toward retrying the same save path rather than first narrowing the NPC as a readonly draft.
- Root cause: `npc-config-write` used the same Ollama runner as ordinary local chat, but the workbench progress and streaming state only recognized `local-model-chat`. That meant NPC config generation discarded the waiting-first-chunk heartbeat and streaming progress. Separately, Chinese NPC draft wording such as `只读草案` was not routed to the readonly NPC preview path, so the timeout recovery suggestion had no reliable safe route.
- Fix: Updated [apps/desktop/src/features/workbench/workbenchState.tasks.ts](E:/2026/opencow/apps/desktop/src/features/workbench/workbenchState.tasks.ts), [apps/desktop/src/features/workbench/components/MainConversation.tsx](E:/2026/opencow/apps/desktop/src/features/workbench/components/MainConversation.tsx), and [apps/desktop/src/features/workbench/components/Inspector.tsx](E:/2026/opencow/apps/desktop/src/features/workbench/components/Inspector.tsx) so `npc-config-write` participates in local-model heartbeat/streaming presentation without duplicating noisy task details in the right rail. Updated [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx) so NPC first-token and streaming timeouts suggest a narrower readonly draft or faster model instead of blind retry. Updated [packages/openclaw-adapter/src/localAssistantPlan.ts](E:/2026/opencow/packages/openclaw-adapter/src/localAssistantPlan.ts) so Chinese NPC `草案/预览/方案/工作流` requests route to the readonly NPC collaboration preview rather than permission-backed config write.
- Safety boundary: The actual NPC config save path is unchanged: no file is written unless the user grants `workspace-write` and the selected local model returns content. The readonly draft route is preview-only and remains eligible for the existing local-model explanation hook.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-preview.test.ts src/features/workbench/components/MainConversation.test.tsx src/features/workbench/components/Inspector.test.tsx --pool forks --poolOptions.forks.singleFork` passed with 71 tests.
  - `npm --workspace packages/openclaw-adapter run build` passed.
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/app/app.chat.test.tsx src/app/app.task-guard.test.tsx src/features/workbench/taskQueueState.test.ts src/features/workbench/components/MainConversation.test.tsx src/features/workbench/components/Inspector.test.tsx --pool forks --poolOptions.forks.singleFork` passed with 249 tests.
  - `npm run verify:all` passed, including 596 desktop tests, repository build, encoding check, health check, and 71 desktop Tauri tests.
- Regression tests: `apps/desktop/src/features/workbench/components/MainConversation.test.tsx`, `apps/desktop/src/features/workbench/components/Inspector.test.tsx`, `apps/desktop/src/features/assistant/assistantTaskService.npc-preview.test.ts`
- Related: This does not make a slow local model produce tokens faster, but it removes the hidden-stall UI gap and gives users a safe readonly draft route before attempting the permission-backed NPC config write again.
- Status: DONE

## Follow-up: NPC timeout recovery copy is consistent between main error and task details

- Symptom: After the NPC config first-token timeout recovery was improved, the main conversation could suggest asking for a readonly NPC draft before retrying the write, but the right-side task details still used the older "shorten/switch model/retry" wording. That made the recovery path feel inconsistent and could still push users back into the same permission-backed write attempt.
- Root cause: [apps/desktop/src/features/workbench/components/Inspector.tsx](E:/2026/opencow/apps/desktop/src/features/workbench/components/Inspector.tsx) has a source-aware local-model failure action override for expanded task details. It did not share the newer NPC timeout wording from [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx).
- Fix: Updated the Inspector local-model failure action labels for `executionKind=npc-config-write` waiting-first-chunk and streaming timeout phases so they match the safer recovery path: no config was written, first ask for a readonly draft or a shorter staged NPC JSON, then save only after direction and permissions are clear.
- Safety boundary: This is presentation-only. It does not retry automatically, does not call the model again, does not grant permission, and does not write NPC config.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/features/workbench/components/Inspector.test.tsx --pool forks --poolOptions.forks.singleFork` passed with 36 tests.
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/features/workbench/components/MainConversation.test.tsx src/features/assistant/assistantTaskService.npc-preview.test.ts --pool forks --poolOptions.forks.singleFork` passed with 72 tests.
- Regression test: `apps/desktop/src/features/workbench/components/Inspector.test.tsx`
- Related: This reduces confusing duplicate-recovery wording around the same local-model timeout event while preserving audit detail and the readonly draft route.
- Status: DONE

## Follow-up: approved self-repair success results use bounded local-model explanation

- Symptom: The self-repair preview and target guidance paths were already model-explained, but the final successful approved repair results for `.opencow/skills/enabled-skills.json` and `.opencow/runtime/workspace-project-runs.json` still surfaced deterministic repaired-path/schema/count summaries directly in the main conversation.
- Root cause: The App-level explanation hook only covered readonly results. The two self-repair mutation kinds were intentionally excluded to avoid bypassing permission, but there was no post-permission explanation path after the repair had already succeeded.
- Fix: Extended [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx) so `opencow-self-repair-enabled-skills-registry` and `opencow-self-repair-workspace-project-runtime-registry` use the same bounded 10-second local-model explanation path after the approved repair completes. The prompt explicitly says the result is not a readonly preview and asks the model to explain the approved repair path, preserved entries/runs, verification result, audit visibility, rollback visibility, and safe next step.
- Safety boundary: Permission is still required before either repair runs. The model explanation happens only after the repair service returns verified success. If the explanation stalls or fails, OpenCow falls back to the original verified repair facts and does not mark the successful task as failed.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.self-repair.test.tsx --pool forks --poolOptions.forks.singleFork` passed with 6 tests.
  - `npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.self-repair.test.ts src/app/app.task-guard.test.tsx -t "self-repair|repair" --pool forks --poolOptions.forks.singleFork` passed with 72 tests.
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/app/app.task-guard.test.tsx src/features/workbench/components/MainConversation.test.tsx src/features/workbench/components/Inspector.test.tsx --pool forks --poolOptions.forks.singleFork` passed with 162 tests.
- Regression test: `apps/desktop/src/app/app.self-repair.test.tsx`
- Related: This moves another user-visible fixed-output success path through the local model without weakening workspace-write permission, audit, rollback, or anti-stall behavior.
- Status: DONE

## Follow-up: NPC config timeout retry switches to readonly draft recovery

- Symptom: After `你能帮我创建一个课程助手npc吗` timed out while waiting for the first local-model token, the UI showed useful Chinese diagnostics but the `重试本地任务` action still risked repeating the same permission-backed NPC config write path.
- Root cause: `handleRetryLocalTask` had special readonly recovery routes for local-model context overflow, RAG failures, and shell self-checks, but `npc-config-write` timeout failures fell through to `createTaskExecutionRetriedState`, which re-queued the same write task.
- Fix: Added an NPC config timeout recovery branch in [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx). When an `npc-config-write` failure includes `streamPhase=waiting-first-chunk`, `streamPhase=streaming`, timeout, or maximum-execution diagnostics, retry now submits a readonly NPC draft request (`npc-local-collaboration-preview`) that preserves the original request and explains role, boundaries, local materials, and the next save step before any config write retry.
- Safety boundary: No NPC config is written during recovery. The branch verifies the planner returns `npc-local-collaboration-preview`; if routing drifts into a permission request or write path, the retry stops with a planning failure instead of executing a hidden mutation.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx -t "recovers NPC config first-token" --pool forks --poolOptions.forks.singleFork --testTimeout 30000` passed with 37 tests reported.
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/features/workbench/components/MainConversation.test.tsx src/features/workbench/components/Inspector.test.tsx src/features/assistant/assistantTaskService.npc-preview.test.ts --pool forks --poolOptions.forks.singleFork` passed with 109 tests.
  - `npm --workspace packages/openclaw-adapter run build` passed.
  - `npm run predesktop:dev` passed.
  - `npm run verify:all` passed, including 599 desktop tests, repository build, encoding check, health check, and 71 desktop Tauri tests.
- Regression test: `apps/desktop/src/app/app.test.tsx`
- Related: This directly addresses the screenshot failure path by turning a repeated slow-model write retry into a safe, model-explained draft-recovery step.
- Status: DONE

## Follow-up: approved Skill enable/disable results use bounded local-model explanation

- Symptom: `skills-local-enable` and `skills-local-disable` correctly required `workspace-write` approval and updated only the enabled Skills registry, but the final visible response still surfaced deterministic service text such as `Enable local skill`, `Disable local skill`, registry path, and status directly.
- Root cause: The App-level result explanation whitelist covered readonly Skill scan/list/match/RAG paths and two approved self-repair mutation paths, but not approved Skill registry enable/disable results. These low-risk mutations therefore remained outside the model-first presentation path even after successful permission-gated execution.
- Fix: Extended [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx) so `skills-local-enable` and `skills-local-disable` use the same bounded local-model explanation hook after the desktop service returns verified success. The prompt now tells the model to explain the approved registry change, registry path, status, safe next step, and explicitly not to imply that the Skill was executed or that the Skill file was deleted.
- Safety boundary: Permission approval is still required before either registry mutation runs. Explanation happens only after `enableLocalSkill` or `disableLocalSkill` succeeds. If the model explanation stalls, the UI falls back to the verified service facts and the successful task is not marked failed.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx -t "skill enable|skill disable|verified skill enable facts" --pool forks --poolOptions.forks.singleFork` passed with 38 tests reported.
  - `npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.skills-enable.test.ts src/features/assistant/assistantTaskService.skills-disable.test.ts --pool forks --poolOptions.forks.singleFork` passed with 4 tests.
  - `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/app/app.task-guard.test.tsx src/features/workbench/components/MainConversation.test.tsx src/features/workbench/components/Inspector.test.tsx --pool forks --poolOptions.forks.singleFork` passed with 164 tests.
  - `npm run predesktop:dev` passed.
  - `npm run verify:all` passed, including 600 desktop tests, repository build, encoding check, health check, and 71 desktop Tauri tests.
- Regression test: `apps/desktop/src/app/app.test.tsx`
- Related: This moves another user-visible fixed-output approved-success path through the local model without weakening permission, audit, rollback, or anti-stall fallback behavior.
- Status: DONE
