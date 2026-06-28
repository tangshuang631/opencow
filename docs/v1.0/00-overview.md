# opencow v1.0 开发文档总览

## 1. 项目定位

opencow v1.0 是面向中国用户和 Windows/macOS 桌面环境的本地优先 AI 助手。它以 `openclaw` 为后端能力基础，进行中度改造：保留核心能力上限，删除或折叠冗余入口，通过适配层、权限层、日志层和桌面工作台，让默认体验更轻、更快、更安全。

v1.0 的目标不是做一个更复杂的 openclaw，而是做一个更适合本地助手场景的 `openclaw-opencow`。

## 2. 核心原则

- `Ollama-first`：首页只强调本地 Ollama，自动读取本地模型列表。
- `Advanced API`：远程 API、`baseUrl + apiKey`、`ccswitch` 兼容入口保留在高级设置。
- `Local-first`：会话、日志、快照、知识库索引默认本地明文存储，并提供清理入口。
- `Desktop-first`：优先服务 Windows 和 macOS 桌面端，减少安装和配置步骤。
- `Chinese-first`：新增源码、脚本、配置和文档默认使用 `UTF-8`。
- `Safety-first`：shell、文件写入、删除、覆盖、批量操作必须经过权限、确认、日志、超时、工作目录限制。
- `Recoverable-first`：对话支持用户可调的回退点，默认最多 10 段，高级设置最高 20 段。
- `Beautiful and simple`：浅色白色为主，参考 Codex、文心一言、豆包和 cdesktop 的简洁工作台气质。

## 3. 文档目录

- [01-product-scope.md](./01-product-scope.md)：产品范围、v1.0 做什么和不做什么。
- [02-architecture.md](./02-architecture.md)：openclaw 中度改造、项目结构、模块边界。
- [03-model-network.md](./03-model-network.md)：Ollama、远程 API、联网搜索策略。
- [04-permission-safety-shell.md](./04-permission-safety-shell.md)：权限、安全、shell 和高风险操作边界。
- [05-rollback-audit-storage.md](./05-rollback-audit-storage.md)：回退点、快照、日志、明文本地存储。
- [06-rag-skills-npc-mcp.md](./06-rag-skills-npc-mcp.md)：RAG、Skills、NPC、MCP 一等能力设计。
- [07-ui-workbench.md](./07-ui-workbench.md)：浅色桌面工作台、信息架构和交互规范。
- [08-testing-acceptance.md](./08-testing-acceptance.md)：自动化测试、验收指标、错误可追溯和稳定性要求。
- [09-distribution-license.md](./09-distribution-license.md)：安装分发、更新、开源许可证和引用边界。

## 4. 第一阶段建议

1. 克隆并固定 `openclaw` 上游源码。
2. 建立 `openclaw-adapter`，避免直接把上游源码改散。
3. 搭建 `Tauri + assistant-ui` 桌面壳。
4. 打通 Ollama 检测、模型列表、基础聊天。
5. 先实现权限、安全、日志、回退骨架，再接入更强工具能力。

当前执行策略：

- 继续开发时默认先做桌面端能力闭环。
- `apps/web` 暂不继续扩展后续功能，只保留必要测试与已有对齐基线。
- 新能力先在 Windows/macOS 桌面端验收，再决定是否同步到 web。

## 5. 核心开发守则

后续开发必须优先遵循：

- [OPENCOW_CORE_RULES.md](../../OPENCOW_CORE_RULES.md)

编码规则以根目录核心守则为准：opencow 自有新增文件优先保持统一编码；接入或修改上游 `openclaw` 文件时优先匹配上游编码与风格；终端和开发脚本遇到中文编码风险时允许使用英文输出；前端用户界面保持中文优先。
## 6. Figma 驱动前端优化预留

v1.0 当前阶段以前端功能闭环、桌面稳定性和真实本地助手执行链为优先，暂不主动重做工作台布局。

后续前端优化明确预留 `Figma -> Codex -> opencow` 路线，执行规则如下：

- 当前默认不改工作台整体布局，除非用户明确要求或进入专门的 Figma 改版窗口。
- 继续保持 `Workbench / Sidebar / MainConversation / Composer / Inspector / RollbackPanel` 这类按产品角色拆分的组件边界，便于后续和 Figma 节点映射。
- 颜色、间距、排版、圆角、阴影等视觉决策继续尽量集中，避免散落进状态逻辑和低层运行时代码。
- 后续如需重构前端，优先使用 Codex 当前已具备的 Figma MCP 能力读取设计上下文、截图、变量和资源，再按 opencow 现有规范落地。
- Figma 结果只作为设计表达，不直接照搬生成代码；必须回译到 opencow 当前组件结构、桌面优先约束、权限/审计/回退边界中。
- 每次 Figma 驱动改版后，都必须回到桌面端验收，而不能只看 Web 预览。

## 7. 后期删除清单机制

仓库固定维护一份：

- `E:\2026\opencow\后期考虑删除的清单.md`

后续开发时，凡是发现“对 opencow 真正不必要、且影响运行效率、维护成本或运行稳定性”的多余代码，都要实时把对应路径和功能登记进去，后面再统一依照该清单清理。

当前原则：

- 主线开发中优先登记，不随手扩大删除范围。
- 只有确认“真正不必要”的内容才进入清单。
- 后续清理必须按路径逐项验证，不凭记忆批量删除。

## 8. 开发防污染机制

这类高频问题后续按统一机制处理：

- 终端显示噪音
- 高风险文本块
- 原有文本匹配不到
- 历史污染文件
- 冗余废弃代码

统一原则：

- 先保护当前主线开发稳定性，再处理污染问题。
- 匹配不稳、编码不稳、行尾不稳的文件一律按高风险文件处理。
- 优先缩小修改范围、改走相邻干净模块、增加包装层或新增文件，避免在污染文件中做大面积重写。
- 终端如果对中文显示不稳定，开发日志、搜索关键词、验证说明优先使用英文，避免继续放大噪音。
- 发现会反复拖慢开发效率或影响代码整洁度的问题路径，实时登记到 `E:\2026\opencow\后期考虑删除的清单.md`，后续统一清理。
- 只有在专门的清理窗口里，才集中清掉这些路径并同步删掉清单中的对应记录。

## 9. 测试与推送节奏

后续开发统一按下面节奏执行：

- 小模块开发或局部修改完成后，可以先不推送，但必须先跑该模块对应测试。
- 里程碑式开发完成后，不能只满足于冒烟测试，必须做全链路完整测试。
- 里程碑测试后要做自检；发现问题就修复，再自检，再复测，直到结果稳定无误。
- 推送不要求太频繁，但每次推送都应对应一个经过完整验证的清晰批次。
- 相比“频繁推送”，更优先“在关键节点完成完整验证后再推送”。
## 10. Current delivery priority

For the current v1.0 desktop-deliverable path, implementation priority is intentionally narrower than the long-term vision:

- homepage conversation and lightweight assistant replies come first
- simple local task handling comes before broader automation breadth
- conversation-driven assistant actions, permission-backed shell work, Skill use, and self-repair should share one controlled chain
- `preview -> permission / confirmation -> execute -> verify -> audit / rollback` is the mainline shape to keep reinforcing
- do not overfit current development to one NPC showcase example before the homepage conversation and assistant chain are stable

## 11. Anti-stall and self-repair direction

To keep opencow usable and reliable on local models, all real execution chains should default to these protections:

- duplicate task detection for repeated user requests
- maximum execution duration for long-running local assistant work
- maximum retry count for repeated failures
- visible loading / thinking / queued feedback so the desktop app does not look frozen
- graceful stop with concrete failure analysis when opencow cannot finish a task by itself

Conversation-driven self-repair, Skill install or enable flows, assistant-owned config repair, and log-guided recovery should all follow the same controlled path:

- inspect
- explain
- preview
- request permission if mutation is needed
- execute
- verify
- summarize with audit and rollback visibility

Current self-repair landing state:

- readonly preview is already available through `opencow-self-repair-preview`
- the first permission-backed mutation is already available through `opencow-self-repair-enabled-skills-registry`
- the second permission-backed mutation is already available through `opencow-self-repair-workspace-project-runtime-registry`
- the current landed mutations remain intentionally narrow and only repair `.opencow/skills/enabled-skills.json` or `.opencow/runtime/workspace-project-runs.json`

Current non-goals for this stage:

- no broad assistant-owned config rewrite flow yet
- no destructive or process-restart self-repair flow yet
