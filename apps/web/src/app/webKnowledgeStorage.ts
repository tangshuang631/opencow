export type WebKnowledgeRecord = {
  importedFiles: Array<{
    path: string;
    title: string;
    status: "ready" | "missing";
    content: string;
  }>;
};

const WEB_KNOWLEDGE_STORAGE_KEY = "opencow.web.knowledge.v1";

function isBrowserStorageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readWebKnowledgeRecord(): WebKnowledgeRecord {
  if (!isBrowserStorageAvailable()) {
    return { importedFiles: [] };
  }

  const candidate = window.localStorage.getItem(WEB_KNOWLEDGE_STORAGE_KEY);

  if (!candidate) {
    return { importedFiles: [] };
  }

  try {
    return JSON.parse(candidate) as WebKnowledgeRecord;
  } catch {
    return { importedFiles: [] };
  }
}

export function persistWebKnowledgeRecord(record: WebKnowledgeRecord) {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  window.localStorage.setItem(WEB_KNOWLEDGE_STORAGE_KEY, JSON.stringify(record));
}

export function clearWebKnowledgeRecord() {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  window.localStorage.removeItem(WEB_KNOWLEDGE_STORAGE_KEY);
}
