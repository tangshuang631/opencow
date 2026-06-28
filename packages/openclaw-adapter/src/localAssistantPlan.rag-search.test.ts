import { describe, expect, it } from "vitest";
import { planLocalAssistantTask } from "./index.js";

describe("local assistant task planner local rag search", () => {
  it("plans a local RAG document search for local knowledge queries", () => {
    const plan = planLocalAssistantTask({
      message: "search local knowledge for shell permission rules",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "rag-local-doc-search",
      title: "Local RAG document search"
    });
  });

  it("plans a local RAG document search for long document file requests", () => {
    const message = "summarize the long pptx docx and md documents in this workspace";
    const plan = planLocalAssistantTask({
      message,
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "rag-local-doc-search",
      title: "Local RAG document search",
      summary: message
    });
  });

  it("plans a local RAG document search for Chinese long document requests", () => {
    const message = "\u603b\u7ed3\u8fd9\u4e2a\u5de5\u4f5c\u533a\u91cc\u7684 pptx docx md \u957f\u6587\u6863";
    const plan = planLocalAssistantTask({
      message,
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "rag-local-doc-search",
      title: "Local RAG document search",
      summary: message
    });
  });

  it("plans readonly network search guidance for web latest search requests", () => {
    const message = "search the web for latest local RAG indexing approaches";
    const plan = planLocalAssistantTask({
      message,
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "network-search-guidance",
      title: "Network search guidance",
      summary: message
    });
  });
});
