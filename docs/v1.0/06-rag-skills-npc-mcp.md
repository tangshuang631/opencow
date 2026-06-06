# 06. RAG、Skills、NPC 与 MCP

## 1. 总原则

RAG、Skills、NPC、MCP 是 opencow 的重要能力，v1.0 不能只做成占位入口。

要求：

- 首页不堆复杂入口。
- 能力在侧边栏或高级面板中清晰可达。
- 能力启用状态在对话底部或右侧面板可见。
- 每次调用都进入日志。

## 2. RAG

v1.0 必须支持：

- 命名知识库。
- 文档导入。
- 本地索引。
- Ollama Embedding 优先。
- Embedding 不可用时关键词 fallback。
- 检索来源展示。
- 检索结果摘要注入。

中文优先建议：

- 默认推荐中文友好的 Embedding 模型。
- 导入中文文档时保留标题、段落和来源路径。
- 检索结果显示中文摘要和原文引用。

## 3. Skills

Skills 目标：

- 支持本地 Skill。
- 支持下载 Skill。
- 支持扫描、启用、禁用。
- 支持用 Ollama 生成中文说明。
- 下载和启用必须走权限与日志。

禁止：

- 下载后直接执行未知脚本。
- 让模型自由拼接安装命令。
- 无日志安装和修改 Skill。

## 4. NPC

NPC 是低代码人设和工作模式配置。

v1.0 字段：

- 名称。
- 系统提示词。
- 默认模型。
- 默认工具。
- 默认知识库。
- 风险策略。
- 输出风格。

要求：

- 表单化配置。
- 提供默认模板。
- 不要求用户手写复杂配置。

## 5. MCP

MCP 作为高级能力保留。

v1.0 策略：

- 默认关闭。
- 用户手动开启。
- 每个 MCP server 必须有名称、命令、工作目录、权限级别。
- 启动、停止、失败、工具列表变化写入日志。
- MCP 工具调用仍然经过 permission-engine。
## 6. Planner-first rollout order

RAG, Skills, NPC, NPC collaboration, and MCP should join the assistant through the same planner context instead of bypassing it.

Current sequence:

1. readonly assistant inspection tasks
2. readonly shell diagnostics
3. confirmation-backed writable shell tasks
4. planner-visible capability catalogs for RAG / Skills / NPC / MCP
5. real execution per capability with permission, audit, and rollback integration

Near-term requirement:

- RAG / Skills / NPC / MCP should first appear as planner-visible capability registries or catalogs.
- The assistant must be able to reason about whether a task should use local shell, local knowledge, a skill, or NPC collaboration before execution wiring expands.
- None of these capability families should bypass the desktop safety chain when they later trigger tools or shell actions.

## 6.1 Current capability-catalog landing

The next desktop-first slice is now planner-visible capability catalogs, not direct execution.

Current mapped readonly capability tasks:

- `capability-rag-overview`
- `capability-skills-overview`
- `capability-npc-overview`
- `capability-mcp-overview`
- `rag-local-doc-search`

These tasks are triggered from conversation intent and return a real local readiness summary for each capability family. The current readiness check is intentionally conservative:

- it inspects vendored OpenClaw package foundations
- it reports required package count vs available package count
- it lists detected package names and missing package names
- it does not claim the full feature is complete just because the package foundation exists

Current required-package mapping:

- RAG: `llm-core`, `llm-runtime`, `model-catalog-core`
- Skills: `plugin-sdk`, `tool-call-repair`
- NPC: `llm-core`, `llm-runtime`, `tool-call-repair`
- MCP: `plugin-sdk`, `terminal-core`, `tool-call-repair`

This slice exists so later real RAG / Skills / NPC / MCP execution can attach to a visible planner surface instead of bypassing the assistant chain.

## 6.2 First real RAG landing: local document retrieval fallback

The first real RAG execution slice is now a readonly local document search fallback.

Current task kind:

- `rag-local-doc-search`

Current behavior:

- planner maps explicit local knowledge or rules lookup requests into the fixed RAG task kind
- desktop execution stays local-first and readonly
- Tauri scans the current local rule and v1.0 documentation files
- results are ranked by simple deterministic query matching
- top passages are returned through the assistant task result surface

Current scope is intentionally limited:

- no embedding dependency yet
- no remote retrieval
- no write path
- no arbitrary filesystem crawl

Current indexed source set:

- `OPENCOW_CORE_RULES.md`
- `docs/v1.0/00-overview.md`
- `docs/v1.0/02-architecture.md`
- `docs/v1.0/04-permission-safety-shell.md`
- `docs/v1.0/06-rag-skills-npc-mcp.md`
- `docs/v1.0/10-openclaw-adapter.md`

This gives the assistant a practical local knowledge fallback now, while preserving a clean path toward later embedding-backed named knowledge bases.

## 6.3 First real Skills landing: local skill discovery

The first real Skills execution slice is now a readonly local skill discovery flow.

Current task kind:

- `skills-local-scan`

Current behavior:

- planner maps explicit local skill scan or inventory requests into the fixed Skills task kind
- desktop execution stays local-first and readonly
- Tauri scans only approved local skill roots instead of arbitrary filesystem locations
- each discovered skill returns a stable summary item with `name`, `path`, `source`, and `description`
- browser preview keeps a deterministic mock result so UI and planner tests stay stable outside Tauri

Current scope is intentionally limited:

- no skill install or download path yet
- no skill enable or disable mutation yet
- no execution of unknown skill scripts
- no global or user-home skill directory crawl yet

Current scanned roots:

- `vendor/openclaw/skills/**/SKILL.md`
- `vendor/openclaw/extensions/*/SKILL.md`
- `vendor/openclaw/extensions/*/skills/**/SKILL.md`
- optional workspace-local `skills/**/SKILL.md`

Current exclusions:

- test, tests, fixtures, and `__tests__` paths are ignored
- system or globally installed skill directories are not included in this early v1.0 slice

This slice gives the assistant a practical first Skills bridge now, while preserving the later path toward audited skill enablement, permission-backed install flows, and real tool execution.

Current integration note:

- local skills scan now also reports whether each discovered skill is already enabled in the workspace-local registry

## 6.3a Next real Skills landing: local skill install into workspace

The next real Skills execution slice is now a controlled local skill install flow.

Current task kind:

- `skills-local-install`

Current behavior:

- planner maps explicit local skill install requests into a permission-backed Skills task
- in `readonly`, the planner does not execute immediately and instead requests `workspace-write`
- after approval, desktop continues through the normal assistant chain and executes the fixed install task kind
- Tauri matches only approved locally discoverable skills outside the workspace-local `skills/` directory
- the matched source `SKILL.md` is copied into `skills/<sanitized-skill-name>/SKILL.md`
- the assistant returns a stable result summary with installed skill name, installed path, source path, and install status

Current scope is intentionally limited:

- no remote skill download yet
- no arbitrary URL install yet
- no skill script execution
- no auto-enable side effect after install
- no mutation outside the workspace-local `skills/` directory

Current safety limits:

- install remains workspace-local only
- install still requires explicit permission before mutation
- install result must stay audit-visible and suitable for later rollback coverage
- installation should be followed by a separate explicit enable step unless the user has asked for a broader approved workflow

This slice is the first real bridge between discovered local skills and a workspace-owned local skill inventory that opencow can later enable, match, and use through the same controlled assistant chain.

## 6.4 Next real Skills landing: local skill detail lookup

The next real Skills execution slice is now a readonly local skill detail lookup flow.

Current task kind:

- `skills-local-inspect`

Current behavior:

- planner maps explicit "show", "read", "inspect", or "details" requests about local skills into the fixed detail task kind
- desktop execution stays local-first and readonly
- Tauri searches the approved local skill roots and ranks matches by skill name, description, preview text, and path
- the assistant returns the best local match with `name`, `path`, `source`, `description`, and `content_preview`
- browser preview keeps a deterministic mock result so UI and planner tests stay stable outside Tauri

Current scope is intentionally limited:

- no skill install or download path yet
- no skill enable or disable mutation yet
- no skill script execution yet
- no global or user-home skill directory crawl yet

This slice gives users a practical way to inspect what a discovered local skill is for before later enablement and execution wiring expands.

Current integration note:

- local skill detail lookup now also reports whether the matched skill is already enabled in the workspace-local registry

## 6.5 Next real Skills landing: local skill enable registry write

The next real Skills execution slice is now a controlled local skill enable flow.

Current task kind:

- `skills-local-enable`

Current behavior:

- planner maps explicit local skill enable or activate requests into a permission-backed Skills task
- in `readonly`, the planner does not execute immediately and instead requests `workspace-write`
- after approval, desktop continues through the same assistant chain and executes the fixed enable task kind
- Tauri resolves the best matching approved local skill and writes the result into `.opencow/skills/enabled-skills.json`
- the result is returned through the normal assistant output, audit, and task completion surface

Current scope is intentionally limited:

- no skill script execution yet
- no skill install or download yet
- no global or user-home skill registry writes
- no arbitrary file write path

Current registry payload:

- `version`
- `enabled_skills[]`
- each enabled entry stores `name`, `path`, `source`, and `description`

Current safety limits:

- enablement is limited to already discovered approved local skill roots
- duplicate enable requests do not append duplicate entries
- browser preview keeps a deterministic mock result for non-Tauri test runs

This slice is the first real mutable Skills bridge in the desktop-first chain and keeps the mainline local-first, permission-backed, auditable, and reversible.

## 6.6 Next real Skills landing: enabled local skills readback

The next real Skills execution slice is now a readonly enabled local skills readback flow.

Current task kind:

- `skills-local-enabled-list`

Current behavior:

- planner maps explicit enabled or active skill listing requests into a fixed readonly Skills task
- desktop execution stays local-first and readonly
- Tauri reads `.opencow/skills/enabled-skills.json` and returns the currently enabled workspace-local skill entries
- the assistant returns the enabled skill names together with the registry path through the normal task and audit surface

Current scope is intentionally limited:

- no skill runtime execution yet
- no registry mutation from this path
- no global or user-home registry reads
- no implicit auto-enable behavior

This slice closes the first practical loop between skill enablement and visible assistant-readable workspace state.

## 6.7 Next real Skills landing: enabled local skill matching

The next real Skills execution slice is now a readonly enabled local skill matching flow.

Current task kind:

- `skills-local-enabled-match`

Current behavior:

- planner maps explicit "which enabled skill should handle X", "recommend an enabled skill", or "match this task against enabled skills" requests into a fixed readonly Skills task
- desktop execution stays local-first and readonly
- Tauri reads only `.opencow/skills/enabled-skills.json`
- only enabled workspace-local skills participate in scoring
- the assistant returns the top local recommendation with skill name, registry path, description, and preview text

Current scope is intentionally limited:

- no skill runtime execution yet
- no implicit auto-enable behavior
- no global or user-home registry reads
- no mutation path from this flow

This slice makes the planner aware of already-enabled local skills before later skill runtime execution exists, which helps the assistant choose between shell, local knowledge, and skill suggestions through the same desktop-first chain.

## 6.8 Next real Skills landing: enabled local skill disable

The next real Skills execution slice is now a permission-backed enabled local skill disable flow.

Current task kind:

- `skills-local-disable`

Current behavior:

- planner maps explicit local skill disable, deactivate, or turn-off requests into a permission-backed Skills task
- in `readonly`, the planner does not execute immediately and instead requests `workspace-write`
- after approval, desktop continues through the same assistant chain and executes the fixed disable task kind
- Tauri reads `.opencow/skills/enabled-skills.json`, matches only enabled workspace-local skills, removes the best match, and writes the updated registry back
- the result is returned through the normal assistant output, audit, and task completion surface

Current scope is intentionally limited:

- no skill runtime execution yet
- no skill install or download yet
- no global or user-home skill registry writes
- no arbitrary file write path

Current safety limits:

- disablement is limited to already enabled approved local skills
- unmatched or already-disabled requests do not mutate the registry blindly
- browser preview keeps a deterministic mock result for non-Tauri test runs

This slice closes the first safe local Skills lifecycle loop for workspace registry management:

- scan
- inspect
- enable
- enabled-list
- enabled-match
- disable

## 6.9 Next real Skills landing: enabled skill assisted shell write

The next real Skills execution slice is now a permission-backed enabled-skill-assisted shell write flow.

Current task kind:

- `skills-local-enabled-shell-create-temp-output`

Current behavior:

- planner maps explicit requests that combine enabled skill mediation, shell automation intent, and temp-output creation into a fixed skill-assisted shell task
- in `readonly`, the planner does not execute immediately and instead requests `workspace-write`
- after approval, desktop first matches the best enabled local shell-oriented skill from `.opencow/skills/enabled-skills.json`
- desktop then continues through the existing controlled workspace-write shell runner instead of bypassing it
- the result returns both the matched enabled skill context and the shell command outcome through the normal assistant output, audit, and task completion surface

Current scope is intentionally limited:

- no general skill runtime execution yet
- no arbitrary shell command generation from skill content
- no direct mutation outside the approved workspace
- only the existing temp-output creation command is linked in this first slice

This slice is the first real ecology linkage between:

- core conversation
- enabled local skills
- assistant action dispatch
- user-approved shell execution

## 6.10 Next real Skills landing: enabled skill assisted destructive shell

The next real Skills execution slice is now a permission-backed and confirmation-backed enabled-skill-assisted destructive shell flow.

Current task kind:

- `skills-local-enabled-shell-remove-temp-output`

Current behavior:

- planner maps explicit requests that combine enabled skill mediation, shell automation intent, destructive cleanup intent, and temp-output removal into a fixed high-risk task path
- before execution, the task still requires `controlled-full` permission instead of inheriting trust from the skill match
- after permission approval, the task still requires explicit dangerous confirmation before execution continues
- desktop then matches the best enabled local shell-oriented skill from `.opencow/skills/enabled-skills.json`
- only after both safety gates pass does desktop continue into the existing controlled-full temp-output removal command

Current scope is intentionally limited:

- no general skill runtime execution yet
- no arbitrary destructive shell generation from skill content
- only the existing temp-output removal command is linked in this first slice
- the skill match augments routing context but does not weaken permission, confirmation, audit, or rollback protections

This slice closes the first full skill-assisted local shell safety loop:

- enabled skill match
- permission escalation
- dangerous confirmation
- controlled shell execution

## 6.11 Next real Skills landing: enabled skill assisted readonly RAG

The next real Skills execution slice is now a readonly enabled-skill-assisted local RAG flow.

Current task kind:

- `skills-local-enabled-rag-doc-search`

Current behavior:

- planner maps explicit requests that combine enabled skill mediation with local docs, rules, or knowledge search into a fixed readonly task path
- desktop first matches the best enabled local doc-oriented skill from `.opencow/skills/enabled-skills.json`
- after the skill match, desktop continues into the existing readonly `rag-local-doc-search` local knowledge retrieval flow
- the assistant returns a stable result summary containing both the matched skill context and the local RAG retrieval outcome

Current scope is intentionally limited:

- no permission escalation is needed because the full path stays readonly
- no arbitrary skill runtime execution yet
- no embedding dependency or remote retrieval path is introduced by this slice
- the skill match augments planner routing context but does not replace or bypass the existing local RAG safety boundary

This slice creates the first practical bridge between the enabled local Skills registry and the real local RAG/doc retrieval chain:

- enabled skill match
- readonly local knowledge retrieval
- assistant-visible combined result

## 6.11a Next real Skills landing: readonly RAG-to-shell handoff preview

The next real Skills execution slice is now a readonly skill-assisted RAG-to-shell handoff preview flow.

Current task kind:

- `skills-local-enabled-rag-shell-handoff-preview`

Current behavior:

- planner maps explicit requests that combine enabled skill mediation, local rules/docs lookup intent, shell automation intent, and preview wording into a fixed readonly task path
- desktop first matches the best enabled local skill from `.opencow/skills/enabled-skills.json`
- desktop then reuses the existing local rules and documentation retrieval flow to surface shell-related guidance
- desktop finally reuses the same shell runtime, permission engine, and safety engine preview path already used by shell planning flows
- the assistant returns one stable preview summary containing matched skill context, top local rules/docs matches, command preview, required permission, and safety state

Current scope is intentionally limited:

- no shell execution yet
- no permission escalation side effect because the full path remains readonly
- no direct skill runtime execution
- only the current temp-output create or remove shell slices are previewed in this first handoff step

This slice creates the first practical bridge across four core local assistant layers in one readonly flow:

- enabled skill match
- local RAG context
- shell next-step preview
- assistant-visible execution handoff reasoning

## 6.11b Next real Skills landing: RAG-to-shell continued execution

The next real Skills execution slice now continues the readonly RAG-to-shell handoff into the existing approved shell chain.

Current task kinds:

- `skills-local-enabled-rag-shell-create-temp-output`
- `skills-local-enabled-rag-shell-remove-temp-output`

Current behavior:

- planner maps explicit requests that combine enabled skill mediation, local rules/docs lookup intent, shell automation intent, and continuation wording into fixed execution task kinds
- workspace-write creation requests still require the normal `workspace-write` approval before execution continues
- destructive cleanup requests still require the normal `controlled-full` approval and dangerous confirmation before execution continues
- after approval, desktop reuses the same enabled skill match, local RAG retrieval, and controlled shell runner instead of introducing a separate executor
- the final assistant result keeps both the local rule/doc context and the actual shell execution outcome in one traceable summary

Current scope is intentionally limited:

- no arbitrary shell generation from RAG or skill content
- no new executor outside the existing controlled shell chain
- only the existing temp-output create and remove shell slices are linked in this continuation step

This slice turns the earlier handoff preview into a real but still tightly bounded local action bridge:

- enabled skill match
- local RAG context
- existing permission and confirmation chain
- controlled shell execution

## 6.12 First real NPC landing: local collaboration preview

The next real NPC execution slice is now a readonly local NPC collaboration preview flow.

Current task kind:

- `npc-local-collaboration-preview`

Current behavior:

- planner maps explicit NPC collaboration preview or planning requests into a fixed readonly task path
- desktop loads local NPC capability readiness through the existing capability overview path
- desktop reads enabled local workspace skills from `.opencow/skills/enabled-skills.json`
- desktop reuses the existing local rules and docs retrieval flow to gather collaboration context
- the assistant returns one stable preview summary that combines NPC readiness, enabled skills, and local context matches

Current scope is intentionally limited:

- no actual multi-agent runtime yet
- no new permission surface because the full path remains readonly
- no background NPC session orchestration yet
- no autonomous shell or tool execution from the preview path

This slice gives NPC and NPC collaboration a first practical desktop-first bridge into the main assistant chain:

- planner-visible NPC intent
- local capability readiness
- enabled local skill context
- local RAG context preview

## 6.13 Next real NPC landing: local shell plan preview

The next real NPC execution slice is now a readonly local NPC shell plan preview flow.

Current task kind:

- `npc-local-shell-plan-preview`

Current behavior:

- planner maps explicit NPC collaboration shell planning or preview requests into a fixed readonly task path
- desktop loads local NPC capability readiness through the existing capability overview path
- desktop matches the best enabled local shell-oriented skill from `.opencow/skills/enabled-skills.json`
- desktop reuses the existing shell runtime, permission engine, and safety engine to preview the next safety step for the shell task
- the assistant returns one stable preview summary containing NPC readiness, matched skill, command preview, required permission, and safety state

Current scope is intentionally limited:

- no shell execution yet
- no permission escalation yet because the full path remains readonly
- no dangerous confirmation dialog is opened from the preview path itself
- only the current temp-output create or remove shell slices are previewed in this first landing

This slice creates the first practical bridge between NPC collaboration preview and the real shell safety chain:

- planner-visible NPC shell intent
- enabled skill routing context
- shell permission preview
- shell safety preview

## 6.13a Next real NPC landing: readonly RAG-to-shell handoff preview

The next real NPC execution slice is now a readonly NPC-assisted RAG-to-shell handoff preview flow.

Current task kind:

- `npc-local-enabled-rag-shell-handoff-preview`

Current behavior:

- planner maps explicit requests that combine NPC collaboration, local rules/docs lookup intent, shell automation intent, and preview wording into a fixed readonly task path
- desktop loads local NPC capability readiness through the existing capability overview path
- desktop matches the best enabled local skill from `.opencow/skills/enabled-skills.json`
- desktop reuses the existing local rules and documentation retrieval flow to surface shell-related guidance
- desktop finally reuses the same shell runtime, permission engine, and safety engine preview path already used by shell planning flows
- the assistant returns one stable preview summary containing NPC readiness, matched skill context, top local rules/docs matches, command preview, required permission, and safety state

Current scope is intentionally limited:

- no shell execution yet
- no permission escalation side effect because the full path remains readonly
- no direct NPC runtime execution
- only the current temp-output create or remove shell slices are previewed in this first handoff step

This slice extends NPC collaboration into the same richer readonly handoff surface already established on the Skills path:

- NPC collaboration request
- enabled skill match
- local RAG context
- shell next-step preview

## 6.14 Next real NPC landing: approval-backed shell continuation

The next real NPC execution slice is now approval-backed NPC-assisted shell continuation into the existing skill-assisted shell chain.

Current behavior:

- planner maps explicit NPC collaboration shell execution requests into the same permission and confirmation chain already used by skill-assisted shell tasks
- workspace-write NPC-assisted creation requests continue into `npc-local-enabled-shell-create-temp-output`
- controlled-full NPC-assisted destructive cleanup requests continue into `permission-request -> confirmation -> npc-local-enabled-shell-remove-temp-output`
- NPC-assisted shell execution now has its own execution identity and audit wording, while still reusing the same enabled-skill match and controlled shell runner underneath
- NPC wording does not bypass permission, confirmation, audit, timeout, or rollback protections

Current scope is intentionally limited:

- no independent NPC shell executor yet
- no arbitrary shell generation from NPC content
- only the existing temp-output create and remove shell slices are linked in this first continuation step

This slice turns NPC collaboration shell intent into a real continuation path instead of a preview-only branch:

- NPC collaboration request
- permission escalation if needed
- dangerous confirmation if needed
- NPC-assisted execution identity
- existing enabled-skill shell execution mechanics

## 6.15 Next real NPC landing: rules-and-docs handoff into shell continuation

The next real NPC execution slice now lets NPC collaboration review local rules and docs before continuing into the existing approved shell chain.

Current task kinds:

- `npc-local-enabled-rag-shell-create-temp-output`
- `npc-local-enabled-rag-shell-remove-temp-output`

Current behavior:

- planner maps explicit requests that combine NPC collaboration, local rules/docs lookup intent, shell automation intent, and continuation wording into fixed execution task kinds
- workspace-write creation requests still require the normal `workspace-write` approval before execution continues
- destructive cleanup requests still require the normal `controlled-full` approval and dangerous confirmation before execution continues
- after approval, desktop reuses the same enabled-skill match, local RAG retrieval, and controlled shell runners instead of introducing a separate NPC executor
- the final assistant result keeps NPC-assisted wording together with local rule/doc matches and the actual shell execution outcome in one traceable summary

Current scope is intentionally limited:

- no arbitrary shell generation from NPC or RAG content
- no new executor outside the existing controlled shell chain
- only the existing temp-output create and remove shell slices are linked in this continuation step

This slice extends the local NPC mainline into a richer but still bounded action bridge:

- NPC collaboration request
- local RAG context
- existing permission and confirmation chain
- controlled shell execution

## 6.15a High-priority NPC real-world scenario: local project showcase delivery

The next high-priority NPC direction is no longer an abstract collaboration demo. It is a real local delivery scenario that should become a first-class desktop NPC workflow.

Target user request shape:

- use an NPC-style local collaboration flow
- inspect and run another local project such as `cattle`
- launch the project locally
- capture real screenshots from the running result
- generate a project showcase website for resume or portfolio use
- write the showcase into a user-prepared git repository
- optionally commit and push after explicit user approval

Expected desktop-first NPC behavior:

- the user should be able to describe the above goal in one natural request instead of manually splitting every substep
- the assistant must first classify the request as a multi-step NPC-assisted local delivery workflow
- before any local run, screenshot capture, file write, git write, or push action, the assistant must request the required permission level explicitly
- the assistant must keep the workflow traceable as one task chain instead of hiding the steps inside opaque background behavior

Required workflow stages:

1. readonly local project inspection
2. readonly run-plan preview
3. permission request for local launch or file generation when needed
4. controlled local project run
5. controlled screenshot capture
6. controlled showcase-site generation into the target repository
7. preview of changed files and generated artifacts
8. optional git commit or push only after explicit user approval

Required user-visible deliverables:

- detected local project summary
- run command preview
- screenshot capture summary and file paths
- generated showcase site summary
- changed file list
- target repository summary
- final audit trail for every privileged step

Required safety boundaries:

- NPC wording must not bypass permission escalation
- NPC wording must not bypass dangerous confirmation for destructive or high-impact actions
- screenshot capture must stay inside explicit local targets related to the current task
- repository write or git push must remain separately confirmable even if earlier workspace-write permission was granted
- if project startup fails, the assistant must stop, report the failure clearly, and offer retry or repair suggestions instead of fabricating screenshots or generated output

This scenario is important because it represents a real "dirty work" assistant task rather than a toy shell example. Future NPC execution slices should be prioritized by how directly they move this workflow from preview-only into a real, permission-backed local delivery chain.

## 6.16 Self-expansion and self-repair product direction

opencow should not stop at static capability catalogs. It should gradually become able to extend and repair itself through the same controlled desktop-first assistant chain.

Required product direction:

- if the user asks opencow to install a local skill, opencow should be able to discover, install, and later enable it through conversation
- if the user asks opencow to create an NPC, opencow should be able to create and persist that NPC definition through an auditable local flow
- if opencow itself encounters a local product error, it should be able to inspect the failure, explain the likely cause, propose a repair, and apply it only after the correct permission and risk step

Hard safety boundary:

- self-repair does not bypass permission escalation
- self-repair does not bypass dangerous confirmation for destructive or high-impact changes
- self-repair must not silently rewrite broad project state just because a local model guessed a fix
- every self-repair mutation must remain audit-visible and rollback-visible

Local-model-first requirement:

- these flows must be shaped so a weaker local model can still route them reliably
- prompts, planner branches, previews, and repair suggestions should be narrower and more deterministic than the upstream openclaw default
- opencow should raise the practical quality floor on local models through stronger boundaries, better defaults, and better execution scaffolding rather than assuming the model alone will compensate

## 6.16 Desktop continuity improvement: continue from latest RAG shell preview

The desktop mainline now carries forward the latest previewable RAG-to-shell intent so the user can continue without repeating the full original request text.

Current behavior:

- readonly preview tasks for
  - `skills-local-enabled-rag-shell-handoff-preview`
  - `npc-local-enabled-rag-shell-handoff-preview`
  store a derived continuation message in task metadata
- when the next composer input is a short continuation command such as `continue`, `proceed`, `run`, or `execute`, desktop resolves it against the latest preview task that exposed continuation metadata
- the resolved message is still sent back through the same assistant planner instead of bypassing the planner
- permission escalation, dangerous confirmation, audit wording, timeout handling, and rollback protections remain unchanged because continuation re-enters the existing approved execution chain
- the first supported continuation shape converts preview wording like `preview the next safe shell step to ...` into the corresponding explicit `continue to ... with shell automation` request

Current scope is intentionally limited:

- only the latest preview task with explicit continuation metadata is eligible
- no hidden free-form action inference outside the existing fixed shell slices
- no bypass around permission, confirmation, audit, or rollback

Current clean app-level coverage now includes:

- skill-assisted readonly RAG shell handoff preview -> `continue` -> `workspace-write` approval -> execution
- NPC-assisted readonly RAG shell handoff preview -> `continue` -> `workspace-write` approval -> execution
- skill-assisted destructive RAG shell handoff preview -> `continue` -> `controlled-full` approval -> dangerous confirmation -> execution
- NPC-assisted destructive RAG shell handoff preview -> `continue` -> `controlled-full` approval -> dangerous confirmation -> execution

This means the current desktop-first continuation mainline is now covered on both the Skills and NPC branches for:

- preview
- continuation resolution
- permission escalation
- dangerous confirmation where required
- controlled shell completion

## 6.17 Pure local RAG shell handoff mainline

The desktop-first mainline now also includes a pure local RAG shell handoff path that does not require Skill or NPC wording.

Current task kinds:

- `rag-local-shell-handoff-preview`
- `rag-local-shell-create-temp-output`
- `rag-local-shell-remove-temp-output`

Current behavior:

- explicit local rules or docs review requests can preview the next safe shell step through readonly local RAG
- the preview stores continuation metadata so a short follow-up such as `continue` can reuse the approved mainline
- create requests continue through `workspace-write`
- destructive remove requests continue through `controlled-full` and dangerous confirmation
- execution still reuses the same controlled shell, audit, timeout, and rollback chain

Current safety limits:

- only fixed `temp-output` create and remove actions are supported in this slice
- no free-form shell generation is exposed
- no arbitrary filesystem targets are inferred from local RAG content
- pure local RAG intent must not steal explicit Skill-assisted or NPC-assisted phrasing

This closes the narrow baseline path:

- local rules retrieval
- shell preview
- short continuation
- permission or dangerous confirmation
- controlled execution
- audit-visible result

## 6.18 First real MCP landing: readonly local plugin inventory

The next real MCP execution slice is now a readonly local MCP-adjacent plugin inventory flow.

Current task kind:

- `mcp-local-plugin-scan`

Current behavior:

- planner maps explicit local MCP plugin, server, or inventory scan requests into a fixed readonly task path
- desktop execution stays local-first and readonly
- Tauri scans only approved local `openclaw.plugin.json` manifests instead of arbitrary config locations
- the assistant returns stable plugin summary items with `id`, `path`, `source`, `activation`, `tool_count`, and `skill_count`
- browser preview keeps a deterministic mock result so UI and planner tests stay stable outside Tauri

Current scope is intentionally limited:

- no MCP server start or stop path yet
- no MCP config write path yet
- no external tool invocation yet
- no permission escalation because the full path remains readonly

Current scanned roots:

- `vendor/openclaw/extensions/**/openclaw.plugin.json`
- optional workspace-local `plugins/**/openclaw.plugin.json`

This slice gives MCP the first practical desktop-first bridge into the same assistant chain as the other core capability families:

- planner-visible MCP intent
- readonly local inventory
- assistant-visible real result

## 6.19 Next MCP landing: readonly local plugin detail lookup

After the readonly local plugin inventory slice, the next landed MCP step is:

- `mcp-local-plugin-inspect`

This extends the same desktop-first chain with a narrow readonly detail lookup:

- adapter intent mapping resolves explicit MCP plugin detail requests
- desktop assistant execution calls a real local Tauri readonly command
- Tauri matches only approved local `openclaw.plugin.json` manifests
- result fields stay stable and assistant-visible: `id`, `path`, `source`, `activation`, `tool_count`, `skill_count`, `description`, `tool_names`, `skill_paths`

Safety boundary remains unchanged:

- readonly only
- no MCP server launch
- no MCP tool execution
- no config mutation
- no expansion outside approved plugin roots

## 6.20 Next MCP landing: readonly local plugin start preview

After readonly plugin inventory and detail lookup, the next landed MCP step is:

- `mcp-local-plugin-start-preview`

This extends the same desktop-first chain with a narrow readonly startup preview:

- adapter intent mapping resolves explicit MCP plugin start or launch preview requests
- desktop assistant execution calls a real local Tauri readonly command
- Tauri matches only approved local `openclaw.plugin.json` manifests
- result fields stay stable and assistant-visible: `id`, `path`, `source`, `activation`, `startup_allowed`, `command_preview`, `working_directory`, `risk_summary`, `requires_config`, `config_hint`

Safety boundary remains unchanged:

- readonly only
- no MCP server launch
- no MCP tool execution
- no config mutation
- no expansion outside approved plugin roots
- command preview remains informational and not executable authorization

## 6.21 Next MCP landing: controlled local plugin start

After readonly inventory, detail lookup, and start preview, the next landed MCP step is:

- `mcp-local-plugin-start`

This is the first real execution slice for MCP in the desktop-first chain:

- adapter intent mapping resolves explicit local MCP plugin start requests
- planner routes them through `controlled-full` permission and explicit dangerous confirmation
- desktop assistant execution calls a tightly scoped Tauri command
- current real execution scope remains intentionally narrow to a fixed browser plugin candidate path

Safety boundary remains intentionally narrow:

- no arbitrary MCP server start
- no arbitrary plugin execution
- no config mutation
- no bypass around permission, confirmation, audit, or rollback-visible task flow

Current clean app-level acceptance path:

- `apps/desktop/src/app/app.mcp-start.test.tsx` now covers:
  - conversation submit
  - `controlled-full` permission request
  - dangerous confirmation
  - final controlled desktop result
- this clean file is the current stable acceptance path for the MCP start chain
- the historical broad app suite file `apps/desktop/src/app/app.test.tsx` remains a separate pollution-cleanup concern and should not be expanded for new MCP slices until it is repaired in a dedicated cleanup window

## 6.22 Opencow self-repair preview landing

The next desktop-first assistant slice is a readonly opencow self-repair preview, not direct mutation.

Current task kind:

- `opencow-self-repair-preview`

Current behavior:

- planner maps explicit opencow self-diagnose or self-fix-preview requests into a fixed readonly task
- desktop execution combines workspace summary, config summary, and local rules or docs search into one response
- the final assistant result explains the staged repair path before any mutation is approved

Current scope is intentionally limited:

- no file mutation
- no config rewrite
- no process restart
- no permission escalation by default
- no silent self-repair action

Current result includes:

- workspace root context
- top config files and root scripts
- relevant local rules or v1.0 docs
- recommended staged repair flow:
  inspect failure -> preview repair -> request permission for any mutation -> verify -> keep audit and rollback visibility

This slice gives opencow a safer first self-repair foothold while keeping the same permission, audit, and rollback discipline required for later writable repair actions.
