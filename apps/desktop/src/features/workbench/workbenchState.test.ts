import { describe, expect, it } from "vitest";
import {
  applyPendingRollbackState,
  approvePendingConfirmationState,
  approvePermissionModeChangeState,
  cancelPendingRollbackState,
  cancelPendingConfirmationState,
  cancelPermissionModeChangeState,
  createCommandPolicyBlockedState,
  createCapabilityToggleRequestState,
  createInitialWorkbenchState,
  createHighRiskConfirmationState,
  createOllamaLoadErrorState,
  createRemoteApiConfigState,
  createRemoteApiToggleState,
  createSearchEnabledState,
  createSearchProviderConfigState,
  createSearchToggleState,
  createUserTaskSubmittedState,
  createRollbackLimitUpdatedState,
  createStorageCleanupState,
  createToolExecutionErrorState,
  createToolExecutionState,
  requestRollbackPreviewState,
  requestPermissionModeChangeState
} from "./workbenchState";

describe("createInitialWorkbenchState", () => {
  it("uses local Ollama, read-only permission, and 10 rollback points by default", () => {
    const state = createInitialWorkbenchState();

    expect(state.model.label).toBe("Ollama 本地优先");
    expect(state.model.remoteApiEnabled).toBe(false);
    expect(state.settings.remoteApi.baseUrl).toBe("");
    expect(state.settings.remoteApi.collapsed).toBe(true);
    expect(state.permission.mode).toBe("readonly");
    expect(state.permission.summary).toBe("仅允许读取已授权目录与附件。");
    expect(state.permission.requiresConfirmation).toBe(true);
    expect(state.rollback.defaultLimit).toBe(10);
    expect(state.rollback.activeLimit).toBe(10);
    expect(state.rollback.maxLimit).toBe(20);
    expect(state.rollback.entries).toHaveLength(1);
    expect(state.rollback.entries[0]?.label).toBe("启动基线");
    expect(state.conversation.entries[0]).toMatchObject({
      id: "assistant-welcome",
      kind: "assistant",
      title: "Ollama 本地优先"
    });
  });

  it("keeps a safe rollback record when ollama loading throws", () => {
    const state = createInitialWorkbenchState();

    const updated = createOllamaLoadErrorState(state, "connect ECONNREFUSED 127.0.0.1:11434");

    expect(updated.error?.summary).toBe("无法连接本地 Ollama");
    expect(updated.audit.summary).toBe("Ollama 状态读取失败，工作台保持可用");
    expect(updated.rollback.entries).toHaveLength(2);
    expect(updated.rollback.entries[0]?.label).toBe("异常保护");
    expect(updated.conversation.entries[0]).toMatchObject({
      title: "Ollama 状态读取异常",
      detailLines: ["模块: ollama", "来源: ollama_overview", "建议: 检查 Ollama 服务"]
    });
  });

  it("tracks a pending high-risk confirmation before dangerous actions run", () => {
    const state = createInitialWorkbenchState();

    const updated = createHighRiskConfirmationState(state, {
      title: "确认删除临时目录",
      summary: "模型计划删除工作区内的 temp-output 目录。",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "将删除 12 个文件，写入回退快照后才可执行。",
      requiredMode: "controlled-full"
    });

    expect(updated.confirmation.pending).toMatchObject({
      title: "确认删除临时目录",
      summary: "模型计划删除工作区内的 temp-output 目录。",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "将删除 12 个文件，写入回退快照后才可执行。",
      requiredMode: "controlled-full"
    });
    expect(updated.audit.summary).toBe("等待用户确认高风险操作");
    expect(updated.audit.lastEvent.source).toBe("permission_confirmation");
  });

  it("records an approved high-risk confirmation and clears the pending request", () => {
    const pending = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "确认删除临时目录",
      summary: "模型计划删除工作区内的 temp-output 目录。",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "将删除 12 个文件，写入回退快照后才可执行。",
      requiredMode: "controlled-full"
    });

    const updated = approvePendingConfirmationState(pending);

    expect(updated.confirmation.pending).toBeNull();
    expect(updated.audit.summary).toBe("用户已批准高风险操作");
    expect(updated.audit.lastEvent.source).toBe("permission_confirmation_approved");
    expect(updated.rollback.entries[0]?.label).toBe("已批准操作");
  });

  it("records a cancelled high-risk confirmation and keeps the app safe", () => {
    const pending = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "确认删除临时目录",
      summary: "模型计划删除工作区内的 temp-output 目录。",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "将删除 12 个文件，写入回退快照后才可执行。",
      requiredMode: "controlled-full"
    });

    const updated = cancelPendingConfirmationState(pending);

    expect(updated.confirmation.pending).toBeNull();
    expect(updated.audit.summary).toBe("用户已取消高风险操作");
    expect(updated.audit.lastEvent.source).toBe("permission_confirmation_cancelled");
    expect(updated.rollback.entries[0]?.label).toBe("已取消操作");
  });

  it("requests confirmation before enabling search from conversation", () => {
    const updated = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "用户要求开启联网搜索以补充最新来源。",
      providerLabel: "Tavily"
    });

    expect(updated.confirmation.pending).toMatchObject({
      title: "确认开启联网搜索",
      summary: "用户要求开启联网搜索以补充最新来源。",
      requiredMode: "readonly",
      requestedFeature: "search",
      requestedEnabled: true,
      providerLabel: "Tavily"
    });
    expect(updated.search.enabled).toBe(false);
    expect(updated.audit.summary).toBe("等待用户确认能力变更");
    expect(updated.audit.lastEvent.source).toBe("capability_toggle_request");
  });

  it("applies requested search enablement after approval", () => {
    const pending = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "用户要求开启联网搜索以补充最新来源。",
      providerLabel: "Tavily"
    });

    const updated = approvePendingConfirmationState(pending);

    expect(updated.confirmation.pending).toBeNull();
    expect(updated.search.enabled).toBe(true);
    expect(updated.search.providerLabel).toBe("Tavily");
    expect(updated.audit.summary).toBe("已开启联网搜索");
    expect(updated.audit.lastEvent.source).toBe("capability_toggle_approved");
  });

  it("requests confirmation before enabling remote api from conversation", () => {
    const updated = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "remote-api",
      enabled: true,
      source: "conversation_request",
      reason: "用户要求开启远程 API 作为高级设置兼容入口。"
    });

    expect(updated.confirmation.pending).toMatchObject({
      title: "确认开启远程 API",
      summary: "用户要求开启远程 API 作为高级设置兼容入口。",
      requiredMode: "readonly",
      requestedFeature: "remote-api",
      requestedEnabled: true
    });
    expect(updated.settings.remoteApi.enabled).toBe(false);
    expect(updated.model.remoteApiEnabled).toBe(false);
    expect(updated.audit.summary).toBe("等待用户确认能力变更");
  });

  it("applies requested remote api enablement after approval", () => {
    const pending = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "remote-api",
      enabled: true,
      source: "conversation_request",
      reason: "用户要求开启远程 API 作为高级设置兼容入口。"
    });

    const updated = approvePendingConfirmationState(pending);

    expect(updated.confirmation.pending).toBeNull();
    expect(updated.settings.remoteApi.enabled).toBe(true);
    expect(updated.model.remoteApiEnabled).toBe(true);
    expect(updated.audit.summary).toBe("已开启远程 API");
    expect(updated.audit.lastEvent.source).toBe("capability_toggle_approved");
  });

  it("tracks a pending permission mode change request", () => {
    const state = createInitialWorkbenchState();

    const updated = requestPermissionModeChangeState(state, {
      targetMode: "workspace-write",
      reason: "需要在工作区内写入修复文件。",
      riskSummary: "允许在授权工作区内创建和修改文件，但仍禁止高风险删除。"
    });

    expect(updated.permission.pendingModeChange).toMatchObject({
      targetMode: "workspace-write",
      reason: "需要在工作区内写入修复文件。",
      riskSummary: "允许在授权工作区内创建和修改文件，但仍禁止高风险删除。"
    });
    expect(updated.audit.summary).toBe("等待用户确认权限升级");
    expect(updated.audit.lastEvent.source).toBe("permission_mode_change");
    expect(updated.conversation.entries[0]).toMatchObject({
      kind: "system",
      title: "等待权限升级",
      actionLabel: "预览回退到 启动基线"
    });
  });

  it("applies an approved permission mode change", () => {
    const requested = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "需要在工作区内写入修复文件。",
      riskSummary: "允许在授权工作区内创建和修改文件，但仍禁止高风险删除。"
    });

    const updated = approvePermissionModeChangeState(requested);

    expect(updated.permission.mode).toBe("workspace-write");
    expect(updated.permission.label).toBe("工作区读写");
    expect(updated.permission.pendingModeChange).toBeNull();
    expect(updated.audit.summary).toBe("用户已批准权限升级");
    expect(updated.audit.lastEvent.source).toBe("permission_mode_change_approved");
    expect(updated.rollback.entries[0]?.label).toBe("已批准权限升级");
  });

  it("keeps the current permission mode when upgrade is cancelled", () => {
    const requested = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "controlled-full",
      reason: "需要执行受控高风险操作。",
      riskSummary: "允许受控高风险操作，但必须保留确认、日志、超时和回退。"
    });

    const updated = cancelPermissionModeChangeState(requested);

    expect(updated.permission.mode).toBe("readonly");
    expect(updated.permission.pendingModeChange).toBeNull();
    expect(updated.audit.summary).toBe("用户已取消权限升级");
    expect(updated.audit.lastEvent.source).toBe("permission_mode_change_cancelled");
  });

  it("previews rollback impact before applying a restore", () => {
    const requested = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "需要在工作区内写入修复文件。",
      riskSummary: "允许在授权工作区内创建和修改文件，但仍禁止高风险删除。"
    });
    const approved = approvePermissionModeChangeState(requested);

    const previewed = requestRollbackPreviewState(approved, "startup-baseline");

    expect(previewed.rollback.pendingPreview).toMatchObject({
      targetEntryId: "startup-baseline",
      targetLabel: "启动基线",
      willRevertCount: 1
    });
    expect(previewed.rollback.pendingPreview?.affectedEntries[0]?.label).toBe("已批准权限升级");
    expect(previewed.audit.summary).toBe("等待用户确认回退");
    expect(previewed.conversation.entries[0]).toMatchObject({
      kind: "system",
      title: "等待确认回退"
    });
  });

  it("applies rollback and restores the target snapshot", () => {
    const requested = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "需要在工作区内写入修复文件。",
      riskSummary: "允许在授权工作区内创建和修改文件，但仍禁止高风险删除。"
    });
    const approved = approvePermissionModeChangeState(requested);
    const previewed = requestRollbackPreviewState(approved, "startup-baseline");

    const restored = applyPendingRollbackState(previewed);

    expect(restored.permission.mode).toBe("readonly");
    expect(restored.rollback.pendingPreview).toBeNull();
    expect(restored.rollback.entries).toHaveLength(1);
    expect(restored.rollback.entries[0]?.id).toBe("startup-baseline");
    expect(restored.rollback.lastRollback?.targetEntryId).toBe("startup-baseline");
    expect(restored.audit.summary).toBe("已回退到 启动基线");
    expect(restored.audit.lastEvent.source).toBe("rollback_applied");
  });

  it("cancels rollback preview without mutating current permission state", () => {
    const requested = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "需要在工作区内写入修复文件。",
      riskSummary: "允许在授权工作区内创建和修改文件，但仍禁止高风险删除。"
    });
    const approved = approvePermissionModeChangeState(requested);
    const previewed = requestRollbackPreviewState(approved, "startup-baseline");

    const cancelled = cancelPendingRollbackState(previewed);

    expect(cancelled.permission.mode).toBe("workspace-write");
    expect(cancelled.rollback.pendingPreview).toBeNull();
    expect(cancelled.audit.summary).toBe("已取消回退");
    expect(cancelled.audit.lastEvent.source).toBe("rollback_cancelled");
  });

  it("records a traceable blocked command policy result", () => {
    const updated = createCommandPolicyBlockedState(createInitialWorkbenchState(), {
      summary: "命令执行被阻止",
      detail: "工作目录超出授权范围: c:/windows",
      actionLabel: "检查工作目录与权限范围",
      source: "command_policy"
    });

    expect(updated.audit.summary).toBe("命令执行被阻止");
    expect(updated.audit.lastEvent.source).toBe("command_policy");
    expect(updated.error).toMatchObject({
      module: "permission",
      summary: "命令执行被阻止",
      detail: "工作目录超出授权范围: c:/windows",
      actionLabel: "检查工作目录与权限范围",
      source: "command_policy"
    });
    expect(updated.conversation.entries[0]).toMatchObject({
      title: "命令执行被阻止",
      detailLines: ["模块: permission", "来源: command_policy", "建议: 检查工作目录与权限范围"]
    });
  });

  it("records search enablement, source metadata, and a conversation event", () => {
    const updated = createSearchEnabledState(createInitialWorkbenchState(), {
      provider: "Tavily",
      query: "OpenClaw Windows 本地助手",
      sourceTitle: "OpenClaw GitHub",
      sourceUrl: "https://github.com/example/openclaw",
      summary: "已启用联网搜索，并注入 1 条来源摘要。"
    });

    expect(updated.search.enabled).toBe(true);
    expect(updated.search.providerLabel).toBe("Tavily");
    expect(updated.sources.items[0]).toMatchObject({
      title: "OpenClaw GitHub",
      url: "https://github.com/example/openclaw",
      provider: "Tavily"
    });
    expect(updated.conversation.entries[0]).toMatchObject({
      kind: "system",
      title: "联网搜索已开启"
    });
    expect(updated.rollback.entries[0]?.label).toBe("联网搜索");
  });

  it("records a tool execution result in the tool panel and conversation feed", () => {
    const updated = createToolExecutionState(createInitialWorkbenchState(), {
      toolLabel: "Skill 扫描",
      summary: "已扫描 6 个本地 Skills，发现 1 个需要用户确认启用。",
      outputTitle: "本地 Skill 清单",
      outputSummary: "生成了最新的本地 Skill 扫描结果，可用于后续启用与审计。",
      source: "skills_scan"
    });

    expect(updated.tools.lastResult).toMatchObject({
      toolLabel: "Skill 扫描",
      summary: "已扫描 6 个本地 Skills，发现 1 个需要用户确认启用。",
      source: "skills_scan"
    });
    expect(updated.output.title).toBe("本地 Skill 清单");
    expect(updated.conversation.entries[0]).toMatchObject({
      kind: "system",
      title: "工具执行完成"
    });
    expect(updated.rollback.entries[0]?.label).toBe("工具执行结果");
  });

  it("records a tool execution error with traceable repair guidance", () => {
    const updated = createToolExecutionErrorState(createInitialWorkbenchState(), {
      toolLabel: "Skill 下载",
      summary: "Skill 下载失败",
      detail: "下载源返回 403，当前未获得联网下载授权。",
      actionLabel: "检查联网开关并重新授权后重试",
      source: "skill_download"
    });

    expect(updated.error).toMatchObject({
      module: "tools",
      summary: "Skill 下载失败",
      detail: "下载源返回 403，当前未获得联网下载授权。",
      actionLabel: "检查联网开关并重新授权后重试",
      source: "skill_download"
    });
    expect(updated.audit.summary).toBe("Skill 下载失败");
    expect(updated.tools.lastResult).toMatchObject({
      toolLabel: "Skill 下载",
      summary: "Skill 下载失败",
      source: "skill_download"
    });
    expect(updated.conversation.entries[0]).toMatchObject({
      title: "工具执行失败",
      detailLines: ["模块: tools", "来源: skill_download", "建议: 检查联网开关并重新授权后重试"]
    });
  });

  it("restores search state back to baseline after rollback", () => {
    const searched = createSearchEnabledState(createInitialWorkbenchState(), {
      provider: "Tavily",
      query: "OpenClaw Windows 本地助手",
      sourceTitle: "OpenClaw GitHub",
      sourceUrl: "https://github.com/example/openclaw",
      summary: "已启用联网搜索，并注入 1 条来源摘要。"
    });
    const previewed = requestRollbackPreviewState(searched, "startup-baseline");

    const restored = applyPendingRollbackState(previewed);

    expect(restored.search.enabled).toBe(false);
    expect(restored.search.providerLabel).toBe("");
    expect(restored.sources.items).toHaveLength(0);
  });

  it("restores tool output back to baseline after rollback", () => {
    const tooled = createToolExecutionState(createInitialWorkbenchState(), {
      toolLabel: "Skill 扫描",
      summary: "已扫描 6 个本地 Skills，发现 1 个需要用户确认启用。",
      outputTitle: "本地 Skill 清单",
      outputSummary: "生成了最新的本地 Skill 扫描结果，可用于后续启用与审计。",
      source: "skills_scan"
    });
    const previewed = requestRollbackPreviewState(tooled, "startup-baseline");

    const restored = applyPendingRollbackState(previewed);

    expect(restored.tools.lastResult).toBeNull();
    expect(restored.output.title).toBe("暂无产物");
    expect(restored.output.summary).toBe("等待工具执行结果或本地产物摘要。");
  });

  it("creates unique rollback ids for repeated searches from the same provider", () => {
    const searchedOnce = createSearchEnabledState(createInitialWorkbenchState(), {
      provider: "Tavily",
      query: "OpenClaw Windows 本地助手",
      sourceTitle: "OpenClaw GitHub",
      sourceUrl: "https://github.com/example/openclaw",
      summary: "已启用联网搜索，并注入 1 条来源摘要。"
    });
    const searchedTwice = createSearchEnabledState(searchedOnce, {
      provider: "Tavily",
      query: "OpenCow Windows 桌面端",
      sourceTitle: "OpenCow Desktop",
      sourceUrl: "https://example.com/opencow",
      summary: "已追加新的搜索来源。"
    });

    expect(searchedTwice.rollback.entries[0]?.id).not.toBe(searchedTwice.rollback.entries[1]?.id);
    expect(searchedTwice.conversation.entries[0]?.rollbackTargetId).not.toBe(
      searchedTwice.conversation.entries[1]?.rollbackTargetId
    );
  });

  it("creates unique rollback ids for repeated tool results from the same source", () => {
    const tooledOnce = createToolExecutionState(createInitialWorkbenchState(), {
      toolLabel: "Skill 扫描",
      summary: "已扫描 6 个本地 Skills，发现 1 个需要用户确认启用。",
      outputTitle: "本地 Skill 清单",
      outputSummary: "生成了最新的本地 Skill 扫描结果，可用于后续启用与审计。",
      source: "skills_scan"
    });
    const tooledTwice = createToolExecutionState(tooledOnce, {
      toolLabel: "Skill 扫描",
      summary: "已重新扫描 7 个本地 Skills。",
      outputTitle: "本地 Skill 清单",
      outputSummary: "最新扫描结果已覆盖旧产物。",
      source: "skills_scan"
    });

    expect(tooledTwice.rollback.entries[0]?.id).not.toBe(tooledTwice.rollback.entries[1]?.id);
    expect(tooledTwice.conversation.entries[0]?.rollbackTargetId).not.toBe(
      tooledTwice.conversation.entries[1]?.rollbackTargetId
    );
  });

  it("records a submitted local task in conversation, audit, and rollback", () => {
    const updated = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "请检查当前工作区并整理待办"
    });

    expect(updated.conversation.entries[0]).toMatchObject({
      title: "任务已进入本地队列",
      summary: "将优先使用本地 Ollama 处理这条任务。"
    });
    expect(updated.conversation.entries[1]).toMatchObject({
      kind: "user",
      summary: "请检查当前工作区并整理待办"
    });
    expect(updated.audit.summary).toBe("已提交 1 条本地任务");
    expect(updated.audit.lastEvent.source).toBe("composer_submit");
    expect(updated.rollback.entries[0]?.label).toBe("会话输入");
  });

  it("updates the rollback active limit within the allowed desktop range", () => {
    const updated = createRollbackLimitUpdatedState(createInitialWorkbenchState(), 16);

    expect(updated.rollback.activeLimit).toBe(16);
    expect(updated.audit.summary).toBe("已更新回退点上限");
    expect(updated.audit.lastEvent.source).toBe("rollback_limit_update");
    expect(updated.conversation.entries[0]).toMatchObject({
      title: "已更新回退点上限",
      summary: "当前最多保留 16 段可回退点。"
    });
    expect(updated.rollback.entries[0]?.label).toBe("回退点上限调整");
  });

  it("clamps the rollback active limit to the desktop maximum", () => {
    const updated = createRollbackLimitUpdatedState(createInitialWorkbenchState(), 99);

    expect(updated.rollback.activeLimit).toBe(20);
  });

  it("clamps the rollback active limit to the default minimum", () => {
    const updated = createRollbackLimitUpdatedState(createInitialWorkbenchState(), 3);

    expect(updated.rollback.activeLimit).toBe(10);
  });

  it("clears cached artifacts and records a traceable maintenance event", () => {
    const searched = createSearchEnabledState(createInitialWorkbenchState(), {
      provider: "Tavily",
      query: "OpenClaw Windows 本地助手",
      sourceTitle: "OpenClaw GitHub",
      sourceUrl: "https://github.com/example/openclaw",
      summary: "已启用联网搜索，并注入 1 条来源摘要。"
    });
    const tooled = createToolExecutionState(searched, {
      toolLabel: "Skill 扫描",
      summary: "已扫描 6 个本地 Skills，发现 1 个需要用户确认启用。",
      outputTitle: "本地 Skill 清单",
      outputSummary: "生成了最新的本地 Skill 扫描结果，可用于后续启用与审计。",
      source: "skills_scan"
    });

    const updated = createStorageCleanupState(tooled, "cache");

    expect(updated.sources.items).toHaveLength(0);
    expect(updated.tools.lastResult).toBeNull();
    expect(updated.output.title).toBe("暂无产物");
    expect(updated.storage.cacheCount).toBe(0);
    expect(updated.audit.summary).toBe("已清理本地缓存");
    expect(updated.audit.lastEvent.source).toBe("storage_cleanup_cache");
    expect(updated.conversation.entries[0]).toMatchObject({
      title: "已清理本地缓存"
    });
  });

  it("clears local maintenance buckets independently", () => {
    const initial = createInitialWorkbenchState();

    const sessionCleared = createStorageCleanupState(initial, "conversation");
    const logsCleared = createStorageCleanupState(initial, "logs");
    const snapshotsCleared = createStorageCleanupState(initial, "snapshots");
    const knowledgeCleared = createStorageCleanupState(initial, "knowledge");

    expect(sessionCleared.storage.sessionCount).toBe(0);
    expect(logsCleared.storage.logCount).toBe(0);
    expect(snapshotsCleared.storage.snapshotCount).toBe(0);
    expect(knowledgeCleared.storage.knowledgeCount).toBe(0);
  });

  it("enables remote api from advanced settings and records an audit trail", () => {
    const updated = createRemoteApiToggleState(createInitialWorkbenchState(), true);

    expect(updated.settings.remoteApi.enabled).toBe(true);
    expect(updated.model.remoteApiEnabled).toBe(true);
    expect(updated.audit.summary).toBe("已开启远程 API");
    expect(updated.audit.lastEvent.source).toBe("remote_api_toggle");
    expect(updated.conversation.entries[0]).toMatchObject({
      title: "已开启远程 API",
      summary: "远程 API 已进入高级设置可用状态，默认仍优先本地 Ollama。"
    });
  });

  it("toggles network search from advanced settings without injecting sources", () => {
    const enabled = createSearchToggleState(createInitialWorkbenchState(), {
      enabled: true,
      providerLabel: "Tavily"
    });

    expect(enabled.search.enabled).toBe(true);
    expect(enabled.search.providerLabel).toBe("Tavily");
    expect(enabled.sources.items).toHaveLength(0);
    expect(enabled.audit.summary).toBe("已开启联网搜索");
    expect(enabled.audit.lastEvent.source).toBe("search_toggle");

    const disabled = createSearchToggleState(enabled, {
      enabled: false
    });

    expect(disabled.search.enabled).toBe(false);
    expect(disabled.search.providerLabel).toBe("");
    expect(disabled.audit.summary).toBe("已关闭联网搜索");
  });

  it("updates remote api baseUrl and provider label from advanced settings", () => {
    const enabled = createRemoteApiToggleState(createInitialWorkbenchState(), true);
    const updated = createRemoteApiConfigState(enabled, {
      baseUrl: "http://127.0.0.1:8787/v1",
      providerLabel: "ccswitch",
      apiKey: "sk-opencow-local"
    });

    expect(updated.settings.remoteApi.baseUrl).toBe("http://127.0.0.1:8787/v1");
    expect(updated.settings.remoteApi.providerLabel).toBe("ccswitch");
    expect(updated.settings.remoteApi.apiKey).toBe("sk-opencow-local");
    expect(updated.audit.summary).toBe("已更新远程 API 配置");
    expect(updated.audit.lastEvent.source).toBe("remote_api_config");
    expect(updated.conversation.entries[0]).toMatchObject({
      title: "已更新远程 API 配置"
    });
  });
  it("updates search provider from advanced settings and keeps the state traceable", () => {
    const enabled = createSearchToggleState(createInitialWorkbenchState(), {
      enabled: true,
      providerLabel: "Tavily"
    });
    const updated = createSearchProviderConfigState(enabled, {
      providerLabel: "Bocha"
    });

    expect(updated.search.enabled).toBe(true);
    expect(updated.search.providerLabel).toBe("Bocha");
    expect(updated.audit.summary).toBe("已更新联网搜索提供方");
    expect(updated.audit.lastEvent.source).toBe("search_provider_config");
    expect(updated.conversation.entries[0]).toMatchObject({
      title: "已更新联网搜索提供方"
    });
  });
});

describe("capability toggle cancellation", () => {
  it("keeps search disabled when enabling search is cancelled", () => {
    const pending = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "鐢ㄦ埛瑕佹眰寮€鍚仈缃戞悳绱互琛ュ厖鏈€鏂版潵婧愩€?",
      providerLabel: "Tavily"
    });

    const updated = cancelPendingConfirmationState(pending);

    expect(updated.confirmation.pending).toBeNull();
    expect(updated.search.enabled).toBe(false);
    expect(updated.search.providerLabel).toBe("");
    expect(updated.audit.summary).not.toBe("鐢ㄦ埛宸插彇娑堥珮椋庨櫓鎿嶄綔");
    expect(updated.audit.lastEvent.source).toBe("capability_toggle_cancelled");
    expect(updated.conversation.entries[0]).toMatchObject({
      kind: "system",
      rollbackTargetId: "capability-toggle-cancelled"
    });
    expect(updated.rollback.entries[0]?.id).toBe("capability-toggle-cancelled");
  });

  it("keeps remote api disabled when enabling remote api is cancelled", () => {
    const pending = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "remote-api",
      enabled: true,
      source: "conversation_request",
      reason: "鐢ㄦ埛瑕佹眰寮€鍚繙绋?API 浣滀负楂樼骇璁剧疆鍏煎鍏ュ彛銆?"
    });

    const updated = cancelPendingConfirmationState(pending);

    expect(updated.confirmation.pending).toBeNull();
    expect(updated.settings.remoteApi.enabled).toBe(false);
    expect(updated.model.remoteApiEnabled).toBe(false);
    expect(updated.audit.summary).not.toBe("鐢ㄦ埛宸插彇娑堥珮椋庨櫓鎿嶄綔");
    expect(updated.audit.lastEvent.source).toBe("capability_toggle_cancelled");
    expect(updated.conversation.entries[0]).toMatchObject({
      kind: "system",
      rollbackTargetId: "capability-toggle-cancelled"
    });
    expect(updated.rollback.entries[0]?.id).toBe("capability-toggle-cancelled");
  });
});
