import { describe, expect, it } from "vitest";
import { observeLocalOnlyPolicy } from "./localOnlyPolicy.js";

describe("observeLocalOnlyPolicy", () => {
  it("confirms managed Ollama only when OLLAMA_NO_CLOUD is explicitly enabled", () => {
    expect(observeLocalOnlyPolicy({ mode: "managed", noCloudEnv: "1" })).toEqual({
      mode: "managed",
      cloudPolicy: "disabled-confirmed",
      evidence: ["mode=managed", "OLLAMA_NO_CLOUD=enabled"]
    });
    expect(observeLocalOnlyPolicy({ mode: "managed", noCloudEnv: "true" }).cloudPolicy).toBe("disabled-confirmed");
  });

  it("fails closed for an external or managed runtime with unknown cloud configuration", () => {
    expect(observeLocalOnlyPolicy({ mode: "managed" })).toMatchObject({
      mode: "managed",
      cloudPolicy: "unverified"
    });
    expect(observeLocalOnlyPolicy({ mode: "external", egressPolicy: "unknown", noCloudEnv: "0" })).toMatchObject({
      mode: "external",
      cloudPolicy: "unverified"
    });
  });

  it("accepts a verified egress block without claiming a config-based attestation", () => {
    expect(observeLocalOnlyPolicy({ mode: "external", egressPolicy: "blocked-confirmed" })).toEqual({
      mode: "external",
      cloudPolicy: "egress-blocked-confirmed",
      evidence: ["mode=external", "egress=blocked-confirmed"]
    });
  });
});
