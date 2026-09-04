import { describe, expect, it, vi } from "vitest";
import { loadOllamaNativeProfile } from "./ollamaNativeProfile";

describe("loadOllamaNativeProfile", () => {
  it("returns runtime, model and locality evidence from the native profile path", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      calls.push(path);
      if (path === "/api/version") return json({ version: "0.33.2" });
      if (path === "/api/tags") return json({ models: [{ name: "chat:latest", digest: "sha256:chat", size: 100, details: { format: "gguf", family: "qwen3", capabilities: ["completion"] } }] });
      if (path === "/api/show") return json({ digest: "sha256:chat", capabilities: ["completion"], details: { family: "qwen3" }, model_info: { "qwen3.context_length": 32768 } });
      if (path === "/api/ps") return json({ models: [] });
      throw new Error(`unexpected path ${path}`);
    });

    const result = await loadOllamaNativeProfile({
      model: "chat:latest",
      cloudPolicy: "disabled-confirmed",
      fetch: fetchMock,
      runtime: {
        operatingSystem: "macos",
        hardwareArch: "arm64",
        physicalMemoryBytes: 24 * 1024 ** 3,
        availableMemoryBytes: 18 * 1024 ** 3,
        memoryPressure: "low"
      }
    });

    expect(calls).toEqual(["/api/version", "/api/tags", "/api/show", "/api/ps", "/api/version"]);
    expect(result.model.modelDigest).toBe("sha256:chat");
    expect(result.runtime.hardwareClass).toBe("apple-silicon");
    expect(result.locality.state).toBe("enforced");
  });
});

function json(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
}
