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
});
