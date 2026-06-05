use serde::Serialize;

const OLLAMA_ENDPOINT: &str = "http://127.0.0.1:11434";
const OLLAMA_TAGS_PATH: &str = "http://127.0.0.1:11434/api/tags";

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

#[derive(Debug, serde::Deserialize)]
struct OllamaTagsResponse {
    models: Option<Vec<OllamaModelPayload>>,
}

#[derive(Debug, serde::Deserialize)]
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

async fn load_ollama_overview() -> Result<OllamaOverview, reqwest::Error> {
    let payload = reqwest::get(OLLAMA_TAGS_PATH)
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

    Ok(OllamaOverview {
        reachable: true,
        endpoint: OLLAMA_ENDPOINT.to_string(),
        selected_model: models
            .first()
            .map(|model| model.name.clone())
            .unwrap_or_default(),
        diagnostic: String::new(),
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
    use super::{format_model_size, normalize_model, OllamaModelPayload};

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
}
