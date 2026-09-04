import { describe, expect, it } from "vitest";
import {
  inspectOpenClawCapabilities,
  readOpenClawMetadata,
  resolveOpenClawRoot
} from "./index.js";

describe("openclaw adapter upstream boundary", () => {
  it("locates the vendored OpenClaw root without importing upstream code", () => {
    const root = resolveOpenClawRoot();

    expect(root.replaceAll("\\", "/")).toMatch(/vendor\/openclaw$/);
  });

  it("reads OpenClaw package metadata needed for audit and licensing", () => {
    const metadata = readOpenClawMetadata();

    expect(metadata.name).toBe("openclaw");
    expect(metadata.license).toBe("MIT");
    expect(metadata.version).toMatch(/^\d{4}\.\d+\.\d+$/);
    expect(metadata.repositoryUrl).toContain("github.com/openclaw/openclaw");
  });

  it("reports expected upstream capability packages for later controlled adapters", () => {
    const capabilities = inspectOpenClawCapabilities();

    expect(capabilities).toMatchObject({
      llmCore: { available: true, packageName: "@openclaw/llm-core" },
      llmRuntime: {
        available: false,
        packageName: "@openclaw/llm-runtime",
        compatibility: "relocated-or-removed",
        replacementPackageNames: ["@openclaw/llm-core"]
      },
      modelCatalog: { available: true, packageName: "@openclaw/model-catalog-core" },
      pluginSdk: { available: true, packageName: "@openclaw/plugin-sdk" },
      terminalCore: { available: true, packageName: "@openclaw/terminal-core" },
      toolCallRepair: { available: true, packageName: "@openclaw/tool-call-repair" }
    });
  });
});
