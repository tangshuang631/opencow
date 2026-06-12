import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const { loadOllamaOverviewMock } = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn()
}));

vi.mock("../features/ollama/ollamaService", () => ({
  loadOllamaOverview: loadOllamaOverviewMock
}));

const INSPECTOR_PANEL_NAME = "\u53f3\u4fa7\u9762\u677f";
const PERMISSION_HEADING_NAME = "\u6743\u9650\u786e\u8ba4";
const APPROVE_PERMISSION_NAME = "\u6279\u51c6\u63d0\u6743";
const APPROVE_DANGER_NAME = "\u6279\u51c6\u9ad8\u98ce\u9669\u64cd\u4f5c";
const SELECTED_LOCAL_MODEL_NAME = "\u9009\u62e9\u6a21\u578b\uff1aqwen2.5-coder:7b";

async function waitForSelectedLocalModel() {
  await screen.findByRole("button", { name: SELECTED_LOCAL_MODEL_NAME });
}

describe("App MCP start flow", () => {
  it("runs the controlled MCP browser plugin start chain through permission and dangerous confirmation", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });

    const { container } = render(<App />);

    await waitForSelectedLocalModel();

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "start the browser mcp plugin locally" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    const inspectorPanel = await screen.findByRole("complementary", { name: INSPECTOR_PANEL_NAME });
    const permissionSection = within(inspectorPanel).getByRole("heading", { name: PERMISSION_HEADING_NAME }).closest("section");

    expect(permissionSection).not.toBeNull();
    expect(within(permissionSection as HTMLElement).getByText(/controlled-full/i)).toBeInTheDocument();

    const approvePermissionButton = await within(permissionSection as HTMLElement).findByRole("button", {
      name: APPROVE_PERMISSION_NAME
    });
    fireEvent.click(approvePermissionButton);

    const approveDangerButton = await within(permissionSection as HTMLElement).findByRole("button", {
      name: APPROVE_DANGER_NAME
    });
    expect(screen.queryByText(/no verified executable launcher has been implemented/i)).not.toBeInTheDocument();

    fireEvent.click(approveDangerButton);

    await waitFor(() => {
      expect(
        screen.getAllByText(/Local MCP plugin start|No resolved executable launcher|not executed/i).length
      ).toBeGreaterThan(0);
    });
  });
});
