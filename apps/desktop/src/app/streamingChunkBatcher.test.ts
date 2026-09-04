import { describe, expect, it } from "vitest";
import { createStreamingChunkBatcher } from "./streamingChunkBatcher";

describe("streaming chunk batcher", () => {
  it("coalesces chunks until the scheduled frame", () => {
    let frame: (() => void) | undefined;
    const flushed: string[] = [];
    const batcher = createStreamingChunkBatcher({
      flush: (chunk) => flushed.push(chunk),
      schedule: (callback) => {
        frame = callback;
        return 1;
      },
      cancel: () => undefined
    });

    batcher.push("a");
    batcher.push("b");
    expect(flushed).toEqual(["a"]);
    frame?.();
    expect(flushed).toEqual(["a", "b"]);
  });

  it("flushes pending content once and drops cancelled content", () => {
    const flushed: string[] = [];
    const batcher = createStreamingChunkBatcher({
      flush: (chunk) => flushed.push(chunk),
      schedule: () => 1,
      cancel: () => undefined
    });

    batcher.push("first");
    batcher.push("pending");
    batcher.flush();
    batcher.flush();
    expect(flushed).toEqual(["first", "pending"]);

    batcher.push("second");
    batcher.push("discarded");
    batcher.cancel();
    batcher.flush();
    expect(flushed).toEqual(["first", "pending"]);
  });
});
