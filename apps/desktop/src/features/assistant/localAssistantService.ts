import { invoke } from "@tauri-apps/api/core";

export type WorkspaceOverview = {
  root_name: string;
  entry_count: number;
  package_count: number;
  package_names: string[];
  summary: string;
};

export type WorkspacePackagesOverview = {
  root_name: string;
  package_count: number;
  package_names: string[];
  total_script_count: number;
  packages_with_scripts: string[];
  summary: string;
};

export type WorkspaceConfigOverview = {
  root_name: string;
  config_files: string[];
  root_script_names: string[];
  root_script_count: number;
  package_manager_files: string[];
  summary: string;
};

export type WorkspaceProjectRunPreview = {
  query: string;
  summary: string;
  inspected_project_count: number;
  matched_project_name: string | null;
  matched_project_path: string | null;
  matched_project_source: "packages" | "apps" | "root" | "unknown" | null;
  dev_command: string | null;
  start_command: string | null;
  build_command: string | null;
  preferred_command: string | null;
  expected_url: string | null;
  next_required_permission: "readonly" | "workspace-write" | "controlled-full";
  risk_summary: string;
  candidate_projects: Array<{
    name: string;
    path: string;
    source: "packages" | "apps" | "root" | "unknown";
    script_names: string[];
  }>;
};

export type OpenClawCapabilityId = "rag" | "skills" | "npc" | "mcp";

export type OpenClawCapabilityOverview = {
  capability_id: OpenClawCapabilityId;
  title: string;
  status: "ready-foundation" | "partial-foundation";
  required_package_count: number;
  available_package_count: number;
  available_packages: string[];
  missing_packages: string[];
  summary: string;
};

export type LocalMcpPluginScanItem = {
  id: string;
  path: string;
  source: string;
  activation: string;
  tool_count: number;
  skill_count: number;
};

export type LocalKnowledgeSearchResult = {
  query: string;
  summary: string;
  match_count: number;
  indexed_document_count: number;
  items: Array<{
    path: string;
    title: string;
    snippet: string;
    score: number;
  }>;
};

export type LocalSkillScanResult = {
  summary: string;
  total_count: number;
  scanned_root_count: number;
  items: Array<{
    name: string;
    path: string;
    source: string;
    description: string;
    enabled: boolean;
  }>;
};

export type LocalSkillInspectResult = {
  query: string;
  summary: string;
  match_count: number;
  scanned_root_count: number;
  items: Array<{
    name: string;
    path: string;
    source: string;
    description: string;
    content_preview: string;
    enabled: boolean;
  }>;
};

export type LocalSkillEnableResult = {
  query: string;
  enabled_skill_name: string;
  registry_path: string;
  status: "enabled" | "already-enabled";
  summary: string;
};

export type LocalSkillInstallResult = {
  query: string;
  installed_skill_name: string;
  installed_skill_path: string;
  source_skill_path: string;
  status: "installed" | "already-installed";
  summary: string;
};

export type LocalSkillDisableResult = {
  query: string;
  disabled_skill_name: string;
  registry_path: string;
  status: "disabled";
  summary: string;
};

export type OpencowSelfRepairEnabledSkillsRegistryResult = {
  query: string;
  repair_target: "enabled-skills-registry";
  repaired_path: string;
  status: "repaired";
  preserved_entry_count: number;
  verified_version: number;
  verified_entry_count: number;
  summary: string;
};

export type EnabledLocalSkillsResult = {
  summary: string;
  total_count: number;
  registry_path: string;
  items: Array<{
    name: string;
    path: string;
    source: string;
    description: string;
  }>;
};

export type EnabledLocalSkillMatchResult = {
  query: string;
  summary: string;
  registry_path: string;
  enabled_skill_count: number;
  match_count: number;
  items: Array<{
    name: string;
    path: string;
    source: string;
    description: string;
    content_preview: string;
  }>;
};

export type LocalMcpPluginScanResult = {
  summary: string;
  total_count: number;
  scanned_root_count: number;
  items: LocalMcpPluginScanItem[];
};

export type LocalMcpPluginInspectResult = {
  query: string;
  summary: string;
  match_count: number;
  scanned_root_count: number;
  items: Array<{
    id: string;
    path: string;
    source: string;
    activation: string;
    tool_count: number;
    skill_count: number;
    description: string;
    tool_names: string[];
    skill_paths: string[];
  }>;
};

export type LocalMcpPluginStartPreviewResult = {
  query: string;
  summary: string;
  match_count: number;
  scanned_root_count: number;
  items: Array<{
    id: string;
    path: string;
    source: string;
    activation: string;
    startup_allowed: boolean;
    command_preview: string;
    working_directory: string;
    risk_summary: string;
    requires_config: boolean;
    config_hint: string;
  }>;
};

export type LocalMcpPluginStartResult = {
  plugin_id: string;
  command_label: string;
  working_directory: string;
  stdout_preview: string;
  line_count: number;
  summary: string;
};

export type ReadonlyShellCommandId = "git-status" | "workspace-root-list" | "packages-dir-list";
export type WorkspaceWriteShellCommandId = "create-temp-output-dir";
export type ControlledFullShellCommandId = "remove-temp-output-dir";
export type WorkspaceProjectRunResult = {
  project_name: string;
  project_path: string;
  command_label: string;
  working_directory: string;
  expected_url: string | null;
  pid: number;
  stdout_preview: string;
  summary: string;
};

export type WorkspaceProjectStatusResult = {
  project_name: string;
  project_path: string;
  command_label: string;
  working_directory: string;
  expected_url: string | null;
  pid: number | null;
  status: "running" | "stopped";
  stdout_preview: string;
  summary: string;
};

export type WorkspaceProjectStopResult = {
  project_name: string;
  project_path: string;
  command_label: string;
  working_directory: string;
  pid: number;
  status: "stopped";
  stdout_preview: string;
  summary: string;
};

export type WorkspaceProjectNpcScreenshotCaptureResult = {
  project_name: string;
  project_path: string;
  expected_url: string | null;
  artifact_path: string;
  artifact_directory: string;
  capture_target: string;
  summary: string;
};

export type ReadonlyShellCommandResult = {
  command_id: ReadonlyShellCommandId;
  command_label: string;
  stdout_preview: string;
  line_count: number;
  summary: string;
};

export type WorkspaceWriteShellCommandResult = {
  command_id: WorkspaceWriteShellCommandId;
  command_label: string;
  stdout_preview: string;
  line_count: number;
  summary: string;
};

export type ControlledFullShellCommandResult = {
  command_id: ControlledFullShellCommandId;
  command_label: string;
  stdout_preview: string;
  line_count: number;
  summary: string;
};

export async function searchLocalKnowledge(query: string): Promise<LocalKnowledgeSearchResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewLocalKnowledgeSearch(query);
  }

  return invoke<LocalKnowledgeSearchResult>("local_knowledge_search", {
    query
  });
}

export async function scanLocalSkills(): Promise<LocalSkillScanResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewLocalSkillScan();
  }

  return invoke<LocalSkillScanResult>("local_skill_scan");
}

export async function inspectLocalSkill(query: string): Promise<LocalSkillInspectResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewLocalSkillInspect(query);
  }

  return invoke<LocalSkillInspectResult>("local_skill_inspect", {
    query
  });
}

export async function enableLocalSkill(query: string): Promise<LocalSkillEnableResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewLocalSkillEnable(query);
  }

  return invoke<LocalSkillEnableResult>("local_skill_enable", {
    query
  });
}

export async function installLocalSkill(query: string): Promise<LocalSkillInstallResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewLocalSkillInstall(query);
  }

  return invoke<LocalSkillInstallResult>("local_skill_install", {
    query
  });
}

export async function disableLocalSkill(query: string): Promise<LocalSkillDisableResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewLocalSkillDisable(query);
  }

  return invoke<LocalSkillDisableResult>("local_skill_disable", {
    query
  });
}

export async function repairOpencowEnabledSkillsRegistry(
  query: string
): Promise<OpencowSelfRepairEnabledSkillsRegistryResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewOpencowEnabledSkillsRegistryRepair(query);
  }

  return invoke<OpencowSelfRepairEnabledSkillsRegistryResult>("opencow_self_repair_enabled_skills_registry", {
    query
  });
}

export async function listEnabledLocalSkills(): Promise<EnabledLocalSkillsResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewEnabledLocalSkills();
  }

  return invoke<EnabledLocalSkillsResult>("local_enabled_skill_list");
}

export async function matchEnabledLocalSkills(query: string): Promise<EnabledLocalSkillMatchResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewEnabledLocalSkillMatch(query);
  }

  return invoke<EnabledLocalSkillMatchResult>("local_enabled_skill_match", {
    query
  });
}

export async function scanLocalMcpPlugins(): Promise<LocalMcpPluginScanResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewLocalMcpPluginScan();
  }

  return invoke<LocalMcpPluginScanResult>("local_mcp_plugin_scan");
}

export async function inspectLocalMcpPlugin(query: string): Promise<LocalMcpPluginInspectResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewLocalMcpPluginInspect(query);
  }

  return invoke<LocalMcpPluginInspectResult>("local_mcp_plugin_inspect", {
    query
  });
}

export async function previewLocalMcpPluginStart(query: string): Promise<LocalMcpPluginStartPreviewResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewLocalMcpPluginStartPreview(query);
  }

  return invoke<LocalMcpPluginStartPreviewResult>("local_mcp_plugin_start_preview", {
    query
  });
}

export async function startLocalMcpPlugin(query: string): Promise<LocalMcpPluginStartResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewLocalMcpPluginStart(query);
  }

  return invoke<LocalMcpPluginStartResult>("local_mcp_plugin_start", {
    query
  });
}

export async function loadOpenClawCapabilityOverview(
  capabilityId: OpenClawCapabilityId
): Promise<OpenClawCapabilityOverview> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewCapabilityOverview(capabilityId);
  }

  return invoke<OpenClawCapabilityOverview>("openclaw_capability_overview", {
    capabilityId
  });
}

export async function loadWorkspaceOverview(): Promise<WorkspaceOverview> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewOverview();
  }

  return invoke<WorkspaceOverview>("workspace_overview");
}

export async function loadWorkspacePackagesOverview(): Promise<WorkspacePackagesOverview> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewPackagesOverview();
  }

  return invoke<WorkspacePackagesOverview>("workspace_packages_overview");
}

export async function loadWorkspaceConfigOverview(): Promise<WorkspaceConfigOverview> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewConfigOverview();
  }

  return invoke<WorkspaceConfigOverview>("workspace_config_overview");
}

export async function loadWorkspaceProjectRunPreview(query: string): Promise<WorkspaceProjectRunPreview> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewProjectRunPreview(query);
  }

  return invoke<WorkspaceProjectRunPreview>("workspace_project_run_preview", {
    query
  });
}

export async function runReadonlyShellCommand(commandId: ReadonlyShellCommandId): Promise<ReadonlyShellCommandResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewReadonlyCommand(commandId);
  }

  return invoke<ReadonlyShellCommandResult>("workspace_readonly_command", {
    commandId
  });
}

export async function runWorkspaceWriteShellCommand(
  commandId: WorkspaceWriteShellCommandId
): Promise<WorkspaceWriteShellCommandResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewWorkspaceWriteCommand(commandId);
  }

  return invoke<WorkspaceWriteShellCommandResult>("workspace_write_command", {
    commandId
  });
}

export async function runWorkspaceProject(query: string): Promise<WorkspaceProjectRunResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewWorkspaceProjectRun(query);
  }

  return invoke<WorkspaceProjectRunResult>("workspace_project_run", {
    query
  });
}

export async function getWorkspaceProjectStatus(query: string): Promise<WorkspaceProjectStatusResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewWorkspaceProjectStatus(query);
  }

  return invoke<WorkspaceProjectStatusResult>("workspace_project_status", {
    query
  });
}

export async function stopWorkspaceProject(query: string): Promise<WorkspaceProjectStopResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewWorkspaceProjectStop(query);
  }

  return invoke<WorkspaceProjectStopResult>("workspace_project_stop", {
    query
  });
}

export async function captureNpcLocalProjectScreenshot(
  query: string
): Promise<WorkspaceProjectNpcScreenshotCaptureResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewNpcProjectScreenshotCapture(query);
  }

  return invoke<WorkspaceProjectNpcScreenshotCaptureResult>("workspace_project_npc_screenshot_capture", {
    query
  });
}

export async function runControlledFullShellCommand(
  commandId: ControlledFullShellCommandId
): Promise<ControlledFullShellCommandResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewControlledFullCommand(commandId);
  }

  return invoke<ControlledFullShellCommandResult>("controlled_full_command", {
    commandId
  });
}

function hasTauriInvoke(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function createBrowserPreviewOverview(): WorkspaceOverview {
  return {
    root_name: "opencow",
    entry_count: 7,
    package_count: 0,
    package_names: [],
    summary: "Browser preview mode cannot inspect the real workspace and returns a mock overview."
  };
}

function createBrowserPreviewPackagesOverview(): WorkspacePackagesOverview {
  return {
    root_name: "opencow",
    package_count: 3,
    package_names: ["openclaw-adapter", "permission-engine", "shell-runtime"],
    total_script_count: 6,
    packages_with_scripts: ["openclaw-adapter", "permission-engine", "shell-runtime"],
    summary: "Browser preview mode returned a mock workspace package overview."
  };
}

function createBrowserPreviewConfigOverview(): WorkspaceConfigOverview {
  return {
    root_name: "opencow",
    config_files: ["package.json", "apps/desktop/package.json", "apps/desktop/src-tauri/Cargo.toml"],
    root_script_names: ["dev", "desktop:dev", "verify:all"],
    root_script_count: 3,
    package_manager_files: ["package-lock.json"],
    summary: "Browser preview mode returned a mock workspace config overview."
  };
}

function createBrowserPreviewProjectRunPreview(query: string): WorkspaceProjectRunPreview {
  const prefersCattle = /\bcattle\b/i.test(query);

  return {
    query,
    summary: prefersCattle
      ? "Browser preview mode matched a mock cattle project run preview."
      : "Browser preview mode matched a mock workspace project run preview.",
    inspected_project_count: 3,
    matched_project_name: prefersCattle ? "cattle" : "apps/desktop",
    matched_project_path: prefersCattle ? "projects/cattle" : "apps/desktop",
    matched_project_source: prefersCattle ? "unknown" : "apps",
    dev_command: prefersCattle ? "npm run dev" : "npm run desktop:dev",
    start_command: prefersCattle ? "npm run start" : "npm run dev",
    build_command: prefersCattle ? "npm run build" : "npm run build",
    preferred_command: prefersCattle ? "npm run dev" : "npm run desktop:dev",
    expected_url: prefersCattle ? "http://127.0.0.1:3000" : "http://127.0.0.1:1420",
    next_required_permission: "workspace-write",
    risk_summary:
      "Readonly preview only. Actual local launch must still request permission, stay inside the approved workspace, and write an audit trail.",
    candidate_projects: [
      {
        name: prefersCattle ? "cattle" : "apps/desktop",
        path: prefersCattle ? "projects/cattle" : "apps/desktop",
        source: prefersCattle ? "unknown" : "apps",
        script_names: ["dev", "start", "build"]
      },
      {
        name: "openclaw-adapter",
        path: "packages/openclaw-adapter",
        source: "packages",
        script_names: ["build", "test"]
      },
      {
        name: "permission-engine",
        path: "packages/permission-engine",
        source: "packages",
        script_names: ["build", "test"]
      }
    ]
  };
}

function createBrowserPreviewReadonlyCommand(commandId: ReadonlyShellCommandId): ReadonlyShellCommandResult {
  if (commandId === "git-status") {
    return {
      command_id: "git-status",
      command_label: "git status --short",
      stdout_preview: " M apps/desktop/src/app/App.tsx",
      line_count: 1,
      summary: "Browser preview mode returned a mock readonly shell result."
    };
  }

  if (commandId === "workspace-root-list") {
    return {
      command_id: "workspace-root-list",
      command_label: "Get-ChildItem -Name",
      stdout_preview: "apps\ndocs\npackages",
      line_count: 3,
      summary: "Browser preview mode returned a mock readonly shell result."
    };
  }

  return {
    command_id: "packages-dir-list",
    command_label: "Get-ChildItem packages -Name",
    stdout_preview: "openclaw-adapter\npermission-engine\nshell-runtime",
    line_count: 3,
    summary: "Browser preview mode returned a mock readonly shell result."
  };
}

function createBrowserPreviewWorkspaceWriteCommand(
  commandId: WorkspaceWriteShellCommandId
): WorkspaceWriteShellCommandResult {
  return {
    command_id: commandId,
    command_label: "New-Item -ItemType Directory -Force temp-output",
    stdout_preview: "temp-output",
    line_count: 1,
    summary: "Browser preview mode returned a mock workspace-write shell result."
  };
}

function createBrowserPreviewControlledFullCommand(
  commandId: ControlledFullShellCommandId
): ControlledFullShellCommandResult {
  return {
    command_id: commandId,
    command_label: "Remove-Item -LiteralPath temp-output -Recurse -Force",
    stdout_preview: "temp-output removed",
    line_count: 1,
    summary: "Browser preview mode returned a mock controlled-full shell result."
  };
}

function createBrowserPreviewWorkspaceProjectRun(query: string): WorkspaceProjectRunResult {
  const prefersDesktop = /\bdesktop\b/i.test(query) || /\bapp\b/i.test(query);

  return {
    project_name: prefersDesktop ? "desktop" : "workspace-project",
    project_path: prefersDesktop ? "apps/desktop" : "apps/example",
    command_label: "npm run dev",
    working_directory: prefersDesktop ? "apps/desktop" : "apps/example",
    expected_url: prefersDesktop ? "http://127.0.0.1:1420" : "http://127.0.0.1:3000",
    pid: 4242,
    stdout_preview: "browser preview mode started a mock workspace project process",
    summary: "Browser preview mode returned a mock workspace project run result."
  };
}

function createBrowserPreviewWorkspaceProjectStatus(query: string): WorkspaceProjectStatusResult {
  const prefersDesktop = /\bdesktop\b/i.test(query) || /\bapp\b/i.test(query);

  return {
    project_name: prefersDesktop ? "desktop" : "workspace-project",
    project_path: prefersDesktop ? "apps/desktop" : "apps/example",
    command_label: "npm run dev",
    working_directory: prefersDesktop ? "apps/desktop" : "apps/example",
    expected_url: prefersDesktop ? "http://127.0.0.1:1420" : "http://127.0.0.1:3000",
    pid: 4242,
    status: "running",
    stdout_preview: "pid:4242",
    summary: "Browser preview mode found a mock active workspace project process handle."
  };
}

function createBrowserPreviewWorkspaceProjectStop(query: string): WorkspaceProjectStopResult {
  const prefersDesktop = /\bdesktop\b/i.test(query) || /\bapp\b/i.test(query);

  return {
    project_name: prefersDesktop ? "desktop" : "workspace-project",
    project_path: prefersDesktop ? "apps/desktop" : "apps/example",
    command_label: "npm run dev",
    working_directory: prefersDesktop ? "apps/desktop" : "apps/example",
    pid: 4242,
    status: "stopped",
    stdout_preview: "browser preview mode stopped a mock workspace project process",
    summary: "Browser preview mode returned a mock workspace project stop result."
  };
}

function createBrowserPreviewNpcProjectScreenshotCapture(
  query: string
): WorkspaceProjectNpcScreenshotCaptureResult {
  const prefersCattle = /\bcattle\b/i.test(query);

  return {
    project_name: prefersCattle ? "cattle" : "desktop",
    project_path: prefersCattle ? "projects/cattle" : "apps/desktop",
    expected_url: prefersCattle ? "http://127.0.0.1:3000" : "http://127.0.0.1:1420",
    artifact_path: prefersCattle
      ? ".opencow/artifacts/npc-showcase/cattle-screenshot-browser-preview.png"
      : ".opencow/artifacts/npc-showcase/desktop-screenshot-browser-preview.png",
    artifact_directory: ".opencow/artifacts/npc-showcase",
    capture_target: prefersCattle ? "http://127.0.0.1:3000" : "http://127.0.0.1:1420",
    summary: "Browser preview mode returned a mock NPC local project screenshot capture result."
  };
}

function createBrowserPreviewCapabilityOverview(capabilityId: OpenClawCapabilityId): OpenClawCapabilityOverview {
  const previews: Record<OpenClawCapabilityId, Omit<OpenClawCapabilityOverview, "capability_id">> = {
    rag: {
      title: "OpenClaw RAG capability overview",
      status: "ready-foundation",
      required_package_count: 3,
      available_package_count: 3,
      available_packages: ["@openclaw/llm-core", "@openclaw/llm-runtime", "@openclaw/model-catalog-core"],
      missing_packages: [],
      summary: "Browser preview mode returned a mock OpenClaw RAG capability overview."
    },
    skills: {
      title: "OpenClaw Skills capability overview",
      status: "ready-foundation",
      required_package_count: 2,
      available_package_count: 2,
      available_packages: ["@openclaw/plugin-sdk", "@openclaw/tool-call-repair"],
      missing_packages: [],
      summary: "Browser preview mode returned a mock OpenClaw Skills capability overview."
    },
    npc: {
      title: "OpenClaw NPC capability overview",
      status: "ready-foundation",
      required_package_count: 3,
      available_package_count: 3,
      available_packages: ["@openclaw/llm-core", "@openclaw/llm-runtime", "@openclaw/tool-call-repair"],
      missing_packages: [],
      summary: "Browser preview mode returned a mock OpenClaw NPC capability overview."
    },
    mcp: {
      title: "OpenClaw MCP capability overview",
      status: "ready-foundation",
      required_package_count: 3,
      available_package_count: 3,
      available_packages: ["@openclaw/plugin-sdk", "@openclaw/terminal-core", "@openclaw/tool-call-repair"],
      missing_packages: [],
      summary: "Browser preview mode returned a mock OpenClaw MCP capability overview."
    }
  };

  return {
    capability_id: capabilityId,
    ...previews[capabilityId]
  };
}

function createBrowserPreviewLocalKnowledgeSearch(query: string): LocalKnowledgeSearchResult {
  return {
    query,
    summary: "Browser preview mode returned 2 matching passages across 7 indexed documents.",
    match_count: 2,
    indexed_document_count: 7,
    items: [
      {
        path: "docs/v1.0/04-permission-safety-shell.md",
        title: "04-permission-safety-shell.md",
        snippet: "Shell execution must include permission checks, confirmation, audit logs, timeout, and working-directory limits.",
        score: 42
      },
      {
        path: "OPENCOW_CORE_RULES.md",
        title: "OPENCOW_CORE_RULES.md",
        snippet: "Permissions, shell, safety, logs, and rollback are core safety paths.",
        score: 27
      }
    ]
  };
}

function createBrowserPreviewLocalSkillScan(): LocalSkillScanResult {
  return {
    summary: "Browser preview mode found 3 local skills across 2 scanned roots.",
    total_count: 3,
    scanned_root_count: 2,
    items: [
      {
        name: "coding-agent",
        path: "vendor/openclaw/skills/coding-agent/SKILL.md",
        source: "vendor-openclaw-skill",
        description: "OpenClaw coding agent workflow",
        enabled: true
      },
      {
        name: "browser-automation",
        path: "vendor/openclaw/extensions/browser/skills/browser-automation/SKILL.md",
        source: "vendor-openclaw-extension-skill",
        description: "OpenClaw browser automation skill",
        enabled: false
      },
      {
        name: "diffs",
        path: "vendor/openclaw/extensions/diffs/skills/diffs/SKILL.md",
        source: "vendor-openclaw-extension-skill",
        description: "OpenClaw diffs review skill",
        enabled: false
      }
    ]
  };
}

function createBrowserPreviewLocalSkillInspect(query: string): LocalSkillInspectResult {
  return {
    query,
    summary: "Browser preview mode found 1 matching skill across 2 scanned roots.",
    match_count: 1,
    scanned_root_count: 2,
    items: [
      {
        name: "coding-agent",
        path: "vendor/openclaw/skills/coding-agent/SKILL.md",
        source: "vendor-openclaw-skill",
        description: "OpenClaw coding agent workflow",
        content_preview: "Use this skill when implementing focused coding tasks with tight repo context.",
        enabled: true
      }
    ]
  };
}

function createBrowserPreviewLocalSkillEnable(query: string): LocalSkillEnableResult {
  return {
    query,
    enabled_skill_name: "coding-agent",
    registry_path: ".opencow/skills/enabled-skills.json",
    status: "enabled",
    summary: "Browser preview mode registered coding-agent in the workspace skill registry."
  };
}

function createBrowserPreviewLocalSkillInstall(query: string): LocalSkillInstallResult {
  return {
    query,
    installed_skill_name: "gpt-taste",
    installed_skill_path: "skills/gpt-taste/SKILL.md",
    source_skill_path: "vendor/openclaw/skills/gpt-taste/SKILL.md",
    status: "installed",
    summary: "Browser preview mode copied gpt-taste into the workspace skills directory."
  };
}

function createBrowserPreviewLocalSkillDisable(query: string): LocalSkillDisableResult {
  return {
    query,
    disabled_skill_name: "coding-agent",
    registry_path: ".opencow/skills/enabled-skills.json",
    status: "disabled",
    summary: "Browser preview mode removed coding-agent from the workspace skill registry."
  };
}

function createBrowserPreviewOpencowEnabledSkillsRegistryRepair(
  query: string
): OpencowSelfRepairEnabledSkillsRegistryResult {
  return {
    query,
    repair_target: "enabled-skills-registry",
    repaired_path: ".opencow/skills/enabled-skills.json",
    status: "repaired",
    preserved_entry_count: 0,
    verified_version: 1,
    verified_entry_count: 0,
    summary: "Browser preview mode rewrote the workspace enabled skills registry to the default verified schema."
  };
}

function createBrowserPreviewEnabledLocalSkills(): EnabledLocalSkillsResult {
  return {
    summary: "Browser preview mode found 1 enabled local skill entry in the workspace registry.",
    total_count: 1,
    registry_path: ".opencow/skills/enabled-skills.json",
    items: [
      {
        name: "coding-agent",
        path: "vendor/openclaw/skills/coding-agent/SKILL.md",
        source: "vendor-openclaw-skill",
        description: "OpenClaw coding agent workflow"
      }
    ]
  };
}

function createBrowserPreviewEnabledLocalSkillMatch(query: string): EnabledLocalSkillMatchResult {
  const normalizedQuery = query.toLowerCase();
  const prefersShellAutomation =
    normalizedQuery.includes("shell") || normalizedQuery.includes("automation");
  const recommendedSkill = prefersShellAutomation
    ? {
        name: "shell-automation",
        path: "skills/shell-automation/SKILL.md",
        source: "workspace-skill",
        description: "Run safe local shell automation tasks.",
        content_preview: "Use this skill when the task needs shell automation with local safety rails."
      }
    : {
        name: "coding-agent",
        path: "vendor/openclaw/skills/coding-agent/SKILL.md",
        source: "vendor-openclaw-skill",
        description: "OpenClaw coding agent workflow",
        content_preview: "Use this skill when implementing focused coding tasks with tight repo context."
      };

  return {
    query,
    summary: "Browser preview mode found 1 recommended enabled skill across 1 enabled entry.",
    registry_path: ".opencow/skills/enabled-skills.json",
    enabled_skill_count: 1,
    match_count: 1,
    items: [recommendedSkill]
  };
}

function createBrowserPreviewLocalMcpPluginScan(): LocalMcpPluginScanResult {
  return {
    summary: "Browser preview mode found 2 local MCP-adjacent plugin entries across 2 scanned roots.",
    total_count: 2,
    scanned_root_count: 2,
    items: [
      {
        id: "browser",
        path: "vendor/openclaw/extensions/browser/openclaw.plugin.json",
        source: "vendor-openclaw-extension-plugin",
        activation: "startup",
        tool_count: 1,
        skill_count: 1
      },
      {
        id: "codex-supervisor",
        path: "vendor/openclaw/extensions/codex-supervisor/openclaw.plugin.json",
        source: "vendor-openclaw-extension-plugin",
        activation: "manual",
        tool_count: 5,
        skill_count: 0
      }
    ]
  };
}

function createBrowserPreviewLocalMcpPluginInspect(query: string): LocalMcpPluginInspectResult {
  return {
    query,
    summary: "Browser preview mode found 1 matching local MCP plugin across 2 scanned roots.",
    match_count: 1,
    scanned_root_count: 2,
    items: [
      {
        id: "browser",
        path: "vendor/openclaw/extensions/browser/openclaw.plugin.json",
        source: "vendor-openclaw-extension-plugin",
        activation: "startup",
        tool_count: 1,
        skill_count: 1,
        description: "Browser automation plugin entry.",
        tool_names: ["browser"],
        skill_paths: ["./skills"]
      }
    ]
  };
}

function createBrowserPreviewLocalMcpPluginStartPreview(query: string): LocalMcpPluginStartPreviewResult {
  return {
    query,
    summary: "Browser preview mode found 1 matching local MCP plugin start preview across 2 scanned roots.",
    match_count: 1,
    scanned_root_count: 2,
    items: [
      {
        id: "browser",
        path: "vendor/openclaw/extensions/browser/openclaw.plugin.json",
        source: "vendor-openclaw-extension-plugin",
        activation: "startup",
        startup_allowed: true,
        command_preview: "npx openclaw-extension-browser",
        working_directory: "vendor/openclaw/extensions/browser",
        risk_summary: "Preview only. Actual MCP plugin launch is not enabled in this slice.",
        requires_config: false,
        config_hint: "No required config schema fields were detected."
      }
    ]
  };
}

function createBrowserPreviewLocalMcpPluginStart(query: string): LocalMcpPluginStartResult {
  return {
    plugin_id: query.toLowerCase().includes("browser") ? "browser" : "plugin",
    command_label: "npx openclaw-extension-browser",
    working_directory: "vendor/openclaw/extensions/browser",
    stdout_preview: "browser plugin start simulated",
    line_count: 1,
    summary: "Browser preview mode simulated a controlled local MCP plugin start."
  };
}
