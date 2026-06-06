# 08. 自动化测试与验收指标

## 1. 测试原则

- 桌面端是主验收对象，Web 预览只用于开发 smoke
- 模块改动后必须立刻跑对应单元测试
- 本地提交或推送前必须执行 `npm run verify:all`
- 不满足于冒烟测试，必须覆盖权限、安全、回退、日志、稳定性
- 所有报错都要可追溯、可定位、可恢复，且不能把应用拖入卡死状态

## 2. 自动化测试层级

- 单元测试：权限判定、风险分级、回退状态、任务状态、错误状态
- 集成测试：Ollama provider、adapter、shell-runtime、rollback-core
- 桌面 UI 测试：工作台渲染、任务提交、任务停止、任务失败、任务重试
- 安全专项测试：删除、覆盖、递归删除、越权目录、超时、危险命令确认
- 稳定性测试：工具失败不致白屏，长任务可中断，错误信息可追踪
- Tauri/Rust 测试：本地模型列表格式化、桌面桥接基础能力

## 3. 验收指标

### 3.1 启动与可用性

- 桌面应用可以启动并进入主界面
- Ollama 可用时能读取模型列表
- Ollama 不可用时有明确诊断，界面不能白屏
- 工作台主要区域必须完整渲染

### 3.2 权限与 Shell

- 只读模式不能写入文件
- 未授权目录不能读写
- Shell 必须带工作目录、超时、日志
- 高风险操作必须先确认
- 未确认不得执行删除、覆盖、递归删除、结束进程
- 模型不得杀死 `opencow` 自身进程

### 3.3 回退与审计

- 默认保留 10 段回退点
- 高级设置最多可调到 20 段
- 用户消息旁可以触发回退预览
- 回退前必须展示影响范围
- 回退确认后必须恢复目标状态并写入日志

### 3.4 本地任务恢复链路

- 输入区提交任务后，队列能显示排队状态
- 任务启动后，输入区可直接 `停止任务`
- 任务启动后，右侧任务队列中的运行项也可直接 `停止任务`
- 任务失败后，错误面板可 `重试本地任务`
- 任务失败后，右侧任务队列中的失败项也可直接 `重试本地任务`
- 停止和重试后必须更新审计与状态，且不能出现死锁或冻结

### 3.5 错误追踪

- 每个错误必须带模块、时间、摘要、详情、恢复建议
- Shell 错误要保留 stdout/stderr 摘要
- API 错误要保留状态码和响应摘要
- RAG、Skills、NPC、MCP 错误要保留来源和修复建议

## 4. 推荐命令

```powershell
npm run test:unit
npm run verify:all
npm run build
npm run check:encoding
npm run check:health
cd apps/desktop/src-tauri
cargo test
```

## 5. 不可接受情况

- 白屏无日志
- 卡死无中断
- 权限不足却继续执行
- 高风险操作无确认
- Shell 无超时
- 报错无详情
- 日志无法定位失败模块
- 新增或修改文件出现编码混乱
## 6. 测试与推送执行节奏

推荐执行节奏：

1. 改完一个小模块，先跑该模块测试。
2. 模块测试通过后，可以继续累计开发，不要求立刻推送。
3. 完成一个里程碑批次后，运行完整链路测试，而不是只做 smoke。
4. 对完整链路结果做自检。
5. 如果发现问题，先修复，再重复测试与自检，直到无误。
6. 只在这个里程碑批次验证完整、状态干净时再推送。

执行要求：

- 小模块可以“先测不推”。
- 里程碑批次必须“完整测试 + 自检修复循环 + 再确认”。
- 推送频率不追求高，但推送质量必须高。
## 6.1 Current milestone verification baseline

For the current desktop-first assistant mainline, milestone verification should use the following fresh command set instead of a smoke-only pass:

```bash
npm run test:unit
npm run build
npm run check:encoding
npm run check:health
cargo test
```

If a milestone mainly lands a contained adapter or assistant slice, the minimum pre-milestone focused verification should still include:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit
npm --workspace apps/desktop run test:unit
cargo test
```

Rules for this baseline:

- module work must prove its own tests first
- cross-module assistant wiring must prove adapter, desktop, and Tauri coverage together
- a stale adapter `dist/` build is treated as a real integration risk, not a cosmetic issue
- milestone completion requires another clean verification pass after any self-fix

## 6.2 Skills enablement verification addition

For the local skill enable registry slice, acceptance is not satisfied by readonly scan coverage alone.

Required checks:

- planner returns `permission-request` in `readonly`
- approval continues into `skills-local-enable` instead of skipping the permission chain
- desktop task execution returns the enabled skill name and `.opencow/skills/enabled-skills.json`
- Tauri enablement returns `enabled` or `already-enabled` without duplicating registry entries
- app-level conversation flow proves the full chain from composer submit to permission approval to final result

Minimum focused verification:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-enable.test.ts src/app/app.test.tsx
cargo test
```

## 6.3 Enabled skills readback verification addition

For the enabled local skills readback slice, acceptance should prove that enablement can be read back through the same assistant chain.

Required checks:

- planner maps explicit enabled or active skill listing requests into `skills-local-enabled-list`
- desktop task execution returns the registry path and enabled skill names
- browser preview keeps deterministic enabled-skill output for app-level flow tests
- Tauri command reads `.opencow/skills/enabled-skills.json` without mutating it

Minimum focused verification:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-enabled-list.test.ts src/app/app.test.tsx
cargo test
```
Enabled local skill matching verification:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-enabled-match.test.ts
cargo test
```

## 6.4 Enabled skill disable verification addition

For the enabled local skill disable slice, acceptance should prove that a previously enabled local skill can be removed only through the same permission-backed assistant chain.

Required checks:

- planner returns `permission-request` in `readonly`
- approval continues into `skills-local-disable` instead of skipping the permission chain
- desktop task execution returns the disabled skill name and `.opencow/skills/enabled-skills.json`
- Tauri disablement removes only the matched enabled entry and keeps unrelated enabled entries intact
- app-level conversation flow proves the full chain from composer submit to permission approval to final disable result

Minimum focused verification:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-disable.test.ts src/app/app.test.tsx
cargo test local_skill_disable -- --nocapture
```

## 6.5 Enabled skill assisted shell write verification addition

For the enabled skill assisted shell write slice, acceptance should prove that an enabled local skill can participate in assistant action routing without bypassing the existing permission-backed shell chain.

Required checks:

- planner maps explicit enabled-skill shell automation requests into `skills-local-enabled-shell-create-temp-output`
- planner still returns `permission-request` in `readonly`
- approval continues into the skill-assisted task instead of collapsing into a plain shell task
- desktop execution matches an enabled shell-oriented local skill first and then runs the existing controlled workspace-write command
- app-level conversation flow proves the full chain from composer submit to permission approval to final result with both skill name and shell outcome

Minimum focused verification:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-shell-write.test.ts src/app/app.test.tsx
```

## 6.6 Enabled skill assisted destructive shell verification addition

For the enabled skill assisted destructive shell slice, acceptance should prove that skill-assisted shell routing does not bypass either permission escalation or dangerous confirmation.

Required checks:

- planner maps explicit enabled-skill destructive shell requests into a fixed high-risk task path
- planner still requests `controlled-full` permission before any execution planning continues
- after permission approval, planner still returns a destructive `confirmation` instead of skipping directly to execution
- desktop execution matches an enabled shell-oriented local skill first and then runs the existing controlled-full command only after confirmation
- app-level conversation flow proves the full chain from composer submit to permission approval to dangerous confirmation to final result with both skill name and shell outcome

Minimum focused verification:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-shell-write.test.ts src/app/app.test.tsx
```

## 6.7 Enabled skill assisted readonly RAG verification addition

For the enabled skill assisted readonly RAG slice, acceptance should prove that enabled local skill mediation can expand the assistant ecology into doc retrieval without bypassing the existing readonly local RAG boundary.

Required checks:

- planner maps explicit enabled-skill doc or rules lookup requests into `skills-local-enabled-rag-doc-search`
- planner does not request a permission upgrade because the full path remains readonly
- desktop execution matches an enabled local doc-oriented skill first and then runs the existing local knowledge retrieval path
- the final assistant result includes both the matched skill context and the local RAG outcome
- app-level conversation flow proves the full chain from composer submit to final readonly result

Minimum focused verification:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-rag.test.ts src/app/app.test.tsx
```

## 6.8 NPC collaboration preview verification addition

For the readonly NPC collaboration preview slice, acceptance should prove that NPC and NPC collaboration can enter the main assistant chain through a real local preview instead of staying as a capability placeholder.

Required checks:

- planner maps explicit NPC collaboration preview or planning requests into `npc-local-collaboration-preview`
- planner does not request a permission upgrade because the full path remains readonly
- desktop execution combines local NPC capability readiness, enabled local skills, and local docs or rules context into one result
- the final assistant result includes readiness status, enabled skill names, and local context matches
- app-level conversation flow proves the full chain from composer submit to final readonly preview result

Minimum focused verification:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.npc-preview.test.ts src/app/app.test.tsx
```

## 6.9 NPC shell plan preview verification addition

For the readonly NPC shell plan preview slice, acceptance should prove that NPC collaboration can preview the real shell safety chain before any permission or execution side effect occurs.

Required checks:

- planner maps explicit NPC collaboration shell preview requests into `npc-local-shell-plan-preview`
- planner does not request a permission upgrade because the full path remains readonly
- desktop execution combines local NPC capability readiness, enabled shell-oriented skill matching, and shell safety planning into one result
- the final assistant result includes command preview, required permission, and safety state
- app-level conversation flow proves the full chain from composer submit to final readonly preview result

Minimum focused verification:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.npc-shell-preview.test.ts src/app/app.test.tsx
```

## 6.10 NPC-assisted shell continuation verification addition

For the NPC-assisted shell continuation slice, acceptance should prove that NPC collaboration wording can enter the existing approved shell execution chain without weakening safety controls.

Required checks:

- planner maps NPC-assisted temp-output creation requests into `permission-request -> skills-local-enabled-shell-create-temp-output`
- planner maps NPC-assisted destructive cleanup requests into `permission-request -> confirmation -> skills-local-enabled-shell-remove-temp-output`
- app-level conversation flow proves the full chain from composer submit to approval to final shell result
- existing skill-assisted shell results still surface the matched skill and shell outcome

Minimum focused verification:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop run test:unit -- src/app/app.test.tsx
```

## 6.11 Preview-to-continue continuity verification addition

For the desktop preview-to-continue continuity slice, acceptance should prove that a bounded readonly preview can feed the next approved shell step without requiring the full original prompt to be retyped.

Required checks:

- preview tasks for skill-assisted and NPC-assisted RAG shell handoff store explicit continuation metadata in the desktop task queue
- a follow-up short continuation message such as `continue` resolves to the latest preview continuation message instead of executing arbitrary hidden actions
- the resolved continuation still re-enters `planAssistantTask` and the normal permission or dangerous confirmation chain
- no continuation path bypasses audit, timeout, or rollback protections

Current verification status on 2026-06-06:

- focused metadata coverage is green through `src/features/workbench/taskQueueMetadata.test.ts`
- focused app-level continuation coverage is green through `src/app/app.continuation.test.tsx`
- the dedicated continuation file now covers both skill-assisted and NPC-assisted preview handoff flows for create and destructive remove paths
- broader desktop regression coverage remains green through `src/app/app.test.tsx`
- one older continuation scenario inside `src/app/app.test.tsx` is still temporarily marked `skip` because that historical large test file contains known high-risk encoding / text-noise instability around button-label matching
- the stable path for this slice is now the dedicated continuation test file plus task metadata coverage, and adapter build remains green

Minimum focused verification:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop run test:unit -- src/features/workbench/taskQueueMetadata.test.ts src/app/app.continuation.test.tsx
```

Stable test-authoring note for polluted text environments:

- for new clean tests, prefer accessible-role queries with stable Chinese regex matching such as `/右侧面板/`, `/权限确认/`, `/批准提权/`, and `/批准高风险操作/`
- do not copy mojibake role names or button labels from historical polluted files into new tests
- when a chain is already functionally green but historical text matching is noisy, land new coverage in a dedicated clean test file instead of expanding the polluted file

## 6.12 Pure local RAG shell handoff verification addition

For the pure local RAG shell handoff slice, acceptance should prove that local rules retrieval can feed the existing approved shell chain without Skill or NPC mediation and without weakening safety controls.

Required checks:

- planner maps explicit local rules or docs plus shell-preview wording into `rag-local-shell-handoff-preview`
- planner maps pure local create continuation requests into `permission-request -> rag-local-shell-create-temp-output`
- planner maps pure local destructive continuation requests into `permission-request -> confirmation -> rag-local-shell-remove-temp-output`
- planner keeps explicit Skill-assisted and NPC-assisted RAG handoff requests on their existing branches instead of letting pure local matching steal them
- app-level continuation flow proves `preview -> continue -> permission or confirmation -> final result`

Minimum focused verification:

```bash
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.rag-shell-handoff.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop run test:unit -- src/features/assistant/assistantTaskService.skills-rag-shell-handoff.test.ts src/app/app.continuation.test.tsx
```

Additional integration note:

- because `@opencow/openclaw-adapter/browser` consumes built adapter output, desktop verification for this slice is not valid until the adapter build has been refreshed

## 6.13 Controlled MCP local plugin start app-level verification addition

For the controlled local MCP plugin start slice, acceptance is not satisfied by planner, desktop-service, and Tauri coverage alone.

Required checks:

- app-level conversation flow proves `start the browser mcp plugin locally`
- the first safety gate is still a `controlled-full` permission request
- permission approval still continues into dangerous confirmation instead of executing directly
- final assistant output includes `Local MCP plugin start`, `npx openclaw-extension-browser`, and `browser plugin start simulated`

Current stable verification path on 2026-06-06:

- use the dedicated clean app file `src/app/app.mcp-start.test.tsx`
- do not expand `src/app/app.test.tsx` for this slice because that historical file still contains pre-existing transform-risk pollution

Minimum focused verification:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit -- src/localAssistantPlan.capabilities.test.ts
npm --workspace apps/desktop exec vitest run src/app/app.mcp-start.test.tsx src/features/assistant/assistantTaskService.capabilities.test.ts
cargo test local_mcp_plugin_start -- --nocapture
```

Pollution-control note:

- when a new app-level chain is functionally green but the legacy broad app suite is blocked by a historical polluted file, land a dedicated clean test file for the new chain first
- treat the blocked legacy suite as a separate cleanup task instead of mixing cleanup risk into the current feature slice

## 6.14 NPC local project showcase workflow verification addition

For the upcoming NPC local project showcase workflow slice, acceptance is not satisfied by preview-only NPC coverage.

Target real-world request example:

- inspect and run a local project such as `cattle`
- capture screenshots
- generate a resume-ready project showcase website
- write it into a user-prepared git repository
- optionally commit or push only after explicit approval

Required checks:

- planner recognizes the request as an NPC-assisted multi-step local delivery workflow instead of a single generic shell action
- readonly project inspection and readonly run preview happen before execution permission is requested
- local run execution requires explicit permission
- screenshot capture requires explicit permission and produces traceable artifact paths
- showcase-site repository write requires explicit permission and produces a traceable changed-file summary
- git commit or push remains separately confirmable and is not implied by earlier workspace-write approval
- failures during launch, screenshot capture, or site generation stop the chain cleanly and surface repair suggestions instead of fabricating a finished result

Minimum future focused verification:

```bash
npm --workspace packages/openclaw-adapter run build
npm --workspace packages/openclaw-adapter run test:unit
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.npc-showcase.test.ts src/app/app.npc-showcase.test.tsx
cargo test
```

## 6.15 Opencow self-repair preview verification addition

For the readonly opencow self-repair preview slice, acceptance should prove that opencow can inspect and explain a repair path before any mutation is approved.

Required checks:

- planner maps explicit opencow self-diagnose or self-fix-preview requests into `opencow-self-repair-preview`
- desktop task execution returns workspace context, config context, and local rules or docs context in one result
- the final assistant result includes the staged repair flow:
  inspect failure -> preview repair -> request permission for any mutation -> verify -> keep audit and rollback visibility
- no mutation, config rewrite, process restart, or permission escalation occurs during this readonly slice

Minimum focused verification:

```bash
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.self-repair.test.ts src/localAssistantPlan.capabilities.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.self-repair.test.ts
npm --workspace apps/desktop exec tsc --noEmit
```

Integration note:

- because `@opencow/openclaw-adapter/browser` consumes built adapter output, desktop verification for this slice is not valid until the adapter build has been refreshed after planner changes

## 6.16 Local task anti-stall verification addition

For the homepage conversation and local assistant task chain, acceptance is not satisfied by successful task starts alone.

Required checks:

- duplicate local tasks are not queued repeatedly while an identical queued or running task already exists
- queued tasks start with `attemptCount: 0` and increment on execution start
- failed tasks can be requeued without silently resetting guard metadata
- long-running assistant executions fail through the timeout guard instead of leaving the UI stuck forever
- timeout and retry-guard failures return traceable error metadata and a retry or simplification hint
- the pending conversation state remains visibly animated while a task is still in progress

Minimum focused verification:

```bash
npm --workspace apps/desktop exec vitest run src/features/workbench/taskQueueDedup.test.ts src/features/workbench/taskQueueMetadata.test.ts src/features/workbench/taskQueueState.test.ts src/app/app.task-guard.test.tsx
```
