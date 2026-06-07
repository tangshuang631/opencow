# NPC Screenshot Capture Design

## Goal

Move the `NPC local project showcase workflow` from its first executed run stage into the next smallest real execution slice:

- `permission-backed NPC screenshot capture execution`

This slice adds only screenshot capture plus traceable returned artifact paths. It does not expand into screenshot galleries, screenshot ranking, showcase-site generation, repository writes, or git operations.

## Why This Slice

Current landed state:

- readonly `npc-local-project-showcase-preview` exists
- permission-backed `npc-local-project-run` now exists and reuses the matched local project run lifecycle
- preview and run stages already keep NPC-specific queue, title, and audit identity

Current gap:

- the showcase chain still cannot capture any real visual artifact after the local project is running
- docs already call out screenshot capture as the next explicit stage after run
- there is no planner kind, desktop execution branch, or app-level closure for screenshot capture yet

Why not do more in this slice:

- multi-image selection or summarization would add post-processing logic that is not required to prove the execution surface
- showcase-site generation would expand into repo writes and artifact composition
- git commit or push is explicitly later-stage and separately confirmable

## Chosen Boundary

This slice includes only:

- explicit NPC wording that asks to capture a screenshot from the matched local project
- permission escalation before any screenshot capture
- desktop execution that captures one or more screenshots into a deterministic workspace-local artifact directory
- returned result summary that includes stable artifact paths

This slice excludes:

- image quality scoring
- screenshot deduplication or selection UX
- gallery aggregation
- showcase-site file generation
- repo mutation beyond writing screenshot artifacts
- git actions

## Recommended Approach

Use one new fixed execution kind:

- `npc-local-project-screenshot-capture`

Planner behavior:

- keep `npc-local-project-showcase-preview` as the readonly entry for broad showcase requests
- add a narrow screenshot-capture branch for explicit execution wording such as:
  - `use npc collaboration to capture a screenshot from the matched cattle project`
  - `take the showcase screenshot now`
  - `capture a local screenshot for the running cattle project`
- in `readonly`, return:
  - `kind: "permission-request"`
  - `targetMode: "workspace-write"`
  - `queuedExecutionKind: "npc-local-project-screenshot-capture"`
- after approval, return:
  - `kind: "npc-local-project-screenshot-capture"`

Desktop behavior:

- resolve the matched running local project through the existing project lifecycle state instead of inventing a second runtime source
- capture screenshots only for the explicit matched local target
- persist artifact files under a deterministic workspace-local path
- return a result summary that includes:
  - matched project name
  - expected local URL when available
  - written artifact path or paths
  - note that this is the screenshot stage inside the broader NPC showcase chain

Why this approach:

- it stays inside the already-verified NPC showcase chain
- it introduces one new execution surface instead of several
- it creates the first real showcase artifact without forcing downstream repo-write behavior

## Artifact Contract

This slice should define a minimal screenshot artifact contract:

- artifact root must stay inside the approved workspace
- artifact path must be deterministic enough to test
- result text must include the returned artifact path directly

Recommended shape:

- workspace-local directory such as:
  - `.opencow/artifacts/npc-showcase/`
- file naming should be task-scoped and collision-safe, for example:
  - `<project-name>-screenshot-<timestamp>.png`

The exact filename format can remain implementation-driven as long as:

- the location is workspace-local
- the extension is explicit
- tests can assert returned path structure without relying on unstable full timestamps

## Permission And Safety Boundary

Permission mode:

- `workspace-write`

Reasoning:

- screenshot capture creates new artifact files in the workspace
- this is narrower than `controlled-full`
- no destructive action is involved in this slice

Safety requirements:

- no screenshot capture without explicit task-scoped approval
- no hidden continuation into site generation
- no hidden continuation into git write or push
- if no matching running project is available, fail clearly instead of fabricating screenshot output
- if screenshot capture fails, stop the chain and return a traceable error

## Planner Design

Add one new adapter task kind:

- `npc-local-project-screenshot-capture`

Recognition rules should require all of:

- explicit NPC collaboration wording
- local project context related to the showcase target
- screenshot intent wording
- execution wording, not just preview wording

Planner should not:

- infer screenshot execution from generic `continue`
- collapse screenshot execution into `npc-local-project-run`
- route broad showcase requests away from the existing readonly preview

## Desktop Execution Design

Add one new assistant execution branch:

- `npc-local-project-screenshot-capture`

Execution should:

- inspect the existing runtime-backed local project state
- use the matched project and likely local URL as capture context
- call one dedicated screenshot capture service
- return NPC-specific title and audit wording

Expected result wording should include:

- project identity
- capture target URL if known
- artifact path
- a statement that this is the screenshot stage of the NPC showcase chain

## App Flow Design

Required user-visible chain:

1. composer submit with explicit NPC screenshot execution wording
2. permission request for `workspace-write`
3. approval
4. final screenshot result with artifact path

Required assertions:

- permission appears before capture
- final result remains NPC-specific
- returned artifact path is visible in the conversation result

## Types And Interfaces

Expected additions:

- adapter type:
  - `npc-local-project-screenshot-capture`
- desktop task union:
  - `npc-local-project-screenshot-capture`
- local assistant desktop service:
  - one screenshot capture result type
  - one screenshot capture function

This slice may require a new Tauri command if no existing desktop screenshot bridge can be safely reused. If that turns out to be necessary, the command must remain tightly scoped to explicit NPC showcase screenshot capture and return artifact metadata only.

## Error Handling

If no runnable or running matched local project can be resolved:

- fail with a clear result
- do not invent an image artifact
- do not silently fall through into preview text

If screenshot capture succeeds but artifact write fails:

- fail the task
- surface the path or write boundary that failed

If the local page is unreachable:

- return a traceable failure
- do not continue into later showcase stages

## Verification Shape

The next implementation batch should be verified with focused checks across:

```bash
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.npc-showcase.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-showcase.test.ts src/app/app.npc-showcase.test.tsx
npm --workspace apps/desktop exec tsc --noEmit
```

If implementation adds a new Tauri screenshot command, add one focused Rust test or desktop integration check for:

- deterministic workspace-local artifact path
- explicit failure when no valid target can be captured

## Non-Goals

This slice does not attempt to solve:

- screenshot curation
- image analysis
- generated captions
- showcase-site templating
- repo writes beyond artifact creation
- git status, commit, or push

The purpose of this slice is narrower:

- prove that the NPC showcase chain can create a first real visual artifact after the local run stage while preserving explicit permission, explicit audit identity, and clear returned paths
