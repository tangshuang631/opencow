import { describe, expect, it } from "vitest";
import { createInitialWorkbenchState, mergeOllamaOverview } from "./workbenchState";

describe("mergeOllamaOverview no-model diagnostics", () => {
  it("surfaces a repair-friendly diagnostic when Ollama is reachable but no models are installed", () => {
    const state = createInitialWorkbenchState();

    const updated = mergeOllamaOverview(state, {
      reachable: true,
      endpoint: "http://127.0.0.1:11434",
      selectedModel: "",
      diagnostic: "",
      models: []
    });

    expect(updated.model.status).toContain("Ollama");
    expect(updated.model.activeModel).toContain("模");
    expect(updated.model.diagnostic).toContain("No local Ollama models");
  });
});
