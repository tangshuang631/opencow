# Desktop Single NPC Workspace Design

## 1. Goal

This slice turns the desktop `NPC` area from a static capability panel into a real single-NPC low-code workspace.

The target is not multi-NPC collaboration yet.

The target is:

- create NPCs from the desktop UI
- browse existing NPCs as compact cards
- open one NPC into a structured configuration workspace
- configure the NPC in low-code form instead of asking the user to handwrite raw config files
- connect the UI to real desktop read and write flows for NPC config, local skills, and knowledge libraries

Out of scope for this slice:

- multi-NPC workflow execution
- drag-and-drop collaboration chains
- direct MCP execution from the NPC page
- freeform raw file editing as the primary experience

## 2. Why This Slice

Current desktop `NPC` support is still too close to a placeholder panel:

- the user can inspect capability summaries
- the user can draft prompt text
- the user can save through the existing `npc-config-write` path

But it is not yet a productized low-code workflow.

The user explicitly wants:

- small NPC cards on the left
- a right-side NPC configuration navigator
- the middle area to show the real configuration content for the selected section
- compact list-based presentation for Skills and RAG-like knowledge binding instead of large cards
- Chinese-first concise UI copy
- a visual style that stays consistent with the existing desktop workbench

## 3. Chosen Information Architecture

The chosen layout is a three-column `NPC workspace`.

### 3.1 Left column: NPC list

Purpose:

- show all existing NPCs
- create a new NPC
- choose the current NPC

Interaction:

- keep small NPC cards
- each card shows only short core information:
  - name
  - one-line summary or role label
  - current model badge or lightweight status text if space allows
- top-right `+` creates a new NPC
- clicking the card body or the gear icon enters the same NPC configuration state

Rules:

- cards should remain compact and visually consistent with the current app
- do not expand full forms inside the left column
- do not turn the left rail into a dense management dashboard

### 3.2 Middle column: real configuration workspace

Purpose:

- show the active section for the selected NPC
- host all real form, list, and detail content

This is the only place that should carry substantial editing content.

Rendering rules by section:

- `概览`: summary-driven compact settings surface
- `人设`: structured Chinese form and editor area
- `技能`: compact list rows, not cards
- `知识库`: compact list rows, not cards

The middle column must stay visually calm:

- use separators and grouped list rows instead of many floating cards
- prefer compact rows with inline actions
- only open details when the user selects an item

### 3.3 Right column: NPC section navigator

Purpose:

- anchor the current NPC context
- switch the middle column between configuration sections

Final first-level items:

- `概览`
- `人设`
- `技能`
- `知识库`

Consolidation rules:

- model configuration is folded into `概览`
- `rules.md`, `agent.md`, and related rules or persona file concepts are folded into `人设`

Visual rules:

- no card stack on the right side
- use app-consistent divider-based navigation rows
- keep labels short and Chinese-first
- keep the right rail narrow and lightweight

## 4. Section-Level UX

### 4.1 概览

This is the lightweight summary and setup section for the selected NPC.

Show:

- NPC name
- short description
- default model
- enabled skills count
- bound knowledge library count
- last updated time

Allow editing:

- name
- description
- default model

Do not place large prose editors here.

This section should answer: "what is this NPC and what is it currently bound to?"

### 4.2 人设

This section contains the persona and rule-facing authoring surface.

Show and edit:

- role / persona title
- system prompt
- output style
- safety or risk style if it already exists in current NPC config concepts
- `agent.md` draft content or mapped equivalent
- `rules.md` draft content or mapped equivalent

Form strategy:

- Chinese labels
- split long text areas by purpose
- avoid forcing users into raw JSON editing

This section is where low-code replaces hand-editing config files.

### 4.3 技能

This section is list-based.

Do not use cards.

Show a compact list with one row per skill:

- skill name
- enabled / disabled state
- source
- short description
- row action or click target

Interaction:

- clicking a row opens a detail pane or inline detail area in the middle column
- users can review a skill before enabling or disabling
- enable / disable / install continues to use the existing audited desktop flows

This section should reuse existing real capability surfaces where possible:

- scanned local skills
- enabled local skills
- skill detail lookup

### 4.4 知识库

This section is also list-based.

Do not use cards.

Show:

- currently bound libraries
- available libraries
- active selection state for this NPC

Each row should be compact:

- library name
- short description
- file count if available
- bound / unbound status

Interaction:

- clicking a row shows lightweight details in the middle area
- binding or unbinding updates only the selected NPC config
- this section must treat knowledge libraries as shared resources and NPC binding as a per-NPC choice

## 5. Data Model Direction

This slice needs a stronger desktop-side NPC state shape than the current prompt draft only panel.

### 5.1 Frontend draft state

Add a dedicated NPC workspace UI state for:

- selected NPC id
- active NPC section tab
- pending create dialog state
- selected detail item in `技能`
- selected detail item in `知识库`
- save status

Recommended UI enum:

- `overview`
- `persona`
- `skills`
- `knowledge`

### 5.2 NPC config shape

The persisted NPC config should be able to represent the chosen low-code surface.

Minimum fields for this slice:

- `id`
- `name`
- `description`
- `defaultModel`
- `personaPrompt`
- `outputStyle`
- `agentDraft`
- `rulesDraft`
- `enabledSkillNames`
- `knowledgeLibraryIds`
- timestamps such as `updatedAt`

The exact storage schema may adapt to existing OpenClaw NPC config expectations, but the desktop UI must not depend on freeform raw file structure.

### 5.3 Tauri integration direction

The desktop layer needs stable read/write commands for:

- list NPC configs
- read one NPC config
- create NPC config
- update NPC config

This slice should not require the user to ask the model to generate a full config just to do basic setup.

The existing `npc-config-write` audited path remains important, but the product needs a deterministic structured write path for ordinary low-code edits.

Recommended split:

- readonly Tauri commands for list and read
- workspace-write Tauri command for create
- workspace-write Tauri command for update

The assistant planning layer can continue to own model-generated NPC config generation as a separate advanced path.

## 6. Backend and Capability Boundaries

### 6.1 Skills

OpenCow must stop presenting raw OpenClaw skill discovery as its product skill center.

OpenCow needs its own application-owned skill storage root, separate from the repository and separate from OpenClaw runtime directories.

Product-owned skill structure:

- `skills/manifest/recommended-skills.json`
- `skills/installed/<skill-id>/SKILL.md`
- `skills/installed/<skill-id>/meta.json`
- `skills/enabled-skills.json`
- `skills/install-audit.json`

The `Skills` page becomes an OpenCow skill center with two top-level list modes:

- `推荐`
- `已安装`

Rules:

- `推荐` reads from OpenCow-local `recommended-skills.json`
- `已安装` reads from OpenCow-local `skills/installed/`
- global enable / disable reads and writes OpenCow-local `enabled-skills.json`
- install sources for the first slice are:
  - install from the OpenCow-local recommendation manifest
  - import from a user-selected local file or directory
- direct OpenClaw import is not the product flow

Future path:

- after networked search exists, the conversation experience may resolve a named skill through web search, review it, request confirmation, and then install it into OpenCow-local `skills/installed/`

The NPC page should not duplicate global skill management.

The NPC `技能` section consumes only the OpenCow-local installed skill list and maps it into per-NPC checkbox binding state.

This keeps both concepts explicit:

- OpenCow global installed / enabled skill state
- current NPC skill binding state

### 6.2 Knowledge

OpenCow also needs a product-owned knowledge storage root.

Product-owned knowledge structure:

- `knowledge/files/`
- `knowledge/libraries.json`

Rules:

- the shared file pool reads only from OpenCow-local `knowledge/files/`
- if the user has not imported files through the desktop UI, the file pool is empty
- repository root files, docs, README files, and source files must never appear automatically as candidate file-pool items
- importing a file copies it into OpenCow-local `knowledge/files/`
- libraries reference copied pool items instead of arbitrary repository paths

The selected NPC binds to one or more knowledge libraries without changing the global library store itself.

### 6.3 MCP

MCP stays out of the single-NPC configuration flow for now.

No direct MCP section is added to the right-side NPC navigator in this slice.

Future collaboration or advanced execution can connect MCP later without bloating the first low-code NPC workspace.

## 7. Visual Direction

This slice should follow the existing desktop workbench language:

- shallow surfaces
- soft separators
- compact rows
- restrained accent color
- no oversized card stacks in the center or right rail

Specific decisions:

- left column may keep compact NPC cards
- middle `技能` and `知识库` use lists, not cards
- right column uses divider-based navigation rows, not cards
- Chinese copy should stay short and product-like

This is an anti-fragmentation rule:

- avoid cards inside cards inside cards
- prefer one main surface with internal separators

## 8. Error Handling

The page must gracefully handle:

- no NPCs yet
- NPC config read failure
- NPC config save failure
- no local skills found
- no knowledge libraries found
- skill or knowledge detail not found

UI behavior:

- show concise inline Chinese error text
- keep the selected NPC and active section stable when a refresh fails
- do not clear the middle workspace on transient fetch failures

## 9. Testing

Frontend tests should cover:

- creating a new NPC from the left rail
- selecting an NPC card enters the same state as clicking its gear
- right-side navigator switches the middle content
- `技能` renders compact list rows instead of card blocks
- `知识库` renders compact list rows instead of card blocks
- `概览` includes model controls
- `人设` includes rules and agent draft editing surfaces

Desktop integration tests should cover:

- NPC list load
- NPC create
- NPC update
- skill list projection into NPC page
- knowledge library binding projection into NPC page

## 10. Rollout Order

Recommended implementation order:

1. add NPC workspace frontend state and three-column layout
2. add left-side create/select NPC flow with compact cards
3. add right-side navigator and middle-section switching
4. add real NPC list/read/create/update desktop bridge
5. wire `概览`
6. wire `人设`
7. wire `技能` with compact list plus detail
8. wire `知识库` with compact list plus binding state
9. run desktop tests, build, and Tauri verification

## 11. Future Follow-Up

Future collaboration belongs in a separate slice.

When that work begins, the landing pattern should be:

- keep the current single-NPC workspace intact
- add a separate collaboration entry or side panel later
- reuse saved single-NPC configs as collaboration building blocks

That future direction should not complicate the first single-NPC low-code workspace now.

## 12. Product-Owned Runtime Directories

OpenCow should behave like an installable desktop product on both macOS and Windows.

Recommended runtime roots:

- macOS: `~/Library/Application Support/OpenCow/`
- Windows: `%AppData%/OpenCow/`

OpenCow runtime data must live there for:

- skills
- knowledge file pool
- knowledge library registry
- NPC configs
- prompts and rules
- desktop settings

The development repository root may still provide defaults, templates, or fallback manifests during development, but it is not the product data store shown in the UI.
