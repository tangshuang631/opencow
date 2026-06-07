# 10. OpenClaw Adapter

## 1. 模块定位

`packages/openclaw-adapter` 是 opencow 对上游 `vendor/openclaw` 的第一层受控边界。

v1.0 阶段不直接把 OpenClaw 大量源码散落接入桌面端，也不把上游私有 workspace 包直接暴露给 UI。所有上游能力都应先经过 adapter 探测、声明、测试，再逐步接入 model gateway、permission engine、safety engine、audit core、rollback core 等 opencow 自有模块。

## 2. 当前职责

- 定位本地 `vendor/openclaw` 根目录。
- 读取 OpenClaw 根包元信息，用于审计、许可声明和兼容性检查。
- 探测关键能力包是否存在，包括 `llm-core`、`llm-runtime`、`model-catalog-core`、`plugin-sdk`、`terminal-core`、`tool-call-repair`。
- 提供只读的 OpenClaw workspace 包清单读取能力，作为后续 `ollama / tool / rag / skills` 真实接入前的受控发现层。
- 提供 browser-safe 的本地助手任务首轮规划能力，把“普通只读任务”和“高风险清理任务”在进入桌面执行层前先分流。
- 提供受控命令策略分析器，用于在真正执行前产出 `blocked / needs-confirmation / ready` 结论。
- 提供浏览器安全入口 `@opencow/openclaw-adapter/browser`，仅暴露可在桌面前端安全消费的纯策略模块。
- 不导入、不启动、不修改上游运行时代码。

## 3. 后续接入顺序

1. Ollama-first 模型列表读取和基础聊天。
2. 远程 `baseUrl + apiKey` 高级设置兼容层。
3. 工具调用修复与安全执行前置检查。
4. Skills、RAG、NPC、MCP 能力注册。
5. OpenClaw 上游能力的裁剪、折叠和本地桌面优化。

## 4. 开发规则

- 新增 adapter 能力必须先写单元测试。
- 不允许 UI 直接读取 `vendor/openclaw`。
- 桌面前端如果需要消费 adapter，必须优先走 browser-safe 子入口，不能从包根导入会触发 `node:*` 依赖的模块。
- 不允许绕过权限、安全、日志、回退模块执行高风险工具。
- 不批量转换上游编码，不直接重写上游文件。
- 每次新增 adapter 子能力后，更新本文件和健康检查路径。

## 5. 验证命令

```bash
npm --workspace packages/openclaw-adapter run test:unit
npm --workspace packages/openclaw-adapter run build
npm run test:unit
npm run check:encoding
npm run check:health
```
## 6. Current v1.0 adapter landing slice

The current desktop mainline now includes the first real assistant-to-shell mapping through the adapter layer.

- Conversation intent is first classified inside `packages/openclaw-adapter`.
- Readonly shell diagnostics are mapped to explicit task kinds instead of passing raw commands through the UI.
- The first shipped mappings are:
  - `readonly-shell-git-status`
  - `readonly-shell-workspace-root`
  - `readonly-shell-packages-dir`
- These task kinds are consumed by the desktop assistant service and forwarded into the Tauri-side readonly shell executor.
- The adapter still does not allow arbitrary shell text to cross into execution.

This is the intended bridge toward the next stage:

1. readonly shell diagnostics
2. confirmation-backed writable shell plans
3. real assistant execution chain with audit and rollback linkage
4. capability catalogs for RAG / Skills / NPC / MCP to join the same planner context

## 6.1 Current capability catalog mappings

The adapter now exposes the first planner-visible capability family mappings for the desktop assistant:

- `capability-rag-overview`
- `capability-skills-overview`
- `capability-npc-overview`
- `capability-mcp-overview`

Planner behavior:

- these mappings remain readonly
- they are selected from conversation intent, not from arbitrary tool invocation
- they return stable task kinds for the desktop queue and audit pipeline
- they are meant to answer "what local OpenClaw foundation exists for this family right now?"

The desktop execution layer then resolves the mapped task into a local capability overview result that reports:

- readiness status
- required package count
- available package count
- available package names
- missing package names

This is the intended bridge between raw package discovery and later real capability execution.

## 6.2 First real RAG execution mapping

The adapter now also exposes the first real readonly RAG execution mapping:

- `rag-local-doc-search`

This mapping is intentionally narrow:

- it is selected only for explicit local knowledge / rules lookup intent
- it remains readonly
- it targets the desktop local assistant chain rather than bypassing it
- it does not expose arbitrary path search or free-form shell execution

The current result is a local document retrieval fallback over the opencow rules and v1.0 docs. This is the first practical bridge from planner-visible RAG intent to real user-facing assistant help.

## 6.3 First real Skills execution mapping

The adapter now also exposes the first real readonly Skills execution mapping:

- `skills-local-scan`

This mapping is intentionally narrow:

- it is selected only for explicit local skill scan, list, or inventory intent
- it remains readonly
- it targets the desktop local assistant chain rather than bypassing it
- it does not allow skill install, enable, disable, or execution

The current result is a local skill discovery summary over approved repo-local OpenClaw skill roots. This is the first practical bridge from planner-visible Skills intent to real user-facing assistant help.

Current approved scan scope:

- `vendor/openclaw/skills/**/SKILL.md`
- `vendor/openclaw/extensions/*/SKILL.md`
- `vendor/openclaw/extensions/*/skills/**/SKILL.md`
- optional workspace-local `skills/**/SKILL.md`

Current result fields:

- `name`
- `path`
- `source`
- `description`

Current integration note:

- the readonly scan result now also carries an `enabled` flag sourced from the workspace-local skill registry when present

Current safety limits:

- no arbitrary filesystem crawl
- no system skill directory inspection
- no skill script execution
- no mutation path

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-scan.test.ts src/app/app.test.tsx
cargo test
```

## 6.4 Next real Skills execution mapping

The adapter now also exposes the next real readonly Skills execution mapping:

- `skills-local-inspect`

This mapping is intentionally narrow:

- it is selected only for explicit local skill detail, read, show, or inspect intent
- it remains readonly
- it targets the desktop local assistant chain rather than bypassing it
- it does not allow skill install, enable, disable, or execution

The current result is a local skill detail lookup over the same approved repo-local OpenClaw skill roots used by skill discovery. This is the next practical bridge from planner-visible Skills intent to real user-facing assistant help.

Current result fields:

- `name`
- `path`
- `source`
- `description`
- `content_preview`

Current integration note:

- the readonly detail result now also carries an `enabled` flag sourced from the workspace-local skill registry when present

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-inspect.test.ts src/app/app.test.tsx
cargo test
```

## 6.5 First controlled Skills mutation mapping

The adapter now also exposes the first permission-backed local Skills mutation mapping:

- `skills-local-enable`

This mapping is intentionally narrow:

- it is selected only for explicit local skill enable or activate intent
- in `readonly`, it returns a `permission-request` for `workspace-write`
- after approval, it resolves to a fixed task kind instead of passing arbitrary user text into a shell command
- it targets the desktop local assistant chain rather than bypassing it
- it does not execute a skill, install a skill, or download any remote artifact

Current desktop execution contract:

- request permission in planner
- continue through the same queued assistant task after approval
- write only `.opencow/skills/enabled-skills.json`
- return a stable result summary with skill name, registry path, and enable status

Current safety limits:

- approved local skill roots only
- no global registry mutation
- no free-form file path output
- no direct skill runtime execution

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-enable.test.ts src/app/app.test.tsx
cargo test
```

## 6.6 Next readonly Skills registry mapping

The adapter now also exposes the next readonly Skills registry mapping:

- `skills-local-enabled-list`

This mapping is intentionally narrow:

- it is selected only for explicit enabled or active skill listing intent
- it remains readonly
- it targets the desktop local assistant chain rather than bypassing it
- it reads only the controlled workspace-local registry created by the earlier enablement slice
- it does not enable, disable, install, download, or execute any skill

Current desktop execution contract:

- resolve to a fixed readonly task kind
- read `.opencow/skills/enabled-skills.json`
- return stable enabled skill items with `name`, `path`, `source`, and `description`
- keep browser preview deterministic for app-side tests outside Tauri

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-enabled-list.test.ts src/app/app.test.tsx
cargo test
```

## 6.7 Next readonly enabled Skills matching mapping

The adapter now also exposes the next readonly enabled Skills matching mapping:

- `skills-local-enabled-match`

This mapping is intentionally narrow:

- it is selected only for explicit enabled-skill recommendation or matching intent
- it remains readonly
- it targets the desktop local assistant chain rather than bypassing it
- it reads only the controlled workspace-local registry created by the earlier enablement slice
- it does not enable, disable, install, download, or execute any skill

Current desktop execution contract:

- resolve to a fixed readonly task kind
- read `.opencow/skills/enabled-skills.json`
- score only enabled workspace-local skills against the user request
- return up to the top 3 recommendations with stable summary fields
- keep browser preview deterministic for app-side tests outside Tauri

This slice is the first practical planner-aware bridge from "enabled skill inventory exists" to "the assistant can recommend which enabled skill fits this task" without yet allowing skill runtime execution.

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-enabled-match.test.ts
cargo test
```

## 6.8 Next controlled enabled Skills disable mapping

The adapter now also exposes the next permission-backed enabled Skills disable mapping:

- `skills-local-disable`

This mapping is intentionally narrow:

- it is selected only for explicit local skill disable, deactivate, or turn-off intent
- in `readonly`, it returns a `permission-request` for `workspace-write`
- after approval, it resolves to a fixed task kind instead of passing arbitrary user text into a shell command
- it targets the desktop local assistant chain rather than bypassing it
- it does not execute a skill, install a skill, or download any remote artifact

Current desktop execution contract:

- request permission in planner
- continue through the same queued assistant task after approval
- read and rewrite only `.opencow/skills/enabled-skills.json`
- remove only the best matching enabled workspace-local skill entry
- return a stable result summary with skill name, registry path, and disable status

Current safety limits:

- approved local enabled-skill entries only
- no arbitrary registry path writes
- no global registry mutation
- no direct skill runtime execution

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-disable.test.ts src/app/app.test.tsx
cargo test local_skill_disable -- --nocapture
```

## 6.9 Next skill-assisted shell dispatch mapping

The adapter now also exposes the next permission-backed enabled-skill-assisted shell dispatch mapping:

- `skills-local-enabled-shell-create-temp-output`

This mapping is intentionally narrow:

- it is selected only for explicit requests that combine enabled skill mediation, shell automation intent, and temp-output creation
- in `readonly`, it returns a `permission-request` for `workspace-write`
- after approval, it resolves to a fixed desktop task kind instead of exposing arbitrary shell text
- it targets the desktop local assistant chain rather than bypassing it
- it does not execute arbitrary skill code or free-form shell commands

Current desktop execution contract:

- request permission in planner
- continue through the same queued assistant task after approval
- match an enabled local shell-oriented skill from `.opencow/skills/enabled-skills.json`
- reuse the existing controlled workspace-write temp-output command
- return a stable result summary with the matched skill, registry path, command, and shell outcome

Current safety limits:

- enabled local skill matching first, controlled shell execution second
- no arbitrary command synthesis from skill content
- no write path outside the approved workspace
- no direct skill runtime execution

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-shell-write.test.ts src/app/app.test.tsx
```

## 6.10 Next skill-assisted destructive shell dispatch mapping

The adapter now also exposes the next permission-backed and confirmation-backed enabled-skill-assisted destructive shell dispatch mapping:

- `skills-local-enabled-shell-remove-temp-output`

This mapping is intentionally narrow:

- it is selected only for explicit requests that combine enabled skill mediation, shell automation intent, destructive cleanup intent, and temp-output removal
- before execution, it still requires `controlled-full` permission
- after permission approval, it still resolves to a destructive confirmation step instead of executing immediately
- after confirmation, it resolves to a fixed desktop task kind instead of exposing arbitrary shell text
- it does not execute arbitrary skill code or free-form destructive shell commands

Current desktop execution contract:

- request controlled-full permission in planner
- continue into destructive confirmation after approval
- match an enabled local shell-oriented skill from `.opencow/skills/enabled-skills.json`
- reuse the existing controlled-full temp-output removal command
- return a stable result summary with the matched skill, registry path, command, and shell outcome

Current safety limits:

- enabled local skill matching first, controlled destructive shell execution last
- no arbitrary destructive command synthesis from skill content
- no confirmation bypass because a skill was matched
- no direct skill runtime execution

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-shell-write.test.ts src/app/app.test.tsx
```

## 6.11 Next skill-assisted readonly RAG dispatch mapping

The adapter now also exposes the next readonly enabled-skill-assisted local RAG dispatch mapping:

- `skills-local-enabled-rag-doc-search`

This mapping is intentionally narrow:

- it is selected only for explicit requests that combine enabled skill mediation with local docs, rules, or knowledge lookup intent
- it stays readonly from planner through desktop execution
- it first resolves to enabled local skill matching instead of directly inheriting generic RAG routing
- after the skill match, it reuses the existing local `rag-local-doc-search` knowledge retrieval path
- it does not execute arbitrary skill code or expose arbitrary retrieval backends

Current desktop execution contract:

- plan the fixed readonly skill-assisted RAG task
- match an enabled local doc-oriented skill from `.opencow/skills/enabled-skills.json`
- reuse the existing readonly local RAG document retrieval flow
- return a stable result summary with the matched skill, registry path, top local matches, and indexed document count

Current safety limits:

- enabled local skill matching first, readonly local retrieval second
- no permission escalation because the path remains readonly
- no direct skill runtime execution
- no remote retrieval or embedding dependency introduced by this mapping

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-rag.test.ts src/app/app.test.tsx
```

## 6.11a Next skill-assisted readonly RAG-to-shell handoff mapping

The adapter now also exposes the next readonly enabled-skill-assisted RAG-to-shell handoff preview mapping:

- `skills-local-enabled-rag-shell-handoff-preview`

This mapping is intentionally narrow:

- it is selected only for explicit requests that combine enabled skill mediation, local docs/rules retrieval intent, shell automation intent, and preview wording
- it stays readonly from planner through desktop execution
- it reuses the existing enabled skill matching, local document retrieval, and shell safety preview surfaces instead of adding a new executor
- it does not execute arbitrary skill code or shell commands

Current desktop execution contract:

- plan the fixed readonly handoff preview task
- match an enabled local skill from `.opencow/skills/enabled-skills.json`
- reuse the existing local RAG document retrieval flow
- reuse the existing readonly shell next-step preview flow
- return a stable result summary with matched skill, registry path, local rule/doc matches, command preview, required permission, and safety state

Current safety limits:

- readonly only
- no permission escalation side effect
- no direct shell execution
- no direct skill runtime execution

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.rag-shell-handoff.test.ts src/localAssistantPlan.rag-search.test.ts src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-rag-shell-handoff.test.ts src/features/assistant/assistantTaskService.skills-rag.test.ts src/features/assistant/assistantTaskService.npc-shell-preview.test.ts src/app/app.test.tsx
```

## 6.11b Next skill-assisted RAG-to-shell continued execution mapping

The adapter now also exposes the next fixed continued-execution mappings after the readonly handoff preview:

- `skills-local-enabled-rag-shell-create-temp-output`
- `skills-local-enabled-rag-shell-remove-temp-output`

These mappings are intentionally narrow:

- they are selected only for explicit requests that combine enabled skill mediation, local docs/rules retrieval intent, shell automation intent, and continuation wording
- they continue only into the existing approved temp-output shell slices
- they do not expose arbitrary shell text or a new runtime executor

Current desktop execution contract:

- request `workspace-write` before temp-output creation when starting from `readonly`
- request `controlled-full` plus dangerous confirmation before temp-output cleanup
- match an enabled local skill from `.opencow/skills/enabled-skills.json`
- reuse the existing local RAG document retrieval flow
- reuse the existing controlled shell execution flow
- return a stable result summary with matched skill, local rule/doc matches, command, and shell outcome

Current safety limits:

- no arbitrary command synthesis from RAG or skill content
- no permission bypass
- no dangerous confirmation bypass
- only the existing temp-output create and remove commands are linked

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts src/localAssistantPlan.rag-shell-handoff.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-rag-shell-write.test.ts src/features/assistant/assistantTaskService.skills-rag-shell-handoff.test.ts src/app/app.test.tsx
```

## 6.12 First readonly NPC collaboration preview mapping

The adapter now also exposes the first readonly local NPC collaboration preview mapping:

- `npc-local-collaboration-preview`

This mapping is intentionally narrow:

- it is selected only for explicit NPC collaboration preview or planning requests
- it stays readonly from planner through desktop execution
- it reuses existing local capability, enabled-skill, and local-doc retrieval surfaces instead of introducing a new runtime
- it does not execute autonomous NPC sessions, shell commands, or arbitrary tools

Current desktop execution contract:

- plan the fixed readonly NPC collaboration preview task
- load local NPC capability readiness
- read enabled local skills from `.opencow/skills/enabled-skills.json`
- reuse the existing local rules and documentation retrieval flow
- return a stable preview summary with readiness status, enabled skills, and top local context matches

Current safety limits:

- readonly only
- no permission escalation
- no direct NPC runtime execution
- no autonomous tool or shell execution

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.npc-preview.test.ts src/app/app.test.tsx
```

## 6.13 First readonly NPC shell plan preview mapping

The adapter now also exposes the first readonly local NPC shell plan preview mapping:

- `npc-local-shell-plan-preview`

This mapping is intentionally narrow:

- it is selected only for explicit NPC collaboration shell planning or preview requests
- it stays readonly from planner through desktop execution
- it reuses existing NPC readiness, enabled skill matching, and shell safety planning surfaces instead of adding a new executor
- it does not execute shell commands or autonomous NPC sessions

Current desktop execution contract:

- plan the fixed readonly NPC shell plan preview task
- load local NPC capability readiness
- match an enabled local shell-oriented skill from `.opencow/skills/enabled-skills.json`
- reuse the existing shell runtime, permission engine, and safety engine to preview the next safety step
- return a stable preview summary with readiness status, matched skill, command preview, permission requirement, and safety state

Current safety limits:

- readonly only
- no permission escalation side effect
- no direct shell execution
- no autonomous NPC runtime execution

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.npc-shell-preview.test.ts src/app/app.test.tsx
```

## 6.13a NPC-assisted readonly RAG-to-shell handoff preview mapping

The adapter now also exposes the next readonly NPC-assisted RAG-to-shell handoff preview mapping:

- `npc-local-enabled-rag-shell-handoff-preview`

This mapping is intentionally narrow:

- it is selected only for explicit requests that combine NPC collaboration, local docs/rules retrieval intent, shell automation intent, and preview wording
- it stays readonly from planner through desktop execution
- it reuses the existing NPC readiness, enabled skill matching, local document retrieval, and shell safety preview surfaces instead of adding a new executor
- it does not execute shell commands or autonomous NPC sessions

Current desktop execution contract:

- plan the fixed readonly NPC-assisted RAG handoff preview task
- load local NPC capability readiness
- match an enabled local skill from `.opencow/skills/enabled-skills.json`
- reuse the existing local RAG document retrieval flow
- reuse the existing readonly shell next-step preview flow
- return a stable result summary with NPC readiness, matched skill, local rule/doc matches, command preview, required permission, and safety state

Current safety limits:

- readonly only
- no permission escalation side effect
- no direct shell execution
- no autonomous NPC runtime execution

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.rag-shell-handoff.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.npc-shell-preview.test.ts
```

## 6.14 NPC-assisted shell continuation mapping

The adapter now also routes explicit NPC collaboration shell execution requests into the existing approved shell continuation path.

Current mapping behavior:

- NPC-assisted temp-output creation requests resolve to `permission-request -> npc-local-enabled-shell-create-temp-output`
- NPC-assisted destructive temp-output cleanup requests resolve to `permission-request -> confirmation -> npc-local-enabled-shell-remove-temp-output`
- the resulting execution still reuses the existing enabled-skill match plus controlled shell chain rather than a new NPC-specific executor
- the planner and desktop queue now preserve NPC-assisted titles and audit summaries instead of borrowing the skill-assisted execution identity

Current safety limits:

- NPC wording does not bypass permission escalation
- NPC wording does not bypass dangerous confirmation
- no arbitrary shell synthesis from NPC content

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/app/app.test.tsx
```

## 6.15 NPC-assisted RAG-to-shell continuation mapping

The adapter now also routes explicit NPC collaboration requests that review local rules or docs before continuing into the existing approved shell continuation path.

Current mapping behavior:

- NPC-assisted rules/docs + shell creation requests resolve to `permission-request -> npc-local-enabled-rag-shell-create-temp-output`
- NPC-assisted rules/docs + destructive cleanup requests resolve to `permission-request -> confirmation -> npc-local-enabled-rag-shell-remove-temp-output`
- the resulting execution still reuses the existing enabled-skill match, local RAG retrieval, and controlled shell chain rather than a new NPC-specific executor
- the planner and desktop queue preserve NPC-assisted RAG handoff titles and audit summaries instead of borrowing generic shell execution wording

Current safety limits:

- NPC wording does not bypass local rules retrieval boundaries
- NPC wording does not bypass permission escalation
- NPC wording does not bypass dangerous confirmation
- no arbitrary shell synthesis from NPC or RAG content

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-rag-shell-write.test.ts src/app/app.test.tsx
```

## 6.16 Pure local RAG-to-shell continuation mapping

The adapter now also routes explicit local rules or docs review requests into the same approved shell continuation chain without requiring Skill or NPC mediation.

Current mapping behavior:

- pure local preview requests resolve to `rag-local-shell-handoff-preview`
- pure local temp-output creation requests resolve to `permission-request -> rag-local-shell-create-temp-output`
- pure local destructive cleanup requests resolve to `permission-request -> confirmation -> rag-local-shell-remove-temp-output`
- the resulting execution still reuses the existing local RAG retrieval plus controlled shell chain rather than inventing a parallel executor
- the planner must keep explicit Skill-assisted and NPC-assisted RAG shell wording on their own mappings

Current safety limits:

- local RAG wording does not bypass permission escalation
- local RAG wording does not bypass dangerous confirmation
- local RAG wording does not expose free-form shell synthesis
- local RAG context does not authorize arbitrary filesystem targets

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.rag-shell-handoff.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-rag-shell-handoff.test.ts src/app/app.continuation.test.tsx
```

## 6.17 First readonly MCP local plugin scan mapping

The adapter now also exposes the first real readonly MCP-adjacent local catalog mapping:

- `mcp-local-plugin-scan`

This mapping is intentionally narrow:

- it is selected only for explicit local MCP plugin, server, or inventory scan intent
- it remains readonly
- it targets the desktop local assistant chain rather than bypassing it
- it does not start, stop, configure, or invoke any MCP server

Current desktop execution contract:

- plan the fixed readonly MCP plugin scan task
- scan only approved local `openclaw.plugin.json` manifests
- return stable plugin summary items with `id`, `path`, `source`, `activation`, `tool_count`, and `skill_count`
- keep browser preview deterministic for app-side tests outside Tauri

Current approved scan scope:

- `vendor/openclaw/extensions/**/openclaw.plugin.json`
- optional workspace-local `plugins/**/openclaw.plugin.json`

Current safety limits:

- no MCP process launch
- no server command execution
- no mutation path
- no arbitrary filesystem crawl outside approved roots

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.capabilities.test.ts
cargo test local_mcp_plugin_scan -- --nocapture
```

## 6.18 First readonly MCP local plugin detail mapping

The adapter now also exposes the next narrow readonly MCP mapping:

- `mcp-local-plugin-inspect`

This detail mapping stays intentionally constrained:

- it is selected only for explicit local MCP plugin detail or inspect intent
- it remains readonly
- it reuses the desktop local assistant chain rather than bypassing it
- it does not start, stop, configure, or invoke any MCP server

Current desktop execution contract:

- plan the fixed readonly MCP plugin detail task
- match only approved local `openclaw.plugin.json` manifests under the existing scan roots
- return stable detail fields with `id`, `path`, `source`, `activation`, `tool_count`, `skill_count`, `description`, `tool_names`, and `skill_paths`
- keep browser preview deterministic for app-side tests outside Tauri

Current safety limits:

- no MCP process launch
- no server command execution
- no mutation path
- no arbitrary filesystem crawl outside approved roots

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.capabilities.test.ts
cargo test local_mcp_plugin -- --nocapture
```

## 6.19 First readonly MCP local plugin start preview mapping

The adapter now also exposes the next narrow readonly MCP planning slice:

- `mcp-local-plugin-start-preview`

This preview mapping stays intentionally constrained:

- it is selected only for explicit local MCP plugin start or launch preview intent
- it remains readonly
- it reuses the desktop local assistant chain rather than bypassing it
- it does not start, stop, configure, or invoke any MCP server

Current desktop execution contract:

- plan the fixed readonly MCP plugin start preview task
- match only approved local `openclaw.plugin.json` manifests under the existing scan roots
- return stable preview fields with `id`, `path`, `source`, `activation`, `startup_allowed`, `command_preview`, `working_directory`, `risk_summary`, `requires_config`, and `config_hint`
- keep browser preview deterministic for app-side tests outside Tauri

Current safety limits:

- no MCP process launch
- no server command execution
- no mutation path
- no arbitrary filesystem crawl outside approved roots
- command preview is informational only and must not be treated as an executable authorization

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.capabilities.test.ts
cargo test local_mcp_plugin -- --nocapture
```

## 6.20 First controlled MCP local plugin start mapping

The adapter now also exposes the first permission-backed and confirmation-backed real MCP local plugin start mapping:

- `mcp-local-plugin-start`

This execution mapping stays intentionally constrained:

- it is selected only for explicit local MCP plugin start intent without preview wording
- before execution, it requires `controlled-full`
- after permission approval, it still requires explicit dangerous confirmation
- after confirmation, it resolves only to a tightly scoped desktop execution path

Current desktop execution contract:

- request `controlled-full` permission in planner
- continue into confirmation after approval
- execute only the current fixed browser plugin candidate path in this slice
- return a stable result summary with `plugin_id`, `command_label`, `working_directory`, `stdout_preview`, and `summary`

Current safety limits:

- no arbitrary MCP server start
- no arbitrary plugin selection outside the fixed current slice
- no config mutation
- no bypass around permission, confirmation, audit wording, or rollback-visible task flow

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.capabilities.test.ts
cargo test local_mcp_plugin_start -- --nocapture
```

Current clean app-level chain proof:

```bash
npm --workspace apps/desktop exec vitest run src/app/app.mcp-start.test.tsx
```

This dedicated file is the current stable way to prove the adapter mapping survives the full desktop conversation chain without relying on the historically polluted legacy app suite file.

## 6.21 Next NPC adapter target: local project showcase workflow mapping

The next high-priority NPC adapter target is a real local delivery workflow instead of another temp-output-only shell slice.

Target workflow example:

- inspect a local project such as `cattle`
- decide how to run it locally
- launch it in a controlled way
- capture screenshots from the running result
- generate a showcase website into a user-prepared git repository
- optionally commit or push after explicit approval

Adapter-side planning requirement:

- the planner should recognize this as one NPC-assisted multi-step workflow request instead of collapsing it into a single generic shell action
- readonly inspection, run preview, screenshot planning, site generation, repository write, and git push must remain distinguishable stages
- every stage that crosses from readonly into mutation or external side effect must still pass through the existing permission, confirmation, audit, and rollback-visible desktop chain

Required future mapping shape:

- readonly NPC project inspection preview
- readonly NPC local run preview
- permission-backed NPC local run execution
- permission-backed NPC screenshot capture execution
- permission-backed NPC showcase-site write execution
- separately confirmable git commit or push execution

Safety requirement for this mapping family:

- no arbitrary project auto-run without explicit permission
- no screenshot capture without explicit task-scoped approval
- no repository mutation without explicit workspace-write approval
- no git push implied by earlier approval for local generation
- no opaque "NPC did everything" result that hides intermediate commands or outputs

## 6.22 First readonly NPC local run preview landing

The first concrete step beyond the generic NPC showcase preview is now landed:

- `npc-local-project-showcase-preview` still remains the current planner kind
- but the desktop execution summary now includes a real readonly local run preview resolved from workspace package inspection instead of only generic stage text

Current desktop behavior in this slice:

- inspect local runnable candidates from `apps/*`, `packages/*`, and the workspace root `package.json`
- score the request against candidate package names and paths
- infer candidate commands from real `scripts` entries such as `dev`, `start`, and `build`
- surface a preferred launch command and likely local preview URL when inferable
- keep the next privileged step explicit as a separate permission requirement before any actual launch

Current returned preview fields used by the desktop assistant chain:

- matched project name
- matched project path
- matched project source
- `dev`, `start`, and `build` command candidates
- preferred command
- expected local URL
- next required permission
- readonly risk summary

Current safety boundary remains unchanged:

- readonly only
- no local process launch
- no screenshot capture
- no repository mutation
- no git action
- no permission bypass around later execution stages

Verification for this slice:

```bash
npm --workspace apps/desktop exec tsc --noEmit
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-showcase.test.ts
cargo test workspace_project_run_preview -- --nocapture
```

## 6.23 Permission-backed local project lifecycle landing

The desktop-first assistant chain now includes the first real local project lifecycle trio:

- `workspace-project-run`
- `workspace-project-status`
- `workspace-project-stop`

Current planner behavior:

- explicit local run requests such as `run the desktop app locally` no longer fall back into generic help
- in `readonly`, the planner returns `permission-request` for `workspace-write`
- after approval, the planner continues into the fixed `workspace-project-run` task kind
- explicit status requests such as `show the status of the desktop app local run` map directly into the readonly `workspace-project-status` task kind
- explicit stop requests such as `stop the desktop app local run` return `permission-request` in `readonly`
- after approval, the planner continues into the fixed `workspace-project-stop` task kind

Current desktop execution behavior:

- desktop execution keeps using the existing local project matching rules from the readonly run preview slice
- only the best matched local project candidate is allowed into the launch path
- the final assistant result returns:
  `project_name`, `project_path`, `command_label`, `working_directory`, `expected_url`, `pid`, `stdout_preview`, and `summary`

Current Tauri behavior:

- resolve the workspace root
- match a runnable local project from approved workspace candidates
- choose a fixed launch command from `dev`, then `start`, then `build`
- start the project through a narrow PowerShell launch path and return the real child `pid`
- persist lifecycle records in `.opencow/runtime/workspace-project-runs.json`
- answer readonly status checks through the same runtime registry
- stop matched local project runs through the same runtime registry instead of a disconnected shell guess

Current safety boundary remains intentionally narrow:

- no arbitrary shell text execution
- no arbitrary working directory outside the workspace
- no screenshot capture
- no repository mutation
- no git action
- no bypass around permission, audit wording, or task visibility

Current known limitation:

- the runtime registry is now durable enough for the current desktop mainline, including invalid-JSON repair, legacy migration, and persisted launch or status metadata
- this is still not a full long-running orchestration system for broader NPC workflows, process restarts, or remote coordination

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.project-run.test.ts src/localAssistantPlan.project-status.test.ts src/localAssistantPlan.project-stop.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.project-run.test.ts src/features/assistant/assistantTaskService.project-status.test.ts src/features/assistant/assistantTaskService.project-stop.test.ts src/app/app.project-run.test.tsx
npm --workspace apps/desktop exec tsc --noEmit
cargo test workspace_project_ -- --nocapture
```

## 6.23a First permission-backed opencow self-repair mutation mapping

The adapter now also exposes the first narrow writable opencow self-repair mapping:

- `opencow-self-repair-enabled-skills-registry`

This mapping is intentionally narrow:

- it is selected only for explicit continuation or execute wording about repairing opencow's enabled-skills registry
- in `readonly`, it returns a `permission-request` for `workspace-write`
- after approval, it resolves to one fixed self-repair task kind instead of a free-form repair plan
- it targets only `.opencow/skills/enabled-skills.json`
- it does not restart processes, mutate unrelated config, or infer arbitrary write targets

Verification for this slice:

```bash
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.self-repair.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.self-repair.test.ts src/app/app.self-repair.test.tsx
npm --workspace apps/desktop exec tsc --noEmit
cargo test opencow_self_repair_enabled_skills_registry_recovers_from_invalid_json -- --nocapture
```

## 6.23b Current adapter boundary for self-repair mutation

The adapter side of self-repair is no longer preview-only, but it still intentionally exposes only one narrow writable repair target.

Current landed adapter scope:

- readonly preview planning through `opencow-self-repair-preview`
- permission-backed continuation planning through `opencow-self-repair-enabled-skills-registry`
- fixed repair targeting for `.opencow/skills/enabled-skills.json` only

Current non-goals at this stage:

- no broad assistant-owned config rewrite planning
- no runtime-registry self-repair planning
- no destructive or process-restart self-repair planning
- no free-form guessed repair target selected from arbitrary user text

Rule for the next adapter self-repair mapping:

- a new mapping should land only if it keeps the same narrow contract:
  - explicit self-repair wording
  - fixed target path or state surface
  - correct permission or confirmation gating
  - verification-oriented result contract
  - no bypass around audit-visible and rollback-visible desktop execution
