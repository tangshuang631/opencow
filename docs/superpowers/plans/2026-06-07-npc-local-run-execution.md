# NPC Local Run Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first non-preview NPC showcase execution step by introducing `npc-local-project-run` as a permission-backed NPC local run path that reuses the existing matched-project run lifecycle.

**Architecture:** Extend the adapter planner with one new fixed execution kind, keep the permission request and queued execution identity NPC-specific, and dispatch execution through the existing `runWorkspaceProject(...)` desktop service call. Do not add a new Tauri command or a parallel runtime chain. Add focused planner, desktop-service, and app-level tests before implementation and keep the slice strictly limited to the run stage.

**Tech Stack:** TypeScript, Vitest, React Testing Library, Tauri desktop service bridge, existing local project lifecycle runtime

---

### Task 1: Add Planner Support For `npc-local-project-run`

**Files:**
- Modify: `packages/openclaw-adapter/src/types.ts`
- Modify: `packages/openclaw-adapter/src/localAssistantPlan.ts`
- Modify: `packages/openclaw-adapter/src/localAssistantPlan.npc-showcase.test.ts`

- [ ] **Step 1: Write the failing planner tests**

```ts
import { describe, expect, it } from "vitest";
import { planLocalAssistantTask } from "./index.js";

describe("local assistant task planner npc showcase workflow", () => {
  it("requests workspace-write before running a matched npc showcase project", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to run the matched cattle project now",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "npc-local-project-run",
      queuedExecutionTitle: "NPC local project run"
    });
  });

  it("plans the npc local project run after workspace-write is approved", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to run the matched cattle project now",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-project-run",
      title: "NPC local project run"
    });
  });
});
```

- [ ] **Step 2: Run the planner test to verify it fails**

Run:

```powershell
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.npc-showcase.test.ts
```

Expected:

```text
FAIL
Expected queuedExecutionKind "npc-local-project-run" or kind "npc-local-project-run", but received the current preview-only behavior.
```

- [ ] **Step 3: Add the new planner type and branch**

```ts
// packages/openclaw-adapter/src/types.ts
| {
    readonly kind: "npc-local-project-run";
    readonly title: string;
    readonly summary: string;
    readonly auditSummary: string;
    readonly auditDetail: string;
  }
```

```ts
// packages/openclaw-adapter/src/localAssistantPlan.ts
if (
  /\bnpc\b/i.test(message)
  && /collaboration/i.test(message)
  && npcShowcaseProjectPatterns.some((pattern) => pattern.test(message))
  && (/\brun\b/i.test(message) || /\bstart\b/i.test(message) || /\blaunch\b/i.test(message))
  && !npcShowcaseOutputPatterns.some((pattern) => pattern.test(message))
) {
  if (request.permissionMode === "readonly") {
    return {
      kind: "permission-request",
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before NPC collaboration can launch the matched local project.",
      riskSummary:
        "This task launches only the matched local workspace project through the existing project-run path, keeps execution inside the approved workspace, and must remain audit-visible.",
      auditSummary: "Local assistant task requires workspace-write permission for an NPC local project run.",
      auditDetail: `NPC local project run task is waiting for permission: ${message}`,
      queuedExecutionKind: "npc-local-project-run",
      queuedExecutionTitle: "NPC local project run",
      queuedExecutionAuditSummary: "Local assistant planned an NPC local project run.",
      queuedExecutionAuditDetail: `NPC local project run task: ${message}`,
      queuedMessage: message
    };
  }

  return {
    kind: "npc-local-project-run",
    title: "NPC local project run",
    summary: message,
    auditSummary: "Local assistant planned an NPC local project run.",
    auditDetail: `NPC local project run task: ${message}`
  };
}
```

- [ ] **Step 4: Run the planner tests to verify they pass**

Run:

```powershell
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.npc-showcase.test.ts src/localAssistantPlan.project-run.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 5: Commit the planner slice**

```powershell
git add packages/openclaw-adapter/src/types.ts packages/openclaw-adapter/src/localAssistantPlan.ts packages/openclaw-adapter/src/localAssistantPlan.npc-showcase.test.ts
git commit -m "feat: plan npc local project run"
```

### Task 2: Add Desktop Execution Support For `npc-local-project-run`

**Files:**
- Modify: `apps/desktop/src/features/workbench/workbenchState.types.ts`
- Modify: `apps/desktop/src/features/assistant/assistantTaskService.ts`
- Modify: `apps/desktop/src/features/assistant/assistantTaskService.npc-showcase.test.ts`

- [ ] **Step 1: Write the failing desktop-service tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { runWorkspaceProjectMock } = vi.hoisted(() => ({
  runWorkspaceProjectMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");
  return {
    ...actual,
    runWorkspaceProject: runWorkspaceProjectMock
  };
});

describe("assistantTaskService npc local run", () => {
  it("requests workspace-write before running the matched npc showcase project", () => {
    const plan = planAssistantTask("use npc collaboration to run the matched cattle project now", "readonly");

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "npc-local-project-run"
    });
  });

  it("runs the matched local project through the existing desktop lifecycle with npc-specific identity", async () => {
    runWorkspaceProjectMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "projects/cattle",
      command_label: "npm run dev",
      working_directory: "projects/cattle",
      expected_url: "http://127.0.0.1:3000",
      pid: 5252,
      stdout_preview: "cattle dev server started",
      summary: "Workspace project run started successfully and returned a live local process handle."
    });

    const result = await executeAssistantTask({
      kind: "npc-local-project-run",
      title: "NPC local project run",
      summary: "use npc collaboration to run the matched cattle project now",
      auditSummary: "Local assistant planned an NPC local project run.",
      auditDetail: "NPC local project run task."
    } as const);

    expect(result.resultTitle).toBe("NPC local project run");
    expect(result.resultSummary).toContain("cattle");
    expect(result.resultSummary).toContain("projects/cattle");
    expect(result.resultSummary).toContain("npm run dev");
    expect(result.resultSummary).toContain("http://127.0.0.1:3000");
    expect(result.resultSummary).toContain("5252");
    expect(result.resultSummary).toContain("first executed stage inside the NPC showcase chain");
  });
});
```

- [ ] **Step 2: Run the desktop-service tests to verify they fail**

Run:

```powershell
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-showcase.test.ts
```

Expected:

```text
FAIL
Unsupported assistant task execution plan: npc-local-project-run
```

- [ ] **Step 3: Add desktop task typing and execution dispatch**

```ts
// apps/desktop/src/features/workbench/workbenchState.types.ts
| "npc-local-project-run"
```

```ts
// apps/desktop/src/features/assistant/assistantTaskService.ts
type LocalAssistantTaskPlan =
  | {
      kind: "npc-local-project-run";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  // existing variants...
```

```ts
if (plan.kind === "npc-local-project-run") {
  return executeNpcLocalProjectRunPlan(plan.title, plan.summary);
}

async function executeNpcLocalProjectRunPlan(
  resultTitle: string,
  query: string
): Promise<AssistantTaskExecutionResult> {
  const result = await runWorkspaceProject(query);

  return {
    resultTitle,
    resultSummary:
      `${result.summary} Matched project: ${result.project_name}. Path: ${result.project_path}. ` +
      `Command: ${result.command_label}. Expected URL: ${result.expected_url}. PID: ${result.pid}. ` +
      `This is the first executed stage inside the NPC showcase chain.`
  };
}
```

- [ ] **Step 4: Run the desktop-service tests to verify they pass**

Run:

```powershell
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-showcase.test.ts src/features/assistant/assistantTaskService.project-run.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 5: Commit the desktop execution slice**

```powershell
git add apps/desktop/src/features/workbench/workbenchState.types.ts apps/desktop/src/features/assistant/assistantTaskService.ts apps/desktop/src/features/assistant/assistantTaskService.npc-showcase.test.ts
git commit -m "feat: execute npc local project run"
```

### Task 3: Add App-Level Coverage For NPC Local Run Execution

**Files:**
- Create: `apps/desktop/src/app/app.npc-showcase.test.tsx`

- [ ] **Step 1: Write the failing app-level conversation test**

```tsx
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const { loadOllamaOverviewMock, runWorkspaceProjectMock } = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn(),
  runWorkspaceProjectMock: vi.fn()
}));

vi.mock("../features/ollama/ollamaService", () => ({
  loadOllamaOverview: loadOllamaOverviewMock
}));

vi.mock("../features/assistant/localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("../features/assistant/localAssistantService")>(
    "../features/assistant/localAssistantService"
  );

  return {
    ...actual,
    runWorkspaceProject: runWorkspaceProjectMock
  };
});

describe("App npc local run flow", () => {
  it("continues from npc showcase run permission approval into the final run result", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    runWorkspaceProjectMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "projects/cattle",
      command_label: "npm run dev",
      working_directory: "projects/cattle",
      expected_url: "http://127.0.0.1:3000",
      pid: 5252,
      stdout_preview: "cattle dev server started",
      summary: "Workspace project run started successfully and returned a live local process handle."
    });

    const { container } = render(<App />);
    await screen.findAllByText("qwen2.5-coder:7b");

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "use npc collaboration to run the matched cattle project now" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const inspectorPanel = await screen.findByRole("complementary", { name: "鍙充晶闈㈡澘" });
    const permissionSection = within(inspectorPanel).getByRole("heading", { name: "鏉冮檺纭" }).closest("section");
    const approvePermissionButton = await within(permissionSection as HTMLElement).findByRole("button", {
      name: "鎵瑰噯鎻愭潈"
    });

    fireEvent.click(approvePermissionButton);

    await waitFor(() => {
      expect(
        screen.getAllByText(/NPC local project run|cattle|projects\/cattle|npm run dev|http:\/\/127\.0\.0\.1:3000|5252/i).length
      ).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Run the app-level test to verify it fails**

Run:

```powershell
npm --workspace apps/desktop exec vitest run src/app/app.npc-showcase.test.tsx
```

Expected:

```text
FAIL
Unable to find NPC local project run result because the execution kind is not wired through the app flow yet.
```

- [ ] **Step 3: Add any minimal app wiring required**

```ts
// No app-specific production wiring is expected for this slice.
// The app flow should accept the new execution kind through the existing
// queued local task pipeline once the desktop task union is extended.
// This step is satisfied by confirming that `app.npc-showcase.test.tsx`
// passes without modifying `App.tsx`.
```

- [ ] **Step 4: Run focused app and module verification**

Run:

```powershell
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.npc-showcase.test.ts src/localAssistantPlan.project-run.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-showcase.test.ts src/features/assistant/assistantTaskService.project-run.test.ts src/app/app.npc-showcase.test.tsx
npm --workspace apps/desktop exec tsc --noEmit
```

Expected:

```text
PASS
```

- [ ] **Step 5: Commit the app coverage slice**

```powershell
git add apps/desktop/src/app/app.npc-showcase.test.tsx apps/desktop/src/app/App.tsx
git commit -m "test: cover npc local run app flow"
```

### Task 4: Final Verification And Checkpoint

**Files:**
- Modify: none expected beyond prior tasks

- [ ] **Step 1: Run the full focused verification set again**

Run:

```powershell
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.npc-showcase.test.ts src/localAssistantPlan.project-run.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-showcase.test.ts src/features/assistant/assistantTaskService.project-run.test.ts src/app/app.npc-showcase.test.tsx
npm --workspace apps/desktop exec tsc --noEmit
```

Expected:

```text
PASS
```

- [ ] **Step 2: Review worktree before push**

Run:

```powershell
git status --short
git diff --stat
```

Expected:

```text
Only the intended NPC local run execution files are modified.
```

- [ ] **Step 3: Create the checkpoint commit**

```powershell
git add packages/openclaw-adapter/src/types.ts packages/openclaw-adapter/src/localAssistantPlan.ts packages/openclaw-adapter/src/localAssistantPlan.npc-showcase.test.ts apps/desktop/src/features/workbench/workbenchState.types.ts apps/desktop/src/features/assistant/assistantTaskService.ts apps/desktop/src/features/assistant/assistantTaskService.npc-showcase.test.ts apps/desktop/src/app/app.npc-showcase.test.tsx
git commit -m "feat: add npc local project run execution"
```

- [ ] **Step 4: Push when network is available**

Run:

```powershell
git push origin dev
```

Expected:

```text
dev -> dev
```
