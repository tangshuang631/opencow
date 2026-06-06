import { describe, expect, it } from "vitest";
import { planLocalAssistantTask } from "./index.js";

describe("local assistant task planner readonly shell commands", () => {
  it("plans a git status shell diagnostic for git inspection requests", () => {
    const plan = planLocalAssistantTask({
      message: "check git status for this workspace",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "readonly-shell-git-status",
      title: "Workspace git status"
    });
  });

  it("plans a packages directory listing for package folder inspection requests", () => {
    const plan = planLocalAssistantTask({
      message: "list package folders in this workspace",
      permissionMode: "readonly"
    });

    expect(plan).toMatchObject({
      kind: "readonly-shell-packages-dir",
      title: "Workspace packages directory"
    });
  });
});
