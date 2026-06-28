import { describe, expect, it, vi } from "vitest";
import { executeAssistantTask, planAssistantTask } from "./assistantTaskService";

const {
  loadOpenClawCapabilityOverviewMock,
  listEnabledLocalSkillsMock,
  loadWorkspaceOverviewMock,
  loadWorkspaceProjectRunPreviewMock,
  runWorkspaceProjectMock,
  captureNpcLocalProjectScreenshotMock,
  writeNpcLocalProjectShowcaseSiteMock,
  loadNpcLocalProjectShowcasePublishPreviewMock,
  loadNpcLocalProjectShowcaseGitConfirmationPreviewMock
} = vi.hoisted(() => ({
  loadOpenClawCapabilityOverviewMock: vi.fn(),
  listEnabledLocalSkillsMock: vi.fn(),
  loadWorkspaceOverviewMock: vi.fn(),
  loadWorkspaceProjectRunPreviewMock: vi.fn(),
  runWorkspaceProjectMock: vi.fn(),
  captureNpcLocalProjectScreenshotMock: vi.fn(),
  writeNpcLocalProjectShowcaseSiteMock: vi.fn(),
  loadNpcLocalProjectShowcasePublishPreviewMock: vi.fn(),
  loadNpcLocalProjectShowcaseGitConfirmationPreviewMock: vi.fn()
}));

vi.mock("./localAssistantService", async () => {
  const actual = await vi.importActual<typeof import("./localAssistantService")>("./localAssistantService");

  return {
    ...actual,
    loadOpenClawCapabilityOverview: loadOpenClawCapabilityOverviewMock,
    listEnabledLocalSkills: listEnabledLocalSkillsMock,
    loadWorkspaceOverview: loadWorkspaceOverviewMock,
    loadWorkspaceProjectRunPreview: loadWorkspaceProjectRunPreviewMock,
    runWorkspaceProject: runWorkspaceProjectMock,
    captureNpcLocalProjectScreenshot: captureNpcLocalProjectScreenshotMock,
    writeNpcLocalProjectShowcaseSite: writeNpcLocalProjectShowcaseSiteMock,
    loadNpcLocalProjectShowcasePublishPreview: loadNpcLocalProjectShowcasePublishPreviewMock,
    loadNpcLocalProjectShowcaseGitConfirmationPreview: loadNpcLocalProjectShowcaseGitConfirmationPreviewMock
  };
});

describe("assistantTaskService npc project showcase preview", () => {
  it("plans a readonly npc showcase preview without a permission upgrade", () => {
    const plan = planAssistantTask(
      "use npc collaboration to inspect and run the local cattle project, capture screenshots, and generate a resume-ready showcase website in my git repo",
      "readonly"
    );

    expect(plan).toMatchObject({
      kind: "npc-local-project-showcase-preview",
      title: "NPC local project showcase preview"
    });
  });

  it("returns a staged showcase workflow preview that keeps privileged steps explicit", async () => {
    loadOpenClawCapabilityOverviewMock.mockResolvedValueOnce({
      capability_id: "npc",
      title: "OpenClaw NPC capability overview",
      status: "ready-foundation",
      required_package_count: 3,
      available_package_count: 3,
      available_packages: ["@openclaw/llm-core", "@openclaw/llm-runtime", "@openclaw/tool-call-repair"],
      missing_packages: [],
      summary: "NPC capability foundation is available locally."
    });
    listEnabledLocalSkillsMock.mockResolvedValueOnce({
      summary: "Found enabled local skills.",
      total_count: 2,
      registry_path: ".opencow/skills/enabled-skills.json",
      items: [
        {
          name: "coding-agent",
          path: "vendor/openclaw/skills/coding-agent/SKILL.md",
          source: "vendor-openclaw-skill",
          description: "OpenClaw coding agent workflow"
        }
      ]
    });
    loadWorkspaceOverviewMock.mockResolvedValueOnce({
      root_name: "opencow",
      entry_count: 7,
      package_count: 3,
      package_names: ["openclaw-adapter", "permission-engine", "shell-runtime"],
      summary: "Workspace opencow currently contains 7 root entries and 3 local packages."
    });
    loadWorkspaceProjectRunPreviewMock.mockResolvedValueOnce({
      query:
        "use npc collaboration to inspect and run the local cattle project, capture screenshots, and generate a resume-ready showcase website in my git repo",
      summary: "Workspace run preview matched cattle and prepared a readonly launch suggestion.",
      inspected_project_count: 4,
      matched_project_name: "cattle",
      matched_project_path: "projects/cattle",
      matched_project_source: "unknown",
      dev_command: "npm run dev",
      start_command: "npm run start",
      build_command: "npm run build",
      preferred_command: "npm run dev",
      expected_url: "http://127.0.0.1:3000",
      next_required_permission: "workspace-write",
      risk_summary:
        "Readonly preview only. Actual local launch must still request permission, stay inside the approved workspace, and write an audit trail.",
      candidate_projects: [
        {
          name: "cattle",
          path: "projects/cattle",
          source: "unknown",
          script_names: ["dev", "start", "build"]
        }
      ]
    });

    const result = await executeAssistantTask({
      kind: "npc-local-project-showcase-preview",
      title: "NPC local project showcase preview",
      summary:
        "use npc collaboration to inspect and run the local cattle project, capture screenshots, and generate a resume-ready showcase website in my git repo",
      auditSummary: "Local assistant planned a readonly NPC local project showcase preview.",
      auditDetail: "Readonly NPC local project showcase preview task"
    } as const);

    expect(result.resultTitle).toBe("NPC local project showcase preview");
    expect(result.resultSummary).toContain("cattle");
    expect(result.resultSummary).toContain("project inspection");
    expect(result.resultSummary).toContain("run preview");
    expect(result.resultSummary).toContain("screenshot capture");
    expect(result.resultSummary).toContain("showcase site generation");
    expect(result.resultSummary).toContain("git push");
    expect(result.resultSummary).toContain("permission");
    expect(result.resultSummary).toContain("npm run dev");
    expect(result.resultSummary).toContain("http://127.0.0.1:3000");
    expect(result.resultSummary).toContain("workspace-write");
    expect(result.resultSummary).toContain("状态：ready-foundation");
    expect(result.resultSummary).toContain("已启用 Skills：coding-agent");
    expect(result.resultSummary).toContain("工作区：opencow");
    expect(result.resultSummary).toContain("推荐启动命令：npm run dev");
    expect(result.resultSummary).not.toContain("Status:");
    expect(result.resultSummary).not.toContain("Enabled skills:");
    expect(result.resultSummary).not.toContain("Workspace root:");
    expect(result.resultSummary).not.toContain("Preferred launch command:");
  });

  it("requests workspace-write before running the matched npc showcase project", () => {
    const plan = planAssistantTask("use npc collaboration to run the matched cattle project now", "readonly");

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "npc-local-project-run"
    });
  });

  it("runs the matched local project through the existing desktop lifecycle with npc-specific identity", async () => {
    runWorkspaceProjectMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "projects/cattle",
      command_label: "npm run dev",
      working_directory: "projects/cattle",
      expected_url: "http://127.0.0.1:3000",
      pid: 5252,
      stdout_preview: "cattle dev server started",
      summary: "Workspace project run started successfully and returned a live local process handle."
    });

    const result = await executeAssistantTask({
      kind: "npc-local-project-run",
      title: "NPC local project run",
      summary: "use npc collaboration to run the matched cattle project now",
      auditSummary: "Local assistant planned an NPC local project run.",
      auditDetail: "NPC local project run task."
    } as const);

    expect(result.resultTitle).toBe("NPC local project run");
    expect(result.resultSummary).toContain("cattle");
    expect(result.resultSummary).toContain("projects/cattle");
    expect(result.resultSummary).toContain("npm run dev");
    expect(result.resultSummary).toContain("http://127.0.0.1:3000");
    expect(result.resultSummary).toContain("5252");
    expect(result.resultSummary).toContain("NPC 展示链路中的首次执行阶段");
    expect(result.resultSummary).toContain("匹配项目：cattle");
    expect(result.resultSummary).toContain("命令：npm run dev");
    expect(result.resultSummary).not.toContain("Matched project:");
    expect(result.resultSummary).not.toContain("Command:");
    expect(result.resultSummary).not.toContain("Working directory:");
  });

  it("requests workspace-write before capturing a matched npc showcase screenshot", () => {
    const plan = planAssistantTask(
      "use npc collaboration to capture a screenshot from the matched cattle project now",
      "readonly"
    );

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "npc-local-project-screenshot-capture"
    });
  });

  it("captures the matched local project screenshot with npc-specific identity", async () => {
    captureNpcLocalProjectScreenshotMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "apps/cattle",
      expected_url: "http://127.0.0.1:3000",
      artifact_path: ".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png",
      artifact_directory: ".opencow/artifacts/npc-showcase",
      capture_target: "http://127.0.0.1:3000",
      summary: "NPC local project screenshot capture completed successfully and wrote a workspace-local artifact."
    });

    const result = await executeAssistantTask({
      kind: "npc-local-project-screenshot-capture",
      title: "NPC local project screenshot capture",
      summary: "use npc collaboration to capture a screenshot from the matched cattle project now",
      auditSummary: "Local assistant planned NPC local project screenshot capture.",
      auditDetail: "NPC local project screenshot capture task."
    } as const);

    expect(result.resultTitle).toBe("NPC local project screenshot capture");
    expect(result.resultSummary).toContain("cattle");
    expect(result.resultSummary).toContain("apps/cattle");
    expect(result.resultSummary).toContain("http://127.0.0.1:3000");
    expect(result.resultSummary).toContain(".opencow/artifacts/npc-showcase");
    expect(result.resultSummary).toContain("NPC 展示链路中的截图阶段");
    expect(result.resultSummary).toContain("匹配项目：cattle");
    expect(result.resultSummary).not.toContain("Matched project:");
    expect(result.resultSummary).not.toContain("Capture target:");
    expect(result.resultSummary).not.toContain("Expected URL:");
  });

  it("requests workspace-write before generating a matched npc showcase site", () => {
    const plan = planAssistantTask(
      "use npc collaboration to generate the showcase site for the matched cattle project now",
      "readonly"
    );

    expect(plan).toMatchObject({
      kind: "permission-request",
      targetMode: "workspace-write",
      queuedExecutionKind: "npc-local-project-showcase-site-write"
    });
  });

  it("writes the matched local project showcase site with npc-specific identity", async () => {
    writeNpcLocalProjectShowcaseSiteMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "apps/cattle",
      site_root: ".opencow/artifacts/npc-showcase/sites/cattle",
      entry_file: ".opencow/artifacts/npc-showcase/sites/cattle/index.html",
      changed_paths: [".opencow/artifacts/npc-showcase/sites/cattle/index.html"],
      source_screenshot_path: ".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png",
      summary: "NPC local project showcase-site write completed successfully and returned a changed-file summary."
    });

    const result = await executeAssistantTask({
      kind: "npc-local-project-showcase-site-write",
      title: "NPC local project showcase-site write",
      summary: "use npc collaboration to generate the showcase site for the matched cattle project now",
      auditSummary: "Local assistant planned NPC local project showcase-site write.",
      auditDetail: "NPC local project showcase-site write task."
    } as const);

    expect(result.resultTitle).toBe("NPC local project showcase-site write");
    expect(result.resultSummary).toContain("cattle");
    expect(result.resultSummary).toContain("apps/cattle");
    expect(result.resultSummary).toContain(".opencow/artifacts/npc-showcase/sites/cattle");
    expect(result.resultSummary).toContain("index.html");
    expect(result.resultSummary).toContain(".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png");
    expect(result.resultSummary).toContain("NPC 展示链路中的展示站点写入阶段");
    expect(result.resultSummary).toContain("匹配项目：cattle");
    expect(result.resultSummary).not.toContain("Matched project:");
    expect(result.resultSummary).not.toContain("Site root:");
    expect(result.resultSummary).not.toContain("Changed paths:");
  });

  it("plans a readonly npc showcase publish preview without collapsing into generic git status", () => {
    const plan = planAssistantTask(
      "use npc collaboration to preview the generated showcase output for the matched cattle project before git",
      "readonly"
    );

    expect(plan).toMatchObject({
      kind: "npc-local-project-showcase-publish-preview",
      title: "NPC local project showcase publish preview"
    });
  });

  it("loads the matched local project showcase publish preview with npc-specific identity", async () => {
    loadNpcLocalProjectShowcasePublishPreviewMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "apps/cattle",
      site_root: ".opencow/artifacts/npc-showcase/sites/cattle",
      entry_file: ".opencow/artifacts/npc-showcase/sites/cattle/index.html",
      changed_paths: [".opencow/artifacts/npc-showcase/sites/cattle/index.html"],
      source_screenshot_path: ".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png",
      next_git_step: "Git commit or push is still separate and requires its own explicit confirmation stage.",
      summary: "NPC local project showcase publish-preview loaded the latest generated showcase outputs without entering git."
    });

    const result = await executeAssistantTask({
      kind: "npc-local-project-showcase-publish-preview",
      title: "NPC local project showcase publish preview",
      summary: "use npc collaboration to preview the generated showcase output for the matched cattle project before git",
      auditSummary: "Local assistant planned a readonly NPC local project showcase publish preview.",
      auditDetail: "Readonly NPC local project showcase publish preview task."
    } as const);

    expect(result.resultTitle).toBe("NPC local project showcase publish preview");
    expect(result.resultSummary).toContain("cattle");
    expect(result.resultSummary).toContain("apps/cattle");
    expect(result.resultSummary).toContain(".opencow/artifacts/npc-showcase/sites/cattle");
    expect(result.resultSummary).toContain("index.html");
    expect(result.resultSummary).toContain(".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png");
    expect(result.resultSummary).toContain("Git commit or push is still separate");
    expect(result.resultSummary).toContain("只读发布预览阶段");
    expect(result.resultSummary).not.toContain("Matched project:");
    expect(result.resultSummary).not.toContain("Next git step:");
  });

  it("plans a readonly npc showcase git confirmation preview without collapsing into publish preview", () => {
    const plan = planAssistantTask(
      "use npc collaboration to prepare the showcase changes for commit for the matched cattle project",
      "readonly"
    );

    expect(plan).toMatchObject({
      kind: "npc-local-project-showcase-git-confirmation-preview",
      title: "NPC local project showcase git confirmation preview"
    });
  });

  it("loads the matched local project showcase git confirmation preview with npc-specific identity", async () => {
    loadNpcLocalProjectShowcaseGitConfirmationPreviewMock.mockResolvedValueOnce({
      project_name: "cattle",
      project_path: "apps/cattle",
      site_root: ".opencow/artifacts/npc-showcase/sites/cattle",
      entry_file: ".opencow/artifacts/npc-showcase/sites/cattle/index.html",
      changed_paths: [".opencow/artifacts/npc-showcase/sites/cattle/index.html"],
      source_screenshot_path: ".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png",
      recommended_git_action: "commit",
      required_confirmation_stage: "Git commit or push still requires its own explicit confirmation and execution stage.",
      summary: "NPC local project showcase git confirmation preview summarized the current showcase-related changes without executing git."
    });

    const result = await executeAssistantTask({
      kind: "npc-local-project-showcase-git-confirmation-preview",
      title: "NPC local project showcase git confirmation preview",
      summary: "use npc collaboration to prepare the showcase changes for commit for the matched cattle project",
      auditSummary: "Local assistant planned a readonly NPC local project showcase git confirmation preview.",
      auditDetail: "Readonly NPC local project showcase git confirmation preview task."
    } as const);

    expect(result.resultTitle).toBe("NPC local project showcase git confirmation preview");
    expect(result.resultSummary).toContain("cattle");
    expect(result.resultSummary).toContain("apps/cattle");
    expect(result.resultSummary).toContain(".opencow/artifacts/npc-showcase/sites/cattle");
    expect(result.resultSummary).toContain("index.html");
    expect(result.resultSummary).toContain(".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png");
    expect(result.resultSummary).toContain("commit");
    expect(result.resultSummary).toContain("explicit confirmation");
    expect(result.resultSummary).toContain("只读 Git 确认预览阶段");
    expect(result.resultSummary).not.toContain("Matched project:");
    expect(result.resultSummary).not.toContain("Recommended git action:");
  });
});
