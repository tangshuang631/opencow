import { afterEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import {
  getOllamaConnectionLabel,
  loadOllamaOverview,
  type OllamaOverview
} from "./ollamaService";

const tauriInternals = "__TAURI_INTERNALS__" as const;

describe("ollamaService", () => {
  afterEach(() => {
    clearMocks();
    vi.restoreAllMocks();
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown })[tauriInternals];
  });

  it("loads models through the Tauri command when desktop IPC is available", async () => {
    mockIPC((cmd) => {
      if (cmd === "ollama_overview") {
        return {
          reachable: true,
          endpoint: "http://127.0.0.1:11434",
          selectedModel: "qwen2.5-coder:7b",
          diagnostic: "",
          models: [
            { name: "qwen2.5-coder:7b", sizeLabel: "4.1 GB" },
            { name: "bge-m3:latest", sizeLabel: "1.2 GB" }
          ]
        } satisfies OllamaOverview;
      }

      return null;
    });

    const overview = await loadOllamaOverview();

    expect(overview.reachable).toBe(true);
    expect(overview.selectedModel).toBe("qwen2.5-coder:7b");
    expect(overview.models).toHaveLength(2);
  });

  it("falls back to the local HTTP API during browser preview", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: "qwen2.5-coder:7b",
              size: 4_402_345_123
            }
          ]
        })
      })
    );

    const overview = await loadOllamaOverview();

    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:11434/api/tags");
    expect(overview.reachable).toBe(true);
    expect(overview.models[0]).toMatchObject({ name: "qwen2.5-coder:7b" });
  });

  it("returns a repair-friendly diagnostic when Ollama is reachable but no models are installed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: []
        })
      })
    );

    const overview = await loadOllamaOverview();

    expect(overview.reachable).toBe(true);
    expect(overview.models).toHaveLength(0);
    expect(overview.selectedModel).toBe("");
    expect(overview.diagnostic).toContain("No local Ollama models");
  });

  it("returns a repair-friendly offline state when Ollama is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));

    const overview = await loadOllamaOverview();

    expect(overview.reachable).toBe(false);
    expect(overview.models).toHaveLength(0);
    expect(overview.diagnostic).toContain("Ollama");
  });

  it("maps reachability to a short UI label", () => {
    expect(getOllamaConnectionLabel({ reachable: true } as OllamaOverview)).toBe("Ollama 已连接");
    expect(getOllamaConnectionLabel({ reachable: false } as OllamaOverview)).toBe("等待 Ollama");
  });
});
