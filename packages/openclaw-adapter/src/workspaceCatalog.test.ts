import { describe, expect, it } from "vitest";
import { listOpenClawWorkspacePackages } from "./index.js";

describe("openclaw workspace catalog", () => {
  it("lists vendored workspace packages without importing upstream runtime code", () => {
    const packages = listOpenClawWorkspacePackages();

    expect(packages.length).toBeGreaterThan(10);
    expect(packages[0]?.directoryName).toBe("acp-core");
    expect(packages.at(-1)?.directoryName).toBe("workboard-contract");
  });

  it("includes package metadata needed for adapter planning", () => {
    const packages = listOpenClawWorkspacePackages();
    const llmCore = packages.find((entry) => entry.directoryName === "llm-core");
    const terminalCore = packages.find((entry) => entry.directoryName === "terminal-core");
    const ai = packages.find((entry) => entry.directoryName === "ai");

    expect(llmCore).toMatchObject({
      directoryName: "llm-core",
      packageName: "@openclaw/llm-core",
      version: "0.0.0-private",
      private: true
    });
    expect(terminalCore).toMatchObject({
      directoryName: "terminal-core",
      packageName: "@openclaw/terminal-core",
      version: "0.0.0-private",
      private: true
    });
    expect(ai).toMatchObject({
      directoryName: "ai",
      packageName: "@openclaw/ai",
      version: "2026.8.2",
      private: false
    });
  });
});
