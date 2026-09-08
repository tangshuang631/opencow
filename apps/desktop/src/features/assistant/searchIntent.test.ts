import { describe, expect, it } from "vitest";
import { classifySearchIntent, isFreshnessSearchIntent } from "./searchIntent";

describe("search intent classification", () => {
  it("routes Chinese weather questions to the structured weather path", () => {
    expect(classifySearchIntent("今天深圳天气怎么样")).toEqual({
      kind: "weather",
      location: "深圳",
      requiresFreshness: true
    });
  });

  it("extracts a location when the date appears between the location and weather term", () => {
    expect(classifySearchIntent("北京明天会下雨吗")).toEqual({
      kind: "weather",
      location: "北京",
      requiresFreshness: true
    });
  });

  it("keeps general MCP questions out of the freshness route", () => {
    expect(classifySearchIntent("MCP 是什么")).toEqual({
      kind: "general",
      location: null,
      requiresFreshness: false
    });
  });

  it("marks current release questions as fresh without mislabeling them as weather", () => {
    const intent = classifySearchIntent("Ollama 最新稳定版是什么");

    expect(intent.kind).toBe("news");
    expect(intent.location).toBeNull();
    expect(isFreshnessSearchIntent(intent)).toBe(true);
  });

  it("recognizes English weather wording", () => {
    expect(classifySearchIntent("What's the weather in Shenzhen today?")).toEqual({
      kind: "weather",
      location: "Shenzhen",
      requiresFreshness: true
    });
  });
});
