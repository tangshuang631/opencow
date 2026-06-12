import { describe, expect, it } from "vitest";
import {
  captureNpcLocalProjectScreenshot,
  getWorkspaceProjectStatus,
  loadNpcLocalProjectShowcaseGitConfirmationPreview,
  loadNpcLocalProjectShowcasePublishPreview,
  runWorkspaceProject,
  stopWorkspaceProject,
  writeNpcLocalProjectShowcaseSite
} from "./localAssistantService";

describe("localAssistantService browser preview fallbacks", () => {
  it("keeps workspace project run fallback readonly instead of claiming a real launch", async () => {
    const result = await runWorkspaceProject("run the desktop app locally");

    expect(result.preview_only).toBe(true);
    expect(result.pid).toBe(0);
    expect(result.summary).toContain("did not execute");
    expect(result.stdout_preview).toContain("did not launch");
  });

  it("keeps workspace project status fallback readonly instead of claiming a live runtime handle", async () => {
    const result = await getWorkspaceProjectStatus("show the status of the desktop app local run");

    expect(result.preview_only).toBe(true);
    expect(result.pid).toBeNull();
    expect(result.status).toBe("stopped");
    expect(result.summary).toContain("did not inspect");
  });

  it("keeps workspace project stop fallback readonly instead of claiming a real stop", async () => {
    const result = await stopWorkspaceProject("stop the desktop app local run");

    expect(result.preview_only).toBe(true);
    expect(result.pid).toBe(0);
    expect(result.summary).toContain("did not execute");
    expect(result.stdout_preview).toContain("did not stop");
  });

  it("keeps npc screenshot and showcase fallbacks readonly instead of claiming real artifacts", async () => {
    const screenshot = await captureNpcLocalProjectScreenshot(
      "use npc collaboration to capture a screenshot from the matched cattle project now"
    );
    const siteWrite = await writeNpcLocalProjectShowcaseSite(
      "use npc collaboration to generate the showcase site for the matched cattle project now"
    );

    expect(screenshot.preview_only).toBe(true);
    expect(screenshot.summary).toContain("did not capture");
    expect(siteWrite.preview_only).toBe(true);
    expect(siteWrite.summary).toContain("did not write");
  });

  it("keeps npc publish and git confirmation previews explicit about readonly browser preview semantics", async () => {
    const publishPreview = await loadNpcLocalProjectShowcasePublishPreview(
      "use npc collaboration to preview the generated showcase output for the matched cattle project before git"
    );
    const gitPreview = await loadNpcLocalProjectShowcaseGitConfirmationPreview(
      "use npc collaboration to prepare the showcase changes for commit for the matched cattle project"
    );

    expect(publishPreview.preview_only).toBe(true);
    expect(publishPreview.summary).toContain("did not load real");
    expect(gitPreview.preview_only).toBe(true);
    expect(gitPreview.summary).toContain("did not inspect real");
  });
});
