use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
#[cfg(not(test))]
use tauri::{AppHandle, Emitter};
use tokio::sync::watch;

#[cfg(not(test))]
type OllamaChunkEmitter = AppHandle;

#[cfg(test)]
type OllamaChunkEmitter = ();

const OLLAMA_ENDPOINT: &str = "http://127.0.0.1:11434";
const OLLAMA_TAGS_PATH: &str = "http://127.0.0.1:11434/api/tags";
const OLLAMA_CHAT_PATH: &str = "http://127.0.0.1:11434/api/chat";
const OLLAMA_OVERVIEW_REQUEST_TIMEOUT_SECONDS: u64 = 15;
const OLLAMA_CHAT_REQUEST_TIMEOUT_SECONDS: u64 = 480;
const MIN_OLLAMA_CHAT_REQUEST_TIMEOUT_SECONDS: u64 = 30;
const MAX_OLLAMA_CHAT_REQUEST_TIMEOUT_SECONDS: u64 = 600;
const OLLAMA_CHAT_NUM_PREDICT: u32 = 512;
const PREFERRED_DEFAULT_CHAT_MODELS: [&str; 2] = ["gemma:26b", "gemma4:26b"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaModelSummary {
    name: String,
    size_label: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaOverview {
    reachable: bool,
    endpoint: String,
    selected_model: String,
    diagnostic: String,
    models: Vec<OllamaModelSummary>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OllamaChatRequest {
    model: String,
    message: String,
    #[serde(rename = "requestId")]
    request_id: Option<String>,
    #[serde(rename = "numPredict")]
    num_predict: Option<u32>,
    #[serde(rename = "timeoutMs")]
    timeout_ms: Option<u64>,
    think: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OllamaChatResult {
    model: String,
    message: String,
    #[serde(rename = "doneReason")]
    done_reason: Option<String>,
}

#[cfg(not(test))]
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OllamaChatChunkEvent {
    request_id: String,
    chunk: String,
}

#[derive(Debug, Serialize)]
struct OllamaChatApiRequest {
    model: String,
    messages: Vec<OllamaChatMessage>,
    options: OllamaChatOptions,
    think: bool,
    stream: bool,
}

#[derive(Debug, Serialize)]
struct OllamaChatOptions {
    num_predict: u32,
}

#[derive(Debug, Serialize)]
struct OllamaChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct OllamaChatResponse {
    model: Option<String>,
    done_reason: Option<String>,
    error: Option<String>,
    message: Option<OllamaChatResponseMessage>,
}

#[derive(Debug, Deserialize)]
struct OllamaChatResponseMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    models: Option<Vec<OllamaModelPayload>>,
}

#[derive(Debug, Deserialize)]
struct OllamaModelPayload {
    name: Option<String>,
    size: Option<u64>,
}

#[tauri::command]
pub async fn ollama_overview() -> OllamaOverview {
    match load_ollama_overview().await {
        Ok(overview) => overview,
        Err(_) => offline_overview(),
    }
}

#[tauri::command]
#[cfg(not(test))]
pub async fn ollama_chat(app: AppHandle, request: OllamaChatRequest) -> Result<OllamaChatResult, String> {
    load_cancelable_ollama_chat(Some(app), request)
        .await
        .map_err(|error| format!("Ollama chat failed: {error}"))
}

#[tauri::command]
#[cfg(test)]
pub async fn ollama_chat(request: OllamaChatRequest) -> Result<OllamaChatResult, String> {
    load_cancelable_ollama_chat(None, request)
        .await
        .map_err(|error| format!("Ollama chat failed: {error}"))
}

#[tauri::command]
pub async fn ollama_cancel_chat(request_id: String) -> Result<(), String> {
    cancel_chat_request(&request_id);
    Ok(())
}

async fn load_ollama_overview() -> Result<OllamaOverview, reqwest::Error> {
    let payload = reqwest::Client::builder()
        .timeout(ollama_overview_request_timeout())
        .build()?
        .get(OLLAMA_TAGS_PATH)
        .send()
        .await?
        .error_for_status()?
        .json::<OllamaTagsResponse>()
        .await?;

    let models = payload
        .models
        .unwrap_or_default()
        .into_iter()
        .filter_map(normalize_model)
        .collect::<Vec<_>>();
    let diagnostic = if models.is_empty() {
        "No local Ollama models were found. Pull a model before starting chat.".to_string()
    } else {
        String::new()
    };

    Ok(OllamaOverview {
        reachable: true,
        endpoint: OLLAMA_ENDPOINT.to_string(),
        selected_model: select_default_chat_model(&models).unwrap_or_default(),
        diagnostic,
        models,
    })
}

fn normalize_model(model: OllamaModelPayload) -> Option<OllamaModelSummary> {
    let name = model.name?;

    if name.is_empty() {
        return None;
    }

    Some(OllamaModelSummary {
        name,
        size_label: format_model_size(model.size.unwrap_or_default()),
    })
}

fn select_default_chat_model(models: &[OllamaModelSummary]) -> Option<String> {
    models
        .iter()
        .find(|model| PREFERRED_DEFAULT_CHAT_MODELS.contains(&model.name.as_str()))
        .or_else(|| models.first())
        .map(|model| model.name.clone())
}

async fn load_ollama_chat(app: Option<OllamaChunkEmitter>, request: OllamaChatRequest) -> Result<OllamaChatResult, String> {
    let selected_model = request.model.trim();

    if selected_model.is_empty() || selected_model == "未选择模型" {
        return Err("No usable local Ollama model is selected.".to_string());
    }

    let api_request = create_ollama_chat_api_request(&request);
    let mut response = reqwest::Client::builder()
        .timeout(ollama_chat_request_timeout(request.timeout_ms))
        .build()
        .map_err(|error| error.to_string())?
        .post(OLLAMA_CHAT_PATH)
        .json(&api_request)
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let status = response.status();

    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format_ollama_http_error(status.as_u16(), &body));
    }

    let mut response_text = String::new();
    let request_id = normalize_request_id(request.request_id.as_deref());

    let mut stream_buffer = String::new();

    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        let chunk_text = String::from_utf8_lossy(&chunk);
        response_text.push_str(&chunk_text);
        drain_complete_ollama_stream_lines(&mut stream_buffer, &chunk_text, |line| {
            emit_ollama_chat_chunk_from_line(app.as_ref(), request_id.as_deref(), line);
        });
    }

    if !stream_buffer.trim().is_empty() {
        emit_ollama_chat_chunk_from_line(app.as_ref(), request_id.as_deref(), &stream_buffer);
    }

    merge_ollama_chat_stream_lines(response_text, &request.model)
}

fn create_ollama_chat_messages(message: String) -> Vec<OllamaChatMessage> {
    vec![OllamaChatMessage {
        role: "user".to_string(),
        content: [
            "中文优先。除非用户明确要求其它语言，默认用中文回答。",
            "严格按用户当前问题回答，不要把术语误解成无关主题；例如不要把 MIT 开源协议误解为 MIT 学校介绍。",
            "",
            "用户问题：",
            &message,
        ]
        .join("\n"),
    }]
}

fn create_ollama_chat_api_request(request: &OllamaChatRequest) -> OllamaChatApiRequest {
    OllamaChatApiRequest {
        model: request.model.clone(),
        messages: create_ollama_chat_messages(request.message.clone()),
        options: OllamaChatOptions {
            num_predict: request.num_predict.unwrap_or(OLLAMA_CHAT_NUM_PREDICT),
        },
        think: request.think.unwrap_or(false),
        stream: true,
    }
}

fn merge_ollama_chat_stream_lines(response_text: String, fallback_model: &str) -> Result<OllamaChatResult, String> {
    merge_ollama_chat_stream_lines_with_chunk_handler(response_text, fallback_model, |_| {})
}

fn format_ollama_http_error(status: u16, body: &str) -> String {
    let detail = serde_json::from_str::<OllamaChatResponse>(body)
        .ok()
        .and_then(|payload| payload.error)
        .map(|error| error.trim().to_string())
        .filter(|error| !error.is_empty())
        .or_else(|| {
            let trimmed_body = body.trim();
            if trimmed_body.is_empty() {
                None
            } else {
                Some(trimmed_body.to_string())
            }
        });

    match detail {
        Some(detail) => format!("Ollama chat failed with HTTP {status}: {detail}"),
        None => format!("Ollama chat failed with HTTP {status}"),
    }
}

fn merge_ollama_chat_stream_lines_with_chunk_handler<F>(
    response_text: String,
    fallback_model: &str,
    mut on_chunk: F,
) -> Result<OllamaChatResult, String>
where
    F: FnMut(&str),
{
    let mut model = String::new();
    let mut done_reason = None;
    let mut message = String::new();
    let mut stream_error = None;

    for line in response_text.lines().map(str::trim).filter(|line| !line.is_empty()) {
        let Ok(payload) = serde_json::from_str::<OllamaChatResponse>(line) else {
            continue;
        };

        if let Some(error) = payload.error.filter(|value| !value.trim().is_empty()) {
            stream_error = Some(error);
            continue;
        }

        if let Some(payload_model) = payload.model.filter(|value| !value.trim().is_empty()) {
            model = payload_model;
        }

        if payload.done_reason.is_some() {
            done_reason = payload.done_reason;
        }

        if let Some(content) = payload.message.and_then(|message| message.content) {
            message.push_str(&content);
            on_chunk(&content);
        }
    }

    if let Some(error) = stream_error {
        return Err(format!("Ollama stream returned an error: {error}"));
    }

    let message = message.trim().to_string();

    if message.is_empty() {
        return Err("Ollama chat returned an empty assistant message.".to_string());
    }

    Ok(OllamaChatResult {
        model: if model.is_empty() {
            fallback_model.to_string()
        } else {
            model
        },
        message,
        done_reason,
    })
}

async fn load_cancelable_ollama_chat(app: Option<OllamaChunkEmitter>, request: OllamaChatRequest) -> Result<OllamaChatResult, String> {
    let request_id = normalize_request_id(request.request_id.as_deref());
    let mut cancellation_registration = request_id
        .as_deref()
        .map(register_chat_request);

    let result = match cancellation_registration.as_mut() {
        Some(registration) => {
            tokio::select! {
                result = load_ollama_chat(app, request) => result,
                _ = registration.receiver.changed() => Err("Cancelled by user before Ollama returned a response.".to_string()),
            }
        }
        None => load_ollama_chat(app, request).await,
    };

    if let (Some(request_id), Some(registration)) = (request_id, cancellation_registration) {
        unregister_chat_request(&request_id, registration.token);
    }

    result
}

#[cfg(not(test))]
fn emit_ollama_chat_chunk(app: Option<&OllamaChunkEmitter>, request_id: Option<&str>, chunk: &str) {
    let Some(app) = app else {
        return;
    };
    let Some(request_id) = request_id else {
        return;
    };
    if chunk.trim().is_empty() {
        return;
    }

    let _ = app.emit(
        "ollama_chat_chunk",
        OllamaChatChunkEvent {
            request_id: request_id.to_string(),
            chunk: chunk.to_string(),
        },
    );
}

#[cfg(test)]
fn emit_ollama_chat_chunk(_app: Option<&OllamaChunkEmitter>, _request_id: Option<&str>, _chunk: &str) {}

fn emit_ollama_chat_chunk_from_line(app: Option<&OllamaChunkEmitter>, request_id: Option<&str>, line: &str) {
    let Ok(payload) = serde_json::from_str::<OllamaChatResponse>(line.trim()) else {
        return;
    };
    if let Some(content) = payload.message.and_then(|message| message.content) {
        emit_ollama_chat_chunk(app, request_id, &content);
    }
}

fn drain_complete_ollama_stream_lines<F>(buffer: &mut String, chunk: &str, mut on_line: F)
where
    F: FnMut(&str),
{
    buffer.push_str(chunk);

    while let Some(newline_index) = buffer.find('\n') {
        let mut line = buffer.drain(..=newline_index).collect::<String>();
        line = line.trim_end_matches(['\r', '\n']).to_string();

        if !line.trim().is_empty() {
            on_line(&line);
        }
    }
}

fn normalize_request_id(request_id: Option<&str>) -> Option<String> {
    request_id
        .map(str::trim)
        .filter(|request_id| !request_id.is_empty())
        .map(ToString::to_string)
}

type ChatCancellationSender = watch::Sender<bool>;
type ChatCancellationReceiver = watch::Receiver<bool>;

struct ChatCancellationRegistration {
    token: u64,
    receiver: ChatCancellationReceiver,
}

struct ChatCancellationEntry {
    token: u64,
    sender: ChatCancellationSender,
}

fn chat_cancellation_token_counter() -> &'static AtomicU64 {
    static CHAT_CANCELLATION_TOKEN_COUNTER: OnceLock<AtomicU64> = OnceLock::new();
    CHAT_CANCELLATION_TOKEN_COUNTER.get_or_init(|| AtomicU64::new(1))
}

fn chat_cancellations() -> &'static Mutex<HashMap<String, ChatCancellationEntry>> {
    static CHAT_CANCELLATIONS: OnceLock<Mutex<HashMap<String, ChatCancellationEntry>>> = OnceLock::new();
    CHAT_CANCELLATIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn register_chat_request(request_id: &str) -> ChatCancellationRegistration {
    let (sender, receiver) = watch::channel(false);
    let token = chat_cancellation_token_counter().fetch_add(1, Ordering::Relaxed);
    let replaced_sender = chat_cancellations()
        .lock()
        .expect("chat cancellation registry should be available")
        .insert(request_id.to_string(), ChatCancellationEntry { token, sender });
    if let Some(replaced_entry) = replaced_sender {
        let _ = replaced_entry.sender.send(true);
    }
    ChatCancellationRegistration { token, receiver }
}

fn unregister_chat_request(request_id: &str, token: u64) {
    let mut cancellations = chat_cancellations()
        .lock()
        .expect("chat cancellation registry should be available");
    let should_remove = cancellations
        .get(request_id)
        .map(|entry| entry.token == token)
        .unwrap_or(false);

    if should_remove {
        cancellations.remove(request_id);
    }
}

fn cancel_chat_request(request_id: &str) {
    let request_id = match normalize_request_id(Some(request_id)) {
        Some(request_id) => request_id,
        None => return,
    };
    let entry = chat_cancellations()
        .lock()
        .expect("chat cancellation registry should be available")
        .remove(&request_id);

    if let Some(entry) = entry {
        let _ = entry.sender.send(true);
    }
}

fn ollama_chat_request_timeout(timeout_ms: Option<u64>) -> Duration {
    let timeout_seconds = timeout_ms
        .map(|timeout_ms| timeout_ms / 1_000)
        .filter(|timeout_seconds| *timeout_seconds > 0)
        .unwrap_or(OLLAMA_CHAT_REQUEST_TIMEOUT_SECONDS)
        .clamp(
            MIN_OLLAMA_CHAT_REQUEST_TIMEOUT_SECONDS,
            MAX_OLLAMA_CHAT_REQUEST_TIMEOUT_SECONDS,
        );

    Duration::from_secs(timeout_seconds)
}

fn ollama_overview_request_timeout() -> Duration {
    Duration::from_secs(OLLAMA_OVERVIEW_REQUEST_TIMEOUT_SECONDS)
}

fn format_model_size(size: u64) -> String {
    if size == 0 {
        return "未知大小".to_string();
    }

    let size_in_gb = size as f64 / 1024_f64 / 1024_f64 / 1024_f64;
    format!("{size_in_gb:.1} GB")
}

fn offline_overview() -> OllamaOverview {
    OllamaOverview {
        reachable: false,
        endpoint: OLLAMA_ENDPOINT.to_string(),
        selected_model: String::new(),
        diagnostic: "Ollama 未启动，请确认本地服务已运行。".to_string(),
        models: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        format_model_size, load_ollama_chat, normalize_model, ollama_chat_request_timeout, select_default_chat_model,
        OllamaChatRequest, OllamaModelPayload, OllamaModelSummary, OllamaOverview, OLLAMA_ENDPOINT,
    };

    #[test]
    fn formats_zero_size_as_unknown() {
        assert_eq!(format_model_size(0), "未知大小");
    }

    #[test]
    fn formats_gigabyte_size_for_ui() {
        assert_eq!(format_model_size(4_294_967_296), "4.0 GB");
    }

    #[test]
    fn drops_models_without_a_name() {
        assert!(normalize_model(OllamaModelPayload {
            name: None,
            size: Some(42),
        })
        .is_none());
    }

    #[test]
    fn normalizes_named_models() {
        let model = normalize_model(OllamaModelPayload {
            name: Some("qwen2.5-coder:7b".to_string()),
            size: Some(4_294_967_296),
        })
        .expect("model should normalize");

        assert_eq!(model.name, "qwen2.5-coder:7b");
        assert_eq!(model.size_label, "4.0 GB");
    }

    #[test]
    fn prefers_gemma_26b_over_other_detected_models_by_default() {
        let models = vec![
            OllamaModelSummary {
                name: "qwen3.6:35b".to_string(),
                size_label: "20.5 GB".to_string(),
            },
            OllamaModelSummary {
                name: "gemma:26b".to_string(),
                size_label: "16.0 GB".to_string(),
            },
            OllamaModelSummary {
                name: "gemma4:26b".to_string(),
                size_label: "16.0 GB".to_string(),
            },
            OllamaModelSummary {
                name: "qwen3.5:9b".to_string(),
                size_label: "6.0 GB".to_string(),
            },
        ];

        assert_eq!(
            select_default_chat_model(&models).as_deref(),
            Some("gemma:26b")
        );
    }

    #[test]
    fn falls_back_to_gemma4_26b_when_gemma_26b_is_not_installed() {
        let models = vec![
            OllamaModelSummary {
                name: "qwen3.6:35b".to_string(),
                size_label: "20.5 GB".to_string(),
            },
            OllamaModelSummary {
                name: "gemma4:26b".to_string(),
                size_label: "16.0 GB".to_string(),
            },
        ];

        assert_eq!(
            select_default_chat_model(&models).as_deref(),
            Some("gemma4:26b")
        );
    }

    #[test]
    fn reachable_overview_without_models_uses_repair_friendly_diagnostic() {
        let overview = OllamaOverview {
            reachable: true,
            endpoint: OLLAMA_ENDPOINT.to_string(),
            selected_model: String::new(),
            diagnostic: "No local Ollama models were found. Pull a model before starting chat."
                .to_string(),
            models: Vec::new(),
        };

        assert!(overview.reachable);
        assert!(overview.selected_model.is_empty());
        assert!(overview.diagnostic.contains("No local Ollama models"));
    }

    #[test]
    fn ollama_chat_request_timeout_is_bounded_but_long_enough_for_long_answers() {
        let timeout = ollama_chat_request_timeout(None);

        assert!(timeout.as_secs() >= 480);
        assert!(timeout.as_secs() <= 600);
    }

    #[test]
    fn ollama_chat_request_timeout_uses_frontend_budget_with_bounds() {
        assert_eq!(ollama_chat_request_timeout(Some(480_000)).as_secs(), 480);
        assert_eq!(ollama_chat_request_timeout(Some(1_000)).as_secs(), 30);
        assert_eq!(ollama_chat_request_timeout(Some(900_000)).as_secs(), 600);
    }

    #[test]
    fn ollama_overview_request_timeout_matches_startup_probe_budget() {
        assert_eq!(super::ollama_overview_request_timeout().as_secs(), 15);
    }

    #[test]
    fn ollama_chat_request_sets_long_answer_output_budget() {
        let api_request = super::OllamaChatApiRequest {
            model: "qwen3.6:35b".to_string(),
            messages: vec![super::OllamaChatMessage {
                role: "user".to_string(),
                content: "请回答 8 题单选和 8 题多选。".to_string(),
            }],
            options: super::OllamaChatOptions {
                num_predict: 4096,
            },
            think: false,
            stream: true,
        };
        let payload = serde_json::to_value(api_request).expect("api request should serialize");

        assert_eq!(payload["options"]["num_predict"], 4096);
        assert_eq!(payload["think"], false);
        assert_eq!(payload["stream"], true);
    }

    #[test]
    fn chat_api_request_uses_frontend_budget_and_thinking_flags() {
        let request = OllamaChatRequest {
            model: "gemma:26b".to_string(),
            message: "请回答 8 题单选题和 8 题多选题。".to_string(),
            request_id: Some("local-model-chat-long-quiz".to_string()),
            num_predict: Some(4096),
            timeout_ms: Some(480_000),
            think: Some(false),
        };

        let api_request = super::create_ollama_chat_api_request(&request);
        let payload = serde_json::to_value(api_request).expect("api request should serialize");

        assert_eq!(payload["model"], "gemma:26b");
        assert_eq!(payload["options"]["num_predict"], 4096);
        assert_eq!(payload["think"], false);
        assert_eq!(payload["stream"], true);
        assert!(payload["messages"][0]["content"]
            .as_str()
            .expect("message content should be serialized")
            .contains("请回答 8 题单选题和 8 题多选题。"));
    }

    #[test]
    fn ollama_chat_prompt_keeps_chinese_first_instruction_with_user_question() {
        let messages = super::create_ollama_chat_messages("用一句中文解释 MIT 开源协议。".to_string());

        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].role, "user");
        assert!(messages[0].content.contains("中文优先"));
        assert!(messages[0].content.contains("不要把 MIT 开源协议误解为 MIT 学校介绍"));
        assert!(messages[0].content.contains("用一句中文解释 MIT 开源协议。"));
    }

    #[test]
    fn merges_ollama_streaming_chat_lines_into_one_result() {
        let result = super::merge_ollama_chat_stream_lines(
            r#"{"model":"qwen3.6:35b","message":{"content":"第一段，"}}"#
                .to_string()
                + "\n"
                + r#"{"model":"qwen3.6:35b","message":{"content":"第二段。"},"done_reason":"stop"}"#,
            "fallback-model",
        )
        .expect("streaming chat lines should merge");

        assert_eq!(result.model, "qwen3.6:35b");
        assert_eq!(result.message, "第一段，第二段。");
        assert_eq!(result.done_reason.as_deref(), Some("stop"));
    }

    #[test]
    fn emits_chunks_while_merging_ollama_streaming_chat_lines() {
        let mut chunks = Vec::new();
        let result = super::merge_ollama_chat_stream_lines_with_chunk_handler(
            r#"{"model":"qwen3.6:35b","message":{"content":"第一段，"}}"#
                .to_string()
                + "\n"
                + r#"{"model":"qwen3.6:35b","message":{"content":"第二段。"},"done_reason":"stop"}"#,
            "fallback-model",
            |chunk| chunks.push(chunk.to_string()),
        )
        .expect("streaming chat lines should merge and emit chunks");

        assert_eq!(chunks, vec!["第一段，".to_string(), "第二段。".to_string()]);
        assert_eq!(result.message, "第一段，第二段。");
    }

    #[test]
    fn skips_malformed_ollama_stream_lines_when_valid_content_is_available() {
        let result = super::merge_ollama_chat_stream_lines(
            r#"{"model":"qwen3.6:35b","message":{"content":"first "}}"#.to_string()
                + "\n"
                + "not-json-progress-noise\n"
                + r#"{"model":"qwen3.6:35b","message":{"content":"second"},"done_reason":"stop"}"#,
            "fallback-model",
        )
        .expect("malformed stream noise should not discard valid Ollama content");

        assert_eq!(result.model, "qwen3.6:35b");
        assert_eq!(result.message, "first second");
        assert_eq!(result.done_reason.as_deref(), Some("stop"));
    }

    #[test]
    fn preserves_ollama_stream_error_instead_of_reporting_empty_message() {
        let result = super::merge_ollama_chat_stream_lines(
            r#"{"error":"model 'missing:latest' not found"}"#.to_string(),
            "missing:latest",
        );

        assert!(result.is_err());
        assert!(result
            .err()
            .expect("stream error should be returned")
            .contains("model 'missing:latest' not found"));
    }

    #[test]
    fn preserves_ollama_http_error_body_detail() {
        let error = super::format_ollama_http_error(
            404,
            r#"{"error":"model 'missing:latest' not found"}"#,
        );

        assert!(error.contains("HTTP 404"));
        assert!(error.contains("model 'missing:latest' not found"));
    }

    #[test]
    fn buffers_partial_network_chunks_before_emitting_complete_stream_lines() {
        let mut stream_buffer = String::new();
        let mut lines = Vec::new();

        super::drain_complete_ollama_stream_lines(
            &mut stream_buffer,
            r#"{"model":"qwen3.6:35b","message":{"content":"第一"#,
            |line| lines.push(line.to_string()),
        );
        super::drain_complete_ollama_stream_lines(
            &mut stream_buffer,
            "段，\"}}\n{\"model\":\"qwen3.6:35b\",\"message\":{\"content\":\"第二段。\"}}\n",
            |line| lines.push(line.to_string()),
        );

        assert_eq!(
            lines,
            vec![
                r#"{"model":"qwen3.6:35b","message":{"content":"第一段，"}}"#.to_string(),
                r#"{"model":"qwen3.6:35b","message":{"content":"第二段。"}}"#.to_string()
            ]
        );
        assert!(stream_buffer.is_empty());
    }

    #[test]
    fn desktop_chat_default_output_budget_is_compact_for_short_questions() {
        assert_eq!(super::OLLAMA_CHAT_NUM_PREDICT, 512);
    }

    #[test]
    fn chat_result_serializes_ollama_done_reason_for_frontend_continuation() {
        let result = super::OllamaChatResult {
            model: "qwen3.6:35b".to_string(),
            message: "partial answer".to_string(),
            done_reason: Some("length".to_string()),
        };
        let payload = serde_json::to_value(result).expect("chat result should serialize");

        assert_eq!(payload["doneReason"], "length");
    }

    #[test]
    fn chat_request_deserializes_frontend_request_id() {
        let request = serde_json::from_value::<OllamaChatRequest>(serde_json::json!({
            "model": "qwen3.6:35b",
            "message": "解释享元模式",
            "requestId": "local-model-chat-task-1",
            "numPredict": 1024,
            "timeoutMs": 480000,
            "think": false
        }))
        .expect("frontend request should deserialize");

        assert_eq!(request.request_id.as_deref(), Some("local-model-chat-task-1"));
        assert_eq!(request.num_predict, Some(1024));
        assert_eq!(request.timeout_ms, Some(480_000));
        assert_eq!(request.think, Some(false));
    }

    #[test]
    fn cancelling_unknown_or_empty_chat_request_is_idempotent() {
        let empty_result = tauri::async_runtime::block_on(super::ollama_cancel_chat("   ".to_string()));
        let unknown_result =
            tauri::async_runtime::block_on(super::ollama_cancel_chat("missing-request".to_string()));

        assert!(empty_result.is_ok());
        assert!(unknown_result.is_ok());
    }

    #[test]
    fn replacing_chat_request_registration_cancels_the_previous_receiver() {
        tauri::async_runtime::block_on(async {
            let mut first_registration = super::register_chat_request("duplicate-local-model-request");
            let mut second_registration = super::register_chat_request("duplicate-local-model-request");

            assert!(first_registration.receiver.changed().await.is_ok());

            super::cancel_chat_request("duplicate-local-model-request");

            assert!(second_registration.receiver.changed().await.is_ok());
        });
    }

    #[test]
    fn unregistering_replaced_chat_request_keeps_the_current_receiver_cancelable() {
        tauri::async_runtime::block_on(async {
            let first_registration = super::register_chat_request("current-local-model-request");
            let mut second_registration = super::register_chat_request("current-local-model-request");

            super::unregister_chat_request("current-local-model-request", first_registration.token);
            super::cancel_chat_request("current-local-model-request");

            let cancelled = tokio::time::timeout(
                std::time::Duration::from_millis(50),
                second_registration.receiver.changed(),
            )
            .await;

            assert!(matches!(cancelled, Ok(Ok(()))));
        });
    }

    #[test]
    fn blocks_placeholder_model_before_sending_chat_request() {
        let result = tauri::async_runtime::block_on(load_ollama_chat(None, OllamaChatRequest {
            model: "未选择模型".to_string(),
            message: "解释享元模式".to_string(),
            request_id: None,
            num_predict: Some(1024),
            timeout_ms: Some(480_000),
            think: Some(false),
        }));

        assert!(result.is_err());
        assert!(result
            .err()
            .unwrap()
            .contains("No usable local Ollama model is selected"));
    }
}
