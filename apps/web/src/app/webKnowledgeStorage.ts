export type WebKnowledgeRecord = {
  activeLibraryId: string;
  libraries: Array<{
    id: string;
    label: string;
    importedFiles: Array<{
      path: string;
      title: string;
      status: "ready" | "missing";
      content: string;
    }>;
  }>;
};

const WEB_KNOWLEDGE_STORAGE_KEY = "opencow.web.knowledge.v1";

function isBrowserStorageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readWebKnowledgeRecord(): WebKnowledgeRecord {
  if (!isBrowserStorageAvailable()) {
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

  const candidate = window.localStorage.getItem(WEB_KNOWLEDGE_STORAGE_KEY);

  if (!candidate) {
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

  try {
    const parsed = JSON.parse(candidate) as Partial<WebKnowledgeRecord> & {
      importedFiles?: Array<{
        path: string;
        title: string;
        status: "ready" | "missing";
        content: string;
      }>;
    };

    if (Array.isArray(parsed.libraries) && typeof parsed.activeLibraryId === "string") {
      return parsed as WebKnowledgeRecord;
    }

    return {
      activeLibraryId: "default-library",
      libraries: [
        {
          id: "default-library",
          label: "默认知识库",
          importedFiles: parsed.importedFiles ?? []
        }
      ]
    };
  } catch {
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
