import { startTransition, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  inspectLocalSkill,
  loadOpenClawCapabilityOverview,
  loadWorkspaceOverview,
  listEnabledLocalSkills,
  matchEnabledLocalSkills,
  searchLocalKnowledge,
  scanLocalSkills
} from "../../../desktop/src/features/assistant/localAssistantService";
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
import { searchWebKnowledge } from "./webKnowledgeSearch";
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
    content: "NPC web preview keeps browser history guidance, readonly capability notes, and staged execution reminders."
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

function createLocalRagSearchResultSummary(result: ReturnType<typeof searchWebKnowledge>) {
  const topPaths = result.items.slice(0, 2).map((item) => item.title).join("、") || "暂无匹配来源";

  return [
    `找到 ${result.match_count} 条匹配片段，已索引 ${result.indexed_document_count} 个文档。`,
    `主要来源：${topPaths}。`,
    `检索问题：${result.query}。`
  ].join(" ");
}

function formatTopKnowledgeSources(result: ReturnType<typeof searchWebKnowledge>) {
  return result.items.slice(0, 2).map((item) => item.title).join("、") || "暂无匹配来源";
}

function createWebCapabilityResultSummary(capabilityId: "rag" | "skills" | "npc" | "mcp") {
  const overview = loadWebCapabilityOverview(capabilityId);
  const availableLine = overview.available_packages.join("、") || "无";
  const missingLine = overview.missing_packages.join("、") || "无";
  const sampleLine = overview.sampleItems.join("、") || "暂无";

  return [
    `状态：${overview.status}。`,
    `可用包：${availableLine}。`,
    `缺失包：${missingLine}。`,
    `样例项：${sampleLine}。`,
    overview.contextLine,
    overview.nextStep
  ].join(" ");
}

function applyReadonlyTaskResult(
  setState: Dispatch<SetStateAction<WorkbenchState>>,
  payload: {
    message: string;
    executionKind: string;
    executionTitle: string;
    executionAuditSummary: string;
    executionAuditDetail: string;
    resultTitle: string;
    resultSummary: string;
    auditDetailLines: string[];
  }
) {
  startTransition(() => {
    setState((current) => {
      const queued = createUserTaskSubmittedState(current, {
        message: payload.message,
        executionKind: payload.executionKind as never,
        executionTitle: payload.executionTitle,
        executionAuditSummary: payload.executionAuditSummary,
        executionAuditDetail: payload.executionAuditDetail
      });
      const started = createTaskExecutionStartedState(queued);

      return createTaskExecutionSucceededState(started, {
        resultTitle: payload.resultTitle,
        resultSummary: payload.resultSummary,
        auditDetailLines: payload.auditDetailLines
      });
    });
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

    applyReadonlyTaskResult(setState, {
      message: `查看 ${overview.title} 网页端能力概览`,
      executionKind: `capability-${capabilityId}-overview`,
      executionTitle: `${overview.title} 能力概览`,
      executionAuditSummary: `查看 ${overview.title} 网页端能力概览`,
      executionAuditDetail: `web capability overview: ${capabilityId}`,
      resultTitle: `${overview.title} 网页端能力概览`,
      resultSummary: createWebCapabilityResultSummary(capabilityId),
      auditDetailLines: [
        `Capability status: ${overview.status}`,
        `Available packages: ${overview.available_packages.join(", ") || "(none)"}`,
        `Missing packages: ${overview.missing_packages.join(", ") || "(none)"}`,
        `Sample items: ${overview.sampleItems.join(", ") || "(none)"}`,
        `Next step: ${overview.nextStep}`
      ]
    });
  }

  function handleSubmitTask(message: string) {
    const trimmed = message.trim();

    if (!trimmed) {
      return;
    }

    const normalized = trimmed.toLowerCase();

    if (normalized.includes("npc collaboration") && normalized.includes("preview the next safe shell step")) {
      void Promise.all([
        loadOpenClawCapabilityOverview("npc"),
        matchEnabledLocalSkills(trimmed),
        loadWorkspaceOverview()
      ]).then(async ([npcOverview, skillMatch, workspaceOverview]) => {
        const topMatch = skillMatch.items[0];
        const ragResult = await searchLocalKnowledge(trimmed);
        const topPaths = ragResult.items.slice(0, 2).map((item) => item.title).join("、") || "暂无匹配来源";

        applyReadonlyTaskResult(setState, {
          message: trimmed,
          executionKind: "npc-local-enabled-rag-shell-handoff-preview",
          executionTitle: "NPC-assisted RAG shell handoff preview",
          executionAuditSummary: "网页端查看 NPC 协作 RAG shell handoff 预览",
          executionAuditDetail: `web npc rag shell handoff preview: ${trimmed}`,
          resultTitle: "NPC-assisted RAG shell handoff preview",
          resultSummary: [
            `${npcOverview.summary}`,
            `状态：${npcOverview.status}。`,
            `推荐 Skill：${topMatch?.name ?? "暂无"}。`,
            `注册表：${skillMatch.registry_path}。`,
            `主要来源：${topPaths}。`,
            "命令预览：Remove-Item -Recurse -Force temp-output。",
            `工作区根目录：${workspaceOverview.root_path}。`,
            "所需权限：controlled-full。",
            "安全状态：requires-snapshot。"
          ].join(" "),
          auditDetailLines: [
            `NPC status: ${npcOverview.status}`,
            `Recommended skill: ${topMatch?.name ?? "(none)"}`,
            `Registry: ${skillMatch.registry_path}`,
            `Top matches: ${topPaths}`,
            `Workspace root: ${workspaceOverview.root_path}`
          ]
        });
      });
      return;
    }

    if (normalized.includes("npc collaboration shell plan")) {
      void Promise.all([
        loadOpenClawCapabilityOverview("npc"),
        matchEnabledLocalSkills(trimmed),
        loadWorkspaceOverview()
      ]).then(([npcOverview, skillMatch, workspaceOverview]) => {
        const topMatch = skillMatch.items[0];

        applyReadonlyTaskResult(setState, {
          message: trimmed,
          executionKind: "npc-local-shell-plan-preview",
          executionTitle: "NPC shell plan preview",
          executionAuditSummary: "网页端查看 NPC shell 计划预览",
          executionAuditDetail: `web npc shell plan preview: ${trimmed}`,
          resultTitle: "NPC shell plan preview",
          resultSummary: [
            `${npcOverview.summary}`,
            `状态：${npcOverview.status}。`,
            `推荐 Skill：${topMatch?.name ?? "暂无"}。`,
            `注册表：${skillMatch.registry_path}。`,
            "命令预览：Remove-Item -Recurse -Force temp-output。",
            `工作区根目录：${workspaceOverview.root_path}。`,
            "所需权限：controlled-full。",
            "安全状态：requires-snapshot。"
          ].join(" "),
          auditDetailLines: [
            `NPC status: ${npcOverview.status}`,
            `Recommended skill: ${topMatch?.name ?? "(none)"}`,
            `Registry: ${skillMatch.registry_path}`,
            `Workspace root: ${workspaceOverview.root_path}`,
            "Command preview: Remove-Item -Recurse -Force temp-output"
          ]
        });
      });
      return;
    }

    if (normalized.includes("npc collaboration plan")) {
      void Promise.all([
        loadOpenClawCapabilityOverview("npc"),
        listEnabledLocalSkills()
      ]).then(async ([npcOverview, enabledSkills]) => {
        const ragResult = await searchLocalKnowledge(trimmed);
        const topPaths = ragResult.items.slice(0, 2).map((item) => item.title).join("、") || "暂无匹配来源";
        const skillNames = enabledSkills.items.slice(0, 3).map((item) => item.name).join("、") || "暂无";

        applyReadonlyTaskResult(setState, {
          message: trimmed,
          executionKind: "npc-local-collaboration-preview",
          executionTitle: "NPC collaboration preview",
          executionAuditSummary: "网页端查看 NPC 协作预览",
          executionAuditDetail: `web npc collaboration preview: ${trimmed}`,
          resultTitle: "NPC collaboration preview",
          resultSummary: [
            `${npcOverview.summary}`,
            `状态：${npcOverview.status}。`,
            `已启用 Skills：${skillNames}。`,
            `注册表：${enabledSkills.registry_path}。`,
            `本地上下文：${topPaths}。`,
            `已索引文档：${ragResult.indexed_document_count}。`
          ].join(" "),
          auditDetailLines: [
            `NPC status: ${npcOverview.status}`,
            `Enabled skills: ${skillNames}`,
            `Registry: ${enabledSkills.registry_path}`,
            `Local context: ${topPaths}`,
            `Indexed documents: ${ragResult.indexed_document_count}`
          ]
        });
      });
      return;
    }

    if (normalized.includes("scan local skills")) {
      void scanLocalSkills().then((result) => {
        const topSkills = result.items.slice(0, 3).map((item) => item.name).join("、") || "暂无可展示样例";
        const enabledSkills =
          result.items.filter((item) => item.enabled).map((item) => item.name).slice(0, 3).join("、") || "暂无";

        applyReadonlyTaskResult(setState, {
          message: trimmed,
          executionKind: "skills-local-scan",
          executionTitle: "本地 Skills 扫描",
          executionAuditSummary: "网页端触发了一次本地 Skills 扫描",
          executionAuditDetail: `web local skills scan: ${trimmed}`,
          resultTitle: "本地 Skills 扫描",
          resultSummary: [
            `扫描到 ${result.total_count} 个本地 Skills，覆盖 ${result.scanned_root_count} 个扫描根目录。`,
            `样例 Skills：${topSkills}。`,
            `已启用项：${enabledSkills}。`
          ].join(" "),
          auditDetailLines: result.items
            .slice(0, 3)
            .map((item) => `${item.name} | ${item.enabled ? "enabled" : "disabled"} | ${item.path}`)
        });
      });
      return;
    }

    if (normalized.includes("enabled skills")) {
      void listEnabledLocalSkills().then((result) => {
        const listedSkills = result.items.slice(0, 3).map((item) => item.name).join("、") || "暂无";

        applyReadonlyTaskResult(setState, {
          message: trimmed,
          executionKind: "skills-local-enabled-list",
          executionTitle: "已启用本地 Skills",
          executionAuditSummary: "网页端查看已启用本地 Skills",
          executionAuditDetail: `web enabled local skills list: ${trimmed}`,
          resultTitle: "已启用本地 Skills",
          resultSummary: [
            `当前启用 ${result.total_count} 个本地 Skill。`,
            `注册表：${result.registry_path}。`,
            `已启用项：${listedSkills}。`
          ].join(" "),
          auditDetailLines: result.items
            .slice(0, 3)
            .map((item) => `${item.name} | ${item.source} | ${item.path}`)
        });
      });
      return;
    }

    if (normalized.includes("details") && normalized.includes("skill")) {
      void inspectLocalSkill(trimmed).then((result) => {
        const topMatch = result.items[0];

        if (!topMatch) {
          applyReadonlyTaskResult(setState, {
            message: trimmed,
            executionKind: "skills-local-inspect",
            executionTitle: "本地 Skill 详情",
            executionAuditSummary: "网页端查看本地 Skill 详情",
            executionAuditDetail: `web local skill inspect: ${trimmed}`,
            resultTitle: "本地 Skill 详情",
            resultSummary: `未找到匹配 Skill。检索问题：${result.query}。`,
            auditDetailLines: ["No matching local skill found in browser preview."]
          });
          return;
        }

        applyReadonlyTaskResult(setState, {
          message: trimmed,
          executionKind: "skills-local-inspect",
          executionTitle: "本地 Skill 详情",
          executionAuditSummary: "网页端查看本地 Skill 详情",
          executionAuditDetail: `web local skill inspect: ${trimmed}`,
          resultTitle: "本地 Skill 详情",
          resultSummary: [
            `找到 ${result.match_count} 个匹配 Skill，覆盖 ${result.scanned_root_count} 个扫描根目录。`,
            `匹配项：${topMatch.name}。`,
            `启用状态：${topMatch.enabled ? "已启用" : "未启用"}。`,
            `说明：${topMatch.description}。`,
            `内容预览：${topMatch.content_preview}`
          ].join(" "),
          auditDetailLines: [
            `Skill path: ${topMatch.path}`,
            `Skill source: ${topMatch.source}`,
            `Skill enabled: ${topMatch.enabled ? "yes" : "no"}`
          ]
        });
      });
      return;
    }

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

    if (normalized.includes("search local knowledge")) {
      startTransition(() => {
        setState((current) => {
          const queued = createUserTaskSubmittedState(current, {
            message: trimmed,
            executionKind: "rag-local-doc-search",
            executionTitle: "本地 RAG 文档检索",
            executionAuditSummary: "网页端触发了一次本地知识检索",
            executionAuditDetail: `web local rag search: ${trimmed}`
          });
          const started = createTaskExecutionStartedState(queued);
          const result = searchWebKnowledge(trimmed);

          return createTaskExecutionSucceededState(started, {
            resultTitle: "本地 RAG 文档检索",
            resultSummary: createLocalRagSearchResultSummary(result),
            auditDetailLines: result.items.slice(0, 3).map((item) => `${item.title}: ${item.snippet}`)
          });
        });
      });
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
