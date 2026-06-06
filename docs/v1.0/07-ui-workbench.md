# 07. 桌面工作台 UI

## 1. 技术路线

- `Tauri + React + TypeScript`
- `assistant-ui` 作为聊天交互骨架
- 参考 `cdesktop` 的工作台式信息架构，但视觉风格以白色、浅色、简洁为主
- 桌面端是主目标，Web 预览只用于开发调试，不作为正式产品形态

## 2. 视觉方向

- 主色调必须为白色和浅色，避免厚重后台感
- 风格参考 `Codex / 文心一言 / 豆包` 的简洁对话界面
- 首页优先强调 `Ollama 本地优先`
- 远程 API、Base URL、外部模型入口保留，但折叠进高级设置
- 保留 Figma 重构优化入口，组件命名、样式变量、布局层级都要便于后续设计映射

## 3. 布局结构

```text
Left Sidebar | Main Conversation | Right Inspector
              Bottom Composer
```

左侧：
- 新对话
- 搜索
- 知识库
- Skills
- NPC
- MCP
- 审计
- 设置

中间：
- 会话流
- 工具调用状态
- 计划与修复提示
- 错误与恢复信息
- 用户消息旁的回退入口

底部：
- 输入框
- 附件
- 当前模型
- 当前权限
- 联网搜索状态
- `发送 / 停止任务`

右侧：
- 输出产物摘要
- 来源
- 本地任务队列
- 工具结果
- 日志摘要
- 错误追踪
- 回退面板
- 高级设置

## 4. 本地任务交互

- 用户从输入区提交任务后，任务进入本地队列并显示状态
- 运行中的任务要同时支持两种停止入口：
- 输入区主按钮切换为 `停止任务`
- 右侧 `本地任务` 队列中的运行项直接显示 `停止任务`
- 失败任务要同时支持两种恢复入口：
- 错误面板显示 `重试本地任务`
- 右侧 `本地任务` 队列中的失败项直接显示 `重试本地任务`
- 队列交互必须可追踪、可中断、不可卡死

## 5. 回退交互

- 用户消息旁边显示回退按钮
- 默认保留 10 段回退点，高级设置最多提高到 20
- 点击后先预览影响范围，再确认回退
- 回退必须恢复到该操作执行前状态，并写入审计日志

## 6. 错误交互

错误不能只显示“失败”，必须展示：

- 错误摘要
- 所属模块
- 来源
- 时间
- 详细信息
- 可执行恢复动作

## 7. 高级设置

- 默认折叠
- 默认关闭远程 API
- 保留 `baseUrl / API Key / 外部模型` 配置入口
- 保留联网搜索、Skills 下载、MCP 等能力开关
- 所有高风险能力都要受权限、确认、日志、超时、工作目录限制约束
- 远程 API 与联网搜索需提供显式开关，且默认关闭
- 远程 API 区域至少显示并允许编辑 `baseUrl / provider label / apiKey`
- 用户从高级设置开启或关闭远程 API、联网搜索时，必须写入会话记录与审计日志
- 提供 `清空会话 / 清空日志 / 清空缓存 / 清空快照 / 清空知识库索引` 入口
- 清理动作在 v1.0 原型阶段先作用于本地工作台状态与明文维护桶统计，并写入审计日志
- 清理入口必须保持桌面端可见、可触发、可回退、可追溯

## 8. 前端目录约束

工作台前端目录当前按“小模块、单职责、桌面优先”拆分，后续继续开发时必须沿用这一结构，不允许再把状态、类型、权限、回退、任务流转重新堆回单个大文件。

当前关键目录：

```text
apps/desktop/src/features/workbench/
  components/
  Workbench.tsx
  workbenchText.ts
  workbenchState.ts
  workbenchState.types.ts
  workbenchState.shared.ts
  workbenchState.initial.ts
  workbenchState.ollama.ts
  workbenchState.permissions.ts
  workbenchState.rollback.ts
  workbenchState.rollbackFlow.ts
  workbenchState.search.ts
  workbenchState.tools.ts
  workbenchState.tasks.ts
```

拆分规则：

- `workbenchState.ts` 仅作为统一导出入口，保持调用方稳定。
- `workbenchState.types.ts` 只放状态类型与共享结构。
- `workbenchState.shared.ts` 只放无副作用的展示与事件 ID 工具函数。
- `workbenchState.rollback.ts` 只放回退记录、快照、裁剪等核心逻辑。
- `workbenchState.rollbackFlow.ts` 只放“预览回退 / 应用回退 / 取消回退”状态流转。
- `workbenchState.permissions.ts` 只放权限、确认、高风险操作前置状态。
- `workbenchState.tasks.ts` 只放本地任务队列、执行、失败、取消、重试。
- `workbenchState.ollama.ts`、`workbenchState.search.ts`、`workbenchState.tools.ts` 分别处理模型、联网搜索、工具结果。

维护要求：

- 新增工作台状态逻辑时，优先扩展对应子模块，不要直接堆到门面文件。
- 文件接近 `300-500` 行且职责开始混杂时，继续拆分。
- 新增目录或状态入口后，必须同步更新本节文档。
## 9. Figma 驱动改版落地方法

当前结论：
- 前端布局设计暂时不用改。
- 后续如需优化工作台视觉和交互，优先走 Figma 驱动路线。
- Codex 当前环境已具备 Figma 相关能力，可用于读取设计上下文、截图、变量和资源。

可落实方法：
1. 先在 Figma 中确定精确的 frame 或 node 链接，不使用模糊页面范围作为输入。
2. 在 Codex 中先读取目标节点的设计上下文，再读取对应截图；必要时再读取变量、资源和组件结构。
3. 先做“设计映射表”，再改代码。
设计映射表至少包含：Figma 节点名、对应 React 组件名、颜色/token、间距/token、字体/token、交互状态、是否桌面端特有。
4. 实现时优先改展示层和样式层，尽量不碰任务流、权限流、回退流和审计流。
5. 如必须调整结构，优先按区域分批落地：`Sidebar -> MainConversation -> Composer -> Inspector`，不要一次性整体重写。
6. 每次 Figma 改版都必须在桌面端验收。
至少检查：窗口宽窄变化、右侧 Inspector 密度、Composer 输入体验、待确认状态、长日志和长来源列表、回退面板可用性。

实施约束：
- Figma 输出不直接当成最终代码，必须翻译为 opencow 当前项目结构和命名。
- 新增视觉 token 时，优先收敛到共享样式入口，不把视觉常量散落到多个组件。
- 如果 Figma 设计与桌面安全交互冲突，以桌面安全交互优先，再做视觉贴合。
- 如需后续真正开始 Figma 改版，先冻结一版可运行工作台状态流，避免视觉重构和行为重构同时发生。
## 10. Conversation and assistant lightweighting

Current desktop-first conversation and assistant work should stay light, responsive, and low-noise.

Rules:

- do not queue the same local assistant task repeatedly while an identical task is already queued or running
- prefer deduplication at the state transition layer instead of stacking UI-only guards
- when a duplicate submit is skipped, keep the response short and explicit instead of silently dropping the action
- avoid multiplying repetitive queue entries, repeated audit spam, or repeated conversation boilerplate when adding new assistant capability slices
- when long desktop conversations exceed the bounded local history window, compress older context into one system summary entry instead of letting raw history grow without limit
- compression should stay lightweight and local-first: preserve recent working context, keep one cumulative compressed summary, and avoid introducing a heavy memory subsystem in the v1.0 mainline

Current focused verification:

```bash
npm --workspace apps/desktop exec vitest run src/features/workbench/taskQueueDedup.test.ts
npm --workspace apps/desktop exec vitest run src/features/workbench/conversationCompression.test.ts
```

## 11. Core chat reliability notes

The desktop app must treat ordinary user chat as a first-class local assistant path instead of letting it fail because of runtime directory assumptions.

- The default ordinary-chat fallback currently lands on the readonly `workspace-overview` assistant task.
- This fallback must stay usable in the real desktop runtime, not only in browser preview or mocked tests.
- Tauri workspace discovery must resolve the real repo root even when the app process starts from nested directories such as `apps/desktop` or `apps/desktop/src-tauri`.
- Workspace-root detection should walk upward until it finds the repo markers required by the desktop assistant chain, instead of assuming `current_dir` is already the repo root.
- Any future local assistant slice that reads docs, packages, config, skills, plugins, or shell command specs must reuse the same resolved workspace root.

Recommended regression coverage:

```bash
cargo test recognizes_workspace_root_markers -- --nocapture
cargo test resolves_workspace_root_from_nested_tauri_directory -- --nocapture
npm --workspace apps/desktop exec vitest run src/app/app.chat.test.tsx
```

## 12. Figma and gpt-taste follow-up path

Frontend redesign is intentionally deferred behind core desktop chat stability.

- `gpt-taste` is installed locally as a later-stage frontend refinement skill for higher-variance layout and stronger motion direction.
- Local install path: `C:\Users\31272\.codex\skills\gpt-tasteskill`
- Skill runtime name: `gpt-taste`
- For now it is reserved for dedicated frontend optimization windows and should not be used to reshape the core assistant, permissions, rollback, audit, or task-execution chain while those paths are still stabilizing.
- When the project enters a UI refinement window, prefer `Figma -> Codex -> opencow` first for structure and mapping, then optionally use `gpt-taste` to raise visual polish and motion quality inside the already-approved component boundaries.
- Any `gpt-taste`-driven changes must still be validated in the desktop runtime, not only in web preview.

## 13. Frontend design priority with gpt-taste

Once the project enters a dedicated frontend optimization window, `gpt-taste` becomes the preferred design skill for desktop UI refresh work.

- Default priority for future frontend visual redesign: `gpt-taste` first, then Figma mapping, then code landing inside the existing desktop component boundaries.
- `gpt-taste` is especially suitable for:
- stronger layout variance
- cleaner premium composition
- stricter typography control
- more deliberate motion direction
- reduced generic LLM layout repetition
- Use it mainly for `Workbench`, `Sidebar`, `MainConversation`, `Composer`, and `Inspector` presentation-layer refinement.
- Do not let `gpt-taste` directly rewrite permission flow, rollback flow, audit flow, assistant task routing, or shell safety UX behavior without a separate explicit implementation review.
- Before using `gpt-taste` in a real frontend task, restart Codex so the newly installed skill is available in the active session.
