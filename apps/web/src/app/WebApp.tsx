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
  createArchivedConversationState,
  createOllamaLoadErrorState,
  createInitialWorkbenchState,
  createModelSelectedState,
  createNewConversationState,
  createStorageCleanupState,
  createTaskExecutionFailedState,
  createTaskExecutionStartedState,
  createTaskExecutionSucceededState,
  createUserTaskSubmittedState,
  deleteRecentConversationState,
  mergeOllamaOverview,
  restoreRecentConversationState
} from "../../../desktop/src/features/workbench/workbenchState";
import { loadOllamaOverview } from "../../../desktop/src/features/ollama/ollamaService";
import { chatWithOllamaModel } from "../../../desktop/src/features/ollama/ollamaService";
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

type WebKnowledgeSourceFile = {
  path: string;
  title: string;
  content: string;
};

type WebKnowledgeLibrary = {
  id: string;
  label: string;
  importedFiles: ImportedKnowledgeFile[];
  availableFiles: AvailableKnowledgeFile[];
};

function createKnowledgeSourceFiles(record: WebKnowledgeRecord): WebKnowledgeSourceFile[] {
  return [
    ...WEB_SAMPLE_DOCS,
    ...(record.customFiles ?? []).map((file) => ({
      path: file.path,
      title: file.title,
      content: file.content
    }))
  ];
}

function createDefaultKnowledgeRecord(): WebKnowledgeRecord {
  return {
    activeLibraryId: "default-library",
    customFiles: [],
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
  const sourceFiles = createKnowledgeSourceFiles(record);
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
  const availableFiles = sourceFiles
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

function readTextFileContent(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(reader.error ?? new Error("Failed to read local knowledge file."));
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsText(file);
  });
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
    `检索方式：${formatLocalRagProvider(result)}。`,
    `主要来源：${topPaths}。`,
    `检索问题：${result.query}。`
  ].join(" ");
}

function formatLocalRagProvider(result: Pick<ReturnType<typeof searchWebKnowledge>, "provider">) {
  if (result.provider === "ollama-embedding") {
    return "Ollama Embedding";
  }

  return "关键词 fallback";
}

function createKnowledgeHitAuditDetailLines(result: ReturnType<typeof searchWebKnowledge>) {
  return result.items.slice(0, 3).flatMap((item) => {
    const followUpQuery = `search local knowledge in ${item.title} for ${result.query.replace(/^search local knowledge for /i, "").trim()}`;

    return [
      `命中片段：${item.title}: ${item.snippet}`,
      `命中卡片：来源文件=${item.title}；匹配分数=${item.score}；片段预览=${item.snippet}；回查指令=${followUpQuery}`
    ];
  });
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
    `检索方式：${formatLocalRagProvider(result)}。`,
    `主要来源：${topPaths}。`,
    `检索问题：${result.query}。`
  ].join(" ");
}

function isLongWebPrompt(message: string) {
  return normalizePrompt(message).length > 220;
}

function normalizePrompt(message: string) {
  return message.replace(/\s+/g, " ").trim();
}

function resolveUsableWebChatModel(state: WorkbenchState) {
  const activeModel = state.model.activeModel.trim();

  if (activeModel && activeModel !== "未选择模型") {
    return activeModel;
  }

  return state.model.availableModels[0]?.name ?? "";
}

function createWebLocalChatPrompt(message: string, libraryLabel: string, result: ReturnType<typeof searchWebKnowledge>) {
  const hitLines = result.items.slice(0, 3).map((item, index) => (
    `${index + 1}. ${item.title}: ${item.snippet}`
  ));

  return [
    "你是 OpenCow 网页端的本地助手。",
    "请优先用中文直接回答用户问题，先给结论，再给简要解析。",
    "如果题目较长，请自行提炼重点，不要原样复读整段题干。",
    "如果下方提供了本地知识命中，可按需参考；如果不相关，就忽略它们。",
    "",
    `当前知识库：${libraryLabel}`,
    `用户问题：${message}`,
    hitLines.length > 0 ? `本地知识命中：\n${hitLines.join("\n")}` : "本地知识命中：暂无明确命中"
  ].join("\n");
}

function createWebLocalChatAuditDetailLines(
  modelName: string,
  result: ReturnType<typeof searchWebKnowledge>,
  doneReason?: string
) {
  const topPaths = formatTopKnowledgeSources(result);

  return [
    `Ollama model: ${modelName}`,
    `Knowledge library sources: ${topPaths}`,
    `Indexed documents: ${result.indexed_document_count}`,
    `Ollama done reason: ${doneReason ?? "stop"}`
  ];
}

function formatTopKnowledgeSources(result: ReturnType<typeof searchWebKnowledge>) {
  return result.items.slice(0, 2).map((item) => item.title).join("、") || "暂无匹配来源";
}

function createWebCapabilityResultSummary(overview: Awaited<ReturnType<typeof loadWebCapabilityOverview>>) {
  const availableLine = overview.available_packages.join("、") || "无";
  const missingLine = overview.missing_packages.join("、") || "无";
  const sampleLine = overview.sampleItems.join("、") || "暂无";

  return [
    `状态：${overview.status}。`,
    overview.summary,
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

function getReadableErrorDetail(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return "Unknown browser-preview failure.";
}

function applyReadonlyTaskFailure(
  setState: Dispatch<SetStateAction<WorkbenchState>>,
  payload: {
    message: string;
    executionKind: string;
    executionTitle: string;
    executionAuditSummary: string;
    executionAuditDetail: string;
    failureSummary: string;
    failureDetail: string;
    failureActionLabel: string;
    failureSource: string;
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

      return preserveWebKnowledgeState(current, createTaskExecutionFailedState(started, {
        summary: payload.failureSummary,
        detail: payload.failureDetail,
        actionLabel: payload.failureActionLabel,
        source: payload.failureSource
      }));
    });
  });
}

function executeReadonlyAsyncTask<T>(
  setState: Dispatch<SetStateAction<WorkbenchState>>,
  payload: {
    message: string;
    executionKind: string;
    executionTitle: string;
    executionAuditSummary: string;
    executionAuditDetail: string;
    failureSummary: string;
    failureActionLabel: string;
    failureSource: string;
    run: () => Promise<T>;
    onSuccess: (result: T) => {
      resultTitle: string;
      resultSummary: string;
      auditDetailLines: string[];
    };
  }
) {
  void payload.run().then((result) => {
    const success = payload.onSuccess(result);

    applyReadonlyTaskResult(setState, {
      message: payload.message,
      executionKind: payload.executionKind,
      executionTitle: payload.executionTitle,
      executionAuditSummary: payload.executionAuditSummary,
      executionAuditDetail: payload.executionAuditDetail,
      resultTitle: success.resultTitle,
      resultSummary: success.resultSummary,
      auditDetailLines: success.auditDetailLines
    });
  }).catch((error: unknown) => {
    const failureDetail = [
      payload.executionAuditDetail,
      `Underlying browser-preview error: ${getReadableErrorDetail(error)}`
    ].join(". ");

    applyReadonlyTaskFailure(setState, {
      message: payload.message,
      executionKind: payload.executionKind,
      executionTitle: payload.executionTitle,
      executionAuditSummary: payload.executionAuditSummary,
      executionAuditDetail: payload.executionAuditDetail,
      failureSummary: payload.failureSummary,
      failureDetail,
      failureActionLabel: payload.failureActionLabel,
      failureSource: payload.failureSource
    });
  });
}

function tokenizeIntent(input: string) {
  return input.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
}

function isCapabilityOverviewRequest(normalized: string, capabilityId: "rag" | "skills" | "npc" | "mcp") {
  return normalized.includes(`show ${capabilityId} capability overview`)
    || normalized.includes(`${capabilityId} capability overview`)
    || normalized.includes(`查看 ${capabilityId} 能力概览`)
    || normalized.includes(`${capabilityId} 能力概览`);
}

function isChineseSkillScanRequest(normalized: string) {
  return normalized.includes("扫描本地 skills") || normalized.includes("扫描本地 skill");
}

function isChineseEnabledSkillsListRequest(normalized: string) {
  return normalized.includes("查看已启用 skills")
    || normalized.includes("查看已启用 skill")
    || normalized.includes("查看启用的 skills");
}

function isChineseSkillInspectRequest(normalized: string) {
  return normalized.includes("查看") && normalized.includes("skill") && normalized.includes("详情");
}

function isChineseMcpInspectRequest(normalized: string) {
  return normalized.includes("查看") && normalized.includes("mcp") && normalized.includes("插件详情");
}

function isChineseKnowledgeSearchRequest(normalized: string) {
  return normalized.includes("搜索本地知识库")
    || normalized.includes("检索本地知识库")
    || /^只搜索\s+.+\s+里[的地]\s+.+/.test(normalized);
}

function isChineseNpcCollaborationPreviewRequest(normalized: string) {
  return normalized.includes("npc") && normalized.includes("协作") && (normalized.includes("预览") || normalized.includes("方案"));
}

function isNpcTemplatePreviewRequest(normalized: string) {
  return normalized.includes("npc")
    && (normalized.includes("模板") || normalized.includes("template") || normalized.includes("配置建议") || normalized.includes("默认配置"))
    && !normalized.includes("保存")
    && !normalized.includes("写入")
    && !normalized.includes("落盘");
}

function inferWebNpcTemplateName(input: string) {
  if (/课程|学习|作业|课堂/.test(input)) {
    return "课程助手";
  }

  if (/文档|资料|报告|知识库|rag/i.test(input)) {
    return "文档处理助手";
  }

  if (/代码|开发|工程|repo|仓库/i.test(input)) {
    return "开发协作助手";
  }

  return "通用工作助手";
}

function createWebNpcTemplatePreviewSummary(input: string) {
  const templateName = inferWebNpcTemplateName(input);

  return [
    `名称：${templateName}。`,
    "系统提示词：你是 opencow 的本地协作 NPC，先检索项目规则和知识库，再给出简洁、可执行、可审计的建议。",
    "默认模型：跟随当前已选 Ollama 模型。",
    "默认工具：本地 RAG 检索、已启用 Skills 匹配、只读工作区检查。",
    "默认知识库：当前工作区知识库。",
    "风险策略：默认只读；写文件、启动服务、Shell 执行前必须进入权限确认链路。",
    "输出风格：中文优先，先给结论，再列关键依据和下一步。",
    "这是只读模板预览，保存前仍需 workspace-write 权限。"
  ].join(" ");
}

function isChineseSkillInstallRequest(normalized: string) {
  return normalized.includes("安装") && normalized.includes("skill");
}

function isChineseSkillEnableRequest(normalized: string) {
  return normalized.includes("启用")
    && normalized.includes("skill")
    && !normalized.includes("已启用")
    && !normalized.includes("查看");
}

function isChineseSkillDisableRequest(normalized: string) {
  return normalized.includes("禁用") && normalized.includes("skill");
}

function isChineseMcpStartPreviewRequest(normalized: string) {
  return normalized.includes("预览启动") && normalized.includes("mcp");
}

function isChineseNpcShellPlanPreviewRequest(normalized: string) {
  return normalized.includes("npc") && normalized.includes("shell") && normalized.includes("计划");
}

function isChineseEnabledSkillMatchRequest(normalized: string) {
  return normalized.includes("已启用")
    && normalized.includes("skill")
    && (normalized.includes("推荐") || normalized.includes("匹配") || normalized.includes("哪个") || normalized.includes("处理"));
}

function isChineseSkillAssistedRagRequest(normalized: string) {
  return normalized.includes("已启用")
    && normalized.includes("skill")
    && (normalized.includes("搜索") || normalized.includes("检索"))
    && (normalized.includes("规则") || normalized.includes("文档") || normalized.includes("知识库") || normalized.includes("说明"));
}

function extractExplicitSkillHint(input: string) {
  const normalized = input.toLowerCase();
  const match = normalized.match(/([a-z0-9-]+)\s+skill/);

  if (!match) {
    return "";
  }

  return (match[1] ?? "").trim();
}

function pickMatchedSkillByHint<
  T extends {
    name: string;
  }
>(items: T[], hint: string) {
  if (!hint) {
    return items[0];
  }

  return items.find((item) => item.name.toLowerCase().includes(hint)) ?? items[0];
}

function convertChineseScopedKnowledgeQuery(input: string) {
  const match = input.match(/只搜索\s+(.+?)\s+里[的地]\s+(.+)/);

  if (!match) {
    return input;
  }

  const source = (match[1] ?? "").trim();
  const query = (match[2] ?? "").trim();

  if (!source || !query) {
    return input;
  }

  return `search local knowledge in ${source} for ${query}`;
}

function isChineseScopedKnowledgeRequest(input: string) {
  return convertChineseScopedKnowledgeQuery(input) !== input;
}

export function WebApp() {
  const webKnowledgeRecordRef = useRef<WebKnowledgeRecord>(readWebKnowledgeRecord());
  const hasLoadedOllamaOverviewRef = useRef(false);
  const [state, setState] = useState<WorkbenchState>(() =>
    withKnowledgeRecord(
      loadPersistedWorkbenchStateFromBrowserStorage(createInitialWorkbenchState),
      webKnowledgeRecordRef.current
    )
  );

  useEffect(() => {
    void persistWorkbenchState(state);
    persistWebKnowledgeRecord(webKnowledgeRecordRef.current);
  }, [state]);

  useEffect(() => {
    if (hasLoadedOllamaOverviewRef.current) {
      return;
    }

    hasLoadedOllamaOverviewRef.current = true;

    void loadOllamaOverview()
      .then((overview) => {
        startTransition(() => {
          setState((current) => preserveWebKnowledgeState(current, mergeOllamaOverview(current, overview)));
        });
      })
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : "Unknown ollama load error";

        startTransition(() => {
          setState((current) => preserveWebKnowledgeState(current, createOllamaLoadErrorState(current, detail)));
        });
      });
  }, []);

  function setReadonlyCapabilitySummary(capabilityId: "rag" | "skills" | "npc" | "mcp") {
    const capabilityLabel = capabilityId.toUpperCase();

    executeReadonlyAsyncTask(setState, {
      message: `查看 ${capabilityLabel} 网页端能力概览`,
      executionKind: `capability-${capabilityId}-overview`,
      executionTitle: `${capabilityLabel} 能力概览`,
      executionAuditSummary: `查看 ${capabilityLabel} 网页端能力概览`,
      executionAuditDetail: `web capability overview: ${capabilityId}`,
      failureSummary: `${capabilityLabel} 能力概览读取失败`,
      failureActionLabel: `请先检查 openclaw ${capabilityLabel} 能力桥接、本地 vendor 适配和网页端只读入口，再重试。`,
      failureSource: `web_capability_${capabilityId}_overview`,
      run: () => loadWebCapabilityOverview(capabilityId),
      onSuccess: (overview) => ({
        resultTitle: `${overview.title} 网页端能力概览`,
        resultSummary: createWebCapabilityResultSummary(overview),
        auditDetailLines: [
          `Capability status: ${overview.status}`,
          `Available packages: ${overview.available_packages.join(", ") || "(none)"}`,
          `Missing packages: ${overview.missing_packages.join(", ") || "(none)"}`,
          `Sample items: ${overview.sampleItems.join(", ") || "(none)"}`,
          `Next step: ${overview.nextStep}`
        ]
      })
    });
  }

  function handleSubmitTask(message: string) {
    const trimmed = message.trim();
    const scopedKnowledgeMessage = convertChineseScopedKnowledgeQuery(trimmed);
    const isScopedChineseKnowledgeRequest = isChineseScopedKnowledgeRequest(trimmed);
    const intentTokens = tokenizeIntent(trimmed);

    if (!trimmed) {
      return;
    }

    const normalized = trimmed.toLowerCase();
    const scopedKnowledgeNormalized = scopedKnowledgeMessage.toLowerCase();

    if (
      (normalized.includes("npc collaboration") && normalized.includes("preview the next safe shell step"))
      || (normalized.includes("npc") && normalized.includes("预览下一步安全 shell"))
    ) {
      executeReadonlyAsyncTask(setState, {
        message: trimmed,
        executionKind: "npc-local-enabled-rag-shell-handoff-preview",
        executionTitle: "NPC-assisted RAG shell handoff preview",
        executionAuditSummary: "网页端查看 NPC 协作 RAG shell handoff 预览",
        executionAuditDetail: `web npc rag shell handoff preview: ${trimmed}`,
        failureSummary: "NPC 协作 RAG shell handoff 预览失败",
        failureActionLabel: "请先检查 NPC 状态、Skill 注册表、本地 RAG 数据源和工作区概览，再重试这条网页端预览请求。",
        failureSource: "web_npc_rag_shell_handoff_preview",
        run: async () => {
          const [npcOverview, skillMatch, workspaceOverview, ragResult] = await Promise.all([
            loadOpenClawCapabilityOverview("npc"),
            matchEnabledLocalSkills(trimmed),
            loadWorkspaceOverview(),
            searchLocalKnowledge(trimmed)
          ]);

          return { npcOverview, skillMatch, workspaceOverview, ragResult };
        },
        onSuccess: ({ npcOverview, skillMatch, workspaceOverview, ragResult }) => {
          const topMatch = skillMatch.items[0];
          const topPaths = ragResult.items.slice(0, 2).map((item) => item.title).join("、") || "暂无匹配来源";

          return {
            resultTitle: "NPC-assisted RAG shell handoff preview",
            resultSummary: [
              `${npcOverview.summary}`,
              `状态：${npcOverview.status}。`,
              `推荐 Skill：${topMatch?.name ?? "暂无"}。`,
              `注册表：${skillMatch.registry_path}。`,
              `检索方式：${formatLocalRagProvider(ragResult)}。`,
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
          };
        }
      });
      return;
    }

    if (
      normalized.includes("npc collaboration shell plan")
      || (normalized.includes("npc") && normalized.includes("shell") && normalized.includes("计划预览"))
      || isChineseNpcShellPlanPreviewRequest(normalized)
    ) {
      executeReadonlyAsyncTask(setState, {
        message: trimmed,
        executionKind: "npc-local-shell-plan-preview",
        executionTitle: "NPC shell plan preview",
        executionAuditSummary: "网页端查看 NPC shell 计划预览",
        executionAuditDetail: `web npc shell plan preview: ${trimmed}`,
        failureSummary: "NPC shell 计划预览失败",
        failureActionLabel: "请先检查 NPC 状态、Skill 匹配结果和工作区概览，再重试这条网页端 shell 计划预览。",
        failureSource: "web_npc_shell_plan_preview",
        run: async () => {
          const [npcOverview, skillMatch, workspaceOverview] = await Promise.all([
            loadOpenClawCapabilityOverview("npc"),
            matchEnabledLocalSkills(trimmed),
            loadWorkspaceOverview()
          ]);

          return { npcOverview, skillMatch, workspaceOverview };
        },
        onSuccess: ({ npcOverview, skillMatch, workspaceOverview }) => {
          const topMatch = skillMatch.items[0];

          return {
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
          };
        }
      });
      return;
    }

    if (isNpcTemplatePreviewRequest(normalized)) {
      startTransition(() => {
        setState((current) => {
          const queued = createUserTaskSubmittedState(current, {
            message: trimmed,
            executionKind: "npc-template-preview",
            executionTitle: "NPC default template preview",
            executionAuditSummary: "网页端查看 NPC 默认模板预览",
            executionAuditDetail: `web npc template preview: ${trimmed}`
          });
          const started = createTaskExecutionStartedState(queued);

          return preserveWebKnowledgeState(current, createTaskExecutionSucceededState(started, {
            resultTitle: "NPC 默认模板预览",
            resultSummary: createWebNpcTemplatePreviewSummary(trimmed),
            auditDetailLines: [
              "NPC template preview is readonly.",
              "Saving still requires workspace-write permission."
            ]
          }));
        });
      });
      return;
    }

    if (normalized.includes("npc collaboration plan") || isChineseNpcCollaborationPreviewRequest(normalized)) {
      executeReadonlyAsyncTask(setState, {
        message: trimmed,
        executionKind: "npc-local-collaboration-preview",
        executionTitle: "NPC collaboration preview",
        executionAuditSummary: "网页端查看 NPC 协作预览",
        executionAuditDetail: `web npc collaboration preview: ${trimmed}`,
        failureSummary: "NPC 协作预览失败",
        failureActionLabel: "请先检查 NPC 状态、已启用 Skills 列表和本地 RAG 上下文，再重试这条网页端协作预览。",
        failureSource: "web_npc_collaboration_preview",
        run: async () => {
          const [npcOverview, enabledSkills, ragResult] = await Promise.all([
            loadOpenClawCapabilityOverview("npc"),
            listEnabledLocalSkills(),
            searchLocalKnowledge(trimmed)
          ]);

          return { npcOverview, enabledSkills, ragResult };
        },
        onSuccess: ({ npcOverview, enabledSkills, ragResult }) => {
          const topPaths = ragResult.items.slice(0, 2).map((item) => item.title).join("、") || "暂无匹配来源";
          const skillNames = enabledSkills.items.slice(0, 3).map((item) => item.name).join("、") || "暂无";

          return {
            resultTitle: "NPC collaboration preview",
            resultSummary: [
              `${npcOverview.summary}`,
              `状态：${npcOverview.status}。`,
              `已启用 Skills：${skillNames}。`,
              `注册表：${enabledSkills.registry_path}。`,
              `本地上下文：${topPaths}。`,
              `检索方式：${formatLocalRagProvider(ragResult)}。`,
              `已索引文档：${ragResult.indexed_document_count}。`
            ].join(" "),
            auditDetailLines: [
              `NPC status: ${npcOverview.status}`,
              `Enabled skills: ${skillNames}`,
              `Registry: ${enabledSkills.registry_path}`,
              `Local context: ${topPaths}`,
              `Indexed documents: ${ragResult.indexed_document_count}`
            ]
          };
        }
      });
      return;
    }

    if (normalized.includes("scan local skills") || isChineseSkillScanRequest(normalized)) {
      executeReadonlyAsyncTask(setState, {
        message: trimmed,
        executionKind: "skills-local-scan",
        executionTitle: "本地 Skills 扫描",
        executionAuditSummary: "网页端触发了一次本地 Skills 扫描",
        executionAuditDetail: `web local skills scan: ${trimmed}`,
        failureSummary: "本地 Skills 扫描失败",
        failureActionLabel: "请先检查本地 Skills 扫描桥接、扫描根目录和 vendor/openclaw 适配，再重试。",
        failureSource: "web_local_skills_scan",
        run: () => scanLocalSkills(),
        onSuccess: (result) => {
          const topSkills = result.items.slice(0, 3).map((item) => item.name).join("、") || "暂无可展示样例";
          const enabledSkills =
            result.items.filter((item) => item.enabled).map((item) => item.name).slice(0, 3).join("、") || "暂无";

          return {
            resultTitle: "本地 Skills 扫描",
            resultSummary: [
              `扫描到 ${result.total_count} 个本地 Skills，覆盖 ${result.scanned_root_count} 个扫描根目录。`,
              `样例 Skills：${topSkills}。`,
              `已启用项：${enabledSkills}。`
            ].join(" "),
            auditDetailLines: result.items
              .slice(0, 3)
              .map((item) => `${item.name} | ${item.enabled ? "enabled" : "disabled"} | ${item.path}`)
          };
        }
      });
      return;
    }

    if ((intentTokens.includes("install") && intentTokens.includes("skill")) || isChineseSkillInstallRequest(normalized)) {
      executeReadonlyAsyncTask(setState, {
        message: trimmed,
        executionKind: "skills-local-install",
        executionTitle: "本地 Skill 安装结果",
        executionAuditSummary: "网页端触发了一次本地 Skill 安装预览",
        executionAuditDetail: `web local skill install: ${trimmed}`,
        failureSummary: "本地 Skill 安装失败",
        failureActionLabel: "请先检查 workspace skills 目录、vendor/openclaw 来源路径和安装桥接，再重试。",
        failureSource: "web_local_skill_install",
        run: () => installLocalSkill(trimmed),
        onSuccess: (result) => ({
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
        })
      });
      return;
    }

    if (
      ((intentTokens.includes("enable") || intentTokens.includes("activate")) && intentTokens.includes("skill"))
      || isChineseSkillEnableRequest(normalized)
    ) {
      executeReadonlyAsyncTask(setState, {
        message: trimmed,
        executionKind: "skills-local-enable",
        executionTitle: "本地 Skill 启用结果",
        executionAuditSummary: "网页端触发了一次本地 Skill 启用预览",
        executionAuditDetail: `web local skill enable: ${trimmed}`,
        failureSummary: "本地 Skill 启用失败",
        failureActionLabel: "请先检查启用注册表、目标 Skill 名称和本地桥接状态，再重试。",
        failureSource: "web_local_skill_enable",
        run: () => enableLocalSkill(trimmed),
        onSuccess: (result) => ({
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
        })
      });
      return;
    }

    if (
      ((intentTokens.includes("disable") || intentTokens.includes("deactivate")) && intentTokens.includes("skill"))
      || isChineseSkillDisableRequest(normalized)
    ) {
      executeReadonlyAsyncTask(setState, {
        message: trimmed,
        executionKind: "skills-local-disable",
        executionTitle: "本地 Skill 禁用结果",
        executionAuditSummary: "网页端触发了一次本地 Skill 禁用预览",
        executionAuditDetail: `web local skill disable: ${trimmed}`,
        failureSummary: "本地 Skill 禁用失败",
        failureActionLabel: "请先检查启用注册表、目标 Skill 名称和本地桥接状态，再重试。",
        failureSource: "web_local_skill_disable",
        run: () => disableLocalSkill(trimmed),
        onSuccess: (result) => ({
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
        })
      });
      return;
    }

    if (
      normalized.includes("which enabled skill")
      || normalized.includes("recommend an enabled skill")
      || normalized.includes("match this task against enabled skills")
      || (normalized.includes("推荐") && normalized.includes("已启用") && normalized.includes("skill"))
      || isChineseEnabledSkillMatchRequest(normalized)
    ) {
      executeReadonlyAsyncTask(setState, {
        message: trimmed,
        executionKind: "skills-local-enabled-match",
        executionTitle: "已启用 Skill 推荐",
        executionAuditSummary: "网页端查看已启用 Skill 推荐",
        executionAuditDetail: `web enabled local skill match: ${trimmed}`,
        failureSummary: "已启用 Skill 推荐失败",
        failureActionLabel: "请先检查 enabled skills 注册表、匹配桥接和任务描述，再重试。",
        failureSource: "web_enabled_local_skill_match",
        run: () => matchEnabledLocalSkills(trimmed),
        onSuccess: (result) => {
          const topMatch = result.items[0];

          if (!topMatch) {
            return {
              resultTitle: "已启用 Skill 推荐",
              resultSummary: `未找到匹配的已启用 Skill。注册表：${result.registry_path}。`,
              auditDetailLines: ["No matching enabled local skill found in browser preview."]
            };
          }

          return {
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
          };
        }
      });
      return;
    }

    if (isChineseSkillAssistedRagRequest(normalized)) {
      executeReadonlyAsyncTask(setState, {
        message: trimmed,
        executionKind: "skills-local-enabled-rag-doc-search",
        executionTitle: "Skill 辅助本地 RAG 检索",
        executionAuditSummary: "网页端查看 Skill 辅助本地 RAG 检索",
        executionAuditDetail: `web enabled skill rag search: ${trimmed}`,
        failureSummary: "Skill 辅助本地 RAG 检索失败",
        failureActionLabel: "请先检查 enabled skills 注册表、本地规则索引和 skill 到 RAG 的桥接链路，再重试。",
        failureSource: "web_enabled_skill_rag_search",
        run: async () => {
          const requestedSkillHint = extractExplicitSkillHint(trimmed);
          const [skillMatch, ragResult] = await Promise.all([
            matchEnabledLocalSkills(trimmed),
            searchLocalKnowledge(trimmed)
          ]);

          return { skillMatch, ragResult, requestedSkillHint };
        },
        onSuccess: ({ skillMatch, ragResult, requestedSkillHint }) => {
          const topMatch = pickMatchedSkillByHint(skillMatch.items, requestedSkillHint);
          const topPaths = ragResult.items.slice(0, 2).map((item) => item.title).join("、") || "暂无匹配来源";

          return {
            resultTitle: "Skill 辅助本地 RAG 检索",
            resultSummary: [
              `推荐 Skill：${topMatch?.name ?? "暂无"}。`,
              `注册表：${skillMatch.registry_path}。`,
              `找到 ${ragResult.match_count} 条匹配片段，已索引 ${ragResult.indexed_document_count} 个文档。`,
              `检索方式：${formatLocalRagProvider(ragResult)}。`,
              `主要来源：${topPaths}。`
            ].join(" "),
            auditDetailLines: [
              `Recommended skill: ${topMatch?.name ?? "(none)"}`,
              `Registry path: ${skillMatch.registry_path}`,
              ...createKnowledgeHitAuditDetailLines(ragResult)
            ]
          };
        }
      });
      return;
    }

    if (
      normalized.includes("scan local mcp plugins")
      || (normalized.includes("扫描") && normalized.includes("mcp"))
    ) {
      executeReadonlyAsyncTask(setState, {
        message: trimmed,
        executionKind: "mcp-local-plugin-scan",
        executionTitle: "本地 MCP 插件扫描",
        executionAuditSummary: "网页端触发了一次本地 MCP 插件扫描",
        executionAuditDetail: `web local mcp plugin scan: ${trimmed}`,
        failureSummary: "本地 MCP 插件扫描失败",
        failureActionLabel: "请先检查 MCP 扫描桥接、插件根目录和 openclaw 插件适配，再重试。",
        failureSource: "web_local_mcp_plugin_scan",
        run: () => scanLocalMcpPlugins(),
        onSuccess: (result) => {
          const topPlugins = result.items.slice(0, 3).map((item) => item.id).join("、") || "暂无可展示插件";
          const activationLine =
            result.items.slice(0, 3).map((item) => `${item.id}=${item.activation}`).join("、") || "暂无";

          return {
            resultTitle: "本地 MCP 插件扫描",
            resultSummary: [
              `扫描到 ${result.total_count} 个本地 MCP 插件入口，覆盖 ${result.scanned_root_count} 个扫描根目录。`,
              `样例插件：${topPlugins}。`,
              `激活方式：${activationLine}。`
            ].join(" "),
            auditDetailLines: result.items
              .slice(0, 3)
              .map((item) => `${item.id} | ${item.activation} | ${item.path}`)
          };
        }
      });
      return;
    }

    if (
      (normalized.includes("details") && normalized.includes("mcp plugin"))
      || isChineseMcpInspectRequest(normalized)
    ) {
      executeReadonlyAsyncTask(setState, {
        message: trimmed,
        executionKind: "mcp-local-plugin-inspect",
        executionTitle: "本地 MCP 插件详情",
        executionAuditSummary: "网页端查看本地 MCP 插件详情",
        executionAuditDetail: `web local mcp plugin inspect: ${trimmed}`,
        failureSummary: "本地 MCP 插件详情读取失败",
        failureActionLabel: "请先检查 MCP 检查桥接、插件索引和查询关键词，再重试。",
        failureSource: "web_local_mcp_plugin_inspect",
        run: () => inspectLocalMcpPlugin(trimmed),
        onSuccess: (result) => {
          const topMatch = result.items[0];

          if (!topMatch) {
            return {
              resultTitle: "本地 MCP 插件详情",
              resultSummary: `未找到匹配 MCP 插件。检索问题：${result.query}。`,
              auditDetailLines: ["No matching local MCP plugin found in browser preview."]
            };
          }

          const toolsLine = topMatch.tool_names.length > 0 ? topMatch.tool_names.join("、") : "暂无";
          const skillsLine = topMatch.skill_paths.length > 0 ? topMatch.skill_paths.join("、") : "暂无";

          return {
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
          };
        }
      });
      return;
    }

    if (
      (normalized.includes("preview starting") && normalized.includes("mcp plugin"))
      || (normalized.includes("预览") && normalized.includes("启动") && normalized.includes("mcp"))
      || isChineseMcpStartPreviewRequest(normalized)
    ) {
      executeReadonlyAsyncTask(setState, {
        message: trimmed,
        executionKind: "mcp-local-plugin-start-preview",
        executionTitle: "本地 MCP 插件启动预览",
        executionAuditSummary: "网页端查看本地 MCP 插件启动预览",
        executionAuditDetail: `web local mcp plugin start preview: ${trimmed}`,
        failureSummary: "本地 MCP 插件启动预览失败",
        failureActionLabel: "请先检查 MCP 启动预览桥接、插件索引和启动边界说明，再重试。",
        failureSource: "web_local_mcp_plugin_start_preview",
        run: () => previewLocalMcpPluginStart(trimmed),
        onSuccess: (result) => {
          const topMatch = result.items[0];

          if (!topMatch) {
            return {
              resultTitle: "本地 MCP 插件启动预览",
              resultSummary: `未找到可预览启动的 MCP 插件。检索问题：${result.query}。`,
              auditDetailLines: ["No launch-previewable local MCP plugin found in browser preview."]
            };
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

          return {
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
          };
        }
      });
      return;
    }

    if (normalized.includes("enabled skills") || isChineseEnabledSkillsListRequest(normalized)) {
      executeReadonlyAsyncTask(setState, {
        message: trimmed,
        executionKind: "skills-local-enabled-list",
        executionTitle: "已启用本地 Skills",
        executionAuditSummary: "网页端查看已启用本地 Skills",
        executionAuditDetail: `web enabled local skills list: ${trimmed}`,
        failureSummary: "已启用本地 Skills 读取失败",
        failureActionLabel: "请先检查 enabled skills 注册表和读取桥接，再重试。",
        failureSource: "web_enabled_local_skills_list",
        run: () => listEnabledLocalSkills(),
        onSuccess: (result) => {
          const listedSkills = result.items.slice(0, 3).map((item) => item.name).join("、") || "暂无";

          return {
            resultTitle: "已启用本地 Skills",
            resultSummary: [
              `当前启用 ${result.total_count} 个本地 Skill。`,
              `注册表：${result.registry_path}。`,
              `已启用项：${listedSkills}。`
            ].join(" "),
            auditDetailLines: result.items
              .slice(0, 3)
              .map((item) => `${item.name} | ${item.source} | ${item.path}`)
          };
        }
      });
      return;
    }

    if ((normalized.includes("details") && normalized.includes("skill")) || isChineseSkillInspectRequest(normalized)) {
      executeReadonlyAsyncTask(setState, {
        message: trimmed,
        executionKind: "skills-local-inspect",
        executionTitle: "本地 Skill 详情",
        executionAuditSummary: "网页端查看本地 Skill 详情",
        executionAuditDetail: `web local skill inspect: ${trimmed}`,
        failureSummary: "本地 Skill 详情读取失败",
        failureActionLabel: "请先检查 Skill 检查桥接、扫描根目录和查询关键词，再重试。",
        failureSource: "web_local_skill_inspect",
        run: () => inspectLocalSkill(trimmed),
        onSuccess: (result) => {
          const topMatch = result.items[0];

          if (!topMatch) {
            return {
              resultTitle: "本地 Skill 详情",
              resultSummary: `未找到匹配 Skill。检索问题：${result.query}。`,
              auditDetailLines: ["No matching local skill found in browser preview."]
            };
          }

          return {
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
          };
        }
      });
      return;
    }

    if (isScopedChineseKnowledgeRequest) {
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
            executionAuditDetail: `web local rag search: ${scopedKnowledgeMessage}`
          });
          const started = createTaskExecutionStartedState(queued);
          const result = searchWebKnowledge(scopedKnowledgeMessage, browserRecord);

          const succeeded = createTaskExecutionSucceededState(started, {
            resultTitle: "本地 RAG 文档检索",
            resultSummary: createLocalRagSearchResultSummaryWithLibrary(
              currentBrowserState.webKnowledge?.activeLibraryLabel ?? "默认知识库",
              result
            ),
            auditDetailLines: createKnowledgeHitAuditDetailLines(result)
          });

          return preserveWebKnowledgeState(current, succeeded);
        });
      });
      return;
    }

    if (scopedKnowledgeNormalized.includes("search local knowledge") || isChineseKnowledgeSearchRequest(normalized)) {
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
            executionAuditDetail: `web local rag search: ${scopedKnowledgeMessage}`
          });
          const started = createTaskExecutionStartedState(queued);
          const result = searchWebKnowledge(scopedKnowledgeMessage, browserRecord);

          const succeeded = createTaskExecutionSucceededState(started, {
            resultTitle: "本地 RAG 文档检索",
            resultSummary: createLocalRagSearchResultSummaryWithLibrary(
              currentBrowserState.webKnowledge?.activeLibraryLabel ?? "默认知识库",
              result
            ),
            auditDetailLines: createKnowledgeHitAuditDetailLines(result)
          });

          return preserveWebKnowledgeState(current, succeeded);
        });
      });
      return;
    }

    if (isCapabilityOverviewRequest(normalized, "rag")) {
      setReadonlyCapabilitySummary("rag");
      return;
    }

    if (isCapabilityOverviewRequest(normalized, "skills")) {
      setReadonlyCapabilitySummary("skills");
      return;
    }

    if (isCapabilityOverviewRequest(normalized, "npc")) {
      setReadonlyCapabilitySummary("npc");
      return;
    }

    if (isCapabilityOverviewRequest(normalized, "mcp")) {
      setReadonlyCapabilitySummary("mcp");
      return;
    }

    executeReadonlyAsyncTask(setState, {
      message: trimmed,
      executionKind: "local-model-chat",
      executionTitle: "本地模型问答",
      executionAuditSummary: "网页端提交了一条本地优先会话任务",
      executionAuditDetail: `web local-first chat: ${trimmed}`,
      failureSummary: "本地模型回复失败",
      failureActionLabel: "请先检查本机 Ollama 服务、当前已选模型和本地网络回环访问，再重试这条长文本请求。",
      failureSource: "web_local_model_chat",
      run: async () => {
        const browserRecord = webKnowledgeRecordRef.current;
        const activeLibraryLabel =
          browserRecord.libraries.find((library) => library.id === browserRecord.activeLibraryId)?.label
          ?? "默认知识库";
        const ragResult = searchWebKnowledge(scopedKnowledgeMessage, browserRecord);
        let activeModel = resolveUsableWebChatModel(state);

        if (!activeModel) {
          const overview = await loadOllamaOverview();
          activeModel = overview.selectedModel.trim() || overview.models[0]?.name || "";
        }

        const chatResult = await chatWithOllamaModel({
          model: activeModel,
          message: createWebLocalChatPrompt(trimmed, activeLibraryLabel, ragResult)
        });

        return {
          activeLibraryLabel,
          ragResult,
          chatResult,
          activeModel
        };
      },
      onSuccess: ({ activeLibraryLabel, ragResult, chatResult, activeModel }) => ({
        resultTitle: "本地模型答复",
        resultSummary: chatResult.message,
        auditDetailLines: [
          `Knowledge library: ${activeLibraryLabel}`,
          ...createKnowledgeHitAuditDetailLines(ragResult),
          ...createWebLocalChatAuditDetailLines(activeModel, ragResult, chatResult.doneReason)
        ]
      })
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
        customFiles: currentRecord.customFiles,
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
    const sourceFiles = createKnowledgeSourceFiles(webKnowledgeRecordRef.current);
    const sample = sourceFiles.find((item) => item.path === path);

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
          customFiles: browserRecord.customFiles ?? [],
          libraries: browserRecord.libraries.map((library) =>
            library.id === browserRecord.activeLibraryId
              ? {
                  ...library,
                  importedFiles: nextImported.map((item) => {
                    const importedSample = WEB_SAMPLE_DOCS.find((doc) => doc.path === item.path);
                    const customSample = (browserRecord.customFiles ?? []).find((doc) => doc.path === item.path);

                    return {
                      path: item.path,
                      title: item.title,
                      status: item.status,
                      content: importedSample?.content ?? customSample?.content ?? ""
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
            summary: `已导入 ${sample.title}，后续检索会使用这份 md/txt 内容。`
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
    const sourceFiles = createKnowledgeSourceFiles(webKnowledgeRecordRef.current);
    const sample = sourceFiles.find((item) => item.path === path);

    startTransition(() => {
      setState((current) => {
        const browserRecord = webKnowledgeRecordRef.current;
        const nextImported = current.knowledge.importedFiles.filter((item) => item.path !== path);
        const nextAvailable = sample
          ? [...current.knowledge.availableFiles, { path: sample.path, title: sample.title }]
          : current.knowledge.availableFiles;
        const nextRecord: WebKnowledgeRecord = {
          ...browserRecord,
          customFiles: browserRecord.customFiles ?? [],
          libraries: browserRecord.libraries.map((library) =>
            library.id === browserRecord.activeLibraryId
              ? {
                  ...library,
                  importedFiles: nextImported.map((item) => {
                    const importedSample = WEB_SAMPLE_DOCS.find((doc) => doc.path === item.path);
                    const customSample = (browserRecord.customFiles ?? []).find((doc) => doc.path === item.path);

                    return {
                      path: item.path,
                      title: item.title,
                      status: item.status,
                      content: importedSample?.content ?? customSample?.content ?? ""
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

  function handleImportLocalKnowledgeFiles(files: File[]) {
    const validFiles = files.filter((file) => {
      const normalizedName = file.name.trim().toLowerCase();
      return normalizedName.endsWith(".md") || normalizedName.endsWith(".txt");
    });

    if (validFiles.length === 0) {
      return;
    }

    void Promise.all(validFiles.map(async (file) => ({
      name: file.name.trim(),
      content: await readTextFileContent(file)
    }))).then((resolvedFiles) => {
      startTransition(() => {
        setState((current) => {
          const browserRecord = webKnowledgeRecordRef.current;
          const nextCustomFiles = [
            ...resolvedFiles.map((file) => ({
              path: `uploads/${file.name}`,
              title: file.name,
              status: "ready" as const,
              content: file.content
            })),
            ...browserRecord.customFiles.filter((item) =>
              !resolvedFiles.some((file) => `uploads/${file.name}` === item.path)
            )
          ];
          const nextImported = [...current.knowledge.importedFiles];

          for (const file of resolvedFiles) {
            const nextPath = `uploads/${file.name}`;
            const alreadyImported = nextImported.some((item) => item.path === nextPath);

            if (!alreadyImported) {
              nextImported.push({
                path: nextPath,
                title: file.name,
                status: "ready" as const
              });
            }
          }

          const nextRecord: WebKnowledgeRecord = {
            ...browserRecord,
            customFiles: nextCustomFiles,
            libraries: browserRecord.libraries.map((library) =>
              library.id === browserRecord.activeLibraryId
                ? {
                    ...library,
                    importedFiles: nextImported.map((item) => {
                      const importedSample = WEB_SAMPLE_DOCS.find((doc) => doc.path === item.path);
                      const customSample = nextCustomFiles.find((doc) => doc.path === item.path);

                      return {
                        path: item.path,
                        title: item.title,
                        status: item.status,
                        content: importedSample?.content ?? customSample?.content ?? ""
                      };
                    })
                  }
                : {
                    ...library,
                    importedFiles: library.importedFiles.map((item) => {
                      const updatedCustom = nextCustomFiles.find((doc) => doc.path === item.path);

                      return updatedCustom ? { ...item, content: updatedCustom.content } : item;
                    })
                  }
            )
          };
          webKnowledgeRecordRef.current = nextRecord;

          return withKnowledgeRecord({
            ...current,
            output: {
              title: "知识库已更新",
              summary: `已导入 ${resolvedFiles.length} 个本地文件，后续检索会使用这些真实内容。`
            },
            audit: {
              summary: "网页端知识库已导入本地文件",
              lastEvent: {
                module: "knowledge",
                detail: `imported local files ${resolvedFiles.map((file) => `uploads/${file.name}`).join(", ")}`,
                timestamp: "imported",
                source: "web_knowledge_local_file_import"
              }
            }
          } as WorkbenchState, nextRecord);
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
          customFiles: currentRecord.customFiles ?? [],
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
      onArchiveConversation={() => {
        startTransition(() => {
          setState((current) => preserveWebKnowledgeState(current, createArchivedConversationState(current)));
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
      onImportLocalKnowledgeFiles={handleImportLocalKnowledgeFiles}
    />
  );
}
