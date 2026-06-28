# Chat Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build persisted chat attachments for the desktop workbench composer with picker, drag-drop, clipboard paste, message-history rendering, and reopen support.

**Architecture:** Introduce a first-class chat attachment model in workbench state, route composer input methods through one attachment service, persist attachments inside conversation entries and recent-conversation history, and use Tauri commands to pick/open files on macOS and Windows while keeping a browser fallback for tests.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Tauri 2, Rust

---

### Task 1: Define attachment state and persistence

**Files:**
- Modify: `apps/desktop/src/features/workbench/workbenchState.types.ts`
- Modify: `apps/desktop/src/features/workbench/workbenchState.initial.ts`
- Modify: `apps/desktop/src/features/workbench/workbenchState.tasks.ts`
- Modify: `apps/desktop/src/features/workbench/workbenchState.conversation.ts`
- Modify: `apps/desktop/src/features/workbench/workbenchState.persistence.ts`
- Test: `apps/desktop/src/features/workbench/workbenchState.conversation.test.ts`
- Test: `apps/desktop/src/features/workbench/workbenchState.persistence.test.ts`

- [ ] Write failing tests for attachment retention in user messages and persisted conversations.
- [ ] Run the targeted tests and confirm the failures are specifically about missing attachments.
- [ ] Add `ChatAttachment` and `composer.draftAttachments` to state, then copy draft attachments into submitted user entries.
- [ ] Update recent conversation records and persisted-state revival to retain attachments.
- [ ] Re-run the targeted tests until green.

### Task 2: Add attachment service and desktop bridge

**Files:**
- Create: `apps/desktop/src/features/workbench/chatAttachments.ts`
- Test: `apps/desktop/src/features/workbench/chatAttachments.test.ts`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/src/chat_attachments.rs`

- [ ] Write failing tests for picker/open fallback behavior in browser mode.
- [ ] Run the service tests and verify they fail for missing bridge logic.
- [ ] Implement front-end attachment helpers plus Tauri commands for pick/open.
- [ ] Re-run the service tests until green.

### Task 3: Wire composer interactions

**Files:**
- Modify: `apps/desktop/src/features/workbench/components/Composer.tsx`
- Modify: `apps/desktop/src/features/workbench/components/Composer.test.tsx`
- Modify: `apps/desktop/src/features/workbench/Workbench.tsx`
- Modify: `apps/desktop/src/app/App.tsx`
- Modify: `apps/desktop/src/styles/global.css`

- [ ] Write failing component tests for picker click, drag-drop, clipboard image paste, remove attachment, and send-clear behavior.
- [ ] Run the composer tests and confirm they fail on missing attachment UI/handlers.
- [ ] Implement draft attachment UI, drag highlight, paste/drop handling, and app-level callbacks.
- [ ] Re-run the composer tests until green.

### Task 4: Render historical attachments and reopen behavior

**Files:**
- Modify: `apps/desktop/src/features/workbench/components/MainConversation.tsx`
- Modify: `apps/desktop/src/features/workbench/components/MainConversation.test.tsx`
- Modify: `apps/desktop/src/styles/global.css`

- [ ] Write failing tests for rendering multi-attachment history and double-click reopen.
- [ ] Run the conversation tests and verify missing attachment rendering causes failure.
- [ ] Implement shared attachment chips/cards in message history with reopen behavior.
- [ ] Re-run the conversation tests until green.

### Task 5: Final verification

**Files:**
- Modify only as needed from prior tasks

- [ ] Run `npm --workspace apps/desktop run test -- src/features/workbench/components/Composer.test.tsx src/features/workbench/components/MainConversation.test.tsx src/features/workbench/workbenchState.conversation.test.ts src/features/workbench/workbenchState.persistence.test.ts src/features/workbench/chatAttachments.test.ts`
- [ ] Run `npm --workspace apps/desktop run test:unit`
- [ ] Fix any regressions and re-run the same commands until both pass cleanly.
