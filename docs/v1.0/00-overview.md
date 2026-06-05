# opencow v1.0 开发文档总览

## 1. 项目定位

opencow v1.0 是面向中国用户和 Windows 桌面环境的本地优先 AI 助手。它以 `openclaw` 为后端能力基础，进行中度改造：保留核心能力上限，删除或折叠冗余入口，通过适配层、权限层、日志层和桌面工作台，让默认体验更轻、更快、更安全。

v1.0 的目标不是做一个更复杂的 openclaw，而是做一个更适合本地助手场景的 `openclaw-opencow`。

## 2. 核心原则

- `Ollama-first`：首页只强调本地 Ollama，自动读取本地模型列表。
- `Advanced API`：远程 API、`baseUrl + apiKey`、`ccswitch` 兼容入口保留在高级设置。
- `Local-first`：会话、日志、快照、知识库索引默认本地明文存储，并提供清理入口。
- `Windows-first`：优先服务 Windows 桌面端，减少安装和配置步骤。
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

## 5. 核心开发守则

后续开发必须优先遵循：

- [OPENCOW_CORE_RULES.md](../../OPENCOW_CORE_RULES.md)

编码规则以根目录核心守则为准：opencow 自有新增文件优先保持统一编码；接入或修改上游 `openclaw` 文件时优先匹配上游编码与风格；终端和开发脚本遇到中文编码风险时允许使用英文输出；前端用户界面保持中文优先。
