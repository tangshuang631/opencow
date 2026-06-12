mod ollama;
mod workspace;

use tauri::Manager;

#[tauri::command]
fn health() -> &'static str {
    "ok"
}

fn create_main_window(app: &mut tauri::App) -> tauri::Result<()> {
    let window_config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "main")
        .ok_or_else(|| tauri::Error::WindowLabelAlreadyExists("main".into()))?;
    let data_directory = window_config
        .data_directory
        .clone()
        .unwrap_or_else(|| "dev-webview".into());
    let webview_data_directory = app
        .path()
        .app_local_data_dir()?
        .join(&window_config.label)
        .join(data_directory);

    tauri::WebviewWindowBuilder::from_config(app, window_config)?
        .data_directory(webview_data_directory)
        .build()?;

    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            create_main_window(app)?;
            Ok(())
        })
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
            workspace::opencow_self_repair_workspace_project_runtime_registry,
            workspace::local_skill_scan,
            workspace::local_skill_inspect,
            workspace::openclaw_capability_overview,
            ollama::ollama_cancel_chat,
            ollama::ollama_chat,
            ollama::ollama_overview,
            workspace::controlled_full_command,
            workspace::workspace_overview,
            workspace::workspace_project_run,
            workspace::workspace_project_npc_screenshot_capture,
            workspace::workspace_project_npc_showcase_publish_preview,
            workspace::workspace_project_npc_showcase_site_write,
            workspace::workspace_project_status,
            workspace::workspace_project_stop,
            workspace::workspace_project_run_preview,
            workspace::workspace_write_command,
            workspace::workspace_packages_overview,
            workspace::workspace_config_overview,
            workspace::workspace_npc_config_write,
            workspace::workspace_readonly_command
        ])
        .run(tauri::generate_context!())
        .expect("failed to run opencow desktop");
}
