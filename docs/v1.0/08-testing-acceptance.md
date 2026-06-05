# 08. 自动化测试与验收指标

## 1. 测试原则

使用最高可行级别的自动化测试覆盖关键链路。目标不是追求形式化覆盖率，而是保证安全、稳定、可追溯、不卡死。

优先级：

1. 权限与高风险操作。
2. shell 执行限制。
3. 回退点与快照。
4. 日志和错误追踪。
5. Ollama 模型链路。
6. RAG、Skills、NPC、MCP。
7. UI smoke。

## 2. 自动化测试层级

建议测试层级：

- 单元测试：权限判断、风险分级、命令分类、日志事件结构。
- 集成测试：Ollama provider、openclaw-adapter、shell-runtime、rollback-core。
- 桌面 smoke：Tauri 启动、主界面渲染、模型状态、输入区、右侧面板。
- 安全专项测试：删除、覆盖、批量操作、进程终止、超时、工作目录越界。
- 稳定性测试：错误不致卡死，长任务可中断，失败可查看详情。

## 3. 验收指标

### 3.1 启动与可用性

- 应用启动后能进入主界面。
- Ollama 不可用时必须显示明确诊断。
- Ollama 可用时必须能读取模型列表。
- 主界面不能因为模型不可用而白屏。

### 3.2 权限与 shell

- 只读模式下不能写入文件。
- 未授权目录不能读写。
- shell 必须有工作目录、超时和日志。
- 高风险命令必须弹窗确认。
- 未确认不得执行删除、覆盖、递归删除、进程终止。
- 禁止模型杀死 opencow 自身进程。

### 3.3 回退与审计

- 默认保留 10 段回退点。
- 高级设置允许最高 20 段。
- 用户消息旁边可触发回退。
- 回退前必须提示影响范围。
- 回退操作必须写入日志。

### 3.4 错误追踪

- 每个错误必须包含模块、时间、摘要、详细信息入口。
- shell 错误必须保留 stdout/stderr 摘要。
- API 错误必须保留状态码和响应摘要。
- RAG/Skill/MCP 错误必须有来源和修复建议。
- 应用不能因为单个工具失败而卡死。

### 3.5 RAG、Skills、NPC、MCP

- RAG 可以导入、索引、检索、展示来源。
- Skills 可以扫描、启用、禁用、下载前确认。
- NPC 可以创建、切换、绑定默认工具和知识库。
- MCP 可以配置、启动、停止、记录工具列表。

## 4. 推荐命令

后续项目落地后建议提供：

```powershell
npm run test
npm run test:unit
npm run test:integration
npm run test:e2e
npm run check:encoding
npm run check:health
npm run build
cd apps/desktop/src-tauri
cargo fmt --check
cargo check
cargo test
```

## 5. 不可接受情况

- 白屏无日志。
- 卡死无中断。
- 权限不足却继续执行。
- 删除或覆盖无确认。
- shell 无超时。
- 错误没有详情。
- 日志无法定位失败模块。
- 中文乱码。

