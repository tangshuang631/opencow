# DEBUG REPORT: ordinary capability questions must use local model chat

- **Symptom:** Chinese follow-up questions such as `RAG 能力怎么样，适合帮我做什么` were routed to fixed capability overview tasks instead of the selected local model.
- **Root cause:** `capabilityOverviewIntentPatterns` treated the generic words `能力` and `capability` as enough evidence for a deterministic capability overview. That overmatched ordinary conversational questions where the user expects model reasoning rather than a fixed catalog response.
- **Fix:** Capability overview routing now requires clearer inspection intent such as `inspect`, `overview`, `readiness`, `wiring`, `foundation`, `概览`, `就绪`, or `接线`. Generic capability wording falls through to `local-model-chat` unless another controlled action route is explicitly matched.
- **Regression test:** `packages/openclaw-adapter/src/localAssistantPlan.test.ts` covers Chinese RAG, Skills, NPC, and MCP capability follow-up questions. `apps/desktop/src/app/app.chat.test.tsx` proves the desktop path calls Ollama for `RAG 能力怎么样，适合帮我做什么` instead of showing a fixed capability overview.
- **Evidence:** `npm --workspace packages/openclaw-adapter run build`, `npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.test.ts src/localAssistantPlan.capabilities.test.ts`, and `npm --workspace apps/desktop exec vitest run src/app/app.chat.test.tsx` passed locally on 2026-06-12.
- **Status:** DONE
