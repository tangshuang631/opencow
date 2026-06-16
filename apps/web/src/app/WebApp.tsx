import { startTransition, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  disableLocalSkill,
  enableLocalSkill,
  installLocalSkill,
  inspectLocalSkill,
  loadOpenClawCapabilityOverview,
  loadWorkspaceOverview,
  listEnabledLocalSkills,
  matchEnabledLocalSkills,
  inspectLocalMcpPlugin,
  previewLocalMcpPluginStart,
  scanLocalMcpPlugins,
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
import {
  clearWebKnowledgeRecord,
  persistWebKnowledgeRecord,
  readWebKnowledgeRecord,
  type WebKnowledgeRecord
} from "./webKnowledgeStorage";
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

type WebKnowledgeLibrary = {
  id: string;
  label: string;
  importedFiles: ImportedKnowledgeFile[];
  availableFiles: AvailableKnowledgeFile[];
};

function createDefaultKnowledgeRecord(): WebKnowledgeRecord {
  return {
    activeLibraryId: "default-library",
    libraries: [
      {
        id: "default-library",
        label: "默认知识库",
        importedFiles: []
      }
    ]
  };
}

function createKnowledgeLibraryState(record: WebKnowledgeRecord, libraryId: string): WebKnowledgeLibrary {
  const activeLibrary =
    record.libraries.find((library) => library.id === libraryId)
    ?? record.libraries[0]
    ?? createDefaultKnowledgeRecord().libraries[0];
  const importedFiles = activeLibrary.importedFiles.map((item) => ({
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
    id: activeLibrary.id,
    label: activeLibrary.label,
    importedFiles,
    availableFiles
  };
}

function createKnowledgeStateFromRecord(record: WebKnowledgeRecord): {
  activeLibraryId: string;
  activeLibraryLabel: string;
  libraries: WebKnowledgeRecord["libraries"];
  importedFiles: ImportedKnowledgeFile[];
  availableFiles: AvailableKnowledgeFile[];
  knowledgeCount: number;
} {
  const activeLibrary = createKnowledgeLibraryState(record, record.activeLibraryId);

  return {
    activeLibraryId: activeLibrary.id,
    activeLibraryLabel: activeLibrary.label,
    libraries: record.libraries,
    importedFiles: activeLibrary.importedFiles,
    availableFiles: activeLibrary.availableFiles,
    knowledgeCount: activeLibrary.importedFiles.length
  };
}

function createKnowledgeStatePatch(record: WebKnowledgeRecord) {
  const activeLibrary = createKnowledgeLibraryState(record, record.activeLibraryId);

  return {
    knowledge: {
      importedFiles: activeLibrary.importedFiles,
      availableFiles: activeLibrary.availableFiles
    },
    storage: {
      knowledgeCount: activeLibrary.importedFiles.length
    },
    webKnowledge: {
      activeLibraryId: activeLibrary.id,
      activeLibraryLabel: activeLibrary.label,
      libraries: record.libraries
    }
  };
}

function createKnowledgeLibraryId(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-\u4e00-\u9fa5]/g, "")
    || `knowledge-${Date.now()}`;
}

function createLocalRagSearchResultSummaryWithLibrary(
  libraryLabel: string,
  result: ReturnType<typeof searchWebKnowledge>
) {
  const topPaths = result.items.slice(0, 2).map((item) => item.title).join("、") || "暂无匹配来源";

  return [
    `知识库：${libraryLabel}。`,
    `找到 ${result.match_count} 条匹配片段，已索引 ${result.indexed_document_count} 个文档。`,
    `主要来源：${topPaths}。`,
    `检索问题：${result.query}。`
  ].join(" ");
}

function createHydratedWebState(state: WorkbenchState): WorkbenchState {
  const knowledge = createKnowledgeStateFromRecord(readWebKnowledgeRecord());

  return {
    ...state,
    knowledge: {
      importedFiles: knowledge.importedFiles,
      availableFiles: knowledge.availableFiles
    },
    storage: {
      ...state.storage,
      knowledgeCount: knowledge.knowledgeCount
    },
    webKnowledge: {
      activeLibraryId: knowledge.activeLibraryId,
      activeLibraryLabel: knowledge.activeLibraryLabel,
      libraries: knowledge.libraries
    }
  } as WorkbenchState;
}

function preserveWebKnowledgeState(current: WorkbenchState, next: WorkbenchState): WorkbenchState {
  const currentBrowserState = current as WorkbenchState & {
    webKnowledge?: {
      activeLibraryId: string;
      activeLibraryLabel: string;
      libraries: WebKnowledgeRecord["libraries"];
    };
  };
  const nextBrowserState = next as WorkbenchState & {
    webKnowledge?: {
      activeLibraryId: string;
      activeLibraryLabel: string;
      libraries: WebKnowledgeRecord["libraries"];
    };
  };

  if (nextBrowserState.webKnowledge || !currentBrowserState.webKnowledge) {
    return next;
  }

  return {
    ...next,
    webKnowledge: currentBrowserState.webKnowledge
  } as WorkbenchState;
}

function withKnowledgeRecord(current: WorkbenchState, record: WebKnowledgeRecord) {
  const patch = createKnowledgeStatePatch(record);

  return {
    ...current,
    knowledge: patch.knowledge,
    storage: {
      ...current.storage,
      ...patch.storage
    },
    webKnowledge: patch.webKnowledge
  } as WorkbenchState;
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

      return preserveWebKnowledgeState(current, createTaskExecutionSucceededState(started, {
        resultTitle: payload.resultTitle,
        resultSummary: payload.resultSummary,
        auditDetailLines: payload.auditDetailLines
      }));
    });
  });
}

function tokenizeIntent(input: string) {
  return input.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
}

export function WebApp() {
  const webKnowledgeRecordRef = useRef<WebKnowledgeRecord>(readWebKnowledgeRecord());
  const [state, setState] = useState<WorkbenchState>(() =>
    mergeOllamaOverview(
      withKnowledgeRecord(
        loadPersistedWorkbenchStateFromBrowserStorage(createInitialWorkbenchState),
        webKnowledgeRecordRef.current
      ),
      {
        reachable: true,
        endpoint: "browser://local-first",
        selectedModel: "opencow-web-preview",
        diagnostic: "",
        models: [{ name: "opencow-web-preview", sizeLabel: "Browser Preview" }]
      }
    )
  );

  useEffect(() => {
    void persistWorkbenchState(state);
    persistWebKnowledgeRecord(webKnowledgeRecordRef.current);
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
    const intentTokens = tokenizeIntent(trimmed);

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

    if (intentTokens.includes("install") && intentTokens.includes("skill")) {
      void installLocalSkill(trimmed).then((result) => {
        applyReadonlyTaskResult(setState, {
          message: trimmed,
          executionKind: "skills-local-install",
          executionTitle: "本地 Skill 安装结果",
          executionAuditSummary: "网页端触发了一次本地 Skill 安装预览",
          executionAuditDetail: `web local skill install: ${trimmed}`,
          resultTitle: "本地 Skill 安装结果",
          resultSummary: [
            `已安装 Skill：${result.installed_skill_name}。`,
            `安装路径：${result.installed_skill_path}。`,
            `来源：${result.source_skill_path}。`,
            `状态：${result.status}。`
          ].join(" "),
          auditDetailLines: [
            `Installed skill: ${result.installed_skill_name}`,
            `Installed path: ${result.installed_skill_path}`,
            `Source path: ${result.source_skill_path}`
          ]
        });
      });
      return;
    }

    if ((intentTokens.includes("enable") || intentTokens.includes("activate")) && intentTokens.includes("skill")) {
      void enableLocalSkill(trimmed).then((result) => {
        applyReadonlyTaskResult(setState, {
          message: trimmed,
          executionKind: "skills-local-enable",
          executionTitle: "本地 Skill 启用结果",
          executionAuditSummary: "网页端触发了一次本地 Skill 启用预览",
          executionAuditDetail: `web local skill enable: ${trimmed}`,
          resultTitle: "本地 Skill 启用结果",
          resultSummary: [
            `已启用 Skill：${result.enabled_skill_name}。`,
            `注册表：${result.registry_path}。`,
            `状态：${result.status}。`
          ].join(" "),
          auditDetailLines: [
            `Enabled skill: ${result.enabled_skill_name}`,
            `Registry path: ${result.registry_path}`,
            `Enable status: ${result.status}`
          ]
        });
      });
      return;
    }

    if ((intentTokens.includes("disable") || intentTokens.includes("deactivate")) && intentTokens.includes("skill")) {
      void disableLocalSkill(trimmed).then((result) => {
        applyReadonlyTaskResult(setState, {
          message: trimmed,
          executionKind: "skills-local-disable",
          executionTitle: "本地 Skill 禁用结果",
          executionAuditSummary: "网页端触发了一次本地 Skill 禁用预览",
          executionAuditDetail: `web local skill disable: ${trimmed}`,
          resultTitle: "本地 Skill 禁用结果",
          resultSummary: [
            `已禁用 Skill：${result.disabled_skill_name}。`,
            `注册表：${result.registry_path}。`,
            `状态：${result.status}。`
          ].join(" "),
          auditDetailLines: [
            `Disabled skill: ${result.disabled_skill_name}`,
            `Registry path: ${result.registry_path}`,
            `Disable status: ${result.status}`
          ]
        });
      });
      return;
    }

    if (
      normalized.includes("which enabled skill")
      || normalized.includes("recommend an enabled skill")
      || normalized.includes("match this task against enabled skills")
    ) {
      void matchEnabledLocalSkills(trimmed).then((result) => {
        const topMatch = result.items[0];

        if (!topMatch) {
          applyReadonlyTaskResult(setState, {
            message: trimmed,
            executionKind: "skills-local-enabled-match",
            executionTitle: "已启用 Skill 推荐",
            executionAuditSummary: "网页端查看已启用 Skill 推荐",
            executionAuditDetail: `web enabled local skill match: ${trimmed}`,
            resultTitle: "已启用 Skill 推荐",
            resultSummary: `未找到匹配的已启用 Skill。注册表：${result.registry_path}。`,
            auditDetailLines: ["No matching enabled local skill found in browser preview."]
          });
          return;
        }

        applyReadonlyTaskResult(setState, {
          message: trimmed,
          executionKind: "skills-local-enabled-match",
          executionTitle: "已启用 Skill 推荐",
          executionAuditSummary: "网页端查看已启用 Skill 推荐",
          executionAuditDetail: `web enabled local skill match: ${trimmed}`,
          resultTitle: "已启用 Skill 推荐",
          resultSummary: [
            `从 ${result.enabled_skill_count} 个已启用 Skill 中找到 ${result.match_count} 个推荐项。`,
            `推荐 Skill：${topMatch.name}。`,
            `注册表：${result.registry_path}。`,
            `内容预览：${topMatch.content_preview}`
          ].join(" "),
          auditDetailLines: [
            `Recommended skill: ${topMatch.name}`,
            `Registry path: ${result.registry_path}`,
            `Enabled skill count: ${result.enabled_skill_count}`
          ]
        });
      });
      return;
    }

    if (normalized.includes("scan local mcp plugins")) {
      void scanLocalMcpPlugins().then((result) => {
        const topPlugins = result.items.slice(0, 3).map((item) => item.id).join("、") || "暂无可展示插件";
        const activationLine =
          result.items.slice(0, 3).map((item) => `${item.id}=${item.activation}`).join("、") || "暂无";

        applyReadonlyTaskResult(setState, {
          message: trimmed,
          executionKind: "mcp-local-plugin-scan",
          executionTitle: "本地 MCP 插件扫描",
          executionAuditSummary: "网页端触发了一次本地 MCP 插件扫描",
          executionAuditDetail: `web local mcp plugin scan: ${trimmed}`,
          resultTitle: "本地 MCP 插件扫描",
          resultSummary: [
            `扫描到 ${result.total_count} 个本地 MCP 插件入口，覆盖 ${result.scanned_root_count} 个扫描根目录。`,
            `样例插件：${topPlugins}。`,
            `激活方式：${activationLine}。`
          ].join(" "),
          auditDetailLines: result.items
            .slice(0, 3)
            .map((item) => `${item.id} | ${item.activation} | ${item.path}`)
        });
      });
      return;
    }

    if (normalized.includes("details") && normalized.includes("mcp plugin")) {
      void inspectLocalMcpPlugin(trimmed).then((result) => {
        const topMatch = result.items[0];

        if (!topMatch) {
          applyReadonlyTaskResult(setState, {
            message: trimmed,
            executionKind: "mcp-local-plugin-inspect",
            executionTitle: "本地 MCP 插件详情",
            executionAuditSummary: "网页端查看本地 MCP 插件详情",
            executionAuditDetail: `web local mcp plugin inspect: ${trimmed}`,
            resultTitle: "本地 MCP 插件详情",
            resultSummary: `未找到匹配 MCP 插件。检索问题：${result.query}。`,
            auditDetailLines: ["No matching local MCP plugin found in browser preview."]
          });
          return;
        }

        const toolsLine = topMatch.tool_names.length > 0 ? topMatch.tool_names.join("、") : "暂无";
        const skillsLine = topMatch.skill_paths.length > 0 ? topMatch.skill_paths.join("、") : "暂无";

        applyReadonlyTaskResult(setState, {
          message: trimmed,
          executionKind: "mcp-local-plugin-inspect",
          executionTitle: "本地 MCP 插件详情",
          executionAuditSummary: "网页端查看本地 MCP 插件详情",
          executionAuditDetail: `web local mcp plugin inspect: ${trimmed}`,
          resultTitle: "本地 MCP 插件详情",
          resultSummary: [
            `找到 ${result.match_count} 个匹配 MCP 插件，覆盖 ${result.scanned_root_count} 个扫描根目录。`,
            `匹配项：${topMatch.id}。`,
            `激活方式：${topMatch.activation}。`,
            `工具：${toolsLine}。`,
            `Skills 路径：${skillsLine}。`,
            `说明：${topMatch.description}`
          ].join(" "),
          auditDetailLines: [
            `Plugin path: ${topMatch.path}`,
            `Plugin source: ${topMatch.source}`,
            `Activation: ${topMatch.activation}`
          ]
        });
      });
      return;
    }

    if (normalized.includes("preview starting") && normalized.includes("mcp plugin")) {
      void previewLocalMcpPluginStart(trimmed).then((result) => {
        const topMatch = result.items[0];

        if (!topMatch) {
          applyReadonlyTaskResult(setState, {
            message: trimmed,
            executionKind: "mcp-local-plugin-start-preview",
            executionTitle: "本地 MCP 插件启动预览",
            executionAuditSummary: "网页端查看本地 MCP 插件启动预览",
            executionAuditDetail: `web local mcp plugin start preview: ${trimmed}`,
            resultTitle: "本地 MCP 插件启动预览",
            resultSummary: `未找到可预览启动的 MCP 插件。检索问题：${result.query}。`,
            auditDetailLines: ["No launch-previewable local MCP plugin found in browser preview."]
          });
          return;
        }

        const localizedCommandPreview = /no resolved executable launcher/i.test(topMatch.command_preview)
          ? "当前桌面端尚未实现已验证的 MCP 插件启动器"
          : topMatch.command_preview;
        const localizedConfigHint = /no required config schema fields were detected/i.test(topMatch.config_hint)
          ? "未检测到必填配置项"
          : topMatch.config_hint;
        const localizedRiskSummary =
          /preview only/i.test(topMatch.risk_summary)
          && /does not yet resolve or launch a real local mcp plugin process/i.test(topMatch.risk_summary)
            ? "仅预览插件 manifest，不会启动真实 MCP 进程"
            : topMatch.risk_summary;

        applyReadonlyTaskResult(setState, {
          message: trimmed,
          executionKind: "mcp-local-plugin-start-preview",
          executionTitle: "本地 MCP 插件启动预览",
          executionAuditSummary: "网页端查看本地 MCP 插件启动预览",
          executionAuditDetail: `web local mcp plugin start preview: ${trimmed}`,
          resultTitle: "本地 MCP 插件启动预览",
          resultSummary: [
            `找到 ${result.match_count} 个可预览 MCP 插件，覆盖 ${result.scanned_root_count} 个扫描根目录。`,
            `匹配项：${topMatch.id}。`,
            `激活方式：${topMatch.activation}。`,
            `允许启动：${topMatch.startup_allowed ? "是" : "否"}。`,
            `工作目录：${topMatch.working_directory}。`,
            `命令预览：${localizedCommandPreview}。`,
            `配置提示：${localizedConfigHint}。`,
            `风险说明：${localizedRiskSummary}。`
          ].join(" "),
          auditDetailLines: [
            `Plugin path: ${topMatch.path}`,
            `Working directory: ${topMatch.working_directory}`,
            `Startup allowed: ${topMatch.startup_allowed ? "yes" : "no"}`
          ]
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
          const currentBrowserState = current as WorkbenchState & {
            webKnowledge?: {
              activeLibraryLabel: string;
            };
          };
          const browserRecord = webKnowledgeRecordRef.current;
          const queued = createUserTaskSubmittedState(current, {
            message: trimmed,
            executionKind: "rag-local-doc-search",
            executionTitle: "本地 RAG 文档检索",
            executionAuditSummary: "网页端触发了一次本地知识检索",
            executionAuditDetail: `web local rag search: ${trimmed}`
          });
          const started = createTaskExecutionStartedState(queued);
          const result = searchWebKnowledge(trimmed, browserRecord);

          const succeeded = createTaskExecutionSucceededState(started, {
            resultTitle: "本地 RAG 文档检索",
            resultSummary: createLocalRagSearchResultSummaryWithLibrary(
              currentBrowserState.webKnowledge?.activeLibraryLabel ?? "默认知识库",
              result
            ),
            auditDetailLines: result.items
              .slice(0, 3)
              .map((item) => `命中片段：${item.title}: ${item.snippet}`)
          });

          return preserveWebKnowledgeState(current, succeeded);
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

        return preserveWebKnowledgeState(current, createTaskExecutionSucceededState(started, {
          resultTitle: "网页端本地会话答复",
          resultSummary: `已为网页端保留这段上下文：${trimmed}`,
          auditDetailLines: ["Web MVP keeps browser history, recent sessions, and local knowledge context."]
        }));
      });
    });
  }

  function handleCleanupStorage(target: "conversation" | "logs" | "cache" | "snapshots" | "knowledge") {
    if (target === "conversation") {
      void clearPersistedWorkbenchState();
    }

    if (target === "knowledge") {
      const currentRecord = webKnowledgeRecordRef.current;
      const clearedRecord: WebKnowledgeRecord = {
        activeLibraryId: currentRecord.activeLibraryId,
        libraries: currentRecord.libraries.map((library) => ({
          ...library,
          importedFiles: []
        }))
      };
      webKnowledgeRecordRef.current = clearedRecord;
      persistWebKnowledgeRecord(clearedRecord);
    }

    startTransition(() => {
      setState((current) => {
        const cleared = createStorageCleanupState(current, target);

        if (target !== "knowledge") {
          return cleared;
        }

        return withKnowledgeRecord(cleared, webKnowledgeRecordRef.current);
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
        const browserRecord = webKnowledgeRecordRef.current;
        const nextImported = [
          ...current.knowledge.importedFiles,
          {
            path: sample.path,
            title: sample.title,
            status: "ready" as const
          }
        ];
        const nextRecord: WebKnowledgeRecord = {
          ...browserRecord,
          libraries: browserRecord.libraries.map((library) =>
            library.id === browserRecord.activeLibraryId
              ? {
                  ...library,
                  importedFiles: nextImported.map((item) => {
                    const importedSample = WEB_SAMPLE_DOCS.find((doc) => doc.path === item.path);

                    return {
                      path: item.path,
                      title: item.title,
                      status: item.status,
                      content: importedSample?.content ?? ""
                    };
                  })
                }
              : library
          )
        };
        webKnowledgeRecordRef.current = nextRecord;

        return withKnowledgeRecord({
          ...current,
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
        } as WorkbenchState, nextRecord);
      });
    });
  }

  function handleRemoveKnowledgeFile(path: string) {
    const sample = WEB_SAMPLE_DOCS.find((item) => item.path === path);

    startTransition(() => {
      setState((current) => {
        const browserRecord = webKnowledgeRecordRef.current;
        const nextImported = current.knowledge.importedFiles.filter((item) => item.path !== path);
        const nextAvailable = sample
          ? [...current.knowledge.availableFiles, { path: sample.path, title: sample.title }]
          : current.knowledge.availableFiles;
        const nextRecord: WebKnowledgeRecord = {
          ...browserRecord,
          libraries: browserRecord.libraries.map((library) =>
            library.id === browserRecord.activeLibraryId
              ? {
                  ...library,
                  importedFiles: nextImported.map((item) => {
                    const importedSample = WEB_SAMPLE_DOCS.find((doc) => doc.path === item.path);

                    return {
                      path: item.path,
                      title: item.title,
                      status: item.status,
                      content: importedSample?.content ?? ""
                    };
                  })
                }
              : library
          )
        };
        webKnowledgeRecordRef.current = nextRecord;

        return withKnowledgeRecord({
          ...current,
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
        } as WorkbenchState, {
          ...nextRecord,
          libraries: nextRecord.libraries.map((library) =>
            library.id === nextRecord.activeLibraryId
              ? {
                  ...library,
                  importedFiles: nextImported.map((item) => {
                    const importedSample = WEB_SAMPLE_DOCS.find((doc) => doc.path === item.path);

                    return {
                      path: item.path,
                      title: item.title,
                      status: item.status,
                      content: importedSample?.content ?? ""
                    };
                  })
                }
              : library
          )
        });
      });
    });
  }

  function handleCreateKnowledgeLibrary(name: string) {
    startTransition(() => {
      setState((current) => {
        const currentRecord = webKnowledgeRecordRef.current;
        const nextLibraryId = createKnowledgeLibraryId(name);

        if (currentRecord.libraries.some((library) => library.id === nextLibraryId || library.label === name)) {
          const existing = currentRecord.libraries.find((library) => library.id === nextLibraryId || library.label === name);
          const existingRecord = {
            ...currentRecord,
            activeLibraryId: existing?.id ?? currentRecord.activeLibraryId
          };
          webKnowledgeRecordRef.current = existingRecord;
          return withKnowledgeRecord(current, existingRecord);
        }

        const nextRecord: WebKnowledgeRecord = {
          activeLibraryId: nextLibraryId,
          libraries: [
            ...currentRecord.libraries,
            {
              id: nextLibraryId,
              label: name,
              importedFiles: []
            }
          ]
        };
        webKnowledgeRecordRef.current = nextRecord;

        return withKnowledgeRecord({
          ...current,
          output: {
            title: "知识库已更新",
            summary: `已创建知识库 ${name}，后续导入和检索会优先使用这套上下文。`
          },
          audit: {
            summary: "网页端知识库已创建命名知识库",
            lastEvent: {
              module: "knowledge",
              detail: `created library ${name}`,
              timestamp: "created",
              source: "web_knowledge_library_create"
            }
          }
        } as WorkbenchState, nextRecord);
      });
    });
  }

  function handleSelectKnowledgeLibrary(libraryId: string) {
    setState((current) => {
      const currentRecord = webKnowledgeRecordRef.current;
      const nextRecord: WebKnowledgeRecord = {
        ...currentRecord,
        activeLibraryId: libraryId
      };
      const nextLabel = currentRecord.libraries.find((library) => library.id === libraryId)?.label ?? "默认知识库";
      webKnowledgeRecordRef.current = nextRecord;

      return withKnowledgeRecord({
        ...current,
        output: {
          title: "知识库已更新",
          summary: `已切换到知识库 ${nextLabel}。`
        },
        audit: {
          summary: "网页端知识库已切换当前知识库",
          lastEvent: {
            module: "knowledge",
            detail: `selected library ${nextLabel}`,
            timestamp: "selected",
            source: "web_knowledge_library_select"
          }
        }
      } as WorkbenchState, nextRecord);
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
          setState((current) => preserveWebKnowledgeState(current, createModelSelectedState(current, modelName)));
        });
      }}
      onNewConversation={() => {
        startTransition(() => {
          setState((current) => preserveWebKnowledgeState(current, createNewConversationState(current)));
        });
      }}
      onRestoreRecentConversation={(conversationId) => {
        startTransition(() => {
          setState((current) => preserveWebKnowledgeState(current, restoreRecentConversationState(current, conversationId)));
        });
      }}
      onDeleteRecentConversation={(conversationId) => {
        startTransition(() => {
          setState((current) => preserveWebKnowledgeState(current, deleteRecentConversationState(current, conversationId)));
        });
      }}
      onImportKnowledgeFile={handleImportKnowledgeFile}
      onRemoveKnowledgeFile={handleRemoveKnowledgeFile}
      knowledgeLibraryLabel={
        (state as WorkbenchState & {
          webKnowledge?: { activeLibraryLabel: string };
        }).webKnowledge?.activeLibraryLabel
      }
      knowledgeLibraries={
        ((state as WorkbenchState & {
          webKnowledge?: {
            libraries: WebKnowledgeRecord["libraries"];
            activeLibraryId: string;
          };
        }).webKnowledge?.libraries ?? []).map((library) => ({
          ...library,
          active:
            library.id
            === (state as WorkbenchState & {
              webKnowledge?: { activeLibraryId: string };
            }).webKnowledge?.activeLibraryId
        }))
      }
      onCreateKnowledgeLibrary={handleCreateKnowledgeLibrary}
      onSelectKnowledgeLibrary={handleSelectKnowledgeLibrary}
      onSubmitTask={handleSubmitTask}
    />
  );
}
