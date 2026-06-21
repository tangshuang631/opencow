use base64::Engine;
use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use std::process::Command;

#[derive(Serialize)]
pub struct PickedChatAttachment {
    id: String,
    name: String,
    mime_type: String,
    size_bytes: u64,
    kind: String,
    file_path: String,
    base64_data: Option<String>,
}

fn infer_mime_type(path: &PathBuf) -> String {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png".into(),
        "jpg" | "jpeg" => "image/jpeg".into(),
        "gif" => "image/gif".into(),
        "webp" => "image/webp".into(),
        "pdf" => "application/pdf".into(),
        "txt" => "text/plain".into(),
        "md" => "text/markdown".into(),
        _ => "application/octet-stream".into(),
    }
}

fn infer_kind(mime_type: &str) -> String {
    if mime_type.starts_with("image/") {
        "image".into()
    } else {
        "file".into()
    }
}

fn create_attachment_id(path: &PathBuf) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    format!("native-{:x}", hasher.finish())
}

fn read_image_base64(path: &PathBuf, mime_type: &str) -> Option<String> {
    if !mime_type.starts_with("image/") {
        return None;
    }

    let bytes = std::fs::read(path).ok()?;
    Some(base64::engine::general_purpose::STANDARD.encode(bytes))
}

fn pick_attachment_paths() -> Result<Vec<PathBuf>, String> {
    #[cfg(target_os = "macos")]
    {
        let script = r#"set chosenFiles to choose file with multiple selections allowed true with prompt "选择聊天附件"
set outputLines to {}
repeat with chosenFile in chosenFiles
  set end of outputLines to POSIX path of chosenFile
end repeat
set AppleScript's text item delimiters to linefeed
outputLines as text"#;
        let output = Command::new("osascript")
            .args(["-e", script])
            .output()
            .map_err(|error| error.to_string())?;

        if !output.status.success() {
            return Ok(vec![]);
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        return Ok(stdout
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .map(PathBuf::from)
            .collect());
    }

    #[cfg(target_os = "windows")]
    {
        let script = r#"
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Multiselect = $true
$dialog.Title = '选择聊天附件'
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $dialog.FileNames -join \"`n\"
}
"#;
        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", script])
            .output()
            .map_err(|error| error.to_string())?;

        if !output.status.success() {
            return Ok(vec![]);
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        return Ok(stdout
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .map(PathBuf::from)
            .collect());
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        Err("Picking attachments is not supported on this platform yet.".into())
    }
}

#[tauri::command]
pub fn chat_attachments_pick() -> Result<Vec<PickedChatAttachment>, String> {
    let paths = pick_attachment_paths()?;
    if paths.is_empty() {
        return Ok(vec![]);
    }

    let attachments = paths
        .into_iter()
        .filter_map(|path| {
            let metadata = std::fs::metadata(&path).ok()?;
            let mime_type = infer_mime_type(&path);
            let name = path.file_name()?.to_string_lossy().to_string();

            Some(PickedChatAttachment {
                id: create_attachment_id(&path),
                name,
                mime_type: mime_type.clone(),
                size_bytes: metadata.len(),
                kind: infer_kind(&mime_type),
                file_path: path.to_string_lossy().to_string(),
                base64_data: read_image_base64(&path, &mime_type),
            })
        })
        .collect();

    Ok(attachments)
}

#[tauri::command]
pub fn chat_attachment_open(file_path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let status = Command::new("open")
        .arg(&file_path)
        .status()
        .map_err(|error| error.to_string())?;

    #[cfg(target_os = "windows")]
    let status = Command::new("cmd")
        .args(["/C", "start", "", &file_path])
        .status()
        .map_err(|error| error.to_string())?;

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let status = Command::new("xdg-open")
        .arg(&file_path)
        .status()
        .map_err(|error| error.to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("Failed to open attachment: {}", file_path))
    }
}
