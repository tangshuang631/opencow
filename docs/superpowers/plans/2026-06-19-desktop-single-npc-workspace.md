# Desktop Single NPC Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real single-NPC desktop workspace with compact left NPC cards, a divider-style right navigator, and a middle configuration area that is wired to real NPC, skills, and knowledge data.

**Architecture:** Extend the existing desktop workbench state instead of creating a second NPC application shell. Add a deterministic workspace-local NPC registry in Tauri, expose list/read/create/update commands through `localAssistantService`, and render the NPC page as a three-column workspace that reuses the existing real knowledge and local skill capability flows.

**Tech Stack:** React, TypeScript, Vitest, Tauri Rust commands, existing workbench persistence/state helpers.

---

### Appendix: Added Productization Scope

This plan now also covers two product-boundary corrections that must land before the NPC and Skills experience can be considered productized:

- OpenCow must own its own runtime `skills` storage instead of presenting raw OpenClaw discovery as the main product surface.
- OpenCow must own its own `knowledge/files` file pool instead of surfacing repository-root files as pending RAG imports.

Added runtime storage targets:

- app-local `skills/manifest/recommended-skills.json`
- app-local `skills/installed/`
- app-local `skills/enabled-skills.json`
- app-local `knowledge/files/`
- app-local `knowledge/libraries.json`

Added UI target changes:

- `Skills` page becomes `推荐 / 已安装`
- `NPC -> 技能` becomes checkbox-only binding for installed skills
- `知识库 -> 文件库` becomes empty by default until the user imports files

### Task 1: Add NPC workspace state and failing UI tests

**Files:**
- Modify: `apps/desktop/src/app/app.test.tsx`
- Modify: `apps/desktop/src/features/workbench/workbenchState.types.ts`
- Modify: `apps/desktop/src/features/workbench/workbenchState.initial.ts`

- [ ] **Step 1: Write failing tests for the NPC workspace shell**

```tsx
it("renders the single NPC workspace with compact navigation after loading NPC configs", async () => {
  loadNpcWorkspaceMock.mockResolvedValueOnce({
    summary: "loaded",
    selectedNpcId: "research-bot",
    items: [
      {
        id: "research-bot",
        name: "研究助手",
        description: "负责资料整理",
        defaultModel: "qwen2.5-coder:7b",
        personaPrompt: "",
        outputStyle: "简洁",
        agentDraft: "",
        rulesDraft: "",
        enabledSkillNames: ["本地检索增强"],
        knowledgeLibraryIds: ["product-docs"],
        updatedAt: "2026-06-19T10:00:00.000Z"
      }
    ]
  });

  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: "NPC" }));

  expect(await screen.findByRole("heading", { name: "NPC" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "新建 NPC" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "研究助手" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "概览" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "人设" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "技能" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "知识库" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the targeted test to verify RED**

Run: `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx -t "renders the single NPC workspace with compact navigation after loading NPC configs"`

Expected: FAIL because the NPC workspace loader and compact workspace UI do not exist yet.

- [ ] **Step 3: Add the minimal state shape**

```ts
npcWorkspace: {
  items: [],
  selectedNpcId: null,
  activeSection: "overview",
  draftName: "",
  draftDescription: "",
  selectedSkillName: null,
  selectedKnowledgeLibraryId: null,
  saveStatus: null
}
```

- [ ] **Step 4: Re-run the same targeted test**

Run: `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx -t "renders the single NPC workspace with compact navigation after loading NPC configs"`

Expected: still FAIL, but now only on missing UI and data wiring rather than missing state types.

### Task 2: Add deterministic Tauri NPC registry read/write APIs

**Files:**
- Modify: `apps/desktop/src-tauri/src/workspace.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/src/features/assistant/localAssistantService.ts`
- Add or Modify tests: `apps/desktop/src/features/assistant/localAssistantService.desktop.test.ts`

- [ ] **Step 1: Write failing service tests for loading and updating NPC configs**

```ts
it("loads the workspace NPC registry through tauri invoke", async () => {
  invokeMock.mockResolvedValueOnce({
    summary: "loaded",
    selected_npc_id: "research-bot",
    items: [{ id: "research-bot", name: "研究助手", description: "负责资料整理" }]
  });

  await expect(loadNpcWorkspace()).resolves.toMatchObject({
    selectedNpcId: "research-bot",
    items: [expect.objectContaining({ id: "research-bot", name: "研究助手" })]
  });
});
```

- [ ] **Step 2: Run the service test to verify RED**

Run: `npm --workspace apps/desktop exec vitest run src/features/assistant/localAssistantService.desktop.test.ts -t "loads the workspace NPC registry through tauri invoke"`

Expected: FAIL because `loadNpcWorkspace` does not exist.

- [ ] **Step 3: Add minimal registry commands and service wrappers**

```rust
#[tauri::command]
pub fn workspace_npc_configs_list() -> Result<NpcWorkspaceResult, String> { ... }

#[tauri::command]
pub fn workspace_npc_config_create(payload: NpcConfigUpsertPayload) -> Result<NpcWorkspaceResult, String> { ... }

#[tauri::command]
pub fn workspace_npc_config_update(payload: NpcConfigUpsertPayload) -> Result<NpcWorkspaceResult, String> { ... }
```

```ts
export async function loadNpcWorkspace(): Promise<NpcWorkspaceResult> { ... }
export async function createNpcWorkspaceConfig(payload: NpcWorkspaceConfigDraft): Promise<NpcWorkspaceResult> { ... }
export async function updateNpcWorkspaceConfig(payload: NpcWorkspaceConfigDraft): Promise<NpcWorkspaceResult> { ... }
```

- [ ] **Step 4: Re-run the service test**

Run: `npm --workspace apps/desktop exec vitest run src/features/assistant/localAssistantService.desktop.test.ts -t "loads the workspace NPC registry through tauri invoke"`

Expected: PASS.

### Task 3: Render the new NPC workspace shell

**Files:**
- Modify: `apps/desktop/src/features/workbench/Workbench.tsx`
- Modify: `apps/desktop/src/styles/global.css`
- Modify: `apps/desktop/src/app/App.tsx`

- [ ] **Step 1: Write failing UI tests for section switching**

```tsx
it("switches the NPC middle content between overview, skills, and knowledge", async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "NPC" }));
  fireEvent.click(await screen.findByRole("button", { name: "技能" }));
  expect(await screen.findByText("已绑定技能")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "知识库" }));
  expect(await screen.findByText("已绑定知识库")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx -t "switches the NPC middle content between overview, skills, and knowledge"`

Expected: FAIL because the NPC page is still the old single-panel implementation.

- [ ] **Step 3: Replace the old NPC panel with the three-column workspace**

```tsx
<div className="npc-workspace">
  <aside className="npc-rail">...</aside>
  <section className="npc-main">...</section>
  <aside className="npc-context-rail">...</aside>
</div>
```

- [ ] **Step 4: Re-run the UI test**

Run: `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx -t "switches the NPC middle content between overview, skills, and knowledge"`

Expected: PASS.

### Task 4: Wire NPC knowledge library binding to the real knowledge inventory

**Files:**
- Modify: `apps/desktop/src/app/App.tsx`
- Modify: `apps/desktop/src/features/workbench/Workbench.tsx`
- Modify tests: `apps/desktop/src/app/app.test.tsx`

- [ ] **Step 1: Write a failing test proving new knowledge libraries appear in the NPC knowledge section**

```tsx
it("shows newly created knowledge libraries inside the NPC knowledge section", async () => {
  loadKnowledgeInventoryMock.mockResolvedValueOnce({
    importedFiles: [],
    availableFiles: [],
    indexedDocumentCount: 0,
    registryPath: ".opencow/knowledge/imported-files.json",
    summary: "loaded",
    activeLibraryId: "product-docs",
    activeLibraryLabel: "产品文档库",
    libraries: [{ id: "product-docs", label: "产品文档库", description: "PRD 与说明" }]
  });

  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "NPC" }));
  fireEvent.click(await screen.findByRole("button", { name: "知识库" }));
  expect(await screen.findByText("产品文档库")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx -t "shows newly created knowledge libraries inside the NPC knowledge section"`

Expected: FAIL because the NPC page does not yet project the shared library inventory as a compact list.

- [ ] **Step 3: Implement the shared-knowledge projection and binding state**

```ts
const npcKnowledgeRows = state.knowledge.libraries?.map((library) => ({
  id: library.id,
  label: library.label,
  description: library.description,
  bound: selectedNpc.knowledgeLibraryIds.includes(library.id)
}));
```

- [ ] **Step 4: Re-run the test**

Run: `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx -t "shows newly created knowledge libraries inside the NPC knowledge section"`

Expected: PASS.

### Task 5: Wire NPC skills projection, detail lookup, and save flows

**Files:**
- Modify: `apps/desktop/src/app/App.tsx`
- Modify: `apps/desktop/src/features/workbench/Workbench.tsx`
- Modify tests: `apps/desktop/src/app/app.test.tsx`

- [ ] **Step 1: Write failing tests for compact skill rows and detail projection**

```tsx
it("shows local skills as compact rows in the NPC skills section and opens detail text on selection", async () => {
  scanLocalSkillsMock.mockResolvedValueOnce({
    summary: "loaded",
    total_count: 1,
    scanned_root_count: 1,
    items: [
      {
        name: "本地检索增强",
        path: "skills/rag/SKILL.md",
        source: "workspace",
        description: "读取本地文档",
        enabled: true
      }
    ]
  });
  inspectLocalSkillMock.mockResolvedValueOnce({
    query: "本地检索增强",
    summary: "loaded",
    match_count: 1,
    scanned_root_count: 1,
    items: [
      {
        name: "本地检索增强",
        path: "skills/rag/SKILL.md",
        source: "workspace",
        description: "读取本地文档",
        content_preview: "用于本地知识检索。",
        enabled: true
      }
    ]
  });

  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "NPC" }));
  fireEvent.click(await screen.findByRole("button", { name: "技能" }));
  fireEvent.click(await screen.findByRole("button", { name: "本地检索增强" }));
  expect(await screen.findByText("用于本地知识检索。")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx -t "shows local skills as compact rows in the NPC skills section and opens detail text on selection"`

Expected: FAIL because the NPC page does not yet render compact skill rows or detail projection.

- [ ] **Step 3: Implement the list projection and save/update behavior**

```ts
function handleToggleNpcSkill(skillName: string) {
  const nextSkillNames = selectedNpc.enabledSkillNames.includes(skillName)
    ? selectedNpc.enabledSkillNames.filter((name) => name !== skillName)
    : [...selectedNpc.enabledSkillNames, skillName];
  void persistNpcDraft({ ...selectedNpc, enabledSkillNames: nextSkillNames });
}
```

- [ ] **Step 4: Re-run the targeted skill test**

Run: `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx -t "shows local skills as compact rows in the NPC skills section and opens detail text on selection"`

Expected: PASS.

### Task 6: Move skill storage to OpenCow-owned app-local directories

**Files:**
- Modify: `apps/desktop/src-tauri/src/workspace.rs`
- Modify: `apps/desktop/src/features/assistant/localAssistantService.desktop.test.ts`

- [ ] **Step 1: Write failing Rust and desktop tests for app-local skill roots**

Add coverage that proves:

- local skill install copies into OpenCow-owned app-local `skills/installed/`
- enabled registry lives under OpenCow-owned app-local `skills/enabled-skills.json`
- skill scan returns installed OpenCow skills without requiring repository-root `skills/`

- [ ] **Step 2: Run targeted tests to verify RED**

Run: `cargo test local_skill_install --manifest-path apps/desktop/src-tauri/Cargo.toml`

Expected: FAIL because skill storage still assumes repo-root paths.

- [ ] **Step 3: Add app-local skill path helpers**

Move product runtime skill storage behind helpers in `workspace.rs`:

- `opencow_app_data_root(...)`
- `opencow_skills_manifest_dir(...)`
- `opencow_installed_skills_dir(...)`
- `opencow_enabled_skills_registry_path(...)`

Keep vendored or workspace-local skills only as recommendation/import sources, not as the installed product directory.

- [ ] **Step 4: Re-run the targeted tests**

Run: `cargo test local_skill_install --manifest-path apps/desktop/src-tauri/Cargo.toml`

Expected: PASS.

### Task 7: Move knowledge file pool to OpenCow-owned app-local directories

**Files:**
- Modify: `apps/desktop/src-tauri/src/workspace.rs`
- Modify: `apps/desktop/src/features/assistant/localAssistantService.desktop.test.ts`
- Modify: `apps/desktop/src/app/app.test.tsx`
- Modify: `apps/desktop/src/features/workbench/Workbench.test.tsx`

- [ ] **Step 1: Write failing tests proving file pool starts empty before UI import**

Add coverage that proves:

- `knowledge_inventory` returns no `availableFiles` by default
- repository-root markdown files do not appear automatically
- imported files are copied into OpenCow-owned app-local `knowledge/files/`

- [ ] **Step 2: Run targeted tests to verify RED**

Run: `cargo test reads_missing_knowledge_registry_as_empty --manifest-path apps/desktop/src-tauri/Cargo.toml`

Expected: FAIL once the new assertions require an empty app-local file pool instead of repo scanning.

- [ ] **Step 3: Add app-local knowledge path helpers**

Move product runtime knowledge storage behind helpers in `workspace.rs`:

- `opencow_knowledge_root(...)`
- `opencow_knowledge_files_dir(...)`
- `opencow_knowledge_registry_path(...)`

Change file-pool inventory to enumerate only copied files under `knowledge/files/`.

- [ ] **Step 4: Re-run the targeted tests**

Run: `cargo test reads_missing_knowledge_registry_as_empty --manifest-path apps/desktop/src-tauri/Cargo.toml`

Expected: PASS.

### Task 8: Rebuild the Skills page into `推荐 / 已安装`

**Files:**
- Modify: `apps/desktop/src/features/workbench/Workbench.tsx`
- Modify: `apps/desktop/src/styles/global.css`
- Modify: `apps/desktop/src/features/workbench/Workbench.test.tsx`

- [ ] **Step 1: Write failing UI tests for list-mode switching**

Add tests that prove:

- the Skills page shows `推荐` and `已安装` tabs
- recommendation rows expose install action
- installed rows expose enable/disable/delete actions

- [ ] **Step 2: Run targeted tests to verify RED**

Run: `npm --workspace apps/desktop exec -- vitest run src/features/workbench/Workbench.test.tsx -t "skills page switches between recommendation and installed modes"`

Expected: FAIL because the current page is still the raw scan page.

- [ ] **Step 3: Replace the current scan-heavy layout with the product skill center**

Keep icon actions compact and aligned with the existing lightweight button language.

- [ ] **Step 4: Re-run the targeted tests**

Run: `npm --workspace apps/desktop exec -- vitest run src/features/workbench/Workbench.test.tsx -t "skills page switches between recommendation and installed modes"`

Expected: PASS.

### Task 9: Simplify NPC skill binding to checkbox rows

**Files:**
- Modify: `apps/desktop/src/features/workbench/Workbench.tsx`
- Modify: `apps/desktop/src/features/workbench/Workbench.test.tsx`
- Modify: `apps/desktop/src/app/App.tsx`

- [ ] **Step 1: Write failing tests for checkbox-based NPC skill binding**

Add tests that prove:

- NPC `技能` shows installed-skill name rows only
- each row exposes a checkbox
- checking binds the skill to the current NPC
- unchecking removes the binding
- the NPC page no longer exposes install/enable/disable controls

- [ ] **Step 2: Run targeted tests to verify RED**

Run: `npm --workspace apps/desktop exec -- vitest run src/features/workbench/Workbench.test.tsx -t "npc skill rows use checkboxes for installed skill binding"`

Expected: FAIL because the current NPC skill page still mixes global state and binding actions.

- [ ] **Step 3: Replace NPC skill detail actions with checkbox binding**

The NPC page should consume only installed OpenCow skills and per-NPC binding state.

- [ ] **Step 4: Re-run the targeted tests**

Run: `npm --workspace apps/desktop exec -- vitest run src/features/workbench/Workbench.test.tsx -t "npc skill rows use checkboxes for installed skill binding"`

Expected: PASS.

### Task 6: Run verification and lock in the feature

**Files:**
- Modify as needed from prior tasks

- [ ] **Step 1: Run focused desktop tests**

Run: `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx src/features/assistant/localAssistantService.desktop.test.ts`

Expected: PASS.

- [ ] **Step 2: Run broader NPC/workbench regression tests**

Run: `npm --workspace apps/desktop exec vitest run src/features/workbench/Workbench.test.tsx src/app/app.persistence.test.tsx src/app/app.npc-showcase.test.tsx`

Expected: PASS.

- [ ] **Step 3: Run desktop build and Tauri check**

Run: `npm --workspace apps/desktop run build`
Expected: build succeeds

Run: `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/app/App.tsx \
  apps/desktop/src/app/app.test.tsx \
  apps/desktop/src/features/assistant/localAssistantService.ts \
  apps/desktop/src/features/assistant/localAssistantService.desktop.test.ts \
  apps/desktop/src/features/workbench/Workbench.tsx \
  apps/desktop/src/features/workbench/workbenchState.initial.ts \
  apps/desktop/src/features/workbench/workbenchState.types.ts \
  apps/desktop/src/styles/global.css \
  apps/desktop/src-tauri/src/lib.rs \
  apps/desktop/src-tauri/src/workspace.rs
git commit -m "Build desktop single NPC workspace"
```
