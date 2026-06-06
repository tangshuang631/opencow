import { describe, expect, it } from "vitest";
import { createAuditEvent } from "./index.js";

describe("createAuditEvent", () => {
  it("creates a normalized audit event with injected timestamp", () => {
    const event = createAuditEvent(
      {
        module: "shell-runtime",
        source: "command_policy",
        summary: "高风险命令等待确认",
        detail: "命令需二次确认后执行: Remove-Item .\\temp-output -Recurse"
      },
      { now: () => "2026-06-06T01:15:00.000Z" }
    );

    expect(event).toEqual({
      module: "shell-runtime",
      source: "command_policy",
      summary: "高风险命令等待确认",
      detail: "命令需二次确认后执行: Remove-Item .\\temp-output -Recurse",
      timestamp: "2026-06-06T01:15:00.000Z"
    });
  });
});
