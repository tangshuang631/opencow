import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const {
  loadOllamaOverviewMock,
  loadWorkspaceOverviewMock,
  loadWorkspaceConfigOverviewMock,
  searchLocalKnowledgeMock,
  repairOpencowEnabledSkillsRegistryMock
} = vi.hoisted(() => ({
  loadOllamaOverviewMock: vi.fn(),
  loadWorkspaceOverviewMock: vi.fn(),
  loadWorkspaceConfigOverviewMock: vi.fn(),
  searchLocalKnowledgeMock: vi.fn(),
  repairOpencowEnabledSkillsRegistryMock: vi.fn()
}));

vi.mock("../features/ollama/ollamaService", () => ({
  loadOllamaOverview: loadOllamaOverviewMock
}));

vi.mock("../features/assistant/localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("../features/assistant/localAssistantService")>(
    "../features/assistant/localAssistantService"
  );

  return {
    ...actual,
    loadWorkspaceOverview: loadWorkspaceOverviewMock,
    loadWorkspaceConfigOverview: loadWorkspaceConfigOverviewMock,
    searchLocalKnowledge: searchLocalKnowledgeMock,
    repairOpencowEnabledSkillsRegistry: repairOpencowEnabledSkillsRegistryMock
  };
});

describe("App self-repair mutation continuation", () => {
  it("continues from self-repair preview into permission approval and final registry repair output", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadWorkspaceOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      entry_count: 7,
      package_count: 3,
      package_names: ["openclaw-adapter", "permission-engine", "shell-runtime"],
      summary: "Workspace opencow currently contains 7 root entries and 3 local packages."
    });
    loadWorkspaceConfigOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      config_files: ["package.json", "apps/desktop/package.json", "apps/desktop/src-tauri/Cargo.toml"],
      root_script_names: ["dev", "desktop:dev", "verify:all"],
      root_script_count: 3,
      package_manager_files: ["package-lock.json"],
      summary: "Workspace config inspection found 3 key config files and 3 root scripts."
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "diagnose opencow and preview repairing its enabled skills registry",
      summary: "Local knowledge search found 2 matching passages across 7 indexed documents.",
      match_count: 2,
      indexed_document_count: 7,
      items: [
        {
          path: "OPENCOW_CORE_RULES.md",
          title: "OPENCOW_CORE_RULES.md",
          snippet: "When opencow itself fails, the assistant should prefer a staged self-repair flow.",
          score: 42
        },
        {
          path: "docs/v1.0/06-rag-skills-npc-mcp.md",
          title: "06-rag-skills-npc-mcp.md",
          snippet: "Every self-repair mutation must remain audit-visible and rollback-visible.",
          score: 38
        }
      ]
    });
    repairOpencowEnabledSkillsRegistryMock.mockResolvedValueOnce({
      query: "diagnose opencow and continue repairing its enabled skills registry",
      repair_target: "enabled-skills-registry",
      repaired_path: ".opencow/skills/enabled-skills.json",
      status: "repaired",
      preserved_entry_count: 0,
      verified_version: 1,
      verified_entry_count: 0,
      summary: "Opencow self-repair restored the enabled skills registry to a verified default schema."
    });

    const { container } = render(<App />);

    await screen.findAllByText("qwen2.5-coder:7b");

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "diagnose opencow and preview repairing its enabled skills registry" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getAllByText(/Opencow self-repair preview|Readonly self-repair preview/i).length).toBeGreaterThan(0);
    });

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "continue" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    expect(
      screen.getAllByText(
        /Workspace write permission is required before opencow can repair its workspace-local enabled skills registry\./i
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /This repair rewrites only \.opencow\/skills\/enabled-skills\.json through a narrow self-repair path and must remain audit-visible and rollback-visible\./i
      ).length
    ).toBeGreaterThan(0);

    const approvePermissionButton = await screen.findByRole("button", { name: /批准提权/i });
    fireEvent.click(approvePermissionButton as HTMLButtonElement);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          /Repair opencow enabled skills registry|enabled-skills\.json|verified default schema|Verified schema version: 1|Verified enabled entries: 0/i
        ).length
      ).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/Repair opencow enabled skills registry/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Local assistant planned an opencow enabled skills registry self-repair\./i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Opencow self-repair task: enabled skills registry \| request=diagnose opencow and continue repairing its enabled skills registry/i
      )
    ).toBeInTheDocument();
  });
});

describe("App self-repair preview flow", () => {
  it("shows a readonly opencow self-repair preview through the conversation flow", async () => {
    loadOllamaOverviewMock.mockResolvedValue({
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "qwen2.5-coder:7b",
      diagnostic: "",
      models: [{ name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" }]
    });
    loadWorkspaceOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      entry_count: 7,
      package_count: 3,
      package_names: ["openclaw-adapter", "permission-engine", "shell-runtime"],
      summary: "Workspace opencow currently contains 7 root entries and 3 local packages."
    });
    loadWorkspaceConfigOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      config_files: ["package.json", "apps/desktop/package.json", "apps/desktop/src-tauri/Cargo.toml"],
      root_script_names: ["dev", "desktop:dev", "verify:all"],
      root_script_count: 3,
      package_manager_files: ["package-lock.json"],
      summary: "Workspace config inspection found 3 key config files and 3 root scripts."
    });
    searchLocalKnowledgeMock.mockResolvedValueOnce({
      query: "diagnose opencow and preview how to fix its current local error",
      summary: "Local knowledge search found 2 matching passages across 7 indexed documents.",
      match_count: 2,
      indexed_document_count: 7,
      items: [
        {
          path: "OPENCOW_CORE_RULES.md",
          title: "OPENCOW_CORE_RULES.md",
          snippet: "When opencow itself fails, the assistant should prefer a staged self-repair flow.",
          score: 42
        },
        {
          path: "docs/v1.0/04-permission-safety-shell.md",
          title: "04-permission-safety-shell.md",
          snippet: "Writable shell actions must continue to flow through the permission and audit chain.",
          score: 28
        }
      ]
    });

    const { container } = render(<App />);

    await screen.findAllByText("qwen2.5-coder:7b");

    const composerInput = container.querySelector("textarea");
    const sendButton = container.querySelector("button.send-button");

    expect(composerInput).not.toBeNull();
    expect(sendButton).not.toBeNull();

    fireEvent.change(composerInput as HTMLTextAreaElement, {
      target: { value: "diagnose opencow and preview how to fix its current local error" }
    });
    fireEvent.click(sendButton as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getAllByText(/Opencow self-repair preview|Readonly self-repair preview/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/package\.json|desktop:dev|OPENCOW_CORE_RULES\.md/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/本地任务执行失败/i)).not.toBeInTheDocument();
  });
});
