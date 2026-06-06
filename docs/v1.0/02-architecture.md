# 02. 架构与项目结构

## 1. openclaw 改造策略

采用中度改造路线：

- 克隆 `openclaw` 作为后端基础。
- 尽量少改上游核心源码。
- 用 `openclaw-adapter` 包裹和适配核心能力。
- 冗余功能可以删除或折叠，但必须保证核心能力正常。
- 后续需要深改时，先在 adapter 中验证，再决定是否沉入 openclaw fork。

推荐源码组织：

```text
opencow/
  vendor/
    openclaw/
  packages/
    openclaw-adapter/
```

`vendor/openclaw` 保留上游源码和许可证信息，`packages/openclaw-adapter` 负责统一对接模型、工具、会话、任务和权限。
`packages/shell-runtime` 负责承接桌面端和后续 Tauri 执行器共享的 shell 执行前计划、超时归一化、策略结果映射与审计摘要生成。
`packages/audit-core` 负责承接共享审计事件结构、时间戳标准化与后续日志查询/存储层的公共边界。
`packages/permission-engine` 负责承接提权请求判断、权限模式升级描述与后续授权记录边界。
`packages/safety-engine` 负责承接高风险计划的执行保护判断，例如执行前是否必须创建快照、展示预览、阻断无回退能力的危险操作。

## 2. 总体架构

```text
Desktop App
  -> Workbench UI
  -> Local Runtime Adapter
  -> Permission / Safety / Audit
  -> Rollback / Snapshot Guard
  -> openclaw core
  -> Model Gateway / Tool Runtime / Knowledge Runtime
  -> Local Storage
```

## 2.1 桌面端优先边界

opencow 的产品目标是桌面端，不是 Web 端。

- `apps/desktop` 是主应用入口。
- Tauri 桌面端是真实验收对象。
- Vite/Web 预览只用于前端开发、快速调试和保底 smoke。
- 原生目录选择、权限确认、shell 限制、审计日志、回退能力必须以桌面端行为为准。
- 如果 Web 预览和桌面端行为不一致，以桌面端为准。
- 不为 Web 部署牺牲桌面端的安全、性能和交互完整性。

## 3. 推荐项目结构

```text
opencow/
  apps/
    desktop/
      src/
        app/
        components/
        features/
          chat/
          workbench/
          attachments/
          search/
          knowledge/
          skills/
          npc/
          mcp/
          tools/
          permissions/
          safety/
          rollback/
          audit/
          settings/
        hooks/
        lib/
        styles/
      src-tauri/
        src/
          commands/
          permissions/
          safety/
          shell/
          audit/
          rollback/
          storage/
          system/
      package.json
  packages/
    openclaw-adapter/
    model-gateway/
    permission-engine/
    safety-engine/
    shell-runtime/
    rollback-core/
    audit-core/
    knowledge-core/
    skills-core/
    npc-core/
    mcp-core/
    shared-types/
    shared-utils/
  vendor/
    openclaw/
  docs/
    v1.0/
  scripts/
    setup/
    dev/
    release/
```

## 4. 分块编码规范

- 新增文件默认 `UTF-8`。
- 单文件接近 `300-500` 行且职责混杂时必须拆分。
- UI 视图、状态、服务、类型、测试分文件。
- 权限、安全、日志、回退不得散落在 UI 事件里。
- shell 执行必须通过 `shell-runtime`，不能由 UI 直接拼接执行。
- `shell-runtime` 先输出可审计的计划对象，再决定是否进入真实执行层。
- `safety-engine` 根据计划对象判断是否需要快照、预览或直接阻断，UI 只消费结果，不自行推断风险。
## 5. 后期集中清理机制

为了避免在主线开发中边做能力、边随手大删代码，仓库固定维护一份集中清理清单：

- `E:\2026\opencow\后期考虑删除的清单.md`

执行规则：

- 开发过程中一旦发现“对 opencow 真正不必要、且影响运行效率、响应速度、构建体积或维护成本”的多余代码，立即登记到该清单。
- 每条记录必须写清路径和当前功能，避免后续只能凭印象排查。
- 当前窗口优先做主线闭环，不因为看到可删代码就顺手扩大删除范围。
- 后续专门开一轮“减负/清理”窗口，再按清单逐项验证和清除。

## 6. 历史污染与高风险文本块处理

仓库开发中会反复遇到：

- 终端显示噪音
- 中文乱码或 mojibake
- 高风险文本块导致 patch 不稳定
- 原有文本无法精确匹配
- 历史遗留的换行、编码、演示逻辑和兼容层污染

后续固定处理方法：

- 把这些文件视为“污染路径”或“高风险文本块”，优先隔离，不在当前功能窗口内大面积整理。
- 能通过新增模块、包装层、适配层、旁路服务解决的，优先走旁路，不直接深改污染文件。
- 对污染文件只做最小稳定修改，改完立即复查。
- 如果多次 patch 失败，就停止扩大范围，记录到 `E:\2026\opencow\后期考虑删除的清单.md`，后续专门清理。
- 冗余废弃代码、临时演示逻辑、历史兼容分支，也可以放入同一清单统一收口，等清理窗口再删除对应路径和名称。
