import { describe, expect, it } from "vitest";
import { serializeStablePrefix } from "./prefixSerializer.js";

describe("serializeStablePrefix", () => {
  it("keeps canonical capability order and excludes volatile suffix data", () => {
    const first = serializeStablePrefix({
      securityContractVersion: "v1",
      systemContract: { language: "zh-CN", safety: "local-only" },
      capabilities: [
        { capabilityId: "workspace.git.status", schema: { type: "object" } },
        { capabilityId: "diagnostic.read", schema: { type: "object" } }
      ],
      taskMode: "direct-chat"
    });
    const second = serializeStablePrefix({
      securityContractVersion: "v1",
      systemContract: { safety: "local-only", language: "zh-CN" },
      capabilities: [
        { capabilityId: "diagnostic.read", schema: { type: "object" } },
        { capabilityId: "workspace.git.status", schema: { type: "object" } }
      ],
      taskMode: "direct-chat",
      volatile: { requestId: "different", now: "later" }
    });

    expect(first.digest).toBe(second.digest);
    expect(first.text).toContain("diagnostic.read");
    expect(first.text.indexOf("diagnostic.read")).toBeLessThan(first.text.indexOf("workspace.git.status"));
  });
});
