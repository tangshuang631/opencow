# OPENCOW CORE RULES

> This file is the first development rulebook for opencow. Read and follow it before module docs, plans, or implementation work.

## 1. Rule Priority

Development priority:

1. User's latest explicit instruction.
2. `OPENCOW_CORE_RULES.md`.
3. Module docs under `docs/v1.0/`.
4. Existing project conventions and upstream `openclaw` conventions.

If a module doc conflicts with this file, this file wins until the user updates it.

## 2. Repository And Branch

Project repository:

- `https://github.com/tangshuang631/opencow`

Default development branch:

- `dev`

Rules:

- Daily development defaults to `dev`.
- Confirm branch before committing or pushing.
- Prefer direct push without proxy when pushing is needed.
- If network fails, keep local commits complete and push later.
- Do not rewrite history, change remotes, or alter branch strategy without explicit user approval.
- Commit locally after a meaningful verified batch of work, not after every tiny edit.
- Prefer fewer coherent commits over noisy micro-commits.

## 3. Use Skills And Superpowers

Use available skills before complex work.

Rules:

- Use relevant skills for planning, debugging, TDD, verification, and implementation workflows.
- Prefer `Superpowers` workflows when they apply.
- If a new skill is needed, ask the user to install or approve it first.
- Do not bypass the methodology and brute-force complex features.

Common skill choices:

- Requirement shaping: `superpowers:brainstorming`
- Implementation planning: `superpowers:writing-plans`
- Plan execution: `superpowers:executing-plans`
- TDD: `superpowers:test-driven-development`
- Debugging: `superpowers:systematic-debugging`
- Completion verification: `superpowers:verification-before-completion`

## 4. Encoding Rules

Encoding consistency is a core productivity rule. Encoding problems must not slow development, break matching, corrupt files, or make project code messy.

Rules:

- For new opencow-owned files, prefer `UTF-8` unless a module has a stronger local convention.
- When touching upstream `openclaw` files, first detect and preserve the existing upstream encoding and style.
- Do not bulk-convert upstream files just to force `UTF-8`.
- Do not mix encodings inside one module.
- Do not edit a file if the tool cannot reliably read and write its encoding.
- If terminal, script, or CI output cannot reliably render Chinese, use English output for developer-facing logs and errors.
- The frontend user interface remains Chinese-first.
- Chinese UI text should live in explicit UI/i18n resources where possible, not scattered through low-level runtime code.
- Encoding checks must be part of project health checks.
- Any encoding conversion must be deliberate, documented, and tested.

When a file already shows visible encoding inconsistency or mojibake symptoms, treat it as a higher-risk file.

Extra rules for high-risk encoding files:

- Prefer conservative incremental edits over broad rewrites.
- Prefer adding or changing the smallest stable block possible.
- Avoid large multi-hunk edits in one pass.
- Re-read the exact target file content immediately before patching.
- After each small edit, re-check the file before continuing.
- If exact patch matching is unstable, stop expanding the edit scope and reduce to smaller local changes.
- Do not "clean up" unrelated text in the same file while fixing a targeted issue.
- If a file becomes too unstable to patch safely, pause edits to that file and move logic into safer adjacent modules when possible.
- For risky files, prioritize adapter-style changes around the file over invasive in-place rewrites.
- Any necessary rewrite of a high-risk encoding file must be explicitly justified in the work log or commit message.

Preferred handling:

- opencow new source/docs/config/scripts: `UTF-8`.
- upstream `openclaw` source: preserve upstream encoding.
- terminal logs and dev scripts: English is allowed when it avoids mojibake.
- product UI: Chinese-first.

Editing strategy requirement:

- Default to a conservative incremental editing strategy whenever encoding uncertainty, patch mismatch, or garbled terminal rendering appears.
- Development speed must not be improved by taking unsafe editing shortcuts on unstable files.
- Protect file integrity first, then continue feature delivery in smaller verified steps.

## 5. Testing Discipline

Tests must be complete. Smoke tests are useful, but never enough.

Rules:

- After a module change, run that module's unit tests.
- After shared logic changes, run relevant integration tests.
- Changes to permissions, safety, shell, rollback, audit, model calls, RAG, Skills, NPC, or MCP must add or update tests.
- Before pushing, run the full automated test suite.
- Smoke tests only catch obvious breakage and cannot replace unit, integration, safety, and regression tests.

Recommended rhythm:

1. Write or update focused tests.
2. Run the module test and confirm the expected failure or coverage.
3. Implement the smallest correct change.
4. Run the module test again.
5. Run integration tests for cross-module changes.
6. Run full automation before push.

## 6. Code Quality

Use the smallest correct change that preserves the project's direction.

Rules:

- Do not make unrelated edits.
- Do not delete features just to pass tests.
- Do not replace a focused fix with broad rewrites.
- Do not add unnecessary frameworks, dependencies, or abstractions.
- Follow existing project patterns.
- Keep modules clear, small, and testable.
- Prefer stable interfaces over hidden coupling.

## 7. Desktop-First Product Target

opencow is a desktop-first product. The web view is only a development preview and fallback surface.

Rules:

- Tauri desktop behavior is the primary product behavior.
- Desktop startup, window layout, permissions, native dialogs, file access, shell controls, audit logs, and rollback are the main acceptance path.
- Browser/Vite preview is useful for fast UI iteration, but it must not become the product target.
- Do not optimize for web deployment at the expense of desktop reliability.
- Do not add web-only flows that cannot be carried into the desktop app.
- When browser preview and desktop behavior disagree, desktop behavior wins.

## 8. Figma-Friendly UI Evolution

The frontend should keep a clean path for future Figma-driven redesign and refinement.

Rules:

- Keep UI components modular and named by product role, such as `Sidebar`, `Composer`, `Inspector`, and `Workbench`.
- Keep layout tokens, colors, spacing, and typography centralized enough to map to Figma variables later.
- Avoid hardcoding complex visual decisions deep in business logic.
- Preserve a clear path for exporting, comparing, or rebuilding screens from Figma.
- UI copy remains Chinese-first, but developer-facing implementation notes may use English when it prevents encoding problems.

## 9. Module Split And File Size

Modules should be easy to inspect, debug, and optimize.

Rules:

- Each file should have one clear responsibility.
- When a file approaches `300-500` lines and responsibilities blur, split it.
- Separate UI, state, service, types, and tests.
- Permission, safety, audit, rollback, and shell execution must not be buried inside ordinary UI event handlers.
- Directory changes must be reflected in docs immediately.

## 10. Directory Documentation

The directory map is part of the product's maintainability.

Rules:

- Add module docs when adding modules.
- Update paths in docs when moving files.
- Document new scripts, test commands, and entrypoints.
- For any module being developed, read and update its matching doc first.

## 11. Safety-Critical Development

Permissions, shell, safety, logs, and rollback are core safety paths.

Rules:

- Do not bypass `permission-engine`.
- Do not bypass `safety-engine`.
- Do not bypass `audit-core`.
- Shell execution must include permission checks, confirmation, audit logs, timeout, and working-directory limits.
- High-risk operations must show confirmation dialogs.
- Dangerous operations not explicitly requested by the user must not run.
- Rollback changes must verify rollback records and audit records.
- Self-repair or self-upgrade actions must stay inside the same permission, confirmation, audit, and rollback-visible chain as ordinary assistant actions.
- Installing skills, creating NPC definitions, editing assistant config, or repairing opencow-owned files counts as a controlled assistant mutation and must not happen silently.
- Unless the user has already granted the required default high permission mode, any self-repair that could delete files, change runtime startup behavior, replace configs, or launch external processes must pause for the correct approval step.

## 12. Error Handling

All errors must be traceable, explainable, and repairable.

Rules:

- Do not swallow errors.
- Do not only show "failed".
- Record module, time, input summary, command/API, error summary, and detail link.
- Provide user-readable repair suggestions.
- A failed task must not freeze the app.
- Long tasks must be interruptible.
- When opencow itself fails, the assistant should prefer a staged self-repair flow: inspect -> explain -> preview fix -> request approval if mutation is needed -> repair -> verify -> summarize rollback and audit visibility.

## 13. Pre-Push Checklist

Minimum requirements before push:

- Current branch is `dev` unless the user explicitly says otherwise.
- Working tree changes are reviewed.
- Module tests pass.
- Full automation passes.
- Encoding checks pass.
- Build checks pass.
- Directory docs are updated.

If a check cannot run, record the reason, risk, and substitute verification.

## 14. Deferred Cleanup List

When development reveals code that is truly unnecessary for opencow and also harms runtime efficiency, responsiveness, build weight, or maintenance clarity, do not remove it casually in the middle of unrelated feature work.

Rules:

- Record it immediately in `E:\2026\opencow\后期考虑删除的清单.md`.
- Each entry must include the path, current function, why it is unnecessary, and when cleanup should happen.
- Only record items that are genuinely unnecessary, not items that are merely unfinished or temporarily unused.
- If removing the code could disturb the current verified mainline, defer deletion and keep the record instead.
- Later cleanup work must follow the list path-by-path rather than relying on memory.

## 15. Noise And Pollution Control

Recurring development friction such as terminal display noise, unstable text matching, high-risk text blocks, and historically polluted files must be handled with a fixed discipline rather than ad hoc workarounds.

Rules:

- If terminal output renders Chinese unreliably, switch developer-facing logs, grep patterns, and verification notes to English first.
- If a file shows mojibake, mixed encodings, unstable line endings, or patch mismatch behavior, treat it as a high-risk file immediately.
- Do not keep retrying large patches on unstable files. Reduce the change scope, re-read the file, and patch only the smallest stable block.
- When exact text matching is unreliable, prefer structural anchors, adjacent safe modules, or additive wrapper files over invasive in-place rewrites.
- In tests, prefer stable accessible-role queries, structural anchors, and regex matching against intended UI text instead of copying polluted literal labels from noisy files or terminals.
- If a file or path repeatedly causes noise, matching failures, or historical contamination, record it in `E:\2026\opencow\后期考虑删除的清单.md` or in the same list as a cleanup candidate with its path and problem type.
- Temporary dev noise, compatibility shims, demo logic, and abandoned branches of code should be registered for later cleanup instead of silently accumulating.
- When a polluted file cannot be cleaned safely during the current feature window, isolate it, route around it, document it, and continue delivery through cleaner boundaries.
- Cleanup of polluted paths should happen in dedicated cleanup windows, with the list entry removed only after the path is actually cleaned or deleted.

## 16. Testing And Push Cadence

Testing and push frequency should match development risk, not habit.

Rules:

- After finishing a small module or a contained local change, run that module's tests even if you do not push yet.
- Small module work does not need to be pushed immediately once local verification is complete.
- After finishing a milestone-sized batch of development, run full end-to-end verification instead of stopping at smoke checks.
- Milestone verification must include self-check, fixes for discovered issues, and another verification pass until the result is clean.
- Push only after the milestone batch is verified and self-repair is complete, unless the user explicitly wants a different rhythm.
- Testing and pushing do not need to be overly frequent, but they must be complete at meaningful checkpoints.
- Before every push, prefer a fully verified coherent batch over partially tested incremental noise.

## 17. Current Mainline Priority

The current highest-priority desktop-first development mainline is:

- `openclaw-adapter`
- local assistant task planning
- local RAG retrieval
- preview-to-continue continuity
- permission escalation or dangerous confirmation
- controlled shell execution
- audit and rollback-visible completion

Rules:

- Prefer shipping narrow, verified slices on this mainline over broad speculative subsystem expansion.
- Reuse the existing controlled shell path for create or cleanup actions instead of creating parallel executors.
- Pure local RAG, Skill-assisted RAG, and NPC-assisted RAG handoff routes must stay intentionally separated in planner matching.
- New assistant action routing must not depend on frontend redesign work.
- Desktop local assistant commands that inspect workspace state must resolve the real repo root from nested runtime directories instead of assuming the current process directory is already the workspace root.
- When the desktop app is launched from `apps/desktop`, `apps/desktop/src-tauri`, or other nested paths, workspace discovery must walk upward until the real repo root markers are found before executing overview, RAG, Skills, NPC, MCP, or shell-adjacent local tasks.
- opencow must optimize for a higher practical floor than upstream openclaw on local models: better defaults, narrower task routing, safer tool matching, clearer repair prompts, and stronger fallback behavior are required product goals, not optional polish.
- Local-model-first behavior wins by default. Planner wording, task scopes, summaries, and repair flows should be designed to stay reliable even when the local model is weaker than a frontier remote model.
- Current implementation priority inside this mainline is narrower than the long-term vision: homepage conversation, simple assistant task handling, permission-backed shell execution, self-repair preview and fix flow, and conversation-driven Skill use come before deeper NPC showcase automation.
- Do not overfit development to one showcase NPC scenario while the homepage conversation, assistant task execution, and self-repair loop are still incomplete.
- Prefer making more operations reachable through conversation first, with explicit permission and confirmation steps reused from the existing safety chain.

## 18. Anti-Stall And Self-Repair Guardrails

Assistant execution must fail safely instead of hanging, looping, or quietly degrading.

Rules:

- Any local assistant execution chain that can run longer than a trivial UI action must enforce duplicate-request detection, a max execution duration, and a max retry count.
- Repeatedly re-running the same command, task, or repair attempt without new evidence is a bug, not persistence.
- If the assistant cannot complete a task within the allowed retries or timeout, it must stop the current round, preserve the pre-task conversation state, and return a concrete failure analysis to the user.
- Self-repair flows should prefer `inspect -> explain -> preview -> request permission if mutation is needed -> execute -> verify -> summarize`.
- Conversation-driven install or enable flows for Skills, assistant-owned config changes, or assistant self-fixes must reuse the same permission, confirmation, audit, and rollback-visible chain as other controlled mutations.
- When developer-facing Chinese text risks slowing matching or patch stability, internal guard messages may be recorded in English, while user-facing conversation and UI should remain understandable and traceable.
- Loading and thinking states must visibly communicate that opencow is still working, so long-running local-model tasks do not look like a frozen desktop app.

## 12. Frontend Skill Boundary

Frontend taste or animation skills are optional accelerators, not part of the core assistant execution chain.

- `gpt-taste` can be used later for dedicated frontend refinement windows after the core desktop conversation and assistant chain is stable.
- `gpt-taste` must not drive changes to permissions, audit, rollback, local assistant routing, task queue behavior, or other safety-critical product flows.
- Before using `gpt-taste` for real UI work, freeze a runnable desktop milestone first, then run a separate desktop verification pass after the visual changes land.
- If desktop tests depend on `@opencow/openclaw-adapter/browser`, refresh the adapter build before trusting desktop verification results.
