# NPC Showcase-Site Write Design

## Goal

Move the `NPC local project showcase workflow` from screenshot capture into the next smallest real execution slice:

- `permission-backed NPC showcase-site write execution`

This slice adds only local showcase-site generation plus a traceable changed-file summary inside the approved workspace. It does not expand into git status review, commit, push, screenshot selection, or broader repository refactoring.

## Why This Slice

Current landed state:

- readonly `npc-local-project-showcase-preview` exists
- permission-backed `npc-local-project-run` exists and reuses the workspace project lifecycle
- permission-backed `npc-local-project-screenshot-capture` exists and writes traceable workspace-local artifacts
- app-level closure now explicitly covers preview, run, and screenshot execution

Current gap:

- the showcase chain still cannot write any actual showcase-site output after the screenshot artifact exists
- product and acceptance docs already call out showcase-site generation as the next distinct stage before git actions
- current preview language promises `showcase site generation`, but there is still no planner kind, desktop execution branch, or changed-file contract for that stage

Why not git preview or push first:

- git actions are explicitly later and separately confirmable
- they depend on repository writes already existing
- they would widen approval and verification scope beyond the next smallest repository mutation

## Chosen Boundary

This slice includes only:

- explicit NPC wording that asks to generate or write the showcase site now
- permission escalation before any repository write
- desktop execution that writes a small deterministic showcase output set inside the workspace
- returned result text that includes written paths or a changed-file summary

This slice excludes:

- git status preview
- commit creation
- git push
- screenshot ranking or selection UX
- multi-page showcase generation
- arbitrary repo cleanup or refactoring
- free-form template editing outside the fixed showcase output surface

## Recommended Approach

Use one new fixed execution kind:

- `npc-local-project-showcase-site-write`

Planner behavior:

- keep `npc-local-project-showcase-preview` as the readonly entry for broad showcase requests
- add a narrow site-write branch for explicit execution wording such as:
  - `use npc collaboration to generate the showcase site for the matched cattle project now`
  - `write the resume-ready showcase website now`
  - `create the showcase page in my repo now`
- in `readonly`, return:
  - `kind: "permission-request"`
  - `targetMode: "workspace-write"`
  - `queuedExecutionKind: "npc-local-project-showcase-site-write"`
- after approval, return:
  - `kind: "npc-local-project-showcase-site-write"`

Desktop behavior:

- resolve the matched local project through the existing showcase context rather than inventing a second target-selection path
- use already available run metadata and screenshot artifact paths as inputs when present
- write a tightly scoped showcase output into a deterministic workspace-local destination
- return a result summary that includes:
  - matched project name
  - destination directory
  - changed-file summary
  - any screenshot artifact path reused by the generated output
  - note that this is the showcase-site generation stage inside the broader NPC showcase chain

Why this approach:

- it keeps the chain incremental: preview -> run -> screenshot -> site write
- it creates the first real repo mutation in this workflow without jumping into git actions
- it gives later git preview/push stages concrete file outputs to reason about

## Output Contract

This slice should define a minimal showcase-site write contract:

- all output paths must stay inside the approved workspace
- output must be narrow enough that tests can assert exact or pattern-stable changed files
- result text must include the written file set directly instead of generic `site generated` wording

Recommended shape:

- output root stays under a deterministic workspace-local directory such as:
  - `.opencow/artifacts/npc-showcase/site/`
  - or one fixed showcase folder already reserved by the repo if such a target is introduced during implementation
- initial output set should stay intentionally small, for example:
  - one HTML entry file
  - one adjacent metadata or asset reference file only if strictly necessary

The exact destination can remain implementation-driven as long as:

- it is workspace-local
- it is stable enough for focused tests
- the final result surfaces changed-file paths explicitly
- the slice does not silently fan out into a large multi-file site scaffold

## Permission And Safety Boundary

Permission mode:

- `workspace-write`

Reasoning:

- this slice writes new files or overwrites a bounded showcase output inside the workspace
- it does not require `controlled-full` if the destination remains inside the approved workspace and avoids dangerous shell operations
- git actions remain separate and require their own explicit later step

Safety requirements:

- no site generation without explicit task-scoped approval
- no hidden continuation into git status, commit, or push
- no broad guessed rewrite of arbitrary existing app files
- if no matched showcase target can be resolved, fail clearly instead of fabricating generated output
- if required screenshot artifacts are missing for the chosen template, stop with a traceable failure instead of silently degrading into unrelated content

## Planner Design

Add one new adapter task kind:

- `npc-local-project-showcase-site-write`

Recognition rules should require all of:

- explicit NPC collaboration wording
- local showcase project context
- site-generation wording such as `showcase`, `website`, `page`, or `site`
- execution wording, not just preview wording

Planner should not:

- infer site-write execution from a generic `continue` alone
- collapse site generation into `npc-local-project-screenshot-capture`
- route broad showcase ideation away from the existing readonly preview
- infer git approval from earlier workspace-write approval for generation

## Desktop Execution Design

Add one new assistant execution branch:

- `npc-local-project-showcase-site-write`

Execution should:

- inspect the existing matched project context
- locate the latest relevant screenshot artifact for the matched project if the chosen output format depends on it
- call one dedicated showcase-site write service
- return NPC-specific title and audit wording

Expected result wording should include:

- project identity
- written output root
- changed-file list or count plus representative paths
- screenshot artifact path if reused
- a statement that this is the showcase-site generation stage of the NPC showcase chain

Implementation boundary for the future plan:

- prefer one dedicated desktop/Tauri write surface rather than spreading generation across unrelated shell helpers
- keep generated content deterministic and template-bounded
- if implementation cannot stay bounded without broad templating logic, stop and split the design again before coding

## App Flow Design

Required user-visible chain:

1. composer submit with explicit NPC showcase-site execution wording
2. permission request for `workspace-write`
3. approval
4. final showcase-site write result with changed-file summary

Required assertions:

- permission appears before repository mutation
- final result remains NPC-specific
- changed-file paths are visible in the conversation result
- no git push or commit language appears in the final site-write result

## Types And Interfaces

Expected additions:

- adapter type:
  - `npc-local-project-showcase-site-write`
- desktop task union:
  - `npc-local-project-showcase-site-write`
- local assistant desktop service:
  - one showcase-site write result type
  - one showcase-site write function

Expected result shape should minimally expose:

- `project_name`
- `project_path`
- `output_root`
- `changed_files`
- `changed_file_count`
- `summary`

Additional fields such as `screenshot_artifact_path` are acceptable if needed to keep downstream results explicit.

## Error Handling

If no matched showcase project can be resolved:

- fail with a clear result
- do not invent generated files
- do not silently fall back to preview text

If output writes partially succeed:

- fail the task
- surface which files were written and which boundary failed
- do not continue into later git stages

If a required screenshot artifact cannot be found:

- return a traceable failure
- do not fabricate a screenshot reference

## Verification Shape

The next implementation batch should be verified with focused checks across:

```bash
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.npc-showcase.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-showcase.test.ts src/app/app.npc-showcase.test.tsx
npm --workspace apps/desktop exec tsc --noEmit
```

If implementation adds a new Tauri write command, add one focused Rust test or desktop integration check for:

- output paths staying inside the approved workspace
- deterministic changed-file reporting
- explicit failure when the write target cannot be resolved or the required screenshot artifact is missing

## Non-Goals

This slice does not attempt to solve:

- git status preview
- git commit
- git push
- multi-page site generation
- screenshot curation
- visual polish iteration
- arbitrary repo-wide content edits

The purpose of this slice is narrower:

- prove that the NPC showcase chain can perform its first bounded repository write after screenshot capture while preserving explicit permission, explicit audit identity, and traceable changed-file results
