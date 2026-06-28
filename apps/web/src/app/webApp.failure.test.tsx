import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebApp } from "./WebApp";

const { scanLocalSkillsMock, listEnabledLocalSkillsMock, scanLocalMcpPluginsMock, loadOpenClawCapabilityOverviewMock } = vi.hoisted(() => ({
  scanLocalSkillsMock: vi.fn(),
  listEnabledLocalSkillsMock: vi.fn(),
  scanLocalMcpPluginsMock: vi.fn(),
  loadOpenClawCapabilityOverviewMock: vi.fn()
}));
const { loadOllamaOverviewMock } = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn()
}));

vi.mock("../../../desktop/src/features/assistant/localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("../../../desktop/src/features/assistant/localAssistantService")>(
    "../../../desktop/src/features/assistant/localAssistantService"
  );

  return {
    ...actual,
    scanLocalSkills: scanLocalSkillsMock,
    listEnabledLocalSkills: listEnabledLocalSkillsMock,
    scanLocalMcpPlugins: scanLocalMcpPluginsMock,
    loadOpenClawCapabilityOverview: loadOpenClawCapabilityOverviewMock
  };
});

vi.mock("../../../desktop/src/features/ollama/ollamaService", async () => {
  const actual = await vi.importActual<typeof import("../../../desktop/src/features/ollama/ollamaService")>(
    "../../../desktop/src/features/ollama/ollamaService"
  );

  return {
    ...actual,
    loadOllamaOverview: loadOllamaOverviewMock
  };
});

function getComposerInput() {
  return screen.getByLabelText("输入任务");
}

function getComposerSendButton() {
  return screen.getByRole("button", { name: "发送" });
}

describe("WebApp failure handling", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    scanLocalSkillsMock.mockReset();
    listEnabledLocalSkillsMock.mockReset();
    scanLocalMcpPluginsMock.mockReset();
    loadOpenClawCapabilityOverviewMock.mockReset();
    loadOllamaOverviewMock.mockReset();
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [
        { name: "gemma4:12b", sizeLabel: "7.2 GB" },
        { name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" },
        { name: "gemma4:e4b", sizeLabel: "3.2 GB" },
        { name: "qwen3.5:9b", sizeLabel: "6.6 GB" }
      ]
    });
    loadOpenClawCapabilityOverviewMock.mockResolvedValue({
      capability_id: "skills",
      title: "Skills",
      status: "partial-foundation",
      required_package_count: 2,
      available_package_count: 1,
      available_packages: ["@openclaw/plugin-sdk"],
      missing_packages: ["workspace skill runtime bridge"],
      summary: "default mock capability overview"
    });
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("reports a readable failure when local skill scanning rejects", async () => {
    scanLocalSkillsMock.mockRejectedValueOnce(new Error("scan bridge unavailable"));

    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "scan local skills for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(scanLocalSkillsMock).toHaveBeenCalledTimes(1);
      expect(conversation.textContent ?? "").toContain("本地 Skills 扫描失败");
      expect(conversation.textContent ?? "").toContain("scan bridge unavailable");
    });
  });

  it("reports a readable failure when enabled local skills listing rejects", async () => {
    listEnabledLocalSkillsMock.mockRejectedValueOnce(new Error("enabled registry missing"));

    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "show enabled skills for this workspace" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(listEnabledLocalSkillsMock).toHaveBeenCalledTimes(1);
      expect(conversation.textContent ?? "").toContain("已启用本地 Skills 读取失败");
      expect(conversation.textContent ?? "").toContain("enabled registry missing");
    });
  });

  it("reports a readable failure when local mcp plugin scanning rejects", async () => {
    scanLocalMcpPluginsMock.mockRejectedValueOnce(new Error("mcp scan bridge unavailable"));

    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "scan local mcp plugins and list available model context protocol entries" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(scanLocalMcpPluginsMock).toHaveBeenCalledTimes(1);
      expect(conversation.textContent ?? "").toContain("本地 MCP 插件扫描失败");
      expect(conversation.textContent ?? "").toContain("mcp scan bridge unavailable");
    });
  });

  it("reports a readable failure when openclaw capability overview loading rejects", async () => {
    loadOpenClawCapabilityOverviewMock.mockRejectedValueOnce(new Error("openclaw capability bridge unavailable"));

    render(<WebApp />);

    fireEvent.change(getComposerInput(), {
      target: { value: "show skills capability overview" }
    });
    fireEvent.click(getComposerSendButton());

    const conversation = screen.getByRole("region", { name: "会话" });
    await waitFor(() => {
      expect(loadOpenClawCapabilityOverviewMock).toHaveBeenCalledWith("skills");
      expect(conversation.textContent ?? "").toContain("SKILLS 能力概览读取失败");
      expect(conversation.textContent ?? "").toContain("openclaw capability bridge unavailable");
    });
  });
});
