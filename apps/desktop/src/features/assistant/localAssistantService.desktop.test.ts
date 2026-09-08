import { afterEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import {
  clearKnowledgeImports,
  createNpcWorkspaceConfig,
  createKnowledgeLibrary,
  disableLocalSkill,
  enableLocalSkill,
  importKnowledgeFile,
  installLocalMcpPlugin,
  installLocalSkill,
  loadRecommendedSkillManifest,
  loadNpcWorkspaceConfig,
  loadNpcWorkspace,
  loadKnowledgeInventory,
  loadOpenClawCapabilityOverview,
  repairOpencowEnabledSkillsRegistry,
  repairOpencowWorkspaceProjectRuntimeRegistry,
  removeKnowledgeFile,
  searchNetwork,
  selectKnowledgeLibrary,
  uninstallLocalMcpPlugin,
  updateNpcWorkspaceConfig,
  writeNpcLocalProjectShowcaseSite
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
              description: "系统默认知识库",
              document_count: 1
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
          description: "系统默认知识库",
          documentCount: 1
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

    const result = await importKnowledgeFile("notes/guide.txt", "rules-library", {
      conversationId: "conversation-1",
      rollbackEntryId: "entry-1"
    });

    expect(capturedPayload).toEqual({
      path: "notes/guide.txt",
      libraryId: "rules-library",
      rollbackContext: {
        conversationId: "conversation-1",
        rollbackEntryId: "entry-1"
      }
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

    const result = await removeKnowledgeFile("notes/guide.txt", "rules-library", {
      conversationId: "conversation-1",
      rollbackEntryId: "entry-2"
    });

    expect(capturedPayload).toEqual({
      path: "notes/guide.txt",
      libraryId: "rules-library",
      rollbackContext: {
        conversationId: "conversation-1",
        rollbackEntryId: "entry-2"
      }
    });
    expect(result.importedFiles).toEqual([]);
    expect(result.availableFiles[0]).toMatchObject({
      path: "notes/guide.txt",
      title: "guide.txt"
    });
    expect(result.indexedDocumentCount).toBe(0);
  });

  it("routes network search through the desktop command and keeps the normalized result shape", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};
    let capturedPayload: unknown;

    mockIPC((cmd, payload) => {
      if (cmd === "network_search") {
        capturedPayload = payload;
        return {
          query: "OpenAI 最新动态",
          provider: "OpenCow 默认搜索",
          effective_provider: "OpenCow 默认搜索",
          used_fallback: false,
          fallback_reason: null,
          items: [
            {
              title: "OpenAI News",
              url: "https://openai.com/news/",
              summary: "OpenAI 官方新闻页。"
            }
          ]
        };
      }

      return null;
    });

    const result = await searchNetwork("OpenAI 最新动态", {
      providerLabel: "OpenCow 默认搜索"
    });

    expect(capturedPayload).toEqual({
      payload: {
        query: "OpenAI 最新动态",
        providerLabel: "OpenCow 默认搜索",
        baseUrl: undefined,
        apiKey: undefined
      }
    });
    expect(result).toEqual({
      query: "OpenAI 最新动态",
      provider: "OpenCow 默认搜索",
      effective_provider: "OpenCow 默认搜索",
      used_fallback: false,
      fallback_reason: null,
      items: [
        {
          title: "OpenAI News",
          url: "https://openai.com/news/",
          summary: "OpenAI 官方新闻页。"
        }
      ],
      intent: "news"
    });
  });

  it("routes weather questions to the structured weather command instead of generic web search", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};
    const capturedCommands: string[] = [];
    let capturedPayload: unknown;

    mockIPC((cmd, payload) => {
      capturedCommands.push(cmd);
      if (cmd === "weather_search") {
        capturedPayload = payload;
        return {
          query: "今天深圳天气怎么样",
          provider: "Open-Meteo 天气",
          effective_provider: "Open-Meteo 天气",
          used_fallback: false,
          fallback_reason: null,
          intent: "weather",
          items: [
            {
              title: "深圳天气（2026-09-04）",
              url: "https://api.open-meteo.com/v1/forecast",
              source_label: "Open-Meteo 天气",
              summary: "深圳：多云，当前约 30°C。",
              fact_snippets: ["当前约 30°C", "今日 24–30°C"]
            }
          ]
        };
      }

      return null;
    });

    const result = await searchNetwork("今天深圳天气怎么样", {
      providerLabel: "OpenCow 默认搜索"
    });

    expect(capturedCommands).toContain("weather_search");
    expect(capturedCommands).not.toContain("network_search");
    expect(capturedPayload).toEqual({
      payload: {
        query: "今天深圳天气怎么样",
        location: "深圳"
      }
    });
    expect(result.intent).toBe("weather");
    expect(result.items[0]?.source_label).toBe("Open-Meteo 天气");
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

    const result = await clearKnowledgeImports("rules-library", {
      conversationId: "conversation-1",
      rollbackEntryId: "entry-3"
    });

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

    const result = await createKnowledgeLibrary("产品文档库", "整理产品需求、PRD 和交互说明。", {
      conversationId: "conversation-1",
      rollbackEntryId: "entry-4"
    });

    expect(capturedPayload).toEqual({
      name: "产品文档库",
      description: "整理产品需求、PRD 和交互说明。",
      rollbackContext: {
        conversationId: "conversation-1",
        rollbackEntryId: "entry-4"
      }
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

  it("loads the desktop recommended skill manifest as-is", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};

    mockIPC((cmd) => {
      if (cmd === "recommended_skill_manifest") {
        return {
          summary: "OpenCow 推荐技能清单已加载，共 2 项。",
          total_count: 2,
          items: [
            {
              name: "coding-agent",
              description: "代码代理",
              source: "opencow-builtin-manifest",
              install_query: "coding-agent",
              rationale: "OpenCow 本地助手最常见的是代码落地与修复，这项覆盖率最高。"
            },
            {
              name: "docs-helper",
              description: "文档助手",
              source: "opencow-builtin-manifest",
              install_query: "docs-helper",
              rationale: "本地助手经常需要整理规则、交接文档和知识说明，适合作为默认文档能力。"
            }
          ]
        };
      }

      return null;
    });

    await expect(loadRecommendedSkillManifest()).resolves.toEqual({
      summary: "OpenCow 推荐技能清单已加载，共 2 项。",
      total_count: 2,
      items: [
        {
          name: "coding-agent",
          description: "代码代理",
          source: "opencow-builtin-manifest",
          install_query: "coding-agent",
          rationale: "OpenCow 本地助手最常见的是代码落地与修复，这项覆盖率最高。"
        },
        {
          name: "docs-helper",
          description: "文档助手",
          source: "opencow-builtin-manifest",
          install_query: "docs-helper",
          rationale: "本地助手经常需要整理规则、交接文档和知识说明，适合作为默认文档能力。"
        }
      ]
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

  it("passes rollback context through desktop skill, mcp, self-repair, and showcase write commands", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};
    const capturedPayloads: Record<string, unknown> = {};
    const rollbackContext = {
      conversationId: "conversation-1",
      rollbackEntryId: "entry-5"
    };

    mockIPC((cmd, payload) => {
      capturedPayloads[cmd] = payload;

      switch (cmd) {
        case "local_skill_enable":
          return {
            query: "启用 coding-agent",
            enabled_skill_name: "coding-agent",
            registry_path: "skills/enabled-skills.json",
            status: "enabled",
            summary: "ok"
          };
        case "local_skill_install":
          return {
            query: "安装 coding-agent",
            installed_skill_name: "coding-agent",
            installed_skill_path: ".opencow/skills/installed/coding-agent/SKILL.md",
            source_skill_path: "vendor/openclaw/skills/coding-agent/SKILL.md",
            status: "installed",
            summary: "ok"
          };
        case "local_skill_disable":
          return {
            query: "禁用 coding-agent",
            disabled_skill_name: "coding-agent",
            registry_path: "skills/enabled-skills.json",
            status: "disabled",
            summary: "ok"
          };
        case "local_mcp_plugin_install":
          return {
            query: "安装 browser mcp",
            installed_plugin_id: "browser",
            installed_plugin_name: "浏览器控制",
            installed_plugin_path: ".opencow/mcp/browser/openclaw.plugin.json",
            source_plugin_path: "vendor/openclaw/extensions/browser/openclaw.plugin.json",
            status: "installed",
            summary: "ok"
          };
        case "local_mcp_plugin_uninstall":
          return {
            query: "卸载 browser mcp",
            removed_plugin_id: "browser",
            removed_plugin_name: "浏览器控制",
            removed_plugin_path: ".opencow/mcp/browser/openclaw.plugin.json",
            status: "removed",
            summary: "ok"
          };
        case "opencow_self_repair_enabled_skills_registry":
          return {
            query: "修复技能注册表",
            repair_target: "enabled-skills-registry",
            repaired_path: "skills/enabled-skills.json",
            status: "repaired",
            preserved_entry_count: 1,
            verified_version: 1,
            verified_entry_count: 1,
            summary: "ok"
          };
        case "opencow_self_repair_workspace_project_runtime_registry":
          return {
            query: "修复运行时注册表",
            repair_target: "workspace-project-runtime-registry",
            repaired_path: ".opencow/runtime/workspace-project-runs.json",
            status: "repaired",
            preserved_entry_count: 1,
            verified_version: 1,
            verified_run_count: 1,
            summary: "ok"
          };
        case "workspace_project_npc_showcase_site_write":
          return {
            project_name: "cattle",
            project_path: "apps/cattle",
            expected_url: "http://127.0.0.1:3000",
            artifact_path: ".opencow/artifacts/npc-showcase/cattle/index.html",
            artifact_directory: ".opencow/artifacts/npc-showcase",
            summary: "ok"
          };
        default:
          return null;
      }
    });

    await enableLocalSkill("启用 coding-agent", rollbackContext);
    await installLocalSkill("安装 coding-agent", rollbackContext);
    await disableLocalSkill("禁用 coding-agent", rollbackContext);
    await installLocalMcpPlugin("安装 browser mcp", rollbackContext);
    await uninstallLocalMcpPlugin("卸载 browser mcp", rollbackContext);
    await repairOpencowEnabledSkillsRegistry("修复技能注册表", rollbackContext);
    await repairOpencowWorkspaceProjectRuntimeRegistry("修复运行时注册表", rollbackContext);
    await writeNpcLocalProjectShowcaseSite("生成展示站点", rollbackContext);

    expect(capturedPayloads.local_skill_enable).toEqual({
      query: "启用 coding-agent",
      rollbackContext
    });
    expect(capturedPayloads.local_skill_install).toEqual({
      query: "安装 coding-agent",
      rollbackContext
    });
    expect(capturedPayloads.local_skill_disable).toEqual({
      query: "禁用 coding-agent",
      rollbackContext
    });
    expect(capturedPayloads.local_mcp_plugin_install).toEqual({
      query: "安装 browser mcp",
      rollbackContext
    });
    expect(capturedPayloads.local_mcp_plugin_uninstall).toEqual({
      query: "卸载 browser mcp",
      rollbackContext
    });
    expect(capturedPayloads.opencow_self_repair_enabled_skills_registry).toEqual({
      query: "修复技能注册表",
      rollbackContext
    });
    expect(capturedPayloads.opencow_self_repair_workspace_project_runtime_registry).toEqual({
      query: "修复运行时注册表",
      rollbackContext
    });
    expect(capturedPayloads.workspace_project_npc_showcase_site_write).toEqual({
      query: "生成展示站点",
      rollbackContext
    });
  });

  it("loads the desktop NPC workspace registry and normalizes snake_case fields", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};

    mockIPC((cmd) => {
      if (cmd === "workspace_npc_configs_list") {
        return {
          summary: "NPC workspace loaded.",
          selected_npc_id: "research-bot",
          items: [
            {
              id: "research-bot",
              name: "研究助手",
              description: "负责资料整理",
              default_model: "qwen2.5-coder:7b",
              persona_title: "资料研究员",
              persona_prompt: "你负责整理资料",
              output_style: "简洁",
              agent_draft: "",
              rules_draft: "",
              enabled_skill_names: ["本地检索增强"],
              knowledge_library_ids: ["product-docs"],
              updated_at: "2026-06-19T10:00:00.000Z"
            }
          ]
        };
      }

      return null;
    });

    await expect(loadNpcWorkspace()).resolves.toEqual({
      summary: "NPC workspace loaded.",
      selectedNpcId: "research-bot",
      items: [
        {
          id: "research-bot",
          name: "研究助手",
          description: "负责资料整理",
          defaultModel: "qwen2.5-coder:7b",
          personaTitle: "资料研究员",
          personaPrompt: "你负责整理资料",
          outputStyle: "简洁",
          agentDraft: "",
          rulesDraft: "",
          enabledSkillNames: ["本地检索增强"],
          knowledgeLibraryIds: ["product-docs"],
          updatedAt: "2026-06-19T10:00:00.000Z"
        }
      ]
    });
  });

  it("loads a single desktop NPC config and normalizes snake_case fields", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};

    mockIPC((cmd, payload) => {
      if (cmd === "workspace_npc_config_read") {
        expect(payload).toEqual({
          npcId: "research-bot"
        });
        return {
          id: "research-bot",
          name: "研究助手",
          description: "负责资料整理",
          default_model: "qwen2.5-coder:7b",
          persona_title: "资料研究员",
          persona_prompt: "你负责整理资料",
          output_style: "简洁",
          agent_draft: "",
          rules_draft: "",
          enabled_skill_names: ["本地检索增强"],
          knowledge_library_ids: ["product-docs"],
          updated_at: "2026-06-19T10:00:00.000Z"
        };
      }

      return null;
    });

    await expect(loadNpcWorkspaceConfig("research-bot")).resolves.toEqual({
      id: "research-bot",
      name: "研究助手",
      description: "负责资料整理",
      defaultModel: "qwen2.5-coder:7b",
      personaTitle: "资料研究员",
      personaPrompt: "你负责整理资料",
      outputStyle: "简洁",
      agentDraft: "",
      rulesDraft: "",
      enabledSkillNames: ["本地检索增强"],
      knowledgeLibraryIds: ["product-docs"],
      updatedAt: "2026-06-19T10:00:00.000Z"
    });
  });

  it("sends camelCase NPC create payload as snake_case over tauri invoke", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};
    let capturedPayload: unknown;

    mockIPC((cmd, payload) => {
      if (cmd === "workspace_npc_config_create") {
        capturedPayload = payload;
        return {
          summary: "NPC created.",
          selected_npc_id: "research-bot",
          items: []
        };
      }

      return null;
    });

    await createNpcWorkspaceConfig({
      id: "research-bot",
      name: "研究助手",
      description: "负责资料整理",
      defaultModel: "qwen2.5-coder:7b",
      personaTitle: "资料研究员",
      personaPrompt: "你负责整理资料",
      outputStyle: "简洁",
      agentDraft: "",
      rulesDraft: "",
      enabledSkillNames: ["本地检索增强"],
      knowledgeLibraryIds: ["product-docs"]
    });

    expect(capturedPayload).toEqual({
      payload: {
        payload: {
          id: "research-bot",
          name: "研究助手",
          description: "负责资料整理",
          default_model: "qwen2.5-coder:7b",
          persona_title: "资料研究员",
          persona_prompt: "你负责整理资料",
          output_style: "简洁",
          agent_draft: "",
          rules_draft: "",
          enabled_skill_names: ["本地检索增强"],
          knowledge_library_ids: ["product-docs"]
        },
        rollbackContext: null
      }
    });
  });

  it("sends camelCase NPC update payload as snake_case over tauri invoke", async () => {
    (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals] = {};
    let capturedPayload: unknown;

    mockIPC((cmd, payload) => {
      if (cmd === "workspace_npc_config_update") {
        capturedPayload = payload;
        return {
          summary: "NPC updated.",
          selected_npc_id: "research-bot",
          items: []
        };
      }

      return null;
    });

    await updateNpcWorkspaceConfig({
      id: "research-bot",
      name: "研究助手",
      description: "负责资料整理",
      defaultModel: "qwen2.5-coder:7b",
      personaTitle: "事实核验官",
      personaPrompt: "你负责整理资料",
      outputStyle: "简洁",
      agentDraft: "",
      rulesDraft: "必须引用来源",
      enabledSkillNames: ["本地检索增强"],
      knowledgeLibraryIds: ["product-docs"]
    });

    expect(capturedPayload).toEqual({
      payload: {
        payload: {
          id: "research-bot",
          name: "研究助手",
          description: "负责资料整理",
          default_model: "qwen2.5-coder:7b",
          persona_title: "事实核验官",
          persona_prompt: "你负责整理资料",
          output_style: "简洁",
          agent_draft: "",
          rules_draft: "必须引用来源",
          enabled_skill_names: ["本地检索增强"],
          knowledge_library_ids: ["product-docs"]
        },
        rollbackContext: null
      }
    });
  });
});
