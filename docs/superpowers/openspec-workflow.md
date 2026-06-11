# OpenSpec Workflow For Opencow

This repository-local workflow fills the current `openspec-workflow` gap for opencow development. It is subordinate to `OPENCOW_CORE_RULES.md` and should be used together with Superpowers and gstack.

## Priority Order

1. Follow the user's latest instruction.
2. Follow `OPENCOW_CORE_RULES.md`.
3. Follow the current P0 list in `2026.6.8开发清单.md`.
4. Follow existing OpenSpec-style artifacts under `docs/superpowers/specs/` and `docs/superpowers/plans/`.
5. Follow module docs under `docs/v1.0/`.

When an older plan conflicts with the current P0 list, P0 wins.

## Current P0 Scope

Prefer work that stabilizes these paths before deeper showcase or git expansion:

- Homepage conversation and local assistant task execution.
- Controlled command-line operation.
- Permission request, cancellation, and approval state.
- Audit logs, rollback-visible records, and traceable errors.
- NPC configuration and bounded NPC workflow wiring.
- Skills install, enable, disable, inspect, match, and conversation use.
- Web search and network-assisted retrieval.
- RAG handling for long-form `pptx`, `doc`, `md`, and similar workspace content.
- Anti-stall behavior: duplicate detection, timeout, retry limits, visible progress, and clear recovery guidance.

## Artifact Shape

Use the existing repository shape unless a future formal OpenSpec tool becomes available:

- Specs: `docs/superpowers/specs/YYYY-MM-DD-<change>-design.md`
- Plans: `docs/superpowers/plans/YYYY-MM-DD-<change>.md`
- Status/checklist: root development checklist for the current date, when one exists.

A spec should state:

- Goal and user value.
- Chosen boundary and explicit non-goals.
- Permission, safety, audit, rollback, and error-handling behavior.
- Result contract or UI contract.
- Focused verification commands.

A plan should state:

- Ordered tasks with checkbox steps.
- Files expected to change.
- The first failing test for each implementation slice.
- Focused red and green commands.
- Final verification commands.
- Whether commit, push, or PR actions are explicitly out of scope.

## Execution Rules

- Start every behavior change with a failing test.
- Confirm the failure is for the intended reason before editing production code.
- Make the smallest production change that turns the focused test green.
- Run adjacent regression tests before widening the slice.
- Do not mix unrelated cleanup into the same batch.
- Treat encoding-risk files as high risk and patch them conservatively.

## Superpowers Mapping

Use Superpowers as the engineering gate:

- `superpowers:test-driven-development` for every behavior change.
- `superpowers:systematic-debugging` for failing tests or unexpected behavior.
- `superpowers:verification-before-completion` before reporting success.
- `superpowers:writing-plans` or `superpowers:executing-plans` when a multi-step plan exists.

If a named skill is unavailable, record the deviation and continue only with the repository-local workflow.

## gstack Mapping

Use gstack as an accelerator, not as a replacement for the core safety chain:

- Use gstack review, QA, health, and design tools for bounded checks.
- Use `gpt-taste` only after a runnable desktop milestone exists.
- Do not let visual design work change permission, audit, rollback, shell execution, or task queue behavior.
- Prefer desktop verification over browser-only smoke checks.

## Git Boundary

Git is both the project's development transport and a possible future opencow product capability. Keep those boundaries separate:

- Development git actions are normal repository maintenance, but only run them when explicitly requested or when the current rules allow.
- Product git actions inside opencow must go through planner, permission/confirmation, audit, and rollback-visible flows.
- A readonly git preview must not execute `git add`, `git commit`, `git push`, or mutate files.
- Earlier workspace-write approval must never imply approval for commit or push.

## Batch Completion Report

After each coherent verified batch, report:

- What changed.
- Which red test was used and how it turned green.
- Verification commands and outcomes.
- Any deviations from this workflow.
- The next recommended P0 slice.

