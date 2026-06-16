import { startTransition, useEffect, useState } from "react";
import { Workbench } from "../../../desktop/src/features/workbench/Workbench";
import {
  createInitialWorkbenchState,
  createModelSelectedState,
  createNewConversationState,
  createStorageCleanupState,
  createTaskExecutionStartedState,
  createTaskExecutionSucceededState,
  createUserTaskSubmittedState,
  deleteRecentConversationState,
  mergeOllamaOverview,
  restoreRecentConversationState
} from "../../../desktop/src/features/workbench/workbenchState";
import type {
  AvailableKnowledgeFile,
  ImportedKnowledgeFile,
  WorkbenchState
} from "../../../desktop/src/features/workbench/workbenchState";
import {
  clearPersistedWorkbenchState,
  loadPersistedWorkbenchStateFromBrowserStorage,
  persistWorkbenchState
} from "../../../desktop/src/features/workbench/workbenchState.persistence";
import { clearWebKnowledgeRecord, persistWebKnowledgeRecord, readWebKnowledgeRecord } from "./webKnowledgeStorage";
import { loadWebCapabilityOverview } from "./webCapabilityService";

const WEB_SAMPLE_DOCS: Array<{ path: string; title: string; content: string }> = [
  {
    path: "docs/web-history-mvp.md",
    title: "web-history-mvp.md",
    content: "# Web History MVP\n\nKeep recent conversations until the user deletes them manually."
  },
  {
    path: "docs/npc-notes.txt",
    title: "npc-notes.txt",
    content: "NPC web preview keeps readonly capability guidance and staged execution notes."
  }
];

function createKnowledgeStateFromStorage(): {
  importedFiles: ImportedKnowledgeFile[];
  availableFiles: AvailableKnowledgeFile[];
  knowledgeCount: number;
} {
  const persisted = readWebKnowledgeRecord();
  const importedFiles = persisted.importedFiles.map((item) => ({
    path: item.path,
    title: item.title,
    status: item.status
  }));
  const importedPaths = new Set(importedFiles.map((item) => item.path));
  const availableFiles = WEB_SAMPLE_DOCS
    .filter((item) => !importedPaths.has(item.path))
    .map((item) => ({
      path: item.path,
      title: item.title
    }));

  return {
    importedFiles,
    availableFiles,
    knowledgeCount: importedFiles.length
  };
}

function hydrateWebState(state: WorkbenchState): WorkbenchState {
  const knowledge = createKnowledgeStateFromStorage();

  return mergeOllamaOverview(
    {
      ...state,
      knowledge: {
        importedFiles: knowledge.importedFiles,
        availableFiles: knowledge.availableFiles
      },
      storage: {
        ...state.storage,
        knowledgeCount: knowledge.knowledgeCount
      }
    },
    {
      reachable: true,
      endpoint: "browser://local-first",
      selectedModel: "opencow-web-preview",
      diagnostic: "",
      models: [{ name: "opencow-web-preview", sizeLabel: "Browser Preview" }]
    }
  );
}

function persistKnowledgeFromState(state: WorkbenchState) {
  const importedDocs = state.knowledge.importedFiles.map((item) => {
    const sample = WEB_SAMPLE_DOCS.find((doc) => doc.path === item.path);

    return {
      path: item.path,
      title: item.title,
      status: item.status,
      content: sample?.content ?? ""
    };
  });

  persistWebKnowledgeRecord({
    importedFiles: importedDocs
  });
}

export function WebApp() {
  const [state, setState] = useState<WorkbenchState>(() =>
    hydrateWebState(loadPersistedWorkbenchStateFromBrowserStorage(createInitialWorkbenchState))
  );

  useEffect(() => {
    void persistWorkbenchState(state);
    persistKnowledgeFromState(state);
  }, [state]);

  function setReadonlyCapabilitySummary(capabilityId: "rag" | "skills" | "npc" | "mcp") {
    const overview = loadWebCapabilityOverview(capabilityId);

    startTransition(() => {
      setState((current) => {
        const queued = createUserTaskSubmittedState(current, {
          message: `查看 ${overview.title} 网页端能力概览`,
          executionKind: `capability-${capabilityId}-overview` as never,
          executionTitle: `${overview.title} 能力概览`,
          executionAuditSummary: `查看 ${overview.title} 网页端能力概览`,
          executionAuditDetail: `web capability overview: ${capabilityId}`
        });
        const started = createTaskExecutionStartedState(queued);

        return createTaskExecutionSucceededState(started, {
          resultTitle: `${overview.title} 网页端能力概览`,
          resultSummary: overview.summary,
          auditDetailLines: [
            `Capability status: ${overview.status}`,
            `Available packages: ${overview.available_packages.join(", ") || "(none)"}`,
            `Missing packages: ${overview.missing_packages.join(", ") || "(none)"}`
          ]
        });
      });
    });
  }

  function handleSubmitTask(message: string) {
    const trimmed = message.trim();

    if (!trimmed) {
      return;
    }

    const normalized = trimmed.toLowerCase();

    if (normalized.includes("rag")) {
      setReadonlyCapabilitySummary("rag");
      return;
    }

    if (normalized.includes("skills")) {
      setReadonlyCapabilitySummary("skills");
      return;
    }

    if (normalized.includes("npc")) {
      setReadonlyCapabilitySummary("npc");
      return;
    }

    if (normalized.includes("mcp")) {
      setReadonlyCapabilitySummary("mcp");
      return;
    }

    startTransition(() => {
      setState((current) => {
        const queued = createUserTaskSubmittedState(current, {
          message: trimmed,
          executionKind: "local-model-chat",
          executionTitle: "网页端本地会话",
          executionAuditSummary: "网页端提交了一条本地优先会话任务",
          executionAuditDetail: `web local-first chat: ${trimmed}`
        });
        const started = createTaskExecutionStartedState(queued);

        return createTaskExecutionSucceededState(started, {
          resultTitle: "网页端本地会话答复",
          resultSummary: `已为网页端保留这段上下文：${trimmed}`,
          auditDetailLines: ["Web MVP keeps browser history, recent sessions, and local knowledge context."]
        });
      });
    });
  }

  function handleCleanupStorage(target: "conversation" | "logs" | "cache" | "snapshots" | "knowledge") {
    if (target === "conversation") {
      void clearPersistedWorkbenchState();
    }

    if (target === "knowledge") {
      clearWebKnowledgeRecord();
    }

    startTransition(() => {
      setState((current) => {
        const cleared = createStorageCleanupState(current, target);

        if (target !== "knowledge") {
          return cleared;
        }

        return {
          ...cleared,
          knowledge: {
            importedFiles: [],
            availableFiles: WEB_SAMPLE_DOCS.map((item) => ({
              path: item.path,
              title: item.title
            }))
          },
          storage: {
            ...cleared.storage,
            knowledgeCount: 0
          }
        };
      });
    });
  }

  function handleImportKnowledgeFile(path: string) {
    const sample = WEB_SAMPLE_DOCS.find((item) => item.path === path);

    if (!sample) {
      return;
    }

    startTransition(() => {
      setState((current) => {
        const nextImported = [
          ...current.knowledge.importedFiles,
          {
            path: sample.path,
            title: sample.title,
            status: "ready" as const
          }
        ];

        return {
          ...current,
          knowledge: {
            importedFiles: nextImported,
            availableFiles: current.knowledge.availableFiles.filter((item) => item.path !== path)
          },
          storage: {
            ...current.storage,
            knowledgeCount: nextImported.length
          },
          output: {
            title: "知识库已更新",
            summary: `已导入 ${sample.title}，网页端会保留这份 md/txt 上下文。`
          },
          audit: {
            summary: "网页端知识库已导入文档",
            lastEvent: {
              module: "knowledge",
              detail: `imported ${sample.path}`,
              timestamp: "imported",
              source: "web_knowledge_import"
            }
          }
        };
      });
    });
  }

  function handleRemoveKnowledgeFile(path: string) {
    const sample = WEB_SAMPLE_DOCS.find((item) => item.path === path);

    startTransition(() => {
      setState((current) => {
        const nextImported = current.knowledge.importedFiles.filter((item) => item.path !== path);
        const nextAvailable = sample
          ? [...current.knowledge.availableFiles, { path: sample.path, title: sample.title }]
          : current.knowledge.availableFiles;

        return {
          ...current,
          knowledge: {
            importedFiles: nextImported,
            availableFiles: nextAvailable
          },
          storage: {
            ...current.storage,
            knowledgeCount: nextImported.length
          },
          output: {
            title: "知识库已更新",
            summary: sample ? `已移出 ${sample.title}。` : "已更新知识库。"
          },
          audit: {
            summary: "网页端知识库已移出文档",
            lastEvent: {
              module: "knowledge",
              detail: `removed ${path}`,
              timestamp: "removed",
              source: "web_knowledge_remove"
            }
          }
        };
      });
    });
  }

  return (
    <Workbench
      state={state}
      onApproveDangerousAction={() => undefined}
      onCancelDangerousAction={() => undefined}
      onApprovePermissionRequest={() => undefined}
      onCancelPermissionRequest={() => undefined}
      onRetryOllamaCheck={() => undefined}
      onRecoverToolError={() => undefined}
      onPreviewRollback={() => undefined}
      onApplyRollback={() => undefined}
      onCancelRollback={() => undefined}
      onRetryLocalTask={() => undefined}
      onCancelActiveTask={() => undefined}
      onUpdateRollbackLimit={() => undefined}
      onCleanupStorage={handleCleanupStorage}
      onToggleRemoteApi={() => undefined}
      onToggleSearch={() => undefined}
      onSaveRemoteApiConfig={() => undefined}
      onSaveSearchProviderConfig={() => undefined}
      onSelectModel={(modelName) => {
        startTransition(() => {
          setState((current) => createModelSelectedState(current, modelName));
        });
      }}
      onNewConversation={() => {
        startTransition(() => {
          setState((current) => createNewConversationState(current));
        });
      }}
      onRestoreRecentConversation={(conversationId) => {
        startTransition(() => {
          setState((current) => restoreRecentConversationState(current, conversationId));
        });
      }}
      onDeleteRecentConversation={(conversationId) => {
        startTransition(() => {
          setState((current) => deleteRecentConversationState(current, conversationId));
        });
      }}
      onImportKnowledgeFile={handleImportKnowledgeFile}
      onRemoveKnowledgeFile={handleRemoveKnowledgeFile}
      onSubmitTask={handleSubmitTask}
    />
  );
}
