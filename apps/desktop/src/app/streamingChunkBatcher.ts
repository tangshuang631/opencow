export type StreamingChunkBatcher = {
  push(chunk: string): void;
  flush(): void;
  cancel(): void;
};

export function createStreamingChunkBatcher(input: {
  flush: (chunk: string) => void;
  schedule?: (callback: () => void) => number;
  cancel?: (handle: number) => void;
}): StreamingChunkBatcher {
  const schedule = input.schedule ?? scheduleOnFrame;
  const cancel = input.cancel ?? cancelScheduledFrame;
  let pending = "";
  let scheduledHandle: number | null = null;
  let hasEmittedFirstChunk = false;

  function flush() {
    if (scheduledHandle !== null) {
      cancel(scheduledHandle);
      scheduledHandle = null;
    }
    const chunk = pending;
    pending = "";
    if (chunk) input.flush(chunk);
  }

  return {
    push(chunk) {
      if (!chunk) return;
      if (!hasEmittedFirstChunk && !pending && scheduledHandle === null) {
        hasEmittedFirstChunk = true;
        input.flush(chunk);
        return;
      }
      pending += chunk;
      if (scheduledHandle === null) {
        scheduledHandle = schedule(flush);
      }
    },
    flush,
    cancel() {
      if (scheduledHandle !== null) {
        cancel(scheduledHandle);
        scheduledHandle = null;
      }
      pending = "";
    }
  };
}

function scheduleOnFrame(callback: () => void): number {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(() => callback());
  }
  return Number(setTimeout(callback, 16));
}

function cancelScheduledFrame(handle: number): void {
  if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(handle);
    return;
  }
  clearTimeout(handle);
}
