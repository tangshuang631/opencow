use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RollbackContextPayload {
    pub conversation_id: String,
    pub rollback_entry_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RollbackFilesRestorePayload {
    pub conversation_id: String,
    pub target_entry_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RollbackFilesRestoreResult {
    pub restored_path_count: usize,
    pub pruned_snapshot_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RollbackTreeEntry {
    relative_path: String,
    kind: String,
    content_base64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RollbackSnapshotRecord {
    conversation_id: String,
    rollback_entry_id: String,
    rollback_entry_ordinal: usize,
    path: String,
    kind: String,
    content_base64: Option<String>,
    tree_entries: Vec<RollbackTreeEntry>,
    recorded_at: String,
    size_bytes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RollbackSnapshotStore {
    version: usize,
    records: Vec<RollbackSnapshotRecord>,
}

fn rollback_snapshot_store_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|dir| dir.join("rollback").join("file-snapshots.json"))
        .map_err(|error| format!("failed to resolve rollback snapshot path: {error}"))
}

fn read_snapshot_store(path: &Path) -> Result<RollbackSnapshotStore, String> {
    match fs::read_to_string(path) {
        Ok(raw) => serde_json::from_str(&raw)
            .map_err(|error| format!("failed to parse {}: {error}", path.display())),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(RollbackSnapshotStore {
            version: 1,
            records: Vec::new(),
        }),
        Err(error) => Err(format!("failed to read {}: {error}", path.display())),
    }
}

fn write_snapshot_store(path: &Path, store: &RollbackSnapshotStore) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }

    let serialized = serde_json::to_string_pretty(store)
        .map_err(|error| format!("failed to serialize rollback snapshot store: {error}"))?;
    fs::write(path, format!("{serialized}\n"))
        .map_err(|error| format!("failed to write {}: {error}", path.display()))
}

fn parse_entry_ordinal(entry_id: &str) -> usize {
    entry_id
        .rsplit('-')
        .next()
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(0)
}

fn current_recorded_at() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_secs().to_string(),
        Err(_) => "0".to_string(),
    }
}

fn collect_directory_tree(root: &Path, current: &Path, entries: &mut Vec<RollbackTreeEntry>) -> Result<usize, String> {
    let mut size_bytes = 0usize;
    let relative = current
        .strip_prefix(root)
        .map_err(|error| format!("failed to build relative rollback tree entry for {}: {error}", current.display()))?;
    let relative_string = if relative.as_os_str().is_empty() {
        ".".to_string()
    } else {
        relative.to_string_lossy().replace('\\', "/")
    };
    entries.push(RollbackTreeEntry {
        relative_path: relative_string,
        kind: "directory".to_string(),
        content_base64: None,
    });

    let children = fs::read_dir(current)
        .map_err(|error| format!("failed to read rollback directory {}: {error}", current.display()))?;
    for child in children {
        let child = child
            .map_err(|error| format!("failed to read rollback directory entry under {}: {error}", current.display()))?;
        let child_path = child.path();
        let metadata = fs::metadata(&child_path)
            .map_err(|error| format!("failed to stat rollback path {}: {error}", child_path.display()))?;
        if metadata.is_dir() {
            size_bytes += collect_directory_tree(root, &child_path, entries)?;
            continue;
        }

        let bytes = fs::read(&child_path)
            .map_err(|error| format!("failed to read rollback file {}: {error}", child_path.display()))?;
        size_bytes += bytes.len();
        let relative = child_path
            .strip_prefix(root)
            .map_err(|error| format!("failed to build relative rollback file entry for {}: {error}", child_path.display()))?;
        entries.push(RollbackTreeEntry {
            relative_path: relative.to_string_lossy().replace('\\', "/"),
            kind: "file".to_string(),
            content_base64: Some(BASE64_STANDARD.encode(bytes)),
        });
    }

    Ok(size_bytes)
}

fn build_snapshot_record(
    context: &RollbackContextPayload,
    path: &Path,
) -> Result<RollbackSnapshotRecord, String> {
    let rollback_entry_ordinal = parse_entry_ordinal(&context.rollback_entry_id);
    let recorded_at = current_recorded_at();
    let path_string = path.to_string_lossy().to_string();

    match fs::metadata(path) {
        Ok(metadata) if metadata.is_dir() => {
            let mut tree_entries = Vec::new();
            let size_bytes = collect_directory_tree(path, path, &mut tree_entries)?;
            Ok(RollbackSnapshotRecord {
                conversation_id: context.conversation_id.clone(),
                rollback_entry_id: context.rollback_entry_id.clone(),
                rollback_entry_ordinal,
                path: path_string,
                kind: "directory".to_string(),
                content_base64: None,
                tree_entries,
                recorded_at,
                size_bytes,
            })
        }
        Ok(_) => {
            let bytes = fs::read(path)
                .map_err(|error| format!("failed to read rollback file {}: {error}", path.display()))?;
            Ok(RollbackSnapshotRecord {
                conversation_id: context.conversation_id.clone(),
                rollback_entry_id: context.rollback_entry_id.clone(),
                rollback_entry_ordinal,
                path: path_string,
                kind: "file".to_string(),
                content_base64: Some(BASE64_STANDARD.encode(&bytes)),
                tree_entries: Vec::new(),
                recorded_at,
                size_bytes: bytes.len(),
            })
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(RollbackSnapshotRecord {
            conversation_id: context.conversation_id.clone(),
            rollback_entry_id: context.rollback_entry_id.clone(),
            rollback_entry_ordinal,
            path: path_string,
            kind: "missing".to_string(),
            content_base64: None,
            tree_entries: Vec::new(),
            recorded_at,
            size_bytes: 0,
        }),
        Err(error) => Err(format!("failed to stat rollback path {}: {error}", path.display())),
    }
}

pub fn capture_paths_for_context<R: Runtime>(
    app: &AppHandle<R>,
    rollback_context: &Option<RollbackContextPayload>,
    paths: &[PathBuf],
) -> Result<(), String> {
    let Some(context) = rollback_context else {
        return Ok(());
    };
    if context.conversation_id.trim().is_empty() || context.rollback_entry_id.trim().is_empty() {
        return Ok(());
    }

    let store_path = rollback_snapshot_store_path(app)?;
    let mut store = read_snapshot_store(&store_path)?;

    for path in paths {
        let path_string = path.to_string_lossy().to_string();
        let already_recorded = store.records.iter().any(|record| {
            record.conversation_id == context.conversation_id
                && record.rollback_entry_id == context.rollback_entry_id
                && record.path == path_string
        });
        if already_recorded {
            continue;
        }

        store.records.push(build_snapshot_record(context, path)?);
    }

    write_snapshot_store(&store_path, &store)
}

fn remove_path_if_exists(path: &Path) -> Result<(), String> {
    match fs::metadata(path) {
        Ok(metadata) if metadata.is_dir() => {
            fs::remove_dir_all(path)
                .map_err(|error| format!("failed to remove directory {}: {error}", path.display()))
        }
        Ok(_) => fs::remove_file(path)
            .map_err(|error| format!("failed to remove file {}: {error}", path.display())),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("failed to stat {} before removal: {error}", path.display())),
    }
}

fn restore_snapshot_record(record: &RollbackSnapshotRecord) -> Result<(), String> {
    let path = PathBuf::from(&record.path);
    match record.kind.as_str() {
        "missing" => remove_path_if_exists(&path),
        "file" => {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
            }
            let bytes = BASE64_STANDARD
                .decode(record.content_base64.as_deref().unwrap_or_default())
                .map_err(|error| format!("failed to decode rollback file snapshot for {}: {error}", path.display()))?;
            fs::write(&path, bytes)
                .map_err(|error| format!("failed to restore file {}: {error}", path.display()))
        }
        "directory" => {
            remove_path_if_exists(&path)?;
            fs::create_dir_all(&path)
                .map_err(|error| format!("failed to recreate directory {}: {error}", path.display()))?;
            let mut directories = record
                .tree_entries
                .iter()
                .filter(|entry| entry.kind == "directory")
                .collect::<Vec<_>>();
            directories.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
            for entry in directories {
                let entry_path = if entry.relative_path == "." {
                    path.clone()
                } else {
                    path.join(&entry.relative_path)
                };
                fs::create_dir_all(&entry_path)
                    .map_err(|error| format!("failed to recreate directory {}: {error}", entry_path.display()))?;
            }

            let mut files = record
                .tree_entries
                .iter()
                .filter(|entry| entry.kind == "file")
                .collect::<Vec<_>>();
            files.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
            for entry in files {
                let entry_path = path.join(&entry.relative_path);
                if let Some(parent) = entry_path.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
                }
                let bytes = BASE64_STANDARD
                    .decode(entry.content_base64.as_deref().unwrap_or_default())
                    .map_err(|error| format!("failed to decode rollback tree file snapshot for {}: {error}", entry_path.display()))?;
                fs::write(&entry_path, bytes)
                    .map_err(|error| format!("failed to restore file {}: {error}", entry_path.display()))?;
            }
            Ok(())
        }
        other => Err(format!("unsupported rollback snapshot kind for {}: {other}", path.display())),
    }
}

#[tauri::command]
pub fn rollback_files_restore(
    app: AppHandle,
    payload: RollbackFilesRestorePayload,
) -> Result<RollbackFilesRestoreResult, String> {
    let store_path = rollback_snapshot_store_path(&app)?;
    let mut store = read_snapshot_store(&store_path)?;
    let target_ordinal = parse_entry_ordinal(&payload.target_entry_id);
    let matching_records = store
        .records
        .iter()
        .filter(|record| {
            record.conversation_id == payload.conversation_id
                && record.rollback_entry_ordinal > target_ordinal
        })
        .cloned()
        .collect::<Vec<_>>();

    let mut earliest_by_path = HashMap::<String, RollbackSnapshotRecord>::new();
    for record in matching_records {
        match earliest_by_path.get(&record.path) {
            Some(existing) if existing.rollback_entry_ordinal <= record.rollback_entry_ordinal => {}
            _ => {
                earliest_by_path.insert(record.path.clone(), record);
            }
        }
    }

    let mut restore_records = earliest_by_path.into_values().collect::<Vec<_>>();
    restore_records.sort_by(|left, right| {
        left.rollback_entry_ordinal
            .cmp(&right.rollback_entry_ordinal)
            .then(left.path.cmp(&right.path))
    });

    for record in &restore_records {
        restore_snapshot_record(record)?;
    }

    let retained_entry_ids = store
        .records
        .iter()
        .filter(|record| {
            record.conversation_id == payload.conversation_id
                && record.rollback_entry_ordinal <= target_ordinal
        })
        .map(|record| record.rollback_entry_id.clone())
        .collect::<HashSet<_>>();
    let previous_len = store.records.len();
    store.records.retain(|record| {
        record.conversation_id != payload.conversation_id
            || retained_entry_ids.contains(&record.rollback_entry_id)
    });
    let pruned_snapshot_count = previous_len.saturating_sub(store.records.len());
    write_snapshot_store(&store_path, &store)?;

    Ok(RollbackFilesRestoreResult {
        restored_path_count: restore_records.len(),
        pruned_snapshot_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("opencow-rollback-{name}-{unique}"))
    }

    fn write_store(path: &Path, records: Vec<RollbackSnapshotRecord>) {
        write_snapshot_store(
            path,
            &RollbackSnapshotStore {
                version: 1,
                records,
            },
        )
        .unwrap();
    }

    fn restore_with_store_path(
        store_path: &Path,
        conversation_id: &str,
        target_entry_id: &str,
    ) -> Result<RollbackFilesRestoreResult, String> {
        let mut store = read_snapshot_store(store_path)?;
        let target_ordinal = parse_entry_ordinal(target_entry_id);
        let matching_records = store
            .records
            .iter()
            .filter(|record| {
                record.conversation_id == conversation_id
                    && record.rollback_entry_ordinal > target_ordinal
            })
            .cloned()
            .collect::<Vec<_>>();
        let mut earliest_by_path = HashMap::<String, RollbackSnapshotRecord>::new();
        for record in matching_records {
            match earliest_by_path.get(&record.path) {
                Some(existing) if existing.rollback_entry_ordinal <= record.rollback_entry_ordinal => {}
                _ => {
                    earliest_by_path.insert(record.path.clone(), record);
                }
            }
        }
        let mut restore_records = earliest_by_path.into_values().collect::<Vec<_>>();
        restore_records.sort_by(|left, right| {
            left.rollback_entry_ordinal
                .cmp(&right.rollback_entry_ordinal)
                .then(left.path.cmp(&right.path))
        });
        for record in &restore_records {
            restore_snapshot_record(record)?;
        }
        let retained_entry_ids = store
            .records
            .iter()
            .filter(|record| {
                record.conversation_id == conversation_id
                    && record.rollback_entry_ordinal <= target_ordinal
            })
            .map(|record| record.rollback_entry_id.clone())
            .collect::<HashSet<_>>();
        let previous_len = store.records.len();
        store.records.retain(|record| {
            record.conversation_id != conversation_id
                || retained_entry_ids.contains(&record.rollback_entry_id)
        });
        let pruned_snapshot_count = previous_len.saturating_sub(store.records.len());
        write_snapshot_store(store_path, &store)?;
        Ok(RollbackFilesRestoreResult {
            restored_path_count: restore_records.len(),
            pruned_snapshot_count,
        })
    }

    #[test]
    fn restores_modified_file_content() {
        let root = temp_dir("modified");
        fs::create_dir_all(&root).unwrap();
        let target = root.join("note.txt");
        fs::write(&target, "changed").unwrap();
        let snapshot = RollbackSnapshotRecord {
            conversation_id: "conversation-a".to_string(),
            rollback_entry_id: "composer-submit-local-task-2".to_string(),
            rollback_entry_ordinal: 2,
            path: target.to_string_lossy().to_string(),
            kind: "file".to_string(),
            content_base64: Some(BASE64_STANDARD.encode("original")),
            tree_entries: Vec::new(),
            recorded_at: "1".to_string(),
            size_bytes: 8,
        };
        let store_path = root.join("store.json");
        write_store(&store_path, vec![snapshot]);

        let result = restore_with_store_path(&store_path, "conversation-a", "composer-submit-local-task-1").unwrap();

        assert_eq!(result.restored_path_count, 1);
        assert_eq!(fs::read_to_string(&target).unwrap(), "original");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn recreates_deleted_directory_tree() {
        let root = temp_dir("directory");
        let target = root.join("temp-output");
        fs::create_dir_all(target.join("nested")).unwrap();
        fs::write(target.join("nested").join("note.txt"), "from snapshot").unwrap();
        let record = build_snapshot_record(
            &RollbackContextPayload {
                conversation_id: "conversation-a".to_string(),
                rollback_entry_id: "composer-submit-local-task-2".to_string(),
            },
            &target,
        )
        .unwrap();
        fs::remove_dir_all(&target).unwrap();
        let store_path = root.join("store.json");
        write_store(&store_path, vec![record]);

        let result = restore_with_store_path(&store_path, "conversation-a", "composer-submit-local-task-1").unwrap();

        assert_eq!(result.restored_path_count, 1);
        assert_eq!(
            fs::read_to_string(target.join("nested").join("note.txt")).unwrap(),
            "from snapshot"
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn removes_new_file_when_snapshot_says_missing() {
        let root = temp_dir("missing");
        fs::create_dir_all(&root).unwrap();
        let target = root.join("generated.txt");
        fs::write(&target, "new").unwrap();
        let store_path = root.join("store.json");
        write_store(
            &store_path,
            vec![RollbackSnapshotRecord {
                conversation_id: "conversation-a".to_string(),
                rollback_entry_id: "composer-submit-local-task-2".to_string(),
                rollback_entry_ordinal: 2,
                path: target.to_string_lossy().to_string(),
                kind: "missing".to_string(),
                content_base64: None,
                tree_entries: Vec::new(),
                recorded_at: "1".to_string(),
                size_bytes: 0,
            }],
        );

        let result = restore_with_store_path(&store_path, "conversation-a", "composer-submit-local-task-1").unwrap();

        assert_eq!(result.restored_path_count, 1);
        assert!(!target.exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn keeps_only_first_snapshot_for_same_path_after_restore() {
        let root = temp_dir("dedup");
        fs::create_dir_all(&root).unwrap();
        let target = root.join("note.txt");
        fs::write(&target, "latest").unwrap();
        let store_path = root.join("store.json");
        write_store(
            &store_path,
            vec![
                RollbackSnapshotRecord {
                    conversation_id: "conversation-a".to_string(),
                    rollback_entry_id: "composer-submit-local-task-3".to_string(),
                    rollback_entry_ordinal: 3,
                    path: target.to_string_lossy().to_string(),
                    kind: "file".to_string(),
                    content_base64: Some(BASE64_STANDARD.encode("second")),
                    tree_entries: Vec::new(),
                    recorded_at: "2".to_string(),
                    size_bytes: 6,
                },
                RollbackSnapshotRecord {
                    conversation_id: "conversation-a".to_string(),
                    rollback_entry_id: "composer-submit-local-task-2".to_string(),
                    rollback_entry_ordinal: 2,
                    path: target.to_string_lossy().to_string(),
                    kind: "file".to_string(),
                    content_base64: Some(BASE64_STANDARD.encode("first")),
                    tree_entries: Vec::new(),
                    recorded_at: "1".to_string(),
                    size_bytes: 5,
                },
            ],
        );

        restore_with_store_path(&store_path, "conversation-a", "composer-submit-local-task-1").unwrap();

        assert_eq!(fs::read_to_string(&target).unwrap(), "first");
        let _ = fs::remove_dir_all(&root);
    }
}
