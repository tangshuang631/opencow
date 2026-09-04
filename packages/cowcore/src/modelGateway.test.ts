import { describe, expect, it, vi } from "vitest";
import { createModelGateway } from "./modelGateway.js";

describe("createModelGateway", () => {
  it("exposes only the official Ollama native provider", () => {
    const fetchMock = vi.fn();
    const gateway = createModelGateway({ endpoint: "http://127.0.0.1:11434", fetch: fetchMock, cloudPolicy: "unverified" });

    expect(gateway.provider).toBe("ollama-native");
    expect(gateway.native).toBe(true);
    expect(gateway.endpoint).toBe("http://127.0.0.1:11434");
  });

  it("rejects non-loopback gateway endpoints before any request", () => {
    expect(() => createModelGateway({ endpoint: "https://cloud.example", fetch: vi.fn() })).toThrow(/loopback/i);
  });
});
