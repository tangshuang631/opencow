import { describe, expect, it } from "vitest";
import { chooseKeepAlive } from "./residencyController.js";

describe("chooseKeepAlive", () => {
  it("keeps the interactive chat model warm on healthy standard-memory devices", () => {
    expect(chooseKeepAlive({ role: "chat", memoryClass: "standard", memoryPressure: "low", frequent: true })).toBe("10m");
  });

  it("shortens or releases residency under pressure and never co-resides embedding by default", () => {
    expect(chooseKeepAlive({ role: "chat", memoryClass: "low", memoryPressure: "high", frequent: true })).toBe("1m");
    expect(chooseKeepAlive({ role: "embedding", memoryClass: "standard", memoryPressure: "low", frequent: false })).toBe("0");
  });
});
