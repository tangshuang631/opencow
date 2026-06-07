# NPC Showcase-Site Write Design

## Goal

Move the `NPC local project showcase workflow` from screenshot artifact creation into the next smallest real repository-write slice:

- `permission-backed NPC showcase-site write execution`

This slice adds only local showcase-site generation plus a traceable changed-file summary. It does not expand into git commit, git push, screenshot curation, or multi-page site generation.

## Why This Slice

Current landed state:

- readonly `npc-local-project-showcase-preview` exists
- permission-backed `npc-local-project-run` exists and reuses the local project run lifecycle
- permission-backed `npc-local-project-screenshot-capture` exists and returns workspace-local artifact paths

Current gap:

- the showcase chain can now launch the matched project and capture a real screenshot
- but it still cannot turn that evidence into any repository-local showcase output
- current docs already treat showcase-site generation as a distinct stage that must stay separate from git actions

Why not go further in this slice:

- git commit or push would add a second approval boundary and a different risk class
- multi-page site generation would introduce templating and asset-layout complexity that is not required to prove the write surface
- screenshot galleries or selection logic would reopen the previous stage instead of advancing the chain

## Approaches Considered

### 1. Single-page deterministic showcase write `(Recommended)`

Write one small static site output into a deterministic workspace-local directory and return a changed-file summary.

Pros:

- smallest repository-write surface after screenshot capture
- easy to verify with planner, desktop execution, app flow, and changed-path assertions
- keeps git as a later, separately confirmable stage

Cons:

- does not solve richer site theming or multi-page presentation

### 2. Multi-file showcase package write

Write `index.html`, stylesheet, copied screenshot assets, and metadata in one shot.

Pros:

- more realistic final artifact
- cleaner separation between content and styling

Cons:

- materially larger write surface
- more file-path and asset-sync behavior to verify
- not the smallest next slice

### 3. Jump directly to git-ready showcase publication

Generate site output and immediately continue into changed-files preview or git actions.

Pros:

- closer to end-user "publish" value

Cons:

- violates the current stage boundary
- mixes repository write and VCS mutation into one approval decision

## Chosen Boundary

This slice includes only:

- explicit NPC wording that asks to generate or write a showcase site for the matched local project
- permission escalation before any repository write
- desktop execution that writes a deterministic single-page showcase output inside the approved workspace
- returned changed-file summary that lists exactly what was written

This slice excludes:

- git status, commit, or push
- multi-page site generation
- template selection UX
- screenshot ranking or gallery generation
- arbitrary free-form repo edits outside the fixed showcase output target

## Recommended Output Contract

The generated output should be deterministic enough to verify without baking in unstable timestamps.

Recommended directory:

- `.opencow/artifacts/npc-showcase/sites/<project-name>/`

Recommended files:

- `index.html`
- optional copied image asset only if required for a self-contained page

Recommended result contract:

- returned `site_root`
- returned `entry_file`
- returned `changed_paths`
- returned `source_screenshot_path` when a screenshot artifact is used
- returned summary stating this is the showcase-site write stage inside the NPC showcase chain

Why write under `.opencow/artifacts` first instead of mutating arbitrary user app files:

- still counts as repository-local workspace write
- keeps the output deterministic and audit-visible
- avoids broad guessed edits to existing app code or routing
- preserves a clean later boundary if the workflow eventually wants a stronger "publish into real app surfaces" slice

## Permission And Safety Boundary

Permission mode:

- `workspace-write`

Reasoning:

- this slice creates or overwrites deterministic local output files inside the workspace
- it is not destructive enough to require `controlled-full`
- it must remain narrower than any future git or publish stage

Safety requirements:

- no repository write without explicit task-scoped approval
- no implicit continuation into git actions after the write completes
- no arbitrary target path chosen from free-form user wording
- if required screenshot evidence is unavailable, fail clearly instead of generating a fabricated "finished showcase"
- if file writes fail, stop the chain and return the write boundary that failed

## Planner Design

Add one new adapter task kind:

- `npc-local-project-showcase-site-write`

Recognition rules should require:

- explicit NPC collaboration wording
- matched local project context
- explicit showcase-site generation wording such as:
  - `generate the showcase site now`
  - `write the resume-ready showcase website`
  - `create the local showcase page for the matched cattle project`

Planner behavior:

- broad end-to-end showcase requests still default to `npc-local-project-showcase-preview`
- explicit site-write execution wording in `readonly` returns:
  - `kind: "permission-request"`
  - `targetMode: "workspace-write"`
  - `queuedExecutionKind: "npc-local-project-showcase-site-write"`
- after approval, return:
  - `kind: "npc-local-project-showcase-site-write"`

Important boundary:

- planner must not infer site generation from generic `continue`
- planner must not collapse site write into screenshot capture
- git wording remains out of scope for this slice even if the message mentions a repo

## Desktop Execution Design

Add one new assistant execution branch:

- `npc-local-project-showcase-site-write`

Execution should:

- resolve the matched local project through the same runtime-backed candidate flow already used by run and screenshot capture
- require at least one valid screenshot artifact for that matched project
- write deterministic showcase output under `.opencow/artifacts/npc-showcase/sites/<project-name>/`
- return a changed-file summary instead of pretending the whole showcase chain is complete

Recommended generated page contents:

- project title
- project path
- expected local URL if known
- screenshot reference
- short statement that this page was generated by the NPC showcase workflow for local review

The generated page should stay intentionally simple:

- one static HTML entry point
- no bundler
- no framework-specific integration
- no mutation of existing application source trees

## Changed-File Summary Contract

This slice should make repository writes easy to audit.

Minimum returned fields:

- `project_name`
- `project_path`
- `site_root`
- `entry_file`
- `changed_paths`
- `source_screenshot_path`
- `summary`

Result wording should include:

- matched project identity
- generated site root
- entry file
- each changed path or a concise changed-file count plus explicit path list
- note that this is the showcase-site write stage, not a git stage

## App Flow Design

Required user-visible chain:

1. composer submit with explicit NPC showcase-site execution wording
2. permission request for `workspace-write`
3. approval
4. final repository-write result with changed paths

Required assertions:

- permission appears before generation
- final result remains NPC-specific
- changed paths are visible in the conversation result
- result does not imply git commit or push happened

## Types And Interfaces

Expected additions:

- adapter type:
  - `npc-local-project-showcase-site-write`
- desktop task union:
  - `npc-local-project-showcase-site-write`
- local assistant desktop service:
  - one showcase-site write result type
  - one showcase-site write function
- Tauri workspace command:
  - one tightly scoped showcase-site write command

The command should remain narrower than a general-purpose file generator. It should write only the deterministic NPC showcase-site output and return metadata about what changed.

## Error Handling

If no matched running local project can be resolved:

- fail clearly
- do not generate placeholder site output

If no valid screenshot artifact is available for the matched project:

- fail clearly
- do not silently downgrade into a text-only "showcase" unless a later design explicitly allows that

If the output directory cannot be created or written:

- fail the task
- surface the path that failed

If a page is generated successfully:

- stop at the changed-file summary
- do not auto-continue into git preview, commit, or push

## Verification Shape

The eventual implementation batch should be verifiable with focused checks across:

```bash
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.npc-showcase.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-showcase.test.ts src/app/app.npc-showcase.test.tsx
npm --workspace apps/desktop exec tsc --noEmit
cargo test workspace_project_npc_showcase_site_write --manifest-path apps/desktop/src-tauri/Cargo.toml -- --nocapture
```

Focused Rust or desktop checks should prove at least:

- output paths stay inside `.opencow/artifacts/npc-showcase/sites`
- screenshot absence fails explicitly
- returned changed paths match what was written

## Non-Goals

This slice does not attempt to solve:

- publishing into an existing app surface
- framework-specific site scaffolding
- screenshot selection or ranking
- markdown or CMS import
- git status, commit, or push
- broad NPC autonomous "finish everything" execution

The purpose of this slice is narrower:

- prove that the NPC showcase chain can convert a running local project plus a real screenshot artifact into a deterministic repository-local showcase output while keeping permission, audit identity, and changed-file visibility explicit.
