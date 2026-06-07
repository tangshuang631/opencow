# NPC Showcase-Site Write Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the next smallest real NPC showcase repository-write slice by introducing `npc-local-project-showcase-site-write` as a permission-backed single-page site generation path that returns traceable changed-file metadata.

**Architecture:** Extend the adapter planner with one new fixed execution kind, keep permission and queued execution identity NPC-specific, and add one tightly scoped desktop/Tauri showcase-site write surface. The desktop path should resolve the matched running local project through the existing runtime-backed lifecycle, require an existing screenshot artifact for the matched project, write deterministic output under `.opencow/artifacts/npc-showcase/sites/<project-name>/`, and return changed-file metadata without expanding into git actions or broad source-tree mutation.

**Tech Stack:** TypeScript, Vitest, React Testing Library, Tauri desktop command bridge, Rust workspace command module, deterministic filesystem writes

---

### Task 1: Add Planner Support For `npc-local-project-showcase-site-write`

**Files:**
- Modify: `packages/openclaw-adapter/src/types.ts`
- Modify: `packages/openclaw-adapter/src/localAssistantPlan.ts`
- Modify: `packages/openclaw-adapter/src/localAssistantPlan.npc-showcase.test.ts`

- [ ] **Step 1: Write the failing planner tests**

```ts
import { describe, expect, it } from "vitest";
import { planLocalAssistantTask } from "./index.js";

describe("local assistant task planner npc showcase workflow", () => {
  it("requests workspace-write before generating a matched npc showcase site", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to generate the showcase site for the matched cattle project now",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "npc-local-project-showcase-site-write",
      queuedExecutionTitle: "NPC local project showcase-site write"
    });
  });

  it("plans npc showcase-site write after workspace-write is approved", () => {
    const plan = planLocalAssistantTask({
      message: "use npc collaboration to generate the showcase site for the matched cattle project now",
      permissionMode: "workspace-write"
    });

    expect(plan).toMatchObject({
      kind: "npc-local-project-showcase-site-write",
      title: "NPC local project showcase-site write"
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
Expected queuedExecutionKind "npc-local-project-showcase-site-write" or kind "npc-local-project-showcase-site-write", but received the current preview-only NPC showcase behavior.
```

- [ ] **Step 3: Add the new planner type and branch**

```ts
// packages/openclaw-adapter/src/types.ts
| {
    readonly kind: "npc-local-project-showcase-site-write";
    readonly title: string;
    readonly summary: string;
    readonly auditSummary: string;
    readonly auditDetail: string;
  }
```

```ts
// packages/openclaw-adapter/src/localAssistantPlan.ts
const npcShowcaseSiteWritePatterns = [/\bshowcase\b/i, /\bwebsite\b/i, /\bsite\b/i, /\bpage\b/i];

if (
  /\bnpc\b/i.test(message)
  && /collaboration/i.test(message)
  && npcShowcaseProjectPatterns.some((pattern) => pattern.test(message))
  && npcShowcaseSiteWritePatterns.some((pattern) => pattern.test(message))
  && (/\bgenerate\b/i.test(message) || /\bwrite\b/i.test(message) || /\bcreate\b/i.test(message) || /\bnow\b/i.test(message))
  && !/\bgit\s+(status|commit|push)\b/i.test(message)
) {
  if (request.permissionMode === "readonly") {
    return {
      kind: "permission-request",
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before NPC collaboration can generate the showcase site for the matched local project.",
      riskSummary:
        "This task writes only a deterministic local showcase-site output under the approved workspace and must keep changed-file paths audit-visible.",
      auditSummary: "Local assistant task requires workspace-write permission for NPC local project showcase-site write.",
      auditDetail: `NPC local project showcase-site write task is waiting for permission: ${message}`,
      queuedExecutionKind: "npc-local-project-showcase-site-write",
      queuedExecutionTitle: "NPC local project showcase-site write",
      queuedExecutionAuditSummary: "Local assistant planned NPC local project showcase-site write.",
      queuedExecutionAuditDetail: `NPC local project showcase-site write task: ${message}`,
      queuedMessage: message
    };
  }

  return {
    kind: "npc-local-project-showcase-site-write",
    title: "NPC local project showcase-site write",
    summary: message,
    auditSummary: "Local assistant planned NPC local project showcase-site write.",
    auditDetail: `NPC local project showcase-site write task: ${message}`
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
git commit -m "feat: plan npc showcase site write"
```

### Task 2: Add Desktop Showcase-Site Write Service And Tauri Command

**Files:**
- Modify: `apps/desktop/src/features/assistant/localAssistantService.ts`
- Modify: `apps/desktop/src-tauri/src/workspace.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing service and Rust tests**

```ts
// apps/desktop/src/features/assistant/localAssistantService.ts
export type WorkspaceProjectNpcShowcaseSiteWriteResult = {
  project_name: string;
  project_path: string;
  site_root: string;
  entry_file: string;
  changed_paths: string[];
  source_screenshot_path: string;
  summary: string;
};
```

```rust
// apps/desktop/src-tauri/src/workspace.rs
#[test]
fn workspace_project_npc_showcase_site_write_returns_error_without_screenshot_artifact() {
    let workspace_root = create_workspace_project_run_fixture();
    let _guard = acquire_workspace_test_lock();
    std::env::set_current_dir(&workspace_root).unwrap();

    let run_result = workspace_project_run("run the cattle app locally".to_string()).unwrap();
    assert_eq!(run_result.project_name, "cattle");

    let error = workspace_project_npc_showcase_site_write(
        "use npc collaboration to generate the showcase site for the matched cattle project now".to_string()
    )
    .unwrap_err();

    assert!(error.contains("No screenshot artifact"));
}

#[test]
fn workspace_project_npc_showcase_site_write_output_path_stays_inside_workspace_artifacts_root() {
    let workspace_root = PathBuf::from("E:/2026/opencow");
    let site_root = build_npc_showcase_site_root(&workspace_root, "cattle");

    assert!(site_root.to_string_lossy().contains(".opencow/artifacts/npc-showcase/sites"));
    assert!(site_root.to_string_lossy().ends_with("cattle"));
}
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```powershell
cargo test workspace_project_npc_showcase_site_write --manifest-path apps/desktop/src-tauri/Cargo.toml -- --nocapture
```

Expected:

```text
FAIL
cannot find function `workspace_project_npc_showcase_site_write`
```

- [ ] **Step 3: Add the desktop service result type, browser preview fallback, and invoke bridge**

```ts
// apps/desktop/src/features/assistant/localAssistantService.ts
export async function writeNpcLocalProjectShowcaseSite(
  query: string
): Promise<WorkspaceProjectNpcShowcaseSiteWriteResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewNpcProjectShowcaseSiteWrite(query);
  }

  return invoke<WorkspaceProjectNpcShowcaseSiteWriteResult>("workspace_project_npc_showcase_site_write", {
    query
  });
}

function createBrowserPreviewNpcProjectShowcaseSiteWrite(
  query: string
): WorkspaceProjectNpcShowcaseSiteWriteResult {
  const prefersCattle = /\bcattle\b/i.test(query);
  const projectName = prefersCattle ? "cattle" : "workspace-project";
  const siteRoot = `.opencow/artifacts/npc-showcase/sites/${projectName}`;
  const entryFile = `${siteRoot}/index.html`;
  const sourceScreenshotPath = `.opencow/artifacts/npc-showcase/${projectName}-screenshot-browser-preview.png`;

  return {
    project_name: projectName,
    project_path: prefersCattle ? "apps/cattle" : "apps/example",
    site_root: siteRoot,
    entry_file: entryFile,
    changed_paths: [entryFile],
    source_screenshot_path: sourceScreenshotPath,
    summary: "Browser preview mode returned a mock NPC local project showcase-site write result."
  };
}
```

- [ ] **Step 4: Add the Rust command, deterministic site writer, and command registration**

```rust
// apps/desktop/src-tauri/src/workspace.rs
#[derive(Serialize)]
pub struct WorkspaceProjectNpcShowcaseSiteWriteResult {
    project_name: String,
    project_path: String,
    site_root: String,
    entry_file: String,
    changed_paths: Vec<String>,
    source_screenshot_path: String,
    summary: String,
}

#[tauri::command]
pub fn workspace_project_npc_showcase_site_write(
    query: String,
) -> Result<WorkspaceProjectNpcShowcaseSiteWriteResult, String> {
    let root = workspace_root()?;
    let candidates = collect_workspace_project_run_candidates(&root)?;
    let matched = select_workspace_project_run_candidate(&query, &candidates)
        .ok_or_else(|| format!("No matched local project run candidate was found for showcase-site write: {}", query))?;
    let _runtime = find_workspace_project_runtime_record(&root, &matched.relative_path)?
        .ok_or_else(|| format!("No active matched local project run is available for NPC showcase-site write: {}", query))?;
    let screenshot_artifact = find_latest_npc_showcase_screenshot_artifact(&root, &matched.name)?
        .ok_or_else(|| format!("No screenshot artifact is available for NPC showcase-site write: {}", matched.name))?;
    let site_root = build_npc_showcase_site_root(&root, &matched.name);
    let entry_file = site_root.join("index.html");
    let expected_url = infer_project_expected_url(&matched);

    write_npc_showcase_site_html(&entry_file, &matched.name, &matched.relative_path, expected_url.as_deref(), &screenshot_artifact)?;

    Ok(WorkspaceProjectNpcShowcaseSiteWriteResult {
        project_name: matched.name.clone(),
        project_path: matched.relative_path.clone(),
        site_root: path_relative_to_root(&root, &site_root),
        entry_file: path_relative_to_root(&root, &entry_file),
        changed_paths: vec![path_relative_to_root(&root, &entry_file)],
        source_screenshot_path: path_relative_to_root(&root, &screenshot_artifact),
        summary: "NPC local project showcase-site write completed successfully and returned a changed-file summary.".to_string(),
    })
}

fn build_npc_showcase_site_root(root: &Path, project_name: &str) -> PathBuf {
    root.join(".opencow")
        .join("artifacts")
        .join("npc-showcase")
        .join("sites")
        .join(sanitize_artifact_segment(project_name))
}
```

```rust
// apps/desktop/src-tauri/src/lib.rs
workspace::workspace_project_npc_showcase_site_write,
```

- [ ] **Step 5: Run the focused service and Rust tests to verify they pass**

Run:

```powershell
cargo test workspace_project_npc_showcase_site_write --manifest-path apps/desktop/src-tauri/Cargo.toml -- --nocapture
npm --workspace apps/desktop exec tsc --noEmit
```

Expected:

```text
PASS
```

- [ ] **Step 6: Commit the desktop showcase-site surface**

```powershell
git add apps/desktop/src/features/assistant/localAssistantService.ts apps/desktop/src-tauri/src/workspace.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: add npc showcase site write service"
```

### Task 3: Add Assistant Execution Support For `npc-local-project-showcase-site-write`

**Files:**
- Modify: `apps/desktop/src/features/workbench/workbenchState.types.ts`
- Modify: `apps/desktop/src/features/assistant/assistantTaskService.ts`
- Modify: `apps/desktop/src/features/assistant/assistantTaskService.npc-showcase.test.ts`

- [ ] **Step 1: Write the failing assistant execution tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { writeNpcLocalProjectShowcaseSiteMock } = vi.hoisted(() => ({
  writeNpcLocalProjectShowcaseSiteMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");
  return {
    ...actual,
    writeNpcLocalProjectShowcaseSite: writeNpcLocalProjectShowcaseSiteMock
  };
});

describe("assistantTaskService npc showcase-site write", () => {
  it("requests workspace-write before generating a matched npc showcase site", () => {
    const plan = planAssistantTask(
      "use npc collaboration to generate the showcase site for the matched cattle project now",
      "readonly"
    );

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "npc-local-project-showcase-site-write"
    });
  });

  it("writes the matched local project showcase site with npc-specific identity", async () => {
    writeNpcLocalProjectShowcaseSiteMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "apps/cattle",
      site_root: ".opencow/artifacts/npc-showcase/sites/cattle",
      entry_file: ".opencow/artifacts/npc-showcase/sites/cattle/index.html",
      changed_paths: [".opencow/artifacts/npc-showcase/sites/cattle/index.html"],
      source_screenshot_path: ".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png",
      summary: "NPC local project showcase-site write completed successfully and returned a changed-file summary."
    });

    const result = await executeAssistantTask({
      kind: "npc-local-project-showcase-site-write",
      title: "NPC local project showcase-site write",
      summary: "use npc collaboration to generate the showcase site for the matched cattle project now",
      auditSummary: "Local assistant planned NPC local project showcase-site write.",
      auditDetail: "NPC local project showcase-site write task."
    } as const);

    expect(result.resultTitle).toBe("NPC local project showcase-site write");
    expect(result.resultSummary).toContain("cattle");
    expect(result.resultSummary).toContain("apps/cattle");
    expect(result.resultSummary).toContain(".opencow/artifacts/npc-showcase/sites/cattle");
    expect(result.resultSummary).toContain("index.html");
    expect(result.resultSummary).toContain(".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png");
    expect(result.resultSummary).toContain("showcase-site write stage");
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
Unsupported assistant task execution plan: npc-local-project-showcase-site-write
```

- [ ] **Step 3: Add task typing and execution dispatch**

```ts
// apps/desktop/src/features/workbench/workbenchState.types.ts
| "npc-local-project-showcase-site-write"
```

```ts
// apps/desktop/src/features/assistant/assistantTaskService.ts
import { writeNpcLocalProjectShowcaseSite } from "./localAssistantService";

if (plan.kind === "npc-local-project-showcase-site-write") {
  return executeNpcLocalProjectShowcaseSiteWritePlan(plan.title, plan.summary);
}

async function executeNpcLocalProjectShowcaseSiteWritePlan(
  resultTitle: string,
  query: string
): Promise<AssistantTaskExecutionResult> {
  const result = await writeNpcLocalProjectShowcaseSite(query);

  return {
    resultTitle,
    resultSummary:
      `${result.summary} Matched project: ${result.project_name}. Path: ${result.project_path}. ` +
      `Site root: ${result.site_root}. Entry file: ${result.entry_file}. ` +
      `Changed paths: ${result.changed_paths.join(", ")}. Source screenshot: ${result.source_screenshot_path}. ` +
      `This is the showcase-site write stage inside the NPC showcase chain.`
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
git commit -m "feat: execute npc showcase site write"
```

### Task 4: Add App-Level Coverage For NPC Showcase-Site Write

**Files:**
- Modify: `apps/desktop/src/app/app.npc-showcase.test.tsx`

- [ ] **Step 1: Write the failing app-level showcase-site conversation test**

```tsx
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const {
  loadOllamaOverviewMock,
  writeNpcLocalProjectShowcaseSiteMock
} = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn(),
  writeNpcLocalProjectShowcaseSiteMock: vi.fn()
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
    writeNpcLocalProjectShowcaseSite: writeNpcLocalProjectShowcaseSiteMock
  };
});

describe("App npc showcase-site write flow", () => {
  it("continues from npc showcase-site permission approval into the final changed-file result", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    writeNpcLocalProjectShowcaseSiteMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "apps/cattle",
      site_root: ".opencow/artifacts/npc-showcase/sites/cattle",
      entry_file: ".opencow/artifacts/npc-showcase/sites/cattle/index.html",
      changed_paths: [".opencow/artifacts/npc-showcase/sites/cattle/index.html"],
      source_screenshot_path: ".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png",
      summary: "NPC local project showcase-site write completed successfully and returned a changed-file summary."
    });

    const { container } = render(<App />);
    await screen.findAllByText("qwen2.5-coder:7b");

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "use npc collaboration to generate the showcase site for the matched cattle project now" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const permissionReasonMatches = await screen.findAllByText(
      /Workspace write permission is required before NPC collaboration can generate the showcase site for the matched local project\./i
    );
    const permissionSection = permissionReasonMatches[0]?.closest("section");

    fireEvent.click(within(permissionSection as HTMLElement).getAllByRole("button")[0]);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          /NPC local project showcase-site write|cattle|apps\/cattle|\.opencow\/artifacts\/npc-showcase\/sites\/cattle|index\.html/i
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
Unable to find the NPC local project showcase-site write result because the execution kind is not wired through the app flow yet.
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
git commit -m "test: cover npc showcase site write app flow"
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
cargo test workspace_project_npc_showcase_site_write --manifest-path apps/desktop/src-tauri/Cargo.toml -- --nocapture
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
Only the intended NPC showcase-site write files are modified.
```

- [ ] **Step 3: Create the checkpoint commit**

```powershell
git add packages/openclaw-adapter/src/types.ts packages/openclaw-adapter/src/localAssistantPlan.ts packages/openclaw-adapter/src/localAssistantPlan.npc-showcase.test.ts apps/desktop/src/features/assistant/localAssistantService.ts apps/desktop/src/features/workbench/workbenchState.types.ts apps/desktop/src/features/assistant/assistantTaskService.ts apps/desktop/src/features/assistant/assistantTaskService.npc-showcase.test.ts apps/desktop/src/app/app.npc-showcase.test.tsx apps/desktop/src-tauri/src/workspace.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: add npc showcase site write execution"
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
