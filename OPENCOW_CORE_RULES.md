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

Preferred handling:

- opencow new source/docs/config/scripts: `UTF-8`.
- upstream `openclaw` source: preserve upstream encoding.
- terminal logs and dev scripts: English is allowed when it avoids mojibake.
- product UI: Chinese-first.

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

## 12. Error Handling

All errors must be traceable, explainable, and repairable.

Rules:

- Do not swallow errors.
- Do not only show "failed".
- Record module, time, input summary, command/API, error summary, and detail link.
- Provide user-readable repair suggestions.
- A failed task must not freeze the app.
- Long tasks must be interruptible.

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
