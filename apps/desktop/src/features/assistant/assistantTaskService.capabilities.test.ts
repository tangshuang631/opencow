import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const {
  loadOpenClawCapabilityOverviewMock,
  scanLocalMcpPluginsMock,
  inspectLocalMcpPluginMock,
  previewLocalMcpPluginStartMock,
  startLocalMcpPluginMock
} = vi.hoisted(() => ({
  loadOpenClawCapabilityOverviewMock: vi.fn(),
  scanLocalMcpPluginsMock: vi.fn(),
  inspectLocalMcpPluginMock: vi.fn(),
  previewLocalMcpPluginStartMock: vi.fn(),
  startLocalMcpPluginMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    loadOpenClawCapabilityOverview: loadOpenClawCapabilityOverviewMock,
    scanLocalMcpPlugins: scanLocalMcpPluginsMock,
    inspectLocalMcpPlugin: inspectLocalMcpPluginMock,
    previewLocalMcpPluginStart: previewLocalMcpPluginStartMock,
    startLocalMcpPlugin: startLocalMcpPluginMock
  };
});

describe("assistantTaskService capability catalogs", () => {
  it("plans a capability catalog task for local RAG readiness requests", () => {
    const plan = planAssistantTask("inspect the local rag capability wiring", "readonly");

    expect(plan).toMatchObject({
      kind: "capability-rag-overview",
      title: "OpenClaw RAG capability overview"
    });
  });

  it("executes a capability catalog overview through the desktop service", async () => {
    loadOpenClawCapabilityOverviewMock.mockResolvedValueOnce({
      capability_id: "rag",
      title: "OpenClaw RAG capability overview",
      status: "ready-foundation",
      required_package_count: 3,
      available_package_count: 3,
      available_packages: ["@openclaw/llm-core", "@openclaw/llm-runtime", "@openclaw/model-catalog-core"],
      missing_packages: [],
      summary: "OpenClaw RAG foundation check found 3 of 3 required packages."
    });

    const result = await executeAssistantTask({
      kind: "capability-rag-overview",
      title: "OpenClaw RAG capability overview",
      summary: "Inspect local OpenClaw RAG package foundations before deeper execution wiring.",
      auditSummary: "Local assistant planned an OpenClaw RAG capability overview.",
      auditDetail: "Readonly capability catalog task: rag"
    } as const);

    expect(result.resultTitle).toBe("OpenClaw RAG capability overview");
    expect(result.resultSummary).toContain("3 of 3 required packages");
    expect(result.resultSummary).toContain("@openclaw/llm-runtime");
    expect(result.resultSummary).toContain("ready-foundation");
  });

  it("plans and executes a readonly local MCP plugin scan through the desktop service", async () => {
    const plan = planAssistantTask("scan local mcp plugins and list available model context protocol entries", "readonly");

    expect(plan).toMatchObject({
      kind: "mcp-local-plugin-scan",
      title: "Local MCP plugin scan"
    });

    scanLocalMcpPluginsMock.mockResolvedValueOnce({
      summary: "Local MCP plugin scan found 2 plugin entries across 2 scanned roots.",
      total_count: 2,
      scanned_root_count: 2,
      items: [
        {
          id: "browser",
          path: "vendor/openclaw/extensions/browser/openclaw.plugin.json",
          source: "vendor-openclaw-extension-plugin",
          activation: "startup",
          tool_count: 1,
          skill_count: 1
        },
        {
          id: "codex-supervisor",
          path: "vendor/openclaw/extensions/codex-supervisor/openclaw.plugin.json",
          source: "vendor-openclaw-extension-plugin",
          activation: "manual",
          tool_count: 5,
          skill_count: 0
        }
      ]
    });

    const result = await executeAssistantTask({
      kind: "mcp-local-plugin-scan",
      title: "Local MCP plugin scan",
      summary: "Scan approved local OpenClaw plugin manifests and summarize MCP-adjacent plugin entries.",
      auditSummary: "Local assistant planned a readonly local MCP plugin scan.",
      auditDetail: "Readonly local MCP plugin scan task"
    } as const);

    expect(result.resultTitle).toBe("本地 MCP 插件扫描");
    expect(result.resultSummary).toContain("扫描到 2 个本地 MCP 插件入口，覆盖 2 个扫描根目录");
    expect(result.resultSummary).toContain("browser");
    expect(result.resultSummary).toContain("codex-supervisor");
    expect(result.resultSummary).toContain("激活方式：browser=startup、codex-supervisor=manual");
  });

  it("plans and executes a readonly local MCP plugin detail lookup through the desktop service", async () => {
    const plan = planAssistantTask("show details for the browser mcp plugin", "readonly");

    expect(plan).toMatchObject({
      kind: "mcp-local-plugin-inspect",
      title: "Local MCP plugin detail"
    });

    inspectLocalMcpPluginMock.mockResolvedValueOnce({
      query: "show details for the browser mcp plugin",
      summary: "Local MCP plugin detail lookup found 1 matching plugin across 2 scanned roots.",
      match_count: 1,
      scanned_root_count: 2,
      items: [
        {
          id: "browser",
          path: "vendor/openclaw/extensions/browser/openclaw.plugin.json",
          source: "vendor-openclaw-extension-plugin",
          activation: "startup",
          tool_count: 1,
          skill_count: 1,
          description: "Browser automation plugin entry.",
          tool_names: ["browser"],
          skill_paths: ["./skills"]
        }
      ]
    });

    const result = await executeAssistantTask({
      kind: "mcp-local-plugin-inspect",
      title: "Local MCP plugin detail",
      summary: "show details for the browser mcp plugin",
      auditSummary: "Local assistant planned a readonly local MCP plugin detail lookup.",
      auditDetail: "Readonly local MCP plugin detail task"
    } as const);

    expect(result.resultTitle).toBe("本地 MCP 插件详情");
    expect(result.resultSummary).toContain("找到 1 个匹配 MCP 插件，覆盖 2 个扫描根目录");
    expect(result.resultSummary).toContain("browser");
    expect(result.resultSummary).toContain("激活方式：startup");
    expect(result.resultSummary).toContain("工具：browser");
    expect(result.resultSummary).toContain("Skills 路径：./skills");
  });

  it("plans and executes a readonly local MCP plugin startup preview through the desktop service", async () => {
    const plan = planAssistantTask("preview starting the browser mcp plugin locally", "readonly");

    expect(plan).toMatchObject({
      kind: "mcp-local-plugin-start-preview",
      title: "Local MCP plugin start preview"
    });

    previewLocalMcpPluginStartMock.mockResolvedValueOnce({
      query: "preview starting the browser mcp plugin locally",
      summary: "Local MCP plugin start preview found 1 matching plugin across 2 scanned roots.",
      match_count: 1,
      scanned_root_count: 2,
      items: [
        {
          id: "browser",
          path: "vendor/openclaw/extensions/browser/openclaw.plugin.json",
          source: "vendor-openclaw-extension-plugin",
          activation: "startup",
          startup_allowed: false,
          command_preview: "No resolved executable launcher for this local MCP plugin in the current desktop slice.",
          working_directory: "vendor/openclaw/extensions/browser",
          risk_summary:
            "Preview only. The current desktop slice can inspect this plugin manifest, but it does not yet resolve or launch a real local MCP plugin process.",
          requires_config: false,
          config_hint: "No required config schema fields were detected."
        }
      ]
    });

    const result = await executeAssistantTask({
      kind: "mcp-local-plugin-start-preview",
      title: "Local MCP plugin start preview",
      summary: "preview starting the browser mcp plugin locally",
      auditSummary: "Local assistant planned a readonly local MCP plugin start preview.",
      auditDetail: "Readonly local MCP plugin start preview task"
    } as const);

    expect(result.resultTitle).toBe("本地 MCP 插件启动预览");
    expect(result.resultSummary).toContain("找到 1 个可预览 MCP 插件，覆盖 2 个扫描根目录");
    expect(result.resultSummary).toContain("browser");
    expect(result.resultSummary).toContain("允许启动：否");
    expect(result.resultSummary).toContain("No resolved executable launcher");
    expect(result.resultSummary).toContain("激活方式：startup");
    expect(result.resultSummary).toContain("Preview only");
    expect(result.resultSummary).toContain("配置提示：No required config schema fields were detected");
  });

  it("executes a real local MCP plugin start task through the desktop service", async () => {
    startLocalMcpPluginMock.mockResolvedValueOnce({
      plugin_id: "browser",
      command_label: "No resolved executable launcher",
      working_directory: "vendor/openclaw/extensions/browser",
      stdout_preview:
        "Execution blocked: the browser MCP plugin manifest exists, but this desktop slice does not yet know how to launch a real plugin host for it.",
      line_count: 0,
      summary:
        "Local MCP plugin start was not executed. The browser plugin is present, but no verified executable launcher has been implemented for it yet."
    });

    const result = await executeAssistantTask({
      kind: "mcp-local-plugin-start",
      title: "Local MCP plugin start",
      summary: "start the browser mcp plugin locally",
      auditSummary: "Local assistant planned a controlled local MCP plugin start task.",
      auditDetail: "Controlled local MCP plugin start task"
    } as const);

    expect(result.resultTitle).toBe("本地 MCP 插件启动结果");
    expect(result.resultSummary).toContain("browser");
    expect(result.resultSummary).toContain("命令：No resolved executable launcher");
    expect(result.resultSummary).toContain("工作目录：vendor/openclaw/extensions/browser");
    expect(result.resultSummary).toContain("No resolved executable launcher");
    expect(result.resultSummary).toContain("执行预览：Execution blocked");
  });
});
