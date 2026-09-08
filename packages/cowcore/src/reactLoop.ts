export type ReActObservation = {
  iteration: number;
  summary: string;
};

export type ReActValidation = {
  ok: boolean;
  reason?: string;
  feedback?: string;
};

export type ReActLoopResult<T> =
  | { status: "completed"; value: T; iterations: number; observations: ReActObservation[] }
  | { status: "blocked"; reason: string; iterations: number; observations: ReActObservation[] }
  | { status: "cancelled"; reason: string; iterations: number; observations: ReActObservation[] };

/**
 * Bounded ReAct loop for model-backed answers. The callback owns the typed
 * capability; this helper only observes and validates its result, so it can
 * never turn a model retry into an arbitrary host action.
 */
export async function runReActLoop<T>(input: {
  act: (context: { iteration: number; feedback?: string; observations: readonly ReActObservation[]; signal?: AbortSignal }) => Promise<T>;
  observe: (value: T) => string | Promise<string>;
  validate: (value: T, observation: ReActObservation) => ReActValidation | Promise<ReActValidation>;
  maxIterations?: number;
  signal?: AbortSignal;
}): Promise<ReActLoopResult<T>> {
  const maxIterations = Math.max(1, Math.min(3, input.maxIterations ?? 2));
  const observations: ReActObservation[] = [];
  let feedback: string | undefined;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    if (input.signal?.aborted) {
      return { status: "cancelled", reason: "cancelled", iterations: iteration - 1, observations };
    }

    let value: T;
    try {
      value = await input.act({ iteration, feedback, observations: [...observations], signal: input.signal });
    } catch (error) {
      return input.signal?.aborted
        ? { status: "cancelled", reason: "cancelled", iterations: iteration, observations }
        : { status: "blocked", reason: error instanceof Error ? error.message : "ReAct action failed", iterations: iteration, observations };
    }

    try {
      if (input.signal?.aborted) {
        return { status: "cancelled", reason: "cancelled", iterations: iteration, observations };
      }

      const observation: ReActObservation = {
        iteration,
        summary: (await input.observe(value)).trim().slice(0, 500)
      };
      if (input.signal?.aborted) {
        return { status: "cancelled", reason: "cancelled", iterations: iteration, observations };
      }
      observations.push(observation);

      const validation = await input.validate(value, observation);
      if (input.signal?.aborted) {
        return { status: "cancelled", reason: "cancelled", iterations: iteration, observations };
      }
      if (validation.ok) {
        return { status: "completed", value, iterations: iteration, observations };
      }

      feedback = (validation.feedback || validation.reason || "The answer did not satisfy the task contract.").trim().slice(0, 500);
      if (iteration === maxIterations) {
        return { status: "blocked", reason: `answer validation failed: ${feedback}`, iterations: iteration, observations };
      }
    } catch (error) {
      return input.signal?.aborted
        ? { status: "cancelled", reason: "cancelled", iterations: iteration, observations }
        : { status: "blocked", reason: normalizeLoopError(error), iterations: iteration, observations };
    }
  }

  return { status: "blocked", reason: "ReAct iteration budget exceeded", iterations: maxIterations, observations };
}

function normalizeLoopError(error: unknown): string {
  const message = error instanceof Error ? error.message : "ReAct observation or validation failed";
  return message.trim().slice(0, 500) || "ReAct observation or validation failed";
}
