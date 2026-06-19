import { afterEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import {
  clearKnowledgeImports,
  createKnowledgeLibrary,
  importKnowledgeFile,
  loadKnowledgeInventory,
  loadOpenClawCapabilityOverview,
  removeKnowledgeFile,
  selectKnowledgeLibrary
} from "./localAssistantService";
import {
  runControlledFullShellCommand,
  runReadonlyShellCommand,
  runWorkspaceWriteShellCommand
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
          summary: "Knowledge inventory loaded.",
          active_library_id: "default-library",
          active_library_label: "默认知识库",
          libraries: [
            {
              id: "default-library",
              label: "默认知识库",
              description: "系统默认知识库"
            }
          ]
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
      summary: "Knowledge inventory loaded.",
      activeLibraryId: "default-library",
      activeLibraryLabel: "默认知识库",
      libraries: [
        {
          id: "default-library",
          label: "默认知识库",
          description: "系统默认知识库"
        }
      ]
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
          summary: "Knowledge file imported.",
          active_library_id: "rules-library",
          active_library_label: "规则库",
          libraries: [
            {
              id: "default-library",
              label: "默认知识库",
              description: "系统默认知识库"
            },
            {
              id: "rules-library",
              label: "规则库",
              description: "规则与约束集合"
            }
          ]
        };
      }

      return null;
    });

    const result = await importKnowledgeFile("notes/guide.txt", "rules-library");

    expect(capturedPayload).toEqual({
      path: "notes/guide.txt",
      libraryId: "rules-library"
    });
    expect(result.importedFiles[0]).toMatchObject({
      path: "notes/guide.txt",
      title: "guide.txt",
      status: "ready"
    });
    expect(result.indexedDocumentCount).toBe(1);
    expect(result.activeLibraryLabel).toBe("规则库");
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

    const result = await removeKnowledgeFile("notes/guide.txt", "rules-library");

    expect(capturedPayload).toEqual({
      path: "notes/guide.txt",
      libraryId: "rules-library"
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
          summary: "Knowledge imports cleared.",
          active_library_id: "rules-library",
          active_library_label: "规则库",
          libraries: [
            {
              id: "default-library",
              label: "默认知识库",
              description: "系统默认知识库"
            },
            {
              id: "rules-library",
              label: "规则库",
              description: "规则与约束集合"
            }
          ]
        };
      }

      return null;
    });

    const result = await clearKnowledgeImports("rules-library");

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
      summary: "Knowledge imports cleared.",
      activeLibraryId: "rules-library",
      activeLibraryLabel: "规则库",
      libraries: [
        {
          id: "default-library",
          label: "默认知识库",
          description: "系统默认知识库"
        },
        {
          id: "rules-library",
          label: "规则库",
          description: "规则与约束集合"
        }
      ]
    });
  });

  it("creates a desktop named knowledge library and normalizes the response", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};
    let capturedPayload: unknown;

    mockIPC((cmd, payload) => {
      if (cmd === "knowledge_library_create") {
        capturedPayload = payload;
        return {
          imported_files: [],
          available_files: [],
          indexed_document_count: 0,
          registry_path: ".opencow/knowledge/imported-files.json",
          summary: "Knowledge library created.",
          active_library_id: "product-docs",
          active_library_label: "产品文档库",
          libraries: [
            {
              id: "default-library",
              label: "默认知识库",
              description: "系统默认知识库"
            },
            {
              id: "product-docs",
              label: "产品文档库",
              description: "整理产品需求、PRD 和交互说明。"
            }
          ]
        };
      }

      return null;
    });

    const result = await createKnowledgeLibrary("产品文档库", "整理产品需求、PRD 和交互说明。");

    expect(capturedPayload).toEqual({
      name: "产品文档库",
      description: "整理产品需求、PRD 和交互说明。"
    });
    expect(result.activeLibraryId).toBe("product-docs");
    expect(result.activeLibraryLabel).toBe("产品文档库");
    expect(result.libraries?.map((library) => library.label)).toEqual(["默认知识库", "产品文档库"]);
    expect(result.libraries?.[1]?.description).toBe("整理产品需求、PRD 和交互说明。");
  });

  it("selects a desktop named knowledge library and normalizes the response", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};
    let capturedPayload: unknown;

    mockIPC((cmd, payload) => {
      if (cmd === "knowledge_library_select") {
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
          summary: "Knowledge library selected.",
          active_library_id: "default-library",
          active_library_label: "默认知识库",
          libraries: [
            {
              id: "default-library",
              label: "默认知识库",
              description: "系统默认知识库"
            },
            {
              id: "rules-library",
              label: "规则库",
              description: "规则与约束集合"
            }
          ]
        };
      }

      return null;
    });

    const result = await selectKnowledgeLibrary("default-library");

    expect(capturedPayload).toEqual({
      libraryId: "default-library"
    });
    expect(result.activeLibraryLabel).toBe("默认知识库");
    expect(result.availableFiles[0]?.path).toBe("notes/guide.txt");
  });

  it("sends snake_case payload keys for desktop capability overview requests", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};
    let capturedPayload: unknown;

    mockIPC((cmd, payload) => {
      if (cmd === "openclaw_capability_overview") {
        capturedPayload = payload;
        return {
          capability_id: "rag",
          title: "OpenClaw RAG capability overview",
          status: "ready-foundation",
          required_package_count: 3,
          available_package_count: 3,
          available_packages: ["@openclaw/llm-core"],
          missing_packages: [],
          summary: "ok"
        };
      }

      return null;
    });

    await loadOpenClawCapabilityOverview("rag");

    expect(capturedPayload).toEqual({
      capability_id: "rag"
    });
  });

  it("sends snake_case payload keys for desktop shell commands", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};
    const capturedPayloads: Record<string, unknown> = {};

    mockIPC((cmd, payload) => {
      if (cmd === "workspace_readonly_command") {
        capturedPayloads.readonly = payload;
        return {
          command_id: "git-status",
          command_label: "git status --short",
          stdout_preview: " M apps/desktop/src/app/App.tsx",
          line_count: 1,
          summary: "ok"
        };
      }

      if (cmd === "workspace_write_command") {
        capturedPayloads.write = payload;
        return {
          command_id: "create-temp-output-dir",
          command_label: "mkdir temp-output",
          stdout_preview: "temp-output",
          line_count: 1,
          summary: "ok"
        };
      }

      if (cmd === "controlled_full_command") {
        capturedPayloads.full = payload;
        return {
          command_id: "remove-temp-output-dir",
          command_label: "Remove-Item temp-output -Recurse -Force",
          stdout_preview: "temp-output removed",
          line_count: 1,
          summary: "ok"
        };
      }

      return null;
    });

    await runReadonlyShellCommand("git-status");
    await runWorkspaceWriteShellCommand("create-temp-output-dir");
    await runControlledFullShellCommand("remove-temp-output-dir");

    expect(capturedPayloads.readonly).toEqual({
      command_id: "git-status"
    });
    expect(capturedPayloads.write).toEqual({
      command_id: "create-temp-output-dir"
    });
    expect(capturedPayloads.full).toEqual({
      command_id: "remove-temp-output-dir"
    });
  });
});
