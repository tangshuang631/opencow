import { invoke } from "@tauri-apps/api/core";

export type WorkspaceOverview = {
  root_name: string;
  root_path: string;
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

export type NpcConfigWriteResult = {
  npc_name: string;
  config_path: string;
  status: "saved";
  summary: string;
};

export type RollbackContext = {
  conversationId: string;
  rollbackEntryId: string;
};

export type RollbackFilesRestoreResult = {
  restoredPathCount: number;
  prunedSnapshotCount: number;
};

export type NpcWorkspaceConfig = {
  id: string;
  name: string;
  description: string;
  defaultModel: string;
  personaTitle?: string;
  personaPrompt: string;
  outputStyle: string;
  agentDraft: string;
  rulesDraft: string;
  enabledSkillNames: string[];
  knowledgeLibraryIds: string[];
  updatedAt?: string;
};

export type NpcWorkspaceResult = {
  summary: string;
  selectedNpcId: string | null;
  items: NpcWorkspaceConfig[];
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
  name: string;
  path: string;
  source: string;
  description: string;
  activation: string;
  tool_count: number;
  skill_count: number;
  status: "installed" | "running" | "stopped";
  supported: boolean;
};

export type RecommendedMcpManifestResult = {
  summary: string;
  total_count: number;
  items: Array<{
    id: string;
    name: string;
    description: string;
    source: string;
    install_query: string;
    rationale?: string;
    supported: boolean;
  }>;
};

export type LocalKnowledgeSearchResult = {
  query: string;
  summary: string;
  provider?: "ollama-embedding" | "keyword-fallback";
  fallback_reason?: string | null;
  match_count: number;
  indexed_document_count: number;
  items: Array<{
    path: string;
    title: string;
    snippet: string;
    score: number;
  }>;
};

export type LocalNetworkSearchResult = {
  query: string;
  provider: string;
  effective_provider: string;
  used_fallback: boolean;
  fallback_reason?: string | null;
  items: Array<{
    title: string;
    url: string;
    source_label?: string;
    summary: string;
  }>;
};

export type KnowledgeInventoryResult = {
  importedFiles: Array<{
    path: string;
    title: string;
    status: "ready" | "missing";
  }>;
  availableFiles: Array<{
    path: string;
    title: string;
  }>;
  indexedDocumentCount: number;
  registryPath: string;
  summary: string;
  activeLibraryId?: string;
  activeLibraryLabel?: string;
  libraries?: Array<{
    id: string;
    label: string;
    description?: string;
    documentCount?: number;
  }>;
};

type DesktopKnowledgeInventoryResult = {
  imported_files: Array<{
    path: string;
    title: string;
    status: "ready" | "missing";
  }>;
  available_files: Array<{
    path: string;
    title: string;
  }>;
  indexed_document_count: number;
  registry_path: string;
  summary: string;
  active_library_id?: string;
  active_library_label?: string;
  libraries?: Array<{
    id: string;
    label: string;
    description?: string;
    document_count?: number;
  }>;
};

type DesktopNpcWorkspaceConfig = {
  id: string;
  name: string;
  description?: string;
  default_model?: string;
  persona_title?: string;
  persona_prompt?: string;
  output_style?: string;
  agent_draft?: string;
  rules_draft?: string;
  enabled_skill_names?: string[];
  knowledge_library_ids?: string[];
  updated_at?: string;
};

type DesktopNpcWorkspaceResult = {
  summary: string;
  selected_npc_id?: string | null;
  items: DesktopNpcWorkspaceConfig[];
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

export type RecommendedSkillManifestResult = {
  summary: string;
  total_count: number;
  items: Array<{
    name: string;
    description: string;
    source: string;
    install_query: string;
    rationale?: string;
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

export type OpencowSelfRepairWorkspaceProjectRuntimeRegistryResult = {
  query: string;
  repair_target: "workspace-project-runtime-registry";
  repaired_path: string;
  status: "repaired";
  preserved_entry_count: number;
  verified_version: number;
  verified_run_count: number;
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

export type LocalMcpPluginInstallResult = {
  query: string;
  installed_plugin_id: string;
  installed_plugin_name: string;
  installed_plugin_path: string;
  source_plugin_path: string;
  status: "installed" | "already-installed";
  summary: string;
};

export type LocalMcpPluginUninstallResult = {
  query: string;
  removed_plugin_id: string;
  removed_plugin_name: string;
  removed_plugin_path: string;
  status: "removed" | "not-installed";
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
  preview_only?: boolean;
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
  preview_only?: boolean;
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
  preview_only?: boolean;
};

export type WorkspaceProjectNpcScreenshotCaptureResult = {
  project_name: string;
  project_path: string;
  expected_url: string | null;
  artifact_path: string;
  artifact_directory: string;
  capture_target: string;
  summary: string;
  preview_only?: boolean;
};

export type WorkspaceProjectNpcShowcaseSiteWriteResult = {
  project_name: string;
  project_path: string;
  site_root: string;
  entry_file: string;
  changed_paths: string[];
  source_screenshot_path: string;
  summary: string;
  preview_only?: boolean;
};

export type WorkspaceProjectNpcShowcasePublishPreviewResult = {
  project_name: string;
  project_path: string;
  site_root: string;
  entry_file: string;
  changed_paths: string[];
  source_screenshot_path: string;
  next_git_step: string;
  summary: string;
  preview_only?: boolean;
};

export type WorkspaceProjectNpcShowcaseGitConfirmationPreviewResult = {
  project_name: string;
  project_path: string;
  site_root: string;
  entry_file: string;
  changed_paths: string[];
  source_screenshot_path: string;
  recommended_git_action: "commit" | "push";
  required_confirmation_stage: string;
  summary: string;
  preview_only?: boolean;
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

export async function searchLocalKnowledge(
  query: string,
  options?: {
    libraryId?: string;
  }
): Promise<LocalKnowledgeSearchResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewLocalKnowledgeSearch(query);
  }

  return invoke<LocalKnowledgeSearchResult>("local_knowledge_search", {
    query,
    libraryId: options?.libraryId
  });
}

export async function searchNetwork(
  query: string,
  options?: {
    providerLabel?: string;
    baseUrl?: string;
    apiKey?: string;
    suppressFallbackNotice?: boolean;
  }
): Promise<LocalNetworkSearchResult> {
  if (hasTauriInvoke()) {
    return invoke<LocalNetworkSearchResult>("network_search", {
      payload: {
        query,
        providerLabel: options?.providerLabel,
        baseUrl: options?.baseUrl,
        apiKey: options?.apiKey
      }
    });
  }

  return createBrowserPreviewNetworkSearch(query, options);
}

export async function loadKnowledgeInventory(
  options?: {
    libraryId?: string;
  }
): Promise<KnowledgeInventoryResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewKnowledgeInventory();
  }

  return normalizeDesktopKnowledgeInventory(await invoke<DesktopKnowledgeInventoryResult>("knowledge_inventory", {
    libraryId: options?.libraryId
  }));
}

export async function importKnowledgeFile(
  path: string,
  libraryId?: string,
  rollbackContext?: RollbackContext
): Promise<KnowledgeInventoryResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewKnowledgeInventory();
  }

  return normalizeDesktopKnowledgeInventory(await invoke<DesktopKnowledgeInventoryResult>("knowledge_file_import", {
    path,
    libraryId,
    rollbackContext
  }));
}

export async function removeKnowledgeFile(
  path: string,
  libraryId?: string,
  rollbackContext?: RollbackContext
): Promise<KnowledgeInventoryResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewKnowledgeInventory();
  }

  return normalizeDesktopKnowledgeInventory(await invoke<DesktopKnowledgeInventoryResult>("knowledge_file_remove", {
    path,
    libraryId,
    rollbackContext
  }));
}

export async function clearKnowledgeImports(
  libraryId?: string,
  rollbackContext?: RollbackContext
): Promise<KnowledgeInventoryResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewKnowledgeInventory();
  }

  return normalizeDesktopKnowledgeInventory(await invoke<DesktopKnowledgeInventoryResult>("knowledge_imports_clear", {
    libraryId,
    rollbackContext
  }));
}

export async function createKnowledgeLibrary(
  name: string,
  description?: string,
  rollbackContext?: RollbackContext
): Promise<KnowledgeInventoryResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewKnowledgeInventory();
  }

  return normalizeDesktopKnowledgeInventory(await invoke<DesktopKnowledgeInventoryResult>("knowledge_library_create", {
    name,
    description,
    rollbackContext
  }));
}

export async function selectKnowledgeLibrary(libraryId: string): Promise<KnowledgeInventoryResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewKnowledgeInventory();
  }

  return normalizeDesktopKnowledgeInventory(await invoke<DesktopKnowledgeInventoryResult>("knowledge_library_select", {
    libraryId
  }));
}

export async function loadNpcWorkspace(): Promise<NpcWorkspaceResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewNpcWorkspace();
  }

  return normalizeDesktopNpcWorkspace(await invoke<DesktopNpcWorkspaceResult>("workspace_npc_configs_list"));
}

export async function loadNpcWorkspaceConfig(npcId: string): Promise<NpcWorkspaceConfig> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewNpcWorkspace({
      id: npcId
    }).items[0];
  }

  return normalizeDesktopNpcWorkspaceConfig(await invoke<DesktopNpcWorkspaceConfig>("workspace_npc_config_read", {
    npcId
  }));
}

export async function createNpcWorkspaceConfig(
  payload: NpcWorkspaceConfig,
  rollbackContext?: RollbackContext
): Promise<NpcWorkspaceResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewNpcWorkspace(payload);
  }

  return normalizeDesktopNpcWorkspace(await invoke<DesktopNpcWorkspaceResult>("workspace_npc_config_create", {
    payload: {
      payload: {
        id: payload.id,
        name: payload.name,
        description: payload.description,
        default_model: payload.defaultModel,
        persona_title: payload.personaTitle ?? "",
        persona_prompt: payload.personaPrompt,
        output_style: payload.outputStyle,
        agent_draft: payload.agentDraft,
        rules_draft: payload.rulesDraft,
        enabled_skill_names: payload.enabledSkillNames,
        knowledge_library_ids: payload.knowledgeLibraryIds
      },
      rollbackContext: rollbackContext ?? null
    }
  }));
}

export async function updateNpcWorkspaceConfig(
  payload: NpcWorkspaceConfig,
  rollbackContext?: RollbackContext
): Promise<NpcWorkspaceResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewNpcWorkspace(payload);
  }

  return normalizeDesktopNpcWorkspace(await invoke<DesktopNpcWorkspaceResult>("workspace_npc_config_update", {
    payload: {
      payload: {
        id: payload.id,
        name: payload.name,
        description: payload.description,
        default_model: payload.defaultModel,
        persona_title: payload.personaTitle ?? "",
        persona_prompt: payload.personaPrompt,
        output_style: payload.outputStyle,
        agent_draft: payload.agentDraft,
        rules_draft: payload.rulesDraft,
        enabled_skill_names: payload.enabledSkillNames,
        knowledge_library_ids: payload.knowledgeLibraryIds
      },
      rollbackContext: rollbackContext ?? null
    }
  }));
}

export async function scanLocalSkills(): Promise<LocalSkillScanResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewLocalSkillScan();
  }

  return invoke<LocalSkillScanResult>("local_skill_scan");
}

export async function loadRecommendedSkillManifest(): Promise<RecommendedSkillManifestResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewRecommendedSkillManifest();
  }

  return invoke<RecommendedSkillManifestResult>("recommended_skill_manifest");
}

export async function inspectLocalSkill(query: string): Promise<LocalSkillInspectResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewLocalSkillInspect(query);
  }

  return invoke<LocalSkillInspectResult>("local_skill_inspect", {
    query
  });
}

export async function enableLocalSkill(query: string, rollbackContext?: RollbackContext): Promise<LocalSkillEnableResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewLocalSkillEnable(query);
  }

  return invoke<LocalSkillEnableResult>("local_skill_enable", {
    query,
    rollbackContext
  });
}

export async function installLocalSkill(query: string, rollbackContext?: RollbackContext): Promise<LocalSkillInstallResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewLocalSkillInstall(query);
  }

  return invoke<LocalSkillInstallResult>("local_skill_install", {
    query,
    rollbackContext
  });
}

export async function disableLocalSkill(query: string, rollbackContext?: RollbackContext): Promise<LocalSkillDisableResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewLocalSkillDisable(query);
  }

  return invoke<LocalSkillDisableResult>("local_skill_disable", {
    query,
    rollbackContext
  });
}

export async function repairOpencowEnabledSkillsRegistry(
  query: string,
  rollbackContext?: RollbackContext
): Promise<OpencowSelfRepairEnabledSkillsRegistryResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewOpencowEnabledSkillsRegistryRepair(query);
  }

  return invoke<OpencowSelfRepairEnabledSkillsRegistryResult>("opencow_self_repair_enabled_skills_registry", {
    query,
    rollbackContext
  });
}

export async function repairOpencowWorkspaceProjectRuntimeRegistry(
  query: string,
  rollbackContext?: RollbackContext
): Promise<OpencowSelfRepairWorkspaceProjectRuntimeRegistryResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewOpencowWorkspaceProjectRuntimeRegistryRepair(query);
  }

  return invoke<OpencowSelfRepairWorkspaceProjectRuntimeRegistryResult>(
    "opencow_self_repair_workspace_project_runtime_registry",
    {
      query,
      rollbackContext
    }
  );
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

export async function loadRecommendedMcpManifest(): Promise<RecommendedMcpManifestResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewRecommendedMcpManifest();
  }

  return invoke<RecommendedMcpManifestResult>("recommended_mcp_manifest");
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

export async function installLocalMcpPlugin(
  query: string,
  rollbackContext?: RollbackContext
): Promise<LocalMcpPluginInstallResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewLocalMcpPluginInstall(query);
  }

  return invoke<LocalMcpPluginInstallResult>("local_mcp_plugin_install", {
    query,
    rollbackContext
  });
}

export async function uninstallLocalMcpPlugin(
  query: string,
  rollbackContext?: RollbackContext
): Promise<LocalMcpPluginUninstallResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewLocalMcpPluginUninstall(query);
  }

  return invoke<LocalMcpPluginUninstallResult>("local_mcp_plugin_uninstall", {
    query,
    rollbackContext
  });
}

export async function loadOpenClawCapabilityOverview(
  capabilityId: OpenClawCapabilityId
): Promise<OpenClawCapabilityOverview> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewCapabilityOverview(capabilityId);
  }

  return invoke<OpenClawCapabilityOverview>("openclaw_capability_overview", {
    capability_id: capabilityId
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

export async function writeNpcConfig(payload: {
  query: string;
  modelOutput: string;
  config: Record<string, unknown>;
  rollbackContext?: RollbackContext;
}): Promise<NpcConfigWriteResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewNpcConfigWrite(payload);
  }

  return invoke<NpcConfigWriteResult>("workspace_npc_config_write", {
    payload
  });
}

export async function runReadonlyShellCommand(commandId: ReadonlyShellCommandId): Promise<ReadonlyShellCommandResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewReadonlyCommand(commandId);
  }

  return invoke<ReadonlyShellCommandResult>("workspace_readonly_command", {
    command_id: commandId
  });
}

export async function runWorkspaceWriteShellCommand(
  commandId: WorkspaceWriteShellCommandId,
  rollbackContext?: RollbackContext
): Promise<WorkspaceWriteShellCommandResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewWorkspaceWriteCommand(commandId);
  }

  return invoke<WorkspaceWriteShellCommandResult>("workspace_write_command", {
    command_id: commandId,
    rollbackContext
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

export async function writeNpcLocalProjectShowcaseSite(
  query: string,
  rollbackContext?: RollbackContext
): Promise<WorkspaceProjectNpcShowcaseSiteWriteResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewNpcProjectShowcaseSiteWrite(query);
  }

  return invoke<WorkspaceProjectNpcShowcaseSiteWriteResult>("workspace_project_npc_showcase_site_write", {
    query,
    rollbackContext
  });
}

export async function loadNpcLocalProjectShowcasePublishPreview(
  query: string
): Promise<WorkspaceProjectNpcShowcasePublishPreviewResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewNpcProjectShowcasePublishPreview(query);
  }

  return invoke<WorkspaceProjectNpcShowcasePublishPreviewResult>(
    "workspace_project_npc_showcase_publish_preview",
    {
      query
    }
  );
}

export async function loadNpcLocalProjectShowcaseGitConfirmationPreview(
  query: string
): Promise<WorkspaceProjectNpcShowcaseGitConfirmationPreviewResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewNpcProjectShowcaseGitConfirmationPreview(query);
  }

  return invoke<WorkspaceProjectNpcShowcaseGitConfirmationPreviewResult>(
    "workspace_project_npc_showcase_git_confirmation_preview",
    {
      query
    }
  );
}

export async function runControlledFullShellCommand(
  commandId: ControlledFullShellCommandId,
  rollbackContext?: RollbackContext
): Promise<ControlledFullShellCommandResult> {
  if (!hasTauriInvoke()) {
    return createBrowserPreviewControlledFullCommand(commandId);
  }

  return invoke<ControlledFullShellCommandResult>("controlled_full_command", {
    command_id: commandId,
    rollbackContext
  });
}

export async function restoreRollbackFiles(payload: RollbackContext): Promise<RollbackFilesRestoreResult> {
  if (!hasTauriInvoke()) {
    return {
      restoredPathCount: 0,
      prunedSnapshotCount: 0
    };
  }

  return invoke<RollbackFilesRestoreResult>("rollback_files_restore", {
    payload: {
      conversationId: payload.conversationId,
      targetEntryId: payload.rollbackEntryId
    }
  });
}

function hasTauriInvoke(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function createBrowserPreviewOverview(): WorkspaceOverview {
  return {
    root_name: "opencow",
    root_path: "E:\\2026\\opencow",
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
    summary: "Browser preview mode returned a static workspace package overview preview."
  };
}

function createBrowserPreviewConfigOverview(): WorkspaceConfigOverview {
  return {
    root_name: "opencow",
    config_files: ["package.json", "apps/desktop/package.json", "apps/desktop/src-tauri/Cargo.toml"],
    root_script_names: ["dev", "desktop:dev", "verify:all"],
    root_script_count: 3,
    package_manager_files: ["package-lock.json"],
    summary: "Browser preview mode returned a static workspace config overview preview."
  };
}

function createBrowserPreviewProjectRunPreview(query: string): WorkspaceProjectRunPreview {
  const prefersCattle = /\bcattle\b/i.test(query);

  return {
    query,
    summary: prefersCattle
      ? "Browser preview mode matched a static cattle project run preview."
      : "Browser preview mode matched a static workspace project run preview.",
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

function createBrowserPreviewKnowledgeInventory(): KnowledgeInventoryResult {
  return {
    importedFiles: [],
    availableFiles: [],
    indexedDocumentCount: 0,
    registryPath: ".opencow/knowledge/imported-files.json",
    summary: "Browser preview mode cannot inspect the real knowledge inventory and returns an empty preview.",
    activeLibraryId: "default-library",
    activeLibraryLabel: "默认知识库",
    libraries: [
      {
        id: "default-library",
        label: "默认知识库"
      }
    ]
  };
}

function normalizeDesktopKnowledgeInventory(
  result: DesktopKnowledgeInventoryResult | KnowledgeInventoryResult
): KnowledgeInventoryResult {
  if ("importedFiles" in result) {
    return result;
  }

  return {
    importedFiles: result.imported_files,
    availableFiles: result.available_files,
    indexedDocumentCount: result.indexed_document_count,
    registryPath: result.registry_path,
    summary: result.summary,
    activeLibraryId: result.active_library_id,
    activeLibraryLabel: result.active_library_label,
    libraries: result.libraries?.map((library) => ({
      id: library.id,
      label: library.label,
      description: library.description,
      documentCount: library.document_count
    }))
  };
}

function normalizeDesktopNpcWorkspace(
  result: DesktopNpcWorkspaceResult | NpcWorkspaceResult
): NpcWorkspaceResult {
  if ("selectedNpcId" in result) {
    return result;
  }

  return {
    summary: result.summary,
    selectedNpcId: result.selected_npc_id ?? null,
    items: (result.items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description ?? "",
      defaultModel: item.default_model ?? "",
      personaTitle: item.persona_title ?? "",
      personaPrompt: item.persona_prompt ?? "",
      outputStyle: item.output_style ?? "",
      agentDraft: item.agent_draft ?? "",
      rulesDraft: item.rules_draft ?? "",
      enabledSkillNames: item.enabled_skill_names ?? [],
      knowledgeLibraryIds: item.knowledge_library_ids ?? [],
      updatedAt: item.updated_at
    }))
  };
}

function normalizeDesktopNpcWorkspaceConfig(
  item: DesktopNpcWorkspaceConfig | NpcWorkspaceConfig
): NpcWorkspaceConfig {
  if ("defaultModel" in item) {
    return item;
  }

  return {
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    defaultModel: item.default_model ?? "",
    personaTitle: item.persona_title ?? "",
    personaPrompt: item.persona_prompt ?? "",
    outputStyle: item.output_style ?? "",
    agentDraft: item.agent_draft ?? "",
    rulesDraft: item.rules_draft ?? "",
    enabledSkillNames: item.enabled_skill_names ?? [],
    knowledgeLibraryIds: item.knowledge_library_ids ?? [],
    updatedAt: item.updated_at
  };
}

function createBrowserPreviewNpcWorkspace(
  overrideItem?: Partial<NpcWorkspaceConfig>
): NpcWorkspaceResult {
  const item: NpcWorkspaceConfig = {
    id: overrideItem?.id ?? "research-bot",
    name: overrideItem?.name ?? "研究助手",
    description: overrideItem?.description ?? "负责资料整理",
    defaultModel: overrideItem?.defaultModel ?? "qwen2.5-coder:7b",
    personaTitle: overrideItem?.personaTitle ?? "资料研究员",
    personaPrompt: overrideItem?.personaPrompt ?? "你负责整理资料",
    outputStyle: overrideItem?.outputStyle ?? "简洁",
    agentDraft: overrideItem?.agentDraft ?? "",
    rulesDraft: overrideItem?.rulesDraft ?? "",
    enabledSkillNames: overrideItem?.enabledSkillNames ?? ["本地检索增强"],
    knowledgeLibraryIds: overrideItem?.knowledgeLibraryIds ?? ["default-library"],
    updatedAt: overrideItem?.updatedAt ?? "2026-06-19T10:00:00.000Z"
  };

  return {
    summary: "Browser preview NPC workspace loaded.",
    selectedNpcId: item.id,
    items: [item]
  };
}

function createBrowserPreviewNpcConfigWrite(payload: {
  query: string;
  modelOutput: string;
  config: Record<string, unknown>;
}): NpcConfigWriteResult {
  const npcName =
    typeof payload.config.name === "string" && payload.config.name.trim().length > 0
      ? payload.config.name.trim()
      : "custom-npc";

  return {
    npc_name: npcName,
    config_path: `.opencow/npcs/${npcName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "custom-npc"}.json`,
    status: "saved",
    summary: "Browser preview mode returned a browser-preview NPC config write result."
  };
}

function createBrowserPreviewReadonlyCommand(commandId: ReadonlyShellCommandId): ReadonlyShellCommandResult {
  if (commandId === "git-status") {
    return {
      command_id: "git-status",
      command_label: "git status --short",
      stdout_preview: " M apps/desktop/src/app/App.tsx",
      line_count: 1,
      summary: "Browser preview mode returned a browser-preview readonly shell result."
    };
  }

  if (commandId === "workspace-root-list") {
    return {
      command_id: "workspace-root-list",
      command_label: "Get-ChildItem -Name",
      stdout_preview: "apps\ndocs\npackages",
      line_count: 3,
      summary: "Browser preview mode returned a browser-preview readonly shell result."
    };
  }

  return {
    command_id: "packages-dir-list",
    command_label: "Get-ChildItem packages -Name",
    stdout_preview: "openclaw-adapter\npermission-engine\nshell-runtime",
    line_count: 3,
    summary: "Browser preview mode returned a browser-preview readonly shell result."
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
    summary: "Browser preview mode returned a browser-preview workspace-write shell result."
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
    summary: "Browser preview mode returned a browser-preview controlled-full shell result."
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
    pid: 0,
    stdout_preview:
      "browser preview mode did not launch a real workspace project process and only returned a readonly run preview",
    summary:
      "Browser preview mode did not execute a workspace project run and only returned a readonly launch preview.",
    preview_only: true
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
    pid: null,
    status: "stopped",
    stdout_preview:
      "browser preview mode cannot inspect a live workspace project process and only returned a readonly status preview",
    summary:
      "Browser preview mode did not inspect a real workspace project runtime handle and only returned a readonly status preview.",
    preview_only: true
  };
}

function createBrowserPreviewWorkspaceProjectStop(query: string): WorkspaceProjectStopResult {
  const prefersDesktop = /\bdesktop\b/i.test(query) || /\bapp\b/i.test(query);

  return {
    project_name: prefersDesktop ? "desktop" : "workspace-project",
    project_path: prefersDesktop ? "apps/desktop" : "apps/example",
    command_label: "npm run dev",
    working_directory: prefersDesktop ? "apps/desktop" : "apps/example",
    pid: 0,
    status: "stopped",
    stdout_preview:
      "browser preview mode did not stop a real workspace project process and only returned a readonly stop preview",
    summary:
      "Browser preview mode did not execute a workspace project stop and only returned a readonly stop preview.",
    preview_only: true
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
    summary:
      "Browser preview mode did not capture a real NPC local project screenshot and only returned a readonly artifact preview.",
    preview_only: true
  };
}

function createBrowserPreviewNpcProjectShowcaseSiteWrite(
  query: string
): WorkspaceProjectNpcShowcaseSiteWriteResult {
  const prefersCattle = /\bcattle\b/i.test(query);
  const projectName = prefersCattle ? "cattle" : "desktop";
  const siteRoot = `.opencow/artifacts/npc-showcase/sites/${projectName}`;
  const entryFile = `${siteRoot}/index.html`;

  return {
    project_name: projectName,
    project_path: prefersCattle ? "apps/cattle" : "apps/desktop",
    site_root: siteRoot,
    entry_file: entryFile,
    changed_paths: [entryFile],
    source_screenshot_path: prefersCattle
      ? ".opencow/artifacts/npc-showcase/cattle-screenshot-browser-preview.png"
      : ".opencow/artifacts/npc-showcase/desktop-screenshot-browser-preview.png",
    summary:
      "Browser preview mode did not write a real NPC local project showcase site and only returned a readonly changed-files preview.",
    preview_only: true
  };
}

function createBrowserPreviewNpcProjectShowcasePublishPreview(
  query: string
): WorkspaceProjectNpcShowcasePublishPreviewResult {
  const prefersCattle = /\bcattle\b/i.test(query);
  const projectName = prefersCattle ? "cattle" : "desktop";
  const siteRoot = `.opencow/artifacts/npc-showcase/sites/${projectName}`;
  const entryFile = `${siteRoot}/index.html`;

  return {
    project_name: projectName,
    project_path: prefersCattle ? "apps/cattle" : "apps/desktop",
    site_root: siteRoot,
    entry_file: entryFile,
    changed_paths: [entryFile],
    source_screenshot_path: prefersCattle
      ? ".opencow/artifacts/npc-showcase/cattle-screenshot-browser-preview.png"
      : ".opencow/artifacts/npc-showcase/desktop-screenshot-browser-preview.png",
    next_git_step: "Git commit or push is still separate and requires its own explicit confirmation stage.",
    summary:
      "Browser preview mode did not load real NPC local project showcase publish artifacts and only returned a readonly publish preview.",
    preview_only: true
  };
}

function createBrowserPreviewNpcProjectShowcaseGitConfirmationPreview(
  query: string
): WorkspaceProjectNpcShowcaseGitConfirmationPreviewResult {
  const prefersCattle = /\bcattle\b/i.test(query);
  const projectName = prefersCattle ? "cattle" : "desktop";
  const siteRoot = `.opencow/artifacts/npc-showcase/sites/${projectName}`;
  const entryFile = `${siteRoot}/index.html`;
  const recommended_git_action = /\bpush\b/i.test(query) ? "push" : "commit";

  return {
    project_name: projectName,
    project_path: prefersCattle ? "apps/cattle" : "apps/desktop",
    site_root: siteRoot,
    entry_file: entryFile,
    changed_paths: [entryFile],
    source_screenshot_path: prefersCattle
      ? ".opencow/artifacts/npc-showcase/cattle-screenshot-browser-preview.png"
      : ".opencow/artifacts/npc-showcase/desktop-screenshot-browser-preview.png",
    recommended_git_action,
    required_confirmation_stage: "Git commit or push still requires its own explicit confirmation and execution stage.",
    summary:
      "Browser preview mode did not inspect real NPC local project git-ready changes and only returned a readonly confirmation preview.",
    preview_only: true
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
      summary: "Browser preview mode returned a browser-preview OpenClaw RAG capability overview."
    },
    skills: {
      title: "OpenClaw Skills capability overview",
      status: "ready-foundation",
      required_package_count: 2,
      available_package_count: 2,
      available_packages: ["@openclaw/plugin-sdk", "@openclaw/tool-call-repair"],
      missing_packages: [],
      summary: "Browser preview mode returned a browser-preview OpenClaw Skills capability overview."
    },
    npc: {
      title: "OpenClaw NPC capability overview",
      status: "ready-foundation",
      required_package_count: 3,
      available_package_count: 3,
      available_packages: ["@openclaw/llm-core", "@openclaw/llm-runtime", "@openclaw/tool-call-repair"],
      missing_packages: [],
      summary: "Browser preview mode returned a browser-preview OpenClaw NPC capability overview."
    },
    mcp: {
      title: "OpenClaw MCP capability overview",
      status: "ready-foundation",
      required_package_count: 3,
      available_package_count: 3,
      available_packages: ["@openclaw/plugin-sdk", "@openclaw/terminal-core", "@openclaw/tool-call-repair"],
      missing_packages: [],
      summary: "Browser preview mode returned a browser-preview OpenClaw MCP capability overview."
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
    provider: "keyword-fallback",
    fallback_reason: "Browser preview mode does not start Ollama embedding, so deterministic keyword search is used.",
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

function createBrowserPreviewNetworkSearch(
  query: string,
  options?: {
    providerLabel?: string;
    baseUrl?: string;
    apiKey?: string;
    suppressFallbackNotice?: boolean;
  }
): LocalNetworkSearchResult {
  const customProvider = options?.providerLabel?.trim() || "";
  const shouldFallback = Boolean(customProvider && /fail|invalid|broken/i.test(customProvider));
  const provider = shouldFallback ? "OpenCow 默认搜索" : (customProvider || "OpenCow 默认搜索");

  return {
    query,
    provider,
    effective_provider: provider,
    used_fallback: shouldFallback,
    fallback_reason: shouldFallback ? "自定义搜索请求失败，已自动回退到 OpenCow 默认搜索。" : null,
    items: [
      {
        title: "Wikipedia",
        url: "https://zh.wikipedia.org/wiki/OpenCow",
        source_label: "Wikipedia",
        summary: `OpenCow 已为“${query}”返回可用网页资料示例。`
      },
      {
        title: "OpenCow 项目文档",
        url: "https://github.com/openai/opencow",
        source_label: "GitHub",
        summary: "默认搜索零配置可用；如用户已保存自定义 API，会优先尝试用户配置。"
      }
    ]
  };
}

function createBrowserPreviewLocalSkillScan(): LocalSkillScanResult {
  return {
    summary: "Browser preview mode found 0 installed OpenCow skills.",
    total_count: 0,
    scanned_root_count: 1,
    items: []
  };
}

function createBrowserPreviewRecommendedSkillManifest(): RecommendedSkillManifestResult {
  return {
    summary: "Browser preview mode loaded 3 recommended skills from the local OpenCow manifest.",
    total_count: 3,
    items: [
      {
        name: "网页自动化",
        description: "适合网页操作、登录检查和多步流程。",
        source: "opencow-manifest",
        install_query: "browser-automation"
      },
      {
        name: "文档整理",
        description: "适合整理说明文档、规则和知识条目。",
        source: "opencow-manifest",
        install_query: "docs-helper"
      },
      {
        name: "代码执行",
        description: "适合本地代码分析、修改和命令执行。",
        source: "opencow-manifest",
        install_query: "coding-agent"
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
    registry_path: "skills/enabled-skills.json",
    status: "enabled",
    summary: "Browser preview mode registered coding-agent in the OpenCow skill registry."
  };
}

function createBrowserPreviewLocalSkillInstall(query: string): LocalSkillInstallResult {
  return {
    query,
    installed_skill_name: "gpt-taste",
    installed_skill_path: "skills/installed/gpt-taste/SKILL.md",
    source_skill_path: "vendor/openclaw/skills/gpt-taste/SKILL.md",
    status: "installed",
    summary: "Browser preview mode copied gpt-taste into the OpenCow skills directory."
  };
}

function createBrowserPreviewLocalSkillDisable(query: string): LocalSkillDisableResult {
  return {
    query,
    disabled_skill_name: "coding-agent",
    registry_path: "skills/enabled-skills.json",
    status: "disabled",
    summary: "Browser preview mode removed coding-agent from the OpenCow skill registry."
  };
}

function createBrowserPreviewOpencowEnabledSkillsRegistryRepair(
  query: string
): OpencowSelfRepairEnabledSkillsRegistryResult {
  return {
    query,
    repair_target: "enabled-skills-registry",
    repaired_path: "skills/enabled-skills.json",
    status: "repaired",
    preserved_entry_count: 0,
    verified_version: 1,
    verified_entry_count: 0,
    summary: "Browser preview mode rewrote the OpenCow enabled skills registry to the default verified schema."
  };
}

function createBrowserPreviewOpencowWorkspaceProjectRuntimeRegistryRepair(
  query: string
): OpencowSelfRepairWorkspaceProjectRuntimeRegistryResult {
  return {
    query,
    repair_target: "workspace-project-runtime-registry",
    repaired_path: ".opencow/runtime/workspace-project-runs.json",
    status: "repaired",
    preserved_entry_count: 0,
    verified_version: 1,
    verified_run_count: 0,
    summary: "Browser preview mode rewrote the workspace project runtime registry to the default verified schema."
  };
}

function createBrowserPreviewEnabledLocalSkills(): EnabledLocalSkillsResult {
  return {
    summary: "Browser preview mode found 0 enabled OpenCow skills.",
    total_count: 0,
    registry_path: "skills/enabled-skills.json",
    items: []
  };
}

function createBrowserPreviewEnabledLocalSkillMatch(query: string): EnabledLocalSkillMatchResult {
  const normalizedQuery = query.toLowerCase();
  const prefersDocsHelper =
    normalizedQuery.includes("docs")
    || normalizedQuery.includes("rules")
    || normalizedQuery.includes("knowledge")
    || normalizedQuery.includes("rag")
    || normalizedQuery.includes("文档")
    || normalizedQuery.includes("规则")
    || normalizedQuery.includes("知识库");
  const prefersShellAutomation =
    normalizedQuery.includes("shell") || normalizedQuery.includes("automation");
  const recommendedSkill = prefersDocsHelper
    ? {
        name: "docs-helper",
        path: "skills/docs-helper/SKILL.md",
        source: "workspace-skill",
        description: "Search local docs and rules before action.",
        content_preview: "Use this skill when the task needs local docs, rules, and RAG-style guidance."
      }
    : prefersShellAutomation
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
    summary: "Browser preview mode found 1 installed MCP entry in the OpenCow product directory.",
    total_count: 1,
    scanned_root_count: 1,
    items: [
      {
        id: "browser",
        name: "浏览器控制",
        path: "mcp/installed/browser/openclaw.plugin.json",
        source: "opencow-installed-mcp",
        description: "用于浏览器联调、页面检查和点击操作。",
        activation: "startup",
        tool_count: 1,
        skill_count: 1,
        status: "stopped",
        supported: true
      }
    ]
  };
}

function createBrowserPreviewRecommendedMcpManifest(): RecommendedMcpManifestResult {
  return {
    summary: "Browser preview mode loaded 2 recommended MCP entries.",
    total_count: 2,
    items: [
      {
        id: "browser",
        name: "浏览器控制",
        description: "最适合 OpenCow 本地桌面端做页面联调、按钮点击和回归验证。",
        source: "opencow-builtin-manifest",
        install_query: "browser",
        rationale: "这是 OpenCow 当前最成熟、最常用的 MCP 类型之一。",
        supported: true
      },
      {
        id: "fetch",
        name: "网页读取",
        description: "适合后续补充网页内容抓取和结构化读取。",
        source: "opencow-builtin-manifest",
        install_query: "fetch",
        rationale: "先进入推荐清单，后续再补稳定宿主。",
        supported: false
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
        source: "opencow-installed-mcp",
        activation: "startup",
        tool_count: 1,
        skill_count: 1,
        description: "用于浏览器联调、页面检查和点击操作。",
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
        path: "mcp/installed/browser/openclaw.plugin.json",
        source: "opencow-installed-mcp",
        activation: "startup",
        startup_allowed: true,
        command_preview: "node vendor/openclaw/openclaw.mjs browser start",
        working_directory: "vendor/openclaw",
        risk_summary: "会尝试通过 OpenClaw browser CLI 启动浏览器控制服务；如果本地依赖缺失会返回明确诊断。",
        requires_config: false,
        config_hint: "建议先保证 OpenClaw browser 运行依赖完整。"
      }
    ]
  };
}

function createBrowserPreviewLocalMcpPluginStart(query: string): LocalMcpPluginStartResult {
  return {
    plugin_id: query.toLowerCase().includes("browser") ? "browser" : "plugin",
    command_label: "openclaw browser start",
    working_directory: "vendor/openclaw",
    stdout_preview: "Browser preview mode cannot launch native MCP processes, but the desktop command path is now wired.",
    line_count: 0,
    summary: "Browser preview mode only verifies the OpenCow MCP product flow."
  };
}

function createBrowserPreviewLocalMcpPluginInstall(query: string): LocalMcpPluginInstallResult {
  return {
    query,
    installed_plugin_id: "browser",
    installed_plugin_name: "浏览器控制",
    installed_plugin_path: "mcp/installed/browser/openclaw.plugin.json",
    source_plugin_path: "vendor/openclaw/extensions/browser/openclaw.plugin.json",
    status: "installed",
    summary: "Browser preview mode installed the browser MCP into the OpenCow product directory."
  };
}

function createBrowserPreviewLocalMcpPluginUninstall(query: string): LocalMcpPluginUninstallResult {
  return {
    query,
    removed_plugin_id: "browser",
    removed_plugin_name: "浏览器控制",
    removed_plugin_path: "mcp/installed/browser/openclaw.plugin.json",
    status: "removed",
    summary: "Browser preview mode removed the browser MCP from the OpenCow product directory."
  };
}
