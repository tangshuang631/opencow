# Desktop Real File Rollback Design

## 1. Goal

This slice upgrades desktop rollback from a UI-only state reset into a real local file restore capability.

The target behavior is:

- rollback remains anchored to user messages
- each desktop conversation keeps its own rollback history
- the rollback window is selectable as `5 / 10 / 20`
- confirming rollback restores both:
  - conversation and task state
  - real local file contents

The rollback target for a user message is the state immediately after the user sent that message and before the assistant completed later work.

## 2. Why This Change

The current workbench rollback only restores frontend state snapshots.

That is not enough for a desktop coding product because the visible assistant history can be rewound while local files stay changed. This creates an inconsistent state:

- the conversation looks reverted
- the workspace files are still mutated
- users cannot trust rollback as a real undo boundary

For OpenCow, rollback needs to behave like a conversation-scoped local restore point, not like a visual-only preview reset.

## 3. Chosen Approach

The chosen approach is `conversation-scoped full file snapshots`.

Before a file is changed during a conversation turn, OpenCow records the file's pre-change state once for that rollback anchor. When the user confirms rollback, OpenCow restores all recorded file snapshots created after the target anchor.

Why this approach:

- it is simple and reliable for create, modify, and delete cases
- it does not depend on Git
- it matches desktop product expectations for local files outside version control
- it is easier to reason about than diff replay

Rejected alternatives:

- diff-based rollback: smaller storage, but much more fragile for deletes, repeated rewrites, binary files, and partial failures
- Git-only rollback: does not cover unmanaged files, knowledge files, config files, or users working outside a clean repository state

## 4. Product Behavior

### 4.1 Rollback scope

Rollback counting is based on user messages only.

Assistant messages, system notices, task rows, and intermediate planner steps do not count as rollback anchors.

The rollback window offers exactly three options:

- `5`
- `10`
- `20`

These values represent the maximum number of recent user-message anchors preserved for the current conversation.

### 4.2 Conversation isolation

Rollback state and file snapshots are isolated per conversation.

If the user opens another conversation window or restores a different recent conversation, its rollback journal and file snapshot registry remain separate. A rollback in one conversation must never restore files from another conversation's rollback lineage.

### 4.3 Confirmation behavior

When the user clicks the rollback action under a user message and confirms:

- assistant messages after that user message are removed
- local task progress after that user message is removed
- output, audit, and transient UI state are restored to the selected anchor
- real local files touched after that anchor are restored

The user-visible result is that the workbench returns to the moment right after that user message was sent, as if later assistant work had not happened yet.

### 4.4 File restore behavior

OpenCow must support these file cases:

- modified existing file: restore previous content
- newly created file: delete it during rollback
- deleted existing file: recreate it with previous content

OpenCow should treat file content as opaque bytes so text and binary payloads can both be restored.

## 5. Architecture

The implementation is split into two layers.

### 5.1 Frontend rollback journal

The existing workbench rollback journal remains the source of truth for:

- rollback entries
- pending preview state
- restored conversation state
- user-message anchor selection
- active rollback limit per conversation

This layer continues to manage the UI and state rollback flow.

### 5.2 Native file snapshot store

A new Tauri-backed file snapshot capability becomes the source of truth for:

- recording pre-change file snapshots
- associating snapshots with conversation id and rollback entry id
- pruning old snapshots when user-message anchors fall out of retention
- restoring files for a confirmed rollback

The native side is required because the browser layer should not pretend it can safely restore real workspace files by itself.

## 6. Data Model

### 6.1 Frontend rollback metadata

The workbench rollback state needs explicit conversation-scoped metadata for user-message retention.

The existing rollback state should be extended to represent:

- selected rollback limit: one of `5 | 10 | 20`
- user-message anchor ids retained for this conversation
- file rollback availability for preview and apply flows

The current generic `defaultLimit / activeLimit / maxLimit` model should be narrowed so the UI only exposes the supported product values.

### 6.2 Native file snapshot record

Each snapshot record should include at least:

- `conversationId`
- `rollbackEntryId`
- `path`
- `existedBefore`
- `contentBytes`

This is enough to restore create, modify, and delete behavior.

Recommended additional metadata:

- `recordedAt`
- `sizeBytes`

These support audit output and possible future storage safeguards.

### 6.3 Snapshot grouping

Snapshots should be grouped by:

- conversation id
- rollback entry id

Within one rollback entry, the same file should only be snapshotted once. If a task edits the same file multiple times after the anchor, the restore target is still the pre-change state captured before the first mutation in that anchor scope.

## 7. Mutation Capture Rules

OpenCow must record file snapshots before local writes occur.

The snapshot hook should sit at the desktop-side file mutation boundary rather than at ad hoc UI actions. That means:

- workspace write commands
- NPC config writes
- knowledge import writes
- generated file writes
- cleanup and delete operations

All of these should go through a shared snapshot-aware file mutation helper.

Rules:

- capture only once per `conversationId + rollbackEntryId + path`
- do nothing when no rollback anchor is active
- record `existedBefore = false` for new files
- record full bytes for existing files before overwrite or delete

## 8. Rollback Apply Flow

Rollback apply should become a two-phase operation.

### 8.1 Phase 1: native file restore

When the user confirms rollback:

1. collect all rollback entries newer than the target entry in the current conversation
2. ask the native snapshot store to restore all files touched by those entries
3. restore in reverse chronological order of anchors, but de-duplicate by path so the oldest relevant pre-change snapshot wins

If file restore fails, the frontend state must not claim rollback succeeded.

### 8.2 Phase 2: frontend state restore

Only after native restore succeeds:

1. apply the existing workbench state rollback snapshot
2. clear pending preview
3. remove later assistant output and task artifacts
4. write a rollback audit event

This ordering avoids UI/file divergence.

## 9. Persistence And Pruning

The rollback journal is already persisted with workbench state. The new file snapshot store should persist independently on the desktop side.

Pruning rules:

- keep snapshots only for retained user-message anchors in that conversation
- when the user lowers the limit from `20` to `10` or `5`, prune older conversation anchors and their snapshot bundles
- when a conversation is deleted, remove its snapshot registry
- when a rollback is applied, remove snapshots for discarded later anchors

The browser-persisted state should not store raw file contents.

## 10. Error Handling

If snapshot capture fails before a file mutation:

- block that mutation
- surface a Chinese error explaining that OpenCow could not create a rollback snapshot, so the file change was not executed

If rollback restore fails:

- do not apply frontend rollback state
- surface a Chinese error explaining that local files were not fully restored
- preserve the pending rollback preview so the user can retry or cancel

If some files no longer have accessible parent directories during restore, OpenCow should recreate missing parents where possible before writing the restored file.

## 11. Testing

This slice requires both frontend and native coverage.

### 11.1 Frontend tests

Add or update tests for:

- rollback anchor counting uses user messages only
- rollback limit options clamp to `5 / 10 / 20`
- rollback confirmation removes later assistant messages
- frontend state rollback is not applied when native file restore fails
- each conversation uses an independent rollback lineage

### 11.2 Native tests

Add tests for:

- snapshot modified file then restore original content
- snapshot deleted file then recreate original content
- snapshot new file then delete it on rollback
- multiple writes to the same file within one anchor capture only one pre-change snapshot
- pruning old anchors removes their snapshot bundles

### 11.3 Integration tests

Add desktop integration coverage for:

- submitting a user message that triggers a local file write
- confirming rollback from that user message
- verifying both the conversation state and real file content are restored

## 12. Out Of Scope

This slice does not include:

- cross-conversation global rollback
- Git commit or branch rollback
- diff visualization UI
- multi-user shared rollback
- cloud sync of rollback snapshots

## 13. Success Criteria

This slice is complete when all of the following are true:

- the rollback limit UI only exposes `5 / 10 / 20`
- limits are counted by user messages only
- each conversation keeps its own rollback/file snapshot history
- confirming rollback restores real local files as well as chat state
- newly created files after the target anchor disappear after rollback
- deleted files after the target anchor reappear after rollback
- assistant messages after the selected user message are removed after rollback
