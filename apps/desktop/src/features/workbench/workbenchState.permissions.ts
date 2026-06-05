import { recordRollbackEntry } from "./workbenchState.rollback";
import { getPermissionPresentation, prependConversationEntry } from "./workbenchState.shared";
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
};

export function createCommandPolicyBlockedState(
  state: WorkbenchState,
  payload: {
    summary: string;
    detail: string;
    actionLabel: string;
    source: string;
  }
): WorkbenchState {
  return {
    ...state,
    conversation: {
      entries: prependConversationEntry(state.conversation.entries, {
        id: `blocked-${payload.source}`,
        kind: "system",
        title: payload.summary,
        summary: payload.detail,
        detailLines: ["模块: permission", `来源: ${payload.source}`, `建议: ${payload.actionLabel}`]
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
  };
}

export function createHighRiskConfirmationState(
  state: WorkbenchState,
  pending: PendingConfirmation
): WorkbenchState {
  return {
    ...state,
    confirmation: {
      pending
    },
    conversation: {
      entries: prependConversationEntry(state.conversation.entries, {
        id: "dangerous-confirmation",
        kind: "system",
        title: "等待高风险操作确认",
        summary: pending.summary,
        actionLabel: "预览回退到 启动基线",
        rollbackTargetId: "startup-baseline"
      })
    },
    audit: {
      summary: "等待用户确认高风险操作",
      lastEvent: {
        module: "permission",
        detail: pending.summary,
        timestamp: "待用户确认",
        source: "permission_confirmation"
      }
    }
  };
}

export function createCapabilityToggleRequestState(
  state: WorkbenchState,
  payload: CapabilityToggleRequest
): WorkbenchState {
  const featureLabel = payload.feature === "search" ? "联网搜索" : "远程 API";
  const title = `${payload.enabled ? "确认开启" : "确认关闭"}${featureLabel}`;
  const impact =
    payload.feature === "search"
      ? payload.enabled
        ? `将允许后续对话使用 ${payload.providerLabel || "Tavily"} 检索外部来源，并写入审计日志。`
        : "将停止后续对话自动检索外部来源，但保留历史来源记录与审计日志。"
      : payload.enabled
        ? "将允许后续对话切换到远程 API 高级设置链路，但默认仍优先本地 Ollama。"
        : "将关闭远程 API 链路，后续对话仅保留本地 Ollama 优先路径。";

  return {
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
        safetySummary: "能力变更需要用户确认，并写入会话、审计与回退记录。"
      }
    },
    conversation: {
      entries: prependConversationEntry(state.conversation.entries, {
        id: `capability-request-${payload.feature}-${payload.enabled ? "on" : "off"}`,
        kind: "system",
        title,
        summary: payload.reason,
        actionLabel: "预览回退到 启动基线",
        rollbackTargetId: "startup-baseline"
      })
    },
    audit: {
      summary: "等待用户确认能力变更",
      lastEvent: {
        module: "permission",
        detail: `${featureLabel}: ${payload.reason}`,
        timestamp: "待用户确认",
        source: "capability_toggle_request"
      }
    }
  };
}

export function approvePendingConfirmationState(state: WorkbenchState): WorkbenchState {
  const pending = state.confirmation.pending;

  if (!pending) {
    return state;
  }

  if (pending.requestedFeature) {
    const nextFeature = pending.requestedFeature;
    const nextEnabled = pending.requestedEnabled ?? false;
    const nextProvider = pending.providerLabel?.trim() || state.search.providerLabel || "Tavily";
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

    return recordRollbackEntry(
      {
        ...nextState,
        confirmation: {
          pending: null
        },
        conversation: {
          entries: prependConversationEntry(state.conversation.entries, {
            id: `capability-approved-${nextFeature}-${nextEnabled ? "on" : "off"}`,
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
            actionLabel: "预览回退到 confirmation-approved",
            rollbackTargetId: "confirmation-approved"
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
      },
      "confirmation-approved",
      "已批准操作",
      `${pending.title} 已获批准，后续执行仍需记录日志与快照。`,
      "tool"
    );
  }

  return recordRollbackEntry(
    {
      ...state,
      confirmation: {
        pending: null
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: "confirmation-approved",
          kind: "system",
          title: "已批准高风险操作",
          summary: pending.summary,
          actionLabel: "预览回退到 confirmation-approved",
          rollbackTargetId: "confirmation-approved"
        })
      },
      audit: {
        summary: "用户已批准高风险操作",
        lastEvent: {
          module: "permission",
          detail: pending.summary,
          timestamp: "已批准",
          source: "permission_confirmation_approved"
        }
      }
    },
    "confirmation-approved",
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

  return recordRollbackEntry(
    {
      ...state,
      confirmation: {
        pending: null
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: "confirmation-cancelled",
          kind: "system",
          title: "已取消高风险操作",
          summary: pending.summary,
          actionLabel: "预览回退到 confirmation-cancelled",
          rollbackTargetId: "confirmation-cancelled"
        })
      },
      audit: {
        summary: "用户已取消高风险操作",
        lastEvent: {
          module: "permission",
          detail: pending.summary,
          timestamp: "已取消",
          source: "permission_confirmation_cancelled"
        }
      }
    },
    "confirmation-cancelled",
    "已取消操作",
    `${pending.title} 已取消，工作台保持最近一次安全状态。`,
    "tool"
  );
}

export function requestPermissionModeChangeState(
  state: WorkbenchState,
  pendingModeChange: PendingPermissionModeChange
): WorkbenchState {
  return {
    ...state,
    permission: {
      ...state.permission,
      pendingModeChange
    },
    conversation: {
      entries: prependConversationEntry(state.conversation.entries, {
        id: `permission-request-${pendingModeChange.targetMode}`,
        kind: "system",
        title: "等待权限升级",
        summary: pendingModeChange.reason,
        actionLabel: "预览回退到 启动基线",
        rollbackTargetId: "startup-baseline"
      })
    },
    audit: {
      summary: "等待用户确认权限升级",
      lastEvent: {
        module: "permission",
        detail: pendingModeChange.reason,
        timestamp: "待用户确认",
        source: "permission_mode_change"
      }
    }
  };
}

export function approvePermissionModeChangeState(state: WorkbenchState): WorkbenchState {
  const pendingModeChange = state.permission.pendingModeChange;

  if (!pendingModeChange) {
    return state;
  }

  return recordRollbackEntry(
    {
      ...state,
      permission: {
        ...state.permission,
        ...getPermissionPresentation(pendingModeChange.targetMode),
        pendingModeChange: null
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: "permission-approved",
          kind: "system",
          title: "已批准权限升级",
          summary: pendingModeChange.reason,
          actionLabel: "预览回退到 permission-mode-approved",
          rollbackTargetId: "permission-mode-approved"
        })
      },
      audit: {
        summary: "用户已批准权限升级",
        lastEvent: {
          module: "permission",
          detail: pendingModeChange.reason,
          timestamp: "已批准",
          source: "permission_mode_change_approved"
        }
      }
    },
    "permission-mode-approved",
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

  return recordRollbackEntry(
    {
      ...state,
      permission: {
        ...state.permission,
        pendingModeChange: null
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: "permission-cancelled",
          kind: "system",
          title: "已取消权限升级",
          summary: pendingModeChange.reason,
          actionLabel: "预览回退到 permission-mode-cancelled",
          rollbackTargetId: "permission-mode-cancelled"
        })
      },
      audit: {
        summary: "用户已取消权限升级",
        lastEvent: {
          module: "permission",
          detail: pendingModeChange.reason,
          timestamp: "已取消",
          source: "permission_mode_change_cancelled"
        }
      }
    },
    "permission-mode-cancelled",
    "已取消权限升级",
    "权限保持当前模式，未执行额外提权。",
    "permission"
  );
}
