# NPC Showcase Publish Preview Design

## Goal

Move the `NPC local project showcase workflow` from `showcase-site write` into the next smallest distinct stage:

- `readonly NPC showcase publish preview`

This slice does not write new files and does not run git actions. It reads the latest NPC showcase outputs for the matched local project and returns a publish-oriented summary that makes the next separately confirmable git step explicit.

## Why This Slice

Current landed state:

- readonly `npc-local-project-showcase-preview` exists
- permission-backed `npc-local-project-run` exists
- permission-backed `npc-local-project-screenshot-capture` exists
- permission-backed `npc-local-project-showcase-site-write` exists
- the site-write result already returns:
  - `site_root`
  - `entry_file`
  - `changed_paths`
  - `source_screenshot_path`

Current gap:

- the workflow can now produce real local showcase artifacts
- but there is still no standalone readonly stage that reopens the latest generated output and frames the next git decision
- current docs still require `preview of changed files and generated artifacts` before any optional commit or push stage

Why not jump directly to git:

- git commit or push is a different risk boundary than local artifact generation
- the docs already require git to remain separately confirmable
- a direct jump from site write to git would skip the explicit review stage that the workflow description already promises

Why not reuse generic `readonly-shell-git-status`:

- it is workspace-wide and not NPC-specific
- it does not bind the latest matched project, screenshot artifact, and generated showcase site into one workflow result
- it does not distinguish showcase outputs from unrelated workspace changes

## Approaches Considered

### 1. NPC publish preview over latest showcase outputs `(Recommended)`

Read the latest NPC showcase outputs for the matched project and return a readonly publish summary.

Pros:

- smallest stage after `showcase-site write`
- does not add a new mutation or git side effect
- creates a clean bridge into a later separately confirmable git step

Cons:

- does not yet prove commit or push

### 2. Reuse generic git status

Tell users to inspect the repository through the existing readonly git status task.

Pros:

- zero new write surface
- reuses an existing command

Cons:

- too broad and not workflow-specific
- loses the NPC showcase identity and artifact context
- weak handoff into later git actions

### 3. Jump directly to NPC git commit preview or execution

Start the git stage immediately after site write.

Pros:

- closer to final publish value

Cons:

- skips the promised explicit review stage
- adds a higher-impact boundary before the current chain has a clean post-write readonly checkpoint

## Chosen Boundary

This slice includes only:

- explicit NPC collaboration wording that asks to inspect, review, or preview the generated showcase output for the matched project
- readonly resolution of the latest NPC showcase screenshot and site output for that matched project
- a stable publish-preview result that summarizes generated artifacts and changed paths
- explicit wording that git commit or push is still separate

This slice excludes:

- new file writes
- git add, commit, or push
- generic repository inspection unrelated to NPC showcase outputs
- re-running screenshot capture or site generation

## Recommended Task Kind

Add one new adapter task kind:

- `npc-local-project-showcase-publish-preview`

This kind should stay readonly from planner through desktop execution.

## Planner Design

Recognition rules should require:

- explicit NPC collaboration wording
- matched local project context
- explicit preview or review wording such as:
  - `preview the generated showcase output for the matched cattle project`
  - `review the changed showcase files before git`
  - `show the latest npc showcase artifacts for the cattle project`
- optional git wording is allowed only when it is clearly preview-only, such as:
  - `before commit`
  - `before push`
  - `before git`

Planner behavior:

- broad end-to-end showcase requests still default to `npc-local-project-showcase-preview`
- explicit post-write preview wording returns:
  - `kind: "npc-local-project-showcase-publish-preview"`
- no permission escalation is required because this slice is readonly

Important boundary:

- planner must not infer this stage from generic `continue`
- planner must not collapse this stage into `readonly-shell-git-status`
- planner must not treat preview wording as approval for commit or push

## Desktop Execution Design

Add one new assistant execution branch:

- `npc-local-project-showcase-publish-preview`

Execution should:

- resolve the matched local project through the same candidate matching rules already used by preview, run, screenshot, and site-write
- inspect the latest generated showcase site root for that project
- inspect the latest screenshot artifact for that project when present
- read the deterministic site entry file path without mutating it
- return a stable readonly preview summary that is specific to the matched NPC showcase chain

Recommended preview fields:

- `project_name`
- `project_path`
- `site_root`
- `entry_file`
- `source_screenshot_path`
- `changed_paths`
- `next_git_step`
- `summary`

Recommended `next_git_step` wording:

- `Git commit or push is still separate and requires its own explicit confirmation stage.`

## Data Source Contract

This slice should prefer existing deterministic artifacts instead of recomputing them from scratch.

Recommended lookup order:

1. resolve the matched project
2. find the latest generated showcase site root under:
   - `.opencow/artifacts/npc-showcase/sites/<project-name>/`
3. treat `index.html` as the current entry file
4. find the latest screenshot artifact for the same project under:
   - `.opencow/artifacts/npc-showcase/`

If the site output is missing:

- fail clearly
- do not fabricate a publish preview from generic workspace files

If the screenshot artifact is missing but the site exists:

- the result may still succeed only if the site metadata already points at a deterministic screenshot path
- otherwise fail clearly instead of pretending the preview is complete

## Result Contract

Minimum returned fields:

- `project_name`
- `project_path`
- `site_root`
- `entry_file`
- `changed_paths`
- `source_screenshot_path`
- `next_git_step`
- `summary`

Result wording should include:

- matched project identity
- generated site root
- entry file
- screenshot artifact path
- explicit changed paths
- note that this is the readonly publish-preview stage, not a git stage

## Safety Boundary

This slice stays readonly.

Safety requirements:

- no permission escalation side effect
- no git command execution
- no implicit continuation into commit or push
- no broad repo diff over unrelated files unless a later design explicitly adds it

## App Flow Design

Required user-visible chain:

1. composer submit with explicit NPC publish-preview wording
2. final readonly preview result

Required assertions:

- no permission dialog appears
- final result remains NPC-specific
- changed paths and artifact paths are visible
- result explicitly says git remains separate

## Error Handling

If no matched local project can be resolved:

- fail clearly

If no generated showcase site output is available:

- fail clearly
- suggest running the showcase-site write stage first

If artifact lookup finds ambiguous or unrelated paths:

- prefer the deterministic project-scoped path
- otherwise fail instead of guessing

## Verification Shape

The eventual implementation batch should be verifiable with focused checks across:

```bash
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.npc-showcase.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-showcase.test.ts src/app/app.npc-showcase.test.tsx
npm --workspace apps/desktop exec tsc --noEmit
cargo test workspace_project_npc_showcase_publish_preview --manifest-path apps/desktop/src-tauri/Cargo.toml -- --nocapture
```

Focused checks should prove at least:

- planner maps explicit preview wording into `npc-local-project-showcase-publish-preview`
- desktop execution returns the deterministic site and screenshot paths for the matched project
- no permission request is inserted
- final result explicitly keeps git as a separate future step

## Non-Goals

This slice does not attempt to solve:

- git commit
- git push
- multi-page showcase output
- artifact gallery management
- generic repository diff browsing
- automatic continuation from site write into git

The purpose is narrower:

- add a clean readonly review stage between `showcase-site write` and any future git action, while preserving NPC showcase identity and keeping the git boundary explicit.
