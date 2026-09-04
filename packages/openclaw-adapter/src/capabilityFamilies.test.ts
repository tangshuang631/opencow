import { describe, expect, it } from "vitest";
import { inspectOpenClawCapabilityFamilies, inspectOpenClawCapabilityFamily } from "./capabilityFamilies.js";

describe("openclaw capability families", () => {
  it("summarizes readiness for each core capability family", () => {
    const families = inspectOpenClawCapabilityFamilies();

    expect(families).toEqual([
      expect.objectContaining({
        capabilityId: "rag",
        title: "RAG",
        status: "ready-foundation",
        requiredPackageCount: 2,
        availablePackageCount: 2
      }),
      expect.objectContaining({
        capabilityId: "skills",
        title: "Skills",
        status: "ready-foundation",
        requiredPackageCount: 2,
        availablePackageCount: 2
      }),
      expect.objectContaining({
        capabilityId: "npc",
        title: "NPC",
        status: "ready-foundation",
        requiredPackageCount: 2,
        availablePackageCount: 2
      }),
      expect.objectContaining({
        capabilityId: "mcp",
        title: "MCP",
        status: "ready-foundation",
        requiredPackageCount: 3,
        availablePackageCount: 3
      })
    ]);
  });

  it("returns a single capability family readiness record by id", () => {
    const family = inspectOpenClawCapabilityFamily("skills");

    expect(family).toMatchObject({
      capabilityId: "skills",
      title: "Skills",
      status: "ready-foundation",
      requiredPackageCount: 2,
      availablePackageCount: 2
    });
  });
});
