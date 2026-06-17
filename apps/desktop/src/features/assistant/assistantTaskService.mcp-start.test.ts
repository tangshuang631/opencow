import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const { startLocalMcpPluginMock } = vi.hoisted(() => ({
  startLocalMcpPluginMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    startLocalMcpPlugin: startLocalMcpPluginMock
  };
});

describe("assistantTaskService MCP controlled start", () => {
  it("requests controlled-full before starting a local MCP plugin", () => {
    const plan = planAssistantTask("start the browser mcp plugin locally", "readonly");

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "controlled-full",
      queuedExecutionKind: "mcp-local-plugin-start"
    });
  });

  it("surfaces MCP default-off and permission-engine safety boundaries in the start result", async () => {
    startLocalMcpPluginMock.mockResolvedValueOnce({
      plugin_id: "browser",
      command_label: "No resolved executable launcher",
      working_directory: "vendor/openclaw/extensions/browser",
      stdout_preview:
        "Execution blocked: the browser MCP plugin manifest exists, but this desktop slice does not yet know how to launch a real plugin host for it.",
      line_count: 0,
      summary:
        "Browser preview mode did not execute a local MCP plugin start because no verified executable launcher has been implemented for it yet."
    });

    const result = await executeAssistantTask({
      kind: "mcp-local-plugin-start",
      title: "Local MCP plugin start",
      summary: "start the browser mcp plugin locally",
      auditSummary: "Local assistant planned a controlled local MCP plugin start.",
      auditDetail: "Controlled-full local MCP plugin start task"
    } as const);

    expect(result.resultTitle).toBe("本地 MCP 插件启动结果");
    expect(result.resultSummary).toContain("MCP 默认关闭");
    expect(result.resultSummary).toContain("启动必须由用户手动确认");
    expect(result.resultSummary).toContain("所需权限：controlled-full");
    expect(result.resultSummary).toContain("工具调用仍需经过 permission-engine");
    expect(result.resultSummary).toContain("启动、失败和工具列表变化都会写入日志");
  });
});
