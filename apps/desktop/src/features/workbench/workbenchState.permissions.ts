import { recordRollbackEntry } from "./workbenchState.rollback";
import { createWorkbenchEventId, getPermissionPresentation, prependConversationEntry } from "./workbenchState.shared";
import { withStorageDelta } from "./workbenchState.storage";
import type {
  PendingConfirmation,
  PendingPermissionModeChange,
  WorkbenchState
} from "./workbenchState.types";

type CapabilityToggleRequest = {
  feature: "search" | "remote-api";
  enabled: boolean;
  source: string;
  reason: string;
  providerLabel?: string;
  queuedMessage?: string;
};

const DANGEROUS_CONFIRMATION_CANCELLED_SUMMARY =
  "未执行任何命令。你可以改写请求、先要一个只读说明，或重新预览安全步骤后再决定是否批准变更。";

const PERMISSION_UPGRADE_CANCELLED_SUMMARY =
  "权限模式没有改变。你可以发送更窄的请求、先要一个只读预览，或在确认意图后再次明确申请提权。";

const DANGEROUS_CONFIRMATION_CANCELLED_RECOVERY =
  "恢复可见性：本次已取消的高风险确认可以预览回退；审计记录保留已取消请求、命令预览、所需权限和排队执行轨迹。";

const PERMISSION_UPGRADE_CANCELLED_RECOVERY =
  "恢复可见性：本次已取消的提权请求可以预览回退；审计记录保留目标权限、风险摘要和排队执行轨迹。";

const CAPABILITY_TOGGLE_CANCELLED_RECOVERY =
  "恢复可见性：本次已取消的能力变更可以预览回退；审计记录保留能力类型、请求状态、提供方/配置上下文和排队执行轨迹。";

const CANCELLATION_DETAILS_COLLAPSED_SUMMARY =
  "取消细节已保留在审计和展开详情中。";

const COMMAND_POLICY_BLOCKED_VISIBLE_SUMMARY =
  "权限策略已拦截这次操作，未执行任何命令。详细原因已保留在日志和展开详情中。";

const PENDING_APPROVAL_MESSAGE_PREVIEW_LIMIT = 140;

function createPendingApprovalMessagePreview(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();

  if (normalized.length <= PENDING_APPROVAL_MESSAGE_PREVIEW_LIMIT) {
    return normalized;
  }

  return `${normalized.slice(0, PENDING_APPROVAL_MESSAGE_PREVIEW_LIMIT).trim()}...`;
}

function createQueuedExecutionTraceLines(payload: {
  queuedExecutionKind?: string;
  queuedExecutionTitle?: string;
  queuedExecutionAuditSummary?: string;
  queuedExecutionAuditDetail?: string;
  queuedMessage?: string;
}): string[] {
  return [
    payload.queuedExecutionKind ? `Queued execution kind: ${payload.queuedExecutionKind}` : null,
    payload.queuedExecutionTitle ? `Queued execution title: ${payload.queuedExecutionTitle}` : null,
    payload.queuedExecutionAuditSummary ? `Queued execution audit summary: ${payload.queuedExecutionAuditSummary}` : null,
    payload.queuedExecutionAuditDetail ? `Queued execution audit detail: ${payload.queuedExecutionAuditDetail}` : null,
    payload.queuedMessage ? `Queued message: ${payload.queuedMessage}` : null
  ].filter((line): line is string => line !== null);
}

function appendQueuedExecutionTrace(detail: string, traceLines: string[]): string {
  return traceLines.length > 0 ? `${detail} ${traceLines.join(" ")}` : detail;
}

function withPermissionAuditLog(state: WorkbenchState): WorkbenchState {
  return withStorageDelta(state, {
    logCount: state.storage.logCount + 1
  });
}

function createPendingApprovalConversationEntries(
  state: WorkbenchState,
  requestId: string,
  systemEntry: WorkbenchState["conversation"]["entries"][number],
  queuedMessage: string | undefined
): WorkbenchState["conversation"]["entries"] {
  const normalizedQueuedMessage = queuedMessage?.trim();

  if (!normalizedQueuedMessage) {
    return prependConversationEntry(state.conversation.entries, systemEntry);
  }

  return prependConversationEntry(
    prependConversationEntry(state.conversation.entries, {
      id: `${requestId}-user`,
      kind: "user",
      title: "用户",
      summary: createPendingApprovalMessagePreview(normalizedQueuedMessage)
    }),
    systemEntry
  );
}

function recordPendingApprovalUserMessageAnchor(
  state: WorkbenchState,
  requestId: string,
  queuedMessage: string | undefined,
  summaryPrefix: string
): WorkbenchState {
  const normalizedQueuedMessage = queuedMessage?.trim();

  if (!normalizedQueuedMessage) {
    return state;
  }

  return recordRollbackEntry(
    withStorageDelta(state, {
      sessionCount: state.storage.sessionCount + 1
    }),
    requestId,
    "会话输入",
    `${summaryPrefix}：${createPendingApprovalMessagePreview(normalizedQueuedMessage)}`,
    "session"
  );
}

function isSamePendingPermissionModeChange(
  current: PendingPermissionModeChange | null,
  next: PendingPermissionModeChange
): boolean {
  return Boolean(
    current
      && current.targetMode === next.targetMode
      && current.reason === next.reason
      && current.riskSummary === next.riskSummary
      && current.queuedExecutionKind === next.queuedExecutionKind
      && current.queuedExecutionTitle === next.queuedExecutionTitle
      && current.queuedExecutionAuditSummary === next.queuedExecutionAuditSummary
      && current.queuedExecutionAuditDetail === next.queuedExecutionAuditDetail
      && current.queuedMessage === next.queuedMessage
  );
}

function isSamePendingConfirmation(current: PendingConfirmation | null, next: PendingConfirmation): boolean {
  return Boolean(
    current
      && current.title === next.title
      && current.summary === next.summary
      && current.commandPreview === next.commandPreview
      && current.impact === next.impact
      && current.requiredMode === next.requiredMode
      && current.safetySummary === next.safetySummary
      && current.requestedFeature === next.requestedFeature
      && current.requestedEnabled === next.requestedEnabled
      && current.providerLabel === next.providerLabel
      && current.queuedExecutionKind === next.queuedExecutionKind
      && current.queuedExecutionTitle === next.queuedExecutionTitle
      && current.queuedExecutionAuditSummary === next.queuedExecutionAuditSummary
      && current.queuedExecutionAuditDetail === next.queuedExecutionAuditDetail
      && current.queuedMessage === next.queuedMessage
  );
}

export function createCommandPolicyBlockedState(
  state: WorkbenchState,
  payload: {
    summary: string;
    detail: string;
    actionLabel: string;
    source: string;
  }
): WorkbenchState {
  const blockedConversationId = createWorkbenchEventId(state, "blocked", payload.source);

  const blockedState: WorkbenchState = withPermissionAuditLog({
    ...state,
    output: {
      title: payload.summary,
      summary: `${COMMAND_POLICY_BLOCKED_VISIBLE_SUMMARY} ${payload.actionLabel}`
    },
    conversation: {
      entries: prependConversationEntry(state.conversation.entries, {
        id: blockedConversationId,
        kind: "system",
        title: payload.summary,
        summary: COMMAND_POLICY_BLOCKED_VISIBLE_SUMMARY,
        actionLabel: `预览回退到 ${blockedConversationId}`,
        rollbackTargetId: blockedConversationId,
        detailLines: [
          "模块: permission",
          `来源: ${payload.source}`,
          `详情: ${payload.detail}`,
          `建议: ${payload.actionLabel}`
        ]
      })
    },
    audit: {
      summary: payload.summary,
      lastEvent: {
        module: "permission",
        detail: payload.detail,
        timestamp: "策略拦截",
        source: payload.source
      }
    },
    error: {
      module: "permission",
      summary: payload.summary,
      detail: payload.detail,
      actionLabel: payload.actionLabel,
      timestamp: "策略拦截",
      source: payload.source
    }
  });

  return recordRollbackEntry(
    blockedState,
    blockedConversationId,
    payload.summary,
    payload.detail,
    "tool"
  );
}

export function createDuplicatePendingApprovalSkippedState(
  state: WorkbenchState,
  payload: {
    approvalType: "permission" | "dangerous-confirmation" | "capability";
    message: string;
  }
): WorkbenchState {
  const duplicateId = createWorkbenchEventId(state, "duplicate-pending-approval", payload.approvalType);
  const waitingLabel =
    payload.approvalType === "permission"
      ? "already waiting for permission approval"
      : payload.approvalType === "dangerous-confirmation"
      ? "already waiting for dangerous confirmation"
      : "already waiting for capability confirmation";
  const detail =
    `The same request is ${waitingLabel}; no new task was queued and no command was executed. ` +
    `Pending request: ${payload.message}`;
  const pendingApproval =
    payload.approvalType === "permission"
      ? state.permission.pendingModeChange ?? {}
      : state.confirmation.pending ?? {};
  const queuedTraceLines = createQueuedExecutionTraceLines(pendingApproval);
  const capabilityTraceLines =
    payload.approvalType === "capability" && state.confirmation.pending?.requestedFeature
      ? [
          `Capability: ${state.confirmation.pending.requestedFeature}`,
          `Requested enabled: ${state.confirmation.pending.requestedEnabled ?? false}`,
          `Provider/configuration: ${state.confirmation.pending.providerLabel?.trim() || "not configured"}`
        ]
      : [];
  const traceLines = [...capabilityTraceLines, ...queuedTraceLines];
  const recoveryVisibility =
    `恢复可见性：本次重复审批跳过可以预览回退；回退快照 id: ${duplicateId}。` +
    "恢复可见性：审计记录保留被跳过的请求和排队审批轨迹。";
  const tracedDetail = appendQueuedExecutionTrace(`${detail} ${recoveryVisibility}`, traceLines);
  const visibleTitle = "重复审批请求已跳过";
  const visibleSummary = "已有审批正在等待处理，已跳过这次重复请求。";

  return recordRollbackEntry(
    withPermissionAuditLog({
      ...state,
      output: {
        title: visibleTitle,
        summary: visibleSummary
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: duplicateId,
          kind: "system",
          title: visibleTitle,
          summary: visibleSummary,
          actionLabel: "预览回退到本次重复待审批请求跳过前",
          rollbackTargetId: duplicateId,
          detailLines: [
            "Module: permission",
            "Source: duplicate_pending_approval_skipped",
            `审批类型: ${payload.approvalType}`,
            "建议: 请先批准或取消当前等待中的审批，再提交同一个请求。",
            recoveryVisibility,
            ...traceLines
          ]
        })
      },
      audit: {
        summary: visibleTitle,
        lastEvent: {
          module: "permission",
          detail: tracedDetail,
          timestamp: "skipped",
          source: "duplicate_pending_approval_skipped"
        }
      }
    }),
    duplicateId,
    visibleTitle,
    tracedDetail,
    "permission"
  );
}

export function createHighRiskConfirmationState(
  state: WorkbenchState,
  pending: PendingConfirmation
): WorkbenchState {
  if (isSamePendingConfirmation(state.confirmation.pending, pending)) {
    return state;
  }

  const confirmationRequestId = createWorkbenchEventId(state, "dangerous-confirmation", "pending");
  const queuedTraceLines = createQueuedExecutionTraceLines(pending);

  const nextState: WorkbenchState = withPermissionAuditLog({
    ...state,
    confirmation: {
      pending
    },
    output: {
      title: "等待高风险操作确认",
      summary: "高风险操作尚未执行，等待你的确认。"
    },
    conversation: {
      entries: createPendingApprovalConversationEntries(state, confirmationRequestId, {
        id: confirmationRequestId,
        kind: "system",
        title: "等待高风险操作确认",
        summary: pending.summary,
        actionLabel: "预览回退到 启动基线",
        rollbackTargetId: "startup-baseline",
        detailLines: queuedTraceLines
      }, pending.queuedMessage)
    },
    audit: {
      summary: "等待用户确认高风险操作",
      lastEvent: {
        module: "permission",
        detail: appendQueuedExecutionTrace(pending.summary, queuedTraceLines),
        timestamp: "待用户确认",
        source: "permission_confirmation"
      }
    },
    error: null
  });

  return recordPendingApprovalUserMessageAnchor(
    nextState,
    confirmationRequestId,
    pending.queuedMessage,
    "提交高风险确认请求"
  );
}

export function createCapabilityToggleRequestState(
  state: WorkbenchState,
  payload: CapabilityToggleRequest
): WorkbenchState {
  const currentPending = state.confirmation.pending;

  if (
    currentPending?.requestedFeature === payload.feature
    && currentPending.requestedEnabled === payload.enabled
    && currentPending.summary === payload.reason
    && currentPending.providerLabel === payload.providerLabel
    && currentPending.queuedMessage === payload.queuedMessage
  ) {
    return state;
  }

  const featureLabel = payload.feature === "search" ? "联网搜索" : "远程 API";
  const title = `${payload.enabled ? "确认开启" : "确认关闭"}${featureLabel}`;
  const capabilityRequestId = createWorkbenchEventId(
    state,
    "capability-request",
    `${payload.feature}-${payload.enabled ? "on" : "off"}`
  );
  const impact =
    payload.feature === "search"
      ? payload.enabled
        ? `将允许后续对话使用 ${payload.providerLabel || "Tavily"} 检索外部来源，并写入审计日志。`
        : "将停止后续对话自动检索外部来源，但保留历史来源记录与审计日志。"
      : payload.enabled
        ? "将允许后续对话切换到远程 API 高级设置链路，但默认仍优先本地 Ollama。"
        : "将关闭远程 API 链路，后续对话仅保留本地 Ollama 优先路径。";

  const nextState: WorkbenchState = withPermissionAuditLog({
    ...state,
    confirmation: {
      pending: {
        title,
        summary: payload.reason,
        commandPreview: `${featureLabel} -> ${payload.enabled ? "enabled" : "disabled"}`,
        impact,
        requiredMode: "readonly",
        requestedFeature: payload.feature,
        requestedEnabled: payload.enabled,
        providerLabel: payload.providerLabel,
        queuedMessage: payload.queuedMessage,
        safetySummary: "能力变更需要用户确认，并写入会话、审计与回退记录。"
      }
    },
    output: {
      title: "等待能力变更确认",
      summary: "能力设置尚未变更，等待你的确认。"
    },
    conversation: {
      entries: createPendingApprovalConversationEntries(state, capabilityRequestId, {
        id: capabilityRequestId,
        kind: "system",
        title,
        summary: payload.reason,
        actionLabel: "预览回退到 启动基线",
        rollbackTargetId: "startup-baseline"
      }, payload.queuedMessage)
    },
    audit: {
      summary: "等待用户确认能力变更",
      lastEvent: {
        module: "permission",
        detail: `${featureLabel}: ${payload.reason}`,
        timestamp: "待用户确认",
        source: "capability_toggle_request"
      }
    },
    error: null
  });

  return recordPendingApprovalUserMessageAnchor(
    nextState,
    capabilityRequestId,
    payload.queuedMessage,
    "提交能力变更请求"
  );
}

export function approvePendingConfirmationState(state: WorkbenchState): WorkbenchState {
  const pending = state.confirmation.pending;

  if (!pending) {
    return state;
  }

  if (pending.requestedFeature) {
    const nextFeature = pending.requestedFeature;
    const nextEnabled = pending.requestedEnabled ?? false;
    const nextProvider = pending.providerLabel?.trim() || state.search.providerLabel.trim();

    if (nextFeature === "search" && nextEnabled && !nextProvider) {
      const searchProviderMissingId = createWorkbenchEventId(state, "search-provider-config", "missing");

      return recordRollbackEntry(
        withPermissionAuditLog({
          ...state,
          confirmation: {
            pending: null
          },
          search: {
            enabled: true,
            providerLabel: ""
          },
          conversation: {
            entries: prependConversationEntry(state.conversation.entries, {
              id: searchProviderMissingId,
              kind: "system",
              title: "Search provider is not configured",
              summary:
                "Provider status: not configured. Network search remains enabled, but live retrieval cannot run until a provider is configured.",
              detailLines: [
                "Module: search",
                "Source: search_provider_config_missing",
                "Suggestion: Configure a search provider in advanced settings before retrying live web retrieval."
              ],
              actionLabel: "Configure a search provider in advanced settings",
              rollbackTargetId: searchProviderMissingId
            })
          },
          audit: {
            summary: "Search provider is not configured",
            lastEvent: {
              module: "search",
              detail:
                "Provider status: not configured. Network call skipped until a search provider is configured.",
              timestamp: "blocked",
              source: "search_provider_config_missing"
            }
          },
          error: {
            module: "search",
            summary: "Search provider is not configured",
            detail:
              "Provider status: not configured. Network search remains enabled, but live retrieval cannot run until a provider is configured.",
            actionLabel: "Configure a search provider in advanced settings before retrying live web retrieval.",
            timestamp: "blocked",
            source: "search_provider_config_missing"
          }
        }),
        searchProviderMissingId,
        "Search provider missing",
        "Search provider configuration is empty; live network retrieval is blocked until the provider is configured.",
        "tool"
      );
    }

    const nextState =
      nextFeature === "search"
        ? {
            ...state,
            search: {
              enabled: nextEnabled,
              providerLabel: nextEnabled ? nextProvider : ""
            }
          }
        : {
            ...state,
            model: {
              ...state.model,
              remoteApiEnabled: nextEnabled
            },
            settings: {
              ...state.settings,
              remoteApi: {
                ...state.settings.remoteApi,
                enabled: nextEnabled
              }
            }
          };
    const capabilityApprovalId = createWorkbenchEventId(
      state,
      "capability-approved",
      `${nextFeature}-${nextEnabled ? "on" : "off"}`
    );

    return recordRollbackEntry(
      withPermissionAuditLog({
        ...nextState,
        confirmation: {
          pending: null
        },
        conversation: {
          entries: prependConversationEntry(state.conversation.entries, {
            id: capabilityApprovalId,
            kind: "system",
            title:
              nextFeature === "search"
                ? nextEnabled
                  ? "已开启联网搜索"
                  : "已关闭联网搜索"
                : nextEnabled
                  ? "已开启远程 API"
                  : "已关闭远程 API",
            summary: pending.summary,
            actionLabel: `预览回退到 ${capabilityApprovalId}`,
            rollbackTargetId: capabilityApprovalId
          })
        },
        audit: {
          summary:
            nextFeature === "search"
              ? nextEnabled
                ? "已开启联网搜索"
                : "已关闭联网搜索"
              : nextEnabled
                ? "已开启远程 API"
                : "已关闭远程 API",
          lastEvent: {
            module: "permission",
            detail: pending.summary,
            timestamp: "已批准",
            source: "capability_toggle_approved"
          }
        },
        error: null
      }),
      capabilityApprovalId,
      "已批准操作",
      `${pending.title} 已获批准，后续执行仍需记录日志与快照。`,
      "tool"
    );
  }

  const confirmationApprovalId = createWorkbenchEventId(state, "confirmation", "approved");
  const queuedTraceLines = createQueuedExecutionTraceLines(pending);

  return recordRollbackEntry(
    withPermissionAuditLog({
      ...state,
      confirmation: {
        pending: null
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: confirmationApprovalId,
          kind: "system",
          title: "已批准高风险操作",
          summary: pending.summary,
          actionLabel: "预览回退到 confirmation-approved",
          rollbackTargetId: confirmationApprovalId,
          detailLines: queuedTraceLines
        })
      },
      audit: {
        summary: "用户已批准高风险操作",
        lastEvent: {
          module: "permission",
          detail: appendQueuedExecutionTrace(pending.summary, queuedTraceLines),
          timestamp: "已批准",
          source: "permission_confirmation_approved"
        }
      }
    }),
    confirmationApprovalId,
    "已批准操作",
    `${pending.title} 已获批准，后续执行仍需记录日志与快照。`,
    "tool"
  );
}

export function cancelPendingConfirmationState(state: WorkbenchState): WorkbenchState {
  const pending = state.confirmation.pending;

  if (!pending) {
    return state;
  }

  if (pending.requestedFeature) {
    const featureLabel = pending.requestedFeature === "search" ? "联网搜索" : "远程 API";
    const queuedTraceLines = createQueuedExecutionTraceLines(pending);
    const capabilityCancellationConversationId = createWorkbenchEventId(
      state,
      "capability-cancelled",
      pending.requestedFeature
    );
    const capabilityCancellationRollbackId = createWorkbenchEventId(
      state,
      "capability-toggle",
      "cancelled"
    );

    return recordRollbackEntry(
      withPermissionAuditLog({
        ...state,
        confirmation: {
          pending: null
        },
        output: {
          title: "Capability change cancelled",
          summary:
            `Capability change was cancelled. Current capability state was preserved. You can adjust the provider/configuration, rewrite the request, or ask again when you are ready to approve the change. ${CANCELLATION_DETAILS_COLLAPSED_SUMMARY}`
        },
        conversation: {
          entries: prependConversationEntry(state.conversation.entries, {
            id: capabilityCancellationConversationId,
            kind: "system",
            title: `已取消${featureLabel}变更`,
            summary: pending.summary,
            actionLabel: `预览回退到 ${capabilityCancellationRollbackId}`,
            rollbackTargetId: capabilityCancellationRollbackId,
            detailLines: [CAPABILITY_TOGGLE_CANCELLED_RECOVERY, ...queuedTraceLines]
          })
        },
        audit: {
          summary: "用户已取消能力变更",
          lastEvent: {
            module: "permission",
            detail: appendQueuedExecutionTrace(
              `能力变更已取消，当前能力状态保持不变。${CAPABILITY_TOGGLE_CANCELLED_RECOVERY} 已取消请求：${pending.summary}。能力：${pending.requestedFeature}。请求启用：${pending.requestedEnabled ?? false}。`,
              queuedTraceLines
            ),
            timestamp: "已取消",
            source: "capability_toggle_cancelled"
          }
        },
        error: null
      }),
      capabilityCancellationRollbackId,
      "已取消能力变更",
      `${pending.title} 已取消，当前能力开关保持原状。`,
      "tool"
    );
  }

  const confirmationCancellationId = createWorkbenchEventId(state, "confirmation", "cancelled");
  const queuedTraceLines = createQueuedExecutionTraceLines(pending);

  return recordRollbackEntry(
    withPermissionAuditLog({
      ...state,
      confirmation: {
        pending: null
      },
      output: {
        title: "已取消权限操作",
        summary: `${DANGEROUS_CONFIRMATION_CANCELLED_SUMMARY} ${CANCELLATION_DETAILS_COLLAPSED_SUMMARY}`
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: confirmationCancellationId,
          kind: "system",
          title: "已取消高风险操作",
          summary: pending.summary,
          actionLabel: "预览回退到 confirmation-cancelled",
          rollbackTargetId: confirmationCancellationId,
          detailLines: [DANGEROUS_CONFIRMATION_CANCELLED_RECOVERY, ...queuedTraceLines]
        })
      },
        audit: {
          summary: "用户已取消高风险操作",
          lastEvent: {
            module: "permission",
            detail: appendQueuedExecutionTrace(
            `${DANGEROUS_CONFIRMATION_CANCELLED_SUMMARY} ${DANGEROUS_CONFIRMATION_CANCELLED_RECOVERY} 已取消请求：${pending.summary}。命令预览：${pending.commandPreview}。所需权限：${pending.requiredMode}。`,
            queuedTraceLines
          ),
          timestamp: "已取消",
            source: "permission_confirmation_cancelled"
          }
        },
        error: null
      }),
    confirmationCancellationId,
    "已取消操作",
    `${pending.title} 已取消，工作台保持最近一次安全状态。`,
    "tool"
  );
}

export function requestPermissionModeChangeState(
  state: WorkbenchState,
  pendingModeChange: PendingPermissionModeChange
): WorkbenchState {
  if (isSamePendingPermissionModeChange(state.permission.pendingModeChange, pendingModeChange)) {
    return state;
  }

  const permissionRequestId = createWorkbenchEventId(state, "permission-request", pendingModeChange.targetMode);
  const queuedTraceLines = createQueuedExecutionTraceLines(pendingModeChange);

  const nextState: WorkbenchState = withPermissionAuditLog({
    ...state,
    permission: {
      ...state.permission,
      pendingModeChange
    },
    output: {
      title: "等待权限升级",
      summary: "尚未执行提权后的操作，等待你的确认。"
    },
    conversation: {
      entries: createPendingApprovalConversationEntries(state, permissionRequestId, {
        id: permissionRequestId,
        kind: "system",
        title: "等待权限升级",
        summary: pendingModeChange.reason,
        actionLabel: "预览回退到 启动基线",
        rollbackTargetId: "startup-baseline",
        detailLines: queuedTraceLines
      }, pendingModeChange.queuedMessage)
    },
    audit: {
      summary: "等待用户确认权限升级",
      lastEvent: {
        module: "permission",
        detail: appendQueuedExecutionTrace(
          `${pendingModeChange.reason} Risk: ${pendingModeChange.riskSummary}`,
          queuedTraceLines
        ),
        timestamp: "待用户确认",
        source: "permission_mode_change"
      }
    },
    error: null
  });

  return recordPendingApprovalUserMessageAnchor(
    nextState,
    permissionRequestId,
    pendingModeChange.queuedMessage,
    "提交权限请求"
  );
}

export function approvePermissionModeChangeState(state: WorkbenchState): WorkbenchState {
  const pendingModeChange = state.permission.pendingModeChange;

  if (!pendingModeChange) {
    return state;
  }

  const approvalConversationId = createWorkbenchEventId(state, "permission", "approved");
  const approvalRollbackId = createWorkbenchEventId(state, "permission-mode", "approved");
  const queuedTraceLines = createQueuedExecutionTraceLines(pendingModeChange);

  return recordRollbackEntry(
    withPermissionAuditLog({
      ...state,
      permission: {
        ...state.permission,
        ...getPermissionPresentation(pendingModeChange.targetMode),
        pendingModeChange: null
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: approvalConversationId,
          kind: "system",
          title: "已批准权限升级",
          summary: pendingModeChange.reason,
          actionLabel: `预览回退到 ${approvalRollbackId}`,
          rollbackTargetId: approvalRollbackId,
          detailLines: queuedTraceLines
        })
      },
      audit: {
        summary: "用户已批准权限升级",
        lastEvent: {
          module: "permission",
          detail: appendQueuedExecutionTrace(pendingModeChange.reason, queuedTraceLines),
          timestamp: "已批准",
          source: "permission_mode_change_approved"
        }
      }
    }),
    approvalRollbackId,
    "已批准权限升级",
    `${pendingModeChange.targetMode} 权限已获批准，后续操作仍受安全链路保护。`,
    "permission"
  );
}

export function cancelPermissionModeChangeState(state: WorkbenchState): WorkbenchState {
  const pendingModeChange = state.permission.pendingModeChange;

  if (!pendingModeChange) {
    return state;
  }

  const cancellationConversationId = createWorkbenchEventId(state, "permission", "cancelled");
  const cancellationRollbackId = createWorkbenchEventId(state, "permission-mode", "cancelled");
  const queuedTraceLines = createQueuedExecutionTraceLines(pendingModeChange);

  return recordRollbackEntry(
    withPermissionAuditLog({
      ...state,
      permission: {
        ...state.permission,
        pendingModeChange: null
      },
      output: {
        title: "已取消权限升级",
        summary: `${PERMISSION_UPGRADE_CANCELLED_SUMMARY} ${CANCELLATION_DETAILS_COLLAPSED_SUMMARY}`
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: cancellationConversationId,
          kind: "system",
          title: "已取消权限升级",
          summary: pendingModeChange.reason,
          actionLabel: `预览回退到 ${cancellationRollbackId}`,
          rollbackTargetId: cancellationRollbackId,
          detailLines: [PERMISSION_UPGRADE_CANCELLED_RECOVERY, ...queuedTraceLines]
        })
      },
        audit: {
          summary: "用户已取消权限升级",
          lastEvent: {
            module: "permission",
            detail: appendQueuedExecutionTrace(
            `${PERMISSION_UPGRADE_CANCELLED_SUMMARY} ${PERMISSION_UPGRADE_CANCELLED_RECOVERY} 已取消请求：${pendingModeChange.reason}。目标权限：${pendingModeChange.targetMode}。风险摘要：${pendingModeChange.riskSummary}。`,
            queuedTraceLines
          ),
          timestamp: "已取消",
            source: "permission_mode_change_cancelled"
          }
        },
        error: null
      }),
    cancellationRollbackId,
    "已取消权限升级",
    "权限保持当前模式，未执行额外提权。",
    "permission"
  );
}
