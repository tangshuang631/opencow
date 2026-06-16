import type { LocalKnowledgeSearchResult } from "../../../desktop/src/features/assistant/localAssistantService";
import { readWebKnowledgeRecord } from "./webKnowledgeStorage";

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function createQueryTokens(query: string) {
  return normalizeText(query)
    .split(" ")
    .filter((token) => token.length >= 3)
    .filter((token) => !["search", "local", "knowledge", "for", "the", "and"].includes(token));
}

export function searchWebKnowledge(query: string): LocalKnowledgeSearchResult {
  const record = readWebKnowledgeRecord();
  const tokens = createQueryTokens(query);
  const items = record.importedFiles
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
    summary: `Web local knowledge search found ${items.length} matching passages across ${record.importedFiles.length} indexed documents.`,
    match_count: items.length,
    indexed_document_count: record.importedFiles.length,
    items
  };
}
