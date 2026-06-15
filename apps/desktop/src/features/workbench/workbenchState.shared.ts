import type { ConversationEntry, PermissionMode, WorkbenchState } from "./workbenchState.types";

const MAX_CONVERSATION_ENTRIES = 12;
const COMPRESSED_CONVERSATION_ENTRY_ID = "conversation-auto-summary";
const COMPRESSED_CONVERSATION_TITLE = "已保留较早会话上下文";
const MAX_COMPRESSED_SNIPPETS = 5;
const MAX_COMPRESSED_SNIPPET_LENGTH = 140;

export function getPermissionPresentation(mode: PermissionMode) {
  if (mode === "workspace-write") {
    return {
      mode,
      label: "工作区读写",
      summary: "允许在授权工作区内创建和修改文件，但仍禁止高风险删除。"
    };
  }

  if (mode === "controlled-full") {
    return {
      mode,
      label: "受控完全访问",
      summary: "允许受控高风险操作，但必须保留确认、日志、超时和回退。"
    };
  }

  return {
    mode: "readonly" as const,
    label: "只读",
    summary: "仅允许读取已授权目录与附件。"
  };
}

export function prependConversationEntry(
  entries: ConversationEntry[],
  entry: ConversationEntry
): ConversationEntry[] {
  return compactConversationEntries([entry, ...entries]);
}

export function prependConversationEntries(
  entries: ConversationEntry[],
  nextEntries: ConversationEntry[]
): ConversationEntry[] {
  return compactConversationEntries([...nextEntries.reverse(), ...entries]);
}

export function createWorkbenchEventId(
  state: WorkbenchState,
  prefix: string,
  suffix: string
): string {
  return `${prefix}-${suffix}-${getNextWorkbenchEventOrdinal(state)}`;
}

function getNextWorkbenchEventOrdinal(state: WorkbenchState): number {
  const rollbackOrdinals = state.rollback.entries
    .map((entry) => parseTrailingOrdinal(entry.id))
    .filter((value): value is number => value !== null);
  const conversationOrdinals = state.conversation.entries
    .map((entry) => parseTrailingOrdinal(entry.id))
    .filter((value): value is number => value !== null);
  const maxOrdinal = Math.max(0, ...rollbackOrdinals, ...conversationOrdinals);

  return maxOrdinal + 1;
}

function parseTrailingOrdinal(id: string): number | null {
  const match = id.match(/-(\d+)$/);

  return match ? Number.parseInt(match[1] ?? "", 10) : null;
}

function compactConversationEntries(entries: ConversationEntry[]): ConversationEntry[] {
  const previousCompressedEntry = entries.find((entry) => entry.id === COMPRESSED_CONVERSATION_ENTRY_ID);
  const previousCompressedSummary = parseCompressedConversationEntry(previousCompressedEntry);
  const normalizedEntries = entries.filter((entry) => entry.id !== COMPRESSED_CONVERSATION_ENTRY_ID);
  const hasPreviousCompressedEntry = Boolean(previousCompressedEntry);

  if (!hasPreviousCompressedEntry && normalizedEntries.length <= MAX_CONVERSATION_ENTRIES) {
    return normalizedEntries.slice(0, MAX_CONVERSATION_ENTRIES);
  }

  const recentEntryLimit = MAX_CONVERSATION_ENTRIES - 1;
  const keptEntries = normalizedEntries.slice(0, recentEntryLimit);
  const compressedEntries = normalizedEntries.slice(recentEntryLimit);
  const compressedUserCount =
    compressedEntries.filter((entry) => entry.kind === "user").length + previousCompressedSummary.userCount;
  const compressedSystemCount =
    compressedEntries.length - compressedEntries.filter((entry) => entry.kind === "user").length
    + previousCompressedSummary.systemCount;
  const compressedEntryCount = compressedEntries.length + previousCompressedSummary.totalCount;
  const sampleTitles = compressedEntries
    .slice(0, 3)
    .map((entry) => entry.title)
    .filter((title, index, titles) => title.length > 0 && titles.indexOf(title) === index)
    .join(", ");
  const sampleSnippets = selectCompressedConversationSnippets(
    compressedEntries,
    previousCompressedSummary.snippets
  );

  return [
    ...keptEntries,
    {
      id: COMPRESSED_CONVERSATION_ENTRY_ID,
      kind: "system",
      title: COMPRESSED_CONVERSATION_TITLE,
      summary: `已压缩 ${compressedEntryCount} 条较早消息，以保持当前会话轻量且保留上下文。`,
      detailLines: [
        `较早用户消息：${compressedUserCount}`,
        `较早助手或系统消息：${compressedSystemCount}`,
        sampleTitles.length > 0 ? `保留主题：${sampleTitles}` : "保留主题：无",
        sampleSnippets.length > 0
          ? `保留片段：${sampleSnippets.join(" | ")}`
          : "保留片段：无"
      ]
    }
  ];
}

function parseCompressedConversationEntry(entry: ConversationEntry | undefined): {
  totalCount: number;
  userCount: number;
  systemCount: number;
  snippets: string[];
} {
  if (!entry) {
    return {
      totalCount: 0,
      userCount: 0,
      systemCount: 0,
      snippets: []
    };
  }

  const totalCount = Number.parseInt(
    entry.summary.match(/已压缩\s*(\d+)\s*条较早消息/)?.[1]
      ?? entry.summary.match(/Compressed (\d+) older messages/i)?.[1]
      ?? "0",
    10
  );
  const userCount = Number.parseInt(
    entry.detailLines?.[0]?.match(/较早用户消息：(\d+)/)?.[1]
      ?? entry.detailLines?.[0]?.match(/Older user messages: (\d+)/i)?.[1]
      ?? "0",
    10
  );
  const systemCount = Number.parseInt(
    entry.detailLines?.[1]?.match(/较早助手或系统消息：(\d+)/)?.[1]
      ?? entry.detailLines?.[1]?.match(/Older assistant or system messages: (\d+)/i)?.[1]
      ?? "0",
    10
  );
  const snippets = parseCompressedConversationSnippets(entry.detailLines);

  return {
    totalCount,
    userCount,
    systemCount,
    snippets
  };
}

function selectCompressedConversationSnippets(
  compressedEntries: ConversationEntry[],
  previousSnippets: string[]
): string[] {
  const currentSnippets = compressedEntries
    .slice()
    .reverse()
    .map(formatCompressedConversationSnippet)
    .filter((snippet) => snippet.length > 0);
  const uniqueSnippets = [...previousSnippets, ...currentSnippets].filter(
    (snippet, index, snippets) => snippets.indexOf(snippet) === index
  );

  return uniqueSnippets.slice(0, MAX_COMPRESSED_SNIPPETS);
}

function formatCompressedConversationSnippet(entry: ConversationEntry): string {
  const kindLabel = entry.kind === "user" ? "用户" : "助手/系统";
  const rawSnippet = `[${kindLabel}] ${entry.title}: ${entry.summary}`.replace(/\s+/g, " ").trim();

  if (rawSnippet.length <= MAX_COMPRESSED_SNIPPET_LENGTH) {
    return rawSnippet;
  }

  return `${rawSnippet.slice(0, MAX_COMPRESSED_SNIPPET_LENGTH - 1)}…`;
}

function parseCompressedConversationSnippets(detailLines: string[] | undefined): string[] {
  const snippetsLine = detailLines?.find((line) => line.startsWith("保留片段："))
    ?? detailLines?.find((line) => line.startsWith("Compressed snippets: "));

  if (!snippetsLine) {
    return [];
  }

  const snippets = snippetsLine
    .replace("保留片段：", "")
    .replace("Compressed snippets: ", "")
    .trim();

  if (!snippets || snippets === "无" || snippets === "none") {
    return [];
  }

  return snippets.split(" | ").map((snippet) => snippet.trim()).filter(Boolean);
}
