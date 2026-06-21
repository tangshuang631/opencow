import { Bot, ChevronDown, Globe, LoaderCircle, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
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
    const match = line.match(/^搜索来源：标题=(.+?)；(?:来源|提供方)=(.+?)；查询=(.+?)；地址=(.+?)；摘要=(.+?)(?:；事实片段=(.+))?$/);

    if (!match) {
      remainingLines.push(line);
      continue;
    }

    cards.push({
      title: match[1]?.trim() ?? "",
      provider: match[2]?.trim() ?? "",
      sourceLabel: match[2]?.trim() ?? "",
      query: match[3]?.trim() ?? "",
      url: match[4]?.trim() ?? "",
      summary: match[5]?.trim() ?? "",
      factSnippets: match[6]
        ?.split("｜")
        .map((snippet) => snippet.trim())
        .filter(Boolean) ?? []
    });
  }

  return { cards, remainingLines };
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
    return "已跳过重复审批请求";
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
    title: isLongWorkbenchText(title) ? "长文本对话" : createCompactText(title, LONG_TITLE_LIMIT),
    overview
  };
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
  const parts = normalized.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
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
  | { type: "paragraph"; content: string }
  | { type: "ordered-list"; items: Array<{ content: string; children: string[] }> };

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = normalizeWorkbenchText(text).replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraphLines: string[] = [];
  let orderedListItems: Array<{ content: string; children: string[] }> = [];

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

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushOrderedList();
      continue;
    }

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
      blocks.push({
        type: "heading",
        content: trimmed.replace(/^\*\*|\*\*$/g, "")
      });
      continue;
    }

    flushOrderedList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushOrderedList();

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
  if (!text.includes("**") && !/^\s*\d+\.\s+/m.test(text) && !/^\s*[*-]\s+/m.test(text)) {
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
  onSubmitTask
}: {
  entryId: string;
  knowledgeCards: KnowledgeHitCard[];
  searchCards: SearchReferenceCard[];
  metadataLines: string[];
  expanded: boolean;
  onToggle: (entryId: string) => void;
  onSubmitTask?: (message: string) => void;
}) {
  const totalCount = knowledgeCards.length + searchCards.length;

  return (
    <section className="message-knowledge-results" aria-label="信息引用">
      <button
        aria-expanded={expanded}
        aria-label={expanded ? "收起信息引用" : "展开信息引用"}
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
                    {(card.factSnippets.length > 0 ? card.factSnippets : [card.summary]).map((snippet) => (
                      <p className="message-reference-summary" key={`${entryId}-${card.url}-${snippet}`}>
                        {normalizeWorkbenchText(snippet)}
                      </p>
                    ))}
                  </div>
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
                </div>
              ))}
            </>
          ) : null}
          {knowledgeCards.length > 0 ? (
            <>
              <p className="message-detail-title">知识库来源</p>
              {knowledgeCards.map((card) => (
                <div className="message-knowledge-item" key={`${entryId}-${card.sourceTitle}-${card.score}`}>
                  <p className="message-detail">来源文件：{normalizeWorkbenchText(card.sourceTitle)}</p>
                  <p className="message-detail">匹配分数：{normalizeWorkbenchText(card.score)}</p>
                  {(card.factSnippets.length > 0 ? card.factSnippets : [card.snippet]).map((snippet) => (
                    <p className="message-reference-summary" key={`${entryId}-${card.sourceTitle}-${snippet}`}>
                      {normalizeWorkbenchText(snippet)}
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
  onOpenAttachment
}: MainConversationProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [expandedKnowledgeEntryIds, setExpandedKnowledgeEntryIds] = useState<Set<string>>(() => new Set());
  const pendingTask = getPendingTaskLike(state);
  const latestFailedTask = getLatestFailedTask(state);
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
      <div className="conversation-scroll" ref={scrollContainerRef}>
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
                  {renderAssistantSummary(getPendingAssistantSummaryText(pendingTask))}
                </div>
              )}
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
