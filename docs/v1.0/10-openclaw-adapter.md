# 10. OpenClaw Adapter

## 1. 模块定位

`packages/openclaw-adapter` 是 opencow 对上游 `vendor/openclaw` 的第一层受控边界。

v1.0 阶段不直接把 OpenClaw 大量源码散落接入桌面端，也不把上游私有 workspace 包直接暴露给 UI。所有上游能力都应先经过 adapter 探测、声明、测试，再逐步接入 model gateway、permission engine、safety engine、audit core、rollback core 等 opencow 自有模块。

## 2. 当前职责

- 定位本地 `vendor/openclaw` 根目录。
- 读取 OpenClaw 根包元信息，用于审计、许可声明和兼容性检查。
- 探测关键能力包是否存在，包括 `llm-core`、`llm-runtime`、`model-catalog-core`、`plugin-sdk`、`terminal-core`、`tool-call-repair`。
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
