import { describe, expect, it } from "vitest";
import { runReActLoop } from "./reactLoop.js";

describe("runReActLoop", () => {
  it("observes, validates, and retries a rejected answer within a bound", async () => {
    const attempts: string[] = [];
    const result = await runReActLoop({
      maxIterations: 3,
      act: async ({ iteration, feedback }) => {
        attempts.push(`${iteration}:${feedback ?? "initial"}`);
        return iteration === 1 ? "bad answer" : "good answer";
      },
      observe: (value) => `observed ${value}`,
      validate: (_value, observation) => observation.iteration === 1
        ? { ok: false, reason: "contract-mismatch", feedback: "Return only the final answer." }
        : { ok: true }
    });

    expect(result.status).toBe("completed");
    if (result.status === "completed") expect(result.value).toBe("good answer");
    expect(attempts).toEqual(["1:initial", "2:Return only the final answer."]);
    expect(result.observations).toHaveLength(2);
  });

  it("fails closed when validation never succeeds", async () => {
    const result = await runReActLoop({
      maxIterations: 2,
      act: async () => "still invalid",
      observe: (value) => value,
      validate: () => ({ ok: false, reason: "invalid" })
    });

    expect(result.status).toBe("blocked");
    if (result.status === "blocked") expect(result.reason).toContain("validation failed");
  });

  it("honors cancellation before an action starts", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await runReActLoop({
      act: async () => "never",
      observe: (value) => value,
      validate: () => ({ ok: true }),
      signal: controller.signal
    });
    expect(result.status).toBe("cancelled");
  });

  it("fails closed when observation or validation throws", async () => {
    const observedFailure = await runReActLoop({
      act: async () => "answer",
      observe: () => {
        throw new Error("observer unavailable");
      },
      validate: () => ({ ok: true })
    });
    expect(observedFailure).toMatchObject({ status: "blocked", reason: "observer unavailable", iterations: 1 });

    const validationFailure = await runReActLoop({
      act: async () => "answer",
      observe: (value) => value,
      validate: () => {
        throw new Error("validator unavailable");
      }
    });
    expect(validationFailure).toMatchObject({ status: "blocked", reason: "validator unavailable", iterations: 1 });
  });

  it("returns cancelled when cancellation arrives after an action", async () => {
    const controller = new AbortController();
    const result = await runReActLoop({
      act: async () => {
        controller.abort();
        return "answer";
      },
      observe: (value) => value,
      validate: () => ({ ok: true }),
      signal: controller.signal
    });

    expect(result).toMatchObject({ status: "cancelled", reason: "cancelled", iterations: 1 });
  });
});
