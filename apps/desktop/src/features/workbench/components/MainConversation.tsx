import {
  Bot,
  ChevronDown,
  FilePenLine,
  FilePlus2,
  FileSearch,
  Files,
  Globe,
  LoaderCircle,
  Play,
  RotateCcw,
  Save,
  ScanSearch,
  ShieldCheck,
  Trash2
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { invoke } from "@tauri-apps/api/core";
import type { ChatAttachment, WorkbenchState } from "../workbenchState";
import {
  getLocalizedPermissionReason,
  getVisibleLocalTaskFailureActionLabel,
  getVisibleLocalTaskFailureDetail,
  getVisibleLocalTaskFailureTitle,
  isLocalAssistantPlannerFailureSource,
  normalizeWorkbenchText
} from "../workbenchText";
import { AttachmentPreview } from "./AttachmentPreview";

type MainConversationProps = {
  state: WorkbenchState;
  onPreviewRollback: (targetEntryId: string) => void;
  onCancelActiveTask: () => void;
  onRetryLocalTask?: (taskId?: string) => void;
  onRestoreRecentConversation?: (conversationId: string) => void;
  onDeleteRecentConversation?: (conversationId: string) => void;
  onSubmitTask?: (message: string) => void;
  onOpenAttachment?: (attachment: ChatAttachment) => void;
  knowledgeReferenceLabel?: string;
};

const TEXT = {
  conversation: "会话",
  rollbackToUserMessage: "回退到这条消息之前",
  user: "你",
  system: "系统",
  thinkingTitle: "正在思考",
  queuedLabel: "已进入本地任务队列",
  runningLabel: "正在思考"
} as const;

const LONG_TEXT_LIMIT = 220;
const LONG_TITLE_LIMIT = 80;
const COMPRESSED_CONVERSATION_ENTRY_ID = "conversation-auto-summary";
const TAURI_INTERNALS_KEY = "__TAURI_INTERNALS__";
const MAX_VISIBLE_LOCAL_TASK_ATTEMPTS = 3;
const SUCCESS_TRACE_PREFIXES = [
  "Input summary:",
  "Execution kind:",
  "Execution title:",
  "Execution audit detail:",
  "Ollama model:",
  "Ollama done reason:",
  "Search context items:",
  "Search context status:",
  "Search provider:",
  "Effective provider:",
  "Knowledge source priority:",
  "Search fallback:",
  "Result summary:"
];

function isLocalTaskExecutionErrorSource(source: string) {
  return source === "local_task_runner"
    || source === "local_task_timeout"
    || source === "local_task_attempt_guard"
    || source === "local_model_chat_runner"
    || source === "local_task_missing_execution_kind"
    || source === "opencow_self_repair_failure_analysis";
}

function getVisibleDetailLines(entry: WorkbenchState["conversation"]["entries"][number]) {
  const detailLines = entry.detailLines ?? [];

  if (
    isDuplicatePendingApprovalSkippedEntry(entry)
    || isDuplicateLocalTaskSkippedEntry(entry)
    || isDuplicatePlanningFailureSkippedEntry(entry)
  ) {
    return [];
  }

  if (entry.kind !== "assistant") {
    return detailLines;
  }

  return detailLines.filter(
    (line) => !SUCCESS_TRACE_PREFIXES.some((prefix) => line.startsWith(prefix))
  );
}

type KnowledgeHitCard = {
  sourceTitle: string;
  score: string;
  snippet: string;
  followUpQuery: string;
  factSnippets: string[];
};

type SearchReferenceCard = {
  title: string;
  provider: string;
  sourceLabel: string;
  query: string;
  url: string;
  summary: string;
  factSnippets: string[];
};

function stripHtmlForReferenceText(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function isLowValueReferenceSnippet(value: string) {
  const normalized = normalizeWorkbenchText(stripHtmlForReferenceText(value)).trim();

  if (!normalized) {
    return true;
  }

  const lower = normalized.toLowerCase();
  if (
    normalized.includes("OpenCow 默认搜索返回了可用网页结果")
    || normalized.includes("OpenCow 默认搜索返回了可用词条")
    || normalized.includes("OpenCow 默认搜索")
    || normalized.includes("网易首页")
    || normalized.includes("快速导航")
    || normalized.includes("猜你喜欢")
    || normalized.includes("推荐阅读")
    || normalized.includes("分享至好友和朋友圈")
    || lower.includes("window.")
    || lower.includes("uid_target")
    || lower.includes("javascript")
    || lower.includes("function(")
    || /<[a-z][\s\S]*>/i.test(value)
  ) {
    return true;
  }

  const total = normalized.length;
  const replacementCharacter = String.fromCharCode(0xfffd);
  const replacementCount = [...normalized].filter((character) => character === replacementCharacter).length;
  if (replacementCount * 5 >= total) {
    return true;
  }

  return false;
}

function getVisibleReferenceSnippets(snippets: string[], fallback: string) {
  const normalizedSnippets = (snippets.length > 0 ? snippets : [fallback])
    .map((snippet) => normalizeWorkbenchText(stripHtmlForReferenceText(snippet)).trim())
    .filter(Boolean)
    .filter((snippet) => !isLowValueReferenceSnippet(snippet));

  if (normalizedSnippets.length > 0) {
    return normalizedSnippets;
  }

  const normalizedFallback = normalizeWorkbenchText(stripHtmlForReferenceText(fallback)).trim();
  return normalizedFallback && !isLowValueReferenceSnippet(normalizedFallback)
    ? [normalizedFallback]
    : [];
}

function parseKnowledgeHitCards(detailLines: string[]) {
  const cards: KnowledgeHitCard[] = [];
  const remainingLines: string[] = [];

  for (const line of detailLines) {
    const match = line.match(/^命中卡片：来源文件=(.+?)；匹配分数=(.+?)；片段预览=(.+?)；回查指令=(.+?)(?:；事实片段=(.+))?$/);

    if (!match) {
      remainingLines.push(line);
      continue;
    }

    cards.push({
      sourceTitle: match[1]?.trim() ?? "",
      score: match[2]?.trim() ?? "",
      snippet: match[3]?.trim() ?? "",
      followUpQuery: match[4]?.trim() ?? "",
      factSnippets: match[5]
        ?.split("｜")
        .map((snippet) => snippet.trim())
        .filter(Boolean) ?? []
    });
  }

  return { cards, remainingLines };
}

function parseSearchReferenceCards(detailLines: string[]) {
  const cards: SearchReferenceCard[] = [];
  const remainingLines: string[] = [];

  for (const line of detailLines) {
    const card = parseSearchReferenceLine(line);

    if (!card) {
      remainingLines.push(line);
      continue;
    }

    cards.push(card);
  }

  return { cards, remainingLines };
}

function parseSearchReferenceLine(line: string): SearchReferenceCard | null {
  const normalizedLine = line.trim();

  if (!normalizedLine.startsWith("搜索来源：标题=")) {
    return null;
  }

  const withoutPrefix = normalizedLine.replace(/^搜索来源：标题=/, "");
  const sourceDelimiter = withoutPrefix.includes("；来源=") ? "；来源=" : "；提供方=";
  const sourceIndex = withoutPrefix.indexOf(sourceDelimiter);

  if (sourceIndex < 0) {
    return null;
  }

  const title = withoutPrefix.slice(0, sourceIndex).trim();
  const afterSource = withoutPrefix.slice(sourceIndex + sourceDelimiter.length);
  const queryDelimiter = "；查询=";
  const queryIndex = afterSource.indexOf(queryDelimiter);

  if (queryIndex < 0) {
    return null;
  }

  const provider = afterSource.slice(0, queryIndex).trim();
  const afterQuery = afterSource.slice(queryIndex + queryDelimiter.length);
  const { value: query, remainder: afterQueryRemainder } = takeLabeledReferenceValue(afterQuery, ["；地址=", "；摘要=", "；事实片段="]);
  const fields = parseTrailingReferenceFields(afterQueryRemainder);

  return {
    title,
    provider,
    sourceLabel: provider,
    query: query.trim(),
    url: fields["地址"]?.trim() ?? "",
    summary: fields["摘要"]?.trim() ?? "",
    factSnippets: fields["事实片段"]
      ?.split("｜")
      .map((snippet) => snippet.trim())
      .filter(Boolean) ?? []
  };
}

function takeLabeledReferenceValue(text: string, labels: string[]) {
  const nextLabel = labels
    .map((label) => ({ label, index: text.indexOf(label) }))
    .filter((item) => item.index >= 0)
    .sort((left, right) => left.index - right.index)[0];

  if (!nextLabel) {
    return { value: text, remainder: "" };
  }

  return {
    value: text.slice(0, nextLabel.index),
    remainder: text.slice(nextLabel.index)
  };
}

function parseTrailingReferenceFields(text: string) {
  const fields: Record<string, string> = {};
  let remainder = text;

  while (remainder) {
    const labelMatch = remainder.match(/^；(地址|摘要|事实片段)=/);

    if (!labelMatch) {
      break;
    }

    const label = labelMatch[1] ?? "";
    const valueStart = labelMatch[0].length;
    const { value, remainder: nextRemainder } = takeLabeledReferenceValue(
      remainder.slice(valueStart),
      ["；地址=", "；摘要=", "；事实片段="].filter((candidate) => candidate !== `；${label}=`)
    );
    fields[label] = value;
    remainder = nextRemainder;
  }

  return fields;
}

function isKnowledgeMetadataLine(line: string) {
  return line.startsWith("Knowledge library:")
    || line.startsWith("Knowledge library sources:")
    || line.startsWith("Indexed documents:");
}

function localizeKnowledgeMetadataLine(line: string) {
  if (line.startsWith("Knowledge library sources:")) {
    return `知识库来源：${line.replace("Knowledge library sources:", "").trim()}`;
  }

  if (line.startsWith("Knowledge library:")) {
    return `知识库：${line.replace("Knowledge library:", "").trim()}`;
  }

  if (line.startsWith("Indexed documents:")) {
    return `已索引文档：${line.replace("Indexed documents:", "").trim()}`;
  }

  return normalizeWorkbenchText(line);
}

function isDuplicatePendingApprovalSkippedEntry(entry: WorkbenchState["conversation"]["entries"][number]) {
  return entry.detailLines?.some((line) => line === "Source: duplicate_pending_approval_skipped") ?? false;
}

function isDuplicatePlanningFailureSkippedEntry(entry: WorkbenchState["conversation"]["entries"][number]) {
  return entry.detailLines?.some((line) => line === "Source: local_assistant_planner_duplicate_skipped") ?? false;
}

function isDuplicateLocalTaskSkippedEntry(entry: WorkbenchState["conversation"]["entries"][number]) {
  return entry.title === "重复任务已跳过"
    && (entry.detailLines?.some((line) => line.startsWith("Existing task status:")) ?? false);
}

function isVisibleSystemEntry(entry: WorkbenchState["conversation"]["entries"][number]) {
  return entry.id === COMPRESSED_CONVERSATION_ENTRY_ID
    || entry.id.startsWith("rollback-preview-")
    || isDuplicatePendingApprovalSkippedEntry(entry)
    || isDuplicateLocalTaskSkippedEntry(entry)
    || isDuplicatePlanningFailureSkippedEntry(entry);
}

function getVisibleSummary(entry: WorkbenchState["conversation"]["entries"][number]) {
  if (entry.title === "等待权限升级") {
    return getLocalizedPermissionReason(entry.summary);
  }

  if (isDuplicateLocalTaskSkippedEntry(entry)) {
    return getVisibleDuplicateLocalTaskSkipSummary(entry);
  }

  if (isDuplicatePlanningFailureSkippedEntry(entry)) {
    return "\u76f8\u540c\u8bf7\u6c42\u521a\u521a\u53d1\u751f\u89c4\u5212\u5931\u8d25\uff0c\u5df2\u8df3\u8fc7\u91cd\u590d\u89c4\u5212\u3002\u8bf7\u6539\u5199\u8bf7\u6c42\uff0c\u6216\u4ece\u53ea\u8bfb\u9884\u89c8\u91cd\u65b0\u5f00\u59cb\u3002";
  }

  if (!isDuplicatePendingApprovalSkippedEntry(entry)) {
    return entry.summary;
  }

  const approvalType = getDuplicatePendingApprovalType(entry);

  if (approvalType === "permission" || entry.summary.includes("already waiting for permission approval")) {
    return "已有权限审批正在等待处理，已跳过这次重复请求。";
  }

  if (
    approvalType === "dangerous-confirmation" ||
    entry.summary.includes("already waiting for dangerous confirmation")
  ) {
    return "已有高风险确认正在等待处理，已跳过这次重复请求。";
  }

  return "已有能力变更确认正在等待处理，已跳过这次重复请求。";
}

function getDuplicatePendingApprovalType(entry: WorkbenchState["conversation"]["entries"][number]) {
  const approvalTypeLine = entry.detailLines
    ?.find((line) => line.startsWith("Approval type: ") || line.startsWith("审批类型: "));

  return approvalTypeLine
    ?.replace("Approval type: ", "")
    .replace("审批类型: ", "");
}

function getVisibleDuplicateLocalTaskSkipSummary(entry: WorkbenchState["conversation"]["entries"][number]) {
  const detailLines = entry.detailLines ?? [];

  if (detailLines.some((line) => line.includes("retry limit"))) {
    return "相同任务已经达到重试上限，请查看失败详情、改写请求，或先帮助 opencow 修复缺失依赖。";
  }

  if (detailLines.some((line) => line === "Existing task status: failed")) {
    return "相同任务已经失败，请先查看失败详情、点击重试本地任务，或改写请求。";
  }

  return "已有相同任务正在排队或执行，已跳过这次重复提交。";
}

function getVisibleTitle(entry: WorkbenchState["conversation"]["entries"][number], isUser: boolean) {
  if (isUser) {
    return TEXT.user;
  }

  if (isDuplicatePendingApprovalSkippedEntry(entry)) {
    return "重复审批请求已跳过";
  }

  if (isDuplicatePlanningFailureSkippedEntry(entry)) {
    return "\u91cd\u590d\u89c4\u5212\u5931\u8d25\u5df2\u8df3\u8fc7";
  }

  return entry.title;
}

function getVisibleErrorDetail(error: NonNullable<WorkbenchState["error"]>) {
  if (error.source === "local_task_cancelled") {
    return "停止记录已保留在日志和回退记录中。";
  }

  if (error.source === "local_task_attempt_guard") {
    return "重试上限记录已保留在日志和回退记录中。";
  }

  if (error.source === "local_model_chat_runner") {
    const failureDetail =
      error.detail.match(/Failure detail:\s*(.*?)(?:\.\s*Recovery hint:|\.\s*Recovery visibility:|$)/s)?.[1]?.trim()
      ?? error.detail;
    const visibleDetail = getVisibleLocalTaskFailureDetail(failureDetail, error.source);

    return visibleDetail.startsWith("Ollama error:") || failureDetail.includes("streamPhase=")
      ? visibleDetail
      : "本地模型本轮没有按时返回完整结果，详细诊断已保留在右侧任务详情和日志中。";
  }

  if (error.module === "permission" && error.source === "command_policy") {
    return normalizeWorkbenchText(error.detail);
  }

  if (error.module === "tools") {
    return "完整工具错误详情已保留在日志、错误详情和回退记录中。";
  }

  if (error.module !== "tasks") {
    return error.detail;
  }

  if (!isLocalTaskExecutionErrorSource(error.source) && !isLocalAssistantPlannerFailureSource(error.source)) {
    return normalizeWorkbenchText(error.detail);
  }

  const failureDetail =
    error.detail.match(/Failure detail:\s*(.*?)(?:\.\s*Recovery hint:|\.\s*Recovery visibility:|$)/s)?.[1]?.trim()
    ?? error.detail;

  return getVisibleLocalTaskFailureDetail(failureDetail, error.source);
}

function getVisibleErrorActionLabel(error: NonNullable<WorkbenchState["error"]>) {
  if (error.source === "local_task_cancelled") {
    return "任务已停止，未继续执行。可以改写请求、缩小范围，或确认后重新提交。";
  }

  if (error.source === "local_task_attempt_guard") {
    return "已停止重复执行，避免死循环。请查看失败详情、改写请求，或先帮助 opencow 修复缺失依赖。";
  }

  if (
    error.module === "tasks"
    && (isLocalTaskExecutionErrorSource(error.source) || isLocalAssistantPlannerFailureSource(error.source))
  ) {
    return getVisibleLocalTaskFailureActionLabel(error.actionLabel);
  }

  return normalizeWorkbenchText(error.actionLabel);
}

function getVisibleErrorTitle(error: NonNullable<WorkbenchState["error"]>) {
  if (error.module === "tasks") {
    return getVisibleLocalTaskFailureTitle(error.summary, error.source, error.detail);
  }

  return normalizeWorkbenchText(error.summary);
}

function getVisibleCancellationSummary(source: WorkbenchState["audit"]["lastEvent"]["source"]) {
  if (source === "permission_confirmation_cancelled") {
    return "高风险操作已取消，没有执行命令。";
  }

  if (source === "permission_mode_change_cancelled") {
    return "权限升级已取消，当前权限保持不变。";
  }

  return "能力变更已取消，当前设置保持不变。";
}

function createConversationHeader(entries: WorkbenchState["conversation"]["entries"]) {
  const latestFirstEntries = entries.slice().reverse();
  const latestUserEntry = latestFirstEntries.find((entry) => entry.kind === "user");
  const latestResultEntry = latestFirstEntries.find((entry) => entry.kind !== "user");
  const title = latestUserEntry?.summary.trim() || "";
  const resultTitle = latestResultEntry ? getVisibleTitle(latestResultEntry, false).trim() : "";
  const shouldHideOverview =
    resultTitle === "本地模型答复"
    || resultTitle === "本地模型回答"
    || resultTitle === "联网搜索结果";
  const overview = resultTitle && !shouldHideOverview ? `概览：${resultTitle}` : "";

  if (!title) {
    return null;
  }

  return {
    title: createConversationTitle(title),
    overview
  };
}

function createConversationTitle(text: string) {
  const normalized = normalizeWorkbenchText(text).replace(/\r\n/g, "\n").trim();

  if (!isLongWorkbenchText(normalized)) {
    return createCompactText(normalized, LONG_TITLE_LIMIT);
  }

  return createCompactText(createLongTextTitleCandidate(normalized), LONG_TITLE_LIMIT);
}

function createLongTextTitleCandidate(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line
      .replace(/^```[a-zA-Z0-9_-]*\s*/, "")
      .replace(/^#{1,6}\s+/, "")
      .replace(/^[>*\-\d.\s]+/, "")
      .replace(/^[\s{}()[\];,.:]+/, "")
      .trim())
    .filter(Boolean);
  const firstUsefulLine =
    lines.find((line) => /[\u4e00-\u9fff]/.test(line) && line.length >= 8)
    ?? lines.find((line) => /[a-zA-Z_][\w:<>&*\s(),.-]*\{?$/.test(line))
    ?? lines[0]
    ?? text;

  return firstUsefulLine.replace(/\s+/g, " ").trim();
}

function createCompactText(text: string, limit = LONG_TEXT_LIMIT) {
  const normalized = normalizeWorkbenchText(text).replace(/\s+/g, " ").trim();

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit).trimEnd()}…`;
}

function isLongWorkbenchText(text: string) {
  return normalizeWorkbenchText(text).trim().length > LONG_TEXT_LIMIT;
}

async function openReferenceUrl(url: string) {
  const normalized = url.trim();

  if (!normalized) {
    return;
  }

  if (typeof window !== "undefined" && TAURI_INTERNALS_KEY in window) {
    await invoke("external_link_open", { url: normalized });
    return;
  }

  if (typeof window !== "undefined" && normalized.startsWith("http")) {
    window.open(normalized, "_blank", "noopener,noreferrer");
  }
}

function isLocalModelPendingTask(executionKind: string | undefined) {
  return executionKind === "local-model-chat" || executionKind === "npc-config-write";
}

function CollapsibleWorkbenchText({
  text,
  isUser
}: {
  text: string;
  isUser: boolean;
}) {
  const normalized = normalizeWorkbenchText(text);
  const [expanded, setExpanded] = useState(false);

  if (!isUser || !isLongWorkbenchText(normalized)) {
    return <p className="message-summary">{normalized}</p>;
  }

  return (
    <div className="message-summary-group">
      <p className="message-summary message-summary-collapsed">
        {expanded ? normalized : createCompactText(normalized)}
      </p>
      <button
        className="message-expand-button"
        type="button"
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? "收起输入" : "展开完整输入"}
      </button>
    </div>
  );
}

function renderInlineMarkdown(text: string) {
  const normalized = normalizeWorkbenchText(text);
  const parts = normalized.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    const codeMatch = part.match(/^`([^`]+)`$/);
    if (codeMatch) {
      return (
        <code className="message-inline-code" key={`${part}-${index}`}>
          {codeMatch[1]}
        </code>
      );
    }

    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);

    if (boldMatch) {
      return (
        <strong key={`${part}-${index}`}>
          {boldMatch[1]}
        </strong>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

type MarkdownBlock =
  | { type: "heading"; content: string }
  | { type: "divider" }
  | { type: "operation"; content: string; tone: "reading" | "editing" | "completed" }
  | { type: "code"; language: string; content: string }
  | { type: "paragraph"; content: string }
  | { type: "ordered-list"; items: Array<{ content: string; children: string[] }> }
  | { type: "table"; rows: string[][] };

function isOperationLine(text: string) {
  const normalized = text.trim();

  return /^(已(?:读取|搜索代码|搜索|编辑|运行|检查|保存|更新|创建|删除|修复)\S*.*|正在(?:编辑|读取|搜索|运行|检查|保存|更新).*)$/.test(normalized);
}

function getOperationIcon(text: string) {
  const normalized = text.trim();

  if (normalized.includes("搜索代码")) {
    return ScanSearch;
  }

  if (normalized.includes("搜索")) {
    return FileSearch;
  }

  if (normalized.includes("读取")) {
    return Files;
  }

  if (normalized.includes("编辑")) {
    return FilePenLine;
  }

  if (normalized.includes("保存") || normalized.includes("更新")) {
    return Save;
  }

  if (normalized.includes("创建")) {
    return FilePlus2;
  }

  if (normalized.includes("删除")) {
    return Trash2;
  }

  if (normalized.includes("检查") || normalized.includes("修复")) {
    return ShieldCheck;
  }

  if (normalized.includes("运行")) {
    return Play;
  }

  return Files;
}

function getOperationTone(text: string): "reading" | "editing" | "completed" {
  const normalized = text.trim();

  if (normalized.startsWith("正在")) {
    return "editing";
  }

  if (
    normalized.includes("读取")
    || normalized.includes("搜索")
    || normalized.includes("检查")
  ) {
    return "reading";
  }

  return "completed";
}

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = normalizeWorkbenchText(text).replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraphLines: string[] = [];
  let orderedListItems: Array<{ content: string; children: string[] }> = [];
  let tableLines: string[] = [];
  let codeFenceLanguage: string | null = null;
  let codeLines: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length === 0) {
      return;
    }

    blocks.push({
      type: "paragraph",
      content: paragraphLines.join(" ").trim()
    });
    paragraphLines = [];
  }

  function flushOrderedList() {
    if (orderedListItems.length === 0) {
      return;
    }

    blocks.push({
      type: "ordered-list",
      items: orderedListItems
    });
    orderedListItems = [];
  }

  function flushTable() {
    if (tableLines.length === 0) {
      return;
    }

    const rows = tableLines
      .map((line) => line
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean))
      .filter((row) => row.length > 0)
      .filter((row) => !row.every((cell) => /^:?-{2,}:?$/.test(cell)));

    if (rows.length > 0) {
      blocks.push({
        type: "table",
        rows
      });
    }

    tableLines = [];
  }

  function flushCode() {
    if (codeFenceLanguage === null) {
      return;
    }

    blocks.push({
      type: "code",
      language: codeFenceLanguage,
      content: codeLines.join("\n").trimEnd()
    });
    codeFenceLanguage = null;
    codeLines = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^```([a-zA-Z0-9_-]*)\s*$/);

    if (codeFenceLanguage !== null) {
      if (fenceMatch) {
        flushCode();
      } else {
        codeLines.push(line);
      }
      continue;
    }

    if (fenceMatch) {
      flushParagraph();
      flushOrderedList();
      flushTable();
      codeFenceLanguage = fenceMatch[1]?.trim() ?? "";
      codeLines = [];
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushOrderedList();
      flushTable();
      continue;
    }

    if (/^\|.*\|$/.test(trimmed)) {
      flushParagraph();
      flushOrderedList();
      tableLines.push(trimmed);
      continue;
    }

    flushTable();

    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);

    if (orderedMatch) {
      flushParagraph();
      orderedListItems.push({
        content: orderedMatch[2]?.trim() ?? "",
        children: []
      });
      continue;
    }

    const unorderedMatch = trimmed.match(/^[*-]\s+(.+)$/);

    if (unorderedMatch && orderedListItems.length > 0) {
      orderedListItems[orderedListItems.length - 1]?.children.push(unorderedMatch[1]?.trim() ?? "");
      continue;
    }

    if (/^\*\*[^*]+:\*\*$/.test(trimmed)) {
      flushParagraph();
      flushOrderedList();
      flushTable();
      blocks.push({
        type: "heading",
        content: trimmed.replace(/^\*\*|\*\*$/g, "")
      });
      continue;
    }

    const markdownHeadingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (markdownHeadingMatch) {
      flushParagraph();
      flushOrderedList();
      flushTable();
      blocks.push({
        type: "heading",
        content: markdownHeadingMatch[1]?.trim() ?? ""
      });
      continue;
    }

    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      flushParagraph();
      flushOrderedList();
      flushTable();
      blocks.push({ type: "divider" });
      continue;
    }

    if (isOperationLine(trimmed)) {
      flushParagraph();
      flushOrderedList();
      flushTable();
      blocks.push({
        type: "operation",
        content: trimmed,
        tone: getOperationTone(trimmed)
      });
      continue;
    }

    flushOrderedList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushOrderedList();
  flushTable();
  flushCode();

  return blocks;
}

function AssistantMarkdownMessage({ text }: { text: string }) {
  const blocks = parseMarkdownBlocks(text);

  return (
    <div className="message-rich-content">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <p className="message-rich-heading" key={`${block.type}-${index}`}>
              {renderInlineMarkdown(block.content)}
            </p>
          );
        }

        if (block.type === "ordered-list") {
          return (
            <ol className="message-rich-list" key={`${block.type}-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li className="message-rich-list-item" key={`${item.content}-${itemIndex}`}>
                  <span>{renderInlineMarkdown(item.content)}</span>
                  {item.children.length > 0 ? (
                    <ul className="message-rich-sublist">
                      {item.children.map((child, childIndex) => (
                        <li key={`${child}-${childIndex}`}>{renderInlineMarkdown(child)}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "table") {
          return (
            <div className="message-rich-table" key={`${block.type}-${index}`}>
              {block.rows.map((row, rowIndex) => (
                <div className="message-rich-table-row" key={`${row.join("-")}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <p className="message-rich-table-cell" key={`${cell}-${cellIndex}`}>
                      {renderInlineMarkdown(cell)}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          );
        }

        if (block.type === "divider") {
          return <div aria-hidden="true" className="message-rich-divider" key={`${block.type}-${index}`} />;
        }

        if (block.type === "code") {
          return (
            <figure className="message-code-block" key={`${block.type}-${index}`}>
              {block.language ? (
                <figcaption className="message-code-language">{block.language}</figcaption>
              ) : null}
              <pre>
                <code>{block.content}</code>
              </pre>
            </figure>
          );
        }

        if (block.type === "operation") {
          const OperationIcon = getOperationIcon(block.content);
          return (
            <div
              className={`message-rich-operation message-rich-operation-${block.tone}`}
              key={`${block.type}-${index}`}
            >
              <span className="message-rich-operation-icon" aria-hidden="true">
                <OperationIcon size={15} strokeWidth={1.9} />
              </span>
              <p className="message-rich-operation-text">{renderInlineMarkdown(block.content)}</p>
            </div>
          );
        }

        return (
          <p className="message-summary" key={`${block.type}-${index}`}>
            {renderInlineMarkdown(block.content)}
          </p>
        );
      })}
    </div>
  );
}

function renderAssistantSummary(text: string): ReactNode {
  if (
    !text.includes("**")
    && !text.includes("`")
    && !/^\s*\d+\.\s+/m.test(text)
    && !/^\s*[*-]\s+/m.test(text)
    && !/^\s*#{1,6}\s+/m.test(text)
    && !/^\s*\|.*\|\s*$/m.test(text)
    && !/^\s*(?:---+|\*\*\*+)\s*$/m.test(text)
    && !/^(已(?:读取|搜索代码|搜索|编辑|运行|检查|保存|更新|创建|删除|修复)\S*.*|正在(?:编辑|读取|搜索|运行|检查|保存|更新).*)$/m.test(text)
  ) {
    return <p className="message-summary">{normalizeWorkbenchText(text)}</p>;
  }

  return <AssistantMarkdownMessage text={text} />;
}

function getPendingAssistantSummaryText(pendingTask: NonNullable<ReturnType<typeof getPendingTaskLike>>): string {
  if (pendingTask.streamingSummary?.trim()) {
    return pendingTask.streamingSummary;
  }

  if (pendingTask.progressSummary?.trim()) {
    return pendingTask.progressSummary;
  }

  return "";
}

function getPendingTaskLike(state: WorkbenchState) {
  const activeTask = state.tasks.activeTaskId
    ? state.tasks.items.find((item) => item.id === state.tasks.activeTaskId) ?? null
    : null;
  const queuedTask = state.tasks.items.find((item) => item.status === "queued") ?? null;

  return activeTask ?? queuedTask;
}

function getLatestFailedTask(state: WorkbenchState) {
  return state.tasks.items.find((item) => item.status === "failed") ?? null;
}

function InformationReferences({
  entryId,
  knowledgeCards,
  searchCards,
  metadataLines,
  expanded,
  onToggle,
  onSubmitTask,
  label = "信息引用"
}: {
  entryId: string;
  knowledgeCards: KnowledgeHitCard[];
  searchCards: SearchReferenceCard[];
  metadataLines: string[];
  expanded: boolean;
  onToggle: (entryId: string) => void;
  onSubmitTask?: (message: string) => void;
  label?: string;
}) {
  const totalCount = knowledgeCards.length + searchCards.length;

  return (
    <section className="message-knowledge-results" aria-label="信息引用">
      <button
        aria-expanded={expanded}
        aria-label={expanded ? `收起${label}` : `展开${label}`}
        className={`message-knowledge-toggle ${expanded ? "message-knowledge-toggle-open" : ""}`}
        type="button"
        onClick={() => onToggle(entryId)}
      >
        <ChevronDown aria-hidden="true" size={20} />
        <span>{totalCount} 条信息引用</span>
      </button>
      {expanded ? (
        <div className="message-knowledge-expanded">
          {metadataLines.length > 0 ? (
            <div className="message-knowledge-metadata">
              {metadataLines.map((line) => (
                <p className="message-detail" key={`${entryId}-${line}`}>
                  {localizeKnowledgeMetadataLine(line)}
                </p>
              ))}
            </div>
          ) : null}
          {searchCards.length > 0 ? (
            <>
              <p className="message-detail-title">联网搜索来源</p>
              {searchCards.map((card) => (
                <div className="message-knowledge-item" key={`${entryId}-${card.url}-${card.title}`}>
                  <p className="message-detail">{normalizeWorkbenchText(card.title)}</p>
                  <div className="message-reference-link-row">
                    {card.url ? (
                      <button
                        className="message-reference-link"
                        type="button"
                        aria-label={`打开来源：${normalizeWorkbenchText(card.sourceLabel || card.provider || card.title)}`}
                        onClick={() => {
                          void openReferenceUrl(card.url);
                        }}
                      >
                        <Globe aria-hidden="true" size={14} />
                        <span>{normalizeWorkbenchText(card.sourceLabel || card.provider || card.title)}</span>
                      </button>
                    ) : (
                      <p className="message-reference-source">
                        {normalizeWorkbenchText(card.sourceLabel || card.provider || card.title)}
                      </p>
                    )}
                    {card.query ? (
                      <p className="message-reference-summary">
                        查询：{createCompactText(card.query, 86)}
                      </p>
                    ) : null}
                    {getVisibleReferenceSnippets(card.factSnippets, card.summary).map((snippet) => (
                      <p className="message-reference-summary" key={`${entryId}-${card.url}-${snippet}`}>
                        {snippet}
                      </p>
                    ))}
                  </div>
                  {card.url ? (
                    <button
                      className="message-reference-title-link"
                      type="button"
                      aria-label={`打开条目：${normalizeWorkbenchText(card.title)}`}
                      onClick={() => {
                        void openReferenceUrl(card.url);
                      }}
                    >
                      {normalizeWorkbenchText(card.title)}
                    </button>
                  ) : null}
                </div>
              ))}
            </>
          ) : null}
          {knowledgeCards.length > 0 ? (
            <>
              <p className="message-detail-title">{label === "知识详情" ? "检索命中" : "知识库来源"}</p>
              {knowledgeCards.map((card) => (
                <div className="message-knowledge-item" key={`${entryId}-${card.sourceTitle}-${card.score}`}>
                  <p className="message-detail">来源文件：{normalizeWorkbenchText(card.sourceTitle)}</p>
                  <p className="message-detail">匹配分数：{normalizeWorkbenchText(card.score)}</p>
                  {getVisibleReferenceSnippets(card.factSnippets, card.snippet).map((snippet) => (
                    <p className="message-reference-summary" key={`${entryId}-${card.sourceTitle}-${snippet}`}>
                      {snippet}
                    </p>
                  ))}
                  <button
                    className="action-button"
                    type="button"
                    aria-label={`只看来源：${card.sourceTitle}`}
                    onClick={() => onSubmitTask?.(card.followUpQuery)}
                  >
                    只看来源：{normalizeWorkbenchText(card.sourceTitle)}
                  </button>
                </div>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function getRollbackTargetBeforeUserEntry(
  entry: WorkbenchState["conversation"]["entries"][number],
  state: WorkbenchState
) {
  if (entry.kind !== "user") {
    return null;
  }

  if (entry.rollbackTargetId) {
    return entry.rollbackTargetId;
  }

  const submitRollbackId = entry.id.endsWith("-user")
    ? entry.id.slice(0, -"user".length - 1)
    : null;

  if (!submitRollbackId) {
    return null;
  }

  const submitRollbackIndex = state.rollback.entries.findIndex((rollbackEntry) => rollbackEntry.id === submitRollbackId);

  if (submitRollbackIndex < 0) {
    return null;
  }

  return state.rollback.entries[submitRollbackIndex + 1]?.id ?? null;
}

export function MainConversation({
  state,
  onPreviewRollback,
  onRestoreRecentConversation,
  onDeleteRecentConversation,
  onRetryLocalTask,
  onSubmitTask,
  onOpenAttachment,
  knowledgeReferenceLabel
}: MainConversationProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [expandedKnowledgeEntryIds, setExpandedKnowledgeEntryIds] = useState<Set<string>>(() => new Set());
  const pendingTask = getPendingTaskLike(state);
  const latestFailedTask = getLatestFailedTask(state);
  const canRetryLatestFailedTask = Boolean(
    latestFailedTask && latestFailedTask.attemptCount < MAX_VISIBLE_LOCAL_TASK_ATTEMPTS
  );
  const hasPendingTask = pendingTask !== null;
  const isLocalModelPending = isLocalModelPendingTask(pendingTask?.executionKind);
  const entries = state.conversation.entries.slice().reverse();
  const visibleEntries = entries.filter((entry) => {
    if (entry.kind === "system") {
      return isVisibleSystemEntry(entry);
    }

    return true;
  });
  const conversationHeader = createConversationHeader(visibleEntries);
  const showsCancellationRecovery = state.audit.lastEvent.source === "permission_confirmation_cancelled"
    || state.audit.lastEvent.source === "permission_mode_change_cancelled"
    || state.audit.lastEvent.source === "capability_toggle_cancelled";
  const showsActionableErrorRecovery = state.error !== null && state.error.module !== "ollama";
  const pendingStatusLabel = pendingTask ? TEXT.runningLabel : TEXT.queuedLabel;
  const pendingTitle = TEXT.thinkingTitle;

  useGSAP(() => {
    const container = scrollContainerRef.current;

    if (!container || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const latestRow = container.querySelector<HTMLElement>(".message-row:last-of-type");

    if (!latestRow) {
      return;
    }

    gsap.fromTo(latestRow, { opacity: 0, y: 10 }, {
      opacity: 1,
      y: 0,
      duration: 0.28,
      ease: "power2.out",
      clearProps: "transform,opacity"
    });
  }, { dependencies: [state.conversation.entries.length, state.tasks.activeTaskId, state.error?.module], scope: scrollContainerRef });

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [state.conversation.entries, state.tasks.items, state.tasks.activeTaskId]);

  function toggleKnowledgeDetails(entryId: string) {
    setExpandedKnowledgeEntryIds((current) => {
      const next = new Set(current);

      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }

      return next;
    });
  }

  return (
    <section className="conversation" aria-label={TEXT.conversation}>
      {conversationHeader ? (
        <header className="conversation-header">
          <div className="conversation-hero">
            <h1>{normalizeWorkbenchText(conversationHeader.title)}</h1>
            {conversationHeader.overview ? (
              <p className="conversation-subtitle">
                {normalizeWorkbenchText(conversationHeader.overview)}
              </p>
            ) : null}
          </div>
        </header>
      ) : null}
      <div className="conversation-scroll" data-motion-scope="conversation" ref={scrollContainerRef}>
        {visibleEntries.map((entry) => {
          const isUser = entry.kind === "user";
          const { cards: searchReferenceCards, remainingLines: linesWithoutSearch } =
            parseSearchReferenceCards(getVisibleDetailLines(entry));
          const { cards: knowledgeHitCards, remainingLines } = parseKnowledgeHitCards(linesWithoutSearch);
          const knowledgeMetadataLines = remainingLines.filter(isKnowledgeMetadataLine);
          const visibleDetailLines = remainingLines.filter((line) => !isKnowledgeMetadataLine(line));
          const userRollbackTargetId = getRollbackTargetBeforeUserEntry(entry, state);
          const hasKnowledgeDetails =
            knowledgeHitCards.length > 0
            || knowledgeMetadataLines.length > 0
            || searchReferenceCards.length > 0;

          return (
            <article
              className={`message-row ${isUser ? "user-row message-row-user-bubble" : "assistant-row"}`}
              key={entry.id}
            >
              {isUser ? null : (
                <div className="message-avatar assistant-avatar">
                  <Bot aria-hidden="true" size={18} />
                </div>
              )}
              <div className={`message-body ${isUser ? "user-message-bubble" : ""}`}>
                {isUser ? null : (
                  <p className="message-title">
                    {normalizeWorkbenchText(getVisibleTitle(entry, isUser))}
                  </p>
                )}
                {entry.attachments && entry.attachments.length > 0 ? (
                  <div className="message-attachment-strip" aria-label="消息附件">
                    {entry.attachments.map((attachment) => (
                      <AttachmentPreview
                        attachment={attachment}
                        classNamePrefix="message"
                        key={attachment.id}
                        onOpen={onOpenAttachment}
                      />
                    ))}
                  </div>
                ) : null}
                {isUser ? (
                  <CollapsibleWorkbenchText text={getVisibleSummary(entry)} isUser={isUser} />
                ) : (
                  renderAssistantSummary(getVisibleSummary(entry))
                )}
                {hasKnowledgeDetails ? (
                  <InformationReferences
                    entryId={entry.id}
                    expanded={expandedKnowledgeEntryIds.has(entry.id)}
                    knowledgeCards={knowledgeHitCards}
                    metadataLines={knowledgeMetadataLines}
                    searchCards={searchReferenceCards}
                    onSubmitTask={onSubmitTask}
                    onToggle={toggleKnowledgeDetails}
                    label={knowledgeReferenceLabel}
                  />
                ) : null}
                {visibleDetailLines.map((line) => (
                  <p className="message-detail" key={`${entry.id}-${line}`}>
                    {normalizeWorkbenchText(line)}
                  </p>
                ))}
                {userRollbackTargetId ? (
                  <button
                    aria-label={TEXT.rollbackToUserMessage}
                    className="message-rollback-action"
                    type="button"
                    onClick={() => onPreviewRollback(userRollbackTargetId)}
                  >
                    <RotateCcw aria-hidden="true" size={14} />
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}

        {showsCancellationRecovery ? (
          <article className="message-row assistant-row">
            <div className="message-avatar assistant-avatar">
              <Bot aria-hidden="true" size={18} />
            </div>
            <div className="message-body">
              <p className="message-title">{TEXT.system}</p>
              <p className="message-summary">
                {normalizeWorkbenchText(getVisibleCancellationSummary(state.audit.lastEvent.source))}
              </p>
            </div>
          </article>
        ) : null}

        {showsActionableErrorRecovery ? (
          <article className="message-row assistant-row">
            <div className="message-avatar assistant-avatar">
              <Bot aria-hidden="true" size={18} />
            </div>
            <div className="message-body">
              <p className="message-title">
                {state.error ? normalizeWorkbenchText(getVisibleErrorTitle(state.error)) : ""}
              </p>
              <p className="message-summary">
                {state.error ? normalizeWorkbenchText(getVisibleErrorActionLabel(state.error)) : ""}
              </p>
              {state.error ? (
                <p className="message-detail">{normalizeWorkbenchText(getVisibleErrorDetail(state.error))}</p>
              ) : null}
              {state.error
                && latestFailedTask
                && canRetryLatestFailedTask
                && state.error.module === "tasks"
                && onRetryLocalTask ? (
                  <div className="action-row">
                    <button
                      className="action-button action-button-primary"
                      type="button"
                      onClick={() => onRetryLocalTask(latestFailedTask.id)}
                    >
                      重试本地任务
                    </button>
                  </div>
                ) : null}
            </div>
          </article>
        ) : null}

        {hasPendingTask ? (
          <article
            aria-label="assistant-pending"
            aria-live="polite"
            className="message-row assistant-row thinking-row"
          >
            <div className="message-avatar assistant-avatar thinking-avatar">
              <LoaderCircle aria-hidden="true" className="thinking-spinner" size={18} />
            </div>
            <div className="message-body">
              <div className="thinking-header">
                <p className="message-title">{pendingTitle}</p>
                <span className="thinking-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
              {!isLocalModelPending ? (
                <div className="task-inline-panel">
                  <span className="task-inline-status">{pendingStatusLabel}</span>
                </div>
              ) : (
                <div className="thinking-summary-group">
                  {pendingTask.streamingSummary?.trim() ? (
                    renderAssistantSummary(getPendingAssistantSummaryText(pendingTask))
                  ) : (
                    <p className="message-detail">正在准备回复…</p>
                  )}
                </div>
              )}
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
