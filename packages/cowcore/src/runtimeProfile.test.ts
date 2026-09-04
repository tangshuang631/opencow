import { describe, expect, it } from "vitest";
import { createRuntimeProfile } from "./runtimeProfile.js";

describe("createRuntimeProfile", () => {
  it("records native API compatibility and local cloud policy without attestation claims", () => {
    const profile = createRuntimeProfile({
      endpoint: "http://127.0.0.1:11434",
      ollamaVersion: "0.33.2",
      operatingSystem: "macos",
      hardwareArch: "arm64",
      physicalMemoryBytes: 24 * 1024 ** 3,
      availableMemoryBytes: 18 * 1024 ** 3,
      memoryPressure: "low",
      cloudFeatures: "disabled",
      nativeApiCompatibility: { chat: true, streaming: true, show: true, ps: true, embed: true, cancellation: true }
    });

    expect(profile.endpointClass).toBe("loopback");
    expect(profile.cloudFeatures).toBe("disabled");
    expect(profile.nativeApiCompatibility.embed).toBe(true);
  });
});
