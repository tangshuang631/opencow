# 04. 权限、安全与 Shell

## 1. 权限模式

推荐三档：

1. `只读`
- 读取授权目录和附件。
- 不允许写入、删除、执行 shell。

2. `工作区读写`
- 可在授权工作区内读写。
- 不允许删除、覆盖、跨目录批量移动等高风险操作。
- shell 只能在授权工作区内执行白名单或低风险命令。

3. `受控完全访问`
- 可执行更高风险操作。
- 仍必须经过确认、日志、超时和工作目录限制。
- 删除、覆盖、批量改动、进程控制必须二次确认。

## 2. Shell 策略

v1.0 允许 shell，但必须强约束。

必须满足：

- 有明确工作目录。
- 有超时时间。
- 有输出捕获。
- 有错误捕获。
- 有审计日志。
- 有风险分级。
- 高风险命令弹窗确认。
- 高风险写操作在执行前必须经过 `safety-engine` 判断是否需要快照和预览。
- 没有可用快照能力时，高风险破坏性操作默认阻断，不允许裸执行。
- 不允许模型自行杀死 opencow 自己的进程。
- 不允许模型绕过权限升级。

## 3. 高风险命令

以下类型必须弹窗确认：

- 删除文件或目录。
- 覆盖文件。
- 批量移动或重命名。
- 递归删除。
- 进程结束。
- 修改系统目录。
- 修改环境变量或启动项。
- 下载并执行脚本。

尤其是类似 `rm -rf`、`Remove-Item -Recurse`、批量删除、强制覆盖，必须走权限、确认、日志、超时、工作目录限制。

## 3.1 快照与预览保护

对于删除、覆盖、批量改动这类高风险操作，执行前默认进入安全保护链路：

- `shell-runtime` 先产出标准化执行计划。
- `permission-engine` 判断当前权限是否足够，不足则只生成提权请求。
- `safety-engine` 判断是否必须创建快照、展示影响预览，或在无回退条件时直接阻断。
- UI 必须向用户展示命令预览、影响范围、安全保护说明，再允许确认执行。
- 审计日志必须记录“计划生成、提权、确认、执行、回退”各阶段。

## 4. 用户没有明确要求时禁止执行

模型不能因为“推测用户可能想要”而执行危险操作。

规则：

- 用户没要求删除，就不能删除。
- 用户没要求覆盖，就不能覆盖。
- 用户没要求结束进程，就不能结束进程。
- 用户没要求提权，就不能自行提权。
- 权限不足时只能解释原因并请求用户决定。

## 5. 对话开启工具

用户可以通过对话请求开启工具，例如联网搜索、Skill 下载、shell、更高权限。

开启流程：

- 模型提出需要开启的工具和原因。
- UI 显示工具名称、权限变化、风险。
- 用户确认。
- 写入权限日志。
- 本轮或后续会话按授权范围执行。

桌面端 v1.0 补充要求：

- 对话里请求 `开启联网搜索 / 关闭联网搜索 / 开启远程 API / 关闭远程 API` 时，不允许直接生效。
- 这些能力变更必须先进入确认态，再由用户批准或取消。
- 批准后才写入会话记录、审计日志和回退记录。
- 若用户取消，则保持当前能力状态不变，不进入本地任务队列。
## 6. Current desktop shell landing slice

The first real shell execution slice in v1.0 is intentionally readonly and whitelist-only.

- Conversation requests are mapped to fixed readonly shell task kinds instead of free-form command strings.
- The desktop app currently allows:
  - `git status --short`
  - top-level workspace listing
  - `packages/` directory listing
- These commands execute only through the Tauri-side whitelist executor.
- The UI still treats them as assistant tasks, so the same queue, audit, and failure surfaces stay in place.
- This slice is the required base before writable or high-risk shell actions are connected to user confirmation.

Rules for the next shell stage:

- Writable shell actions must continue to flow through `openclaw-adapter -> shell-runtime -> permission-engine -> safety-engine -> audit/rollback`.
- Free-form user shell text must not be executed directly from the conversation layer.
- High-risk shell plans must stay blocked until explicit confirmation and snapshot protections are available.

## 6.1 Current writable and controlled-full desktop slice

The desktop assistant now includes the first two non-readonly shell mappings, still through explicit task kinds only.

- `workspace-write-create-temp-output`
  - permission gate: `workspace-write`
  - execution shape: fixed workspace-local directory creation
  - current command: `New-Item -ItemType Directory -Force temp-output`
- `controlled-full-remove-temp-output`
  - permission gate: `controlled-full`
  - confirmation gate: required before queueing execution
  - execution shape: fixed destructive cleanup of `temp-output`
  - current command: `Remove-Item -LiteralPath temp-output -Recurse -Force`

Required desktop flow for the destructive slice:

1. conversation intent enters `openclaw-adapter`
2. planner returns `permission-request` to `controlled-full`
3. user approves permission
4. planner re-runs under the approved mode
5. planner returns `confirmation`
6. user approves dangerous action
7. desktop queues the fixed execution kind
8. Tauri executes the controlled-full command
9. result remains visible through task queue, audit, and rollback-linked surfaces

This is still not arbitrary shell execution. The conversation layer may only reach fixed mapped commands that already have permission and confirmation rules.
