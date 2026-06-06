import { describe, expect, it } from "vitest";
import { listOpenClawWorkspacePackages } from "./index.js";

describe("openclaw workspace catalog", () => {
  it("lists vendored workspace packages without importing upstream runtime code", () => {
    const packages = listOpenClawWorkspacePackages();

    expect(packages.length).toBeGreaterThan(10);
    expect(packages[0]?.directoryName).toBe("acp-core");
    expect(packages.at(-1)?.directoryName).toBe("web-content-core");
  });

  it("includes package metadata needed for adapter planning", () => {
    const packages = listOpenClawWorkspacePackages();
    const llmRuntime = packages.find((entry) => entry.directoryName === "llm-runtime");
    const terminalCore = packages.find((entry) => entry.directoryName === "terminal-core");

    expect(llmRuntime).toMatchObject({
      directoryName: "llm-runtime",
      packageName: "@openclaw/llm-runtime",
      version: "0.0.0-private",
      private: true
    });
    expect(terminalCore).toMatchObject({
      directoryName: "terminal-core",
      packageName: "@openclaw/terminal-core",
      version: "0.0.0-private",
      private: true
    });
  });
});
