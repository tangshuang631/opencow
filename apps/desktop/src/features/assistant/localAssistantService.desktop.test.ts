import { afterEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import {
  clearKnowledgeImports,
  importKnowledgeFile,
  loadKnowledgeInventory,
  removeKnowledgeFile
} from "./localAssistantService";

const tauriInternals = "__TAURI_INTERNALS__" as const;

describe("localAssistantService desktop knowledge inventory", () => {
  afterEach(() => {
    clearMocks();
    vi.restoreAllMocks();
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals];
  });

  it("maps desktop knowledge inventory fields into the frontend camelCase shape", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};

    mockIPC((cmd) => {
      if (cmd === "knowledge_inventory") {
        return {
          imported_files: [
            {
              path: "notes/guide.txt",
              title: "guide.txt",
              status: "ready"
            }
          ],
          available_files: [
            {
              path: "docs/rag-checklist.md",
              title: "rag-checklist.md"
            }
          ],
          indexed_document_count: 1,
          registry_path: ".opencow/knowledge/imported-files.json",
          summary: "Knowledge inventory loaded."
        };
      }

      return null;
    });

    const result = await loadKnowledgeInventory();

    expect(result).toEqual({
      importedFiles: [
        {
          path: "notes/guide.txt",
          title: "guide.txt",
          status: "ready"
        }
      ],
      availableFiles: [
        {
          path: "docs/rag-checklist.md",
          title: "rag-checklist.md"
        }
      ],
      indexedDocumentCount: 1,
      registryPath: ".opencow/knowledge/imported-files.json",
      summary: "Knowledge inventory loaded."
    });
  });

  it("passes the selected path into desktop knowledge import and normalizes the response", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};
    let capturedPayload: unknown;

    mockIPC((cmd, payload) => {
      if (cmd === "knowledge_file_import") {
        capturedPayload = payload;
        return {
          imported_files: [
            {
              path: "notes/guide.txt",
              title: "guide.txt",
              status: "ready"
            }
          ],
          available_files: [],
          indexed_document_count: 1,
          registry_path: ".opencow/knowledge/imported-files.json",
          summary: "Knowledge file imported."
        };
      }

      return null;
    });

    const result = await importKnowledgeFile("notes/guide.txt");

    expect(capturedPayload).toEqual({
      path: "notes/guide.txt"
    });
    expect(result.importedFiles[0]).toMatchObject({
      path: "notes/guide.txt",
      title: "guide.txt",
      status: "ready"
    });
    expect(result.indexedDocumentCount).toBe(1);
  });

  it("passes the selected path into desktop knowledge removal and normalizes the response", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};
    let capturedPayload: unknown;

    mockIPC((cmd, payload) => {
      if (cmd === "knowledge_file_remove") {
        capturedPayload = payload;
        return {
          imported_files: [],
          available_files: [
            {
              path: "notes/guide.txt",
              title: "guide.txt"
            }
          ],
          indexed_document_count: 0,
          registry_path: ".opencow/knowledge/imported-files.json",
          summary: "Knowledge file removed."
        };
      }

      return null;
    });

    const result = await removeKnowledgeFile("notes/guide.txt");

    expect(capturedPayload).toEqual({
      path: "notes/guide.txt"
    });
    expect(result.importedFiles).toEqual([]);
    expect(result.availableFiles[0]).toMatchObject({
      path: "notes/guide.txt",
      title: "guide.txt"
    });
    expect(result.indexedDocumentCount).toBe(0);
  });

  it("normalizes desktop knowledge clear responses into the frontend inventory shape", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};

    mockIPC((cmd) => {
      if (cmd === "knowledge_imports_clear") {
        return {
          imported_files: [],
          available_files: [
            {
              path: "docs/rag-checklist.md",
              title: "rag-checklist.md"
            },
            {
              path: "notes/guide.txt",
              title: "guide.txt"
            }
          ],
          indexed_document_count: 0,
          registry_path: ".opencow/knowledge/imported-files.json",
          summary: "Knowledge imports cleared."
        };
      }

      return null;
    });

    const result = await clearKnowledgeImports();

    expect(result).toEqual({
      importedFiles: [],
      availableFiles: [
        {
          path: "docs/rag-checklist.md",
          title: "rag-checklist.md"
        },
        {
          path: "notes/guide.txt",
          title: "guide.txt"
        }
      ],
      indexedDocumentCount: 0,
      registryPath: ".opencow/knowledge/imported-files.json",
      summary: "Knowledge imports cleared."
    });
  });
});
