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

## 2. 总体架构

```text
Desktop App
  -> Workbench UI
  -> Local Runtime Adapter
  -> Permission / Safety / Audit
  -> openclaw core
  -> Model Gateway / Tool Runtime / Knowledge Runtime
  -> Local Storage
```

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

