# NPC Local Run Execution Design

## Goal

Move the `NPC local project showcase workflow` from preview-only into its first real execution slice without expanding into screenshots, showcase-site generation, or git operations.

This slice adds only the first permission-backed NPC execution step:

- `NPC local run execution`

It must reuse the existing local project run lifecycle instead of creating a second launch path.

## Why This Slice

Current state:

- planner already recognizes explicit NPC showcase requests
- desktop already returns a readonly showcase preview with matched project, command candidates, expected URL, and next required permission
- non-NPC local project run, status, and stop already exist as a verified lifecycle chain

Current gap:

- NPC showcase still cannot cross from preview into any real execution stage
- the first missing stage is local run execution, and it is the narrowest bridge because it can reuse the existing `workspace-project-run` path

Why not screenshots or showcase-site write first:

- both would introduce new execution surfaces
- both would expand artifact, repository-write, or approval scope
- neither is smaller than reusing the already-landed project lifecycle

## Chosen Approach

Recommended approach:

- keep `npc-local-project-showcase-preview` as the readonly entry
- add a new fixed execution kind for the first privileged step:
  - `npc-local-project-run`
- in `readonly`, explicit NPC showcase run-continuation wording returns a `permission-request` for `workspace-write`
- after approval, desktop executes the same matched-project run path used by `workspace-project-run`, but keeps NPC-specific title and audit wording

Why this approach:

- smallest implementation surface
- preserves existing permission and audit discipline
- keeps NPC wording visible to the user instead of collapsing into generic project-run identity
- avoids parallel runtime or preview logic

Rejected alternatives:

1. Reuse `workspace-project-run` directly with no NPC-specific execution kind.
   This is smaller in code, but it weakens traceability because the queue, title, and audit wording would stop reflecting that the user is still inside the NPC showcase chain.

2. Jump straight to NPC screenshot capture.
   This adds a new execution surface before the showcase chain proves it can even launch the matched project safely.

## Scope

In scope:

- planner recognition for explicit NPC showcase run continuation wording
- permission-backed transition from readonly into NPC local run execution
- desktop execution result that reuses the existing matched-project run service call
- NPC-specific result title and audit wording
- focused planner, desktop-service, and app-level verification

Out of scope:

- screenshot capture execution
- showcase-site generation
- repository write
- git commit or push
- broader NPC autonomous multi-step execution
- any self-repair work

## Planner Design

Add one new task kind:

- `npc-local-project-run`

Planner entry conditions:

- request still carries explicit NPC collaboration wording
- request still clearly refers to the local showcase workflow or local project run context
- request wording has crossed from preview into execution intent, for example:
  - `continue`
  - `proceed to run it`
  - `start the matched local project`
  - `run the cattle project now`

Planner behavior:

- in `readonly`, return:
  - `kind: "permission-request"`
  - `targetMode: "workspace-write"`
  - `queuedExecutionKind: "npc-local-project-run"`
  - NPC-specific title, audit summary, and audit detail
- after approval, return:
  - `kind: "npc-local-project-run"`

Important boundary:

- planner must not infer screenshot or site-generation continuation from generic `continue`
- this slice handles only the first run step

## Desktop Execution Design

Add one new assistant execution branch:

- `npc-local-project-run`

Execution behavior:

- reuse the same project matching and launch call already used by `workspace-project-run`
- do not add a separate NPC runtime registry or shell runner
- result title remains NPC-specific, for example:
  - `NPC local project run`
- result summary should include:
  - matched project name
  - project path
  - chosen command
  - expected URL
  - returned pid
  - note that this is the first executed stage inside the broader showcase chain

Audit behavior:

- audit summary and detail must remain NPC-specific
- execution identity must stay distinguishable from generic local project run

## App Flow Design

Add one dedicated app-level test file if needed, or extend the existing clean NPC showcase app coverage if present.

Required user-visible chain:

1. composer submit with explicit NPC showcase run continuation wording
2. permission request for `workspace-write`
3. approval
4. final NPC local run result

Required assertions:

- result remains labeled as NPC-driven run flow
- summary includes the matched project and chosen command
- permission step appears before execution

## Types And Interfaces

Expected additions:

- adapter types:
  - `npc-local-project-run`
- desktop task union:
  - `npc-local-project-run`
- assistant execution dispatch branch:
  - `npc-local-project-run`

No new Tauri command is required if the slice fully reuses the existing `workspace_project_run` command.

## Error Handling

If the matched project cannot be launched:

- surface the same error quality already used by `workspace-project-run`
- keep the error wrapped in NPC-specific task identity
- do not silently skip ahead to screenshot or showcase generation

If permission is not approved:

- no execution occurs
- no continuation to later showcase stages occurs

## Verification Plan

Focused verification for the implementation batch should include:

```bash
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.npc-showcase.test.ts src/localAssistantPlan.project-run.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-showcase.test.ts src/features/assistant/assistantTaskService.project-run.test.ts src/app/app.npc-showcase.test.tsx
npm --workspace apps/desktop exec tsc --noEmit
```

If the slice ends up reusing Tauri unchanged, no new Rust command should be necessary. If implementation discovers that reuse is impossible without Tauri changes, stop and split that into a separate narrower design update before expanding scope.
