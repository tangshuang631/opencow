use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Serialize)]
pub struct WorkspaceOverview {
    root_name: String,
    entry_count: usize,
    package_count: usize,
    package_names: Vec<String>,
    summary: String,
}

#[derive(Serialize)]
pub struct WorkspacePackagesOverview {
    root_name: String,
    package_count: usize,
    package_names: Vec<String>,
    total_script_count: usize,
    packages_with_scripts: Vec<String>,
    summary: String,
}

#[derive(Serialize)]
pub struct WorkspaceConfigOverview {
    root_name: String,
    config_files: Vec<String>,
    root_script_names: Vec<String>,
    root_script_count: usize,
    package_manager_files: Vec<String>,
    summary: String,
}

#[derive(Serialize)]
pub struct WorkspaceProjectRunPreview {
    query: String,
    summary: String,
    inspected_project_count: usize,
    matched_project_name: Option<String>,
    matched_project_path: Option<String>,
    matched_project_source: Option<String>,
    dev_command: Option<String>,
    start_command: Option<String>,
    build_command: Option<String>,
    preferred_command: Option<String>,
    expected_url: Option<String>,
    next_required_permission: String,
    risk_summary: String,
    candidate_projects: Vec<WorkspaceProjectRunCandidate>,
}

#[derive(Serialize)]
pub struct WorkspaceProjectRunResult {
    project_name: String,
    project_path: String,
    command_label: String,
    working_directory: String,
    expected_url: Option<String>,
    pid: u32,
    stdout_preview: String,
    summary: String,
}

#[derive(Serialize)]
pub struct WorkspaceProjectStatusResult {
    project_name: String,
    project_path: String,
    command_label: String,
    working_directory: String,
    expected_url: Option<String>,
    pid: Option<u32>,
    status: String,
    stdout_preview: String,
    summary: String,
}

#[derive(Serialize)]
pub struct WorkspaceProjectStopResult {
    project_name: String,
    project_path: String,
    command_label: String,
    working_directory: String,
    pid: u32,
    status: String,
    stdout_preview: String,
    summary: String,
}

#[derive(Serialize)]
pub struct WorkspaceProjectRunCandidate {
    name: String,
    path: String,
    source: String,
    script_names: Vec<String>,
}

struct WorkspaceProjectRunCandidateInternal {
    name: String,
    relative_path: String,
    source: String,
    script_names: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
struct WorkspaceProjectRuntimeRecord {
    project_name: String,
    project_path: String,
    command_label: String,
    working_directory: String,
    pid: u32,
}

#[derive(Serialize, Deserialize)]
struct WorkspaceProjectRuntimeRegistry {
    version: usize,
    runs: Vec<WorkspaceProjectRuntimeRecord>,
}

#[derive(Serialize)]
pub struct OpenClawCapabilityOverview {
    capability_id: String,
    title: String,
    status: String,
    required_package_count: usize,
    available_package_count: usize,
    available_packages: Vec<String>,
    missing_packages: Vec<String>,
    summary: String,
}

#[derive(Serialize)]
pub struct LocalMcpPluginScanResult {
    summary: String,
    total_count: usize,
    scanned_root_count: usize,
    items: Vec<LocalMcpPluginScanItem>,
}

#[derive(Serialize)]
pub struct LocalMcpPluginScanItem {
    id: String,
    path: String,
    source: String,
    activation: String,
    tool_count: usize,
    skill_count: usize,
}

#[derive(Serialize)]
pub struct LocalMcpPluginInspectResult {
    query: String,
    summary: String,
    match_count: usize,
    scanned_root_count: usize,
    items: Vec<LocalMcpPluginInspectItem>,
}

#[derive(Serialize)]
pub struct LocalMcpPluginInspectItem {
    id: String,
    path: String,
    source: String,
    activation: String,
    tool_count: usize,
    skill_count: usize,
    description: String,
    tool_names: Vec<String>,
    skill_paths: Vec<String>,
}

#[derive(Serialize)]
pub struct LocalMcpPluginStartPreviewResult {
    query: String,
    summary: String,
    match_count: usize,
    scanned_root_count: usize,
    items: Vec<LocalMcpPluginStartPreviewItem>,
}

#[derive(Serialize)]
pub struct LocalMcpPluginStartPreviewItem {
    id: String,
    path: String,
    source: String,
    activation: String,
    startup_allowed: bool,
    command_preview: String,
    working_directory: String,
    risk_summary: String,
    requires_config: bool,
    config_hint: String,
}

#[derive(Serialize)]
pub struct LocalMcpPluginStartResult {
    plugin_id: String,
    command_label: String,
    working_directory: String,
    stdout_preview: String,
    line_count: usize,
    summary: String,
}

#[derive(Serialize)]
pub struct LocalKnowledgeSearchResult {
    query: String,
    summary: String,
    match_count: usize,
    indexed_document_count: usize,
    items: Vec<LocalKnowledgeSearchItem>,
}

#[derive(Serialize)]
pub struct LocalKnowledgeSearchItem {
    path: String,
    title: String,
    snippet: String,
    score: usize,
}

#[derive(Serialize)]
pub struct LocalSkillScanResult {
    summary: String,
    total_count: usize,
    scanned_root_count: usize,
    items: Vec<LocalSkillScanItem>,
}

#[derive(Serialize)]
pub struct LocalSkillScanItem {
    name: String,
    path: String,
    source: String,
    description: String,
    enabled: bool,
}

#[derive(Serialize)]
pub struct LocalSkillInspectResult {
    query: String,
    summary: String,
    match_count: usize,
    scanned_root_count: usize,
    items: Vec<LocalSkillInspectItem>,
}

#[derive(Serialize)]
pub struct LocalSkillInspectItem {
    name: String,
    path: String,
    source: String,
    description: String,
    content_preview: String,
    enabled: bool,
}

#[derive(Serialize)]
pub struct LocalSkillEnableResult {
    query: String,
    enabled_skill_name: String,
    registry_path: String,
    status: String,
    summary: String,
}

#[derive(Serialize)]
pub struct LocalSkillInstallResult {
    query: String,
    installed_skill_name: String,
    installed_skill_path: String,
    source_skill_path: String,
    status: String,
    summary: String,
}

#[derive(Serialize)]
pub struct LocalSkillDisableResult {
    query: String,
    disabled_skill_name: String,
    registry_path: String,
    status: String,
    summary: String,
}

#[derive(Serialize)]
pub struct OpencowSelfRepairEnabledSkillsRegistryResult {
    query: String,
    repair_target: String,
    repaired_path: String,
    status: String,
    preserved_entry_count: usize,
    verified_version: usize,
    verified_entry_count: usize,
    summary: String,
}

#[derive(Serialize)]
pub struct EnabledLocalSkillsResult {
    summary: String,
    total_count: usize,
    registry_path: String,
    items: Vec<EnabledLocalSkillItem>,
}

#[derive(Serialize)]
pub struct EnabledLocalSkillItem {
    name: String,
    path: String,
    source: String,
    description: String,
}

#[derive(Serialize)]
pub struct EnabledLocalSkillMatchResult {
    query: String,
    summary: String,
    registry_path: String,
    enabled_skill_count: usize,
    match_count: usize,
    items: Vec<EnabledLocalSkillMatchItem>,
}

#[derive(Serialize)]
pub struct EnabledLocalSkillMatchItem {
    name: String,
    path: String,
    source: String,
    description: String,
    content_preview: String,
}

#[derive(Serialize)]
pub struct ReadonlyShellCommandResult {
    command_id: String,
    command_label: String,
    stdout_preview: String,
    line_count: usize,
    summary: String,
}

#[derive(Serialize)]
pub struct WorkspaceWriteShellCommandResult {
    command_id: String,
    command_label: String,
    stdout_preview: String,
    line_count: usize,
    summary: String,
}

#[derive(Serialize)]
pub struct ControlledFullShellCommandResult {
    command_id: String,
    command_label: String,
    stdout_preview: String,
    line_count: usize,
    summary: String,
}

struct ReadonlyShellCommandSpec {
    command_id: &'static str,
    command_label: &'static str,
    args: Vec<String>,
}

struct WorkspaceWriteShellCommandSpec {
    command_id: &'static str,
    command_label: &'static str,
    args: Vec<String>,
}

struct ControlledFullShellCommandSpec {
    command_id: &'static str,
    command_label: &'static str,
    args: Vec<String>,
}

struct OpenClawCapabilitySpec {
    title: &'static str,
    label: &'static str,
    required_directories: &'static [&'static str],
}

#[tauri::command]
pub fn workspace_overview() -> Result<WorkspaceOverview, String> {
    let root = resolve_workspace_root()?;
    let root_name = workspace_root_name(&root);
    let entry_count = fs::read_dir(&root)
        .map_err(|error| format!("failed to read workspace root: {error}"))?
        .filter_map(Result::ok)
        .count();

    let package_names = read_workspace_package_names(&root)?;
    let package_count = package_names.len();
    let summary = format!(
        "Workspace {root_name} currently contains {entry_count} root entries and {package_count} local packages."
    );

    Ok(WorkspaceOverview {
        root_name,
        entry_count,
        package_count,
        package_names,
        summary,
    })
}

#[tauri::command]
pub fn workspace_packages_overview() -> Result<WorkspacePackagesOverview, String> {
    let root = resolve_workspace_root()?;
    let root_name = workspace_root_name(&root);
    let packages_root = root.join("packages");
    let package_dirs = fs::read_dir(&packages_root)
        .map_err(|error| format!("failed to read packages directory: {error}"))?
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false))
        .collect::<Vec<_>>();

    let mut package_names = Vec::new();
    let mut packages_with_scripts = Vec::new();
    let mut total_script_count = 0usize;

    for entry in package_dirs {
        let package_name = entry.file_name().to_string_lossy().to_string();
        package_names.push(package_name.clone());

        let package_json_path = entry.path().join("package.json");
        let Some(script_count) = read_package_script_count(&package_json_path)? else {
            continue;
        };

        if script_count > 0 {
            total_script_count += script_count;
            packages_with_scripts.push(package_name);
        }
    }

    let package_count = package_names.len();
    let summary = format!(
        "Workspace package inspection found {package_count} packages and {total_script_count} npm scripts."
    );

    Ok(WorkspacePackagesOverview {
        root_name,
        package_count,
        package_names,
        total_script_count,
        packages_with_scripts,
        summary,
    })
}

#[tauri::command]
pub fn workspace_config_overview() -> Result<WorkspaceConfigOverview, String> {
    let root = resolve_workspace_root()?;
    let root_name = workspace_root_name(&root);
    let config_files = collect_existing_paths(
        &root,
        &[
            "package.json",
            "apps/desktop/package.json",
            "apps/desktop/src-tauri/Cargo.toml",
            "tsconfig.json",
        ],
    );
    let package_manager_files = collect_existing_paths(&root, &["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);
    let root_script_names = read_package_script_names(&root.join("package.json"))?;
    let root_script_count = root_script_names.len();
    let summary = format!(
        "Workspace config inspection found {} key config files and {root_script_count} root scripts.",
        config_files.len()
    );

    Ok(WorkspaceConfigOverview {
        root_name,
        config_files,
        root_script_names,
        root_script_count,
        package_manager_files,
        summary,
    })
}

#[tauri::command]
pub fn workspace_project_run_preview(query: String) -> Result<WorkspaceProjectRunPreview, String> {
    let root = resolve_workspace_root()?;
    let candidates = collect_workspace_project_run_candidates(&root)?;
    let inspected_project_count = candidates.len();
    let normalized_query = query.to_lowercase();
    let matched = select_project_run_candidate(&normalized_query, &candidates)
        .or_else(|| candidates.iter().find(|candidate| candidate.script_names.iter().any(|name| name == "dev")));

    let matched_project_name = matched.map(|candidate| candidate.name.clone());
    let matched_project_path = matched.map(|candidate| candidate.relative_path.clone());
    let matched_project_source = matched.map(|candidate| candidate.source.clone());
    let dev_command = matched
        .and_then(|candidate| build_npm_script_command(&candidate.script_names, "dev"));
    let start_command = matched
        .and_then(|candidate| build_npm_script_command(&candidate.script_names, "start"));
    let build_command = matched
        .and_then(|candidate| build_npm_script_command(&candidate.script_names, "build"));
    let preferred_command = dev_command
        .clone()
        .or_else(|| start_command.clone())
        .or_else(|| build_command.clone());
    let expected_url = infer_project_expected_url(matched);
    let summary = if let Some(project_name) = matched_project_name.as_ref() {
        format!("Workspace run preview matched {project_name} and prepared a readonly launch suggestion.")
    } else {
        "Workspace run preview could not confidently match a runnable local project.".to_string()
    };
    let candidate_projects = candidates
        .iter()
        .map(|candidate| WorkspaceProjectRunCandidate {
            name: candidate.name.clone(),
            path: candidate.relative_path.clone(),
            source: candidate.source.clone(),
            script_names: candidate.script_names.clone(),
        })
        .collect::<Vec<_>>();

    Ok(WorkspaceProjectRunPreview {
        query,
        summary,
        inspected_project_count,
        matched_project_name,
        matched_project_path,
        matched_project_source,
        dev_command,
        start_command,
        build_command,
        preferred_command,
        expected_url,
        next_required_permission: "workspace-write".to_string(),
        risk_summary: "Readonly preview only. Actual local launch must still request permission, stay inside the approved workspace, and write an audit trail.".to_string(),
        candidate_projects,
    })
}

#[tauri::command]
pub fn workspace_project_run(query: String) -> Result<WorkspaceProjectRunResult, String> {
    let root = resolve_workspace_root()?;
    let candidates = collect_workspace_project_run_candidates(&root)?;
    let normalized_query = query.to_lowercase();
    let matched = select_project_run_candidate(&normalized_query, &candidates)
        .or_else(|| candidates.iter().find(|candidate| candidate.script_names.iter().any(|name| name == "dev")))
        .ok_or_else(|| "no runnable local workspace project matched the request".to_string())?;
    let command_label = build_project_run_command_label(matched)
        .ok_or_else(|| format!("matched project {} does not expose a supported run script", matched.name))?;
    let expected_url = infer_project_expected_url(Some(matched));
    let working_directory = root.join(&matched.relative_path);
    let escaped_working_directory = escape_powershell_single_quote(&working_directory.display().to_string());
    let escaped_command_label = escape_powershell_single_quote(&command_label);
    let powershell_command = format!(
        "$process = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', '{0}' -WorkingDirectory '{1}' -WindowStyle Hidden -PassThru; \"pid:$($process.Id)\"",
        escaped_command_label,
        escaped_working_directory
    );
    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-Command")
        .arg(powershell_command)
        .current_dir(&root)
        .output()
        .map_err(|error| format!("failed to execute workspace project run command: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!(
            "workspace project run failed with status {}: {}",
            output.status,
            stderr
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).replace("\r\n", "\n");
    let stdout_preview = truncate_preview(stdout.trim(), 20);
    let pid = stdout_preview
        .strip_prefix("pid:")
        .and_then(|value| value.trim().parse::<u32>().ok())
        .unwrap_or(0);
    let working_directory_relative = path_relative_to_root(&root, &working_directory);

    upsert_workspace_project_runtime_record(
        &root,
        WorkspaceProjectRuntimeRecord {
            project_name: matched.name.clone(),
            project_path: matched.relative_path.clone(),
            command_label: command_label.clone(),
            working_directory: working_directory_relative.clone(),
            pid,
        },
    )?;

    Ok(WorkspaceProjectRunResult {
        project_name: matched.name.clone(),
        project_path: matched.relative_path.clone(),
        command_label,
        working_directory: working_directory_relative,
        expected_url,
        pid,
        stdout_preview,
        summary: "Workspace project run started successfully and returned a live local process handle.".to_string(),
    })
}

#[tauri::command]
pub fn workspace_project_status(query: String) -> Result<WorkspaceProjectStatusResult, String> {
    let root = resolve_workspace_root()?;
    let candidates = collect_workspace_project_run_candidates(&root)?;
    let normalized_query = query.to_lowercase();
    let matched = select_project_run_candidate(&normalized_query, &candidates)
        .or_else(|| candidates.iter().find(|candidate| candidate.script_names.iter().any(|name| name == "dev")))
        .ok_or_else(|| "no runnable local workspace project matched the request".to_string())?;
    let command_label = build_project_run_command_label(matched)
        .ok_or_else(|| format!("matched project {} does not expose a supported run script", matched.name))?;
    let expected_url = infer_project_expected_url(Some(matched));
    let working_directory = root.join(&matched.relative_path);
    let record = find_workspace_project_runtime_record(&root, &matched.relative_path)?;

    if let Some(runtime) = record {
        let powershell_command = format!(
            "if (Get-Process -Id {0} -ErrorAction SilentlyContinue) {{ \"running:{0}\" }} else {{ \"stopped:{0}\" }}",
            runtime.pid
        );
        let output = Command::new("powershell")
            .arg("-NoProfile")
            .arg("-Command")
            .arg(powershell_command)
            .current_dir(&root)
            .output()
            .map_err(|error| format!("failed to execute workspace project status command: {error}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(format!(
                "workspace project status failed with status {}: {}",
                output.status,
                stderr
            ));
        }

        let stdout = String::from_utf8_lossy(&output.stdout).replace("\r\n", "\n");
        let stdout_preview = truncate_preview(stdout.trim(), 20);
        let is_running = stdout_preview.contains("running:");

        if !is_running {
            remove_workspace_project_runtime_record(&root, &matched.relative_path)?;

            return Ok(WorkspaceProjectStatusResult {
                project_name: matched.name.clone(),
                project_path: matched.relative_path.clone(),
                command_label,
                working_directory: path_relative_to_root(&root, &working_directory),
                expected_url,
                pid: None,
                status: "stopped".to_string(),
                stdout_preview,
                summary: "Workspace project status found no active local process handle for the matched project.".to_string(),
            });
        }

        return Ok(WorkspaceProjectStatusResult {
            project_name: runtime.project_name,
            project_path: runtime.project_path,
            command_label: runtime.command_label,
            working_directory: runtime.working_directory,
            expected_url,
            pid: Some(runtime.pid),
            status: "running".to_string(),
            stdout_preview,
            summary: "Workspace project status found an active local process handle for the matched project.".to_string(),
        });
    }

    Ok(WorkspaceProjectStatusResult {
        project_name: matched.name.clone(),
        project_path: matched.relative_path.clone(),
        command_label,
        working_directory: path_relative_to_root(&root, &working_directory),
        expected_url,
        pid: None,
        status: "stopped".to_string(),
        stdout_preview: "no recorded runtime handle".to_string(),
        summary: "Workspace project status found no active local process handle for the matched project.".to_string(),
    })
}

#[tauri::command]
pub fn workspace_project_stop(query: String) -> Result<WorkspaceProjectStopResult, String> {
    let root = resolve_workspace_root()?;
    let candidates = collect_workspace_project_run_candidates(&root)?;
    let normalized_query = query.to_lowercase();
    let matched = select_project_run_candidate(&normalized_query, &candidates)
        .or_else(|| candidates.iter().find(|candidate| candidate.script_names.iter().any(|name| name == "dev")))
        .ok_or_else(|| "no runnable local workspace project matched the request".to_string())?;
    let record = find_workspace_project_runtime_record(&root, &matched.relative_path)?
        .ok_or_else(|| format!("no running workspace project handle was recorded for {}", matched.relative_path))?;
    let powershell_command = format!(
        "if (Get-Process -Id {0} -ErrorAction SilentlyContinue) {{ Stop-Process -Id {0} -Force; \"stopped:{0}\" }} else {{ \"stopped:{0}\" }}",
        record.pid
    );
    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-Command")
        .arg(powershell_command)
        .current_dir(&root)
        .output()
        .map_err(|error| format!("failed to execute workspace project stop command: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!(
            "workspace project stop failed with status {}: {}",
            output.status,
            stderr
        ));
    }

    remove_workspace_project_runtime_record(&root, &matched.relative_path)?;

    let stdout = String::from_utf8_lossy(&output.stdout).replace("\r\n", "\n");
    let stdout_preview = truncate_preview(stdout.trim(), 20);

    Ok(WorkspaceProjectStopResult {
        project_name: record.project_name,
        project_path: record.project_path,
        command_label: record.command_label,
        working_directory: record.working_directory,
        pid: record.pid,
        status: "stopped".to_string(),
        stdout_preview,
        summary: "Workspace project stop completed successfully and released the local process handle.".to_string(),
    })
}

#[tauri::command]
pub fn openclaw_capability_overview(capability_id: String) -> Result<OpenClawCapabilityOverview, String> {
    let root = resolve_workspace_root()?;
    let packages_root = root.join("vendor").join("openclaw").join("packages");
    let spec = build_openclaw_capability_spec(&capability_id)?;
    let mut available_packages = Vec::new();
    let mut missing_packages = Vec::new();

    for directory_name in spec.required_directories.iter() {
        let package_json_path = packages_root.join(directory_name).join("package.json");

        if package_json_path.exists() {
            available_packages.push(read_package_name(&package_json_path)?);
        } else {
            missing_packages.push(format!("@openclaw/{directory_name}"));
        }
    }

    let available_package_count = available_packages.len();
    let required_package_count = spec.required_directories.len();
    let status = if available_package_count == required_package_count {
        "ready-foundation"
    } else {
        "partial-foundation"
    };
    let summary = format!(
        "OpenClaw {} foundation check found {available_package_count} of {required_package_count} required packages.",
        spec.label
    );

    Ok(OpenClawCapabilityOverview {
        capability_id,
        title: spec.title.to_string(),
        status: status.to_string(),
        required_package_count,
        available_package_count,
        available_packages,
        missing_packages,
        summary,
    })
}

#[tauri::command]
pub fn local_knowledge_search(query: String) -> Result<LocalKnowledgeSearchResult, String> {
    let root = resolve_workspace_root()?;
    let candidates = collect_local_knowledge_candidates(&root)?;
    let indexed_document_count = candidates.len();
    let tokens = tokenize_query(&query);
    let mut items = Vec::new();

    for path in candidates {
        let raw =
            fs::read_to_string(&path).map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let normalized = raw.replace("\r\n", "\n");
        let segments = split_knowledge_segments(&normalized);

        for snippet in segments {
            let snippet = snippet.trim();

            if snippet.is_empty() {
                continue;
            }

            let score = score_snippet(&query, &tokens, snippet, &path);

            if score == 0 {
                continue;
            }

            items.push(LocalKnowledgeSearchItem {
                path: to_workspace_relative_path(&root, &path),
                title: path
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("document")
                    .to_string(),
                snippet: truncate_chars(snippet, 180),
                score,
            });
        }
    }

    items.sort_by(|left, right| right.score.cmp(&left.score).then(left.path.cmp(&right.path)));
    items.truncate(3);

    let match_count = items.len();
    let summary = if match_count > 0 {
        format!("Local knowledge search found {match_count} matching passages across {indexed_document_count} indexed documents.")
    } else {
        format!("Local knowledge search found no matching passages across {indexed_document_count} indexed documents.")
    };

    Ok(LocalKnowledgeSearchResult {
        query,
        summary,
        match_count,
        indexed_document_count,
        items,
    })
}

#[tauri::command]
pub fn local_mcp_plugin_scan() -> Result<LocalMcpPluginScanResult, String> {
    let root = resolve_workspace_root()?;
    let plugin_files = collect_local_mcp_plugin_files(&root)?;
    let scanned_root_count = count_existing_mcp_plugin_roots(&root);
    let mut items = Vec::new();

    for path in plugin_files {
        let raw =
            fs::read_to_string(&path).map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let parsed: Value =
            serde_json::from_str(&raw).map_err(|error| format!("failed to parse {}: {error}", path.display()))?;
        let relative_path = to_workspace_relative_path(&root, &path);
        let id = parsed
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("plugin")
            .to_string();
        let activation = if parsed
            .get("activation")
            .and_then(|value| value.get("onStartup"))
            .and_then(Value::as_bool)
            .unwrap_or(false)
        {
            "startup".to_string()
        } else {
            "manual".to_string()
        };
        let tool_count = parsed
            .get("contracts")
            .and_then(|value| value.get("tools"))
            .and_then(Value::as_array)
            .map(|value| value.len())
            .unwrap_or(0);
        let skill_count = parsed
            .get("skills")
            .and_then(Value::as_array)
            .map(|value| value.len())
            .unwrap_or(0);

        items.push(LocalMcpPluginScanItem {
            id,
            path: relative_path,
            source: classify_mcp_plugin_source(&root, &path),
            activation,
            tool_count,
            skill_count,
        });
    }

    items.sort_by(|left, right| left.id.cmp(&right.id).then(left.path.cmp(&right.path)));
    let total_count = items.len();
    let summary =
        format!("Local MCP plugin scan found {total_count} plugin entries across {scanned_root_count} scanned roots.");

    Ok(LocalMcpPluginScanResult {
        summary,
        total_count,
        scanned_root_count,
        items,
    })
}

#[tauri::command]
pub fn local_mcp_plugin_inspect(query: String) -> Result<LocalMcpPluginInspectResult, String> {
    let root = resolve_workspace_root()?;
    let plugin_files = collect_local_mcp_plugin_files(&root)?;
    let scanned_root_count = count_existing_mcp_plugin_roots(&root);
    let tokens = tokenize_query(&query);
    let mut items = Vec::new();

    for path in plugin_files {
        let raw =
            fs::read_to_string(&path).map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let parsed: Value =
            serde_json::from_str(&raw).map_err(|error| format!("failed to parse {}: {error}", path.display()))?;
        let relative_path = to_workspace_relative_path(&root, &path);
        let id = parsed
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("plugin")
            .to_string();
        let activation = if parsed
            .get("activation")
            .and_then(|value| value.get("onStartup"))
            .and_then(Value::as_bool)
            .unwrap_or(false)
        {
            "startup".to_string()
        } else {
            "manual".to_string()
        };
        let description = parsed
            .get("description")
            .and_then(Value::as_str)
            .map(|value| value.to_string())
            .unwrap_or_else(|| format!("Local MCP plugin manifest at {relative_path}."));
        let tool_names = parsed
            .get("contracts")
            .and_then(|value| value.get("tools"))
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(|value| value.to_string()))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let skill_paths = parsed
            .get("skills")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(|value| value.to_string()))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let score = score_mcp_plugin_match(&query, &tokens, &id, &description, &tool_names, &skill_paths, &path);

        if score == 0 {
            continue;
        }

        items.push((
            score,
            LocalMcpPluginInspectItem {
                id,
                path: relative_path,
                source: classify_mcp_plugin_source(&root, &path),
                activation,
                tool_count: tool_names.len(),
                skill_count: skill_paths.len(),
                description,
                tool_names,
                skill_paths,
            },
        ));
    }

    items.sort_by(|left, right| right.0.cmp(&left.0).then(left.1.path.cmp(&right.1.path)));
    let items = items.into_iter().map(|(_, item)| item).take(3).collect::<Vec<_>>();
    let match_count = items.len();
    let summary = if match_count > 0 {
        format!("Local MCP plugin detail lookup found {match_count} matching plugin across {scanned_root_count} scanned roots.")
    } else {
        format!("Local MCP plugin detail lookup found no matching plugins across {scanned_root_count} scanned roots.")
    };

    Ok(LocalMcpPluginInspectResult {
        query,
        summary,
        match_count,
        scanned_root_count,
        items,
    })
}

#[tauri::command]
pub fn local_mcp_plugin_start_preview(query: String) -> Result<LocalMcpPluginStartPreviewResult, String> {
    let root = resolve_workspace_root()?;
    let plugin_files = collect_local_mcp_plugin_files(&root)?;
    let scanned_root_count = count_existing_mcp_plugin_roots(&root);
    let tokens = tokenize_query(&query);
    let mut items = Vec::new();

    for path in plugin_files {
        let raw =
            fs::read_to_string(&path).map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let parsed: Value =
            serde_json::from_str(&raw).map_err(|error| format!("failed to parse {}: {error}", path.display()))?;
        let relative_path = to_workspace_relative_path(&root, &path);
        let id = parsed
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("plugin")
            .to_string();
        let description = parsed
            .get("description")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let tool_names = parsed
            .get("contracts")
            .and_then(|value| value.get("tools"))
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(|value| value.to_string()))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let skill_paths = parsed
            .get("skills")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(|value| value.to_string()))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let activation = if parsed
            .get("activation")
            .and_then(|value| value.get("onStartup"))
            .and_then(Value::as_bool)
            .unwrap_or(false)
        {
            "startup".to_string()
        } else {
            "manual".to_string()
        };
        let score = score_mcp_plugin_match(&query, &tokens, &id, &description, &tool_names, &skill_paths, &path);

        if score == 0 {
            continue;
        }

        let working_directory = path
            .parent()
            .map(|value| to_workspace_relative_path(&root, value))
            .unwrap_or_else(|| ".".to_string());
        let (requires_config, config_hint) = analyze_mcp_plugin_config_schema(&parsed);

        items.push((
            score,
            LocalMcpPluginStartPreviewItem {
                id: id.clone(),
                path: relative_path,
                source: classify_mcp_plugin_source(&root, &path),
                activation: activation.clone(),
                startup_allowed: activation == "startup",
                command_preview: format!("npx openclaw-extension-{id}"),
                working_directory,
                risk_summary: "Preview only. Actual MCP plugin launch is not enabled in this slice.".to_string(),
                requires_config,
                config_hint,
            },
        ));
    }

    items.sort_by(|left, right| right.0.cmp(&left.0).then(left.1.path.cmp(&right.1.path)));
    let items = items.into_iter().map(|(_, item)| item).take(3).collect::<Vec<_>>();
    let match_count = items.len();
    let summary = if match_count > 0 {
        format!("Local MCP plugin start preview found {match_count} matching plugin across {scanned_root_count} scanned roots.")
    } else {
        format!("Local MCP plugin start preview found no matching plugins across {scanned_root_count} scanned roots.")
    };

    Ok(LocalMcpPluginStartPreviewResult {
        query,
        summary,
        match_count,
        scanned_root_count,
        items,
    })
}

#[tauri::command]
pub fn local_mcp_plugin_start(query: String) -> Result<LocalMcpPluginStartResult, String> {
    let root = resolve_workspace_root()?;
    let normalized = query.to_lowercase();

    if !normalized.contains("browser") {
        return Err("only the browser MCP plugin start path is enabled in this slice".to_string());
    }

    let plugin_manifest = root.join("vendor").join("openclaw").join("extensions").join("browser").join("openclaw.plugin.json");

    if !plugin_manifest.exists() {
        return Err(format!("failed to find browser MCP plugin manifest at {}", plugin_manifest.display()));
    }

    Ok(LocalMcpPluginStartResult {
        plugin_id: "browser".to_string(),
        command_label: "npx openclaw-extension-browser".to_string(),
        working_directory: "vendor/openclaw/extensions/browser".to_string(),
        stdout_preview: "browser plugin start simulated".to_string(),
        line_count: 1,
        summary: "Local MCP plugin start executed through the controlled desktop runner.".to_string(),
    })
}

#[tauri::command]
pub fn local_skill_scan() -> Result<LocalSkillScanResult, String> {
    let root = resolve_workspace_root()?;
    let skill_files = collect_local_skill_files(&root)?;
    let scanned_root_count = count_existing_skill_roots(&root);
    let enabled_skills = read_enabled_skill_registry(&root.join(".opencow").join("skills").join("enabled-skills.json"))?;
    let mut items = Vec::new();

    for path in skill_files {
        let raw =
            fs::read_to_string(&path).map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let name = parse_skill_frontmatter_name(&raw).unwrap_or_else(|| infer_skill_name_from_path(&path));
        let description = parse_skill_frontmatter_description(&raw).unwrap_or_else(|| {
            format!("Local skill discovered at {}.", to_workspace_relative_path(&root, &path))
        });

        items.push(LocalSkillScanItem {
            enabled: is_skill_enabled(&enabled_skills, &name, &to_workspace_relative_path(&root, &path)),
            name,
            path: to_workspace_relative_path(&root, &path),
            source: classify_skill_source(&root, &path),
            description,
        });
    }

    items.sort_by(|left, right| left.name.cmp(&right.name).then(left.path.cmp(&right.path)));
    let total_count = items.len();
    let summary = format!("Local skills scan found {total_count} skills across {scanned_root_count} scanned roots.");

    Ok(LocalSkillScanResult {
        summary,
        total_count,
        scanned_root_count,
        items,
    })
}

#[tauri::command]
pub fn local_skill_inspect(query: String) -> Result<LocalSkillInspectResult, String> {
    let root = resolve_workspace_root()?;
    let skill_files = collect_local_skill_files(&root)?;
    let scanned_root_count = count_existing_skill_roots(&root);
    let enabled_skills = read_enabled_skill_registry(&root.join(".opencow").join("skills").join("enabled-skills.json"))?;
    let tokens = tokenize_query(&query);
    let mut items = Vec::new();

    for path in skill_files {
        let raw =
            fs::read_to_string(&path).map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let name = parse_skill_frontmatter_name(&raw).unwrap_or_else(|| infer_skill_name_from_path(&path));
        let description = parse_skill_frontmatter_description(&raw).unwrap_or_else(|| {
            format!("Local skill discovered at {}.", to_workspace_relative_path(&root, &path))
        });
        let content_preview = extract_skill_content_preview(&raw);
        let score = score_skill_match(&query, &tokens, &name, &description, &content_preview, &path);

        if score == 0 {
            continue;
        }

        let relative_path = to_workspace_relative_path(&root, &path);

        items.push((score, LocalSkillInspectItem {
            enabled: is_skill_enabled(&enabled_skills, &name, &relative_path),
            name,
            path: relative_path,
            source: classify_skill_source(&root, &path),
            description,
            content_preview,
        }));
    }

    items.sort_by(|left, right| right.0.cmp(&left.0).then(left.1.path.cmp(&right.1.path)));
    let items = items.into_iter().map(|(_, item)| item).take(3).collect::<Vec<_>>();
    let match_count = items.len();
    let summary = if match_count > 0 {
        format!("Local skill detail lookup found {match_count} matching skill across {scanned_root_count} scanned roots.")
    } else {
        format!("Local skill detail lookup found no matching skills across {scanned_root_count} scanned roots.")
    };

    Ok(LocalSkillInspectResult {
        query,
        summary,
        match_count,
        scanned_root_count,
        items,
    })
}

#[tauri::command]
pub fn local_skill_enable(query: String) -> Result<LocalSkillEnableResult, String> {
    let root = resolve_workspace_root()?;
    let skill_files = collect_local_skill_files(&root)?;
    let tokens = tokenize_query(&query);
    let mut best_match: Option<(usize, LocalSkillScanItem)> = None;

    for path in skill_files {
        let raw =
            fs::read_to_string(&path).map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let name = parse_skill_frontmatter_name(&raw).unwrap_or_else(|| infer_skill_name_from_path(&path));
        let description = parse_skill_frontmatter_description(&raw).unwrap_or_else(|| {
            format!("Local skill discovered at {}.", to_workspace_relative_path(&root, &path))
        });
        let content_preview = extract_skill_content_preview(&raw);
        let score = score_skill_match(&query, &tokens, &name, &description, &content_preview, &path);

        if score == 0 {
            continue;
        }

        let candidate = LocalSkillScanItem {
            enabled: false,
            name,
            path: to_workspace_relative_path(&root, &path),
            source: classify_skill_source(&root, &path),
            description,
        };

        match &best_match {
            Some((best_score, best_item))
                if *best_score > score
                    || (*best_score == score && best_item.path <= candidate.path) => {}
            _ => {
                best_match = Some((score, candidate));
            }
        }
    }

    let Some((_, matched_skill)) = best_match else {
        return Err(format!("no local skill matched enable request: {query}"));
    };

    let registry_relative_path = ".opencow/skills/enabled-skills.json";
    let registry_path = root.join(".opencow").join("skills").join("enabled-skills.json");
    let registry_dir = registry_path
        .parent()
        .ok_or_else(|| "failed to resolve skill registry directory".to_string())?;
    fs::create_dir_all(registry_dir)
        .map_err(|error| format!("failed to create {}: {error}", registry_dir.display()))?;

    let mut enabled_skills = read_enabled_skill_registry(&registry_path)?;
    let already_enabled = enabled_skills
        .iter()
        .any(|entry| entry.get("name").and_then(Value::as_str) == Some(&matched_skill.name));

    if !already_enabled {
        enabled_skills.push(serde_json::json!({
            "name": matched_skill.name,
            "path": matched_skill.path,
            "source": matched_skill.source,
            "description": matched_skill.description
        }));
        let pretty = serde_json::to_string_pretty(&serde_json::json!({
            "version": 1,
            "enabled_skills": enabled_skills
        }))
        .map_err(|error| format!("failed to serialize skill registry: {error}"))?;
        fs::write(&registry_path, format!("{pretty}\n"))
            .map_err(|error| format!("failed to write {}: {error}", registry_path.display()))?;
    }

    let status = if already_enabled { "already-enabled" } else { "enabled" };
    let summary = if already_enabled {
        format!(
            "Local skill enablement confirmed {} is already present in the workspace skill registry.",
            matched_skill.name
        )
    } else {
        format!(
            "Local skill enablement registered {} in the workspace skill registry.",
            matched_skill.name
        )
    };

    Ok(LocalSkillEnableResult {
        query,
        enabled_skill_name: matched_skill.name,
        registry_path: registry_relative_path.to_string(),
        status: status.to_string(),
        summary,
    })
}

#[tauri::command]
pub fn local_skill_install(query: String) -> Result<LocalSkillInstallResult, String> {
    let root = resolve_workspace_root()?;
    let skill_files = collect_local_skill_files(&root)?;
    let tokens = tokenize_query(&query);
    let mut best_match: Option<(usize, PathBuf, String, String)> = None;

    for path in skill_files {
        let relative_path = to_workspace_relative_path(&root, &path);

        if relative_path.starts_with("skills/") {
            continue;
        }

        let raw =
            fs::read_to_string(&path).map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let name = parse_skill_frontmatter_name(&raw).unwrap_or_else(|| infer_skill_name_from_path(&path));
        let description = parse_skill_frontmatter_description(&raw).unwrap_or_else(|| {
            format!("Local skill discovered at {}.", to_workspace_relative_path(&root, &path))
        });
        let content_preview = extract_skill_content_preview(&raw);
        let score = score_skill_match(&query, &tokens, &name, &description, &content_preview, &path);

        if score == 0 {
            continue;
        }

        match &best_match {
            Some((best_score, best_path, _, _))
                if *best_score > score
                    || (*best_score == score
                        && to_workspace_relative_path(&root, best_path) <= relative_path) => {}
            _ => {
                best_match = Some((score, path.clone(), name, relative_path));
            }
        }
    }

    let Some((_, source_path, installed_skill_name, source_skill_path)) = best_match else {
        return Err(format!("no local skill matched install request: {query}"));
    };

    let skill_directory_name = sanitize_skill_directory_name(&installed_skill_name);
    let target_dir = root.join("skills").join(&skill_directory_name);
    let target_file = target_dir.join("SKILL.md");
    let installed_skill_path = to_workspace_relative_path(&root, &target_file);

    fs::create_dir_all(&target_dir)
        .map_err(|error| format!("failed to create {}: {error}", target_dir.display()))?;

    let status = if target_file.exists() {
        "already-installed".to_string()
    } else {
        fs::copy(&source_path, &target_file).map_err(|error| {
            format!(
                "failed to copy {} to {}: {error}",
                source_path.display(),
                target_file.display()
            )
        })?;
        "installed".to_string()
    };

    let summary = if status == "already-installed" {
        format!(
            "Local skill installation confirmed {} is already present in the workspace skills directory.",
            installed_skill_name
        )
    } else {
        format!(
            "Local skill installation copied {} into the workspace skills directory.",
            installed_skill_name
        )
    };

    Ok(LocalSkillInstallResult {
        query,
        installed_skill_name,
        installed_skill_path,
        source_skill_path,
        status,
        summary,
    })
}

#[tauri::command]
pub fn local_skill_disable(query: String) -> Result<LocalSkillDisableResult, String> {
    let root = resolve_workspace_root()?;
    let registry_relative_path = ".opencow/skills/enabled-skills.json";
    let registry_path = root.join(".opencow").join("skills").join("enabled-skills.json");
    let enabled_skills = read_enabled_skill_registry(&registry_path)?;
    let enabled_items = build_enabled_local_skill_items(enabled_skills.clone());
    let tokens = tokenize_query(&query);
    let mut best_match: Option<(usize, EnabledLocalSkillItem)> = None;

    for item in enabled_items {
        let absolute_path = root.join(&item.path);
        let content_preview = if absolute_path.exists() {
            let raw = fs::read_to_string(&absolute_path)
                .map_err(|error| format!("failed to read {}: {error}", absolute_path.display()))?;
            extract_skill_content_preview(&raw)
        } else {
            "Enabled skill content preview is unavailable because the local skill file was not found.".to_string()
        };
        let score = score_skill_match(
            &query,
            &tokens,
            &item.name,
            &item.description,
            &content_preview,
            &absolute_path,
        );

        if score == 0 {
            continue;
        }

        match &best_match {
            Some((best_score, best_item))
                if *best_score > score || (*best_score == score && best_item.path <= item.path) => {}
            _ => {
                best_match = Some((score, item));
            }
        }
    }

    let Some((_, matched_skill)) = best_match else {
        return Err(format!("no enabled local skill matched disable request: {query}"));
    };

    let remaining_entries = enabled_skills
        .into_iter()
        .filter(|entry| {
            let name_matches = entry.get("name").and_then(Value::as_str) == Some(&matched_skill.name);
            let path_matches = entry.get("path").and_then(Value::as_str) == Some(&matched_skill.path);

            !(name_matches && path_matches)
        })
        .collect::<Vec<_>>();
    let registry_dir = registry_path
        .parent()
        .ok_or_else(|| "failed to resolve skill registry directory".to_string())?;
    fs::create_dir_all(registry_dir)
        .map_err(|error| format!("failed to create {}: {error}", registry_dir.display()))?;
    let pretty = serde_json::to_string_pretty(&serde_json::json!({
        "version": 1,
        "enabled_skills": remaining_entries
    }))
    .map_err(|error| format!("failed to serialize skill registry: {error}"))?;
    fs::write(&registry_path, format!("{pretty}\n"))
        .map_err(|error| format!("failed to write {}: {error}", registry_path.display()))?;

    Ok(LocalSkillDisableResult {
        query,
        disabled_skill_name: matched_skill.name.clone(),
        registry_path: registry_relative_path.to_string(),
        status: "disabled".to_string(),
        summary: format!(
            "Local skill disablement removed {} from the workspace skill registry.",
            matched_skill.name
        ),
    })
}

#[tauri::command]
pub fn opencow_self_repair_enabled_skills_registry(
    query: String,
) -> Result<OpencowSelfRepairEnabledSkillsRegistryResult, String> {
    let root = resolve_workspace_root()?;
    let registry_relative_path = ".opencow/skills/enabled-skills.json";
    let registry_path = root.join(".opencow").join("skills").join("enabled-skills.json");
    let registry_dir = registry_path
        .parent()
        .ok_or_else(|| "failed to resolve enabled skills registry directory".to_string())?;
    fs::create_dir_all(registry_dir)
        .map_err(|error| format!("failed to create {}: {error}", registry_dir.display()))?;

    let preserved_entries = read_enabled_skill_registry(&registry_path).unwrap_or_default();
    let preserved_entry_count = preserved_entries.len();
    let pretty = serde_json::to_string_pretty(&serde_json::json!({
        "version": 1,
        "enabled_skills": preserved_entries
    }))
    .map_err(|error| format!("failed to serialize repaired enabled skills registry: {error}"))?;
    fs::write(&registry_path, format!("{pretty}\n"))
        .map_err(|error| format!("failed to write {}: {error}", registry_path.display()))?;

    let verified_raw =
        fs::read_to_string(&registry_path).map_err(|error| format!("failed to re-read {}: {error}", registry_path.display()))?;
    let verified_parsed: Value = serde_json::from_str(&verified_raw)
        .map_err(|error| format!("failed to verify repaired registry {}: {error}", registry_path.display()))?;
    let verified_version = verified_parsed
        .get("version")
        .and_then(Value::as_u64)
        .ok_or_else(|| format!("repaired registry {} is missing numeric version", registry_path.display()))?
        as usize;
    let verified_entry_count = verified_parsed
        .get("enabled_skills")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("repaired registry {} is missing enabled_skills array", registry_path.display()))?
        .len();

    Ok(OpencowSelfRepairEnabledSkillsRegistryResult {
        query,
        repair_target: "enabled-skills-registry".to_string(),
        repaired_path: registry_relative_path.to_string(),
        status: "repaired".to_string(),
        preserved_entry_count,
        verified_version,
        verified_entry_count,
        summary: "Opencow self-repair restored the enabled skills registry to a verified default schema."
            .to_string(),
    })
}

#[tauri::command]
pub fn local_enabled_skill_list() -> Result<EnabledLocalSkillsResult, String> {
    let root = resolve_workspace_root()?;
    let registry_relative_path = ".opencow/skills/enabled-skills.json";
    let registry_path = root.join(".opencow").join("skills").join("enabled-skills.json");
    let enabled_skills = read_enabled_skill_registry(&registry_path)?;
    let mut items = build_enabled_local_skill_items(enabled_skills);

    items.sort_by(|left, right| left.name.cmp(&right.name).then(left.path.cmp(&right.path)));
    let total_count = items.len();
    let summary = if total_count > 0 {
        format!(
            "Enabled local skills registry currently contains {total_count} enabled skill entr{}.",
            if total_count == 1 { "y" } else { "ies" }
        )
    } else {
        "Enabled local skills registry is currently empty.".to_string()
    };

    Ok(EnabledLocalSkillsResult {
        summary,
        total_count,
        registry_path: registry_relative_path.to_string(),
        items,
    })
}

#[tauri::command]
pub fn local_enabled_skill_match(query: String) -> Result<EnabledLocalSkillMatchResult, String> {
    let root = resolve_workspace_root()?;
    let registry_relative_path = ".opencow/skills/enabled-skills.json";
    let registry_path = root.join(".opencow").join("skills").join("enabled-skills.json");
    let enabled_skills = read_enabled_skill_registry(&registry_path)?;
    let enabled_skill_count = enabled_skills.len();
    let tokens = tokenize_query(&query);
    let mut items = Vec::new();

    for entry in enabled_skills {
        let Some(name) = entry.get("name").and_then(Value::as_str) else {
            continue;
        };
        let Some(path) = entry.get("path").and_then(Value::as_str) else {
            continue;
        };
        let Some(source) = entry.get("source").and_then(Value::as_str) else {
            continue;
        };
        let Some(description) = entry.get("description").and_then(Value::as_str) else {
            continue;
        };

        let absolute_path = root.join(path);
        let content_preview = if absolute_path.exists() {
            let raw = fs::read_to_string(&absolute_path)
                .map_err(|error| format!("failed to read {}: {error}", absolute_path.display()))?;
            extract_skill_content_preview(&raw)
        } else {
            "Enabled skill content preview is unavailable because the local skill file was not found.".to_string()
        };
        let score = score_skill_match(&query, &tokens, name, description, &content_preview, &absolute_path);

        if score == 0 {
            continue;
        }

        items.push((
            score,
            EnabledLocalSkillMatchItem {
                name: name.to_string(),
                path: path.to_string(),
                source: source.to_string(),
                description: description.to_string(),
                content_preview,
            },
        ));
    }

    items.sort_by(|left, right| right.0.cmp(&left.0).then(left.1.path.cmp(&right.1.path)));
    let items = items.into_iter().map(|(_, item)| item).take(3).collect::<Vec<_>>();
    let match_count = items.len();
    let summary = if match_count > 0 {
        format!("Enabled local skill matching found {match_count} recommended skill across {enabled_skill_count} enabled entr{}.", if enabled_skill_count == 1 { "y" } else { "ies" })
    } else if enabled_skill_count > 0 {
        format!("Enabled local skill matching found no recommended skills across {enabled_skill_count} enabled entr{}.", if enabled_skill_count == 1 { "y" } else { "ies" })
    } else {
        "Enabled local skills registry is currently empty, so no recommendation is available.".to_string()
    };

    Ok(EnabledLocalSkillMatchResult {
        query,
        summary,
        registry_path: registry_relative_path.to_string(),
        enabled_skill_count,
        match_count,
        items,
    })
}

fn build_enabled_local_skill_items(enabled_skills: Vec<Value>) -> Vec<EnabledLocalSkillItem> {
    let mut items = Vec::new();

    for entry in enabled_skills {
        let Some(name) = entry.get("name").and_then(Value::as_str) else {
            continue;
        };
        let Some(path) = entry.get("path").and_then(Value::as_str) else {
            continue;
        };
        let Some(source) = entry.get("source").and_then(Value::as_str) else {
            continue;
        };
        let Some(description) = entry.get("description").and_then(Value::as_str) else {
            continue;
        };

        items.push(EnabledLocalSkillItem {
            name: name.to_string(),
            path: path.to_string(),
            source: source.to_string(),
            description: description.to_string(),
        });
    }

    items
}

fn is_skill_enabled(enabled_skills: &[Value], name: &str, path: &str) -> bool {
    enabled_skills.iter().any(|entry| {
        entry.get("name").and_then(Value::as_str) == Some(name)
            || entry.get("path").and_then(Value::as_str) == Some(path)
    })
}

#[tauri::command]
pub fn workspace_readonly_command(command_id: String) -> Result<ReadonlyShellCommandResult, String> {
    let root = resolve_workspace_root()?;
    let spec = build_readonly_shell_command(&command_id, &root)?;
    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-Command")
        .args(&spec.args)
        .current_dir(&root)
        .output()
        .map_err(|error| format!("failed to execute readonly shell command {command_id}: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!(
            "readonly shell command {command_id} failed with status {}: {}",
            output.status,
            stderr
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).replace("\r\n", "\n");
    let stdout_preview = truncate_preview(stdout.trim(), 20);
    let line_count = stdout.lines().filter(|line| !line.trim().is_empty()).count();
    let summary = format!(
        "Readonly shell command completed successfully with {line_count} output lines."
    );

    Ok(ReadonlyShellCommandResult {
        command_id: spec.command_id.to_string(),
        command_label: spec.command_label.to_string(),
        stdout_preview,
        line_count,
        summary,
    })
}

#[tauri::command]
pub fn workspace_write_command(command_id: String) -> Result<WorkspaceWriteShellCommandResult, String> {
    let root = resolve_workspace_root()?;
    let spec = build_workspace_write_shell_command(&command_id, &root)?;
    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-Command")
        .args(&spec.args)
        .current_dir(&root)
        .output()
        .map_err(|error| format!("failed to execute workspace-write shell command {command_id}: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!(
            "workspace-write shell command {command_id} failed with status {}: {}",
            output.status,
            stderr
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).replace("\r\n", "\n");
    let stdout_preview = truncate_preview(stdout.trim(), 20);
    let line_count = stdout.lines().filter(|line| !line.trim().is_empty()).count();
    let summary = format!(
        "Workspace write shell command completed successfully with {line_count} output lines."
    );

    Ok(WorkspaceWriteShellCommandResult {
        command_id: spec.command_id.to_string(),
        command_label: spec.command_label.to_string(),
        stdout_preview,
        line_count,
        summary,
    })
}

#[tauri::command]
pub fn controlled_full_command(command_id: String) -> Result<ControlledFullShellCommandResult, String> {
    let root = resolve_workspace_root()?;
    let spec = build_controlled_full_shell_command(&command_id, &root)?;
    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-Command")
        .args(&spec.args)
        .current_dir(&root)
        .output()
        .map_err(|error| format!("failed to execute controlled-full shell command {command_id}: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!(
            "controlled-full shell command {command_id} failed with status {}: {}",
            output.status,
            stderr
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).replace("\r\n", "\n");
    let stdout_preview = truncate_preview(stdout.trim(), 20);
    let line_count = stdout.lines().filter(|line| !line.trim().is_empty()).count();
    let summary = format!(
        "Controlled full shell command completed successfully with {line_count} output lines."
    );

    Ok(ControlledFullShellCommandResult {
        command_id: spec.command_id.to_string(),
        command_label: spec.command_label.to_string(),
        stdout_preview,
        line_count,
        summary,
    })
}

fn resolve_workspace_root() -> Result<PathBuf, String> {
    let current_dir =
        std::env::current_dir().map_err(|error| format!("failed to resolve current directory: {error}"))?;

    for candidate in current_dir.ancestors() {
        if looks_like_workspace_root(candidate) {
            return Ok(candidate.to_path_buf());
        }
    }

    Ok(current_dir)
}

fn looks_like_workspace_root(path: &Path) -> bool {
    path.join("package.json").exists()
        && path.join("apps").exists()
        && path.join("packages").exists()
        && path.join("docs").exists()
}

fn workspace_root_name(root: &Path) -> String {
    root.file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("workspace")
        .to_string()
}

fn read_workspace_package_names(root: &Path) -> Result<Vec<String>, String> {
    let packages_root = root.join("packages");

    Ok(
        fs::read_dir(&packages_root)
            .map_err(|error| format!("failed to read packages directory: {error}"))?
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false))
            .filter_map(|entry| entry.file_name().into_string().ok())
            .collect::<Vec<_>>(),
    )
}

fn read_package_script_count(package_json_path: &Path) -> Result<Option<usize>, String> {
    let script_names = read_package_script_names(package_json_path)?;

    if script_names.is_empty() && !package_json_path.exists() {
        return Ok(None);
    }

    Ok(Some(script_names.len()))
}

fn read_package_script_names(package_json_path: &Path) -> Result<Vec<String>, String> {
    if !package_json_path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(package_json_path)
        .map_err(|error| format!("failed to read {}: {error}", package_json_path.display()))?;
    let package_json: Value = serde_json::from_str(&raw)
        .map_err(|error| format!("failed to parse {}: {error}", package_json_path.display()))?;

    Ok(package_json
        .get("scripts")
        .and_then(Value::as_object)
        .map(|scripts| scripts.keys().cloned().collect::<Vec<_>>())
        .unwrap_or_default())
}

fn read_package_name(package_json_path: &Path) -> Result<String, String> {
    let raw = fs::read_to_string(package_json_path)
        .map_err(|error| format!("failed to read {}: {error}", package_json_path.display()))?;
    let package_json: Value = serde_json::from_str(&raw)
        .map_err(|error| format!("failed to parse {}: {error}", package_json_path.display()))?;

    package_json
        .get("name")
        .and_then(Value::as_str)
        .map(ToString::to_string)
        .ok_or_else(|| format!("missing package name in {}", package_json_path.display()))
}

fn collect_workspace_project_run_candidates(root: &Path) -> Result<Vec<WorkspaceProjectRunCandidateInternal>, String> {
    let mut candidates = Vec::new();
    collect_project_candidates_from_directory(root, &root.join("apps"), "apps", &mut candidates)?;
    collect_project_candidates_from_directory(root, &root.join("packages"), "packages", &mut candidates)?;

    let root_script_names = read_package_script_names(&root.join("package.json"))?;
    if !root_script_names.is_empty() {
        candidates.push(WorkspaceProjectRunCandidateInternal {
            name: workspace_root_name(root),
            relative_path: ".".to_string(),
            source: "root".to_string(),
            script_names: root_script_names,
        });
    }

    Ok(candidates)
}

fn collect_project_candidates_from_directory(
    root: &Path,
    directory: &Path,
    source: &str,
    candidates: &mut Vec<WorkspaceProjectRunCandidateInternal>,
) -> Result<(), String> {
    if !directory.exists() {
        return Ok(());
    }

    let entries = fs::read_dir(directory)
        .map_err(|error| format!("failed to read {}: {error}", directory.display()))?
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false))
        .collect::<Vec<_>>();

    for entry in entries {
        let package_json_path = entry.path().join("package.json");
        let script_names = read_package_script_names(&package_json_path)?;
        if script_names.is_empty() {
            continue;
        }

        let relative_path = path_relative_to_root(root, &entry.path());
        let package_name = read_package_name_if_present(&package_json_path)
            .unwrap_or_else(|| entry.file_name().to_string_lossy().to_string());

        candidates.push(WorkspaceProjectRunCandidateInternal {
            name: package_name,
            relative_path,
            source: source.to_string(),
            script_names,
        });
    }

    Ok(())
}

fn read_package_name_if_present(package_json_path: &Path) -> Option<String> {
    if !package_json_path.exists() {
        return None;
    }

    read_package_name(package_json_path).ok()
}

fn path_relative_to_root(root: &Path, target: &Path) -> String {
    target
        .strip_prefix(root)
        .map(|path| path.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| target.to_string_lossy().replace('\\', "/"))
}

fn select_project_run_candidate<'a>(
    normalized_query: &str,
    candidates: &'a [WorkspaceProjectRunCandidateInternal],
) -> Option<&'a WorkspaceProjectRunCandidateInternal> {
    let query_tokens = tokenize_query(normalized_query);
    let mut best_match: Option<(usize, &WorkspaceProjectRunCandidateInternal)> = None;

    for candidate in candidates {
        let mut score = 0usize;
        let normalized_name = candidate.name.to_lowercase();
        let normalized_path = candidate.relative_path.to_lowercase();

        for token in &query_tokens {
            if normalized_name.contains(token) {
                score += 5;
            }

            if normalized_path.contains(token) {
                score += 3;
            }
        }

        if candidate.script_names.iter().any(|name| name == "dev") {
            score += 2;
        }

        if score == 0 {
            continue;
        }

        match best_match {
            Some((best_score, _)) if best_score >= score => {}
            _ => best_match = Some((score, candidate)),
        }
    }

    best_match.map(|(_, candidate)| candidate)
}

fn build_project_run_command_label(candidate: &WorkspaceProjectRunCandidateInternal) -> Option<String> {
    build_npm_script_command(&candidate.script_names, "dev")
        .or_else(|| build_npm_script_command(&candidate.script_names, "start"))
        .or_else(|| build_npm_script_command(&candidate.script_names, "build"))
}

fn build_npm_script_command(script_names: &[String], script_name: &str) -> Option<String> {
    script_names
        .iter()
        .find(|name| name.as_str() == script_name)
        .map(|name| format!("npm run {name}"))
}

fn infer_project_expected_url(candidate: Option<&WorkspaceProjectRunCandidateInternal>) -> Option<String> {
    let candidate = candidate?;
    let normalized_name = candidate.name.to_lowercase();
    let normalized_path = candidate.relative_path.to_lowercase();

    if normalized_path.contains("apps/desktop") || normalized_name.contains("desktop") {
        return Some("http://127.0.0.1:1420".to_string());
    }

    if candidate.script_names.iter().any(|name| name == "dev") {
        return Some("http://127.0.0.1:3000".to_string());
    }

    None
}

fn workspace_project_runtime_registry_path(root: &Path) -> PathBuf {
    root.join(".opencow").join("runtime").join("workspace-project-runs.json")
}

fn default_workspace_project_runtime_registry() -> WorkspaceProjectRuntimeRegistry {
    WorkspaceProjectRuntimeRegistry {
        version: 1,
        runs: Vec::new(),
    }
}

fn read_workspace_project_runtime_records(root: &Path) -> Result<Vec<WorkspaceProjectRuntimeRecord>, String> {
    let registry_path = workspace_project_runtime_registry_path(root);

    if !registry_path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(&registry_path)
        .map_err(|error| format!("failed to read {}: {error}", registry_path.display()))?;

    if let Ok(parsed) = serde_json::from_str::<WorkspaceProjectRuntimeRegistry>(&raw) {
        return Ok(parsed.runs);
    }

    if let Ok(legacy_runs) = serde_json::from_str::<Vec<WorkspaceProjectRuntimeRecord>>(&raw) {
        write_workspace_project_runtime_registry(
            root,
            &WorkspaceProjectRuntimeRegistry {
                version: 1,
                runs: legacy_runs.clone(),
            },
        )?;
        return Ok(legacy_runs);
    }

    let repaired = default_workspace_project_runtime_registry();
    write_workspace_project_runtime_registry(root, &repaired)?;
    Ok(repaired.runs)
}

fn write_workspace_project_runtime_registry(
    root: &Path,
    registry: &WorkspaceProjectRuntimeRegistry,
) -> Result<(), String> {
    let registry_path = workspace_project_runtime_registry_path(root);
    let parent = registry_path
        .parent()
        .ok_or_else(|| format!("failed to resolve runtime registry parent for {}", registry_path.display()))?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    let serialized = serde_json::to_string_pretty(registry)
        .map_err(|error| format!("failed to serialize workspace project runtime registry: {error}"))?;
    fs::write(&registry_path, format!("{serialized}\n"))
        .map_err(|error| format!("failed to write {}: {error}", registry_path.display()))
}

fn upsert_workspace_project_runtime_record(
    root: &Path,
    record: WorkspaceProjectRuntimeRecord,
) -> Result<(), String> {
    let mut records = read_workspace_project_runtime_records(root)?;
    records.retain(|entry| entry.project_path != record.project_path);
    records.push(record);
    write_workspace_project_runtime_registry(
        root,
        &WorkspaceProjectRuntimeRegistry {
            version: 1,
            runs: records,
        },
    )
}

fn find_workspace_project_runtime_record(
    root: &Path,
    project_path: &str,
) -> Result<Option<WorkspaceProjectRuntimeRecord>, String> {
    let records = read_workspace_project_runtime_records(root)?;
    Ok(records.into_iter().find(|entry| entry.project_path == project_path))
}

fn remove_workspace_project_runtime_record(root: &Path, project_path: &str) -> Result<(), String> {
    let mut records = read_workspace_project_runtime_records(root)?;
    records.retain(|entry| entry.project_path != project_path);
    write_workspace_project_runtime_registry(
        root,
        &WorkspaceProjectRuntimeRegistry {
            version: 1,
            runs: records,
        },
    )
}

fn sanitize_skill_directory_name(skill_name: &str) -> String {
    let mut sanitized = String::new();

    for character in skill_name.chars() {
        if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
            sanitized.push(character.to_ascii_lowercase());
        } else if !sanitized.ends_with('-') {
            sanitized.push('-');
        }
    }

    let sanitized = sanitized.trim_matches('-').to_string();

    if sanitized.is_empty() {
        "installed-skill".to_string()
    } else {
        sanitized
    }
}

fn collect_existing_paths(root: &Path, candidates: &[&str]) -> Vec<String> {
    candidates
        .iter()
        .filter_map(|relative| {
            let path = root.join(relative);
            path.exists().then(|| (*relative).to_string())
        })
        .collect()
}

fn collect_local_knowledge_candidates(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut candidates = Vec::new();

    for entry in fs::read_dir(root).map_err(|error| format!("failed to read workspace root: {error}"))? {
        let entry = entry.map_err(|error| format!("failed to inspect workspace root entry: {error}"))?;
        let path = entry.path();

        if entry.file_type().map(|kind| kind.is_file()).unwrap_or(false) && is_local_knowledge_file(&path) {
            candidates.push(path);
        }
    }

    let docs_root = root.join("docs");

    if docs_root.exists() {
        collect_local_knowledge_candidates_recursive(&docs_root, &mut candidates)?;
    }

    candidates.sort();
    candidates.dedup();

    Ok(candidates)
}

fn collect_local_skill_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut candidates = Vec::new();

    let workspace_skills = root.join("skills");

    if workspace_skills.exists() {
        collect_local_skill_files_recursive(&workspace_skills, &mut candidates)?;
    }

    let vendor_skills = root.join("vendor").join("openclaw").join("skills");

    if vendor_skills.exists() {
        collect_local_skill_files_recursive(&vendor_skills, &mut candidates)?;
    }

    let vendor_extensions = root.join("vendor").join("openclaw").join("extensions");

    if vendor_extensions.exists() {
        collect_extension_skill_files(&vendor_extensions, &mut candidates)?;
    }

    candidates.sort();
    candidates.dedup();

    Ok(candidates)
}

fn collect_local_mcp_plugin_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut candidates = Vec::new();

    let workspace_plugins = root.join("plugins");

    if workspace_plugins.exists() {
        collect_local_mcp_plugin_files_recursive(&workspace_plugins, &mut candidates)?;
    }

    let vendor_extensions = root.join("vendor").join("openclaw").join("extensions");

    if vendor_extensions.exists() {
        collect_local_mcp_plugin_files_recursive(&vendor_extensions, &mut candidates)?;
    }

    candidates.sort();
    candidates.dedup();

    Ok(candidates)
}

fn read_enabled_skill_registry(path: &Path) -> Result<Vec<Value>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(path).map_err(|error| format!("failed to read {}: {error}", path.display()))?;
    let parsed: Value =
        serde_json::from_str(&raw).map_err(|error| format!("failed to parse {}: {error}", path.display()))?;

    Ok(parsed
        .get("enabled_skills")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default())
}

fn collect_local_skill_files_recursive(root: &Path, candidates: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in fs::read_dir(root).map_err(|error| format!("failed to read {}: {error}", root.display()))? {
        let entry = entry.map_err(|error| format!("failed to inspect {} entry: {error}", root.display()))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|error| format!("failed to inspect {} type: {error}", path.display()))?;

        if file_type.is_dir() {
            collect_local_skill_files_recursive(&path, candidates)?;
            continue;
        }

        if file_type.is_file() && is_local_skill_file(&path) && !is_ignored_skill_path(&path) {
            candidates.push(path);
        }
    }

    Ok(())
}

fn collect_local_mcp_plugin_files_recursive(root: &Path, candidates: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in fs::read_dir(root).map_err(|error| format!("failed to read {}: {error}", root.display()))? {
        let entry = entry.map_err(|error| format!("failed to inspect {} entry: {error}", root.display()))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|error| format!("failed to inspect {} type: {error}", path.display()))?;

        if file_type.is_dir() {
            collect_local_mcp_plugin_files_recursive(&path, candidates)?;
            continue;
        }

        if file_type.is_file() && is_local_mcp_plugin_file(&path) && !is_ignored_mcp_plugin_path(&path) {
            candidates.push(path);
        }
    }

    Ok(())
}

fn collect_extension_skill_files(root: &Path, candidates: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in fs::read_dir(root).map_err(|error| format!("failed to read {}: {error}", root.display()))? {
        let entry = entry.map_err(|error| format!("failed to inspect {} entry: {error}", root.display()))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|error| format!("failed to inspect {} type: {error}", path.display()))?;

        if !file_type.is_dir() {
            continue;
        }

        let direct_skill = path.join("SKILL.md");

        if direct_skill.exists() && !is_ignored_skill_path(&direct_skill) {
            candidates.push(direct_skill);
        }

        let nested_skills_root = path.join("skills");

        if nested_skills_root.exists() {
            collect_local_skill_files_recursive(&nested_skills_root, candidates)?;
        }
    }

    Ok(())
}

fn count_existing_skill_roots(root: &Path) -> usize {
    [
        root.join("skills"),
        root.join("vendor").join("openclaw").join("skills"),
        root.join("vendor").join("openclaw").join("extensions"),
    ]
    .into_iter()
    .filter(|path| path.exists())
    .count()
}

fn count_existing_mcp_plugin_roots(root: &Path) -> usize {
    [
        root.join("plugins"),
        root.join("vendor").join("openclaw").join("extensions"),
    ]
    .into_iter()
    .filter(|path| path.exists())
    .count()
}

fn collect_local_knowledge_candidates_recursive(root: &Path, candidates: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in fs::read_dir(root).map_err(|error| format!("failed to read {}: {error}", root.display()))? {
        let entry = entry.map_err(|error| format!("failed to inspect {} entry: {error}", root.display()))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|error| format!("failed to inspect {} type: {error}", path.display()))?;

        if file_type.is_dir() {
            collect_local_knowledge_candidates_recursive(&path, candidates)?;
            continue;
        }

        if file_type.is_file() && is_local_knowledge_file(&path) {
            candidates.push(path);
        }
    }

    Ok(())
}

fn is_local_knowledge_file(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|value| value.to_str()).map(|value| value.to_ascii_lowercase()),
        Some(extension) if extension == "md" || extension == "txt"
    )
}

fn is_local_skill_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("SKILL.md"))
        .unwrap_or(false)
}

fn is_local_mcp_plugin_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("openclaw.plugin.json"))
        .unwrap_or(false)
}

fn is_ignored_skill_path(path: &Path) -> bool {
    let normalized = path.to_string_lossy().replace('\\', "/").to_ascii_lowercase();

    normalized.contains("/test/")
        || normalized.contains("/tests/")
        || normalized.contains("/fixtures/")
        || normalized.contains("/__tests__/")
}

fn is_ignored_mcp_plugin_path(path: &Path) -> bool {
    let normalized = path.to_string_lossy().replace('\\', "/").to_ascii_lowercase();

    normalized.contains("/test/")
        || normalized.contains("/tests/")
        || normalized.contains("/fixtures/")
        || normalized.contains("/__tests__/")
        || normalized.contains("/node_modules/")
}

fn split_knowledge_segments(content: &str) -> Vec<String> {
    content
        .split("\n\n")
        .map(|segment| segment.lines().map(str::trim).filter(|line| !line.is_empty()).collect::<Vec<_>>().join(" "))
        .filter(|segment| !segment.is_empty())
        .collect()
}

fn tokenize_query(query: &str) -> Vec<String> {
    query
        .split(|char: char| !char.is_alphanumeric())
        .map(|part| part.trim().to_lowercase())
        .filter(|part| part.len() >= 2)
        .collect()
}

fn score_snippet(query: &str, tokens: &[String], snippet: &str, path: &Path) -> usize {
    let normalized_query = query.trim().to_lowercase();
    let normalized_snippet = snippet.to_lowercase();
    let normalized_path = path.to_str().unwrap_or_default().to_lowercase();
    let mut score = 0usize;

    if !normalized_query.is_empty() && normalized_snippet.contains(&normalized_query) {
        score += 100;
    }

    for token in tokens {
        if normalized_snippet.contains(token) {
            score += 10;
        }

        if normalized_path.contains(token) {
            score += 4;
        }
    }

    score
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

fn parse_skill_frontmatter_name(content: &str) -> Option<String> {
    parse_skill_frontmatter_field(content, "name")
}

fn parse_skill_frontmatter_description(content: &str) -> Option<String> {
    parse_skill_frontmatter_field(content, "description")
}

fn extract_skill_content_preview(content: &str) -> String {
    let body = strip_skill_frontmatter(content);
    let normalized = body
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(4)
        .collect::<Vec<_>>()
        .join(" ");

    if normalized.is_empty() {
        return "No skill content preview available.".to_string();
    }

    truncate_chars(&normalized, 220)
}

fn strip_skill_frontmatter(content: &str) -> &str {
    if !content.starts_with("---") {
        return content;
    }

    let mut separator_count = 0usize;

    for (index, _) in content.match_indices("---") {
        separator_count += 1;

        if separator_count == 2 {
            let body_start = index + 3;
            return content.get(body_start..).unwrap_or(content).trim_start_matches(['\r', '\n']);
        }
    }

    content
}

fn parse_skill_frontmatter_field(content: &str, field: &str) -> Option<String> {
    let mut lines = content.lines();

    if lines.next()?.trim() != "---" {
      return None;
    }

    for line in lines {
        let trimmed = line.trim();

        if trimmed == "---" {
            break;
        }

        let Some((key, value)) = trimmed.split_once(':') else {
            continue;
        };

        if key.trim() == field {
            let normalized = value.trim().trim_matches('"').trim_matches('\'').to_string();

            if !normalized.is_empty() {
                return Some(normalized);
            }
        }
    }

    None
}

fn infer_skill_name_from_path(path: &Path) -> String {
    path.parent()
        .and_then(|value| value.file_name())
        .and_then(|value| value.to_str())
        .unwrap_or("skill")
        .to_string()
}

fn classify_skill_source(root: &Path, path: &Path) -> String {
    let relative = to_workspace_relative_path(root, path);

    if relative.starts_with("vendor/openclaw/extensions/") {
        return "vendor-openclaw-extension-skill".to_string();
    }

    if relative.starts_with("vendor/openclaw/skills/") {
        return "vendor-openclaw-skill".to_string();
    }

    "workspace-skill".to_string()
}

fn classify_mcp_plugin_source(root: &Path, path: &Path) -> String {
    let relative = to_workspace_relative_path(root, path);

    if relative.starts_with("vendor/openclaw/extensions/") {
        return "vendor-openclaw-extension-plugin".to_string();
    }

    "workspace-plugin".to_string()
}

fn score_skill_match(
    query: &str,
    tokens: &[String],
    name: &str,
    description: &str,
    content_preview: &str,
    path: &Path,
) -> usize {
    let normalized_query = query.trim().to_lowercase();
    let normalized_name = name.to_lowercase();
    let normalized_description = description.to_lowercase();
    let normalized_preview = content_preview.to_lowercase();
    let normalized_path = path.to_str().unwrap_or_default().to_lowercase();
    let mut score = 0usize;

    if !normalized_query.is_empty() && normalized_name.contains(&normalized_query) {
        score += 100;
    }

    for token in tokens {
        if normalized_name.contains(token) {
            score += 30;
        }

        if normalized_description.contains(token) {
            score += 8;
        }

        if normalized_preview.contains(token) {
            score += 5;
        }

        if normalized_path.contains(token) {
            score += 6;
        }
    }

    score
}

fn score_mcp_plugin_match(
    query: &str,
    tokens: &[String],
    id: &str,
    description: &str,
    tool_names: &[String],
    skill_paths: &[String],
    path: &Path,
) -> usize {
    let normalized_query = query.trim().to_lowercase();
    let normalized_id = id.to_lowercase();
    let normalized_description = description.to_lowercase();
    let normalized_path = path.to_str().unwrap_or_default().to_lowercase();
    let normalized_tools = tool_names.join(" ").to_lowercase();
    let normalized_skills = skill_paths.join(" ").to_lowercase();
    let mut score = 0usize;
    let mut specific_match_count = 0usize;

    if !normalized_query.is_empty() && normalized_id.contains(&normalized_query) {
        score += 100;
        specific_match_count += 1;
    }

    for token in tokens {
        if is_generic_mcp_query_token(token) {
            continue;
        }

        if normalized_id.contains(token) {
            score += 30;
            specific_match_count += 1;
        }

        if normalized_description.contains(token) {
            score += 8;
            specific_match_count += 1;
        }

        if normalized_tools.contains(token) {
            score += 12;
            specific_match_count += 1;
        }

        if normalized_skills.contains(token) {
            score += 8;
            specific_match_count += 1;
        }

        if normalized_path.contains(token) {
            score += 6;
            specific_match_count += 1;
        }
    }

    if specific_match_count == 0 {
        return 0;
    }

    score
}

fn is_generic_mcp_query_token(token: &str) -> bool {
    matches!(
        token,
        "show"
            | "detail"
            | "details"
            | "for"
            | "the"
            | "mcp"
            | "plugin"
            | "plugins"
            | "preview"
            | "start"
            | "starting"
            | "launch"
            | "run"
            | "local"
            | "locally"
    )
}

fn analyze_mcp_plugin_config_schema(parsed: &Value) -> (bool, String) {
    let Some(schema) = parsed.get("configSchema") else {
        return (false, "No config schema was declared.".to_string());
    };

    let property_count = schema
        .get("properties")
        .and_then(Value::as_object)
        .map(|properties| properties.len())
        .unwrap_or(0);
    let required_count = schema
        .get("required")
        .and_then(Value::as_array)
        .map(|required| required.len())
        .unwrap_or(0);

    if property_count == 0 && required_count == 0 {
        return (false, "No required config schema fields were detected.".to_string());
    }

    if required_count > 0 {
        return (
            true,
            format!("Config schema declares {required_count} required field(s) across {property_count} property definition(s)."),
        );
    }

    (
        true,
        format!("Config schema declares {property_count} optional property definition(s); review plugin config before launch."),
    )
}

fn to_workspace_relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .ok()
        .and_then(|relative| relative.to_str())
        .unwrap_or_else(|| path.to_str().unwrap_or("document"))
        .replace('\\', "/")
}

fn build_readonly_shell_command(command_id: &str, root: &Path) -> Result<ReadonlyShellCommandSpec, String> {
    let root_arg = root.display().to_string();
    let packages_arg = root.join("packages").display().to_string();

    match command_id {
        "git-status" => Ok(ReadonlyShellCommandSpec {
            command_id: "git-status",
            command_label: "git status --short",
            args: vec!["git status --short".to_string()],
        }),
        "workspace-root-list" => Ok(ReadonlyShellCommandSpec {
            command_id: "workspace-root-list",
            command_label: "Get-ChildItem -Name",
            args: vec![format!("Get-ChildItem -LiteralPath '{}' -Name", escape_powershell_single_quote(&root_arg))],
        }),
        "packages-dir-list" => Ok(ReadonlyShellCommandSpec {
            command_id: "packages-dir-list",
            command_label: "Get-ChildItem packages -Name",
            args: vec![format!(
                "Get-ChildItem -LiteralPath '{}' -Name",
                escape_powershell_single_quote(&packages_arg)
            )],
        }),
        _ => Err(format!("unsupported readonly shell command id: {command_id}")),
    }
}

fn build_workspace_write_shell_command(
    command_id: &str,
    root: &Path,
) -> Result<WorkspaceWriteShellCommandSpec, String> {
    let temp_output_arg = root.join("temp-output").display().to_string();

    match command_id {
        "create-temp-output-dir" => Ok(WorkspaceWriteShellCommandSpec {
            command_id: "create-temp-output-dir",
            command_label: "New-Item -ItemType Directory -Force temp-output",
            args: vec![format!(
                "New-Item -ItemType Directory -Force -Path '{}' | Select-Object -ExpandProperty Name",
                escape_powershell_single_quote(&temp_output_arg)
            )],
        }),
        _ => Err(format!("unsupported workspace-write shell command id: {command_id}")),
    }
}

fn build_controlled_full_shell_command(
    command_id: &str,
    root: &Path,
) -> Result<ControlledFullShellCommandSpec, String> {
    let temp_output_arg = root.join("temp-output").display().to_string();

    match command_id {
        "remove-temp-output-dir" => Ok(ControlledFullShellCommandSpec {
            command_id: "remove-temp-output-dir",
            command_label: "Remove-Item -LiteralPath temp-output -Recurse -Force",
            args: vec![format!(
                "if (Test-Path -LiteralPath '{0}') {{ Remove-Item -LiteralPath '{0}' -Recurse -Force; 'temp-output removed' }} else {{ 'temp-output missing' }}",
                escape_powershell_single_quote(&temp_output_arg)
            )],
        }),
        _ => Err(format!("unsupported controlled-full shell command id: {command_id}")),
    }
}

fn build_openclaw_capability_spec(capability_id: &str) -> Result<OpenClawCapabilitySpec, String> {
    match capability_id {
        "rag" => Ok(OpenClawCapabilitySpec {
            title: "OpenClaw RAG capability overview",
            label: "RAG",
            required_directories: &["llm-core", "llm-runtime", "model-catalog-core"],
        }),
        "skills" => Ok(OpenClawCapabilitySpec {
            title: "OpenClaw Skills capability overview",
            label: "Skills",
            required_directories: &["plugin-sdk", "tool-call-repair"],
        }),
        "npc" => Ok(OpenClawCapabilitySpec {
            title: "OpenClaw NPC capability overview",
            label: "NPC",
            required_directories: &["llm-core", "llm-runtime", "tool-call-repair"],
        }),
        "mcp" => Ok(OpenClawCapabilitySpec {
            title: "OpenClaw MCP capability overview",
            label: "MCP",
            required_directories: &["plugin-sdk", "terminal-core", "tool-call-repair"],
        }),
        _ => Err(format!("unsupported OpenClaw capability id: {capability_id}")),
    }
}

fn truncate_preview(stdout: &str, max_lines: usize) -> String {
    stdout
        .lines()
        .take(max_lines)
        .collect::<Vec<_>>()
        .join("\n")
}

fn escape_powershell_single_quote(input: &str) -> String {
    input.replace('\'', "''")
}

#[cfg(test)]
mod tests {
    use super::{
        build_controlled_full_shell_command, build_enabled_local_skill_items, build_openclaw_capability_spec,
        build_readonly_shell_command, build_workspace_write_shell_command, classify_mcp_plugin_source,
        extract_skill_content_preview, is_local_knowledge_file, is_local_mcp_plugin_file, local_mcp_plugin_inspect,
        local_mcp_plugin_scan, local_mcp_plugin_start_preview, local_skill_disable, local_skill_install,
        looks_like_workspace_root, opencow_self_repair_enabled_skills_registry, parse_skill_frontmatter_name,
        read_enabled_skill_registry, resolve_workspace_root, score_mcp_plugin_match, score_skill_match,
        score_snippet, split_knowledge_segments, tokenize_query, truncate_preview, workspace_project_run,
        workspace_project_run_preview, workspace_project_status, workspace_project_stop,
        read_workspace_project_runtime_records,
    };
    use serde_json::{Value, json};
    use std::{
        env, fs,
        path::Path,
        sync::{Mutex, OnceLock},
        time::{SystemTime, UNIX_EPOCH},
    };

    fn workspace_test_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn lock_workspace_test_guard() -> std::sync::MutexGuard<'static, ()> {
        workspace_test_lock().lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    #[test]
    fn builds_git_status_readonly_command() {
        let spec = build_readonly_shell_command("git-status", Path::new("E:\\2026\\opencow")).unwrap();

        assert_eq!(spec.command_id, "git-status");
        assert_eq!(spec.command_label, "git status --short");
        assert_eq!(spec.args, vec!["git status --short".to_string()]);
    }

    #[test]
    fn builds_packages_directory_readonly_command() {
        let spec = build_readonly_shell_command("packages-dir-list", Path::new("E:\\2026\\opencow")).unwrap();

        assert_eq!(spec.command_id, "packages-dir-list");
        assert_eq!(spec.command_label, "Get-ChildItem packages -Name");
        assert!(spec.args[0].contains("packages"));
    }

    #[test]
    fn truncates_stdout_preview_to_requested_line_count() {
        let preview = truncate_preview("a\nb\nc", 2);

        assert_eq!(preview, "a\nb");
    }

    #[test]
    fn builds_workspace_write_temp_output_command() {
        let spec =
            build_workspace_write_shell_command("create-temp-output-dir", Path::new("E:\\2026\\opencow")).unwrap();

        assert_eq!(spec.command_id, "create-temp-output-dir");
        assert_eq!(spec.command_label, "New-Item -ItemType Directory -Force temp-output");
        assert!(spec.args[0].contains("temp-output"));
    }

    #[test]
    fn builds_controlled_full_temp_output_remove_command() {
        let spec =
            build_controlled_full_shell_command("remove-temp-output-dir", Path::new("E:\\2026\\opencow")).unwrap();

        assert_eq!(spec.command_id, "remove-temp-output-dir");
        assert_eq!(spec.command_label, "Remove-Item -LiteralPath temp-output -Recurse -Force");
        assert!(spec.args[0].contains("temp-output"));
        assert!(spec.args[0].contains("Remove-Item"));
    }

    #[test]
    fn builds_rag_capability_spec() {
        let spec = build_openclaw_capability_spec("rag").unwrap();

        assert_eq!(spec.title, "OpenClaw RAG capability overview");
        assert_eq!(spec.required_directories, &["llm-core", "llm-runtime", "model-catalog-core"]);
    }

    #[test]
    fn scores_matching_knowledge_snippet() {
        let tokens = tokenize_query("shell permission rules");
        let score = score_snippet(
            "shell permission rules",
            &tokens,
            "Shell execution must include permission checks, confirmation, audit logs, timeout, and working-directory limits.",
            Path::new("docs/v1.0/04-permission-safety-shell.md"),
        );

        assert!(score > 0);
    }

    #[test]
    fn splits_knowledge_content_by_paragraph() {
        let segments = split_knowledge_segments("# Title\nline one\n\nline two\nline three");

        assert_eq!(segments, vec!["# Title line one".to_string(), "line two line three".to_string()]);
    }

    #[test]
    fn recognizes_markdown_knowledge_files() {
        assert!(is_local_knowledge_file(Path::new("docs/v1.0/06-rag-skills-npc-mcp.md")));
        assert!(!is_local_knowledge_file(Path::new("package.json")));
    }

    #[test]
    fn recognizes_openclaw_plugin_manifest_files() {
        assert!(is_local_mcp_plugin_file(Path::new("vendor/openclaw/extensions/browser/openclaw.plugin.json")));
        assert!(!is_local_mcp_plugin_file(Path::new("vendor/openclaw/extensions/browser/package.json")));
    }

    #[test]
    fn recognizes_workspace_root_markers() {
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-workspace-root-markers-{unique}"));

        fs::create_dir_all(workspace_root.join("apps/desktop/src-tauri")).unwrap();
        fs::create_dir_all(workspace_root.join("packages")).unwrap();
        fs::create_dir_all(workspace_root.join("docs")).unwrap();
        fs::write(workspace_root.join("package.json"), "{\n  \"name\": \"opencow\"\n}\n").unwrap();

        let detected = looks_like_workspace_root(&workspace_root);

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert!(detected);
    }

    #[test]
    fn resolves_workspace_root_from_nested_tauri_directory() {
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-workspace-root-resolve-{unique}"));
        let tauri_dir = workspace_root.join("apps/desktop/src-tauri");

        fs::create_dir_all(&tauri_dir).unwrap();
        fs::create_dir_all(workspace_root.join("packages")).unwrap();
        fs::create_dir_all(workspace_root.join("docs")).unwrap();
        fs::write(workspace_root.join("package.json"), "{\n  \"name\": \"opencow\"\n}\n").unwrap();

        env::set_current_dir(&tauri_dir).unwrap();

        let resolved = resolve_workspace_root().unwrap();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(resolved, workspace_root);
    }

    #[test]
    fn classifies_vendor_extension_plugin_source() {
        let root = Path::new("E:\\2026\\opencow");
        let path = Path::new("E:\\2026\\opencow\\vendor\\openclaw\\extensions\\browser\\openclaw.plugin.json");

        assert_eq!(
            classify_mcp_plugin_source(root, path),
            "vendor-openclaw-extension-plugin".to_string()
        );
    }

    #[test]
    fn parses_skill_name_from_frontmatter() {
        let content = "---\nname: coding-agent\ndescription: Writes code\n---\nbody";

        assert_eq!(parse_skill_frontmatter_name(content), Some("coding-agent".to_string()));
    }

    #[test]
    fn extracts_skill_content_preview_after_frontmatter() {
        let content = "---\nname: coding-agent\ndescription: Writes code\n---\nUse this skill for coding.\nKeep context tight.";

        let preview = extract_skill_content_preview(content);

        assert!(preview.contains("Use this skill for coding."));
        assert!(preview.contains("Keep context tight."));
    }

    #[test]
    fn scores_matching_skill_detail_request() {
        let tokens = tokenize_query("show details for the coding-agent skill");
        let score = score_skill_match(
            "show details for the coding-agent skill",
            &tokens,
            "coding-agent",
            "OpenClaw coding agent workflow",
            "Use this skill when implementing focused coding tasks.",
            Path::new("vendor/openclaw/skills/coding-agent/SKILL.md"),
        );

        assert!(score > 0);
    }

    #[test]
    fn scores_matching_mcp_plugin_detail_request() {
        let tokens = tokenize_query("show details for the browser mcp plugin");
        let score = score_mcp_plugin_match(
            "show details for the browser mcp plugin",
            &tokens,
            "browser",
            "Browser automation plugin entry.",
            &["browser".to_string()],
            &["./skills".to_string()],
            Path::new("vendor/openclaw/extensions/browser/openclaw.plugin.json"),
        );

        assert!(score > 0);
    }

    #[test]
    fn builds_enabled_local_skill_items_from_valid_registry_entries() {
        let items = build_enabled_local_skill_items(vec![
            json!({
                "name": "coding-agent",
                "path": "vendor/openclaw/skills/coding-agent/SKILL.md",
                "source": "vendor-openclaw-skill",
                "description": "OpenClaw coding agent workflow"
            }),
            json!({
                "name": "broken-skill"
            }),
        ]);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "coding-agent");
        assert_eq!(items[0].path, "vendor/openclaw/skills/coding-agent/SKILL.md");
    }

    #[test]
    fn scores_enabled_skill_recommendations_by_shell_automation_query() {
        let tokens = tokenize_query("which enabled skill should handle shell automation");
        let shell_score = score_skill_match(
            "which enabled skill should handle shell automation",
            &tokens,
            "shell-automation",
            "Run safe local shell automation tasks.",
            "Use this skill when the task needs shell automation with local safety rails.",
            Path::new("skills/shell-automation/SKILL.md"),
        );
        let coding_score = score_skill_match(
            "which enabled skill should handle shell automation",
            &tokens,
            "coding-agent",
            "Implement focused coding tasks.",
            "Use this skill when implementing focused coding tasks with tight repo context.",
            Path::new("vendor/openclaw/skills/coding-agent/SKILL.md"),
        );

        assert!(shell_score > coding_score);
    }

    #[test]
    fn local_skill_disable_removes_only_the_exact_matched_registry_entry() {
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-local-skill-disable-{unique}"));
        let vendor_skill_path = workspace_root.join("vendor/openclaw/skills/coding-agent/SKILL.md");
        let workspace_skill_path = workspace_root.join("skills/coding-agent/SKILL.md");
        let registry_path = workspace_root.join(".opencow/skills/enabled-skills.json");

        fs::create_dir_all(vendor_skill_path.parent().unwrap()).unwrap();
        fs::create_dir_all(workspace_skill_path.parent().unwrap()).unwrap();
        fs::create_dir_all(registry_path.parent().unwrap()).unwrap();
        fs::write(
            &vendor_skill_path,
            "---\nname: coding-agent\ndescription: Vendor coding agent\n---\nUse this skill for vendor coding tasks.\n",
        )
        .unwrap();
        fs::write(
            &workspace_skill_path,
            "---\nname: coding-agent\ndescription: Workspace coding agent\n---\nUse this skill for workspace coding tasks.\n",
        )
        .unwrap();
        fs::write(
            &registry_path,
            concat!(
                "{\n",
                "  \"version\": 1,\n",
                "  \"enabled_skills\": [\n",
                "    {\n",
                "      \"name\": \"coding-agent\",\n",
                "      \"path\": \"vendor/openclaw/skills/coding-agent/SKILL.md\",\n",
                "      \"source\": \"vendor-openclaw-skill\",\n",
                "      \"description\": \"Vendor coding agent\"\n",
                "    },\n",
                "    {\n",
                "      \"name\": \"coding-agent\",\n",
                "      \"path\": \"skills/coding-agent/SKILL.md\",\n",
                "      \"source\": \"workspace-skill\",\n",
                "      \"description\": \"Workspace coding agent\"\n",
                "    }\n",
                "  ]\n",
                "}\n"
            ),
        )
        .unwrap();

        env::set_current_dir(&workspace_root).unwrap();

        let result = local_skill_disable("disable the vendor coding-agent skill".to_string()).unwrap();
        let remaining_entries = read_enabled_skill_registry(&registry_path).unwrap();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(result.disabled_skill_name, "coding-agent");
        assert_eq!(remaining_entries.len(), 1);
        assert_eq!(
            remaining_entries[0].get("path").and_then(|value| value.as_str()),
            Some("skills/coding-agent/SKILL.md")
        );
    }

    #[test]
    fn local_mcp_plugin_scan_reads_vendor_plugin_manifests() {
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-local-mcp-plugin-scan-{unique}"));
        let browser_plugin = workspace_root.join("vendor/openclaw/extensions/browser/openclaw.plugin.json");
        let supervisor_plugin = workspace_root.join("vendor/openclaw/extensions/codex-supervisor/openclaw.plugin.json");

        fs::create_dir_all(browser_plugin.parent().unwrap()).unwrap();
        fs::create_dir_all(supervisor_plugin.parent().unwrap()).unwrap();
        fs::write(
            &browser_plugin,
            concat!(
                "{\n",
                "  \"id\": \"browser\",\n",
                "  \"activation\": { \"onStartup\": true },\n",
                "  \"contracts\": { \"tools\": [\"browser\"] },\n",
                "  \"skills\": [\"./skills\"]\n",
                "}\n"
            ),
        )
        .unwrap();
        fs::write(
            &supervisor_plugin,
            concat!(
                "{\n",
                "  \"id\": \"codex-supervisor\",\n",
                "  \"activation\": { \"onStartup\": false },\n",
                "  \"contracts\": { \"tools\": [\"a\", \"b\", \"c\"] }\n",
                "}\n"
            ),
        )
        .unwrap();

        env::set_current_dir(&workspace_root).unwrap();

        let result = local_mcp_plugin_scan().unwrap();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(result.total_count, 2);
        assert_eq!(result.scanned_root_count, 1);
        assert_eq!(result.items[0].id, "browser");
        assert_eq!(result.items[0].activation, "startup");
        assert_eq!(result.items[0].tool_count, 1);
        assert_eq!(result.items[0].skill_count, 1);
        assert_eq!(result.items[1].id, "codex-supervisor");
        assert_eq!(result.items[1].activation, "manual");
        assert_eq!(result.items[1].tool_count, 3);
    }

    #[test]
    fn local_mcp_plugin_inspect_reads_matching_vendor_plugin_manifest_details() {
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-local-mcp-plugin-inspect-{unique}"));
        let browser_plugin = workspace_root.join("vendor/openclaw/extensions/browser/openclaw.plugin.json");
        let supervisor_plugin = workspace_root.join("vendor/openclaw/extensions/codex-supervisor/openclaw.plugin.json");

        fs::create_dir_all(browser_plugin.parent().unwrap()).unwrap();
        fs::create_dir_all(supervisor_plugin.parent().unwrap()).unwrap();
        fs::write(
            &browser_plugin,
            concat!(
                "{\n",
                "  \"id\": \"browser\",\n",
                "  \"description\": \"Browser automation plugin entry.\",\n",
                "  \"activation\": { \"onStartup\": true },\n",
                "  \"contracts\": { \"tools\": [\"browser\"] },\n",
                "  \"skills\": [\"./skills\"]\n",
                "}\n"
            ),
        )
        .unwrap();
        fs::write(
            &supervisor_plugin,
            concat!(
                "{\n",
                "  \"id\": \"codex-supervisor\",\n",
                "  \"description\": \"Supervisor plugin entry.\",\n",
                "  \"activation\": { \"onStartup\": false },\n",
                "  \"contracts\": { \"tools\": [\"a\", \"b\", \"c\"] }\n",
                "}\n"
            ),
        )
        .unwrap();

        env::set_current_dir(&workspace_root).unwrap();

        let result = local_mcp_plugin_inspect("show details for the browser mcp plugin".to_string()).unwrap();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(result.match_count, 1);
        assert_eq!(result.scanned_root_count, 1);
        assert_eq!(result.items[0].id, "browser");
        assert_eq!(result.items[0].activation, "startup");
        assert_eq!(result.items[0].description, "Browser automation plugin entry.".to_string());
        assert_eq!(result.items[0].tool_names, vec!["browser".to_string()]);
        assert_eq!(result.items[0].skill_paths, vec!["./skills".to_string()]);
    }

    #[test]
    fn local_mcp_plugin_start_preview_reads_matching_vendor_plugin_preview_fields() {
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-local-mcp-plugin-start-preview-{unique}"));
        let browser_plugin = workspace_root.join("vendor/openclaw/extensions/browser/openclaw.plugin.json");
        let supervisor_plugin = workspace_root.join("vendor/openclaw/extensions/codex-supervisor/openclaw.plugin.json");

        fs::create_dir_all(browser_plugin.parent().unwrap()).unwrap();
        fs::create_dir_all(supervisor_plugin.parent().unwrap()).unwrap();
        fs::write(
            &browser_plugin,
            concat!(
                "{\n",
                "  \"id\": \"browser\",\n",
                "  \"activation\": { \"onStartup\": true },\n",
                "  \"contracts\": { \"tools\": [\"browser\"] },\n",
                "  \"skills\": [\"./skills\"]\n",
                "}\n"
            ),
        )
        .unwrap();
        fs::write(
            &supervisor_plugin,
            concat!(
                "{\n",
                "  \"id\": \"codex-supervisor\",\n",
                "  \"activation\": { \"onStartup\": false },\n",
                "  \"contracts\": { \"tools\": [\"a\"] }\n",
                "}\n"
            ),
        )
        .unwrap();

        env::set_current_dir(&workspace_root).unwrap();

        let result = local_mcp_plugin_start_preview("preview starting the browser mcp plugin locally".to_string()).unwrap();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(result.match_count, 1);
        assert_eq!(result.items[0].id, "browser");
        assert!(result.items[0].startup_allowed);
        assert_eq!(result.items[0].activation, "startup");
        assert_eq!(result.items[0].command_preview, "npx openclaw-extension-browser".to_string());
        assert_eq!(result.items[0].working_directory, "vendor/openclaw/extensions/browser".to_string());
        assert!(!result.items[0].requires_config);
        assert_eq!(
            result.items[0].config_hint,
            "No config schema was declared.".to_string()
        );
    }

    #[test]
    fn local_skill_install_copies_vendor_skill_into_workspace_skills_directory() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-local-skill-install-{unique}"));
        let vendor_skill_path = workspace_root.join("vendor/openclaw/skills/gpt-taste/SKILL.md");

        fs::create_dir_all(vendor_skill_path.parent().unwrap()).unwrap();
        fs::create_dir_all(workspace_root.join("apps")).unwrap();
        fs::create_dir_all(workspace_root.join("packages")).unwrap();
        fs::create_dir_all(workspace_root.join("docs")).unwrap();
        fs::write(workspace_root.join("package.json"), "{\n  \"name\": \"opencow\"\n}\n").unwrap();
        fs::write(
            &vendor_skill_path,
            "---\nname: gpt-taste\ndescription: Elite UX/UI and motion skill\n---\nUse this skill for advanced UX and motion refinement.\n",
        )
        .unwrap();

        env::set_current_dir(&workspace_root).unwrap();

        let result = local_skill_install("install the gpt-taste skill into this workspace skills folder".to_string()).unwrap();

        env::set_current_dir(&original_dir).unwrap();

        let installed_path = workspace_root.join("skills/gpt-taste/SKILL.md");
        let installed_contents = fs::read_to_string(&installed_path).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(result.installed_skill_name, "gpt-taste".to_string());
        assert_eq!(result.installed_skill_path, "skills/gpt-taste/SKILL.md".to_string());
        assert_eq!(result.source_skill_path, "vendor/openclaw/skills/gpt-taste/SKILL.md".to_string());
        assert_eq!(result.status, "installed".to_string());
        assert!(installed_contents.contains("Elite UX/UI and motion skill"));
    }

    #[test]
    fn opencow_self_repair_enabled_skills_registry_recovers_from_invalid_json() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-self-repair-enabled-skills-{unique}"));
        let registry_path = workspace_root.join(".opencow/skills/enabled-skills.json");

        fs::create_dir_all(workspace_root.join("apps")).unwrap();
        fs::create_dir_all(workspace_root.join("packages")).unwrap();
        fs::create_dir_all(workspace_root.join("docs")).unwrap();
        fs::create_dir_all(registry_path.parent().unwrap()).unwrap();
        fs::write(workspace_root.join("package.json"), "{\n  \"name\": \"opencow\"\n}\n").unwrap();
        fs::write(&registry_path, "{ invalid json").unwrap();

        env::set_current_dir(&workspace_root).unwrap();

        let result = opencow_self_repair_enabled_skills_registry(
            "diagnose opencow and continue repairing its enabled skills registry".to_string(),
        )
        .unwrap();

        env::set_current_dir(&original_dir).unwrap();

        let repaired = fs::read_to_string(&registry_path).unwrap();
        let parsed: Value = serde_json::from_str(&repaired).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(result.repair_target, "enabled-skills-registry".to_string());
        assert_eq!(result.repaired_path, ".opencow/skills/enabled-skills.json".to_string());
        assert_eq!(result.status, "repaired".to_string());
        assert_eq!(result.preserved_entry_count, 0);
        assert_eq!(result.verified_version, 1);
        assert_eq!(result.verified_entry_count, 0);
        assert_eq!(parsed.get("version").and_then(Value::as_u64), Some(1));
        assert!(parsed.get("enabled_skills").and_then(Value::as_array).is_some());
    }

    #[test]
    fn workspace_project_run_preview_matches_app_with_dev_script_and_expected_url() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-workspace-run-preview-{unique}"));
        let app_dir = workspace_root.join("apps/desktop");
        let package_dir = workspace_root.join("packages/openclaw-adapter");
        let docs_dir = workspace_root.join("docs");

        fs::create_dir_all(&app_dir).unwrap();
        fs::create_dir_all(&package_dir).unwrap();
        fs::create_dir_all(&docs_dir).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            concat!(
                "{\n",
                "  \"name\": \"opencow\",\n",
                "  \"scripts\": {\n",
                "    \"desktop:dev\": \"npm --workspace apps/desktop run tauri:dev\"\n",
                "  }\n",
                "}\n"
            ),
        )
        .unwrap();
        fs::write(
            app_dir.join("package.json"),
            concat!(
                "{\n",
                "  \"name\": \"desktop\",\n",
                "  \"scripts\": {\n",
                "    \"dev\": \"vite\",\n",
                "    \"build\": \"vite build\"\n",
                "  }\n",
                "}\n"
            ),
        )
        .unwrap();
        fs::write(
            package_dir.join("package.json"),
            concat!(
                "{\n",
                "  \"name\": \"openclaw-adapter\",\n",
                "  \"scripts\": {\n",
                "    \"build\": \"tsup\",\n",
                "    \"test\": \"vitest run\"\n",
                "  }\n",
                "}\n"
            ),
        )
        .unwrap();

        env::set_current_dir(&workspace_root).unwrap();

        let result = workspace_project_run_preview("run the desktop app locally".to_string()).unwrap();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(result.inspected_project_count, 3);
        assert_eq!(result.matched_project_name, Some("desktop".to_string()));
        assert_eq!(result.matched_project_path, Some("apps/desktop".to_string()));
        assert_eq!(result.matched_project_source, Some("apps".to_string()));
        assert_eq!(result.dev_command, Some("npm run dev".to_string()));
        assert_eq!(result.build_command, Some("npm run build".to_string()));
        assert_eq!(result.expected_url, Some("http://127.0.0.1:1420".to_string()));
        assert_eq!(result.next_required_permission, "workspace-write".to_string());
    }

    #[test]
    fn workspace_project_run_starts_matched_app_and_returns_handle() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-workspace-run-{unique}"));
        let app_dir = workspace_root.join("apps/desktop");
        let package_dir = workspace_root.join("packages/openclaw-adapter");
        let docs_dir = workspace_root.join("docs");

        fs::create_dir_all(&app_dir).unwrap();
        fs::create_dir_all(&package_dir).unwrap();
        fs::create_dir_all(&docs_dir).unwrap();
        fs::write(workspace_root.join("package.json"), "{\n  \"name\": \"opencow\"\n}\n").unwrap();
        fs::write(
            app_dir.join("package.json"),
            concat!(
                "{\n",
                "  \"name\": \"desktop\",\n",
                "  \"scripts\": {\n",
                "    \"dev\": \"node -e \\\"console.log('desktop-started')\\\"\"\n",
                "  }\n",
                "}\n"
            ),
        )
        .unwrap();
        fs::write(
            package_dir.join("package.json"),
            concat!(
                "{\n",
                "  \"name\": \"openclaw-adapter\",\n",
                "  \"scripts\": {\n",
                "    \"build\": \"tsup\"\n",
                "  }\n",
                "}\n"
            ),
        )
        .unwrap();

        env::set_current_dir(&workspace_root).unwrap();

        let result = workspace_project_run("run the desktop app locally".to_string()).unwrap();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(result.project_name, "desktop".to_string());
        assert_eq!(result.project_path, "apps/desktop".to_string());
        assert_eq!(result.command_label, "npm run dev".to_string());
        assert_eq!(result.working_directory, "apps/desktop".to_string());
        assert_eq!(result.expected_url, Some("http://127.0.0.1:1420".to_string()));
        assert!(result.pid > 0);
        assert!(result.stdout_preview.contains("pid:"));
    }

    #[test]
    fn workspace_project_status_reports_active_runtime_handle_for_matched_app() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-workspace-status-{unique}"));
        let app_dir = workspace_root.join("apps/desktop");
        let package_dir = workspace_root.join("packages/openclaw-adapter");
        let docs_dir = workspace_root.join("docs");

        fs::create_dir_all(&app_dir).unwrap();
        fs::create_dir_all(&package_dir).unwrap();
        fs::create_dir_all(&docs_dir).unwrap();
        fs::write(workspace_root.join("package.json"), "{\n  \"name\": \"opencow\"\n}\n").unwrap();
        fs::write(
            app_dir.join("package.json"),
            concat!(
                "{\n",
                "  \"name\": \"desktop\",\n",
                "  \"scripts\": {\n",
                "    \"dev\": \"node -e \\\"setTimeout(() => {}, 60000)\\\"\"\n",
                "  }\n",
                "}\n"
            ),
        )
        .unwrap();
        fs::write(
            package_dir.join("package.json"),
            concat!(
                "{\n",
                "  \"name\": \"openclaw-adapter\",\n",
                "  \"scripts\": {\n",
                "    \"build\": \"tsup\"\n",
                "  }\n",
                "}\n"
            ),
        )
        .unwrap();

        env::set_current_dir(&workspace_root).unwrap();

        let run_result = workspace_project_run("run the desktop app locally".to_string()).unwrap();
        let status_result = workspace_project_status("show the status of the desktop app local run".to_string()).unwrap();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(status_result.project_name, "desktop".to_string());
        assert_eq!(status_result.project_path, "apps/desktop".to_string());
        assert_eq!(status_result.command_label, "npm run dev".to_string());
        assert_eq!(status_result.working_directory, "apps/desktop".to_string());
        assert_eq!(status_result.expected_url, Some("http://127.0.0.1:1420".to_string()));
        assert_eq!(status_result.pid, Some(run_result.pid));
        assert_eq!(status_result.status, "running".to_string());
        assert!(status_result.stdout_preview.contains("running:"));
    }

    #[test]
    fn workspace_project_status_recovers_runtime_registry_from_invalid_json() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-workspace-status-repair-{unique}"));
        let app_dir = workspace_root.join("apps/desktop");
        let package_dir = workspace_root.join("packages/openclaw-adapter");
        let docs_dir = workspace_root.join("docs");
        let runtime_registry_path = workspace_root
            .join(".opencow")
            .join("runtime")
            .join("workspace-project-runs.json");

        fs::create_dir_all(&app_dir).unwrap();
        fs::create_dir_all(&package_dir).unwrap();
        fs::create_dir_all(&docs_dir).unwrap();
        fs::create_dir_all(runtime_registry_path.parent().unwrap()).unwrap();
        fs::write(workspace_root.join("package.json"), "{\n  \"name\": \"opencow\"\n}\n").unwrap();
        fs::write(
            app_dir.join("package.json"),
            concat!(
                "{\n",
                "  \"name\": \"desktop\",\n",
                "  \"scripts\": {\n",
                "    \"dev\": \"node -e \\\"console.log('desktop-started')\\\"\"\n",
                "  }\n",
                "}\n"
            ),
        )
        .unwrap();
        fs::write(
            package_dir.join("package.json"),
            concat!(
                "{\n",
                "  \"name\": \"openclaw-adapter\",\n",
                "  \"scripts\": {\n",
                "    \"build\": \"tsup\"\n",
                "  }\n",
                "}\n"
            ),
        )
        .unwrap();
        fs::write(&runtime_registry_path, "{ invalid json").unwrap();

        env::set_current_dir(&workspace_root).unwrap();

        let status_result = workspace_project_status("show the status of the desktop app local run".to_string()).unwrap();

        env::set_current_dir(&original_dir).unwrap();

        let repaired = fs::read_to_string(&runtime_registry_path).unwrap();
        let parsed: Value = serde_json::from_str(&repaired).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(status_result.project_name, "desktop".to_string());
        assert_eq!(status_result.project_path, "apps/desktop".to_string());
        assert_eq!(status_result.status, "stopped".to_string());
        assert_eq!(parsed.get("version").and_then(Value::as_u64), Some(1));
        assert!(parsed.get("runs").and_then(Value::as_array).is_some());
    }

    #[test]
    fn workspace_project_status_migrates_legacy_runtime_registry_records() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-workspace-status-migrate-{unique}"));
        let app_dir = workspace_root.join("apps/desktop");
        let package_dir = workspace_root.join("packages/openclaw-adapter");
        let docs_dir = workspace_root.join("docs");
        let runtime_registry_path = workspace_root
            .join(".opencow")
            .join("runtime")
            .join("workspace-project-runs.json");

        fs::create_dir_all(&app_dir).unwrap();
        fs::create_dir_all(&package_dir).unwrap();
        fs::create_dir_all(&docs_dir).unwrap();
        fs::create_dir_all(runtime_registry_path.parent().unwrap()).unwrap();
        fs::write(workspace_root.join("package.json"), "{\n  \"name\": \"opencow\"\n}\n").unwrap();
        fs::write(
            app_dir.join("package.json"),
            concat!(
                "{\n",
                "  \"name\": \"desktop\",\n",
                "  \"scripts\": {\n",
                "    \"dev\": \"node -e \\\"console.log('desktop-started')\\\"\"\n",
                "  }\n",
                "}\n"
            ),
        )
        .unwrap();
        fs::write(
            package_dir.join("package.json"),
            concat!(
                "{\n",
                "  \"name\": \"openclaw-adapter\",\n",
                "  \"scripts\": {\n",
                "    \"build\": \"tsup\"\n",
                "  }\n",
                "}\n"
            ),
        )
        .unwrap();
        fs::write(
            &runtime_registry_path,
            concat!(
                "[\n",
                "  {\n",
                "    \"project_name\": \"desktop\",\n",
                "    \"project_path\": \"apps/desktop\",\n",
                "    \"command_label\": \"npm run dev\",\n",
                "    \"working_directory\": \"apps/desktop\",\n",
                "    \"pid\": ",
                stringify!(0),
                "  }\n",
                "]\n"
            ),
        )
        .unwrap();

        let current_pid = std::process::id();
        let legacy_registry = format!(
            "[\n  {{\n    \"project_name\": \"desktop\",\n    \"project_path\": \"apps/desktop\",\n    \"command_label\": \"npm run dev\",\n    \"working_directory\": \"apps/desktop\",\n    \"pid\": {}\n  }}\n]\n",
            current_pid
        );
        fs::write(&runtime_registry_path, legacy_registry).unwrap();

        env::set_current_dir(&workspace_root).unwrap();

        let status_result = workspace_project_status("show the status of the desktop app local run".to_string()).unwrap();

        env::set_current_dir(&original_dir).unwrap();

        let repaired = fs::read_to_string(&runtime_registry_path).unwrap();
        let parsed: Value = serde_json::from_str(&repaired).unwrap();
        let runs = parsed.get("runs").and_then(Value::as_array).cloned().unwrap_or_default();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(status_result.project_name, "desktop".to_string());
        assert_eq!(status_result.project_path, "apps/desktop".to_string());
        assert_eq!(status_result.status, "running".to_string());
        assert_eq!(parsed.get("version").and_then(Value::as_u64), Some(1));
        assert_eq!(runs.len(), 1);
        assert_eq!(runs[0].get("project_path").and_then(Value::as_str), Some("apps/desktop"));
    }

    #[test]
    fn workspace_project_stop_stops_matched_app_and_clears_runtime_handle() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-workspace-stop-{unique}"));
        let app_dir = workspace_root.join("apps/desktop");
        let package_dir = workspace_root.join("packages/openclaw-adapter");
        let docs_dir = workspace_root.join("docs");

        fs::create_dir_all(&app_dir).unwrap();
        fs::create_dir_all(&package_dir).unwrap();
        fs::create_dir_all(&docs_dir).unwrap();
        fs::write(workspace_root.join("package.json"), "{\n  \"name\": \"opencow\"\n}\n").unwrap();
        fs::write(
            app_dir.join("package.json"),
            concat!(
                "{\n",
                "  \"name\": \"desktop\",\n",
                "  \"scripts\": {\n",
                "    \"dev\": \"node -e \\\"setTimeout(() => {}, 60000)\\\"\"\n",
                "  }\n",
                "}\n"
            ),
        )
        .unwrap();
        fs::write(
            package_dir.join("package.json"),
            concat!(
                "{\n",
                "  \"name\": \"openclaw-adapter\",\n",
                "  \"scripts\": {\n",
                "    \"build\": \"tsup\"\n",
                "  }\n",
                "}\n"
            ),
        )
        .unwrap();

        env::set_current_dir(&workspace_root).unwrap();

        let run_result = workspace_project_run("run the desktop app locally".to_string()).unwrap();
        let stop_result = workspace_project_stop("stop the desktop app local run".to_string()).unwrap();
        let registry_records = read_workspace_project_runtime_records(&workspace_root).unwrap();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(stop_result.project_name, "desktop".to_string());
        assert_eq!(stop_result.project_path, "apps/desktop".to_string());
        assert_eq!(stop_result.command_label, "npm run dev".to_string());
        assert_eq!(stop_result.working_directory, "apps/desktop".to_string());
        assert_eq!(stop_result.pid, run_result.pid);
        assert_eq!(stop_result.status, "stopped".to_string());
        assert!(stop_result.stdout_preview.contains("stopped:"));
        assert!(registry_records.is_empty());
    }
}
