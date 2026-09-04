import { routeTask } from "./taskRouter.js";
import { runTypedToolLoop, type ToolLoopTool, type ToolLoopTurn } from "./typedToolLoop.js";

export type FastLaneObservation = {
  taskClass: ReturnType<typeof routeTask>;
  prefixDigest: string;
  toolCallCount: number;
  turnCount: number;
  status: "completed" | "blocked" | "cancelled" | "escalate";
};

export type FastLaneResult = {
  status: "completed" | "blocked" | "cancelled" | "escalate";
  taskClass: ReturnType<typeof routeTask>;
  content?: string;
  reason?: string;
  observation: FastLaneObservation;
};

export async function runFastLane(input: {
  route: Parameters<typeof routeTask>[0];
  prefixDigest: string;
  invokeDirect?: () => Promise<string>;
  invokeModel?: (context: { turn: number; toolResults: Array<{ id: string; name: string; result: unknown }>; signal?: AbortSignal }) => Promise<ToolLoopTurn>;
  tools?: ToolLoopTool[];
  signal?: AbortSignal;
}): Promise<FastLaneResult> {
  const taskClass = routeTask(input.route);
  if (taskClass === "advanced-agent-task") return finish({ status: "escalate", taskClass, prefixDigest: input.prefixDigest, toolCallCount: 0, turnCount: 0, reason: "advanced task requires explicit sidecar route" });
  if (taskClass !== "typed-tool-task") {
    if (!input.invokeDirect) return finish({ status: "blocked", taskClass, prefixDigest: input.prefixDigest, toolCallCount: 0, turnCount: 0, reason: "direct local invocation is unavailable" });
    try {
      const content = await input.invokeDirect();
      return finish({ status: "completed", taskClass, prefixDigest: input.prefixDigest, toolCallCount: 0, turnCount: 1, content });
    } catch (error) {
      return finish({ status: input.signal?.aborted ? "cancelled" : "blocked", taskClass, prefixDigest: input.prefixDigest, toolCallCount: 0, turnCount: 1, reason: error instanceof Error ? error.message : "local invocation failed" });
    }
  }
  if (!input.invokeModel) return finish({ status: "blocked", taskClass, prefixDigest: input.prefixDigest, toolCallCount: 0, turnCount: 0, reason: "typed model invocation is unavailable" });
  const result = await runTypedToolLoop({ invokeModel: input.invokeModel, tools: input.tools, signal: input.signal });
  return finish({
    status: result.status,
    taskClass,
    prefixDigest: input.prefixDigest,
    toolCallCount: result.toolCallCount,
    turnCount: result.turnCount,
    ...(result.status === "completed" ? { content: result.content } : { reason: result.reason })
  });
}

function finish(input: Omit<FastLaneResult, "observation"> & { prefixDigest: string; toolCallCount: number; turnCount: number }): FastLaneResult {
  const { prefixDigest, toolCallCount, turnCount, ...result } = input;
  return {
    ...result,
    observation: {
      taskClass: result.taskClass,
      prefixDigest,
      toolCallCount,
      turnCount,
      status: result.status
    }
  };
}
