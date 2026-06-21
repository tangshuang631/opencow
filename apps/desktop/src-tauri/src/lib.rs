mod chat_attachments;
mod ollama;
mod rollback_files;
mod workbench_state;
mod workspace;

#[cfg(not(target_os = "macos"))]
use tauri::Emitter;
use tauri::{Manager, WindowEvent};

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

    if let Some(window) = app.get_webview_window("main") {
        #[cfg(target_os = "macos")]
        {
            let app_handle = app.handle().clone();
            window.on_window_event(move |event| {
                if matches!(event, WindowEvent::CloseRequested { .. }) {
                    app_handle.exit(0);
                }
            });
        }

        #[cfg(not(target_os = "macos"))]
        {
            let emit_window = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = emit_window.emit("app_close_requested", ());
                }
            });
        }
    }

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
            chat_attachments::chat_attachments_pick,
            chat_attachments::chat_attachment_open,
            workspace::knowledge_file_import,
            workspace::knowledge_file_remove,
            workspace::knowledge_imports_clear,
            workspace::knowledge_library_create,
            workspace::knowledge_library_select,
            workspace::knowledge_inventory,
            workspace::network_search,
            workspace::local_knowledge_search,
            workspace::local_mcp_plugin_inspect,
            workspace::local_mcp_plugin_install,
            workspace::local_mcp_plugin_start,
            workspace::local_mcp_plugin_start_preview,
            workspace::local_mcp_plugin_scan,
            workspace::local_mcp_plugin_uninstall,
            workspace::local_enabled_skill_list,
            workspace::local_enabled_skill_match,
            workspace::local_skill_disable,
            workspace::local_skill_enable,
            workspace::local_skill_install,
            workspace::recommended_mcp_manifest,
            workspace::recommended_skill_manifest,
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
            workspace::workspace_npc_configs_list,
            workspace::workspace_npc_config_read,
            workspace::workspace_npc_config_create,
            workspace::workspace_npc_config_update,
            workspace::workspace_npc_config_write,
            workspace::workspace_readonly_command,
            rollback_files::rollback_files_restore,
            workbench_state::workbench_state_load,
            workbench_state::workbench_state_save,
            workbench_state::workbench_state_clear
        ])
        .run(tauri::generate_context!())
        .expect("failed to run opencow desktop");
}
