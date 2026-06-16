import type { LocalKnowledgeSearchResult } from "../../../desktop/src/features/assistant/localAssistantService";
import { readWebKnowledgeRecord, type WebKnowledgeRecord } from "./webKnowledgeStorage";

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function createQueryTokens(query: string) {
  return normalizeText(query)
    .split(" ")
    .filter((token) => token.length >= 3)
    .filter((token) => !["search", "local", "knowledge", "for", "the", "and"].includes(token));
}

function parseScopedSourceFilter(query: string) {
  const match = query.match(/search local knowledge in (.+?) for (.+)/i);

  if (!match) {
    return {
      sourceFilter: "",
      tokenQuery: query
    };
  }

  return {
    sourceFilter: normalizeText(match[1] ?? ""),
    tokenQuery: match[2] ?? query
  };
}

export function searchWebKnowledge(query: string, record = readWebKnowledgeRecord()): LocalKnowledgeSearchResult {
  const activeLibrary =
    record.libraries.find((library) => library.id === record.activeLibraryId)
    ?? record.libraries[0]
    ?? { importedFiles: [] };
  const { sourceFilter, tokenQuery } = parseScopedSourceFilter(query);
  const tokens = createQueryTokens(tokenQuery);
  const items = activeLibrary.importedFiles
    .filter((file) => {
      if (!sourceFilter) {
        return true;
      }

      const searchableSource = normalizeText(`${file.title} ${file.path}`);
      return searchableSource.includes(sourceFilter);
    })
    .map((file) => {
      const haystack = normalizeText(`${file.title} ${file.content}`);
      const matchedTokenCount = tokens.filter((token) => haystack.includes(token)).length;

      if (matchedTokenCount === 0) {
        return null;
      }

      const snippetSource = file.content.replace(/\s+/g, " ").trim();

      return {
        path: file.path,
        title: file.title,
        snippet: snippetSource.slice(0, 160),
        score: matchedTokenCount * 10
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => right.score - left.score);

  return {
    query,
    summary: `Web local knowledge search found ${items.length} matching passages across ${activeLibrary.importedFiles.length} indexed documents.`,
    match_count: items.length,
    indexed_document_count: activeLibrary.importedFiles.length,
    items
  };
}
