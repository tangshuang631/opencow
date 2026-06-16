import { attachRollbackSnapshot, createRollbackJournal, createWorkbenchRollbackEntry } from "./workbenchState.rollback";
import type { WorkbenchState } from "./workbenchState.types";

export function createInitialWorkbenchState(): WorkbenchState {
  const state: WorkbenchState = {
    model: {
      label: "Ollama 本地优先",
      status: "等待 Ollama",
      remoteApiEnabled: false,
      endpoint: "http://127.0.0.1:11434",
      activeModel: "未选择模型",
      diagnostic: "正在读取本地 Ollama 状态。",
      availableModels: []
    },
    permission: {
      mode: "readonly",
      label: "只读",
      summary: "仅允许读取已授权目录与附件。",
      requiresConfirmation: true,
      confirmationTitle: "权限确认",
      confirmationSummary: "删除、覆盖、递归删除、结束进程前必须弹窗确认。",
      pendingModeChange: null
    },
    confirmation: {
      pending: null
    },
    conversation: {
      entries: []
    },
    history: {
      lastNonEmptyConversationEntries: [],
      recentConversations: []
    },
    rollback: {
      ...createRollbackJournal({
        baselineEntry: createWorkbenchRollbackEntry(
          "startup-baseline",
          "启动基线",
          "应用启动后的本地安全初始状态。",
          "session"
        )
      }),
      snapshots: {},
      pendingPreview: null
    },
    search: {
      enabled: false,
      providerLabel: ""
    },
    knowledge: {
      importedFiles: [],
      availableFiles: []
    },
    sources: {
      items: []
    },
    tools: {
      lastResult: null
    },
    tasks: {
      pendingCount: 0,
      activeTaskId: null,
      items: []
    },
    output: {
      title: "暂无产物",
      summary: "等待工具执行结果或本地产物摘要。"
    },
    settings: {
      remoteApi: {
        collapsed: true,
        enabled: false,
        baseUrl: "",
        providerLabel: "",
        apiKey: ""
      }
    },
    storage: {
      sessionCount: 1,
      logCount: 1,
      cacheCount: 0,
      snapshotCount: 1,
      knowledgeCount: 0
    },
    audit: {
      summary: "等待本地事件",
      lastEvent: {
        module: "startup",
        detail: "应用已启动，等待读取本地模型状态。",
        timestamp: "未记录",
        source: "desktop-bootstrap"
      }
    },
    error: null
  };

  return attachRollbackSnapshot(state, "startup-baseline");
}
