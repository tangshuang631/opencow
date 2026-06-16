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
  createDuplicatePendingApprovalSkippedState,
  createInitialWorkbenchState,
  createHighRiskConfirmationState,
  createOllamaLoadErrorState,
  createRemoteApiConfigState,
  createRemoteApiToggleState,
  createSearchEnabledState,
  createSearchProviderConfigState,
  createTaskExecutionStartedState,
  createTaskExecutionFailedState,
  createTaskExecutionSucceededState,
  createSearchToggleState,
  createUserTaskSubmittedState,
  createRollbackLimitUpdatedState,
  createStorageCleanupState,
  createToolExecutionErrorState,
  createToolExecutionRecoveredState,
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
    expect(state.conversation.entries).toHaveLength(0);
  });

  it("keeps a safe rollback record when ollama loading throws", () => {
    const state = createInitialWorkbenchState();

    const updated = createOllamaLoadErrorState(state, "connect ECONNREFUSED 127.0.0.1:11434");

    expect(updated.error?.summary).toBe("无法连接本地 Ollama");
    expect(updated.audit.summary).toBe("Ollama 状态读取失败，工作台保持可用");
    expect(updated.rollback.entries).toHaveLength(2);
    expect(updated.rollback.entries[0]?.label).toBe("异常保护");
    expect(updated.conversation.entries).toHaveLength(0);
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

  it("keeps queued execution trace when creating a pending high-risk confirmation", () => {
    const updated = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "Confirm temp-output removal",
      summary: "Remove temp-output inside the approved workspace.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Delete temp-output only after explicit confirmation.",
      requiredMode: "controlled-full",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a controlled-full temp-output removal task.",
      queuedExecutionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
      queuedMessage: "remove the temp-output folder from this workspace"
    });
    const detail = updated.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(updated.audit.lastEvent.detail).toContain("Queued execution kind: controlled-full-remove-temp-output");
    expect(updated.audit.lastEvent.detail).toContain("Queued execution title: Remove temp-output directory");
    expect(updated.audit.lastEvent.detail).toContain(
      "Queued execution audit detail: Controlled-full shell command task: remove temp-output directory"
    );
    expect(updated.audit.lastEvent.detail).toContain("Queued message: remove the temp-output folder from this workspace");
    expect(detail).toContain("Queued execution kind: controlled-full-remove-temp-output");
    expect(detail).toContain("Queued execution title: Remove temp-output directory");
    expect(detail).toContain("Queued execution audit detail: Controlled-full shell command task: remove temp-output directory");
    expect(detail).toContain("Queued message: remove the temp-output folder from this workspace");
  });

  it("keeps pending dangerous confirmations anchored to the user message rollback point", () => {
    const updated = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "Confirm temp-output removal",
      summary: "Remove temp-output inside the approved workspace.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Delete temp-output only after explicit confirmation.",
      requiredMode: "controlled-full",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a controlled-full temp-output removal task.",
      queuedExecutionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
      queuedMessage: "remove the temp-output folder from this workspace"
    });
    const submitRollbackId = updated.rollback.entries[0]?.id;

    expect(updated.rollback.entries[0]).toMatchObject({
      label: "会话输入",
      summary: "提交高风险确认请求：remove the temp-output folder from this workspace"
    });
    expect(updated.conversation.entries[0]).toMatchObject({
      id: submitRollbackId,
      kind: "system",
      title: "等待高风险操作确认"
    });
    expect(updated.conversation.entries[1]).toMatchObject({
      id: `${submitRollbackId}-user`,
      kind: "user",
      title: "用户",
      summary: "remove the temp-output folder from this workspace"
    });
  });

  it("keeps long pending approval user anchors concise while preserving the queued message", () => {
    const longQueuedMessage =
      Array.from({ length: 50 }, (_, index) => `第${index + 1}题 这是一段需要权限确认前保留的长请求正文`).join(" ")
      + " FULL_QUEUED_MESSAGE_SENTINEL";

    const updated = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "Need workspace write access before creating temp-output.",
      riskSummary: "Allow write actions inside the approved workspace only.",
      queuedExecutionKind: "workspace-write-create-temp-output",
      queuedExecutionTitle: "Create temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output directory task.",
      queuedExecutionAuditDetail: "Workspace-write shell command task: create temp-output directory",
      queuedMessage: longQueuedMessage
    });

    const userAnchor = updated.conversation.entries.find((entry) => entry.kind === "user");
    const systemEntry = updated.conversation.entries.find((entry) => entry.kind === "system");
    const systemDetail = systemEntry?.detailLines?.join("\n") ?? "";

    expect(updated.permission.pendingModeChange?.queuedMessage).toBe(longQueuedMessage);
    expect(userAnchor?.summary).toContain("第1题 这是一段需要权限确认前保留的长请求正文");
    expect(userAnchor?.summary).toContain("...");
    expect(userAnchor?.summary).not.toContain("FULL_QUEUED_MESSAGE_SENTINEL");
    expect(updated.rollback.entries[0]?.summary).not.toContain("FULL_QUEUED_MESSAGE_SENTINEL");
    expect(systemDetail).toContain("FULL_QUEUED_MESSAGE_SENTINEL");
    expect(updated.audit.lastEvent.detail).toContain("FULL_QUEUED_MESSAGE_SENTINEL");
  });

  it("does not replace an identical pending high-risk confirmation while approval is still waiting", () => {
    const state = createInitialWorkbenchState();
    const pendingConfirmation = {
      title: "Confirm temp-output removal",
      summary: "Remove temp-output inside the approved workspace.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Delete temp-output only after explicit confirmation.",
      requiredMode: "controlled-full" as const,
      queuedExecutionKind: "controlled-full-remove-temp-output" as const,
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a controlled-full temp-output removal task.",
      queuedExecutionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
      queuedMessage: "remove the temp-output folder from this workspace"
    };

    const first = createHighRiskConfirmationState(state, pendingConfirmation);
    const repeated = createHighRiskConfirmationState(first, pendingConfirmation);

    expect(repeated).toBe(first);
    expect(repeated.confirmation.pending).toMatchObject({
      title: "Confirm temp-output removal",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedMessage: "remove the temp-output folder from this workspace"
    });
    expect(repeated.conversation.entries).toHaveLength(first.conversation.entries.length);
    expect(repeated.rollback.entries).toHaveLength(first.rollback.entries.length);
    expect(repeated.audit.lastEvent.source).toBe("permission_confirmation");
  });

  it("generates unique trace ids when a different high-risk confirmation replaces the pending request", () => {
    const firstPending = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "Confirm temp-output cleanup",
      summary: "Remove temp-output inside the approved workspace.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Delete temp-output only after explicit confirmation.",
      requiredMode: "controlled-full"
    });
    const secondPending = createHighRiskConfirmationState(firstPending, {
      title: "Confirm logs cleanup",
      summary: "Remove local logs inside the approved workspace.",
      commandPreview: "Remove-Item -LiteralPath logs -Recurse -Force",
      impact: "Delete logs only after explicit confirmation.",
      requiredMode: "controlled-full"
    });

    const pendingConversationIds = secondPending.conversation.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("dangerous-confirmation"));

    expect(pendingConversationIds).toHaveLength(2);
    expect(new Set(pendingConversationIds).size).toBe(pendingConversationIds.length);
    expect(secondPending.conversation.entries[0]?.summary).toContain("Remove local logs");
    expect(secondPending.conversation.entries[1]?.summary).toContain("Remove temp-output");
  });

  it("clears the active error when a high-risk confirmation flow begins", () => {
    const state = createOllamaLoadErrorState(createInitialWorkbenchState(), "connect ECONNREFUSED 127.0.0.1:11434");

    const updated = createHighRiskConfirmationState(state, {
      title: "Confirm temp cleanup",
      summary: "Remove temp-output inside workspace.",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "Delete 12 files after snapshot is recorded.",
      requiredMode: "controlled-full"
    });

    expect(updated.confirmation.pending?.title).toBe("Confirm temp cleanup");
    expect(updated.error).toBeNull();
  });

  it("clears a failed task error when a high-risk confirmation flow begins", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "remove the temp-output folder"
        })
      ),
      {
        summary: "本地任务执行失败",
        detail: "Controlled-full command planning failed before confirmation could be requested.",
        actionLabel: "请检查高风险确认链路后重试。",
        source: "local_task_failed_before_confirmation"
      }
    );

    const updated = createHighRiskConfirmationState(failed, {
      title: "Confirm temp cleanup",
      summary: "Remove temp-output inside workspace.",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "Delete 12 files after snapshot is recorded.",
      requiredMode: "controlled-full"
    });

    expect(updated.confirmation.pending?.title).toBe("Confirm temp cleanup");
    expect(updated.error).toBeNull();
    expect(updated.output.title).toBe("等待高风险操作确认");
    expect(updated.output.summary).toBe("高风险操作尚未执行，等待你的确认。");
  });

  it("keeps long command policy details out of default output while preserving diagnostics", () => {
    const longDetail =
      "Permission policy blocked a generated shell plan. ".repeat(12)
      + "FULL_POLICY_TRACE_SENTINEL: command, cwd, queued request, recovery path, and model intent are kept for audit.";

    const updated = createCommandPolicyBlockedState(createInitialWorkbenchState(), {
      summary: "命令已被权限策略拦截",
      detail: longDetail,
      actionLabel: "请改写为只读检查，或在确认后再执行受控命令。",
      source: "permission_policy_guard"
    });
    const conversationEntry = updated.conversation.entries[0];
    const expandedDetail = conversationEntry?.detailLines?.join("\n") ?? "";

    expect(updated.output.summary).toContain("权限策略已拦截这次操作");
    expect(updated.output.summary).toContain("详细原因已保留在日志和展开详情中");
    expect(updated.output.summary).not.toContain("FULL_POLICY_TRACE_SENTINEL");
    expect(conversationEntry?.summary).not.toContain("FULL_POLICY_TRACE_SENTINEL");
    expect(expandedDetail).toContain("FULL_POLICY_TRACE_SENTINEL");
    expect(updated.audit.lastEvent.detail).toContain("FULL_POLICY_TRACE_SENTINEL");
    expect(updated.error?.detail).toContain("FULL_POLICY_TRACE_SENTINEL");
    expect(updated.rollback.entries[0]?.summary).toContain("FULL_POLICY_TRACE_SENTINEL");
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

  it("keeps queued execution trace when approving a dangerous confirmation", () => {
    const pending = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "Confirm temp-output removal",
      summary: "Remove temp-output inside the approved workspace.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Delete temp-output only after explicit confirmation.",
      requiredMode: "controlled-full",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a controlled-full temp-output removal task.",
      queuedExecutionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
      queuedMessage: "remove the temp-output folder from this workspace"
    });

    const updated = approvePendingConfirmationState(pending);
    const detail = updated.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(updated.audit.lastEvent.detail).toContain("Queued execution kind: controlled-full-remove-temp-output");
    expect(updated.audit.lastEvent.detail).toContain("Queued execution title: Remove temp-output directory");
    expect(updated.audit.lastEvent.detail).toContain(
      "Queued execution audit detail: Controlled-full shell command task: remove temp-output directory"
    );
    expect(updated.audit.lastEvent.detail).toContain(
      "Queued message: remove the temp-output folder from this workspace"
    );
    expect(detail).toContain("Queued execution kind: controlled-full-remove-temp-output");
    expect(detail).toContain("Queued execution title: Remove temp-output directory");
    expect(detail).toContain("Queued execution audit detail: Controlled-full shell command task: remove temp-output directory");
    expect(detail).toContain("Queued message: remove the temp-output folder from this workspace");
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
    const detail = updated.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(updated.confirmation.pending).toBeNull();
    expect(updated.audit.summary).toBe("用户已取消高风险操作");
    expect(updated.audit.lastEvent.source).toBe("permission_confirmation_cancelled");
    expect(updated.output.summary).toContain("取消细节已保留在审计和展开详情中。");
    expect(updated.output.summary).not.toContain("Recovery visibility:");
    expect(updated.audit.lastEvent.detail).toContain("恢复可见性：");
    expect(detail).toContain("恢复可见性：");
    expect(updated.rollback.entries[0]?.label).toBe("已取消操作");
  });

  it("generates unique trace ids across repeated high-risk confirmation approvals", () => {
    const firstPending = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "Confirm first temp cleanup",
      summary: "Remove first temp-output directory.",
      commandPreview: "Remove-Item -LiteralPath temp-output-a -Recurse -Force",
      impact: "Delete first temp-output after rollback preview.",
      requiredMode: "controlled-full"
    });
    const firstApproved = approvePendingConfirmationState(firstPending);
    const secondPending = createHighRiskConfirmationState(firstApproved, {
      title: "Confirm second temp cleanup",
      summary: "Remove second temp-output directory.",
      commandPreview: "Remove-Item -LiteralPath temp-output-b -Recurse -Force",
      impact: "Delete second temp-output after rollback preview.",
      requiredMode: "controlled-full"
    });
    const secondApproved = approvePendingConfirmationState(secondPending);

    const approvalConversationIds = secondApproved.conversation.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("confirmation-approved"));
    const approvalRollbackIds = secondApproved.rollback.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("confirmation-approved"));

    expect(approvalConversationIds).toHaveLength(2);
    expect(new Set(approvalConversationIds).size).toBe(approvalConversationIds.length);
    expect(approvalRollbackIds).toHaveLength(2);
    expect(new Set(approvalRollbackIds).size).toBe(approvalRollbackIds.length);
  });

  it("generates unique trace ids across repeated high-risk confirmation cancellations", () => {
    const firstPending = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "Confirm first temp cleanup",
      summary: "Remove first temp-output directory.",
      commandPreview: "Remove-Item -LiteralPath temp-output-a -Recurse -Force",
      impact: "Delete first temp-output after rollback preview.",
      requiredMode: "controlled-full"
    });
    const firstCancelled = cancelPendingConfirmationState(firstPending);
    const secondPending = createHighRiskConfirmationState(firstCancelled, {
      title: "Confirm second temp cleanup",
      summary: "Remove second temp-output directory.",
      commandPreview: "Remove-Item -LiteralPath temp-output-b -Recurse -Force",
      impact: "Delete second temp-output after rollback preview.",
      requiredMode: "controlled-full"
    });
    const secondCancelled = cancelPendingConfirmationState(secondPending);

    const cancellationConversationIds = secondCancelled.conversation.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("confirmation-cancelled"));
    const cancellationRollbackIds = secondCancelled.rollback.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("confirmation-cancelled"));

    expect(cancellationConversationIds).toHaveLength(2);
    expect(new Set(cancellationConversationIds).size).toBe(cancellationConversationIds.length);
    expect(cancellationRollbackIds).toHaveLength(2);
    expect(new Set(cancellationRollbackIds).size).toBe(cancellationRollbackIds.length);
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

  it("clears a failed task error when a capability toggle confirmation begins", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "联网搜索这个问题"
        })
      ),
      {
        summary: "本地任务执行失败",
        detail: "Search capability planning failed before confirmation could be requested.",
        actionLabel: "请检查能力确认链路后重试。",
        source: "local_task_failed_before_capability_request"
      }
    );

    const updated = createCapabilityToggleRequestState(failed, {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "用户要求开启联网搜索以补充最新来源。",
      providerLabel: "Tavily"
    });

    expect(updated.confirmation.pending).toMatchObject({
      requestedFeature: "search",
      requestedEnabled: true
    });
    expect(updated.error).toBeNull();
    expect(updated.output.title).toBe("等待能力变更确认");
    expect(updated.output.summary).toBe("能力设置尚未变更，等待你的确认。");
  });

  it("keeps pending capability changes anchored to the user message rollback point", () => {
    const updated = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "用户要求开启联网搜索以补充最新来源。",
      providerLabel: "Tavily",
      queuedMessage: "联网搜索这个问题"
    });
    const submitRollbackId = updated.rollback.entries[0]?.id;

    expect(updated.rollback.entries[0]).toMatchObject({
      label: "会话输入",
      summary: "提交能力变更请求：联网搜索这个问题"
    });
    expect(updated.conversation.entries[0]).toMatchObject({
      id: submitRollbackId,
      kind: "system",
      title: "确认开启联网搜索"
    });
    expect(updated.conversation.entries[1]).toMatchObject({
      id: `${submitRollbackId}-user`,
      kind: "user",
      title: "用户",
      summary: "联网搜索这个问题"
    });
  });

  it("does not replace an identical pending capability toggle while confirmation is still waiting", () => {
    const pending = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "User requested search enablement.",
      providerLabel: "Tavily"
    });

    const updated = createCapabilityToggleRequestState(pending, {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "User requested search enablement.",
      providerLabel: "Tavily"
    });

    expect(updated).toBe(pending);
    expect(updated.conversation.entries.filter((entry) => entry.id.includes("capability-request-search-on"))).toHaveLength(1);
  });

  it("generates unique trace ids when a different capability toggle replaces the pending request", () => {
    const firstPending = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "Enable search for the current research task.",
      providerLabel: "Tavily"
    });
    const secondPending = createCapabilityToggleRequestState(firstPending, {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "Enable search for the current research task with a configured provider.",
      providerLabel: "Bocha"
    });

    const requestIds = secondPending.conversation.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("capability-request-search-on"));

    expect(requestIds).toHaveLength(2);
    expect(new Set(requestIds).size).toBe(requestIds.length);
    expect(secondPending.conversation.entries[0]?.summary).toContain("configured provider");
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

  it("generates unique trace ids across repeated capability approvals", () => {
    const firstPending = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "Enable search for task one.",
      providerLabel: "Tavily"
    });
    const firstApproved = approvePendingConfirmationState(firstPending);
    const secondPending = createCapabilityToggleRequestState(firstApproved, {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "Enable search for task two.",
      providerLabel: "Tavily"
    });
    const secondApproved = approvePendingConfirmationState(secondPending);

    const approvalConversationIds = secondApproved.conversation.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("capability-approved-search-on"));
    const approvalRollbackIds = secondApproved.rollback.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("capability-approved-search-on"));

    expect(approvalConversationIds).toHaveLength(2);
    expect(new Set(approvalConversationIds).size).toBe(approvalConversationIds.length);
    expect(approvalRollbackIds).toHaveLength(2);
    expect(new Set(approvalRollbackIds).size).toBe(approvalRollbackIds.length);
  });

  it("keeps approved search enablement unconfigured when no provider was requested", () => {
    const pending = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "User requested search enablement."
    });

    const updated = approvePendingConfirmationState(pending);

    expect(updated.confirmation.pending).toBeNull();
    expect(updated.search.enabled).toBe(true);
    expect(updated.search.providerLabel).toBe("");
    expect(updated.audit.lastEvent.source).toBe("search_provider_config_missing");
    expect(updated.error).toMatchObject({
      module: "search",
      summary: "联网搜索 Provider 未配置",
      source: "search_provider_config_missing"
    });
  });

  it("generates unique trace ids across repeated unconfigured search approvals", () => {
    const firstPending = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "Enable search without a configured provider."
    });
    const firstBlocked = approvePendingConfirmationState(firstPending);
    const secondPending = createCapabilityToggleRequestState(firstBlocked, {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "Enable search again without a configured provider."
    });
    const secondBlocked = approvePendingConfirmationState(secondPending);

    const missingProviderConversationIds = secondBlocked.conversation.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("search-provider-config-missing"));
    const missingProviderRollbackIds = secondBlocked.rollback.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("search-provider-config-missing"));

    expect(missingProviderConversationIds).toHaveLength(2);
    expect(new Set(missingProviderConversationIds).size).toBe(missingProviderConversationIds.length);
    expect(missingProviderRollbackIds).toHaveLength(2);
    expect(new Set(missingProviderRollbackIds).size).toBe(missingProviderRollbackIds.length);
    expect(secondBlocked.conversation.entries[0]?.rollbackTargetId).toBe(secondBlocked.rollback.entries[0]?.id);
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

  it("preserves queued execution metadata on a pending permission mode change", () => {
    const state = createInitialWorkbenchState();

    const updated = requestPermissionModeChangeState(state, {
      targetMode: "workspace-write",
      reason: "Need workspace write access before creating temp-output.",
      riskSummary: "Allow write actions inside the approved workspace only.",
      queuedExecutionKind: "workspace-write-create-temp-output",
      queuedExecutionTitle: "Create temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output directory task.",
      queuedExecutionAuditDetail: "Workspace-write shell command task: create temp-output directory",
      queuedMessage: "create a temp-output folder for this workspace"
    });

    expect(updated.permission.pendingModeChange).toMatchObject({
      targetMode: "workspace-write",
      queuedExecutionKind: "workspace-write-create-temp-output",
      queuedExecutionTitle: "Create temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output directory task.",
      queuedExecutionAuditDetail: "Workspace-write shell command task: create temp-output directory",
      queuedMessage: "create a temp-output folder for this workspace"
    });
    expect(updated.audit.lastEvent.detail).toContain("Need workspace write access before creating temp-output.");
    expect(updated.audit.lastEvent.detail).toContain("Allow write actions inside the approved workspace only.");
    expect(updated.audit.lastEvent.detail).toContain("Queued execution kind: workspace-write-create-temp-output");
    expect(updated.audit.lastEvent.detail).toContain("Queued execution title: Create temp-output directory");
    expect(updated.audit.lastEvent.detail).toContain(
      "Queued execution audit detail: Workspace-write shell command task: create temp-output directory"
    );
    expect(updated.audit.lastEvent.detail).toContain("Queued message: create a temp-output folder for this workspace");
    expect(updated.conversation.entries[0]?.detailLines?.join("\n")).toContain(
      "Queued execution kind: workspace-write-create-temp-output"
    );
    expect(updated.conversation.entries[0]?.detailLines?.join("\n")).toContain(
      "Queued execution title: Create temp-output directory"
    );
    expect(updated.conversation.entries[0]?.detailLines?.join("\n")).toContain(
      "Queued execution audit detail: Workspace-write shell command task: create temp-output directory"
    );
    expect(updated.conversation.entries[0]?.detailLines?.join("\n")).toContain(
      "Queued message: create a temp-output folder for this workspace"
    );
  });

  it("keeps pending permission requests anchored to the user message rollback point", () => {
    const updated = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "Need workspace write access before creating temp-output.",
      riskSummary: "Allow write actions inside the approved workspace only.",
      queuedExecutionKind: "workspace-write-create-temp-output",
      queuedExecutionTitle: "Create temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output directory task.",
      queuedExecutionAuditDetail: "Workspace-write shell command task: create temp-output directory",
      queuedMessage: "create a temp-output folder for this workspace"
    });
    const submitRollbackId = updated.rollback.entries[0]?.id;

    expect(updated.rollback.entries[0]).toMatchObject({
      label: "会话输入",
      summary: "提交权限请求：create a temp-output folder for this workspace"
    });
    expect(updated.rollback.entries[1]?.id).toBe("startup-baseline");
    expect(updated.conversation.entries[0]).toMatchObject({
      id: submitRollbackId,
      kind: "system",
      title: "等待权限升级"
    });
    expect(updated.conversation.entries[1]).toMatchObject({
      id: `${submitRollbackId}-user`,
      kind: "user",
      title: "用户",
      summary: "create a temp-output folder for this workspace"
    });
  });

  it("does not replace an identical pending permission request while approval is still waiting", () => {
    const state = createInitialWorkbenchState();
    const pendingRequest = {
      targetMode: "workspace-write" as const,
      reason: "Need workspace write access before creating temp-output.",
      riskSummary: "Allow write actions inside the approved workspace only.",
      queuedExecutionKind: "workspace-write-create-temp-output" as const,
      queuedExecutionTitle: "Create temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output directory task.",
      queuedExecutionAuditDetail: "Workspace-write shell command task: create temp-output directory",
      queuedMessage: "create a temp-output folder for this workspace"
    };

    const first = requestPermissionModeChangeState(state, pendingRequest);
    const repeated = requestPermissionModeChangeState(first, pendingRequest);

    expect(repeated).toBe(first);
    expect(repeated.permission.pendingModeChange).toMatchObject({
      targetMode: "workspace-write",
      queuedExecutionKind: "workspace-write-create-temp-output",
      queuedMessage: "create a temp-output folder for this workspace"
    });
    expect(repeated.conversation.entries).toHaveLength(first.conversation.entries.length);
    expect(repeated.rollback.entries).toHaveLength(first.rollback.entries.length);
    expect(repeated.audit.lastEvent.source).toBe("permission_mode_change");
  });

  it("generates unique trace ids when a different permission request replaces the pending request", () => {
    const firstPending = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "Need workspace write access before creating temp-output.",
      riskSummary: "Allow write actions inside the approved workspace only."
    });
    const secondPending = requestPermissionModeChangeState(firstPending, {
      targetMode: "workspace-write",
      reason: "Need workspace write access before repairing enabled-skills.json.",
      riskSummary: "Allow a single assistant-owned config repair inside the approved workspace."
    });

    const permissionRequestIds = secondPending.conversation.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("permission-request-workspace-write"));

    expect(permissionRequestIds).toHaveLength(2);
    expect(new Set(permissionRequestIds).size).toBe(permissionRequestIds.length);
    expect(secondPending.conversation.entries[0]?.summary).toContain("enabled-skills.json");
    expect(secondPending.conversation.entries[1]?.summary).toContain("temp-output");
  });

  it("clears the active error when a permission upgrade request begins", () => {
    const state = createOllamaLoadErrorState(createInitialWorkbenchState(), "connect ECONNREFUSED 127.0.0.1:11434");

    const updated = requestPermissionModeChangeState(state, {
      targetMode: "workspace-write",
      reason: "need workspace write access",
      riskSummary: "allow edits inside approved workspace only"
    });

    expect(updated.permission.pendingModeChange?.targetMode).toBe("workspace-write");
    expect(updated.error).toBeNull();
  });

  it("clears a failed task error when a permission upgrade request begins", () => {
    const failed = createTaskExecutionFailedState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "create a temp-output folder"
        })
      ),
      {
        summary: "本地任务执行失败",
        detail: "Workspace-write command planning failed before permission could be requested.",
        actionLabel: "请检查权限升级链路后重试。",
        source: "local_task_failed_before_permission_request"
      }
    );

    const updated = requestPermissionModeChangeState(failed, {
      targetMode: "workspace-write",
      reason: "need workspace write access",
      riskSummary: "allow edits inside approved workspace only"
    });

    expect(updated.permission.pendingModeChange?.targetMode).toBe("workspace-write");
    expect(updated.error).toBeNull();
    expect(updated.output.title).toBe("等待权限升级");
    expect(updated.output.summary).toBe("尚未执行提权后的操作，等待你的确认。");
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

  it("keeps queued execution trace when approving a permission upgrade", () => {
    const requested = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before creating temp-output.",
      riskSummary: "Allow a fixed workspace-local temp-output creation command only.",
      queuedExecutionKind: "workspace-write-create-temp-output",
      queuedExecutionTitle: "Create temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output directory task.",
      queuedExecutionAuditDetail: "Workspace-write shell command task: create temp-output directory",
      queuedMessage: "create a temp-output folder for this workspace"
    });

    const updated = approvePermissionModeChangeState(requested);
    const detail = updated.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(updated.audit.lastEvent.detail).toContain("Queued execution kind: workspace-write-create-temp-output");
    expect(updated.audit.lastEvent.detail).toContain("Queued execution title: Create temp-output directory");
    expect(updated.audit.lastEvent.detail).toContain(
      "Queued execution audit detail: Workspace-write shell command task: create temp-output directory"
    );
    expect(updated.audit.lastEvent.detail).toContain("Queued message: create a temp-output folder for this workspace");
    expect(detail).toContain("Queued execution kind: workspace-write-create-temp-output");
    expect(detail).toContain("Queued execution title: Create temp-output directory");
    expect(detail).toContain("Queued execution audit detail: Workspace-write shell command task: create temp-output directory");
    expect(detail).toContain("Queued message: create a temp-output folder for this workspace");
  });

  it("generates unique trace ids across repeated permission upgrade approvals", () => {
    const firstRequested = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "Need workspace write access before creating temp-output.",
      riskSummary: "Allow write actions inside the approved workspace only."
    });
    const firstApproved = approvePermissionModeChangeState(firstRequested);
    const secondRequested = requestPermissionModeChangeState(firstApproved, {
      targetMode: "controlled-full",
      reason: "Need controlled-full access before removing temp-output.",
      riskSummary: "Allow a confirmed destructive command only after rollback preview."
    });
    const secondApproved = approvePermissionModeChangeState(secondRequested);

    const approvalConversationIds = secondApproved.conversation.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("permission-approved"));
    const approvalRollbackIds = secondApproved.rollback.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("permission-mode-approved"));

    expect(approvalConversationIds).toHaveLength(2);
    expect(new Set(approvalConversationIds).size).toBe(approvalConversationIds.length);
    expect(approvalRollbackIds).toHaveLength(2);
    expect(new Set(approvalRollbackIds).size).toBe(approvalRollbackIds.length);
  });

  it("generates unique trace ids across repeated permission upgrade cancellations", () => {
    const firstRequested = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "Need workspace write access before creating temp-output.",
      riskSummary: "Allow write actions inside the approved workspace only."
    });
    const firstCancelled = cancelPermissionModeChangeState(firstRequested);
    const secondRequested = requestPermissionModeChangeState(firstCancelled, {
      targetMode: "controlled-full",
      reason: "Need controlled-full access before removing temp-output.",
      riskSummary: "Allow a confirmed destructive command only after rollback preview."
    });
    const secondCancelled = cancelPermissionModeChangeState(secondRequested);

    const cancellationConversationIds = secondCancelled.conversation.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("permission-cancelled"));
    const cancellationRollbackIds = secondCancelled.rollback.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("permission-mode-cancelled"));

    expect(cancellationConversationIds).toHaveLength(2);
    expect(new Set(cancellationConversationIds).size).toBe(cancellationConversationIds.length);
    expect(cancellationRollbackIds).toHaveLength(2);
    expect(new Set(cancellationRollbackIds).size).toBe(cancellationRollbackIds.length);
  });

  it("keeps the current permission mode when upgrade is cancelled", () => {
    const requested = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "controlled-full",
      reason: "需要执行受控高风险操作。",
      riskSummary: "允许受控高风险操作，但必须保留确认、日志、超时和回退。"
    });

    const updated = cancelPermissionModeChangeState(requested);
    const detail = updated.conversation.entries[0]?.detailLines?.join("\n") ?? "";

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

  it("applies rollback and removes conversation entries created after the target snapshot", () => {
    const firstCompleted = createTaskExecutionSucceededState(
      createTaskExecutionStartedState(
        createUserTaskSubmittedState(createInitialWorkbenchState(), {
          message: "first local request"
        })
      ),
      {
        resultTitle: "First result",
        resultSummary: "The first request completed."
      }
    );
    const targetEntryId = firstCompleted.rollback.entries[0]?.id ?? "";
    const secondSubmitted = createUserTaskSubmittedState(firstCompleted, {
      message: "second local request"
    });
    const previewed = requestRollbackPreviewState(secondSubmitted, targetEntryId);

    const restored = applyPendingRollbackState(previewed);

    const conversationText = restored.conversation.entries
      .map((entry) => `${entry.title} ${entry.summary}`)
      .join("\n");
    expect(conversationText).toContain("已回退到 本地任务执行完成");
    expect(conversationText).toContain("first local request");
    expect(conversationText).toContain("The first request completed.");
    expect(conversationText).not.toContain("second local request");
    expect(conversationText).not.toContain("等待确认回退");
  });

  it("clears pending permission approval once the queued task actually starts running", () => {
    const pendingPermission = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "Need workspace write access before creating temp-output.",
      riskSummary: "Allow write actions inside the approved workspace only."
    });
    const approved = approvePermissionModeChangeState(pendingPermission);
    const resumed = createUserTaskSubmittedState(approved, {
      message: "create a temp-output folder for this workspace",
      executionKind: "workspace-write-create-temp-output",
      executionTitle: "Create temp-output directory",
      executionAuditSummary: "Local assistant resumed the queued workspace-write temp-output task after approval.",
      executionAuditDetail: "Workspace-write shell command task: create temp-output directory",
      allowResumeFromFailedTask: true
    });

    const running = createTaskExecutionStartedState(resumed);

    expect(running.permission.pendingModeChange).toBeNull();
    expect(running.confirmation.pending).toBeNull();
    expect(running.output.title).toBe("本地任务执行中");
  });

  it("clears pending dangerous confirmation once the queued task actually starts running", () => {
    const pendingConfirmation = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "Confirm temp cleanup",
      summary: "Remove temp-output inside workspace.",
      commandPreview: "Remove-Item .\\temp-output -Recurse",
      impact: "Delete 12 files after snapshot is recorded.",
      requiredMode: "controlled-full",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant resumed the queued controlled-full temp cleanup after approval.",
      queuedExecutionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
      queuedMessage: "remove the temp-output folder from this workspace"
    });
    const approved = approvePendingConfirmationState(pendingConfirmation);
    const resumed = createUserTaskSubmittedState(approved, {
      message: "remove the temp-output folder from this workspace",
      executionKind: "controlled-full-remove-temp-output",
      executionTitle: "Remove temp-output directory",
      executionAuditSummary: "Local assistant resumed the queued controlled-full temp cleanup after approval.",
      executionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
      allowResumeFromFailedTask: true
    });

    const running = createTaskExecutionStartedState(resumed);

    expect(running.permission.pendingModeChange).toBeNull();
    expect(running.confirmation.pending).toBeNull();
    expect(running.output.title).toBe("本地任务执行中");
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
      title: "命令执行被阻止"
    });
    expect(updated.conversation.entries[0]?.summary).toContain("权限策略已拦截这次操作");
    expect(updated.conversation.entries[0]?.summary).not.toContain("c:/windows");
    expect(updated.conversation.entries[0]?.detailLines).toEqual(
      expect.arrayContaining([
        "模块: permission",
        "来源: command_policy",
        "详情: 工作目录超出授权范围: c:/windows",
        "建议: 检查工作目录与权限范围"
      ])
    );
  });

  it("increments log count for permission, confirmation, capability, and policy audit events", () => {
    const initial = createInitialWorkbenchState();
    const permissionRequested = requestPermissionModeChangeState(initial, {
      targetMode: "workspace-write",
      reason: "Need workspace write access before creating temp-output.",
      riskSummary: "Allow write actions inside the approved workspace only."
    });
    const permissionApproved = approvePermissionModeChangeState(permissionRequested);
    const permissionRequestedAgain = requestPermissionModeChangeState(permissionApproved, {
      targetMode: "controlled-full",
      reason: "Controlled full permission is required before cleanup.",
      riskSummary: "High-risk cleanup still requires confirmation."
    });
    const permissionCancelled = cancelPermissionModeChangeState(permissionRequestedAgain);
    const confirmationRequested = createHighRiskConfirmationState(permissionCancelled, {
      title: "Confirm temp-output removal",
      summary: "Remove temp-output inside the approved workspace.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Delete temp-output only after explicit confirmation.",
      requiredMode: "controlled-full"
    });
    const confirmationApproved = approvePendingConfirmationState(confirmationRequested);
    const confirmationRequestedAgain = createHighRiskConfirmationState(confirmationApproved, {
      title: "Confirm temp-output removal again",
      summary: "Remove temp-output inside the approved workspace again.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Delete temp-output only after explicit confirmation.",
      requiredMode: "controlled-full"
    });
    const confirmationCancelled = cancelPendingConfirmationState(confirmationRequestedAgain);
    const capabilityRequested = createCapabilityToggleRequestState(confirmationCancelled, {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "Enable search for this request.",
      providerLabel: "Tavily"
    });
    const capabilityApproved = approvePendingConfirmationState(capabilityRequested);
    const capabilityRequestedAgain = createCapabilityToggleRequestState(capabilityApproved, {
      feature: "remote-api",
      enabled: true,
      source: "conversation_request",
      reason: "Enable remote API for this request."
    });
    const capabilityCancelled = cancelPendingConfirmationState(capabilityRequestedAgain);
    const blocked = createCommandPolicyBlockedState(capabilityCancelled, {
      summary: "Command execution was blocked",
      detail: "Working directory escaped the approved workspace: c:/windows",
      actionLabel: "Check the working directory and permission scope before retrying.",
      source: "command_policy"
    });

    expect(permissionRequested.storage.logCount).toBeGreaterThan(initial.storage.logCount);
    expect(permissionApproved.storage.logCount).toBeGreaterThan(permissionRequested.storage.logCount);
    expect(permissionCancelled.storage.logCount).toBeGreaterThan(permissionRequestedAgain.storage.logCount);
    expect(confirmationRequested.storage.logCount).toBeGreaterThan(permissionCancelled.storage.logCount);
    expect(confirmationApproved.storage.logCount).toBeGreaterThan(confirmationRequested.storage.logCount);
    expect(confirmationCancelled.storage.logCount).toBeGreaterThan(confirmationRequestedAgain.storage.logCount);
    expect(capabilityRequested.storage.logCount).toBeGreaterThan(confirmationCancelled.storage.logCount);
    expect(capabilityApproved.storage.logCount).toBeGreaterThan(capabilityRequested.storage.logCount);
    expect(capabilityCancelled.storage.logCount).toBeGreaterThan(capabilityRequestedAgain.storage.logCount);
    expect(blocked.storage.logCount).toBeGreaterThan(capabilityCancelled.storage.logCount);
  });

  it("generates unique trace ids across repeated blocked command policy results", () => {
    const firstBlocked = createCommandPolicyBlockedState(createInitialWorkbenchState(), {
      summary: "Command execution was blocked",
      detail: "Working directory escaped the approved workspace: c:/windows",
      actionLabel: "Check the working directory and permission scope before retrying.",
      source: "command_policy"
    });
    const secondBlocked = createCommandPolicyBlockedState(firstBlocked, {
      summary: "Command execution was blocked",
      detail: "Working directory escaped the approved workspace: c:/program files",
      actionLabel: "Check the working directory and permission scope before retrying.",
      source: "command_policy"
    });

    const blockedConversationIds = secondBlocked.conversation.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("blocked-command_policy"));

    expect(blockedConversationIds).toHaveLength(2);
    expect(new Set(blockedConversationIds).size).toBe(blockedConversationIds.length);
    expect(secondBlocked.conversation.entries[0]?.summary).not.toContain("c:/program files");
    expect(secondBlocked.conversation.entries[1]?.summary).not.toContain("c:/windows");
    expect(secondBlocked.conversation.entries[0]?.detailLines?.join("\n")).toContain("c:/program files");
    expect(secondBlocked.conversation.entries[1]?.detailLines?.join("\n")).toContain("c:/windows");
  });

  it("surfaces blocked command policy results in the main output panel", () => {
    const updated = createCommandPolicyBlockedState(createInitialWorkbenchState(), {
      summary: "Command execution was blocked",
      detail: "Working directory escaped the approved workspace: c:/windows",
      actionLabel: "Check the working directory and permission scope before retrying.",
      source: "command_policy"
    });

    expect(updated.output.title).toBe("Command execution was blocked");
    expect(updated.output.summary).toContain("权限策略已拦截这次操作");
    expect(updated.output.summary).not.toContain("Working directory escaped the approved workspace: c:/windows");
    expect(updated.output.summary).toContain("Check the working directory and permission scope before retrying.");
    expect(updated.audit.lastEvent.detail).toContain("Working directory escaped the approved workspace: c:/windows");
  });

  it("keeps blocked command policy results rollback-visible", () => {
    const updated = createCommandPolicyBlockedState(createInitialWorkbenchState(), {
      summary: "Command execution was blocked",
      detail: "Working directory escaped the approved workspace: c:/windows",
      actionLabel: "Check the working directory and permission scope before retrying.",
      source: "command_policy"
    });

    expect(updated.conversation.entries[0]?.rollbackTargetId).toBe(updated.rollback.entries[0]?.id);
    expect(updated.rollback.entries[0]?.id).toContain("blocked-command_policy");
    expect(updated.rollback.entries[0]?.label).toBe("Command execution was blocked");
    expect(updated.rollback.snapshots[updated.rollback.entries[0]?.id ?? ""]).toBeDefined();
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
    expect(updated.storage.knowledgeCount).toBe(0);
    expect(updated.rollback.entries[0]?.label).toBe("联网搜索");
  });

  it("records a tool execution result in the tool panel and conversation feed", () => {
    const initial = createInitialWorkbenchState();
    const updated = createToolExecutionState(initial, {
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
    expect(updated.storage.logCount).toBeGreaterThan(initial.storage.logCount);
    expect(updated.rollback.entries[0]?.label).toBe("工具执行结果");
  });

  it("records a tool execution error with traceable repair guidance", () => {
    const initial = createInitialWorkbenchState();
    const updated = createToolExecutionErrorState(initial, {
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
    expect(updated.storage.logCount).toBeGreaterThan(initial.storage.logCount);
  });

  it("recovers from a tool execution error without losing the audit trail", () => {
    const failed = createToolExecutionErrorState(createInitialWorkbenchState(), {
      toolLabel: "RAG document parser",
      summary: "Document parsing failed",
      detail: "The selected PPTX could not be parsed.",
      actionLabel: "Try a smaller file or inspect the source document.",
      source: "rag_document_parser"
    });

    const recovered = createToolExecutionRecoveredState(failed);

    expect(recovered.error).toBeNull();
    expect(recovered.tools.lastResult).toMatchObject({
      toolLabel: "RAG document parser",
      summary: "Document parsing failed",
      source: "rag_document_parser"
    });
    expect(recovered.output.title).toBe("工具错误已处理");
    expect(recovered.output.summary).toContain("已保留 RAG document parser 的失败记录，并清除当前错误提示。");
    expect(recovered.output.summary).toContain("完整恢复建议已保留在日志和展开详情中。");
    expect(recovered.audit.lastEvent).toMatchObject({
      module: "tools",
      source: "tool_error_recovered",
      timestamp: "recovered"
    });
    expect(recovered.audit.lastEvent.detail).toContain("Previous tool error: Document parsing failed");
    expect(recovered.audit.lastEvent.detail).toContain("The selected PPTX could not be parsed.");
    expect(recovered.storage.logCount).toBeGreaterThan(failed.storage.logCount);
    expect(recovered.conversation.entries[0]).toMatchObject({
      kind: "system",
      title: "工具错误已处理",
      summary: "Document parsing failed",
      actionLabel: "预览回退到工具错误处理前"
    });
    expect(recovered.conversation.entries[0]?.rollbackTargetId).toBe(recovered.rollback.entries[0]?.id);
  });

  it("keeps tool error recovery output concise while preserving full recovery diagnostics", () => {
    const longToolDetail =
      "The selected PPTX could not be parsed. TOOL_RECOVERY_DETAIL_SENTINEL: parser stack, slide id, file path, and retry trace are kept for audit.";
    const longRecoveryHint =
      "Try a smaller file or inspect the source document. TOOL_RECOVERY_HINT_SENTINEL: long recovery checklist, parser settings, and retry plan.";
    const failed = createToolExecutionErrorState(createInitialWorkbenchState(), {
      toolLabel: "RAG document parser",
      summary: "Document parsing failed",
      detail: longToolDetail,
      actionLabel: longRecoveryHint,
      source: "rag_document_parser"
    });

    const recovered = createToolExecutionRecoveredState(failed);
    const detail = recovered.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(recovered.output.title).toBe("工具错误已处理");
    expect(recovered.output.summary).toContain("已保留 RAG document parser 的失败记录，并清除当前错误提示。");
    expect(recovered.output.summary).toContain("完整恢复建议已保留在日志和展开详情中。");
    expect(recovered.output.summary).not.toContain("TOOL_RECOVERY_DETAIL_SENTINEL");
    expect(recovered.output.summary).not.toContain("TOOL_RECOVERY_HINT_SENTINEL");
    expect(recovered.audit.lastEvent.detail).toContain("TOOL_RECOVERY_DETAIL_SENTINEL");
    expect(recovered.audit.lastEvent.detail).toContain("TOOL_RECOVERY_HINT_SENTINEL");
    expect(detail).toContain("TOOL_RECOVERY_DETAIL_SENTINEL");
    expect(detail).toContain("TOOL_RECOVERY_HINT_SENTINEL");
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
      kind: "user",
      summary: "请检查当前工作区并整理待办"
    });
    expect(updated.audit.summary).toBe("已提交本地任务");
    expect(updated.audit.lastEvent.source).toBe("composer_submit");
    expect(updated.rollback.entries[0]?.label).toBe("会话输入");
  });

  it("keeps completed local task results rollback-visible in conversation", () => {
    const queued = createUserTaskSubmittedState(createInitialWorkbenchState(), {
      message: "repair opencow enabled skills registry"
    });
    const running = createTaskExecutionStartedState(queued);
    const completed = createTaskExecutionSucceededState(running, {
      resultTitle: "Repair opencow enabled skills registry",
      resultSummary: "Self-repair completed and verified."
    });
    const rollbackEntryId = completed.rollback.entries[0]?.id;

    expect(completed.conversation.entries[0]).toMatchObject({
      kind: "assistant",
      title: "Repair opencow enabled skills registry",
      summary: "Self-repair completed and verified.",
      actionLabel: "预览回退到本次任务执行前",
      rollbackTargetId: rollbackEntryId
    });
    expect(rollbackEntryId).toContain(`${running.tasks.activeTaskId}-completed`);
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

  it("keeps search enabled but unconfigured when no provider is supplied", () => {
    const enabled = createSearchToggleState(createInitialWorkbenchState(), {
      enabled: true,
      providerLabel: "   "
    });

    expect(enabled.search.enabled).toBe(true);
    expect(enabled.search.providerLabel).toBe("");
    expect(enabled.sources.items).toHaveLength(0);
    expect(enabled.audit.lastEvent.source).toBe("search_provider_config_missing");
    expect(enabled.error).toMatchObject({
      module: "search",
      summary: "联网搜索 Provider 未配置",
      source: "search_provider_config_missing"
    });
  });

  it("keeps missing search provider enablement rollback-visible through its own trace id", () => {
    const enabled = createSearchToggleState(createInitialWorkbenchState(), {
      enabled: true,
      providerLabel: "   "
    });

    expect(enabled.conversation.entries[0]?.id).toContain("search-provider-config-missing");
    expect(enabled.rollback.entries[0]?.id).toBe(enabled.conversation.entries[0]?.id);
    expect(enabled.conversation.entries[0]?.rollbackTargetId).toBe(enabled.rollback.entries[0]?.id);
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

  it("keeps an empty search provider visibly unconfigured with repair guidance", () => {
    const enabled = createSearchToggleState(createInitialWorkbenchState(), {
      enabled: true,
      providerLabel: "Tavily"
    });
    const updated = createSearchProviderConfigState(enabled, {
      providerLabel: "   "
    });

    expect(updated.search.enabled).toBe(true);
    expect(updated.search.providerLabel).toBe("");
    expect(updated.audit.lastEvent.source).toBe("search_provider_config_missing");
    expect(updated.error).toMatchObject({
      module: "search",
      summary: "联网搜索 Provider 未配置",
      source: "search_provider_config_missing"
    });
    expect(updated.error?.detail).toContain("联网搜索 Provider 未配置");
    expect(updated.error?.actionLabel).toContain("前往设置配置联网搜索 Provider");
    expect(updated.conversation.entries[0]?.title).toBe("联网搜索 Provider 未配置");
    expect(updated.conversation.entries[0]?.summary).toContain("已跳过实时联网检索");
  });

  it("keeps empty search provider config rollback-visible through its own trace id", () => {
    const enabled = createSearchToggleState(createInitialWorkbenchState(), {
      enabled: true,
      providerLabel: "Tavily"
    });
    const updated = createSearchProviderConfigState(enabled, {
      providerLabel: "   "
    });

    expect(updated.conversation.entries[0]?.id).toContain("search-provider-config-missing");
    expect(updated.rollback.entries[0]?.id).toBe(updated.conversation.entries[0]?.id);
    expect(updated.conversation.entries[0]?.rollbackTargetId).toBe(updated.rollback.entries[0]?.id);
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
      kind: "system"
    });
    expect(updated.conversation.entries[0]?.rollbackTargetId).toBe(updated.rollback.entries[0]?.id);
    expect(updated.rollback.entries[0]?.id).toContain("capability-toggle-cancelled");
    expect(updated.output.summary).toContain("Capability change was cancelled");
    expect(updated.output.summary).toContain("Current capability state was preserved");
    expect(updated.audit.lastEvent.detail).toContain("能力变更已取消");
    expect(updated.audit.lastEvent.detail).toContain("当前能力状态保持不变");
    expect(updated.audit.lastEvent.detail).toContain("已取消请求：");
    expect(updated.audit.lastEvent.detail).toContain("能力：search");
    expect(updated.audit.lastEvent.detail).toContain("请求启用：true");
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
      kind: "system"
    });
    expect(updated.conversation.entries[0]?.rollbackTargetId).toBe(updated.rollback.entries[0]?.id);
    expect(updated.rollback.entries[0]?.id).toContain("capability-toggle-cancelled");
    expect(updated.output.summary).toContain("Capability change was cancelled");
    expect(updated.output.summary).toContain("Current capability state was preserved");
    expect(updated.audit.lastEvent.detail).toContain("能力变更已取消");
    expect(updated.audit.lastEvent.detail).toContain("当前能力状态保持不变");
    expect(updated.audit.lastEvent.detail).toContain("已取消请求：");
    expect(updated.audit.lastEvent.detail).toContain("能力：remote-api");
    expect(updated.audit.lastEvent.detail).toContain("请求启用：true");
  });

  it("generates unique trace ids across repeated capability cancellations", () => {
    const firstPending = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "Enable search for task one.",
      providerLabel: "Tavily"
    });
    const firstCancelled = cancelPendingConfirmationState(firstPending);
    const secondPending = createCapabilityToggleRequestState(firstCancelled, {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "Enable search for task two.",
      providerLabel: "Tavily"
    });
    const secondCancelled = cancelPendingConfirmationState(secondPending);

    const cancellationConversationIds = secondCancelled.conversation.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("capability-cancelled-search"));
    const cancellationRollbackIds = secondCancelled.rollback.entries
      .map((entry) => entry.id)
      .filter((id) => id.includes("capability-toggle-cancelled"));

    expect(cancellationConversationIds).toHaveLength(2);
    expect(new Set(cancellationConversationIds).size).toBe(cancellationConversationIds.length);
    expect(cancellationRollbackIds).toHaveLength(2);
    expect(new Set(cancellationRollbackIds).size).toBe(cancellationRollbackIds.length);
  });

  it("explains how to recover after cancelling a capability toggle", () => {
    const pending = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "Enable search for this request.",
      providerLabel: "Tavily"
    });

    const updated = cancelPendingConfirmationState(pending);
    const detail = updated.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(updated.output.summary).toContain("Capability change was cancelled");
    expect(updated.output.summary).toContain("Current capability state was preserved");
    expect(updated.output.summary).toContain("取消细节已保留在审计和展开详情中。");
    expect(updated.output.summary).not.toContain("Recovery visibility:");
    expect(updated.audit.lastEvent.detail).toContain("恢复可见性：");
    expect(detail).toContain("恢复可见性：");
  });
});

describe("duplicate pending approval trace output", () => {
  it("keeps queued execution trace when skipping a duplicate pending permission request", () => {
    const pending = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before creating temp-output.",
      riskSummary: "Allow a fixed workspace-local temp-output creation command only.",
      queuedExecutionKind: "workspace-write-create-temp-output",
      queuedExecutionTitle: "Create temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output directory task.",
      queuedExecutionAuditDetail: "Workspace-write shell command task: create temp-output directory",
      queuedMessage: "create a temp-output folder for this workspace"
    });

    const skipped = createDuplicatePendingApprovalSkippedState(pending, {
      approvalType: "permission",
      message: "create a temp-output folder for this workspace"
    });
    const detail = skipped.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(skipped.audit.lastEvent.detail).toContain("Queued execution kind: workspace-write-create-temp-output");
    expect(skipped.audit.lastEvent.detail).toContain("Queued execution title: Create temp-output directory");
    expect(skipped.audit.lastEvent.detail).toContain(
      "Queued execution audit detail: Workspace-write shell command task: create temp-output directory"
    );
    expect(skipped.audit.lastEvent.detail).toContain("Queued message: create a temp-output folder for this workspace");
    expect(detail).toContain("Queued execution kind: workspace-write-create-temp-output");
    expect(detail).toContain("Queued execution title: Create temp-output directory");
    expect(detail).toContain("Queued execution audit detail: Workspace-write shell command task: create temp-output directory");
    expect(detail).toContain("Queued message: create a temp-output folder for this workspace");
    expect(detail).toContain("审批类型: permission");
    expect(skipped.output.summary).toContain("已有审批正在等待处理，已跳过这次重复请求。");
    expect(skipped.output.summary).not.toContain("Queued execution kind:");
    expect(skipped.output.summary).not.toContain("Queued execution audit detail:");
    expect(skipped.output.summary).not.toContain("Queued message:");
    expect(skipped.output.title).toBe("重复审批请求已跳过");
    expect(skipped.conversation.entries[0]?.title).toBe("重复审批请求已跳过");
    expect(skipped.audit.summary).toBe("重复审批请求已跳过");
    expect(skipped.rollback.entries[0]?.label).toBe("重复审批请求已跳过");
    expect(skipped.conversation.entries[0]?.rollbackTargetId).toBe(skipped.rollback.entries[0]?.id);
    expect(skipped.audit.lastEvent.detail).toContain("恢复可见性：");
    expect(detail).toContain("恢复可见性：");
  });

  it("keeps queued execution trace when skipping a duplicate pending dangerous confirmation", () => {
    const pending = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "Confirm temp-output removal",
      summary: "Remove temp-output inside the approved workspace.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Delete temp-output only after explicit confirmation.",
      requiredMode: "controlled-full",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a controlled-full temp-output removal task.",
      queuedExecutionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
      queuedMessage: "remove the temp-output folder from this workspace"
    });

    const skipped = createDuplicatePendingApprovalSkippedState(pending, {
      approvalType: "dangerous-confirmation",
      message: "remove the temp-output folder from this workspace"
    });
    const detail = skipped.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(skipped.audit.lastEvent.detail).toContain("Queued execution kind: controlled-full-remove-temp-output");
    expect(skipped.audit.lastEvent.detail).toContain("Queued execution title: Remove temp-output directory");
    expect(skipped.audit.lastEvent.detail).toContain(
      "Queued execution audit detail: Controlled-full shell command task: remove temp-output directory"
    );
    expect(skipped.audit.lastEvent.detail).toContain("Queued message: remove the temp-output folder from this workspace");
    expect(detail).toContain("Queued execution kind: controlled-full-remove-temp-output");
    expect(detail).toContain("Queued execution title: Remove temp-output directory");
    expect(detail).toContain("Queued execution audit detail: Controlled-full shell command task: remove temp-output directory");
    expect(detail).toContain("Queued message: remove the temp-output folder from this workspace");
    expect(detail).toContain("审批类型: dangerous-confirmation");
    expect(skipped.output.summary).toContain("已有审批正在等待处理，已跳过这次重复请求。");
    expect(skipped.output.summary).not.toContain("Queued execution kind:");
    expect(skipped.output.summary).not.toContain("Queued execution audit detail:");
    expect(skipped.output.summary).not.toContain("Queued message:");
  });

  it("keeps capability context when skipping a duplicate pending capability confirmation", () => {
    const pending = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "Enable search for this request.",
      providerLabel: "Tavily",
      queuedMessage: "web search latest docs"
    });

    const skipped = createDuplicatePendingApprovalSkippedState(pending, {
      approvalType: "capability",
      message: "web search latest docs"
    });
    const detail = skipped.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(skipped.audit.lastEvent.detail).toContain("Capability: search");
    expect(skipped.audit.lastEvent.detail).toContain("Requested enabled: true");
    expect(skipped.audit.lastEvent.detail).toContain("Provider/configuration: Tavily");
    expect(skipped.audit.lastEvent.detail).toContain("Queued message: web search latest docs");
    expect(detail).toContain("Capability: search");
    expect(detail).toContain("Requested enabled: true");
    expect(detail).toContain("Provider/configuration: Tavily");
    expect(detail).toContain("Queued message: web search latest docs");
    expect(detail).toContain("审批类型: capability");
    expect(skipped.output.summary).toContain("已有审批正在等待处理，已跳过这次重复请求。");
    expect(skipped.output.summary).not.toContain("Capability: search");
    expect(skipped.output.summary).not.toContain("Provider/configuration:");
    expect(skipped.output.summary).not.toContain("Queued message:");
  });
});

describe("permission cancellation recovery output", () => {
  it("clears stale errors when cancelling pending approval flows", () => {
    const staleError = createOllamaLoadErrorState(createInitialWorkbenchState(), "connect ECONNREFUSED 127.0.0.1:11434").error;
    const dangerousPending = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "Confirm temp-output removal",
      summary: "Remove temp-output inside the approved workspace.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Delete temp-output only after explicit confirmation.",
      requiredMode: "controlled-full"
    });
    const permissionPending = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before creating temp-output.",
      riskSummary: "Allow a fixed workspace-local temp-output creation command only."
    });
    const capabilityPending = createCapabilityToggleRequestState(createInitialWorkbenchState(), {
      feature: "search",
      enabled: true,
      source: "conversation_request",
      reason: "User requested network search.",
      providerLabel: "Tavily"
    });

    expect(cancelPendingConfirmationState({ ...dangerousPending, error: staleError }).error).toBeNull();
    expect(cancelPermissionModeChangeState({ ...permissionPending, error: staleError }).error).toBeNull();
    expect(cancelPendingConfirmationState({ ...capabilityPending, error: staleError }).error).toBeNull();
  });

  it("explains how to recover after cancelling a dangerous confirmation", () => {
    const pending = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "Confirm temp-output removal",
      summary: "Remove temp-output inside the approved workspace.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Delete temp-output only after explicit confirmation.",
      requiredMode: "controlled-full"
    });

    const updated = cancelPendingConfirmationState(pending);

    expect(updated.output.summary).toContain("未执行任何命令");
    expect(updated.output.summary).toContain("改写请求");
    expect(updated.output.summary).toContain("重新预览安全步骤");
    expect(updated.output.summary).toContain("取消细节已保留在审计和展开详情中。");
    expect(updated.output.summary).not.toContain("Recovery visibility:");
    expect(updated.audit.lastEvent.detail).toContain("未执行任何命令");
    expect(updated.audit.lastEvent.detail).toContain("Remove-Item -LiteralPath temp-output -Recurse -Force");
    expect(updated.audit.lastEvent.detail).toContain("所需权限：controlled-full");
    expect(updated.audit.lastEvent.detail).toContain("改写请求");
  });

  it("keeps queued execution trace when cancelling a dangerous confirmation", () => {
    const pending = createHighRiskConfirmationState(createInitialWorkbenchState(), {
      title: "Confirm temp-output removal",
      summary: "Remove temp-output inside the approved workspace.",
      commandPreview: "Remove-Item -LiteralPath temp-output -Recurse -Force",
      impact: "Delete temp-output only after explicit confirmation.",
      requiredMode: "controlled-full",
      queuedExecutionKind: "controlled-full-remove-temp-output",
      queuedExecutionTitle: "Remove temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a controlled-full temp-output removal task.",
      queuedExecutionAuditDetail: "Controlled-full shell command task: remove temp-output directory",
      queuedMessage: "remove the temp-output folder from this workspace"
    });

    const updated = cancelPendingConfirmationState(pending);
    const detail = updated.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(updated.audit.lastEvent.detail).toContain("Queued execution kind: controlled-full-remove-temp-output");
    expect(updated.audit.lastEvent.detail).toContain("Queued execution title: Remove temp-output directory");
    expect(updated.audit.lastEvent.detail).toContain(
      "Queued execution audit detail: Controlled-full shell command task: remove temp-output directory"
    );
    expect(updated.audit.lastEvent.detail).toContain(
      "Queued message: remove the temp-output folder from this workspace"
    );
    expect(detail).toContain("Queued execution kind: controlled-full-remove-temp-output");
    expect(detail).toContain("Queued execution title: Remove temp-output directory");
    expect(detail).toContain("Queued execution audit detail: Controlled-full shell command task: remove temp-output directory");
    expect(detail).toContain("Queued message: remove the temp-output folder from this workspace");
  });

  it("explains how to recover after cancelling a permission upgrade", () => {
    const requested = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before creating temp-output.",
      riskSummary: "Allow a fixed workspace-local temp-output creation command only."
    });

    const updated = cancelPermissionModeChangeState(requested);
    const detail = updated.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(updated.output.summary).toContain("权限模式没有改变");
    expect(updated.output.summary).toContain("发送更窄的请求");
    expect(updated.output.summary).toContain("再次明确申请提权");
    expect(updated.audit.lastEvent.detail).toContain("权限模式没有改变");
    expect(updated.audit.lastEvent.detail).toContain("目标权限：workspace-write");
    expect(updated.audit.lastEvent.detail).toContain("Workspace write permission is required before creating temp-output.");
    expect(updated.audit.lastEvent.detail).toContain("再次明确申请提权");
    expect(updated.output.summary).toContain("取消细节已保留在审计和展开详情中。");
    expect(updated.output.summary).not.toContain("Recovery visibility:");
    expect(updated.audit.lastEvent.detail).toContain("恢复可见性：");
    expect(detail).toContain("恢复可见性：");
  });

  it("keeps queued execution trace when cancelling a permission upgrade", () => {
    const requested = requestPermissionModeChangeState(createInitialWorkbenchState(), {
      targetMode: "workspace-write",
      reason: "Workspace write permission is required before creating temp-output.",
      riskSummary: "Allow a fixed workspace-local temp-output creation command only.",
      queuedExecutionKind: "workspace-write-create-temp-output",
      queuedExecutionTitle: "Create temp-output directory",
      queuedExecutionAuditSummary: "Local assistant planned a workspace-write temp-output directory task.",
      queuedExecutionAuditDetail: "Workspace-write shell command task: create temp-output directory",
      queuedMessage: "create a temp-output folder for this workspace"
    });

    const updated = cancelPermissionModeChangeState(requested);
    const detail = updated.conversation.entries[0]?.detailLines?.join("\n") ?? "";

    expect(updated.audit.lastEvent.detail).toContain("Queued execution kind: workspace-write-create-temp-output");
    expect(updated.audit.lastEvent.detail).toContain("Queued execution title: Create temp-output directory");
    expect(updated.audit.lastEvent.detail).toContain(
      "Queued execution audit detail: Workspace-write shell command task: create temp-output directory"
    );
    expect(updated.audit.lastEvent.detail).toContain("Queued message: create a temp-output folder for this workspace");
    expect(detail).toContain("Queued execution kind: workspace-write-create-temp-output");
    expect(detail).toContain("Queued execution title: Create temp-output directory");
    expect(detail).toContain("Queued execution audit detail: Workspace-write shell command task: create temp-output directory");
    expect(detail).toContain("Queued message: create a temp-output folder for this workspace");
  });
});
