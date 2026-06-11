# NPC Showcase Git Confirmation Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `npc-local-project-showcase-git-confirmation-preview` as a readonly NPC showcase stage that summarizes current showcase-related context and recommends `commit` or `push` without executing any git write action.

**Architecture:** Extend the adapter planner with one new readonly fixed task kind, then add one tightly scoped desktop assistant summary surface that reuses deterministic showcase metadata already produced by earlier stages. Start with a browser-preview-backed summary path so the core flow is testable without external dependencies, and leave any future Tauri-backed git execution out of scope.

**Tech Stack:** TypeScript, Vitest, desktop assistant service layer, React app task pipeline, deterministic browser preview data

---

### Task 1: Add Planner Support For `npc-local-project-showcase-git-confirmation-preview`

**Files:**
- Modify: `packages/openclaw-adapter/src/types.ts`
- Modify: `packages/openclaw-adapter/src/localAssistantPlan.ts`
- Modify: `packages/openclaw-adapter/src/localAssistantPlan.npc-showcase.test.ts`

- [ ] **Step 1: Write the failing planner tests**
- [ ] **Step 2: Run the focused planner test and confirm red**
- [ ] **Step 3: Add the new readonly planner kind and recognition branch**
- [ ] **Step 4: Run the focused planner test and confirm green**
- [ ] **Step 5: Commit the planner slice**

### Task 2: Add Browser-Preview-Backed Git Confirmation Summary Support

**Files:**
- Modify: `apps/desktop/src/features/assistant/localAssistantService.ts`
- Modify: `apps/desktop/src/features/assistant/assistantTaskService.ts`
- Modify: `apps/desktop/src/features/assistant/assistantTaskService.npc-showcase.test.ts`

- [ ] **Step 1: Write the failing assistant summary tests**
- [ ] **Step 2: Run the focused assistant test and confirm red**
- [ ] **Step 3: Add the new readonly result type, browser preview helper, and assistant execution summary**
- [ ] **Step 4: Run the focused assistant test and confirm green**
- [ ] **Step 5: Run `tsc --noEmit`**
- [ ] **Step 6: Commit the summary slice**

### Task 3: Add App-Level Readonly Flow Coverage

**Files:**
- Modify: `apps/desktop/src/app/app.npc-showcase.test.tsx`

- [ ] **Step 1: Add the failing app flow test**
- [ ] **Step 2: Run the focused app test and confirm red if wiring is missing**
- [ ] **Step 3: Add only the minimal app-layer production code if the existing queue path does not already support the new kind**
- [ ] **Step 4: Run the focused app test and confirm green**
- [ ] **Step 5: Run combined NPC showcase focused verification**
- [ ] **Step 6: Commit the app coverage slice**

### Final Verification

**Files:**
- Verify only touched files for this slice

- [ ] **Step 1: Run focused planner, assistant, and app verification**
- [ ] **Step 2: Run `npm --workspace apps/desktop exec tsc --noEmit`**
- [ ] **Step 3: Inspect diff scope**
- [ ] **Step 4: Commit or squash only if explicitly requested**
- [ ] **Step 5: Push with one retry maximum per thread convention**
