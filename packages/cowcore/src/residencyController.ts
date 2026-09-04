import type { MemoryPressure } from "./types.js";

export function chooseKeepAlive(input: {
  role: "chat" | "tool" | "embedding" | "rerank";
  memoryClass: "low" | "standard" | "high";
  memoryPressure: MemoryPressure;
  frequent: boolean;
}): string {
  if (input.role === "embedding" || input.role === "rerank") return "0";
  if (input.memoryPressure === "critical") return "0";
  if (input.memoryPressure === "high") return input.memoryClass === "low" ? "1m" : "5m";
  if (input.memoryClass === "low") return input.frequent ? "5m" : "1m";
  if (input.memoryClass === "high" && input.frequent) return "30m";
  return input.frequent ? "10m" : "5m";
}
