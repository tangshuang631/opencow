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
