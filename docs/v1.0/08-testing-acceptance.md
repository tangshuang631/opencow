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
- Ollama 可达但没有可用本地模型时，普通对话不能调用 `ollama_chat` 或 `/api/chat`，必须给出可恢复提示并保留审计/回退记录
- 工作台主要区域必须完整渲染
- 新建对话的主对话区默认保持空白，不展示欢迎卡片、能力说明卡片或模型状态卡片，只保留底部输入框
- 已有真实会话内容后，主对话顶部只显示当前对话标题和一条轻量概览，不展示模型、权限、Provider 或日志运行元信息
- 长文本用户输入在主对话中只保留一条折叠预览，顶部会话标题不得第二次截断重复原文，右侧面板也不得重复展示完整长输入
- 只有 Ollama 服务不可达或没有可用模型时，主对话区才显示极简模型配置引导，并可跳转到 `Ollama 设置` 或 `大模型 API 设置`
- Ollama 有可用模型时，输入区应提供类似 Codex 的模型下拉入口，模型列表来自本地检测结果，选择后更新当前模型
- 左侧侧边栏点击后必须切换右侧主内容，不能停留在初始会话页面
- 默认工作台应接近连续对话流，左右侧栏使用低对比透明渐变；输入区只保留一行短状态；右侧无任务、无工具结果时不展示空占位
- 右侧默认空状态不展示 `输出 / 暂无产物` 占位，只保留 `配置与记录` 折叠入口；有真实输出、取消反馈、重复任务反馈、错误恢复、任务队列、工具结果或待确认事项时，才直接展示对应摘要和动作
- 来源、日志、高级设置和普通回退历史展开后可见，待确认回退预览仍必须直接可见且不能重复渲染

### 3.2 权限与 Shell

- 只读模式不能写入文件
- 未授权目录不能读写
- Shell 必须带工作目录、超时、日志
- 高风险操作必须先确认
- 未确认不得执行删除、覆盖、递归删除、结束进程
- 模型不得杀死 `opencow` 自身进程
- 重复提交同一个待审批权限、能力或高风险确认请求时，不得再次规划、排队或执行命令；必须返回可审计、可回退的跳过记录
- 重复待审批请求被跳过时，默认 output、主对话标题和回退标签必须使用中文短文案；内部 source、queued execution trace 和 recovery visibility 可继续保留在审计与展开详情中
- 重复提交同一个本地任务时，不得重复排队或执行；主对话和右侧默认输出只显示中文短说明，已有任务状态、执行 kind、上一轮失败详情和恢复 trace 必须保留在日志、回退或展开面板中
- 待审批权限、高风险确认和能力确认里的长用户请求、长原因、长风险说明、长命令预览和长影响说明，默认只显示短预览；完整 queued request、reason、risk、command preview、impact 必须保留在待审批对象、审计、回退或展开详情中

### 3.3 回退与审计

- 默认保留 10 段回退点
- 高级设置最多可调到 20 段
- 用户消息旁可以触发回退预览
- 回退前必须展示影响范围
- 回退确认后必须恢复目标状态并写入日志
- 右侧回退面板默认只展示回退点摘要和展开入口，不显示无待确认回退的空状态；进入待确认回退预览后必须保持目标、影响范围、确认和取消操作可见
- 当 `配置与记录` 展开时，待确认回退预览不得同时在折叠记录区和直接可见区渲染两份

### 3.4 本地任务恢复链路

- 输入区提交任务后，队列能显示排队状态
- 任务启动后，输入区可直接 `停止任务`
- 任务启动后，右侧任务队列中的运行项也可直接 `停止任务`
- 输入区只能被真实 `running` 任务禁用，不能被失效的 active task slot 误锁住
- 停止操作遇到失效的 active task slot 时也必须清理并恢复可输入状态
- 如果 active task slot 指向已完成、已失败或已取消的历史任务，停止操作不得把历史任务误标记为 cancelled
- 任务失败后，错误面板可 `重试本地任务`
- 任务失败后，右侧任务队列中的失败项也可直接 `重试本地任务`
- 停止和重试后必须更新审计与状态，且不能出现死锁或冻结
- 如果异常状态留下失效的 active task slot，下一轮调度必须恢复队列；有排队任务时继续启动，没有排队任务时解锁输入区，并把恢复原因写入输出和审计
- 失效 active task slot 被恢复或被下一轮调度清理时，默认主对话和右侧输出只显示中文短说明；完整 stale active trace、历史任务状态和 queued task 计数必须保留在审计、回退或展开详情中

### 3.5 错误追踪

- 每个错误必须带模块、时间、摘要、详情、恢复建议
- Shell 错误要保留 stdout/stderr 摘要
- API 错误要保留状态码和响应摘要
- RAG、Skills、NPC、MCP 错误要保留来源和修复建议
- 主对话中的任务或受控 shell 失败反馈应保持短说明，只展示失败摘要、恢复建议和关键失败原因；完整的执行 kind、执行标题、audit detail、回退可见性和输入摘要必须保留在日志、错误详情、回退或展开面板中
- 只读 shell 失败默认只显示中文短说明和检查建议；`Command id`、`Required permission`、底层桥接错误、stdout/stderr、状态码和响应摘要等完整诊断必须保留在展开日志、回退记录或失败详情中
- workspace-write shell 失败默认只显示中文短说明和权限审批检查建议；`Command id`、`Required permission`、底层 bridge 错误、stdout/stderr、状态码、响应摘要和原始 recovery hint 必须保留在展开日志、回退记录或失败详情中
- controlled-full shell 失败默认只显示中文短说明、高风险确认和回退快照检查建议；`Command id`、`Required permission`、底层 bridge 错误、stdout/stderr、状态码、响应摘要、原始 recovery hint 和回退快照诊断必须保留在展开日志、回退记录或失败详情中
- 主对话和右侧默认输出中的命令策略拦截反馈应保持中文短说明，只提示已拦截、未执行和下一步建议；完整工作目录、命令、queued request、policy detail、recovery trace 必须保留在日志、错误详情、回退或展开面板中
- 主对话和右侧默认错误区中的工具/RAG/pptx/docx/md 解析错误应保持短说明，只展示失败摘要和下一步建议；完整 parser trace、文件路径、响应详情和 retry trace 必须保留在日志、错误详情、回退或展开面板中
- 工具/RAG/pptx/docx/md 错误被用户处理或收起后，默认输出只显示已保留失败记录并清除当前错误提示；完整恢复建议、上一轮工具错误详情和 recovery trace 必须保留在日志、回退或展开面板中
- Ollama 服务不可达或没有可用本地模型时，主对话只显示极简模型配置引导，不直接暴露连接错误详情；右侧默认 Inspector 也不应把 Ollama 诊断作为常驻错误块显示，诊断细节必须留在设置、日志或展开记录中
- Ollama 返回上下文窗口、prompt 或输入过长类失败时，恢复建议必须明确提示缩小单次输入、分段处理长文档，或先走 RAG/摘要提取关键内容后再继续
- 因上下文过长失败的本地模型对话点击重试时，不得盲目再次调用 Ollama；应转入只读本地 RAG/摘要分段路径，并保留原失败诊断到审计与展开记录
- RAG 索引、workspace root 或 pptx/docx/md 解析链路失败后点击重试时，不得盲目重复同一 RAG 查询；纯 RAG 与 Skill 辅助 RAG 都必须先进入只读 RAG capability/index/parser 自检，并拒绝 planner 返回的权限请求、确认或非 RAG 自检任务
- Skill 辅助 RAG 失败时，错误诊断必须同时保留已匹配的 Skill、registry 路径和底层 RAG 失败原因，方便用户判断是 Skill 路由、索引还是解析链路需要修复
- 主对话和右侧默认输出中的权限升级取消、高风险确认取消、能力变更取消反馈应保持中文短说明；完整 recovery trace、queued execution、provider/configuration 等细节必须保留在日志、回退或展开面板中
- 主对话和右侧默认输出中的重复本地任务跳过反馈应保持中文短说明；长文本输入只能显示短预览，完整 existing task status、execution kind、previous failure detail、原始输入和 recovery trace 必须保留在日志、回退或展开面板中

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
- desktop smoke launchers should prefer a fresh dev session over silently reusing an already running frontend, so runtime verification does not accidentally stay on stale Vite dependency state
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
- the Chinese short continuation message `继续` follows the same explicit preview continuation rules as `continue`
- the resolved continuation still re-enters `planAssistantTask` and the normal permission or dangerous confirmation chain
- if the latest preview task already failed or was cancelled, short `continue` / `继续` must stop with visible guidance instead of re-planning a hidden repair or permission request
- no continuation path bypasses audit, timeout, or rollback protections

Current verification status on 2026-06-10:

- focused metadata coverage is green through `src/features/workbench/taskQueueMetadata.test.ts`
- focused app-level continuation coverage is green through `src/app/app.continuation.test.tsx`
- the dedicated continuation file now covers both skill-assisted and NPC-assisted preview handoff flows for create and destructive remove paths
- broader desktop regression coverage remains green through `src/app/app.test.tsx`
- no continuation scenario is currently marked `skip` in `src/app/app.test.tsx`
- the stable path for this slice is now the dedicated continuation test file plus task metadata coverage, broader app regression, and adapter build
- freshly verified with `npm --workspace apps/desktop exec vitest run src/features/workbench/taskQueueMetadata.test.ts src/app/app.continuation.test.tsx`, `npm --workspace apps/desktop exec vitest run src/app/app.test.tsx`, and `npm --workspace packages/openclaw-adapter run build`

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
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.self-repair.test.ts src/app/app.self-repair.test.tsx
npm --workspace apps/desktop exec tsc --noEmit
```

Integration note:

- because `@opencow/openclaw-adapter/browser` consumes built adapter output, desktop verification for this slice is not valid until the adapter build has been refreshed after planner changes

## 6.15a1 Ordinary chat network-search context verification addition

For ordinary local-model chat, acceptance should prove that enabled network search context is explicit and auditable even when no live external source is available.

Required checks:

- when search is enabled and source summaries exist, the local model receives bounded, compressed source references
- when search is enabled but no source summaries exist, the local model receives an explicit warning not to claim live retrieval was completed
- the audit detail records selected Ollama model, source count, search provider, and search context status
- ordinary chat stays in the main transcript and does not show local task chrome

Minimum focused verification:

```bash
npm --workspace apps/desktop exec vitest run src/app/app.chat.test.tsx src/app/app.chat-search-context.test.tsx src/app/app.chat-search-empty-context.test.tsx
```

## 6.15a2 Ordinary chat output-budget verification addition

For ordinary local-model chat, acceptance should prove that short knowledge questions do not ask Ollama for an unnecessarily long answer by default.

Required checks:

- short ordinary chat requests use a compact output budget so slower local models do not turn simple questions into long generations
- capability or help-style user questions must still route through ordinary local-model chat; legacy fixed assistant-help output is not an accepted response path
- long quiz, numbered, or long-document requests keep the long-answer budget and continuation protection
- the desktop Tauri command and browser preview both receive the same bounded `numPredict` / `num_predict` behavior
- the local-model chat timeout remains separate from the legacy generic 45 second local-task timeout

Current verification status on 2026-06-10:

- real Ollama API probe with `qwen3.6:35b` showed `开源协议有哪些` took about 54 seconds with a larger answer budget, but about 6 seconds with `num_predict: 512`
- focused TDD regression is green in `src/features/ollama/ollamaService.test.ts`
- desktop Tauri default output-budget regression is green in `cargo test ollama -- --nocapture`
- app-level timeout coverage remains green in `src/app/app.chat.test.tsx`

Minimum focused verification:

```bash
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.test.ts
npm --workspace apps/desktop exec vitest run src/features/ollama/ollamaService.test.ts
npm --workspace apps/desktop exec vitest run src/app/app.chat.test.tsx
cargo test ollama -- --nocapture
```

## 6.15a Opencow self-repair mutation verification addition

For the permission-backed opencow self-repair mutation slices, acceptance should prove that the preview path can continue into narrow verified repair actions without bypassing the desktop safety chain.

Required checks:

- planner maps explicit continuation wording for enabled-skills registry repair into `permission-request` in `readonly`
- approval continues into `opencow-self-repair-enabled-skills-registry` instead of re-running the readonly preview
- planner maps explicit continuation wording for workspace project runtime registry repair into `permission-request` in `readonly`
- approval continues into `opencow-self-repair-workspace-project-runtime-registry` instead of re-running the readonly preview
- desktop execution returns the repaired registry path and a verification-oriented summary for each narrow target
- Tauri repair recreates `.opencow/skills/enabled-skills.json` with the default schema even if the prior file contains invalid JSON
- Tauri repair recreates `.opencow/runtime/workspace-project-runs.json` with the default schema even if the prior file contains invalid JSON
- the final assistant result keeps audit-visible and rollback-visible wording

Minimum focused verification:

```bash
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.self-repair.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.self-repair.test.ts src/app/app.self-repair.test.tsx
npm --workspace apps/desktop exec tsc --noEmit
cargo test opencow_self_repair_enabled_skills_registry_recovers_from_invalid_json -- --nocapture
cargo test opencow_self_repair_workspace_project_runtime_registry_recovers_from_invalid_json -- --nocapture
```

## 6.15b Local project lifecycle verification addition

For the local project lifecycle slice, acceptance is not satisfied by launch-only coverage.

Required checks:

- planner maps explicit local run requests into `permission-request -> workspace-project-run`
- planner maps explicit status requests into readonly `workspace-project-status`
- planner maps explicit stop requests into `permission-request -> workspace-project-stop`
- desktop execution returns stable lifecycle fields for run and status, including `pid`, `expected_url`, and a readable summary
- Tauri lifecycle behavior shares one runtime registry across run, status, and stop instead of disconnected shell guesses
- app-level conversation flow proves:
  - `run` enters the permission-backed final result
  - `status` returns a readonly final result
  - `stop` enters the permission-backed final result

Minimum focused verification:

```bash
npm --workspace packages/openclaw-adapter exec vitest run src/localAssistantPlan.project-run.test.ts src/localAssistantPlan.project-status.test.ts src/localAssistantPlan.project-stop.test.ts
npm --workspace packages/openclaw-adapter run build
npm --workspace apps/desktop exec vitest run src/features/assistant/assistantTaskService.project-run.test.ts src/features/assistant/assistantTaskService.project-status.test.ts src/features/assistant/assistantTaskService.project-stop.test.ts src/app/app.project-run.test.tsx
npm --workspace apps/desktop exec tsc --noEmit
cargo test workspace_project_ -- --nocapture
```

## 6.16 Local task anti-stall verification addition

For the homepage conversation and local assistant task chain, acceptance is not satisfied by successful task starts alone.

Required checks:

- duplicate local tasks are not queued repeatedly while an identical queued or running task already exists
- queued tasks start with `attemptCount: 0` and increment on execution start
- failed tasks can be requeued without silently resetting guard metadata
- long-running assistant executions fail through the timeout guard instead of leaving the UI stuck forever
- timeout and retry-guard failures return traceable error metadata and a retry or simplification hint
- the pending conversation state remains visibly animated while a task is still in progress
- failed or cancelled preview tasks do not reuse hidden continuation metadata; a short continuation after such a terminal preview must surface a diagnostic and avoid queueing another local task
- first planner failures must not expose raw planner trace in the default conversation or output panel; the default output stays to one concise Chinese recovery message while preserving full diagnostics in audit and expanded records
- duplicate planner failures must not call the planner again, must not queue a hidden task, and must keep the default output to one concise Chinese recovery message while preserving full diagnostics in audit and expanded records
- after a workspace-write or controlled-full shell execution fails with a `verify ... before retrying` recovery hint, explicit retry must first route through a readonly shell self-check instead of immediately repeating the failed mutating command
- retry self-check planning must run under `readonly` permission and may only queue `readonly-shell-*` diagnostics; mutating task kinds must stop with a traceable planning failure
- a permission approval may only run queued execution kinds whose inferred permission is no higher than the approved mode; hidden controlled-full execution behind workspace-write approval must stop with audit-visible guidance
- a dangerous confirmation approval may only run queued execution kinds whose inferred permission is no higher than the confirmation `requiredMode`; hidden controlled-full execution behind readonly or workspace-write confirmation must stop with audit-visible guidance
- cancelling a permission request, dangerous confirmation, or capability change must clear stale active errors while preserving the cancellation audit, rollback entry, and queued trace details
- late task success or failure results must only apply to the same still-running task attempt; stale cancelled or completed active slots must not be overwritten by delayed execution results
- late task success after a local task timeout must not overwrite the visible timeout failure, clear recovery guidance, or reintroduce a pending task indicator
- local-model streaming chunks emitted after the user stops a task must be ignored and must not replace the visible cancelled-task state or conversation output

Minimum focused verification:

```bash
npm --workspace apps/desktop exec vitest run src/features/workbench/taskQueueDedup.test.ts src/features/workbench/taskQueueMetadata.test.ts src/features/workbench/taskQueueState.test.ts src/app/app.task-guard.test.tsx
```
