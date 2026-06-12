# DEBUG REPORT: NPC config generation cancellation

- Symptom: During NPC config generation, the conversation showed an assistant pending state, but the composer could still show the normal send action or the task could be stopped without preventing a late model result from writing an NPC config.
- Root cause: Approved permission or confirmation flows submitted queued execution tasks and waited for the scheduler tick before marking them as running. This left a UI window where the model task was not consistently exposed as cancellable. A second issue let `executeNpcConfigWriteTask` continue into `writeNpcConfig` after the local model promise resolved, even if the request signal had already been aborted.
- Fix: Approved queued executions now call `createTaskExecutionStartedState(createUserTaskSubmittedState(...))` immediately. NPC config writes now check the abort signal after the model call and before applying write side effects.
- Evidence: Focused component and app tests passed. TypeScript passed. Related local-model chat and task-guard tests passed.
- Regression test: `apps/desktop/src/app/app.test.tsx` now verifies stopping in-flight NPC config generation aborts the Ollama request, does not write config, and ignores late model output. `apps/desktop/src/features/workbench/components/Composer.test.tsx` verifies an approved running NPC config task shows stop controls.
- Related: This matches the broader anti-stall requirement that long local assistant tasks must be visibly interruptible and must not apply stale side effects after cancellation.
- Status: DONE
