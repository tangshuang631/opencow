# OpenCow 开发交接（2026-09-08）

## 当前基线

- 工作分支：`dev`；`main` 未修改。
- 最近已推送基线：`21b3c30 feat(assistant): add generic intent and bounded react loop`。
- 本轮继续保持 Ollama-only、本地优先、OpenClaw 仅作后续 AdvancedRuntime sidecar；模型不能直接触达宿主 Shell、MCP 启动或 `project.run`。
- macOS 产物由 `npm run desktop:sync:mac` 同步到 `/Users/apple/Desktop/OpenCow桌面端.app`；Windows 接续时应从 `dev` 拉取源码并按同一门禁重建，不能复制 macOS bundle。

## 本轮已完成

- 通用检索回答链补齐证据覆盖判断：比较题会规范化“X 和 Y 的区别”中的语法尾缀，不再把 `Y 的` 误判为未命中。
- 当两侧均有实质性检索摘要/事实片段、模型却回答“现有来源不足”时，CowCore 验证器触发一次有界 ReAct 修复；未通过验证的首轮正文不会成为最终答案。
- 来源 `summary` 和 `factSnippets` 明确作为证据摘录传入模型；来源 URL 仍只放在信息引用区域，正文不显示来源块或裸链接。
- 侧栏会话列表改为常驻历史区：默认显示最近 3 条；搜索、展开到 6 条、恢复、删除和归档回调保持原有数据语义。删除按钮只在悬停/聚焦时显示，降低视觉噪音。

## 已验证

- CowCore answer validation 与桌面检索上下文回归通过。
- `apps/desktop/src/features/workbench/Workbench.test.tsx`：54/54 通过。
- `apps/desktop/src/app/app.chat-search-context.test.tsx`：5/5 通过，含“证据完整但模型先拒答→ReAct 重试”场景。
- 本轮最终全量门禁：桌面 73 文件/802 测试、Web 49 测试、CowCore 66 测试；workspace 其余单元测试也全部通过。
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`：103/103 通过。
- `npm run check:encoding` 与 `npm run check:health` 应在最终同步产物后再次运行。
- `cargo fmt --check` 当前会报告仓库既有全文件格式差异（包含未触及的 `rollback_files.rs`）；不要为接续开发直接格式化整仓，先单独评估格式基线。

## Windows 接续建议

1. 从 `dev` 拉取最新提交并确认 `git status` 干净；不要从 `main` 或旧安装包开始。
2. 先运行 `npm install`、`npm run build`、`npm run test:unit`、`npm run check:encoding`、`npm run check:health`，再执行 Windows Tauri 构建和安装包冒烟。
3. 优先继续 WP1A/WP1B：生产 Ollama Native Profile/Locality/Residency 生命周期接线、Context Budget、稳定 Prefix cache continuation、native tool/Schema/think/cancellation 指标采集；不要先扩写旧关键词路由。
4. 随后进入 WP2 Capability Registry/Grant，再进入 WP3 Sandbox/Artifact/Apply；任意 Shell 继续保持 fail-closed，不能用 Windows 宿主命令替代沙箱。
5. 前端后续再做整体 ChatGPT/Codex 风格细化；本轮只完成侧栏常驻会话与回答链稳定性，避免与运行时迁移并行扩大改动面。
