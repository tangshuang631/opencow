# NPC Showcase Git Confirmation Preview Design

## Goal

Move the `NPC local project showcase workflow` from `publish-preview` into the next smallest distinct stage:

- `readonly NPC showcase git confirmation preview`

This slice does not execute `git add`, `git commit`, `git push`, or any other write action. It reads the latest NPC showcase context, summarizes the pending showcase-related file changes, and recommends the next separately confirmable git action for the matched local project.

## Why This Slice

Current landed state:

- readonly `npc-local-project-showcase-preview` exists
- permission-backed `npc-local-project-run` exists
- permission-backed `npc-local-project-screenshot-capture` exists
- permission-backed `npc-local-project-showcase-site-write` exists
- readonly `npc-local-project-showcase-publish-preview` exists
- the current publish-preview result already returns:
  - `project_name`
  - `project_path`
  - `site_root`
  - `entry_file`
  - `changed_paths`
  - `source_screenshot_path`
  - `next_git_step`

Current gap:

- the workflow can now produce and reopen deterministic local showcase artifacts
- but there is still no standalone stage that reframes those outputs into a git-specific decision boundary
- current docs still require git commit or push to remain separately confirmable, not implied by earlier workspace-write approval

Why not jump directly to git execution:

- commit and push are higher-impact boundaries than local artifact generation
- the current desktop chain already separates readonly preview from permission escalation and dangerous confirmation
- skipping the git-specific preview stage would force the user to approve a high-impact action without a dedicated workflow-native summary

Why not reuse generic `readonly-shell-git-status`:

- it is workspace-wide and not NPC-specific
- it does not preserve the matched project, showcase site root, screenshot artifact, and recommended next action as one coherent workflow result
- it does not explain why earlier workspace-write approval for site generation is not sufficient for git execution

## Approaches Considered

### 1. Readonly NPC git confirmation preview over showcase context `(Recommended)`

Read the latest NPC showcase outputs and return a readonly preview that recommends `commit` or `push` as the next explicit stage.

Pros:

- smallest stage after `publish-preview`
- keeps git as a distinct future execution boundary
- reuses existing showcase metadata instead of inventing a broader git abstraction

Cons:

- does not yet execute commit or push

### 2. Permission-backed git action preview

Immediately convert git-specific wording into a `permission-request` for a future git action.

Pros:

- closer to final execution

Cons:

- mixes preview and authorization into one step
- weakens the current clean separation between readonly context gathering and later approval

### 3. Direct dangerous confirmation for git commit or push

Jump from publish-preview straight into dangerous confirmation for git execution.

Pros:

- shortest path to execution

Cons:

- skips a dedicated git-specific context review stage
- asks for confirmation before the workflow has summarized exactly what action is being recommended and why

## Chosen Boundary

This slice includes only:

- explicit NPC collaboration wording that asks to prepare, review, inspect, or preview the git step for the matched showcase outputs
- readonly resolution of the latest showcase context already produced by earlier stages
- a stable git-confirmation-preview result that recommends the next git action without executing it
- explicit wording that commit and push still require a later separate approval stage

This slice excludes:

- `git add`
- `git commit`
- `git push`
- generic repository inspection unrelated to the matched NPC showcase chain
- any mutation of showcase artifacts
- any automatic continuation from preview into execution

## Recommended Task Kind

Add one new adapter task kind:

- `npc-local-project-showcase-git-confirmation-preview`

This kind should remain readonly from planner through desktop execution and app flow.

## Planner Design

Recognition rules should require:

- explicit NPC collaboration wording
- matched local project context or explicit showcase context
- explicit git-step preview wording such as:
  - `prepare the showcase changes for commit`
  - `preview the git step for the matched cattle showcase before push`
  - `review the showcase changes before commit`
- the wording must stay preview-oriented rather than execution-oriented

Planner behavior:

- broad end-to-end showcase requests still default to `npc-local-project-showcase-preview`
- post-write artifact review requests still map to `npc-local-project-showcase-publish-preview`
- explicit git-step review wording returns:
  - `kind: "npc-local-project-showcase-git-confirmation-preview"`
- no permission escalation is required because this slice is readonly

Important boundaries:

- planner must not infer this stage from generic `continue`
- planner must not collapse this stage into `readonly-shell-git-status`
- planner must not treat `commit`, `push`, or `publish` wording as execution approval by itself
- planner must not let `push` wording skip the intermediate git confirmation preview stage

## Desktop Execution Design

Add one new assistant execution branch:

- `npc-local-project-showcase-git-confirmation-preview`

Execution should:

- resolve the matched local project through the same candidate matching rules already used by preview, run, screenshot, site-write, and publish-preview
- reopen the latest deterministic showcase context already available from publish-preview inputs
- summarize the showcase-related file changes that would matter for the next git step
- classify the recommended next git action as either `commit` or `push`
- explain that actual git execution still requires a later explicit confirmation stage

Recommended preview fields:

- `project_name`
- `project_path`
- `site_root`
- `entry_file`
- `changed_paths`
- `source_screenshot_path`
- `recommended_git_action`
- `required_confirmation_stage`
- `summary`

Recommended `required_confirmation_stage` wording:

- `Git commit or push still requires its own explicit confirmation and execution stage.`

Recommended `recommended_git_action` behavior:

- `commit` when the request is framed as preparing or reviewing local changes before commit
- `push` when the request is explicitly framed as preparing for push after the showcase output is already ready

## Data Source Contract

This slice should reuse deterministic showcase outputs rather than compute new git state from arbitrary workspace files.

Recommended lookup order:

1. resolve the matched project
2. resolve the deterministic showcase site root under:
   - `.opencow/artifacts/npc-showcase/sites/<project-name>/`
3. treat `index.html` as the current entry file
4. resolve the latest screenshot artifact for the same project under:
   - `.opencow/artifacts/npc-showcase/`
5. resolve showcase-related changed paths from the deterministic site output contract already established by `showcase-site write`

If the showcase site output is missing:

- fail clearly
- suggest running the showcase-site write stage first

If the screenshot artifact is missing:

- fail clearly unless the earlier showcase metadata already guarantees a deterministic screenshot path

If the workflow cannot determine whether the user is asking for a `commit`-oriented or `push`-oriented next step:

- default to `commit`
- state that push remains a later, higher-risk option

## Result Contract

Minimum returned fields:

- `project_name`
- `project_path`
- `site_root`
- `entry_file`
- `changed_paths`
- `source_screenshot_path`
- `recommended_git_action`
- `required_confirmation_stage`
- `summary`

Result wording should include:

- matched project identity
- generated site root
- entry file
- screenshot artifact path
- explicit changed paths
- recommended next git action
- note that this is the readonly git-confirmation-preview stage, not git execution
- note that earlier showcase write permission does not authorize commit or push

## Permission Boundary Design

This slice remains fully readonly.

Permission requirements:

- no `workspace-write` escalation for this preview stage
- no reuse of earlier `workspace-write` approval as implicit git approval
- no dangerous confirmation modal during this preview stage

Boundary to later stages:

- a future `git commit` execution slice may require its own permission or confirmation boundary depending on the final command surface
- a future `git push` execution slice must remain separately confirmable from commit because it crosses from local mutation into remote side effect
- neither later stage is included in this slice

## App Flow Design

Required user-visible chain:

1. composer submit with explicit NPC git-step preview wording
2. final readonly git-confirmation-preview result

Required assertions:

- no permission dialog appears
- no dangerous confirmation dialog appears
- final result remains NPC-specific
- showcase-related changed paths and artifact paths are visible
- result explicitly says commit or push still requires a later separate confirmation stage

## Error Handling

If no matched local project can be resolved:

- fail clearly

If no generated showcase site output is available:

- fail clearly
- suggest running the showcase-site write stage first

If no publish-preview-eligible context exists yet:

- fail clearly
- suggest reviewing the publish-preview stage before asking for the git stage

If artifact lookup finds ambiguous or unrelated paths:

- prefer the deterministic project-scoped showcase output
- otherwise fail instead of guessing

## Verification Shape

The eventual implementation batch should be verifiable with focused checks across:

```bash
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.npc-showcase.test.ts
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-showcase.test.ts src/app/app.npc-showcase.test.tsx
npm --workspace apps/desktop exec tsc --noEmit
```

Expected proof points:

- planner maps explicit git-step preview wording into `npc-local-project-showcase-git-confirmation-preview`
- assistant execution returns readonly git-specific context instead of falling back to publish-preview or generic git status
- app flow shows a final result without any permission or confirmation modal
- no git command is executed in this slice
