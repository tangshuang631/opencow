use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const MEMORY_SCHEMA_VERSION: i64 = 2;
const MAX_MEMORY_CONTENT_CHARS: usize = 2_000;
const MAX_MEMORY_QUERY_CHARS: usize = 512;
const MEMORY_SEARCH_LIMIT: i64 = 5;
const TODO_TTL_MS: i64 = 30 * 24 * 60 * 60 * 1_000;
const PROJECT_FACT_TTL_MS: i64 = 90 * 24 * 60 * 60 * 1_000;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum MemoryScope {
    User,
    Workspace,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum MemoryKind {
    Preference,
    Profile,
    ProjectFact,
    Todo,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum MemoryProvenance {
    DirectUser,
    UserSelectedContent,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum MemoryProposalReason {
    ExplicitUserRequest,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum MemoryWriteAuthority {
    TopLevelUser,
    ModelSuggestion,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum MemoryTrust {
    Untrusted,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum MemoryInstructionAuthority {
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryProposal {
    pub scope: MemoryScope,
    pub kind: MemoryKind,
    pub content: String,
    pub confidence: f64,
    pub reason: MemoryProposalReason,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemorySaveRequest {
    pub proposal: MemoryProposal,
    pub source_conversation_id: String,
    pub source_message_id: String,
    pub provenance: MemoryProvenance,
    pub authority: MemoryWriteAuthority,
    #[serde(default)]
    pub enabled: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryEditRequest {
    pub id: String,
    pub proposal: MemoryProposal,
    pub authority: MemoryWriteAuthority,
    #[serde(default)]
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryItem {
    pub id: String,
    pub scope: MemoryScope,
    pub kind: MemoryKind,
    pub content: String,
    pub source_conversation_id: String,
    pub source_message_id: String,
    pub provenance: MemoryProvenance,
    pub content_hash: String,
    pub confidence: f64,
    pub created_at: String,
    pub updated_at: String,
    pub expires_at: Option<String>,
    pub revoked_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemorySearchRequest {
    pub query: String,
    pub scope: Option<MemoryScope>,
    #[serde(default)]
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryContextItem {
    pub id: String,
    pub scope: MemoryScope,
    pub kind: MemoryKind,
    pub content: String,
    pub content_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryContextEnvelope {
    pub trust: MemoryTrust,
    pub instruction_authority: MemoryInstructionAuthority,
    pub items: Vec<MemoryContextItem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MemoryExport {
    schema_version: &'static str,
    items: Vec<MemoryItem>,
}

#[tauri::command]
pub fn memory_save(app: AppHandle, request: MemorySaveRequest) -> Result<MemoryItem, String> {
    let connection = open_memory_for_app(&app)?;
    save_memory_for_connection(&connection, request, now_millis(), true)
}

#[tauri::command]
pub fn memory_edit(app: AppHandle, request: MemoryEditRequest) -> Result<MemoryItem, String> {
    let connection = open_memory_for_app(&app)?;
    edit_memory_for_connection(
        &connection,
        &request.id,
        request.proposal,
        request.authority,
        request.enabled,
        now_millis(),
    )
}

#[tauri::command]
pub fn memory_search(
    app: AppHandle,
    request: MemorySearchRequest,
) -> Result<MemoryContextEnvelope, String> {
    let connection = open_memory_for_app(&app)?;
    search_memory_for_connection(
        &connection,
        &request.query,
        request.scope,
        now_millis(),
        request.enabled,
    )
}

#[tauri::command]
pub fn memory_list(app: AppHandle, scope: Option<MemoryScope>) -> Result<Vec<MemoryItem>, String> {
    let connection = open_memory_for_app(&app)?;
    list_memory_for_connection(&connection, scope)
}

#[tauri::command]
pub fn memory_revoke(app: AppHandle, id: String) -> Result<(), String> {
    let connection = open_memory_for_app(&app)?;
    revoke_memory_for_connection(&connection, &id, now_millis())
}

#[tauri::command]
pub fn memory_export(app: AppHandle) -> Result<String, String> {
    let connection = open_memory_for_app(&app)?;
    export_memory_for_connection(&connection)
}

#[tauri::command]
pub fn memory_clear(app: AppHandle) -> Result<(), String> {
    let connection = open_memory_for_app(&app)?;
    clear_memory_for_connection(&connection)
}

fn open_memory_for_app(app: &AppHandle) -> Result<Connection, String> {
    let path = app
        .path()
        .app_local_data_dir()
        .map(|dir| dir.join("memory.sqlite3"))
        .map_err(|error| format!("failed to resolve memory database path: {error}"))?;
    open_memory_connection(&path)
}

fn open_memory_connection(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create memory database directory: {error}"))?;
    }
    let connection = Connection::open(path)
        .map_err(|error| format!("failed to open memory database: {error}"))?;
    initialize_schema(&connection)?;
    Ok(connection)
}

fn initialize_schema(connection: &Connection) -> Result<(), String> {
    let version: i64 = connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(|error| format!("failed to read memory schema version: {error}"))?;
    if version > MEMORY_SCHEMA_VERSION {
        return Err(format!("memory database schema {version} is newer than supported version {MEMORY_SCHEMA_VERSION}"));
    }
    if version == MEMORY_SCHEMA_VERSION {
        return Ok(());
    }

    if version == 0 {
        connection
            .execute_batch(
                "PRAGMA foreign_keys = ON;
             PRAGMA journal_mode = WAL;
             CREATE TABLE IF NOT EXISTS memory_items (
               id TEXT PRIMARY KEY,
               scope TEXT NOT NULL CHECK (scope IN ('user', 'workspace')),
               kind TEXT NOT NULL CHECK (kind IN ('preference', 'profile', 'project-fact', 'todo')),
               content TEXT NOT NULL,
               source_conversation_id TEXT NOT NULL,
               source_message_id TEXT NOT NULL,
               provenance TEXT NOT NULL CHECK (provenance IN ('direct-user', 'user-selected-content')),
               content_hash TEXT NOT NULL,
               confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
               created_at TEXT NOT NULL,
               updated_at TEXT NOT NULL,
               expires_at TEXT,
               revoked_at TEXT
             );
             CREATE INDEX IF NOT EXISTS memory_items_scope_updated_idx ON memory_items(scope, updated_at DESC);
             CREATE VIRTUAL TABLE IF NOT EXISTS memory_items_fts USING fts5(memory_id UNINDEXED, content, tokenize = 'unicode61');",
            )
            .map_err(|error| format!("failed to initialize memory schema: {error}"))?;
    }
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS memory_audit (
               audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
               memory_id TEXT,
               operation TEXT NOT NULL CHECK (operation IN ('save', 'search', 'list', 'edit', 'revoke', 'export', 'clear')),
               result TEXT NOT NULL CHECK (result IN ('ok', 'rejected', 'error')),
               scope TEXT,
               kind TEXT,
               created_at TEXT NOT NULL
             );
             CREATE INDEX IF NOT EXISTS memory_audit_created_idx ON memory_audit(created_at DESC);",
        )
        .map_err(|error| format!("failed to initialize memory audit schema: {error}"))?;
    connection
        .pragma_update(None, "user_version", MEMORY_SCHEMA_VERSION)
        .map_err(|error| format!("failed to write memory schema version: {error}"))
}

fn save_memory_for_connection(
    connection: &Connection,
    request: MemorySaveRequest,
    now: i64,
    enabled: bool,
) -> Result<MemoryItem, String> {
    if !enabled || !request.enabled {
        return reject_memory_write(
            connection,
            &request.proposal,
            "cross-session memory is disabled",
            now,
        );
    }
    if request.authority != MemoryWriteAuthority::TopLevelUser {
        return reject_memory_write(
            connection,
            &request.proposal,
            "memory write requires top-level user authority",
            now,
        );
    }
    let (content, expires_at) = match validate_proposal(&request.proposal, now) {
        Ok(value) => value,
        Err(error) => return reject_memory_write(connection, &request.proposal, error, now),
    };
    let source_conversation_id = match normalize_required(
        &request.source_conversation_id,
        "source conversation id",
        256,
    ) {
        Ok(value) => value,
        Err(error) => return reject_memory_write(connection, &request.proposal, error, now),
    };
    let source_message_id =
        match normalize_required(&request.source_message_id, "source message id", 256) {
            Ok(value) => value,
            Err(error) => return reject_memory_write(connection, &request.proposal, error, now),
        };
    let created_at = now.to_string();
    let content_hash = sha256_hex(&content);
    let id = format!(
        "memory-{}",
        sha256_hex(&format!(
            "{:?}|{:?}|{}|{}|{}|{}",
            request.proposal.scope,
            request.proposal.kind,
            content,
            source_conversation_id,
            source_message_id,
            now
        ))[..24]
            .to_string()
    );
    let item = MemoryItem {
        id,
        scope: request.proposal.scope,
        kind: request.proposal.kind,
        content,
        source_conversation_id,
        source_message_id,
        provenance: request.provenance,
        content_hash,
        confidence: request.proposal.confidence,
        created_at: created_at.clone(),
        updated_at: created_at,
        expires_at,
        revoked_at: None,
    };

    connection
        .execute_batch("BEGIN IMMEDIATE")
        .map_err(|error| format!("failed to begin memory write: {error}"))?;
    let result = (|| {
        connection.execute(
            "INSERT OR REPLACE INTO memory_items (id, scope, kind, content, source_conversation_id, source_message_id, provenance, content_hash, confidence, created_at, updated_at, expires_at, revoked_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                item.id,
                scope_value(item.scope),
                kind_value(item.kind),
                item.content,
                item.source_conversation_id,
                item.source_message_id,
                provenance_value(item.provenance),
                item.content_hash,
                item.confidence,
                item.created_at,
                item.updated_at,
                item.expires_at,
                item.revoked_at
            ],
        )?;
        connection.execute(
            "DELETE FROM memory_items_fts WHERE memory_id = ?1",
            params![item.id],
        )?;
        connection.execute(
            "INSERT INTO memory_items_fts (memory_id, content) VALUES (?1, ?2)",
            params![item.id, item.content],
        )?;
        record_memory_audit(
            connection,
            Some(&item.id),
            Some(item.scope),
            Some(item.kind),
            "save",
            "ok",
            now,
        )?;
        Ok::<(), rusqlite::Error>(())
    })();
    match result {
        Ok(()) => {
            connection
                .execute_batch("COMMIT")
                .map_err(|error| format!("failed to commit memory write: {error}"))?;
            Ok(item)
        }
        Err(error) => {
            let _ = connection.execute_batch("ROLLBACK");
            Err(format!("failed to save memory: {error}"))
        }
    }
}

fn edit_memory_for_connection(
    connection: &Connection,
    id: &str,
    proposal: MemoryProposal,
    authority: MemoryWriteAuthority,
    enabled: bool,
    now: i64,
) -> Result<MemoryItem, String> {
    if !enabled {
        return reject_memory_edit(
            connection,
            Some(id),
            &proposal,
            "cross-session memory is disabled",
            now,
        );
    }
    if authority != MemoryWriteAuthority::TopLevelUser {
        return reject_memory_edit(
            connection,
            Some(id),
            &proposal,
            "memory edit requires top-level user authority",
            now,
        );
    }
    let id = match normalize_required(id, "memory id", 256) {
        Ok(value) => value,
        Err(error) => return reject_memory_edit(connection, None, &proposal, error, now),
    };
    let existing = match connection
        .query_row(
            "SELECT id, scope, kind, content, source_conversation_id, source_message_id, provenance, content_hash, confidence, created_at, updated_at, expires_at, revoked_at
             FROM memory_items WHERE id = ?1",
            params![id],
            memory_item_from_row,
        )
        .optional()
        .map_err(|error| format!("failed to load memory for edit: {error}"))?
    {
        Some(item) => item,
        None => {
            return reject_memory_edit(
                connection,
                Some(&id),
                &proposal,
                "memory item was not found",
                now,
            )
        }
    };
    if existing.revoked_at.is_some() {
        return reject_memory_edit(
            connection,
            Some(&id),
            &proposal,
            "revoked memory cannot be edited",
            now,
        );
    }
    let (content, expires_at) = match validate_proposal(&proposal, now) {
        Ok(value) => value,
        Err(error) => return reject_memory_edit(connection, Some(&id), &proposal, error, now),
    };
    let item = MemoryItem {
        id: existing.id,
        scope: proposal.scope,
        kind: proposal.kind,
        content_hash: sha256_hex(&content),
        content,
        source_conversation_id: existing.source_conversation_id,
        source_message_id: existing.source_message_id,
        provenance: existing.provenance,
        confidence: proposal.confidence,
        created_at: existing.created_at,
        updated_at: now.to_string(),
        expires_at,
        revoked_at: None,
    };

    connection
        .execute_batch("BEGIN IMMEDIATE")
        .map_err(|error| format!("failed to begin memory edit: {error}"))?;
    let result = (|| {
        let changed = connection.execute(
            "UPDATE memory_items SET scope = ?1, kind = ?2, content = ?3, content_hash = ?4, confidence = ?5, updated_at = ?6, expires_at = ?7 WHERE id = ?8 AND revoked_at IS NULL",
            params![
                scope_value(item.scope),
                kind_value(item.kind),
                item.content,
                item.content_hash,
                item.confidence,
                item.updated_at,
                item.expires_at,
                item.id,
            ],
        )?;
        if changed != 1 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        connection.execute(
            "DELETE FROM memory_items_fts WHERE memory_id = ?1",
            params![item.id],
        )?;
        connection.execute(
            "INSERT INTO memory_items_fts (memory_id, content) VALUES (?1, ?2)",
            params![item.id, item.content],
        )?;
        record_memory_audit(
            connection,
            Some(&item.id),
            Some(item.scope),
            Some(item.kind),
            "edit",
            "ok",
            now,
        )?;
        Ok::<(), rusqlite::Error>(())
    })();
    match result {
        Ok(()) => {
            connection
                .execute_batch("COMMIT")
                .map_err(|error| format!("failed to commit memory edit: {error}"))?;
            Ok(item)
        }
        Err(error) => {
            let _ = connection.execute_batch("ROLLBACK");
            Err(format!("failed to edit memory: {error}"))
        }
    }
}

fn list_memory_for_connection(
    connection: &Connection,
    scope: Option<MemoryScope>,
) -> Result<Vec<MemoryItem>, String> {
    let scope_filter = scope.map(scope_value);
    let mut statement = connection
        .prepare("SELECT id, scope, kind, content, source_conversation_id, source_message_id, provenance, content_hash, confidence, created_at, updated_at, expires_at, revoked_at FROM memory_items WHERE (?1 IS NULL OR scope = ?1) ORDER BY CAST(updated_at AS INTEGER) DESC, id DESC")
        .map_err(|error| format!("failed to prepare memory list: {error}"))?;
    let rows = statement
        .query_map(params![scope_filter], memory_item_from_row)
        .map_err(|error| format!("failed to list memory: {error}"))?;
    let items = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("failed to decode memory list: {error}"))?;
    record_memory_audit(connection, None, scope, None, "list", "ok", now_millis())
        .map_err(|error| format!("failed to audit memory list: {error}"))?;
    Ok(items)
}

fn search_memory_for_connection(
    connection: &Connection,
    query: &str,
    scope: Option<MemoryScope>,
    now: i64,
    enabled: bool,
) -> Result<MemoryContextEnvelope, String> {
    let empty = || MemoryContextEnvelope {
        trust: MemoryTrust::Untrusted,
        instruction_authority: MemoryInstructionAuthority::None,
        items: Vec::new(),
    };
    if !enabled {
        record_memory_audit(connection, None, scope, None, "search", "ok", now)
            .map_err(|error| format!("failed to audit disabled memory search: {error}"))?;
        return Ok(empty());
    }
    let query = query.trim();
    if query.is_empty() {
        return Err("memory search query is required".to_string());
    }
    let query = query
        .chars()
        .take(MAX_MEMORY_QUERY_CHARS)
        .collect::<String>();
    let scope_filter = scope.map(scope_value);
    let mut items = Vec::new();
    let fts_query = fts_query(&query);
    if let Some(fts_query) = fts_query {
        let statement = connection.prepare(
            "SELECT item.id, item.scope, item.kind, item.content, item.source_conversation_id, item.source_message_id, item.provenance, item.content_hash, item.confidence, item.created_at, item.updated_at, item.expires_at, item.revoked_at
             FROM memory_items_fts AS fts JOIN memory_items AS item ON item.id = fts.memory_id
             WHERE fts.memory_items_fts MATCH ?1 AND (?2 IS NULL OR item.scope = ?2) AND item.revoked_at IS NULL AND (item.expires_at IS NULL OR CAST(item.expires_at AS INTEGER) > ?3)
             ORDER BY bm25(fts), CAST(item.updated_at AS INTEGER) DESC LIMIT ?4",
        );
        if let Ok(mut statement) = statement {
            if let Ok(rows) = statement.query_map(
                params![
                    fts_query,
                    scope_filter,
                    now.to_string(),
                    MEMORY_SEARCH_LIMIT
                ],
                memory_item_from_row,
            ) {
                items = rows.filter_map(Result::ok).collect();
            }
        }
    }
    if items.is_empty() {
        let like = format!("%{}%", query.replace('%', "\\%").replace('_', "\\_"));
        let mut statement = connection
            .prepare(
                "SELECT id, scope, kind, content, source_conversation_id, source_message_id, provenance, content_hash, confidence, created_at, updated_at, expires_at, revoked_at
                 FROM memory_items
                 WHERE content LIKE ?1 ESCAPE '\\' AND (?2 IS NULL OR scope = ?2) AND revoked_at IS NULL AND (expires_at IS NULL OR CAST(expires_at AS INTEGER) > ?3)
                 ORDER BY CAST(updated_at AS INTEGER) DESC LIMIT ?4",
            )
            .map_err(|error| format!("failed to prepare memory search: {error}"))?;
        let rows = statement
            .query_map(
                params![like, scope_filter, now.to_string(), MEMORY_SEARCH_LIMIT],
                memory_item_from_row,
            )
            .map_err(|error| format!("failed to search memory: {error}"))?;
        items = rows.filter_map(Result::ok).collect();
    }
    record_memory_audit(connection, None, scope, None, "search", "ok", now)
        .map_err(|error| format!("failed to audit memory search: {error}"))?;
    Ok(MemoryContextEnvelope {
        trust: MemoryTrust::Untrusted,
        instruction_authority: MemoryInstructionAuthority::None,
        items: items
            .into_iter()
            .map(|item| MemoryContextItem {
                id: item.id,
                scope: item.scope,
                kind: item.kind,
                content: item.content,
                content_hash: item.content_hash,
            })
            .collect(),
    })
}

fn revoke_memory_for_connection(connection: &Connection, id: &str, now: i64) -> Result<(), String> {
    let id = match normalize_required(id, "memory id", 256) {
        Ok(value) => value,
        Err(error) => {
            let _ =
                record_memory_audit(connection, Some(id), None, None, "revoke", "rejected", now);
            return Err(error);
        }
    };
    let changed = connection
        .execute("UPDATE memory_items SET revoked_at = ?1, updated_at = ?1 WHERE id = ?2 AND revoked_at IS NULL", params![now.to_string(), id])
        .map_err(|error| format!("failed to revoke memory: {error}"))?;
    if changed == 0 {
        let _ = record_memory_audit(connection, Some(&id), None, None, "revoke", "rejected", now);
        return Err("memory item was not found or already revoked".to_string());
    }
    record_memory_audit(connection, Some(&id), None, None, "revoke", "ok", now)
        .map_err(|error| format!("failed to audit memory revoke: {error}"))?;
    Ok(())
}

fn validate_proposal(
    proposal: &MemoryProposal,
    now: i64,
) -> Result<(String, Option<String>), String> {
    if proposal.reason != MemoryProposalReason::ExplicitUserRequest {
        return Err("memory proposal reason is not an explicit user request".to_string());
    }
    let content = normalize_required(
        &proposal.content,
        "memory content",
        MAX_MEMORY_CONTENT_CHARS,
    )?;
    if contains_sensitive_content(&content) {
        return Err("memory content contains sensitive data and was rejected".to_string());
    }
    if !proposal.confidence.is_finite() || !(0.0..=1.0).contains(&proposal.confidence) {
        return Err("memory confidence must be between 0 and 1".to_string());
    }
    let expires_at = match proposal.kind {
        MemoryKind::Todo => Some(now.saturating_add(TODO_TTL_MS).to_string()),
        MemoryKind::ProjectFact => Some(now.saturating_add(PROJECT_FACT_TTL_MS).to_string()),
        MemoryKind::Preference | MemoryKind::Profile => None,
    };
    Ok((content, expires_at))
}

fn reject_memory_write(
    connection: &Connection,
    proposal: &MemoryProposal,
    message: impl Into<String>,
    now: i64,
) -> Result<MemoryItem, String> {
    let message = message.into();
    let _ = record_memory_audit(
        connection,
        None,
        Some(proposal.scope),
        Some(proposal.kind),
        "save",
        "rejected",
        now,
    );
    Err(message)
}

fn reject_memory_edit(
    connection: &Connection,
    id: Option<&str>,
    proposal: &MemoryProposal,
    message: impl Into<String>,
    now: i64,
) -> Result<MemoryItem, String> {
    let message = message.into();
    let _ = record_memory_audit(
        connection,
        id,
        Some(proposal.scope),
        Some(proposal.kind),
        "edit",
        "rejected",
        now,
    );
    Err(message)
}

fn export_memory_for_connection(connection: &Connection) -> Result<String, String> {
    let export = serde_json::to_string_pretty(&MemoryExport {
        schema_version: "memory-export-v1",
        items: list_memory_for_connection(connection, None)?,
    })
    .map_err(|error| format!("failed to export memory: {error}"))?;
    record_memory_audit(connection, None, None, None, "export", "ok", now_millis())
        .map_err(|error| format!("failed to audit memory export: {error}"))?;
    Ok(export)
}

fn clear_memory_for_connection(connection: &Connection) -> Result<(), String> {
    let now = now_millis();
    connection
        .execute_batch("BEGIN IMMEDIATE")
        .map_err(|error| format!("failed to begin memory clear: {error}"))?;
    let result = (|| {
        connection.execute_batch("DELETE FROM memory_items; DELETE FROM memory_items_fts;")?;
        record_memory_audit(connection, None, None, None, "clear", "ok", now)?;
        Ok::<(), rusqlite::Error>(())
    })();
    match result {
        Ok(()) => connection
            .execute_batch("COMMIT")
            .map_err(|error| format!("failed to commit memory clear: {error}")),
        Err(error) => {
            let _ = connection.execute_batch("ROLLBACK");
            Err(format!("failed to clear memory: {error}"))
        }
    }
}

fn memory_item_from_row(row: &Row<'_>) -> rusqlite::Result<MemoryItem> {
    Ok(MemoryItem {
        id: row.get(0)?,
        scope: parse_scope(&row.get::<_, String>(1)?)?,
        kind: parse_kind(&row.get::<_, String>(2)?)?,
        content: row.get(3)?,
        source_conversation_id: row.get(4)?,
        source_message_id: row.get(5)?,
        provenance: parse_provenance(&row.get::<_, String>(6)?)?,
        content_hash: row.get(7)?,
        confidence: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
        expires_at: row.get(11)?,
        revoked_at: row.get(12)?,
    })
}

fn normalize_required(value: &str, label: &str, max_chars: usize) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > max_chars {
        return Err(format!(
            "{label} must be between 1 and {max_chars} characters"
        ));
    }
    Ok(value.to_string())
}

fn contains_sensitive_content(content: &str) -> bool {
    let lower = content.to_lowercase();
    [
        "api key",
        "apikey",
        "access token",
        "password",
        "private key",
        "secret=",
        "银行卡",
        "信用卡",
        "财务账户",
        "医疗记录",
        "病历",
    ]
    .iter()
    .any(|term| lower.contains(term))
}

fn fts_query(query: &str) -> Option<String> {
    let terms = query
        .split_whitespace()
        .filter(|term| !term.is_empty())
        .map(|term| format!("\"{}\"", term.replace('"', "\"\"")))
        .collect::<Vec<_>>();
    if terms.is_empty() {
        None
    } else {
        Some(terms.join(" AND "))
    }
}

fn sha256_hex(value: &str) -> String {
    Sha256::digest(value.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(i64::MAX as u128) as i64)
        .unwrap_or(0)
}

fn scope_value(scope: MemoryScope) -> &'static str {
    match scope {
        MemoryScope::User => "user",
        MemoryScope::Workspace => "workspace",
    }
}

fn kind_value(kind: MemoryKind) -> &'static str {
    match kind {
        MemoryKind::Preference => "preference",
        MemoryKind::Profile => "profile",
        MemoryKind::ProjectFact => "project-fact",
        MemoryKind::Todo => "todo",
    }
}

fn provenance_value(provenance: MemoryProvenance) -> &'static str {
    match provenance {
        MemoryProvenance::DirectUser => "direct-user",
        MemoryProvenance::UserSelectedContent => "user-selected-content",
    }
}

fn parse_scope(value: &str) -> rusqlite::Result<MemoryScope> {
    match value {
        "user" => Ok(MemoryScope::User),
        "workspace" => Ok(MemoryScope::Workspace),
        _ => Err(rusqlite::Error::InvalidColumnType(
            1,
            "scope".to_string(),
            rusqlite::types::Type::Text,
        )),
    }
}

fn parse_kind(value: &str) -> rusqlite::Result<MemoryKind> {
    match value {
        "preference" => Ok(MemoryKind::Preference),
        "profile" => Ok(MemoryKind::Profile),
        "project-fact" => Ok(MemoryKind::ProjectFact),
        "todo" => Ok(MemoryKind::Todo),
        _ => Err(rusqlite::Error::InvalidColumnType(
            2,
            "kind".to_string(),
            rusqlite::types::Type::Text,
        )),
    }
}

fn parse_provenance(value: &str) -> rusqlite::Result<MemoryProvenance> {
    match value {
        "direct-user" => Ok(MemoryProvenance::DirectUser),
        "user-selected-content" => Ok(MemoryProvenance::UserSelectedContent),
        _ => Err(rusqlite::Error::InvalidColumnType(
            6,
            "provenance".to_string(),
            rusqlite::types::Type::Text,
        )),
    }
}

fn record_memory_audit(
    connection: &Connection,
    memory_id: Option<&str>,
    scope: Option<MemoryScope>,
    kind: Option<MemoryKind>,
    operation: &str,
    result: &str,
    now: i64,
) -> rusqlite::Result<()> {
    connection.execute(
        "INSERT INTO memory_audit (memory_id, operation, result, scope, kind, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![memory_id, operation, result, scope.map(scope_value), kind.map(kind_value), now.to_string()],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    const NOW: i64 = 1_757_000_000_000;

    fn connection() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        initialize_schema(&connection).unwrap();
        connection
    }

    fn request(content: &str, scope: MemoryScope, kind: MemoryKind) -> MemorySaveRequest {
        MemorySaveRequest {
            proposal: MemoryProposal {
                scope,
                kind,
                content: content.to_string(),
                confidence: 0.9,
                reason: MemoryProposalReason::ExplicitUserRequest,
            },
            source_conversation_id: "conversation-1".to_string(),
            source_message_id: "message-1".to_string(),
            provenance: MemoryProvenance::DirectUser,
            authority: MemoryWriteAuthority::TopLevelUser,
            enabled: true,
        }
    }

    #[test]
    fn saves_explicit_memory_with_hash_and_kind_ttl() {
        let connection = connection();
        let item = save_memory_for_connection(
            &connection,
            request(
                "Prefer concise Rust examples",
                MemoryScope::User,
                MemoryKind::Todo,
            ),
            NOW,
            true,
        )
        .unwrap();

        assert_eq!(item.scope, MemoryScope::User);
        assert_eq!(item.kind, MemoryKind::Todo);
        assert_eq!(item.provenance, MemoryProvenance::DirectUser);
        assert_eq!(item.created_at, NOW.to_string());
        let expected_expiry = (NOW + 30 * 24 * 60 * 60 * 1_000).to_string();
        assert_eq!(item.expires_at.as_deref(), Some(expected_expiry.as_str()));
        assert_eq!(item.content_hash.len(), 64);
        assert_ne!(item.id, "");
    }

    #[test]
    fn rejects_disabled_non_user_authority_and_sensitive_content() {
        let connection = connection();
        let valid = request(
            "Prefer concise answers",
            MemoryScope::User,
            MemoryKind::Preference,
        );
        assert!(save_memory_for_connection(&connection, valid, NOW, false).is_err());

        let mut invalid_authority = request(
            "Prefer concise answers",
            MemoryScope::User,
            MemoryKind::Preference,
        );
        invalid_authority.authority = MemoryWriteAuthority::ModelSuggestion;
        assert!(save_memory_for_connection(&connection, invalid_authority, NOW, true).is_err());

        let sensitive = request(
            "API key: sk-secret-value",
            MemoryScope::User,
            MemoryKind::Profile,
        );
        assert!(save_memory_for_connection(&connection, sensitive, NOW, true).is_err());

        let rejected_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM memory_audit WHERE result = 'rejected'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(rejected_count, 3);
    }

    #[test]
    fn searches_untrusted_scoped_memory_and_filters_expired_or_revoked_items() {
        let connection = connection();
        let first = save_memory_for_connection(
            &connection,
            request(
                "Use Rust for local tools",
                MemoryScope::User,
                MemoryKind::Preference,
            ),
            NOW,
            true,
        )
        .unwrap();
        save_memory_for_connection(
            &connection,
            request(
                "Use Rust in workspace",
                MemoryScope::Workspace,
                MemoryKind::ProjectFact,
            ),
            NOW,
            true,
        )
        .unwrap();
        let expired = save_memory_for_connection(
            &connection,
            request("Rust expired note", MemoryScope::User, MemoryKind::Todo),
            NOW - 31 * 24 * 60 * 60 * 1000,
            true,
        )
        .unwrap();

        let envelope =
            search_memory_for_connection(&connection, "Rust", Some(MemoryScope::User), NOW, true)
                .unwrap();
        assert_eq!(envelope.trust, MemoryTrust::Untrusted);
        assert_eq!(
            envelope.instruction_authority,
            MemoryInstructionAuthority::None
        );
        assert_eq!(envelope.items.len(), 1);
        assert_eq!(envelope.items[0].id, first.id);
        assert!(!envelope.items.iter().any(|item| item.id == expired.id));

        revoke_memory_for_connection(&connection, &first.id, NOW).unwrap();
        let revoked =
            search_memory_for_connection(&connection, "Rust", Some(MemoryScope::User), NOW, true)
                .unwrap();
        assert!(revoked.items.is_empty());
    }

    #[test]
    fn disabled_search_returns_no_context_and_export_clear_are_available() {
        let connection = connection();
        let item = save_memory_for_connection(
            &connection,
            request(
                "Keep the workbench compact",
                MemoryScope::User,
                MemoryKind::Preference,
            ),
            NOW,
            true,
        )
        .unwrap();

        let envelope =
            search_memory_for_connection(&connection, "workbench", None, NOW, false).unwrap();
        assert!(envelope.items.is_empty());
        let exported = export_memory_for_connection(&connection).unwrap();
        assert!(exported.contains(&item.id));
        assert!(exported.contains("memory-export-v1"));

        clear_memory_for_connection(&connection).unwrap();
        assert!(list_memory_for_connection(&connection, None)
            .unwrap()
            .is_empty());
    }

    #[test]
    fn edits_a_confirmed_item_without_changing_its_provenance() {
        let connection = connection();
        let item = save_memory_for_connection(
            &connection,
            request(
                "Keep the workbench compact",
                MemoryScope::User,
                MemoryKind::Preference,
            ),
            NOW,
            true,
        )
        .unwrap();
        let edited = edit_memory_for_connection(
            &connection,
            &item.id,
            MemoryProposal {
                scope: MemoryScope::Workspace,
                kind: MemoryKind::ProjectFact,
                content: "Keep the workspace compact".to_string(),
                confidence: 0.8,
                reason: MemoryProposalReason::ExplicitUserRequest,
            },
            MemoryWriteAuthority::TopLevelUser,
            true,
            NOW + 1,
        )
        .unwrap();

        assert_eq!(edited.id, item.id);
        assert_eq!(edited.created_at, item.created_at);
        assert_eq!(edited.updated_at, (NOW + 1).to_string());
        assert_eq!(edited.source_conversation_id, item.source_conversation_id);
        assert_eq!(edited.source_message_id, item.source_message_id);
        assert_eq!(edited.provenance, item.provenance);
        assert_eq!(edited.scope, MemoryScope::Workspace);
        assert_eq!(edited.kind, MemoryKind::ProjectFact);
        assert_ne!(edited.content_hash, item.content_hash);
    }

    #[test]
    fn refuses_edits_from_models_or_to_revoked_items() {
        let connection = connection();
        let item = save_memory_for_connection(
            &connection,
            request(
                "Keep the workbench compact",
                MemoryScope::User,
                MemoryKind::Preference,
            ),
            NOW,
            true,
        )
        .unwrap();
        let proposal = MemoryProposal {
            scope: MemoryScope::User,
            kind: MemoryKind::Preference,
            content: "Keep the workbench focused".to_string(),
            confidence: 0.8,
            reason: MemoryProposalReason::ExplicitUserRequest,
        };

        assert!(edit_memory_for_connection(
            &connection,
            &item.id,
            proposal.clone(),
            MemoryWriteAuthority::ModelSuggestion,
            true,
            NOW + 1,
        )
        .is_err());

        revoke_memory_for_connection(&connection, &item.id, NOW + 1).unwrap();
        assert!(edit_memory_for_connection(
            &connection,
            &item.id,
            proposal.clone(),
            MemoryWriteAuthority::TopLevelUser,
            true,
            NOW + 2,
        )
        .is_err());

        assert!(edit_memory_for_connection(
            &connection,
            "missing-memory",
            proposal.clone(),
            MemoryWriteAuthority::TopLevelUser,
            true,
            NOW + 3,
        )
        .is_err());

        assert!(revoke_memory_for_connection(&connection, "missing-memory", NOW + 3).is_err());
    }

    #[test]
    fn records_operation_metadata_without_memory_content() {
        let connection = connection();
        let item = save_memory_for_connection(
            &connection,
            request(
                "Remember the compact layout",
                MemoryScope::User,
                MemoryKind::Preference,
            ),
            NOW,
            true,
        )
        .unwrap();
        let _ = search_memory_for_connection(&connection, "compact", None, NOW, true).unwrap();
        let _ = list_memory_for_connection(&connection, None).unwrap();
        let _ = export_memory_for_connection(&connection).unwrap();
        revoke_memory_for_connection(&connection, &item.id, NOW + 1).unwrap();

        let count: i64 = connection
            .query_row("SELECT COUNT(*) FROM memory_audit", [], |row| row.get(0))
            .unwrap();
        assert!(count >= 6);
        let columns: Vec<String> = connection
            .prepare("PRAGMA table_info(memory_audit)")
            .unwrap()
            .query_map([], |row| row.get(1))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert!(!columns.iter().any(|column| column == "content"));
    }

    #[test]
    fn refuses_a_database_schema_newer_than_the_supported_version() {
        let connection = connection();
        connection
            .pragma_update(None, "user_version", 99_i64)
            .unwrap();
        assert!(initialize_schema(&connection).is_err());
    }
}
