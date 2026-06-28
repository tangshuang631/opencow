use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkbenchStateEnvelope {
    version: usize,
    state: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct WorkbenchStateReadResult {
    found: bool,
    payload: Option<WorkbenchStateEnvelope>,
}

fn workbench_state_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|dir| dir.join("workbench-state.json"))
        .map_err(|error| format!("failed to resolve workbench state path: {error}"))
}

#[tauri::command]
pub fn workbench_state_load(app: AppHandle) -> Result<WorkbenchStateReadResult, String> {
    let path = workbench_state_file_path(&app)?;

    match fs::read_to_string(&path) {
        Ok(raw) => {
            let payload: WorkbenchStateEnvelope = serde_json::from_str(&raw)
                .map_err(|error| format!("failed to parse {}: {error}", path.display()))?;

            Ok(WorkbenchStateReadResult {
                found: true,
                payload: Some(payload),
            })
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            Ok(WorkbenchStateReadResult {
                found: false,
                payload: None,
            })
        }
        Err(error) => Err(format!("failed to read {}: {error}", path.display())),
    }
}

#[tauri::command]
pub fn workbench_state_save(app: AppHandle, payload: WorkbenchStateEnvelope) -> Result<(), String> {
    let path = workbench_state_file_path(&app)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }

    let serialized = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("failed to serialize workbench state: {error}"))?;
    fs::write(&path, format!("{serialized}\n"))
        .map_err(|error| format!("failed to write {}: {error}", path.display()))
}

#[tauri::command]
pub fn workbench_state_clear(app: AppHandle) -> Result<(), String> {
    let path = workbench_state_file_path(&app)?;

    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("failed to remove {}: {error}", path.display())),
    }
}
