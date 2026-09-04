# OpenCow

OpenCow 是一款基于 OpenClaw 改造的本地优先桌面 AI 助手。项目保留 OpenClaw 的 Agent、工具调用和扩展能力基础，同时面向 Windows/macOS 桌面场景重做产品入口、权限边界、审计回退、本地模型接入和中文工作台体验。

当前项目以桌面端为主要交付目标。Web 预览仅作为开发调试和保底验证入口，真实验收以 Tauri 桌面应用为准。

## 项目定位

OpenClaw 本身具备较强的工程能力，但默认形态更接近开发框架：入口偏重、桌面交互不够轻、权限与审计链路不够产品化，本地模型和普通用户工作流也需要额外适配。OpenCow 的目标不是做一个更复杂的 OpenClaw，而是把 OpenClaw 改造成一个更适合个人电脑使用的本地 AI 助手。

主要改造方向：

- **本地优先**：默认优先使用 Ollama，本地模型列表自动检测；远程 API 保留在高级设置中。
- **桌面优先**：以 Tauri 桌面端为主应用，提供会话、任务队列、右侧检查器、来源引用、回退入口和设置面板。
- **安全可控**：Shell、文件写入、删除、配置修复、Skills/NPC/MCP 等本地动作进入统一权限、确认、超时、审计和回退链路。
- **可追溯可恢复**：保留执行摘要、错误详情、审计事件、回退点和用户可读的恢复建议。
- **适配层集成 OpenClaw**：上游源码保留在 `vendor/openclaw`，通过 `packages/openclaw-adapter` 对接能力，避免把项目改动散落到上游代码中。

## 核心能力

- Ollama-first 本地模型对话与模型检测
- Windows/macOS 桌面工作台
- 只读、工作区读写、受控完全访问等权限模式
- 高风险 Shell / 文件操作安全检查
- 任务执行审计和可见运行轨迹
- 回退点与快照导向的恢复机制
- 本地 RAG、知识库引用和来源折叠展示
- Skills、NPC、MCP 工作区面板
- 长文本输入摘要、代码块渲染、对话历史和来源感知回复
- Windows/macOS 本地启动脚本和健康检查脚本

## 技术栈

- **桌面端**：Tauri 2、Rust
- **前端**：React 19、TypeScript、Vite
- **UI**：lucide-react、自定义 Workbench 样式
- **本地模型**：Ollama
- **核心包**：OpenClaw Adapter、Permission Engine、Safety Engine、Shell Runtime、Rollback Core、Audit Core
- **测试**：Vitest、Testing Library、Node test runner

## 仓库结构

```text
opencow/
  apps/
    desktop/              # Tauri + React 桌面应用
    web/                  # 开发预览入口
  packages/
    openclaw-adapter/     # OpenClaw 能力适配层
    permission-engine/    # 权限升级与审批描述
    safety-engine/        # 高风险操作保护判断
    shell-runtime/        # Shell 计划、超时和审计摘要
    rollback-core/        # 回退日志基础能力
    audit-core/           # 审计事件结构
  vendor/
    openclaw/             # 上游 OpenClaw 源码与许可证边界
  docs/
    v1.0/                 # 产品、架构、安全、UI 和验收文档
  scripts/                # 启动、健康检查、Graphify 和工具脚本
```

## 快速开始

### 环境要求

- Node.js 与 npm
- Rust toolchain 与 Cargo
- 已安装并运行 Ollama
- 至少已拉取一个本地 Ollama 模型

### 桌面端开发

```bash
npm install
npm run desktop:dev
```

### 桌面测试启动

Windows：

```powershell
start-opencow-test.bat
```

macOS：

```bash
npm run desktop:run:mac
```

仅做环境检查：

```bash
npm run desktop:test:check
```

macOS 手工试用最新桌面构建：

```bash
npm run desktop:sync:mac
open "/Users/apple/Desktop/OpenCow桌面端.app"
```

桌面同步只维护这一份可试用应用；网页预览直接运行 Vite 开发命令即可。

## 常用命令

```bash
npm run build
npm test
npm run test:unit
npm run check:encoding
npm run check:health
npm run graphify -- . --clean
```

桌面端聚焦测试：

```bash
npm test --workspace apps/desktop -- --run
```

## 安全执行模型

OpenCow 将本地执行视为安全关键链路。Shell 命令、文件写入、删除覆盖、自修复、Skill 变更和助手拥有的配置更新，都应遵循下面的流程：

```text
inspect -> preview -> permission / confirmation -> execute -> verify -> audit / rollback
```

UI 不直接绕过或自行推断权限、安全、Shell、审计和回退决策，这些职责由独立 packages 与 Tauri 运行时边界承接。

## 文档入口

参与开发前建议先阅读：

- [OPENCOW_CORE_RULES.md](./OPENCOW_CORE_RULES.md)
- [docs/v1.0/00-overview.md](./docs/v1.0/00-overview.md)
- [docs/v1.0/02-architecture.md](./docs/v1.0/02-architecture.md)
- [docs/v1.0/04-permission-safety-shell.md](./docs/v1.0/04-permission-safety-shell.md)
- [docs/v1.0/08-testing-acceptance.md](./docs/v1.0/08-testing-acceptance.md)

## 分支策略

- 日常开发在 `dev` 分支进行。
- 对外展示和稳定同步代码合并到 `main` 分支。
- 推送前应至少完成相关模块测试，并检查工作区改动。

## 当前状态

OpenCow 仍处于 v1.0 桌面端开发阶段。当前优先级是打磨可靠的本地助手主链路：会话、本地 Ollama 对话、受控本地任务、权限保护的 Shell 操作、自修复预览、审计可见性、回退恢复，以及更清爽的桌面工作台体验。
