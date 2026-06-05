import { describe, expect, it } from "vitest";
import {
  applyPendingRollbackState,
  approvePendingConfirmationState,
  approvePermissionModeChangeState,
  cancelPendingRollbackState,
  cancelPendingConfirmationState,
  cancelPermissionModeChangeState,
  createCommandPolicyBlockedState,
  createInitialWorkbenchState,
  createHighRiskConfirmationState,
  createOllamaLoadErrorState,
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
  });
});
