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
        cacheCount: state.storage.cacheCount + 1
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
        cacheCount: state.storage.cacheCount + 1
      }
    ),
    rollbackEntryId,
    "工具执行失败",
    `${payload.toolLabel} 失败，已写入修复建议与审计日志。`,
    "tool"
  );
}
