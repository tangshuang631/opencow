# NPC Showcase Publish Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `npc-local-project-showcase-publish-preview` as a readonly post-write NPC showcase stage that reopens the latest generated showcase outputs and keeps git as a separate future step.

**Architecture:** Extend the adapter planner with one new readonly fixed task kind, then add one tightly scoped desktop/Tauri preview surface that reads the latest project-scoped site and screenshot artifacts without mutating them. Keep the result NPC-specific and publish-oriented so it does not collapse into generic `git status` or imply commit or push approval.

**Tech Stack:** TypeScript, Vitest, React Testing Library, Tauri desktop command bridge, Rust workspace command module, deterministic filesystem reads

---

### Task 1: Add Planner Support For `npc-local-project-showcase-publish-preview`

**Files:**
- Modify: `packages/openclaw-adapter/src/types.ts`
- Modify: `packages/openclaw-adapter/src/localAssistantPlan.ts`
- Modify: `packages/openclaw-adapter/src/localAssistantPlan.npc-showcase.test.ts`

- [ ] **Step 1: Write the failing planner tests**

```ts
import { describe, expect, it } from "vitest";
import { planLocalAssistantTask } from "./index.js";

describe("local assistant task planner npc showcase workflow", () => {
  it("plans a readonly npc showcase publish preview for explicit post-write review wording", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to preview the generated showcase output for the matched cattle project before git",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-project-showcase-publish-preview",
      title: "NPC local project showcase publish preview"
    });
  });

  it("does not collapse npc showcase publish preview wording into generic readonly git status", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to review the changed showcase files for the matched cattle project before commit",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-project-showcase-publish-preview",
      title: "NPC local project showcase publish preview"
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
Expected kind "npc-local-project-showcase-publish-preview", but received the current preview-only NPC showcase branch or generic readonly git status branch.
```

- [ ] **Step 3: Add the new planner type and readonly branch**

```ts
// packages/openclaw-adapter/src/types.ts
| {
    readonly kind: "npc-local-project-showcase-publish-preview";
    readonly title: string;
    readonly summary: string;
    readonly auditSummary: string;
    readonly auditDetail: string;
  }
```

```ts
// packages/openclaw-adapter/src/localAssistantPlan.ts
const npcShowcasePublishPreviewPatterns = [/\bpreview\b/i, /\breview\b/i, /\binspect\b/i, /\bshow\b/i];
const npcShowcasePublishArtifactPatterns = [/\bshowcase\b/i, /\bartifact/i, /\boutput\b/i, /\bfiles?\b/i, /\bchanged\b/i];
const npcShowcasePublishGitBoundaryPatterns = [/\bbefore git\b/i, /\bbefore commit\b/i, /\bbefore push\b/i];

if (
  /\bnpc\b/i.test(message)
  && /collaboration/i.test(message)
  && npcShowcaseProjectPatterns.some((pattern) => pattern.test(message))
  && npcShowcasePublishPreviewPatterns.some((pattern) => pattern.test(message))
  && npcShowcasePublishArtifactPatterns.some((pattern) => pattern.test(message))
) {
  return {
    kind: "npc-local-project-showcase-publish-preview",
    title: "NPC local project showcase publish preview",
    summary:
      npcShowcasePublishGitBoundaryPatterns.some((pattern) => pattern.test(message))
        ? message
        : "Preview the latest NPC showcase outputs and changed files before any later git stage is considered.",
    auditSummary: "Local assistant planned a readonly NPC local project showcase publish preview.",
    auditDetail: `Readonly NPC local project showcase publish preview task: ${message}`
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
git commit -m "feat: plan npc showcase publish preview"
```

### Task 2: Add Desktop Publish-Preview Service And Tauri Command

**Files:**
- Modify: `apps/desktop/src/features/assistant/localAssistantService.ts`
- Modify: `apps/desktop/src-tauri/src/workspace.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing service and Rust tests**

```ts
// apps/desktop/src/features/assistant/localAssistantService.ts
export type WorkspaceProjectNpcShowcasePublishPreviewResult = {
  project_name: string;
  project_path: string;
  site_root: string;
  entry_file: string;
  changed_paths: string[];
  source_screenshot_path: string;
  next_git_step: string;
  summary: string;
};
```

```rust
// apps/desktop/src-tauri/src/workspace.rs
#[test]
fn workspace_project_npc_showcase_publish_preview_returns_error_without_site_output() {
    let workspace_root = create_workspace_project_run_fixture();
    let _guard = acquire_workspace_test_lock();
    std::env::set_current_dir(&workspace_root).unwrap();

    let run_result = workspace_project_run("run the cattle app locally".to_string()).unwrap();
    assert_eq!(run_result.project_name, "cattle");

    let error = workspace_project_npc_showcase_publish_preview(
        "use npc collaboration to preview the generated showcase output for the matched cattle project before git".to_string()
    )
    .unwrap_err();

    assert!(error.contains("No generated showcase site output"));
}

#[test]
fn workspace_project_npc_showcase_publish_preview_reads_deterministic_project_scoped_paths() {
    let workspace_root = create_workspace_project_run_fixture();
    let _guard = acquire_workspace_test_lock();
    std::env::set_current_dir(&workspace_root).unwrap();

    let artifacts_root = workspace_root.join(".opencow").join("artifacts").join("npc-showcase");
    std::fs::create_dir_all(artifacts_root.join("sites").join("cattle")).unwrap();
    std::fs::write(
        artifacts_root.join("sites").join("cattle").join("index.html"),
        "<html><body>cattle showcase</body></html>"
    )
    .unwrap();
    std::fs::write(
        artifacts_root.join("cattle-screenshot-1700000000.png"),
        b"fake-png"
    )
    .unwrap();

    let run_result = workspace_project_run("run the cattle app locally".to_string()).unwrap();
    assert_eq!(run_result.project_name, "cattle");

    let result = workspace_project_npc_showcase_publish_preview(
        "use npc collaboration to review the changed showcase files for the matched cattle project before commit".to_string()
    )
    .unwrap();

    assert_eq!(result.project_name, "cattle");
    assert!(result.site_root.contains(".opencow/artifacts/npc-showcase/sites/cattle"));
    assert!(result.entry_file.ends_with("index.html"));
    assert!(result.source_screenshot_path.contains("cattle-screenshot-1700000000.png"));
    assert_eq!(result.changed_paths, vec![".opencow/artifacts/npc-showcase/sites/cattle/index.html"]);
}
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```powershell
cargo test workspace_project_npc_showcase_publish_preview --manifest-path apps/desktop/src-tauri/Cargo.toml -- --nocapture
```

Expected:

```text
FAIL
cannot find function `workspace_project_npc_showcase_publish_preview`
```

- [ ] **Step 3: Add the desktop service result type, browser preview fallback, and invoke bridge**

```ts
// apps/desktop/src/features/assistant/localAssistantService.ts
export async function loadNpcLocalProjectShowcasePublishPreview(
  query: string
): Promise<WorkspaceProjectNpcShowcasePublishPreviewResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewNpcProjectShowcasePublishPreview(query);
  }

  return invoke<WorkspaceProjectNpcShowcasePublishPreviewResult>(
    "workspace_project_npc_showcase_publish_preview",
    {
      query
    }
  );
}

function createBrowserPreviewNpcProjectShowcasePublishPreview(
  query: string
): WorkspaceProjectNpcShowcasePublishPreviewResult {
  const prefersCattle = /\bcattle\b/i.test(query);
  const projectName = prefersCattle ? "cattle" : "workspace-project";
  const projectPath = prefersCattle ? "apps/cattle" : "apps/example";
  const siteRoot = `.opencow/artifacts/npc-showcase/sites/${projectName}`;
  const entryFile = `${siteRoot}/index.html`;
  const sourceScreenshotPath = `.opencow/artifacts/npc-showcase/${projectName}-screenshot-browser-preview.png`;

  return {
    project_name: projectName,
    project_path: projectPath,
    site_root: siteRoot,
    entry_file: entryFile,
    changed_paths: [entryFile],
    source_screenshot_path: sourceScreenshotPath,
    next_git_step: "Git commit or push is still separate and requires its own explicit confirmation stage.",
    summary: "Browser preview mode returned a mock NPC local project showcase publish preview result."
  };
}
```

- [ ] **Step 4: Add the Rust command, project-scoped artifact lookup, and command registration**

```rust
// apps/desktop/src-tauri/src/workspace.rs
#[derive(Serialize)]
pub struct WorkspaceProjectNpcShowcasePublishPreviewResult {
    project_name: String,
    project_path: String,
    site_root: String,
    entry_file: String,
    changed_paths: Vec<String>,
    source_screenshot_path: String,
    next_git_step: String,
    summary: String,
}

#[tauri::command]
pub fn workspace_project_npc_showcase_publish_preview(
    query: String,
) -> Result<WorkspaceProjectNpcShowcasePublishPreviewResult, String> {
    let root = workspace_root()?;
    let candidates = collect_workspace_project_run_candidates(&root)?;
    let matched = select_workspace_project_run_candidate(&query, &candidates)
        .ok_or_else(|| format!("No matched local project run candidate was found for NPC showcase publish preview: {}", query))?;

    let site_root = build_npc_showcase_site_root(&root, &matched.name);
    let entry_file = site_root.join("index.html");
    if !entry_file.exists() {
        return Err(format!(
            "No generated showcase site output is available for NPC showcase publish preview: {}",
            matched.name
        ));
    }

    let screenshot_artifact = find_latest_npc_showcase_screenshot_artifact(&root, &matched.name)
        .ok_or_else(|| format!("No screenshot artifact is available for NPC showcase publish preview: {}", matched.name))?;

    Ok(WorkspaceProjectNpcShowcasePublishPreviewResult {
        project_name: matched.name.clone(),
        project_path: matched.relative_path.clone(),
        site_root: path_relative_to_root(&root, &site_root),
        entry_file: path_relative_to_root(&root, &entry_file),
        changed_paths: vec![path_relative_to_root(&root, &entry_file)],
        source_screenshot_path: path_relative_to_root(&root, &screenshot_artifact),
        next_git_step: "Git commit or push is still separate and requires its own explicit confirmation stage.".to_string(),
        summary: "NPC local project showcase publish preview loaded the latest generated showcase outputs without starting any git action.".to_string(),
    })
}
```

```rust
// apps/desktop/src-tauri/src/lib.rs
workspace::workspace_project_npc_showcase_publish_preview,
```

- [ ] **Step 5: Run the focused service and Rust tests to verify they pass**

Run:

```powershell
cargo test workspace_project_npc_showcase_publish_preview --manifest-path apps/desktop/src-tauri/Cargo.toml -- --nocapture
npm --workspace apps/desktop exec tsc --noEmit
```

Expected:

```text
PASS
```

- [ ] **Step 6: Commit the desktop publish-preview surface**

```powershell
git add apps/desktop/src/features/assistant/localAssistantService.ts apps/desktop/src-tauri/src/workspace.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: add npc showcase publish preview service"
```

### Task 3: Add Assistant Execution Support For `npc-local-project-showcase-publish-preview`

**Files:**
- Modify: `apps/desktop/src/features/workbench/workbenchState.types.ts`
- Modify: `apps/desktop/src/features/assistant/assistantTaskService.ts`
- Modify: `apps/desktop/src/features/assistant/assistantTaskService.npc-showcase.test.ts`

- [ ] **Step 1: Write the failing assistant execution tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { loadNpcLocalProjectShowcasePublishPreviewMock } = vi.hoisted(() => ({
  loadNpcLocalProjectShowcasePublishPreviewMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");
  return {
    ...actual,
    loadNpcLocalProjectShowcasePublishPreview: loadNpcLocalProjectShowcasePublishPreviewMock
  };
});

describe("assistantTaskService npc showcase publish preview", () => {
  it("plans a readonly npc showcase publish preview without a permission upgrade", () => {
    const plan = planAssistantTask(
      "use npc collaboration to preview the generated showcase output for the matched cattle project before git",
      "readonly"
    );

    expect(plan).toMatchObject({
      kind: "npc-local-project-showcase-publish-preview",
      title: "NPC local project showcase publish preview"
    });
  });

  it("returns the latest generated showcase outputs with git kept separate", async () => {
    loadNpcLocalProjectShowcasePublishPreviewMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "apps/cattle",
      site_root: ".opencow/artifacts/npc-showcase/sites/cattle",
      entry_file: ".opencow/artifacts/npc-showcase/sites/cattle/index.html",
      changed_paths: [".opencow/artifacts/npc-showcase/sites/cattle/index.html"],
      source_screenshot_path: ".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png",
      next_git_step: "Git commit or push is still separate and requires its own explicit confirmation stage.",
      summary: "NPC local project showcase publish preview loaded the latest generated showcase outputs without starting any git action."
    });

    const result = await executeAssistantTask({
      kind: "npc-local-project-showcase-publish-preview",
      title: "NPC local project showcase publish preview",
      summary: "use npc collaboration to review the changed showcase files for the matched cattle project before commit",
      auditSummary: "Local assistant planned a readonly NPC local project showcase publish preview.",
      auditDetail: "Readonly NPC local project showcase publish preview task."
    } as const);

    expect(result.resultTitle).toBe("NPC local project showcase publish preview");
    expect(result.resultSummary).toContain("cattle");
    expect(result.resultSummary).toContain("apps/cattle");
    expect(result.resultSummary).toContain(".opencow/artifacts/npc-showcase/sites/cattle");
    expect(result.resultSummary).toContain("index.html");
    expect(result.resultSummary).toContain(".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png");
    expect(result.resultSummary).toContain("Git commit or push is still separate");
    expect(result.resultSummary).toContain("readonly publish-preview stage");
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
Unsupported assistant task execution plan: npc-local-project-showcase-publish-preview
```

- [ ] **Step 3: Add task typing and execution dispatch**

```ts
// apps/desktop/src/features/workbench/workbenchState.types.ts
| "npc-local-project-showcase-publish-preview"
```

```ts
// apps/desktop/src/features/assistant/assistantTaskService.ts
import { loadNpcLocalProjectShowcasePublishPreview } from "./localAssistantService";

if (plan.kind === "npc-local-project-showcase-publish-preview") {
  return executeNpcLocalProjectShowcasePublishPreviewPlan(plan.title, plan.summary);
}

async function executeNpcLocalProjectShowcasePublishPreviewPlan(
  resultTitle: string,
  query: string
): Promise<AssistantTaskExecutionResult> {
  const result = await loadNpcLocalProjectShowcasePublishPreview(query);

  return {
    resultTitle,
    resultSummary:
      `${result.summary} Matched project: ${result.project_name}. Path: ${result.project_path}. ` +
      `Site root: ${result.site_root}. Entry file: ${result.entry_file}. ` +
      `Changed paths: ${result.changed_paths.join(", ")}. Source screenshot: ${result.source_screenshot_path}. ` +
      `Next git step: ${result.next_git_step}. ` +
      `This is the readonly publish-preview stage inside the NPC showcase chain.`
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
git commit -m "feat: execute npc showcase publish preview"
```

### Task 4: Add App-Level Coverage For NPC Showcase Publish Preview

**Files:**
- Modify: `apps/desktop/src/app/app.npc-showcase.test.tsx`

- [ ] **Step 1: Write the failing app-level publish-preview conversation test**

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const {
  loadOllamaOverviewMock,
  loadNpcLocalProjectShowcasePublishPreviewMock
} = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn(),
  loadNpcLocalProjectShowcasePublishPreviewMock: vi.fn()
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
    loadNpcLocalProjectShowcasePublishPreview: loadNpcLocalProjectShowcasePublishPreviewMock
  };
});

describe("App npc showcase publish preview flow", () => {
  it("returns a readonly publish preview without a permission dialog", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadNpcLocalProjectShowcasePublishPreviewMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "apps/cattle",
      site_root: ".opencow/artifacts/npc-showcase/sites/cattle",
      entry_file: ".opencow/artifacts/npc-showcase/sites/cattle/index.html",
      changed_paths: [".opencow/artifacts/npc-showcase/sites/cattle/index.html"],
      source_screenshot_path: ".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png",
      next_git_step: "Git commit or push is still separate and requires its own explicit confirmation stage.",
      summary: "NPC local project showcase publish preview loaded the latest generated showcase outputs without starting any git action."
    });

    const { container } = render(<App />);
    await screen.findAllByText("qwen2.5-coder:7b");

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "use npc collaboration to preview the generated showcase output for the matched cattle project before git" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          /NPC local project showcase publish preview|cattle|apps\/cattle|\.opencow\/artifacts\/npc-showcase\/sites\/cattle|Git commit or push is still separate/i
        ).length
      ).toBeGreaterThan(0);
    });

    expect(
      screen.queryByText(/Workspace write permission is required/i)
    ).toBeNull();
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
Unable to find the NPC local project showcase publish preview result because the execution kind is not wired through the app flow yet.
```

- [ ] **Step 3: Confirm that no `App.tsx` production wiring is required**

```ts
// No App.tsx edit is expected for this slice.
// The existing queued local task pipeline should accept the new readonly execution kind
// once the desktop task union and assistant execution dispatcher are extended.
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
git commit -m "test: cover npc showcase publish preview app flow"
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
cargo test workspace_project_npc_showcase_publish_preview --manifest-path apps/desktop/src-tauri/Cargo.toml -- --nocapture
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
Only the intended NPC showcase publish preview files are modified.
```

- [ ] **Step 3: Create the checkpoint commit**

```powershell
git add packages/openclaw-adapter/src/types.ts packages/openclaw-adapter/src/localAssistantPlan.ts packages/openclaw-adapter/src/localAssistantPlan.npc-showcase.test.ts apps/desktop/src/features/assistant/localAssistantService.ts apps/desktop/src/features/workbench/workbenchState.types.ts apps/desktop/src/features/assistant/assistantTaskService.ts apps/desktop/src/features/assistant/assistantTaskService.npc-showcase.test.ts apps/desktop/src/app/app.npc-showcase.test.tsx apps/desktop/src-tauri/src/workspace.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: add npc showcase publish preview"
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
