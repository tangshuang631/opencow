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

export function createRemoteApiConfigState(
  state: WorkbenchState,
  payload: {
    baseUrl: string;
    providerLabel: string;
    apiKey: string;
  }
): WorkbenchState {
  const nextBaseUrl = payload.baseUrl.trim();
  const nextProviderLabel = payload.providerLabel.trim();
  const nextApiKey = payload.apiKey.trim();

  if (
    state.settings.remoteApi.baseUrl === nextBaseUrl &&
    state.settings.remoteApi.providerLabel === nextProviderLabel &&
    state.settings.remoteApi.apiKey === nextApiKey
  ) {
    return state;
  }

  return recordRollbackEntry(
    {
      ...state,
      settings: {
        ...state.settings,
        remoteApi: {
          ...state.settings.remoteApi,
          baseUrl: nextBaseUrl,
          providerLabel: nextProviderLabel,
          apiKey: nextApiKey
        }
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: `remote-api-config-${state.rollback.entries.length}`,
          kind: "system",
          title: "已更新远程 API 配置",
          summary: `已保存 ${nextProviderLabel || "远程 provider"} 的 Base URL 配置。`,
          actionLabel: "预览回退到 启动基线",
          rollbackTargetId: "startup-baseline"
        })
      },
      audit: {
        summary: "已更新远程 API 配置",
        lastEvent: {
          module: "network",
          detail: `baseUrl=${nextBaseUrl || "未填写"} provider=${nextProviderLabel || "未填写"} apiKey=${nextApiKey ? "已填写" : "未填写"}`,
          timestamp: "已执行",
          source: "remote_api_config"
        }
      },
      error: null
    },
    `remote-api-config-${state.rollback.entries.length}`,
    "远程 API 配置更新",
    "已保存远程 API 基础连接信息。",
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

export function createSearchProviderConfigState(
  state: WorkbenchState,
  payload: {
    providerLabel: string;
  }
): WorkbenchState {
  const nextProviderLabel = payload.providerLabel.trim() || "Tavily";

  if (state.search.providerLabel === nextProviderLabel) {
    return state;
  }

  return recordRollbackEntry(
    {
      ...state,
      search: {
        ...state.search,
        providerLabel: nextProviderLabel
      },
      conversation: {
        entries: prependConversationEntry(state.conversation.entries, {
          id: `search-provider-config-${state.rollback.entries.length}`,
          kind: "system",
          title: "已更新联网搜索提供方",
          summary: `联网搜索将优先使用 ${nextProviderLabel}，仍会保留来源记录与审计追踪。`,
          actionLabel: "预览回退到 启动基线",
          rollbackTargetId: "startup-baseline"
        })
      },
      audit: {
        summary: "已更新联网搜索提供方",
        lastEvent: {
          module: "search",
          detail: `provider=${nextProviderLabel}`,
          timestamp: "已执行",
          source: "search_provider_config"
        }
      },
      error: null
    },
    `search-provider-config-${state.rollback.entries.length}`,
    "联网搜索 provider 更新",
    "已保存联网搜索的 provider 配置。",
    "session"
  );
}
