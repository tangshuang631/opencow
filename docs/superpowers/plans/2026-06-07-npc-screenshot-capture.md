# NPC Screenshot Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `npc-local-project-screenshot-capture` as the next permission-backed NPC showcase execution slice so the assistant can capture a real local screenshot and return a traceable workspace-local artifact path.

**Architecture:** Extend the adapter planner with one new fixed execution kind, add one new desktop screenshot capture service plus a tightly scoped Tauri command, and keep the app flow inside the existing permission-backed queued task pipeline. Reuse the existing matched-project lifecycle state to resolve the target project, but do not reuse generic shell or repo-write flows. Keep the slice strictly limited to screenshot capture and returned artifact metadata.

**Tech Stack:** TypeScript, Vitest, React Testing Library, Tauri desktop bridge, Rust, PowerShell/Edge headless screenshot invocation on Windows

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
  it("requests workspace-write before capturing an npc showcase screenshot", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to capture a screenshot from the matched cattle project now",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "npc-local-project-screenshot-capture",
      queuedExecutionTitle: "NPC project screenshot capture"
    });
  });

  it("plans npc showcase screenshot capture after workspace-write is approved", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to capture a screenshot from the matched cattle project now",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-project-screenshot-capture",
      title: "NPC project screenshot capture"
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
Expected queuedExecutionKind "npc-local-project-screenshot-capture" or kind "npc-local-project-screenshot-capture", but received the current preview-only or NPC overview behavior.
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
const npcScreenshotIntentPatterns = [/\bscreenshot\b/i, /\bcapture\b/i, /截图/, /截屏/];

if (
  /\bnpc\b/i.test(message)
  && /collaboration/i.test(message)
  && npcShowcaseProjectPatterns.some((pattern) => pattern.test(message))
  && npcScreenshotIntentPatterns.some((pattern) => pattern.test(message))
  && !npcShowcaseOutputPatterns.some((pattern) => pattern.test(message))
) {
  if (request.permissionMode === "readonly") {
    return {
      kind: "permission-request",
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before NPC collaboration can capture a screenshot artifact from the matched local project.",
      riskSummary:
        "This task captures only a workspace-local screenshot artifact for the matched local project, keeps the artifact inside the approved workspace, and must remain audit-visible.",
      auditSummary: "Local assistant task requires workspace-write permission for NPC screenshot capture.",
      auditDetail: `NPC screenshot capture task is waiting for permission: ${message}`,
      queuedExecutionKind: "npc-local-project-screenshot-capture",
      queuedExecutionTitle: "NPC project screenshot capture",
      queuedExecutionAuditSummary: "Local assistant planned NPC screenshot capture for the matched local project.",
      queuedExecutionAuditDetail: `NPC project screenshot capture task: ${message}`,
      queuedMessage: message
    };
  }

  return {
    kind: "npc-local-project-screenshot-capture",
    title: "NPC project screenshot capture",
    summary: message,
    auditSummary: "Local assistant planned NPC screenshot capture for the matched local project.",
    auditDetail: `NPC project screenshot capture task: ${message}`
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

### Task 2: Add Desktop Screenshot Capture Service And Tauri Bridge

**Files:**
- Modify: `apps/desktop/src/features/assistant/localAssistantService.ts`
- Modify: `apps/desktop/src-tauri/src/workspace.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/src-tauri/Cargo.toml`

- [ ] **Step 1: Write the failing desktop bridge and Rust tests**

```ts
// apps/desktop/src/features/assistant/localAssistantService.ts
export type WorkspaceProjectNpcScreenshotCaptureResult = {
  project_name: string;
  project_path: string;
  expected_url: string;
  artifact_path: string;
  artifact_directory: string;
  stdout_preview: string;
  summary: string;
};
```

```rust
// apps/desktop/src-tauri/src/workspace.rs
#[test]
fn workspace_project_npc_screenshot_capture_returns_error_without_active_runtime_handle() {
    let workspace_root = tempdir().unwrap();
    std::env::set_current_dir(workspace_root.path()).unwrap();
    seed_workspace_project_candidate(workspace_root.path(), "cattle", "projects/cattle", "dev");

    let error = workspace_project_npc_screenshot_capture(
        "use npc collaboration to capture a screenshot from the matched cattle project now".to_string()
    ).unwrap_err();

    assert!(error.contains("No active matched local project run is available"));
}

#[test]
fn workspace_project_npc_screenshot_capture_builds_workspace_local_artifact_path() {
    let artifact_path = build_npc_screenshot_artifact_path(
        Path::new("E:/2026/opencow"),
        "cattle",
        "1700000000"
    );

    assert!(artifact_path.ends_with(".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png"));
}
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```powershell
cargo test workspace_project_npc_screenshot_ --manifest-path apps/desktop/src-tauri/Cargo.toml -- --nocapture
```

Expected:

```text
FAIL
cannot find function `workspace_project_npc_screenshot_capture`
```

- [ ] **Step 3: Add the service result type, browser preview fallback, and Tauri invoke call**

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
    project_name: prefersCattle ? "cattle" : "desktop",
    project_path: prefersCattle ? "projects/cattle" : "apps/desktop",
    expected_url: prefersCattle ? "http://127.0.0.1:3000" : "http://127.0.0.1:1420",
    artifact_directory: ".opencow/artifacts/npc-showcase",
    artifact_path: prefersCattle
      ? ".opencow/artifacts/npc-showcase/cattle-screenshot-browser-preview.png"
      : ".opencow/artifacts/npc-showcase/desktop-screenshot-browser-preview.png",
    stdout_preview: "browser preview mode simulated a workspace-local NPC screenshot artifact",
    summary: "Browser preview mode returned a mock NPC screenshot capture result."
  };
}
```

```rust
// apps/desktop/src-tauri/src/workspace.rs
#[derive(Serialize)]
pub struct WorkspaceProjectNpcScreenshotCaptureResult {
    project_name: String,
    project_path: String,
    expected_url: String,
    artifact_path: String,
    artifact_directory: String,
    stdout_preview: String,
    summary: String,
}

#[tauri::command]
pub fn workspace_project_npc_screenshot_capture(
    query: String,
) -> Result<WorkspaceProjectNpcScreenshotCaptureResult, String> {
    let root = workspace_root()?;
    let candidates = collect_workspace_project_run_candidates(&root)?;
    let matched = match_workspace_project_candidate(&query, &candidates)
        .ok_or_else(|| format!("No matched local project was found for screenshot capture: {query}"))?;
    let record = find_workspace_project_runtime_record(&root, &matched.relative_path)?
        .ok_or_else(|| "No active matched local project run is available for NPC screenshot capture.".to_string())?;
    let expected_url = infer_workspace_project_expected_url(&matched)
        .ok_or_else(|| "Could not infer a capture URL for the matched local project.".to_string())?;
    let timestamp = current_unix_timestamp_string();
    let artifact_path = build_npc_screenshot_artifact_path(&root, &matched.name, &timestamp);

    capture_url_to_png_via_edge(&expected_url, &artifact_path)?;

    Ok(WorkspaceProjectNpcScreenshotCaptureResult {
        project_name: matched.name.clone(),
        project_path: matched.relative_path.clone(),
        expected_url: expected_url.clone(),
        artifact_directory: root
            .join(".opencow")
            .join("artifacts")
            .join("npc-showcase")
            .display()
            .to_string(),
        artifact_path: artifact_path.display().to_string(),
        stdout_preview: format!("Captured screenshot for {} at {}", expected_url, artifact_path.display()),
        summary: format!(
            "NPC screenshot capture completed successfully for the matched local project run (pid {}).",
            record.pid
        ),
    })
}

fn build_npc_screenshot_artifact_path(root: &Path, project_name: &str, timestamp: &str) -> PathBuf {
    root.join(".opencow")
        .join("artifacts")
        .join("npc-showcase")
        .join(format!("{project_name}-screenshot-{timestamp}.png"))
}

fn capture_url_to_png_via_edge(url: &str, artifact_path: &Path) -> Result<(), String> {
    if let Some(parent) = artifact_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("Failed to create screenshot artifact directory: {error}"))?;
    }

    let status = Command::new("msedge")
        .args([
            "--headless",
            "--disable-gpu",
            "--hide-scrollbars",
            "--window-size=1440,1024",
            &format!("--screenshot={}", artifact_path.display()),
            url,
        ])
        .status()
        .map_err(|error| format!("Failed to launch Edge headless screenshot capture: {error}"))?;

    if !status.success() {
        return Err(format!("Edge headless screenshot capture exited with status {status}."));
    }

    Ok(())
}
```

```rust
// apps/desktop/src-tauri/src/lib.rs
workspace::workspace_project_npc_screenshot_capture,
```

- [ ] **Step 4: Run the focused Rust verification to verify it passes**

Run:

```powershell
cargo test workspace_project_npc_screenshot_ --manifest-path apps/desktop/src-tauri/Cargo.toml -- --nocapture
```

Expected:

```text
PASS
```

- [ ] **Step 5: Commit the desktop bridge slice**

```powershell
git add apps/desktop/src/features/assistant/localAssistantService.ts apps/desktop/src-tauri/src/workspace.rs apps/desktop/src-tauri/src/lib.rs apps/desktop/src-tauri/Cargo.toml
git commit -m "feat: add npc screenshot capture bridge"
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
  it("requests workspace-write before capturing an npc showcase screenshot", () => {
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

  it("returns the npc screenshot result with the workspace-local artifact path", async () => {
    captureNpcLocalProjectScreenshotMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "projects/cattle",
      expected_url: "http://127.0.0.1:3000",
      artifact_directory: ".opencow/artifacts/npc-showcase",
      artifact_path: ".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png",
      stdout_preview: "Captured screenshot for http://127.0.0.1:3000",
      summary: "NPC screenshot capture completed successfully for the matched local project run."
    });

    const result = await executeAssistantTask({
      kind: "npc-local-project-screenshot-capture",
      title: "NPC project screenshot capture",
      summary: "use npc collaboration to capture a screenshot from the matched cattle project now",
      auditSummary: "Local assistant planned NPC screenshot capture for the matched local project.",
      auditDetail: "NPC project screenshot capture task."
    } as const);

    expect(result.resultTitle).toBe("NPC project screenshot capture");
    expect(result.resultSummary).toContain("cattle");
    expect(result.resultSummary).toContain("projects/cattle");
    expect(result.resultSummary).toContain("http://127.0.0.1:3000");
    expect(result.resultSummary).toContain(".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png");
    expect(result.resultSummary).toContain("screenshot stage inside the NPC showcase chain");
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

- [ ] **Step 3: Add desktop task typing and execution dispatch**

```ts
// apps/desktop/src/features/workbench/workbenchState.types.ts
| "npc-local-project-screenshot-capture"
```

```ts
// apps/desktop/src/features/assistant/assistantTaskService.ts
import {
  captureNpcLocalProjectScreenshot,
  // existing imports...
} from "./localAssistantService";

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
      `Capture URL: ${result.expected_url}. Artifact directory: ${result.artifact_directory}. ` +
      `Artifact path: ${result.artifact_path}. Preview: ${result.stdout_preview}. ` +
      `This is the screenshot stage inside the NPC showcase chain.`
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

- [ ] **Step 1: Write the failing app-level conversation test**

```tsx
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const { loadOllamaOverviewMock, captureNpcLocalProjectScreenshotMock } = vi.hoisted(() => ({
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
  it("continues from npc screenshot permission approval into the final artifact result", async () => {
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
      artifact_directory: ".opencow/artifacts/npc-showcase",
      artifact_path: ".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png",
      stdout_preview: "Captured screenshot for http://127.0.0.1:3000",
      summary: "NPC screenshot capture completed successfully for the matched local project run."
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
      /Workspace write permission is required before NPC collaboration can capture a screenshot artifact from the matched local project\./i
    );
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    fireEvent.click(within(permissionSection as HTMLElement).getAllByRole("button")[0]);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          /NPC project screenshot capture|cattle|projects\/cattle|http:\/\/127\.0\.0\.1:3000|\.opencow\/artifacts\/npc-showcase\/cattle-screenshot-1700000000\.png/i
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
Unable to find the final NPC screenshot capture result because the execution kind is not wired through the app flow yet.
```

- [ ] **Step 3: Confirm no app production wiring is required**

```ts
// No App.tsx production change is expected.
// The existing queued local task pipeline should accept the new execution kind
// once planner, workbench type union, and assistant execution dispatch are wired.
```

- [ ] **Step 4: Run the focused app verification to verify it passes**

Run:

```powershell
npm --workspace apps/desktop exec vitest run src/app/app.npc-showcase.test.tsx src/features/assistant/assistantTaskService.npc-showcase.test.ts
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
cargo test workspace_project_npc_screenshot_ --manifest-path apps/desktop/src-tauri/Cargo.toml -- --nocapture
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-showcase.test.ts src/app/app.npc-showcase.test.tsx
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
Only the intended NPC screenshot capture files are modified.
```

- [ ] **Step 3: Create the checkpoint commit**

```powershell
git add packages/openclaw-adapter/src/types.ts packages/openclaw-adapter/src/localAssistantPlan.ts packages/openclaw-adapter/src/localAssistantPlan.npc-showcase.test.ts apps/desktop/src/features/assistant/localAssistantService.ts apps/desktop/src/features/workbench/workbenchState.types.ts apps/desktop/src/features/assistant/assistantTaskService.ts apps/desktop/src/features/assistant/assistantTaskService.npc-showcase.test.ts apps/desktop/src/app/app.npc-showcase.test.tsx apps/desktop/src-tauri/src/workspace.rs apps/desktop/src-tauri/src/lib.rs apps/desktop/src-tauri/Cargo.toml
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
