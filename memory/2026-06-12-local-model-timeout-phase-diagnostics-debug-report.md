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
