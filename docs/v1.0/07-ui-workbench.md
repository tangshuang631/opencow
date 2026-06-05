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
