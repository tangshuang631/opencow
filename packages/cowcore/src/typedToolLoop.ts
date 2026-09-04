export type ToolLoopTurn =
  | { kind: "final"; content: string }
  | { kind: "tool-call"; calls: Array<{ id: string; name: string; arguments: unknown }> };

export type ToolLoopTool = {
  name: string;
  effect: "none" | "readonly" | "read" | "write" | "delete" | "execute" | "network" | "credential";
  inputSchema: Record<string, unknown>;
  execute: (input: unknown, signal?: AbortSignal) => Promise<unknown>;
};

export type ToolLoopResult =
  | { status: "completed"; content: string; toolCallCount: number; turnCount: number }
  | { status: "blocked"; reason: string; toolCallCount: number; turnCount: number }
  | { status: "cancelled"; reason: string; toolCallCount: number; turnCount: number };

export async function runTypedToolLoop(input: {
  invokeModel: (context: { turn: number; toolResults: Array<{ id: string; name: string; result: unknown }>; signal?: AbortSignal }) => Promise<ToolLoopTurn>;
  tools?: ToolLoopTool[];
  maxTurns?: number;
  maxToolCalls?: number;
  signal?: AbortSignal;
}): Promise<ToolLoopResult> {
  const maxTurns = Math.max(1, input.maxTurns ?? 3);
  const maxToolCalls = Math.max(1, input.maxToolCalls ?? 5);
  const tools = input.tools ?? [];
  const seenCallIds = new Set<string>();
  const toolResults: Array<{ id: string; name: string; result: unknown }> = [];
  let toolCallCount = 0;

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    if (input.signal?.aborted) return cancelled(toolCallCount, turn);
    let response: ToolLoopTurn;
    try {
      response = await input.invokeModel({ turn, toolResults: [...toolResults], signal: input.signal });
    } catch (error) {
      return input.signal?.aborted ? cancelled(toolCallCount, turn) : blocked(error instanceof Error ? error.message : "model invocation failed", toolCallCount, turn);
    }
    if (response.kind === "final") return { status: "completed", content: response.content, toolCallCount, turnCount: turn };
    if (!Array.isArray(response.calls) || response.calls.length === 0) return blocked("tool call list is empty", toolCallCount, turn);

    for (const call of response.calls) {
      if (input.signal?.aborted) return cancelled(toolCallCount, turn);
      if (!call.id.trim() || seenCallIds.has(call.id)) return blocked("duplicate or missing tool call id", toolCallCount, turn);
      const tool = tools.find((candidate) => candidate.name === call.name);
      if (!tool) return blocked(`unknown tool: ${call.name}`, toolCallCount, turn);
      if (tool.effect !== "none" && tool.effect !== "readonly") return blocked("pre-WP2 tool effect is not allowed", toolCallCount, turn);
      if (!matchesSchema(call.arguments, tool.inputSchema)) return blocked(`invalid arguments for ${call.name}`, toolCallCount, turn);
      if (toolCallCount >= maxToolCalls) return blocked("tool call budget exceeded", toolCallCount, turn);
      seenCallIds.add(call.id);
      try {
        const result = await tool.execute(call.arguments, input.signal);
        toolResults.push({ id: call.id, name: call.name, result });
        toolCallCount += 1;
      } catch (error) {
        return input.signal?.aborted ? cancelled(toolCallCount, turn) : blocked(error instanceof Error ? error.message : "tool execution failed", toolCallCount, turn);
      }
    }
    if (turn === maxTurns) return blocked("turn budget exceeded", toolCallCount, turn);
  }
  return blocked("turn budget exceeded", toolCallCount, maxTurns);
}

function matchesSchema(value: unknown, schema: Record<string, unknown>): boolean {
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const object = value as Record<string, unknown>;
    const required = Array.isArray(schema.required) ? schema.required : [];
    if (required.some((key) => typeof key !== "string" || !(key in object))) return false;
    const properties = schema.properties && typeof schema.properties === "object" ? schema.properties as Record<string, Record<string, unknown>> : {};
    return Object.entries(properties).every(([key, propertySchema]) => !(key in object) || matchesSchema(object[key], propertySchema));
  }
  if (schema.type === "string") return typeof value === "string";
  if (schema.type === "number" || schema.type === "integer") return typeof value === "number" && Number.isFinite(value);
  if (schema.type === "boolean") return typeof value === "boolean";
  if (schema.type === "array") return Array.isArray(value);
  return true;
}

function blocked(reason: string, toolCallCount: number, turnCount: number): ToolLoopResult {
  return { status: "blocked", reason, toolCallCount, turnCount };
}

function cancelled(toolCallCount: number, turnCount: number): ToolLoopResult {
  return { status: "cancelled", reason: "cancelled", toolCallCount, turnCount };
}
