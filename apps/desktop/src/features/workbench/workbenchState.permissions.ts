import { recordRollbackEntry } from "./workbenchState.rollback";
import { getPermissionPresentation, prependConversationEntry } from "./workbenchState.shared";
import type {
  PendingConfirmation,
  PendingPermissionModeChange,
  WorkbenchState
} from "./workbenchState.types";

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

export function approvePendingConfirmationState(state: WorkbenchState): WorkbenchState {
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
