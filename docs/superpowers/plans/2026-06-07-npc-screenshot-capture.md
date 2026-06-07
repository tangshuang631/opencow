# NPC Screenshot Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the next smallest real NPC showcase execution slice by introducing `npc-local-project-screenshot-capture` as a permission-backed screenshot path that returns traceable workspace-local artifact paths.

**Architecture:** Extend the adapter planner with one new fixed execution kind, keep permission and queued execution identity NPC-specific, and add one tightly scoped desktop screenshot capture surface. The desktop path should resolve the matched running local project through the existing runtime-backed project lifecycle, capture a screenshot into `.opencow/artifacts/npc-showcase`, and return artifact metadata without expanding into gallery management, showcase-site generation, or git actions.

**Tech Stack:** TypeScript, Vitest, React Testing Library, Tauri desktop command bridge, Rust workspace command module, Windows headless browser screenshot execution

---

### Task 1: Add Planner Support For `npc-local-project-screenshot-capture`

**Files:**
- Modify: `packages/openclaw-adapter/src/types.ts`
- Modify: `packages/openclaw-adapter/src/localAssistantPlan.ts`
- Modify: `packages/openclaw-adapter/src/localAssistantPlan.npc-showcase.test.ts`

- [ ] **Step 1: Write the failing planner tests**

```ts
import { describe, expect, it } from "vitest";
import { planLocalAssistantTask } from "./index.js";

describe("local assistant task planner npc showcase workflow", () => {
  it("requests workspace-write before capturing a matched npc showcase screenshot", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to capture a screenshot from the matched cattle project now",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "npc-local-project-screenshot-capture",
      queuedExecutionTitle: "NPC local project screenshot capture"
    });
  });

  it("plans npc screenshot capture after workspace-write is approved", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to capture a screenshot from the matched cattle project now",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-project-screenshot-capture",
      title: "NPC local project screenshot capture"
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
Expected queuedExecutionKind "npc-local-project-screenshot-capture" or kind "npc-local-project-screenshot-capture", but received the current preview-only or generic NPC behavior.
```

- [ ] **Step 3: Add the new planner type and branch**

```ts
// packages/openclaw-adapter/src/types.ts
| {
    readonly kind: "npc-local-project-screenshot-capture";
    readonly title: string;
    readonly summary: string;
    readonly auditSummary: string;
    readonly auditDetail: string;
  }
```

```ts
// packages/openclaw-adapter/src/localAssistantPlan.ts
const npcShowcaseScreenshotPatterns = [/\bscreenshot\b/i, /\bcapture\b/i, /截图/, /截屏/];

if (
  /\bnpc\b/i.test(message)
  && /collaboration/i.test(message)
  && npcShowcaseProjectPatterns.some((pattern) => pattern.test(message))
  && npcShowcaseScreenshotPatterns.some((pattern) => pattern.test(message))
  && (/\bnow\b/i.test(message) || /\bcapture\b/i.test(message) || /\btake\b/i.test(message))
  && !npcShowcaseOutputPatterns.some((pattern) => pattern.test(message))
) {
  if (request.permissionMode === "readonly") {
    return {
      kind: "permission-request",
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before NPC collaboration can capture a screenshot from the matched local project.",
      riskSummary:
        "This task captures only a task-scoped screenshot artifact for the matched running local workspace project, writes it inside the approved workspace, and must remain audit-visible.",
      auditSummary: "Local assistant task requires workspace-write permission for NPC local project screenshot capture.",
      auditDetail: `NPC local project screenshot capture task is waiting for permission: ${message}`,
      queuedExecutionKind: "npc-local-project-screenshot-capture",
      queuedExecutionTitle: "NPC local project screenshot capture",
      queuedExecutionAuditSummary: "Local assistant planned NPC local project screenshot capture.",
      queuedExecutionAuditDetail: `NPC local project screenshot capture task: ${message}`,
      queuedMessage: message
    };
  }

  return {
    kind: "npc-local-project-screenshot-capture",
    title: "NPC local project screenshot capture",
    summary: message,
    auditSummary: "Local assistant planned NPC local project screenshot capture.",
    auditDetail: `NPC local project screenshot capture task: ${message}`
  };
}
```

- [ ] **Step 4: Run the planner tests to verify they pass**

Run:

```powershell
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.npc-showcase.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 5: Commit the planner slice**

```powershell
git add packages/openclaw-adapter/src/types.ts packages/openclaw-adapter/src/localAssistantPlan.ts packages/openclaw-adapter/src/localAssistantPlan.npc-showcase.test.ts
git commit -m "feat: plan npc screenshot capture"
```

### Task 2: Add Desktop Screenshot Capture Service And Tauri Command

**Files:**
- Modify: `apps/desktop/src/features/assistant/localAssistantService.ts`
- Modify: `apps/desktop/src-tauri/src/workspace.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing service and Rust tests**

```ts
// apps/desktop/src/features/assistant/localAssistantService.ts
export type WorkspaceProjectNpcScreenshotCaptureResult = {
  project_name: string;
  project_path: string;
  expected_url: string | null;
  artifact_path: string;
  artifact_directory: string;
  capture_target: string;
  summary: string;
};
```

```rust
// apps/desktop/src-tauri/src/workspace.rs
#[test]
fn workspace_project_npc_screenshot_capture_returns_error_without_active_runtime_handle() {
    let workspace_root = create_workspace_project_run_fixture();
    let _guard = acquire_workspace_test_lock();
    std::env::set_current_dir(&workspace_root).unwrap();

    let error = workspace_project_npc_screenshot_capture(
        "use npc collaboration to capture a screenshot from the matched cattle project now".to_string()
    )
    .unwrap_err();

    assert!(error.contains("No active matched local project run"));
}

#[test]
fn build_npc_showcase_screenshot_artifact_path_stays_inside_workspace_artifacts_root() {
    let workspace_root = PathBuf::from("E:/2026/opencow");
    let artifact_path = build_npc_showcase_screenshot_artifact_path(&workspace_root, "cattle", "1700000000");

    assert!(artifact_path.ends_with(".png"));
    assert!(artifact_path.to_string_lossy().contains(".opencow/artifacts/npc-showcase"));
    assert!(artifact_path.to_string_lossy().contains("cattle-screenshot-1700000000"));
}
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```powershell
cargo test workspace_project_npc_screenshot_capture --manifest-path apps/desktop/src-tauri/Cargo.toml -- --nocapture
```

Expected:

```text
FAIL
cannot find function `workspace_project_npc_screenshot_capture`
```

- [ ] **Step 3: Add the desktop service result type, browser preview fallback, and invoke bridge**

```ts
// apps/desktop/src/features/assistant/localAssistantService.ts
export async function captureNpcLocalProjectScreenshot(
  query: string
): Promise<WorkspaceProjectNpcScreenshotCaptureResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewNpcProjectScreenshotCapture(query);
  }

  return invoke<WorkspaceProjectNpcScreenshotCaptureResult>("workspace_project_npc_screenshot_capture", {
    query
  });
}

function createBrowserPreviewNpcProjectScreenshotCapture(
  query: string
): WorkspaceProjectNpcScreenshotCaptureResult {
  const prefersCattle = /\bcattle\b/i.test(query);

  return {
    project_name: prefersCattle ? "cattle" : "workspace-project",
    project_path: prefersCattle ? "projects/cattle" : "apps/example",
    expected_url: prefersCattle ? "http://127.0.0.1:3000" : "http://127.0.0.1:1420",
    artifact_path: ".opencow/artifacts/npc-showcase/cattle-screenshot-browser-preview.png",
    artifact_directory: ".opencow/artifacts/npc-showcase",
    capture_target: prefersCattle ? "http://127.0.0.1:3000" : "http://127.0.0.1:1420",
    summary: "Browser preview mode returned a mock NPC local project screenshot capture result."
  };
}
```

- [ ] **Step 4: Add the Rust command, artifact-path helper, and command registration**

```rust
// apps/desktop/src-tauri/src/workspace.rs
#[derive(Serialize)]
pub struct WorkspaceProjectNpcScreenshotCaptureResult {
    project_name: String,
    project_path: String,
    expected_url: Option<String>,
    artifact_path: String,
    artifact_directory: String,
    capture_target: String,
    summary: String,
}

#[tauri::command]
pub fn workspace_project_npc_screenshot_capture(
    query: String,
) -> Result<WorkspaceProjectNpcScreenshotCaptureResult, String> {
    let root = workspace_root()?;
    let candidates = collect_workspace_project_run_candidates(&root)?;
    let matched = select_workspace_project_run_candidate(&query, &candidates)
        .ok_or_else(|| format!("No matched local project run candidate was found for screenshot capture: {}", query))?;
    let _record = find_workspace_project_runtime_record(&root, &matched.relative_path)?
        .ok_or_else(|| format!("No active matched local project run is available for NPC screenshot capture: {}", query))?;
    let expected_url = infer_expected_local_url(&matched);
    let capture_target = expected_url
        .clone()
        .ok_or_else(|| format!("No capture target URL could be inferred for NPC screenshot capture: {}", matched.name))?;
    let timestamp = current_unix_timestamp_string();
    let artifact_path = build_npc_showcase_screenshot_artifact_path(&root, &matched.name, &timestamp);

    capture_url_to_png_via_edge(&capture_target, &artifact_path)?;

    Ok(WorkspaceProjectNpcScreenshotCaptureResult {
        project_name: matched.name.clone(),
        project_path: matched.relative_path.clone(),
        expected_url,
        artifact_path: to_workspace_relative_display_path(&root, &artifact_path),
        artifact_directory: ".opencow/artifacts/npc-showcase".to_string(),
        capture_target,
        summary: "NPC local project screenshot capture completed successfully and wrote a workspace-local artifact.".to_string(),
    })
}

fn build_npc_showcase_screenshot_artifact_path(root: &Path, project_name: &str, timestamp: &str) -> PathBuf {
    root.join(".opencow")
        .join("artifacts")
        .join("npc-showcase")
        .join(format!("{}-screenshot-{}.png", sanitize_artifact_segment(project_name), timestamp))
}
```

```rust
// apps/desktop/src-tauri/src/lib.rs
workspace::workspace_project_npc_screenshot_capture,
```

- [ ] **Step 5: Run the focused service and Rust tests to verify they pass**

Run:

```powershell
cargo test workspace_project_npc_screenshot_capture --manifest-path apps/desktop/src-tauri/Cargo.toml -- --nocapture
npm --workspace apps/desktop exec tsc --noEmit
```

Expected:

```text
PASS
```

- [ ] **Step 6: Commit the desktop screenshot surface**

```powershell
git add apps/desktop/src/features/assistant/localAssistantService.ts apps/desktop/src-tauri/src/workspace.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: add npc screenshot capture service"
```

### Task 3: Add Assistant Execution Support For `npc-local-project-screenshot-capture`

**Files:**
- Modify: `apps/desktop/src/features/workbench/workbenchState.types.ts`
- Modify: `apps/desktop/src/features/assistant/assistantTaskService.ts`
- Modify: `apps/desktop/src/features/assistant/assistantTaskService.npc-showcase.test.ts`

- [ ] **Step 1: Write the failing assistant execution tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { captureNpcLocalProjectScreenshotMock } = vi.hoisted(() => ({
  captureNpcLocalProjectScreenshotMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");
  return {
    ...actual,
    captureNpcLocalProjectScreenshot: captureNpcLocalProjectScreenshotMock
  };
});

describe("assistantTaskService npc screenshot capture", () => {
  it("requests workspace-write before capturing a matched npc showcase screenshot", () => {
    const plan = planAssistantTask(
      "use npc collaboration to capture a screenshot from the matched cattle project now",
      "readonly"
    );

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "npc-local-project-screenshot-capture"
    });
  });

  it("captures the matched local project screenshot with npc-specific identity", async () => {
    captureNpcLocalProjectScreenshotMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "projects/cattle",
      expected_url: "http://127.0.0.1:3000",
      artifact_path: ".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png",
      artifact_directory: ".opencow/artifacts/npc-showcase",
      capture_target: "http://127.0.0.1:3000",
      summary: "NPC local project screenshot capture completed successfully and wrote a workspace-local artifact."
    });

    const result = await executeAssistantTask({
      kind: "npc-local-project-screenshot-capture",
      title: "NPC local project screenshot capture",
      summary: "use npc collaboration to capture a screenshot from the matched cattle project now",
      auditSummary: "Local assistant planned NPC local project screenshot capture.",
      auditDetail: "NPC local project screenshot capture task."
    } as const);

    expect(result.resultTitle).toBe("NPC local project screenshot capture");
    expect(result.resultSummary).toContain("cattle");
    expect(result.resultSummary).toContain("projects/cattle");
    expect(result.resultSummary).toContain("http://127.0.0.1:3000");
    expect(result.resultSummary).toContain(".opencow/artifacts/npc-showcase");
    expect(result.resultSummary).toContain("screenshot stage");
  });
});
```

- [ ] **Step 2: Run the assistant execution tests to verify they fail**

Run:

```powershell
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-showcase.test.ts
```

Expected:

```text
FAIL
Unsupported assistant task execution plan: npc-local-project-screenshot-capture
```

- [ ] **Step 3: Add task typing and execution dispatch**

```ts
// apps/desktop/src/features/workbench/workbenchState.types.ts
| "npc-local-project-screenshot-capture"
```

```ts
// apps/desktop/src/features/assistant/assistantTaskService.ts
import { captureNpcLocalProjectScreenshot } from "./localAssistantService";

type ReadonlyAssistantTaskPlan =
  | {
      kind: "npc-local-project-screenshot-capture";
      title: string;
      summary: string;
      auditSummary: string;
      auditDetail: string;
    }
  // existing variants...

if (plan.kind === "npc-local-project-screenshot-capture") {
  return executeNpcLocalProjectScreenshotCapturePlan(plan.title, plan.summary);
}

async function executeNpcLocalProjectScreenshotCapturePlan(
  resultTitle: string,
  query: string
): Promise<AssistantTaskExecutionResult> {
  const result = await captureNpcLocalProjectScreenshot(query);

  return {
    resultTitle,
    resultSummary:
      `${result.summary} Matched project: ${result.project_name}. Path: ${result.project_path}. ` +
      `Capture target: ${result.capture_target}. Artifact path: ${result.artifact_path}. ` +
      `Artifact directory: ${result.artifact_directory}. This is the screenshot stage inside the NPC showcase chain.`
  };
}
```

- [ ] **Step 4: Run the assistant execution tests to verify they pass**

Run:

```powershell
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-showcase.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 5: Commit the assistant execution slice**

```powershell
git add apps/desktop/src/features/workbench/workbenchState.types.ts apps/desktop/src/features/assistant/assistantTaskService.ts apps/desktop/src/features/assistant/assistantTaskService.npc-showcase.test.ts
git commit -m "feat: execute npc screenshot capture"
```

### Task 4: Add App-Level Coverage For NPC Screenshot Capture

**Files:**
- Modify: `apps/desktop/src/app/app.npc-showcase.test.tsx`

- [ ] **Step 1: Write the failing app-level screenshot conversation test**

```tsx
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const {
  loadOllamaOverviewMock,
  captureNpcLocalProjectScreenshotMock
} = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn(),
  captureNpcLocalProjectScreenshotMock: vi.fn()
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
    captureNpcLocalProjectScreenshot: captureNpcLocalProjectScreenshotMock
  };
});

describe("App npc screenshot capture flow", () => {
  it("continues from npc screenshot permission approval into the final screenshot result", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    captureNpcLocalProjectScreenshotMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "projects/cattle",
      expected_url: "http://127.0.0.1:3000",
      artifact_path: ".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png",
      artifact_directory: ".opencow/artifacts/npc-showcase",
      capture_target: "http://127.0.0.1:3000",
      summary: "NPC local project screenshot capture completed successfully and wrote a workspace-local artifact."
    });

    const { container } = render(<App />);
    await screen.findAllByText("qwen2.5-coder:7b");

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "use npc collaboration to capture a screenshot from the matched cattle project now" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const permissionReasonMatches = await screen.findAllByText(
      /Workspace write permission is required before NPC collaboration can capture a screenshot from the matched local project\./i
    );
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    fireEvent.click(within(permissionSection as HTMLElement).getAllByRole("button")[0]);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          /NPC local project screenshot capture|cattle|projects\/cattle|http:\/\/127\.0\.0\.1:3000|\.opencow\/artifacts\/npc-showcase/i
        ).length
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
Unable to find the NPC local project screenshot capture result because the execution kind is not wired through the app flow yet.
```

- [ ] **Step 3: Confirm that no `App.tsx` production wiring is required**

```ts
// No App.tsx edit is expected for this slice.
// The existing queued local task pipeline should accept the new execution kind once
// the desktop task union and assistant execution dispatcher are extended.
```

- [ ] **Step 4: Run focused app and module verification**

Run:

```powershell
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.npc-showcase.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-showcase.test.ts src/app/app.npc-showcase.test.tsx
npm --workspace apps/desktop exec tsc --noEmit
```

Expected:

```text
PASS
```

- [ ] **Step 5: Commit the app coverage slice**

```powershell
git add apps/desktop/src/app/app.npc-showcase.test.tsx
git commit -m "test: cover npc screenshot capture app flow"
```

### Task 5: Final Verification And Checkpoint

**Files:**
- Modify: none expected beyond prior tasks

- [ ] **Step 1: Run the full focused verification set again**

Run:

```powershell
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.npc-showcase.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-showcase.test.ts src/app/app.npc-showcase.test.tsx
npm --workspace apps/desktop exec tsc --noEmit
cargo test workspace_project_npc_screenshot_capture --manifest-path apps/desktop/src-tauri/Cargo.toml -- --nocapture
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
Only the intended NPC screenshot capture files are modified.
```

- [ ] **Step 3: Create the checkpoint commit**

```powershell
git add packages/openclaw-adapter/src/types.ts packages/openclaw-adapter/src/localAssistantPlan.ts packages/openclaw-adapter/src/localAssistantPlan.npc-showcase.test.ts apps/desktop/src/features/assistant/localAssistantService.ts apps/desktop/src/features/workbench/workbenchState.types.ts apps/desktop/src/features/assistant/assistantTaskService.ts apps/desktop/src/features/assistant/assistantTaskService.npc-showcase.test.ts apps/desktop/src/app/app.npc-showcase.test.tsx apps/desktop/src-tauri/src/workspace.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: add npc screenshot capture execution"
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
