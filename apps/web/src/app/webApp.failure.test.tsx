import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebApp } from "./WebApp";

const { scanLocalSkillsMock, listEnabledLocalSkillsMock, scanLocalMcpPluginsMock } = vi.hoisted(() => ({
  scanLocalSkillsMock: vi.fn(),
  listEnabledLocalSkillsMock: vi.fn(),
  scanLocalMcpPluginsMock: vi.fn()
}));

vi.mock("../../../desktop/src/features/assistant/localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("../../../desktop/src/features/assistant/localAssistantService")>(
    "../../../desktop/src/features/assistant/localAssistantService"
  );

  return {
    ...actual,
    scanLocalSkills: scanLocalSkillsMock,
    listEnabledLocalSkills: listEnabledLocalSkillsMock,
    scanLocalMcpPlugins: scanLocalMcpPluginsMock
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
    scanLocalSkillsMock.mockReset();
    listEnabledLocalSkillsMock.mockReset();
    scanLocalMcpPluginsMock.mockReset();
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
      expect(within(conversation).getByText("本地 Skills 扫描失败")).toBeInTheDocument();
      expect(within(conversation).getByText(/scan bridge unavailable/)).toBeInTheDocument();
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
      expect(within(conversation).getByText("已启用本地 Skills 读取失败")).toBeInTheDocument();
      expect(within(conversation).getByText(/enabled registry missing/)).toBeInTheDocument();
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
      expect(within(conversation).getByText("本地 MCP 插件扫描失败")).toBeInTheDocument();
      expect(within(conversation).getByText(/mcp scan bridge unavailable/)).toBeInTheDocument();
    });
  });
});
