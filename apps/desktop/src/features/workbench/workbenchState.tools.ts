import { recordRollbackEntry } from "./workbenchState.rollback";
import { createWorkbenchEventId, prependConversationEntry } from "./workbenchState.shared";
import { withStorageDelta } from "./workbenchState.storage";
import type { WorkbenchState } from "./workbenchState.types";

export function createToolExecutionState(
  state: WorkbenchState,
  payload: {
    toolLabel: string;
    summary: string;
    outputTitle: string;
    outputSummary: string;
    source: string;
  }
): WorkbenchState {
  const rollbackEntryId = createWorkbenchEventId(state, "tool-result", payload.source);

  return recordRollbackEntry(
    withStorageDelta(
      {
        ...state,
        tools: {
          lastResult: {
            toolLabel: payload.toolLabel,
            summary: payload.summary,
            source: payload.source
          }
        },
        output: {
          title: payload.outputTitle,
          summary: payload.outputSummary
        },
        conversation: {
          entries: prependConversationEntry(state.conversation.entries, {
            id: rollbackEntryId,
            kind: "system",
            title: "工具执行完成",
            summary: `${payload.toolLabel}: ${payload.summary}`,
            actionLabel: `预览回退到 ${payload.toolLabel} 执行前`,
            rollbackTargetId: rollbackEntryId
          })
        },
        audit: {
          summary: `${payload.toolLabel} 已完成`,
          lastEvent: {
            module: "tools",
            detail: payload.summary,
            timestamp: "已执行",
            source: payload.source
          }
        }
      },
      {
        cacheCount: state.storage.cacheCount + 1,
        logCount: state.storage.logCount + 1
      }
    ),
    rollbackEntryId,
    "工具执行结果",
    `${payload.toolLabel} 已写入当前工作台产物与日志。`,
    "tool"
  );
}

export function createToolExecutionErrorState(
  state: WorkbenchState,
  payload: {
    toolLabel: string;
    summary: string;
    detail: string;
    actionLabel: string;
    source: string;
  }
): WorkbenchState {
  const rollbackEntryId = createWorkbenchEventId(state, "tool-error", payload.source);

  return recordRollbackEntry(
    withStorageDelta(
      {
        ...state,
        tools: {
          lastResult: {
            toolLabel: payload.toolLabel,
            summary: payload.summary,
            source: payload.source
          }
        },
        conversation: {
          entries: prependConversationEntry(state.conversation.entries, {
            id: rollbackEntryId,
            kind: "system",
            title: "工具执行失败",
            summary: `${payload.toolLabel}: ${payload.summary}`,
            detailLines: ["模块: tools", `来源: ${payload.source}`, `建议: ${payload.actionLabel}`]
          })
        },
        audit: {
          summary: payload.summary,
          lastEvent: {
            module: "tools",
            detail: payload.detail,
            timestamp: "已执行",
            source: payload.source
          }
        },
        error: {
          module: "tools",
          summary: payload.summary,
          detail: payload.detail,
          actionLabel: payload.actionLabel,
          timestamp: "已执行",
          source: payload.source
        }
      },
      {
        cacheCount: state.storage.cacheCount + 1,
        logCount: state.storage.logCount + 1
      }
    ),
    rollbackEntryId,
    "工具执行失败",
    `${payload.toolLabel} 失败，已写入修复建议与审计日志。`,
    "tool"
  );
}

export function createToolExecutionRecoveredState(state: WorkbenchState): WorkbenchState {
  if (state.error?.module !== "tools") {
    return state;
  }

  const rollbackEntryId = createWorkbenchEventId(state, "tool-error", "recovered");
  const toolLabel = state.tools.lastResult?.toolLabel ?? "Tool";
  const recoveryDetail = [
    `Previous tool error: ${state.error.summary}`,
    `Previous tool source: ${state.error.source}`,
    `Previous tool detail: ${state.error.detail}`,
    `Recovery hint: ${state.error.actionLabel}`
  ].join(" ");

  return recordRollbackEntry(
    withStorageDelta(
      {
        ...state,
        output: {
          title: "工具错误已处理",
          summary: `已保留 ${toolLabel} 的失败记录，并清除当前错误提示。完整恢复建议已保留在日志和展开详情中。`
        },
        conversation: {
          entries: prependConversationEntry(state.conversation.entries, {
            id: rollbackEntryId,
            kind: "system",
            title: "工具错误已处理",
            summary: state.error.summary,
            actionLabel: "预览回退到工具错误处理前",
            rollbackTargetId: rollbackEntryId,
            detailLines: ["模块: tools", "来源: tool_error_recovered", recoveryDetail]
          })
        },
        audit: {
          summary: "工具错误已处理",
          lastEvent: {
            module: "tools",
            detail: recoveryDetail,
            timestamp: "recovered",
            source: "tool_error_recovered"
          }
        },
        error: null
      },
      {
        logCount: state.storage.logCount + 1
      }
    ),
    rollbackEntryId,
    "工具错误已处理",
    recoveryDetail,
    "tool"
  );
}
