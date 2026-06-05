import { recordRollbackEntry } from "./workbenchState.rollback";
import { createWorkbenchEventId, prependConversationEntry } from "./workbenchState.shared";
import type { WorkbenchState } from "./workbenchState.types";

export function createSearchEnabledState(
  state: WorkbenchState,
  payload: {
    provider: string;
    query: string;
    sourceTitle: string;
    sourceUrl: string;
    summary: string;
  }
): WorkbenchState {
  const rollbackEntryId = createWorkbenchEventId(state, "search-enabled", payload.provider.toLowerCase());

  return recordRollbackEntry(
    {
      ...state,
      search: {
        enabled: true,
        providerLabel: payload.provider
      },
      sources: {
        items: [
          {
            title: payload.sourceTitle,
            url: payload.sourceUrl,
            provider: payload.provider,
            query: payload.query,
            summary: payload.summary
          },
          ...state.sources.items
        ].slice(0, 6)
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: rollbackEntryId,
          kind: "system",
          title: "联网搜索已开启",
          summary: `${payload.provider} 已返回来源 ${payload.sourceTitle}。`,
          actionLabel: `预览回退到 ${payload.provider} 搜索前`,
          rollbackTargetId: rollbackEntryId
        })
      },
      audit: {
        summary: payload.summary,
        lastEvent: {
          module: "search",
          detail: `${payload.provider} 查询: ${payload.query}`,
          timestamp: "已执行",
          source: "search_query"
        }
      }
    },
    rollbackEntryId,
    "联网搜索",
    `${payload.provider} 已返回来源 ${payload.sourceTitle}。`,
    "session"
  );
}
