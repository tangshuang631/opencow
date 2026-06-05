import { recordRollbackEntry } from "./workbenchState.rollback";
import { prependConversationEntry } from "./workbenchState.shared";
import type { WorkbenchState } from "./workbenchState.types";

export function createRemoteApiToggleState(state: WorkbenchState, enabled: boolean): WorkbenchState {
  if (state.settings.remoteApi.enabled === enabled && state.model.remoteApiEnabled === enabled) {
    return state;
  }

  const title = enabled ? "已开启远程 API" : "已关闭远程 API";

  return recordRollbackEntry(
    {
      ...state,
      model: {
        ...state.model,
        remoteApiEnabled: enabled
      },
      settings: {
        ...state.settings,
        remoteApi: {
          ...state.settings.remoteApi,
          enabled
        }
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: `remote-api-toggle-${enabled ? "on" : "off"}`,
          kind: "system",
          title,
          summary: enabled
            ? "远程 API 已进入高级设置可用状态，默认仍优先本地 Ollama。"
            : "远程 API 已关闭，当前仅保留本地 Ollama 优先链路。",
          actionLabel: "预览回退到 启动基线",
          rollbackTargetId: "startup-baseline"
        })
      },
      audit: {
        summary: title,
        lastEvent: {
          module: "network",
          detail: enabled ? "用户在高级设置中开启了远程 API。" : "用户在高级设置中关闭了远程 API。",
          timestamp: "已执行",
          source: "remote_api_toggle"
        }
      },
      error: null
    },
    `remote-api-toggle-${enabled ? "on" : "off"}-${state.rollback.entries.length}`,
    enabled ? "远程 API 开启" : "远程 API 关闭",
    title,
    "session"
  );
}

export function createSearchToggleState(
  state: WorkbenchState,
  payload: {
    enabled: boolean;
    providerLabel?: string;
  }
): WorkbenchState {
  const nextProvider = payload.enabled ? payload.providerLabel || state.search.providerLabel || "Tavily" : "";

  if (state.search.enabled === payload.enabled && state.search.providerLabel === nextProvider) {
    return state;
  }

  const title = payload.enabled ? "已开启联网搜索" : "已关闭联网搜索";

  return recordRollbackEntry(
    {
      ...state,
      search: {
        enabled: payload.enabled,
        providerLabel: nextProvider
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: `search-toggle-${payload.enabled ? "on" : "off"}`,
          kind: "system",
          title,
          summary: payload.enabled
            ? `联网搜索已切换为 ${nextProvider}，后续搜索前仍会记录来源与摘要。`
            : "联网搜索已关闭，当前不会自动注入外部来源。",
          actionLabel: "预览回退到 启动基线",
          rollbackTargetId: "startup-baseline"
        })
      },
      audit: {
        summary: title,
        lastEvent: {
          module: "search",
          detail: payload.enabled
            ? `用户在高级设置中开启了联网搜索，provider=${nextProvider}。`
            : "用户在高级设置中关闭了联网搜索。",
          timestamp: "已执行",
          source: "search_toggle"
        }
      },
      error: null
    },
    `search-toggle-${payload.enabled ? "on" : "off"}-${state.rollback.entries.length}`,
    payload.enabled ? "联网搜索开启" : "联网搜索关闭",
    title,
    "session"
  );
}
