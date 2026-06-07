mod ollama;
mod workspace;

#[tauri::command]
fn health() -> &'static str {
    "ok"
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            health,
            workspace::local_knowledge_search,
            workspace::local_mcp_plugin_inspect,
            workspace::local_mcp_plugin_start,
            workspace::local_mcp_plugin_start_preview,
            workspace::local_mcp_plugin_scan,
            workspace::local_enabled_skill_list,
            workspace::local_enabled_skill_match,
            workspace::local_skill_disable,
            workspace::local_skill_enable,
            workspace::local_skill_install,
            workspace::opencow_self_repair_enabled_skills_registry,
            workspace::local_skill_scan,
            workspace::local_skill_inspect,
            workspace::openclaw_capability_overview,
            ollama::ollama_overview,
            workspace::controlled_full_command,
            workspace::workspace_overview,
            workspace::workspace_project_run,
            workspace::workspace_project_status,
            workspace::workspace_project_stop,
            workspace::workspace_project_run_preview,
            workspace::workspace_write_command,
            workspace::workspace_packages_overview,
            workspace::workspace_config_overview,
            workspace::workspace_readonly_command
        ])
        .run(tauri::generate_context!())
        .expect("failed to run opencow desktop");
}
