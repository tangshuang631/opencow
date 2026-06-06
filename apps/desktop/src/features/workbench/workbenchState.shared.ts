import type { ConversationEntry, PermissionMode, WorkbenchState } from "./workbenchState.types";

const MAX_CONVERSATION_ENTRIES = 12;
const COMPRESSED_CONVERSATION_ENTRY_ID = "conversation-auto-summary";

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
  return `${prefix}-${suffix}-${state.rollback.entries.length}`;
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

  return [
    ...keptEntries,
    {
      id: COMPRESSED_CONVERSATION_ENTRY_ID,
      kind: "system",
      title: "Conversation auto-compressed",
      summary: `Compressed ${compressedEntryCount} older messages to keep the desktop context light.`,
      detailLines: [
        `Older user messages: ${compressedUserCount}`,
        `Older assistant or system messages: ${compressedSystemCount}`,
        sampleTitles.length > 0 ? `Compressed highlights: ${sampleTitles}` : "Compressed highlights: none"
      ]
    }
  ];
}

function parseCompressedConversationEntry(entry: ConversationEntry | undefined): {
  totalCount: number;
  userCount: number;
  systemCount: number;
} {
  if (!entry) {
    return {
      totalCount: 0,
      userCount: 0,
      systemCount: 0
    };
  }

  const totalCount = Number.parseInt(entry.summary.match(/Compressed (\d+) older messages/i)?.[1] ?? "0", 10);
  const userCount = Number.parseInt(entry.detailLines?.[0]?.match(/Older user messages: (\d+)/i)?.[1] ?? "0", 10);
  const systemCount = Number.parseInt(
    entry.detailLines?.[1]?.match(/Older assistant or system messages: (\d+)/i)?.[1] ?? "0",
    10
  );

  return {
    totalCount,
    userCount,
    systemCount
  };
}
