## DEBUG REPORT

- Symptom: Local-model ordinary chat could look frozen when Ollama was connected but the first streamed chunk had not arrived yet. The pending UI only showed a generic generating state, which made slow first-token startup indistinguishable from a stalled desktop app.
- Root cause: The local-model progress summary in `apps/desktop/src/app/App.tsx` did not track whether any non-empty streamed chunk had been received. As a result, the UI could only render one generic "still generating" phase instead of distinguishing "connected but still waiting for first output" from "already streaming".
- Fix: Updated `formatLocalModelProgressSummary` in [apps/desktop/src/app/App.tsx](E:/2026/opencow/apps/desktop/src/app/App.tsx) to accept `hasReceivedFirstChunk`, tracked that flag during `onChunk`, and surfaced a waiting-first-chunk message before streaming actually begins. Added a regression test in [apps/desktop/src/app/app.chat.test.tsx](E:/2026/opencow/apps/desktop/src/app/app.chat.test.tsx) that proves the pending state switches from slow-start waiting to active generation after the first streamed chunk arrives.
- Evidence:
  - `npm --workspace apps/desktop exec vitest run src/app/app.chat.test.tsx` passed with 45 tests.
  - `npm run predesktop:dev` passed.
  - `npm run verify:all` passed, including 576 desktop tests, repository build, encoding check, health check, and 71 desktop tauri tests.
  - `cmd /c start-opencow-test.bat check` passed and confirmed launcher environment readiness.
- Regression test: `apps/desktop/src/app/app.chat.test.tsx`
- Related: This continues the anti-stall / long-task visibility mainline and complements earlier work that kept troubleshooting on local-model chat and removed fake browser-preview execution claims.
- Status: DONE
