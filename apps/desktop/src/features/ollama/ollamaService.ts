import { invoke } from "@tauri-apps/api/core";

const ollamaEndpoint = "http://127.0.0.1:11434";
const ollamaTagsPath = `${ollamaEndpoint}/api/tags`;

export type OllamaModelSummary = {
  name: string;
  sizeLabel: string;
};

export type OllamaOverview = {
  reachable: boolean;
  endpoint: string;
  selectedModel: string;
  diagnostic: string;
  models: OllamaModelSummary[];
};

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
    size?: number;
  }>;
};

export async function loadOllamaOverview(): Promise<OllamaOverview> {
  if (hasTauriInvoke()) {
    return invoke<OllamaOverview>("ollama_overview");
  }

  return loadFromBrowserPreview();
}

export function getOllamaConnectionLabel(overview: OllamaOverview): string {
  return overview.reachable ? "Ollama 已连接" : "等待 Ollama";
}

async function loadFromBrowserPreview(): Promise<OllamaOverview> {
  try {
    const response = await fetch(ollamaTagsPath);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as OllamaTagsResponse;
    const models = normalizeModels(payload);
    const diagnostic =
      models.length === 0
        ? "No local Ollama models were found. Pull a model before starting chat."
        : "";

    return {
      reachable: true,
      endpoint: ollamaEndpoint,
      selectedModel: models[0]?.name ?? "",
      diagnostic,
      models
    };
  } catch {
    return {
      reachable: false,
      endpoint: ollamaEndpoint,
      selectedModel: "",
      diagnostic: "Ollama 未启动，请确认本地服务已运行。",
      models: []
    };
  }
}

function hasTauriInvoke(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function normalizeModels(payload: OllamaTagsResponse): OllamaModelSummary[] {
  return (payload.models ?? [])
    .filter((model): model is { name: string; size?: number } => typeof model.name === "string" && model.name.length > 0)
    .map((model) => ({
      name: model.name,
      sizeLabel: formatModelSize(model.size ?? 0)
    }));
}

function formatModelSize(size: number): string {
  if (size <= 0) {
    return "未知大小";
  }

  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
