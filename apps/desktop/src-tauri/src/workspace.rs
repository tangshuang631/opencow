use crate::rollback_files::{capture_paths_for_context, RollbackContextPayload};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use std::{env, time::Duration};
use tauri::{AppHandle, Runtime};

#[derive(Serialize)]
pub struct WorkspaceOverview {
    root_name: String,
    root_path: String,
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

#[derive(Debug, Serialize)]
pub struct NetworkSearchResultItem {
    title: String,
    url: String,
    source_label: String,
    summary: String,
    fact_snippets: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct NetworkSearchResult {
    query: String,
    provider: String,
    effective_provider: String,
    used_fallback: bool,
    fallback_reason: Option<String>,
    items: Vec<NetworkSearchResultItem>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSearchPayload {
    query: String,
    provider_label: Option<String>,
    base_url: Option<String>,
    api_key: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WikipediaOpenSearchResponse((), Vec<String>, Vec<String>, Vec<String>);

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

#[derive(Debug, Serialize)]
pub struct WorkspaceProjectNpcScreenshotCaptureResult {
    project_name: String,
    project_path: String,
    expected_url: Option<String>,
    artifact_path: String,
    artifact_directory: String,
    capture_target: String,
    summary: String,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceProjectNpcShowcaseSiteWriteResult {
    project_name: String,
    project_path: String,
    site_root: String,
    entry_file: String,
    changed_paths: Vec<String>,
    source_screenshot_path: String,
    summary: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NpcConfigWritePayload {
    query: String,
    model_output: String,
    config: Value,
    rollback_context: Option<RollbackContextPayload>,
}

#[derive(Debug, Serialize)]
pub struct NpcConfigWriteResult {
    npc_name: String,
    config_path: String,
    status: String,
    summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NpcWorkspaceConfigRecord {
    id: String,
    name: String,
    description: String,
    default_model: String,
    persona_title: String,
    persona_prompt: String,
    output_style: String,
    agent_draft: String,
    rules_draft: String,
    enabled_skill_names: Vec<String>,
    knowledge_library_ids: Vec<String>,
    updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct NpcWorkspaceResult {
    summary: String,
    selected_npc_id: Option<String>,
    items: Vec<NpcWorkspaceConfigRecord>,
}

#[derive(Debug, Deserialize)]
pub struct NpcWorkspaceConfigUpsertPayload {
    id: String,
    name: String,
    description: String,
    default_model: String,
    persona_title: String,
    persona_prompt: String,
    output_style: String,
    agent_draft: String,
    rules_draft: String,
    enabled_skill_names: Vec<String>,
    knowledge_library_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NpcWorkspaceConfigMutationPayload {
    payload: NpcWorkspaceConfigUpsertPayload,
    rollback_context: Option<RollbackContextPayload>,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceProjectNpcShowcasePublishPreviewResult {
    project_name: String,
    project_path: String,
    site_root: String,
    entry_file: String,
    changed_paths: Vec<String>,
    source_screenshot_path: String,
    next_git_step: String,
    summary: String,
}

#[tauri::command]
pub fn workspace_npc_config_write(
    app: AppHandle,
    payload: NpcConfigWritePayload,
) -> Result<NpcConfigWriteResult, String> {
    let root = resolve_workspace_root()?;
    let config_object = payload
        .config
        .as_object()
        .ok_or_else(|| "NPC config payload must be a JSON object".to_string())?;
    let raw_name = config_object
        .get("name")
        .and_then(Value::as_str)
        .filter(|name| !name.trim().is_empty())
        .unwrap_or("custom-npc");
    let npc_name = raw_name.to_string();
    let slug = slugify_npc_config_name(&npc_name);
    let relative_path = format!(".opencow/npcs/{slug}.json");
    let config_directory = root.join(".opencow").join("npcs");
    fs::create_dir_all(&config_directory)
        .map_err(|error| format!("failed to create {}: {error}", config_directory.display()))?;

    let config_path = config_directory.join(format!("{slug}.json"));
    ensure_path_stays_in_workspace(&root, &config_path)?;
    capture_paths_for_context(&app, &payload.rollback_context, &[config_path.clone()])?;

    let mut saved_config = payload.config;
    if let Some(object) = saved_config.as_object_mut() {
        object.insert("source_query".to_string(), Value::String(payload.query));
        object.insert(
            "model_output".to_string(),
            Value::String(payload.model_output),
        );
        object.insert("schema_version".to_string(), Value::from(1));
    }

    let serialized = serde_json::to_string_pretty(&saved_config)
        .map_err(|error| format!("failed to serialize NPC config: {error}"))?;
    fs::write(&config_path, format!("{serialized}\n"))
        .map_err(|error| format!("failed to write {}: {error}", config_path.display()))?;

    Ok(NpcConfigWriteResult {
        npc_name: npc_name.clone(),
        config_path: relative_path.clone(),
        status: "saved".to_string(),
        summary: format!("Saved LLM-generated NPC config for {npc_name} to {relative_path}."),
    })
}

#[tauri::command]
pub async fn network_search(payload: NetworkSearchPayload) -> Result<NetworkSearchResult, String> {
    let query = payload.query.trim().to_string();

    if query.is_empty() {
        return Err("network search query cannot be empty".to_string());
    }

    let custom_provider = payload
        .provider_label
        .as_deref()
        .map(str::trim)
        .unwrap_or_default()
        .to_string();
    let custom_base_url = payload
        .base_url
        .as_deref()
        .map(str::trim)
        .unwrap_or_default()
        .to_string();
    let custom_api_key = payload
        .api_key
        .as_deref()
        .map(str::trim)
        .unwrap_or_default()
        .to_string();

    let search_query = normalize_network_search_query(&query);

    if !custom_provider.is_empty() {
        match run_custom_network_search(
            &search_query,
            &custom_provider,
            &custom_base_url,
            &custom_api_key,
        )
        .await
        {
            Ok(items) if !items.is_empty() => {
                let items = enrich_network_search_items(items).await;
                return Ok(NetworkSearchResult {
                    query,
                    provider: custom_provider.clone(),
                    effective_provider: custom_provider,
                    used_fallback: false,
                    fallback_reason: None,
                    items,
                });
            }
            Ok(_) => {}
            Err(error) => {
                let fallback_items = run_default_network_search(&query, &search_query).await?;
                return Ok(NetworkSearchResult {
                    query,
                    provider: custom_provider,
                    effective_provider: "OpenCow 默认搜索".to_string(),
                    used_fallback: true,
                    fallback_reason: Some(format!(
                        "自定义搜索请求失败，已自动回退到 OpenCow 默认搜索。原因：{error}"
                    )),
                    items: fallback_items,
                });
            }
        }
    }

    let items = run_default_network_search(&query, &search_query).await?;
    Ok(NetworkSearchResult {
        query,
        provider: "OpenCow 默认搜索".to_string(),
        effective_provider: "OpenCow 默认搜索".to_string(),
        used_fallback: false,
        fallback_reason: None,
        items,
    })
}

async fn run_custom_network_search(
    query: &str,
    provider_label: &str,
    base_url: &str,
    api_key: &str,
) -> Result<Vec<NetworkSearchResultItem>, String> {
    if provider_label.is_empty() || base_url.is_empty() || api_key.is_empty() {
        return Err("自定义搜索配置不完整".to_string());
    }

    let provider = provider_label.to_lowercase();
    if provider.contains("serpapi") {
        return run_serpapi_search(query, base_url, api_key).await;
    }

    if provider.contains("tavily") {
        return run_tavily_search(query, base_url, api_key).await;
    }

    Err(format!("暂不支持的自定义搜索提供方：{provider_label}"))
}

async fn run_default_network_search(
    original_query: &str,
    normalized_query: &str,
) -> Result<Vec<NetworkSearchResultItem>, String> {
    let mut failure_reasons = Vec::new();

    match run_bing_rss_search(normalized_query).await {
        Ok(items) if !items.is_empty() => return Ok(enrich_network_search_items(items).await),
        Ok(_) => failure_reasons.push("Bing RSS 没有返回可用结果".to_string()),
        Err(error) => failure_reasons.push(format!("Bing RSS 请求失败：{error}")),
    }

    if contains_cjk(original_query) || contains_cjk(normalized_query) {
        match run_sogou_html_search(normalized_query).await {
            Ok(items) if !items.is_empty() => return Ok(enrich_network_search_items(items).await),
            Ok(_) => failure_reasons.push("搜狗搜索没有返回可用结果".to_string()),
            Err(error) => failure_reasons.push(format!("搜狗搜索请求失败：{error}")),
        }
    }

    match run_wikipedia_open_search(normalized_query).await {
        Ok(items) if !items.is_empty() => return Ok(enrich_network_search_items(items).await),
        Ok(_) => failure_reasons.push("Wikipedia 没有返回可用结果".to_string()),
        Err(error) => failure_reasons.push(format!("Wikipedia 请求失败：{error}")),
    }

    Err(format!(
        "OpenCow 默认搜索当前不可用，请检查网络连接后重试。{}",
        failure_reasons.join("；")
    ))
}

async fn enrich_network_search_items(items: Vec<NetworkSearchResultItem>) -> Vec<NetworkSearchResultItem> {
    let mut enriched = Vec::with_capacity(items.len());

    for mut item in items {
        let page_fact_snippets = fetch_page_fact_snippets(&item.url).await;
        if !page_fact_snippets.is_empty() {
            item.fact_snippets = page_fact_snippets;
        }
        enriched.push(item);
    }

    enriched
}

async fn run_bing_rss_search(query: &str) -> Result<Vec<NetworkSearchResultItem>, String> {
    let client = build_search_client(false)?;
    let response = client
        .get("https://www.bing.com/search")
        .query(&[("q", query), ("format", "rss"), ("setlang", "zh-Hans")])
        .header("Accept", "application/rss+xml, application/xml, text/xml")
        .send()
        .await
        .map_err(|error| format!("request failed: {error}"))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let body = response
        .text()
        .await
        .map_err(|error| format!("failed to read Bing RSS response: {error}"))?;

    let query_tokens = build_search_match_tokens(query);
    let mut items = Vec::new();
    for segment in body.split("<item>").skip(1) {
        let item_block = match segment.split_once("</item>") {
            Some((value, _)) => value,
            None => continue,
        };
        let title = extract_xml_tag(item_block, "title")
            .map(decode_basic_html_entities)
            .map(|value| normalize_search_result_text(&value))
            .unwrap_or_default();
        let url = extract_xml_tag(item_block, "link")
            .map(decode_basic_html_entities)
            .unwrap_or_default();
        let summary = extract_xml_tag(item_block, "description")
            .map(decode_basic_html_entities)
            .map(|value| normalize_search_result_text(&value))
            .unwrap_or_else(|| "OpenCow 默认搜索返回了可用网页结果。".to_string());

        if title.trim().is_empty() || url.trim().is_empty() {
            continue;
        }

        if !result_matches_query(&query_tokens, &title, &summary, &url) {
            continue;
        }

        items.push(NetworkSearchResultItem {
            source_label: infer_source_label(&title, &url, "Bing"),
            fact_snippets: build_fact_snippets(&title, &summary),
            title,
            url,
            summary,
        });
        if items.len() >= 5 {
            break;
        }
    }

    Ok(items)
}

async fn run_sogou_html_search(query: &str) -> Result<Vec<NetworkSearchResultItem>, String> {
    let client = build_search_client(false)?;
    let response = client
        .get("https://www.sogou.com/web")
        .query(&[("query", query)])
        .header("Accept", "text/html,application/xhtml+xml")
        .send()
        .await
        .map_err(|error| format!("request failed: {error}"))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let body = response
        .text()
        .await
        .map_err(|error| format!("failed to read Sogou response: {error}"))?;
    let query_tokens = build_search_match_tokens(query);
    let mut items = Vec::new();

    for segment in body.split("<h3").skip(1) {
        let title_block = match segment.split_once("</h3>") {
            Some((value, _)) => value,
            None => continue,
        };
        let href = extract_html_attribute(title_block, "href").unwrap_or_default();
        let title = normalize_search_result_text(title_block);
        let summary = segment
            .split_once("<div class=\"ft\"")
            .and_then(|(_, rest)| rest.split_once("</div>").map(|(value, _)| value))
            .map(normalize_search_result_text)
            .unwrap_or_else(|| "OpenCow 默认搜索返回了可用网页结果。".to_string());

        let resolved_url = extract_html_attribute(segment, "url")
            .filter(|value| value.starts_with("http"))
            .or_else(|| {
                href.strip_prefix("/link?url=")
                    .map(|_| "https://www.sogou.com".to_string() + &href)
            })
            .unwrap_or(href);

        if title.trim().is_empty() || resolved_url.trim().is_empty() {
            continue;
        }

        if !result_matches_query(&query_tokens, &title, &summary, &resolved_url) {
            continue;
        }

        items.push(NetworkSearchResultItem {
            source_label: infer_source_label(&title, &resolved_url, "搜狗搜索"),
            fact_snippets: build_fact_snippets(&title, &summary),
            title,
            url: resolved_url,
            summary,
        });
        if items.len() >= 5 {
            break;
        }
    }

    Ok(items)
}

async fn run_wikipedia_open_search(query: &str) -> Result<Vec<NetworkSearchResultItem>, String> {
    let encoded_query = urlencoding::encode(query);
    let url = format!(
        "https://en.wikipedia.org/w/api.php?action=opensearch&search={encoded_query}&limit=5&namespace=0&format=json"
    );
    let client = build_search_client(false)?;
    let response = client
        .get(url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|error| format!("request failed: {error}"))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let payload = response
        .json::<WikipediaOpenSearchResponse>()
        .await
        .map_err(|error| format!("failed to parse default search response: {error}"))?;

    let mut items = Vec::new();
    for index in 0..payload.1.len().min(payload.2.len()).min(payload.3.len()) {
        let title = payload.1.get(index).cloned().unwrap_or_default();
        let summary = payload.2.get(index).cloned().unwrap_or_default();
        let url = payload.3.get(index).cloned().unwrap_or_default();

        if title.trim().is_empty() || url.trim().is_empty() {
            continue;
        }

        items.push(NetworkSearchResultItem {
            source_label: infer_source_label(&title, &url, "Wikipedia"),
            fact_snippets: build_fact_snippets(&title, &summary),
            title,
            url,
            summary: if summary.trim().is_empty() {
                "OpenCow 默认搜索返回了可用词条。".to_string()
            } else {
                summary
            },
        });
    }

    Ok(items)
}

fn extract_xml_tag(block: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let (_, rest) = block.split_once(&open)?;
    let (value, _) = rest.split_once(&close)?;
    Some(value.trim().to_string())
}

fn decode_basic_html_entities(value: String) -> String {
    value
        .replace("<![CDATA[", "")
        .replace("]]>", "")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}

fn build_fact_snippets(title: &str, summary: &str) -> Vec<String> {
    let normalized_summary = normalize_search_result_text(summary);
    let normalized_title = normalize_search_result_text(title);
    let combined = if normalized_summary.trim().is_empty() {
        normalized_title
    } else {
        normalized_summary
    };

    build_fact_snippets_from_text(&combined)
}

fn build_fact_snippets_from_text(text: &str) -> Vec<String> {
    text
        .split(|character: char| {
            matches!(
                character,
                '。' | '！' | '？' | ';' | '；' | '\n' | '\r' | '.' | '!' | '?'
            )
        })
        .map(str::trim)
        .filter(|segment| !segment.is_empty())
        .map(|segment| truncate_chars(segment, 120))
        .filter(|segment| segment.chars().count() >= 6)
        .take(4)
        .collect()
}

async fn fetch_page_fact_snippets(url: &str) -> Vec<String> {
    if url.trim().is_empty() || !url.starts_with("http") {
        return Vec::new();
    }

    let client = match build_search_client(false) {
        Ok(client) => client,
        Err(_) => return Vec::new(),
    };

    let response = match client
        .get(url)
        .header("Accept", "text/html,application/xhtml+xml")
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => response,
        _ => return Vec::new(),
    };

    let body = match response.text().await {
        Ok(body) => body,
        Err(_) => return Vec::new(),
    };

    build_fact_snippets_from_html(&body)
}

fn build_fact_snippets_from_html(body: &str) -> Vec<String> {
    let sanitized_body = strip_low_value_html_sections(body);
    let narrowed = extract_preferred_html_block(&sanitized_body)
        .or_else(|| extract_html_tag_content(body, "body"))
        .unwrap_or(&sanitized_body);
    let normalized = normalize_search_result_text(narrowed);

    if normalized.trim().is_empty() {
        return Vec::new();
    }

    build_fact_snippets_from_text(&normalized)
        .into_iter()
        .filter(|segment| segment.chars().count() >= 8)
        .take(4)
        .collect()
}

fn strip_low_value_html_sections(body: &str) -> String {
    let mut sanitized = body.to_string();

    for tag in ["nav", "footer", "aside", "header"] {
        sanitized = remove_html_tag_blocks(&sanitized, tag);
    }

    for marker in [
        "推荐",
        "更多",
        "热门",
        "猜你喜欢",
        "延伸阅读",
        "相关文章",
        "相关阅读",
        "广告",
        "breadcrumb",
        "sidebar",
        "footer",
        "header",
        "nav",
    ] {
        sanitized = remove_html_blocks_containing_marker(&sanitized, marker);
    }

    sanitized
}

fn remove_html_tag_blocks(body: &str, tag: &str) -> String {
    let mut output = body.to_string();

    loop {
        let lower = output.to_lowercase();
        let open_marker = format!("<{tag}");
        let close_marker = format!("</{tag}>");
        let Some(start) = lower.find(&open_marker) else {
            break;
        };
        let Some(end_offset) = lower[start..].find(&close_marker) else {
            break;
        };
        let end = start + end_offset + close_marker.len();
        output.replace_range(start..end, " ");
    }

    output
}

fn remove_html_blocks_containing_marker(body: &str, marker: &str) -> String {
    let mut output = body.to_string();
    let marker_lower = marker.to_lowercase();

    for tag in ["div", "section", "ul"] {
        loop {
            let lower = output.to_lowercase();
            let Some(marker_index) = lower.find(&marker_lower) else {
                break;
            };
            let open_marker = format!("<{tag}");
            let close_marker = format!("</{tag}>");
            let start = lower[..marker_index].rfind(&open_marker);
            let end = lower[marker_index..]
                .find(&close_marker)
                .map(|offset| marker_index + offset + close_marker.len());

            match (start, end) {
                (Some(start), Some(end)) if start < end => {
                    let block = &lower[start..end];
                    if ["<article", "<main", "<p", "<h1", "<h2", "<h3"]
                        .iter()
                        .any(|content_marker| block.contains(content_marker))
                    {
                        let Some(open_end_offset) = block.find('>') else {
                            break;
                        };
                        let inner_start = start + open_end_offset + 1;
                        let Some(relative_marker_index) = lower[inner_start..end].find(&marker_lower) else {
                            break;
                        };
                        let marker_start = inner_start + relative_marker_index;
                        let marker_end = marker_start + marker_lower.len();
                        output.replace_range(marker_start..marker_end, " ");
                    } else {
                        output.replace_range(start..end, " ");
                    }
                }
                _ => break,
            }
        }
    }

    output
}

fn extract_preferred_html_block(body: &str) -> Option<&str> {
    extract_html_tag_content(body, "article")
        .or_else(|| extract_html_tag_content(body, "main"))
}

fn extract_html_tag_content<'a>(body: &'a str, tag: &str) -> Option<&'a str> {
    let lower = body.to_lowercase();
    let open_marker = format!("<{tag}");
    let close_marker = format!("</{tag}>");
    let start = lower.find(&open_marker)?;
    let after_open = lower[start..].find('>')? + start + 1;
    let end = lower[after_open..].find(&close_marker)? + after_open;
    body.get(after_open..end)
}

fn strip_html_tags(value: &str) -> String {
    let mut plain = String::with_capacity(value.len());
    let mut in_tag = false;

    for character in value.chars() {
        match character {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => plain.push(character),
            _ => {}
        }
    }

    decode_basic_html_entities(plain)
        .replace('\n', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn normalize_search_result_text(value: &str) -> String {
    let normalized = strip_html_tags(value);

    if normalized.trim().is_empty() {
        return String::new();
    }

    let mut candidate = normalized.trim().to_string();
    loop {
        let mut trimmed = false;

        for marker in [
            "class=\"vr-title\"",
            "class=\"pt\"",
            "vrcid=\"",
            "id=\"cacheresult_summary_",
            "new Image().src =",
            "[$s.httpsUtil.getPingbackHost()",
            "\"&type=security3&tag=show&uuid=\"",
        ] {
            if let Some(index) = candidate.find(marker) {
                candidate = candidate[index + marker.len()..].trim().to_string();
                trimmed = true;
            }
        }

        if let Some(index) = candidate.find(' ') {
            let first_token = &candidate[..index];
            if first_token.contains('=') || first_token.contains('"') {
                candidate = candidate[index + 1..].trim().to_string();
                trimmed = true;
            }
        }

        if !trimmed {
            break;
        }
    }

    candidate
        .trim_matches(|character: char| matches!(character, '"' | '\'' | '[' | ']' | ';' | ',' | ':'))
        .trim()
        .to_string()
}

fn extract_html_attribute(block: &str, attribute: &str) -> Option<String> {
    let needle = format!("{attribute}=\"");
    let (_, rest) = block.split_once(&needle)?;
    let (value, _) = rest.split_once('"')?;
    Some(decode_basic_html_entities(value.to_string()))
}

fn infer_source_label(title: &str, url: &str, fallback: &str) -> String {
    let normalized_title = title.to_lowercase();

    for (needle, label) in [
        ("百度百科", "百度百科"),
        ("搜狗百科", "搜狗百科"),
        ("维基百科", "Wikipedia"),
        ("wikipedia", "Wikipedia"),
        ("微博", "微博"),
        ("抖音", "抖音"),
        ("小红书", "小红书"),
        ("知乎", "知乎"),
        ("哔哩哔哩", "Bilibili"),
        ("bilibili", "Bilibili"),
        ("github", "GitHub"),
        ("csdn", "CSDN"),
        ("公众号", "微信公众号"),
        ("微信公众平台", "微信公众号"),
        ("豆包", "豆包"),
    ] {
        if normalized_title.contains(&needle.to_lowercase()) {
            return label.to_string();
        }
    }

    infer_source_label_from_url(url, fallback)
}

fn infer_source_label_from_url(url: &str, fallback: &str) -> String {
    let normalized = url.to_lowercase();

    if normalized.contains("baike.sogou.com") {
        return "搜狗百科".to_string();
    }
    if normalized.contains("baike.baidu.com") {
        return "百度百科".to_string();
    }
    if normalized.contains("zhidao.baidu.com") {
        return "百度知道".to_string();
    }
    if normalized.contains("douyin.com") {
        return "抖音".to_string();
    }
    if normalized.contains("weibo.com") {
        return "微博".to_string();
    }
    if normalized.contains("xiaohongshu.com") {
        return "小红书".to_string();
    }
    if normalized.contains("zhihu.com") {
        return "知乎".to_string();
    }
    if normalized.contains("bilibili.com") {
        return "Bilibili".to_string();
    }
    if normalized.contains("mp.weixin.qq.com") {
        return "微信公众号".to_string();
    }
    if normalized.contains("github.com") {
        return "GitHub".to_string();
    }
    if normalized.contains("huggingface.co") {
        return "Hugging Face".to_string();
    }
    if normalized.contains("csdn.net") {
        return "CSDN".to_string();
    }
    if normalized.contains("sogou.com") {
        return "搜狗搜索".to_string();
    }
    if normalized.contains("bing.com") {
        return "Bing".to_string();
    }
    if normalized.contains("wikipedia.org") {
        return "Wikipedia".to_string();
    }
    if normalized.contains("doubao.com") {
        return "豆包官网".to_string();
    }

    if let Some(host) = extract_host_label(url) {
        return host;
    }

    fallback.to_string()
}

fn extract_host_label(url: &str) -> Option<String> {
    let without_scheme = url
        .split_once("://")
        .map(|(_, rest)| rest)
        .unwrap_or(url);
    let host = without_scheme.split('/').next()?.trim().to_lowercase();
    if host.is_empty() {
        return None;
    }

    let host = host.strip_prefix("www.").unwrap_or(&host);
    let host = host.strip_prefix("m.").unwrap_or(host);
    let parts = host.split('.').collect::<Vec<_>>();

    if parts.len() >= 2 {
        let main = parts[parts.len().saturating_sub(2)];
        if !main.is_empty() {
            let mut characters = main.chars();
            let first = characters.next()?;
            let mut label = first.to_uppercase().collect::<String>();
            label.push_str(characters.as_str());
            return Some(label);
        }
    }

    None
}

fn normalize_network_search_query(query: &str) -> String {
    let mut normalized = query.trim().replace('？', "?").replace('，', " ");
    for phrase in [
        "请帮我",
        "请",
        "帮我上网搜索",
        "请帮我上网搜索",
        "帮我联网搜索",
        "请帮我联网搜索",
        "上网搜索一下",
        "联网搜索一下",
        "上网搜索",
        "联网搜索",
        "搜索一下",
        "搜索",
        "帮我查一下",
        "查一下",
        "帮我查查",
        "查查",
        "相关信息",
        "相关资料",
        "最新资料",
        "最新信息",
        "一下",
    ] {
        normalized = normalized.replace(phrase, " ");
    }

    let collapsed = normalized
        .split(|character: char| {
            character.is_whitespace()
                || matches!(
                    character,
                    ',' | '.' | '?' | '!' | '。' | '、' | ':' | '：' | ';' | '；' | '“' | '”'
                )
        })
        .filter(|segment| !segment.trim().is_empty())
        .collect::<Vec<_>>()
        .join(" ");

    if collapsed.is_empty() {
        query.trim().to_string()
    } else {
        collapsed
    }
}

fn contains_cjk(value: &str) -> bool {
    value.chars().any(|character| {
        ('\u{4E00}'..='\u{9FFF}').contains(&character)
            || ('\u{3400}'..='\u{4DBF}').contains(&character)
    })
}

fn build_search_match_tokens(query: &str) -> Vec<String> {
    let collapsed = normalize_network_search_query(query);
    let mut tokens = collapsed
        .split_whitespace()
        .map(|part| part.trim().to_lowercase())
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();

    if contains_cjk(&collapsed) {
        tokens.push(collapsed.replace(' ', "").to_lowercase());
    }

    tokens.sort();
    tokens.dedup();
    tokens
}

fn result_matches_query(tokens: &[String], title: &str, summary: &str, url: &str) -> bool {
    if tokens.is_empty() {
        return true;
    }

    let haystack = format!("{title} {summary} {url}").to_lowercase();
    tokens.iter().any(|token| {
        if token.len() >= 2 && contains_cjk(token) {
            haystack.contains(token)
        } else if token.len() >= 3 {
            haystack.contains(token)
        } else {
            false
        }
    })
}

async fn run_serpapi_search(
    query: &str,
    base_url: &str,
    api_key: &str,
) -> Result<Vec<NetworkSearchResultItem>, String> {
    let client = build_search_client(false)?;
    let mut url = base_url.trim().to_string();
    if url.is_empty() {
        url = "https://serpapi.com/search.json".to_string();
    }

    let response = client
        .get(url)
        .query(&[("q", query), ("api_key", api_key), ("engine", "google")])
        .send()
        .await
        .map_err(|error| format!("request failed: {error}"))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| format!("failed to parse SerpAPI response: {error}"))?;
    Ok(extract_json_search_items(
        payload.get("organic_results").and_then(Value::as_array),
        "title",
        "link",
        &["snippet"],
    ))
}

async fn run_tavily_search(
    query: &str,
    base_url: &str,
    api_key: &str,
) -> Result<Vec<NetworkSearchResultItem>, String> {
    let client = build_search_client(false)?;
    let mut url = base_url.trim().to_string();
    if url.is_empty() {
        url = "https://api.tavily.com/search".to_string();
    }

    let response = client
        .post(url)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "query": query,
            "api_key": api_key,
            "search_depth": "basic",
            "max_results": 5,
        }))
        .send()
        .await
        .map_err(|error| format!("request failed: {error}"))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| format!("failed to parse Tavily response: {error}"))?;
    Ok(extract_json_search_items(
        payload.get("results").and_then(Value::as_array),
        "title",
        "url",
        &["content", "snippet"],
    ))
}

fn extract_json_search_items(
    array: Option<&Vec<Value>>,
    title_key: &str,
    url_key: &str,
    summary_keys: &[&str],
) -> Vec<NetworkSearchResultItem> {
    array
        .into_iter()
        .flat_map(|items| items.iter())
        .filter_map(|item| {
            let title = item
                .get(title_key)
                .and_then(Value::as_str)?
                .trim();
            let url = item
                .get(url_key)
                .and_then(Value::as_str)?
                .trim()
                .to_string();
            let title = normalize_search_result_text(title);
            if title.is_empty() || url.is_empty() {
                return None;
            }
            let summary = summary_keys
                .iter()
                .find_map(|key| item.get(*key).and_then(Value::as_str))
                .map(str::trim)
                .map(normalize_search_result_text)
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| "搜索提供方返回了可用结果。".to_string());
            let source_label = infer_source_label(&title, &url, "外部来源");
            let fact_snippets = build_fact_snippets(&title, &summary);
            Some(NetworkSearchResultItem {
                title,
                url,
                source_label,
                fact_snippets,
                summary,
            })
        })
        .take(5)
        .collect()
}

fn build_search_client(use_system_proxy: bool) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .user_agent("OpenCowDesktop/0.1 network-search");

    if use_system_proxy {
        if let Some(proxy_url) = resolve_system_proxy_url() {
            let proxy = reqwest::Proxy::all(&proxy_url)
                .map_err(|error| format!("failed to configure proxy {proxy_url}: {error}"))?;
            builder = builder.proxy(proxy);
        }
    } else {
        builder = builder.no_proxy();
    }

    builder
        .build()
        .map_err(|error| format!("failed to build search client: {error}"))
}

fn resolve_system_proxy_url() -> Option<String> {
    [
        "HTTPS_PROXY",
        "https_proxy",
        "HTTP_PROXY",
        "http_proxy",
        "ALL_PROXY",
        "all_proxy",
    ]
    .into_iter()
    .find_map(|key| env::var(key).ok())
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty())
}

#[tauri::command]
pub fn workspace_npc_configs_list() -> Result<NpcWorkspaceResult, String> {
    let root = resolve_workspace_root()?;
    list_workspace_npc_configs(&root)
}

#[tauri::command]
pub fn workspace_npc_config_read(npc_id: String) -> Result<NpcWorkspaceConfigRecord, String> {
    let root = resolve_workspace_root()?;
    read_workspace_npc_config(&root, &npc_id)
}

#[tauri::command]
pub fn workspace_npc_config_create(
    app: AppHandle,
    payload: NpcWorkspaceConfigMutationPayload,
) -> Result<NpcWorkspaceResult, String> {
    let root = resolve_workspace_root()?;
    let selected_npc_id = slugify_npc_config_name(&payload.payload.id);
    upsert_workspace_npc_config(&app, &root, payload.payload, payload.rollback_context)?;
    list_workspace_npc_configs_for_selection(&root, Some(selected_npc_id))
}

#[tauri::command]
pub fn workspace_npc_config_update(
    app: AppHandle,
    payload: NpcWorkspaceConfigMutationPayload,
) -> Result<NpcWorkspaceResult, String> {
    let root = resolve_workspace_root()?;
    let selected_npc_id = slugify_npc_config_name(&payload.payload.id);
    upsert_workspace_npc_config(&app, &root, payload.payload, payload.rollback_context)?;
    list_workspace_npc_configs_for_selection(&root, Some(selected_npc_id))
}

fn slugify_npc_config_name(name: &str) -> String {
    let mut slug = String::new();

    for character in name.chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character.to_ascii_lowercase());
        } else if character.is_whitespace() || matches!(character, '-' | '_' | '.') {
            if !slug.ends_with('-') {
                slug.push('-');
            }
        }
    }

    let trimmed = slug.trim_matches('-').to_string();

    if trimmed.is_empty() {
        "custom-npc".to_string()
    } else {
        trimmed
    }
}

fn list_workspace_npc_configs(root: &Path) -> Result<NpcWorkspaceResult, String> {
    list_workspace_npc_configs_for_selection(root, None)
}

fn read_workspace_npc_config(
    root: &Path,
    npc_id: &str,
) -> Result<NpcWorkspaceConfigRecord, String> {
    let normalized_id = slugify_npc_config_name(npc_id);
    let config_path = root
        .join(".opencow")
        .join("npcs")
        .join(format!("{normalized_id}.json"));
    ensure_path_stays_in_workspace(root, &config_path)?;

    let raw = fs::read_to_string(&config_path)
        .map_err(|error| format!("failed to read {}: {error}", config_path.display()))?;
    let value: Value = serde_json::from_str(&raw)
        .map_err(|error| format!("failed to parse {}: {error}", config_path.display()))?;

    Ok(normalize_npc_workspace_record(&value, &config_path))
}

fn list_workspace_npc_configs_for_selection(
    root: &Path,
    selected_npc_id: Option<String>,
) -> Result<NpcWorkspaceResult, String> {
    let npc_directory = root.join(".opencow").join("npcs");

    if !npc_directory.exists() {
        return Ok(NpcWorkspaceResult {
            summary: "NPC workspace loaded 0 configs.".to_string(),
            selected_npc_id: None,
            items: Vec::new(),
        });
    }

    let mut items = Vec::new();
    let entries = fs::read_dir(&npc_directory)
        .map_err(|error| format!("failed to read {}: {error}", npc_directory.display()))?;

    for entry in entries {
        let entry = entry.map_err(|error| {
            format!(
                "failed to read NPC workspace entry under {}: {error}",
                npc_directory.display()
            )
        })?;
        let path = entry.path();

        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }

        let raw = fs::read_to_string(&path)
            .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let value: Value = serde_json::from_str(&raw)
            .map_err(|error| format!("failed to parse {}: {error}", path.display()))?;
        items.push(normalize_npc_workspace_record(&value, &path));
    }

    items.sort_by(|left, right| left.name.cmp(&right.name));

    Ok(NpcWorkspaceResult {
        summary: format!("NPC workspace loaded {} configs.", items.len()),
        selected_npc_id: selected_npc_id
            .filter(|target_id| items.iter().any(|item| item.id == *target_id))
            .or_else(|| items.first().map(|item| item.id.clone())),
        items,
    })
}

fn upsert_workspace_npc_config<R: Runtime>(
    app: &AppHandle<R>,
    root: &Path,
    payload: NpcWorkspaceConfigUpsertPayload,
    rollback_context: Option<RollbackContextPayload>,
) -> Result<(), String> {
    let npc_directory = root.join(".opencow").join("npcs");
    fs::create_dir_all(&npc_directory)
        .map_err(|error| format!("failed to create {}: {error}", npc_directory.display()))?;

    let id = slugify_npc_config_name(&payload.id);
    let config_path = npc_directory.join(format!("{id}.json"));
    ensure_path_stays_in_workspace(root, &config_path)?;
    capture_paths_for_context(app, &rollback_context, &[config_path.clone()])?;

    let record = NpcWorkspaceConfigRecord {
        id,
        name: payload.name.trim().to_string(),
        description: payload.description.trim().to_string(),
        default_model: payload.default_model.trim().to_string(),
        persona_title: payload.persona_title.trim().to_string(),
        persona_prompt: payload.persona_prompt,
        output_style: payload.output_style,
        agent_draft: payload.agent_draft,
        rules_draft: payload.rules_draft,
        enabled_skill_names: payload.enabled_skill_names,
        knowledge_library_ids: payload.knowledge_library_ids,
        updated_at: current_unix_timestamp_string(),
    };
    let serialized = serde_json::to_string_pretty(&record)
        .map_err(|error| format!("failed to serialize NPC config: {error}"))?;
    fs::write(&config_path, format!("{serialized}\n"))
        .map_err(|error| format!("failed to write {}: {error}", config_path.display()))?;

    Ok(())
}

fn normalize_npc_workspace_record(value: &Value, path: &Path) -> NpcWorkspaceConfigRecord {
    let fallback_name = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("custom-npc")
        .to_string();

    NpcWorkspaceConfigRecord {
        id: value
            .get("id")
            .and_then(Value::as_str)
            .map(|value| value.to_string())
            .unwrap_or_else(|| slugify_npc_config_name(&fallback_name)),
        name: value
            .get("name")
            .and_then(Value::as_str)
            .map(|value| value.to_string())
            .unwrap_or_else(|| fallback_name.clone()),
        description: value
            .get("description")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        default_model: value
            .get("default_model")
            .or_else(|| value.get("local_model"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        persona_title: value
            .get("persona_title")
            .or_else(|| value.get("role"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        persona_prompt: value
            .get("persona_prompt")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        output_style: value
            .get("output_style")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        agent_draft: value
            .get("agent_draft")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        rules_draft: value
            .get("rules_draft")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        enabled_skill_names: value
            .get("enabled_skill_names")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(|value| value.to_string())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default(),
        knowledge_library_ids: value
            .get("knowledge_library_ids")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(|value| value.to_string())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_else(|| {
                value
                    .get("knowledge_library_id")
                    .and_then(Value::as_str)
                    .map(|value| vec![value.to_string()])
                    .unwrap_or_default()
            }),
        updated_at: value
            .get("updated_at")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
    }
}

fn ensure_path_stays_in_workspace(root: &Path, target: &Path) -> Result<(), String> {
    let absolute_root = root.canonicalize().map_err(|error| {
        format!(
            "failed to canonicalize workspace root {}: {error}",
            root.display()
        )
    })?;
    let parent = target
        .parent()
        .ok_or_else(|| format!("target path has no parent: {}", target.display()))?;
    let absolute_parent = parent.canonicalize().map_err(|error| {
        format!(
            "failed to canonicalize target parent {}: {error}",
            parent.display()
        )
    })?;

    if absolute_parent.starts_with(&absolute_root) {
        Ok(())
    } else {
        Err(format!(
            "target path {} is outside workspace root {}",
            target.display(),
            root.display()
        ))
    }
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
    launched_at: String,
    last_status: String,
    last_checked_at: String,
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
    name: String,
    path: String,
    source: String,
    description: String,
    activation: String,
    tool_count: usize,
    skill_count: usize,
    status: String,
    supported: bool,
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

#[derive(Clone, Serialize, Deserialize)]
struct RecommendedMcpManifestItem {
    id: String,
    name: String,
    description: String,
    source: String,
    install_query: String,
    rationale: String,
    supported: bool,
}

#[derive(Serialize)]
pub struct RecommendedMcpManifestResult {
    summary: String,
    total_count: usize,
    items: Vec<RecommendedMcpManifestItem>,
}

#[derive(Serialize)]
pub struct LocalMcpPluginInstallResult {
    query: String,
    installed_plugin_id: String,
    installed_plugin_name: String,
    installed_plugin_path: String,
    source_plugin_path: String,
    status: String,
    summary: String,
}

#[derive(Serialize)]
pub struct LocalMcpPluginUninstallResult {
    query: String,
    removed_plugin_id: String,
    removed_plugin_name: String,
    removed_plugin_path: String,
    status: String,
    summary: String,
}

#[derive(Serialize)]
pub struct LocalKnowledgeSearchResult {
    query: String,
    summary: String,
    provider: String,
    fallback_reason: Option<String>,
    match_count: usize,
    indexed_document_count: usize,
    items: Vec<LocalKnowledgeSearchItem>,
}

#[derive(Serialize)]
pub struct LocalKnowledgeSearchItem {
    path: String,
    title: String,
    snippet: String,
    fact_snippets: Vec<String>,
    score: usize,
}

#[derive(Clone, Serialize, Deserialize)]
struct ImportedKnowledgeFileRecord {
    path: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct KnowledgeLibraryRecord {
    id: String,
    label: String,
    description: String,
    imported_files: Vec<ImportedKnowledgeFileRecord>,
}

#[derive(Serialize, Deserialize)]
struct KnowledgeImportRegistry {
    version: usize,
    active_library_id: String,
    libraries: Vec<KnowledgeLibraryRecord>,
}

#[derive(Serialize)]
pub struct KnowledgeInventoryFileItem {
    path: String,
    title: String,
    status: String,
}

#[derive(Serialize)]
pub struct KnowledgeInventoryAvailableFileItem {
    path: String,
    title: String,
}

#[derive(Serialize)]
pub struct KnowledgeInventoryResult {
    imported_files: Vec<KnowledgeInventoryFileItem>,
    available_files: Vec<KnowledgeInventoryAvailableFileItem>,
    indexed_document_count: usize,
    registry_path: String,
    summary: String,
    active_library_id: String,
    active_library_label: String,
    libraries: Vec<KnowledgeInventoryLibraryItem>,
}

#[derive(Serialize)]
pub struct KnowledgeInventoryLibraryItem {
    id: String,
    label: String,
    description: String,
    document_count: usize,
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
pub struct RecommendedSkillManifestResult {
    summary: String,
    total_count: usize,
    items: Vec<RecommendedSkillManifestItem>,
}

#[derive(Serialize)]
pub struct RecommendedSkillManifestItem {
    name: String,
    description: String,
    source: String,
    install_query: String,
    rationale: String,
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
pub struct OpencowSelfRepairWorkspaceProjectRuntimeRegistryResult {
    query: String,
    repair_target: String,
    repaired_path: String,
    status: String,
    preserved_entry_count: usize,
    verified_version: usize,
    verified_run_count: usize,
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
        root_path: root.display().to_string(),
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
    let package_manager_files =
        collect_existing_paths(&root, &["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);
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
    let matched = select_project_run_candidate(&normalized_query, &candidates).or_else(|| {
        candidates
            .iter()
            .find(|candidate| candidate.script_names.iter().any(|name| name == "dev"))
    });

    let matched_project_name = matched.map(|candidate| candidate.name.clone());
    let matched_project_path = matched.map(|candidate| candidate.relative_path.clone());
    let matched_project_source = matched.map(|candidate| candidate.source.clone());
    let dev_command =
        matched.and_then(|candidate| build_npm_script_command(&candidate.script_names, "dev"));
    let start_command =
        matched.and_then(|candidate| build_npm_script_command(&candidate.script_names, "start"));
    let build_command =
        matched.and_then(|candidate| build_npm_script_command(&candidate.script_names, "build"));
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
        .or_else(|| {
            candidates
                .iter()
                .find(|candidate| candidate.script_names.iter().any(|name| name == "dev"))
        })
        .ok_or_else(|| "no runnable local workspace project matched the request".to_string())?;
    let command_label = build_project_run_command_label(matched).ok_or_else(|| {
        format!(
            "matched project {} does not expose a supported run script",
            matched.name
        )
    })?;
    let expected_url = infer_project_expected_url(Some(matched));
    let working_directory = root.join(&matched.relative_path);
    let escaped_working_directory =
        escape_powershell_single_quote(&working_directory.display().to_string());
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
            output.status, stderr
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).replace("\r\n", "\n");
    let stdout_preview = truncate_preview(stdout.trim(), 20);
    let pid = parse_workspace_project_run_pid(&stdout_preview).ok_or_else(|| {
        format!(
            "workspace project run returned an invalid live process handle for {}: {}",
            matched.relative_path, stdout_preview
        )
    })?;

    let working_directory_relative = path_relative_to_root(&root, &working_directory);

    upsert_workspace_project_runtime_record(
        &root,
        WorkspaceProjectRuntimeRecord {
            project_name: matched.name.clone(),
            project_path: matched.relative_path.clone(),
            command_label: command_label.clone(),
            working_directory: working_directory_relative.clone(),
            pid,
            launched_at: current_unix_timestamp_string(),
            last_status: "running".to_string(),
            last_checked_at: current_unix_timestamp_string(),
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
        summary:
            "Workspace project run started successfully and returned a live local process handle."
                .to_string(),
    })
}

#[tauri::command]
pub fn workspace_project_status(query: String) -> Result<WorkspaceProjectStatusResult, String> {
    let root = resolve_workspace_root()?;
    let candidates = collect_workspace_project_run_candidates(&root)?;
    let normalized_query = query.to_lowercase();
    let matched = select_project_run_candidate(&normalized_query, &candidates)
        .or_else(|| {
            candidates
                .iter()
                .find(|candidate| candidate.script_names.iter().any(|name| name == "dev"))
        })
        .ok_or_else(|| "no runnable local workspace project matched the request".to_string())?;
    let command_label = build_project_run_command_label(matched).ok_or_else(|| {
        format!(
            "matched project {} does not expose a supported run script",
            matched.name
        )
    })?;
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
            .map_err(|error| {
                format!("failed to execute workspace project status command: {error}")
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(format!(
                "workspace project status failed with status {}: {}",
                output.status, stderr
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

        upsert_workspace_project_runtime_record(
            &root,
            WorkspaceProjectRuntimeRecord {
                last_status: "running".to_string(),
                last_checked_at: current_unix_timestamp_string(),
                ..runtime.clone()
            },
        )?;

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
        summary:
            "Workspace project status found no active local process handle for the matched project."
                .to_string(),
    })
}

#[tauri::command]
pub fn workspace_project_stop(query: String) -> Result<WorkspaceProjectStopResult, String> {
    let root = resolve_workspace_root()?;
    let candidates = collect_workspace_project_run_candidates(&root)?;
    let normalized_query = query.to_lowercase();
    let matched = select_project_run_candidate(&normalized_query, &candidates)
        .or_else(|| {
            candidates
                .iter()
                .find(|candidate| candidate.script_names.iter().any(|name| name == "dev"))
        })
        .ok_or_else(|| "no runnable local workspace project matched the request".to_string())?;
    let record =
        find_workspace_project_runtime_record(&root, &matched.relative_path)?.ok_or_else(|| {
            format!(
                "no running workspace project handle was recorded for {}",
                matched.relative_path
            )
        })?;
    let powershell_command = format!(
        "$targetPid = {0}; \
if (-not (Get-Process -Id $targetPid -ErrorAction SilentlyContinue)) {{ \"stopped:$targetPid\"; exit 0 }}; \
$childIds = New-Object System.Collections.Generic.List[int]; \
function Add-Descendants([int]$ParentPid, $Accumulator) {{ \
  $children = Get-CimInstance Win32_Process -Filter (\"ParentProcessId = \" + $ParentPid) -ErrorAction SilentlyContinue; \
  foreach ($child in $children) {{ \
    $childPid = [int]$child.ProcessId; \
    if (-not $Accumulator.Contains($childPid)) {{ \
      $Accumulator.Add($childPid) | Out-Null; \
      Add-Descendants $childPid $Accumulator; \
    }} \
  }} \
}}; \
Add-Descendants $targetPid $childIds; \
foreach ($childPid in ($childIds | Sort-Object -Descending)) {{ \
  Stop-Process -Id $childPid -Force -ErrorAction SilentlyContinue; \
}}; \
Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue; \
\"stopped:$targetPid descendants:$($childIds.Count)\"",
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
            output.status, stderr
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
        summary:
            "Workspace project stop completed successfully and released the local process handle."
                .to_string(),
    })
}

#[tauri::command]
pub fn workspace_project_npc_screenshot_capture(
    query: String,
) -> Result<WorkspaceProjectNpcScreenshotCaptureResult, String> {
    let root = resolve_workspace_root()?;
    let candidates = collect_workspace_project_run_candidates(&root)?;
    let normalized_query = query.to_lowercase();
    let matched = select_project_run_candidate(&normalized_query, &candidates)
        .or_else(|| {
            candidates
                .iter()
                .find(|candidate| candidate.script_names.iter().any(|name| name == "dev"))
        })
        .ok_or_else(|| {
            "no runnable local workspace project matched the screenshot capture request".to_string()
        })?;
    let runtime = find_workspace_project_runtime_record(&root, &matched.relative_path)?
        .ok_or_else(|| {
            format!(
                "No active matched local project run is available for NPC screenshot capture: {}",
                matched.relative_path
            )
        })?;
    let expected_url = infer_project_expected_url(Some(matched));
    let capture_target = expected_url.clone().ok_or_else(|| {
        format!(
            "no local capture target URL could be inferred for {}",
            matched.relative_path
        )
    })?;
    let artifact_path = build_npc_showcase_screenshot_artifact_path(
        &root,
        &matched.name,
        &current_unix_timestamp_string(),
    );

    capture_url_to_png_via_edge(&capture_target, &artifact_path)?;

    Ok(WorkspaceProjectNpcScreenshotCaptureResult {
        project_name: runtime.project_name,
        project_path: runtime.project_path,
        expected_url,
        artifact_path: path_relative_to_root(&root, &artifact_path),
        artifact_directory: ".opencow/artifacts/npc-showcase".to_string(),
        capture_target,
        summary: "NPC local project screenshot capture completed successfully and wrote a workspace-local artifact.".to_string(),
    })
}

#[tauri::command]
pub fn workspace_project_npc_showcase_site_write(
    app: AppHandle,
    query: String,
    rollback_context: Option<RollbackContextPayload>,
) -> Result<WorkspaceProjectNpcShowcaseSiteWriteResult, String> {
    workspace_project_npc_showcase_site_write_with_app(&app, query, rollback_context)
}

fn workspace_project_npc_showcase_site_write_with_app<R: Runtime>(
    app: &AppHandle<R>,
    query: String,
    rollback_context: Option<RollbackContextPayload>,
) -> Result<WorkspaceProjectNpcShowcaseSiteWriteResult, String> {
    let root = resolve_workspace_root()?;
    let candidates = collect_workspace_project_run_candidates(&root)?;
    let normalized_query = query.to_lowercase();
    let matched = select_project_run_candidate(&normalized_query, &candidates)
        .or_else(|| {
            candidates
                .iter()
                .find(|candidate| candidate.script_names.iter().any(|name| name == "dev"))
        })
        .ok_or_else(|| {
            "no runnable local workspace project matched the showcase-site write request"
                .to_string()
        })?;
    let runtime = find_workspace_project_runtime_record(&root, &matched.relative_path)?
        .ok_or_else(|| {
            format!(
                "No active matched local project run is available for NPC showcase-site write: {}",
                matched.relative_path
            )
        })?;
    let screenshot_artifact = find_latest_npc_showcase_screenshot_artifact(&root, &matched.name)?
        .ok_or_else(|| {
        format!(
            "No screenshot artifact is available for NPC showcase-site write: {}",
            matched.name
        )
    })?;
    let expected_url = infer_project_expected_url(Some(matched));
    let site_root = build_npc_showcase_site_root(&root, &matched.name);
    let entry_file = site_root.join("index.html");
    capture_paths_for_context(&app, &rollback_context, &[site_root.clone()])?;

    write_npc_showcase_site_html(
        &entry_file,
        &runtime.project_name,
        &runtime.project_path,
        expected_url.as_deref(),
        &screenshot_artifact,
    )?;

    Ok(WorkspaceProjectNpcShowcaseSiteWriteResult {
        project_name: runtime.project_name,
        project_path: runtime.project_path,
        site_root: path_relative_to_root(&root, &site_root),
        entry_file: path_relative_to_root(&root, &entry_file),
        changed_paths: vec![path_relative_to_root(&root, &entry_file)],
        source_screenshot_path: path_relative_to_root(&root, &screenshot_artifact),
        summary: "NPC local project showcase-site write completed successfully and returned a changed-file summary.".to_string(),
    })
}

#[tauri::command]
pub fn workspace_project_npc_showcase_publish_preview(
    query: String,
) -> Result<WorkspaceProjectNpcShowcasePublishPreviewResult, String> {
    let root = resolve_workspace_root()?;
    let candidates = collect_workspace_project_run_candidates(&root)?;
    let normalized_query = query.to_lowercase();
    let matched = select_project_run_candidate(&normalized_query, &candidates)
        .or_else(|| {
            candidates
                .iter()
                .find(|candidate| candidate.script_names.iter().any(|name| name == "dev"))
        })
        .ok_or_else(|| {
            "no runnable local workspace project matched the NPC showcase publish preview request"
                .to_string()
        })?;
    let site_root = build_npc_showcase_site_root(&root, &matched.name);
    let entry_file = site_root.join("index.html");
    if !entry_file.exists() {
        return Err(format!(
            "No generated showcase site output is available for NPC showcase publish preview: {}",
            matched.name
        ));
    }

    let screenshot_artifact = find_latest_npc_showcase_screenshot_artifact(&root, &matched.name)?
        .ok_or_else(|| {
        format!(
            "No screenshot artifact is available for NPC showcase publish preview: {}",
            matched.name
        )
    })?;

    Ok(WorkspaceProjectNpcShowcasePublishPreviewResult {
        project_name: matched.name.clone(),
        project_path: matched.relative_path.clone(),
        site_root: path_relative_to_root(&root, &site_root),
        entry_file: path_relative_to_root(&root, &entry_file),
        changed_paths: vec![path_relative_to_root(&root, &entry_file)],
        source_screenshot_path: path_relative_to_root(&root, &screenshot_artifact),
        next_git_step: "Git commit or push is still separate and requires its own explicit confirmation stage.".to_string(),
        summary: "NPC local project showcase publish preview loaded the latest generated showcase outputs without starting any git action.".to_string(),
    })
}

#[tauri::command]
pub fn openclaw_capability_overview(
    capability_id: String,
) -> Result<OpenClawCapabilityOverview, String> {
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
pub fn local_knowledge_search(
    query: String,
    library_id: Option<String>,
) -> Result<LocalKnowledgeSearchResult, String> {
    let root = resolve_workspace_root()?;
    let registry = read_knowledge_import_registry(&root)?;
    let active_library_id = resolve_knowledge_library_id(&registry, library_id);
    let candidates = registry
        .libraries
        .iter()
        .find(|library| library.id == active_library_id)
        .map(|library| {
            library
                .imported_files
                .iter()
                .map(|entry| root.join(&entry.path))
                .filter(|path| path.exists() && is_local_knowledge_file(path))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let indexed_document_count = candidates.len();
    let tokens = tokenize_query(&query);
    let mut items = Vec::new();

    for path in candidates {
        let raw = fs::read_to_string(&path)
            .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
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
                fact_snippets: build_fact_snippets_from_text(snippet),
                score,
            });
        }
    }

    items.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then(left.path.cmp(&right.path))
    });
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
        provider: "keyword-fallback".to_string(),
        fallback_reason: Some(
            "Ollama embedding is not available in the current local index path, so deterministic keyword retrieval was used.".to_string(),
        ),
        match_count,
        indexed_document_count,
        items,
    })
}

#[tauri::command]
pub fn knowledge_inventory(library_id: Option<String>) -> Result<KnowledgeInventoryResult, String> {
    let root = resolve_workspace_root()?;
    build_knowledge_inventory(&root, library_id)
}

#[tauri::command]
pub fn knowledge_file_import(
    app: AppHandle,
    path: String,
    library_id: Option<String>,
    rollback_context: Option<RollbackContextPayload>,
) -> Result<KnowledgeInventoryResult, String> {
    let root = resolve_workspace_root()?;
    let normalized = normalize_workspace_relative_knowledge_path(&root, &path)?;

    if !is_local_knowledge_file(&root.join(&normalized)) {
        return Err(format!(
            "knowledge import only supports md/txt files: {normalized}"
        ));
    }

    let mut registry = read_knowledge_import_registry(&root)?;
    let target_library_id = resolve_knowledge_library_id(&registry, library_id);
    capture_paths_for_context(
        &app,
        &rollback_context,
        &[knowledge_registry_path(&root)],
    )?;

    if let Some(library) = registry
        .libraries
        .iter_mut()
        .find(|library| library.id == target_library_id)
    {
        if !library
            .imported_files
            .iter()
            .any(|entry| entry.path == normalized)
        {
            library
                .imported_files
                .push(ImportedKnowledgeFileRecord { path: normalized });
            library
                .imported_files
                .sort_by(|left, right| left.path.cmp(&right.path));
            write_knowledge_import_registry(&root, &registry)?;
        }
    }

    build_knowledge_inventory(&root, Some(target_library_id))
}

#[tauri::command]
pub fn knowledge_file_remove(
    app: AppHandle,
    path: String,
    library_id: Option<String>,
    rollback_context: Option<RollbackContextPayload>,
) -> Result<KnowledgeInventoryResult, String> {
    let root = resolve_workspace_root()?;
    let normalized = normalize_workspace_relative_knowledge_path(&root, &path)?;
    let mut registry = read_knowledge_import_registry(&root)?;
    let target_library_id = resolve_knowledge_library_id(&registry, library_id);
    capture_paths_for_context(
        &app,
        &rollback_context,
        &[knowledge_registry_path(&root)],
    )?;

    if let Some(library) = registry
        .libraries
        .iter_mut()
        .find(|library| library.id == target_library_id)
    {
        library
            .imported_files
            .retain(|entry| entry.path != normalized);
    }
    write_knowledge_import_registry(&root, &registry)?;

    build_knowledge_inventory(&root, Some(target_library_id))
}

#[tauri::command]
pub fn knowledge_imports_clear(
    app: AppHandle,
    library_id: Option<String>,
    rollback_context: Option<RollbackContextPayload>,
) -> Result<KnowledgeInventoryResult, String> {
    let root = resolve_workspace_root()?;
    let mut registry = read_knowledge_import_registry(&root)?;
    let target_library_id = resolve_knowledge_library_id(&registry, library_id);
    capture_paths_for_context(
        &app,
        &rollback_context,
        &[knowledge_registry_path(&root)],
    )?;

    if let Some(library) = registry
        .libraries
        .iter_mut()
        .find(|library| library.id == target_library_id)
    {
        library.imported_files.clear();
    }

    write_knowledge_import_registry(&root, &registry)?;
    build_knowledge_inventory(&root, Some(target_library_id))
}

#[tauri::command]
pub fn knowledge_library_create(
    app: AppHandle,
    name: String,
    description: Option<String>,
    rollback_context: Option<RollbackContextPayload>,
) -> Result<KnowledgeInventoryResult, String> {
    let root = resolve_workspace_root()?;
    let trimmed = name.trim();
    let trimmed_description = description.unwrap_or_default().trim().to_string();
    capture_paths_for_context(
        &app,
        &rollback_context,
        &[knowledge_registry_path(&root)],
    )?;

    if trimmed.is_empty() {
        return Err("knowledge library name cannot be empty".to_string());
    }

    let mut slug = trimmed
        .to_lowercase()
        .chars()
        .filter(|character| {
            character.is_ascii_alphanumeric()
                || *character == '-'
                || *character == ' '
                || ('\u{4e00}'..='\u{9fa5}').contains(character)
        })
        .collect::<String>()
        .replace(' ', "-");

    if slug.is_empty() {
        slug = format!(
            "knowledge-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|duration| duration.as_millis())
                .unwrap_or(0)
        );
    }

    let mut registry = read_knowledge_import_registry(&root)?;

    if let Some(existing) = registry
        .libraries
        .iter()
        .find(|library| library.id == slug || library.label == trimmed)
    {
        registry.active_library_id = existing.id.clone();
        write_knowledge_import_registry(&root, &registry)?;
        return build_knowledge_inventory(&root, Some(existing.id.clone()));
    }

    registry.active_library_id = slug.clone();
    registry.libraries.push(KnowledgeLibraryRecord {
        id: slug.clone(),
        label: trimmed.to_string(),
        description: trimmed_description,
        imported_files: Vec::new(),
    });
    write_knowledge_import_registry(&root, &registry)?;

    build_knowledge_inventory(&root, Some(slug))
}

#[tauri::command]
pub fn knowledge_library_select(library_id: String) -> Result<KnowledgeInventoryResult, String> {
    let root = resolve_workspace_root()?;
    let mut registry = read_knowledge_import_registry(&root)?;
    let target_library_id = resolve_knowledge_library_id(&registry, Some(library_id));
    registry.active_library_id = target_library_id.clone();
    write_knowledge_import_registry(&root, &registry)?;

    build_knowledge_inventory(&root, Some(target_library_id))
}

#[tauri::command]
pub fn local_mcp_plugin_scan() -> Result<LocalMcpPluginScanResult, String> {
    let root = resolve_workspace_root()?;
    let plugin_files = collect_installed_local_mcp_plugin_files()?;
    let scanned_root_count = usize::from(opencow_installed_mcp_root()?.exists());
    let mut items = Vec::new();

    for path in plugin_files {
        let raw = fs::read_to_string(&path)
            .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let parsed: Value = serde_json::from_str(&raw)
            .map_err(|error| format!("failed to parse {}: {error}", path.display()))?;
        let id = parsed
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("plugin")
            .to_string();
        let name = match id.as_str() {
            "browser" => "浏览器控制".to_string(),
            _ => id.clone(),
        };
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
        let description = parsed
            .get("description")
            .and_then(Value::as_str)
            .map(|value| value.to_string())
            .unwrap_or_else(|| format!("{name} MCP 已安装。"));

        items.push(LocalMcpPluginScanItem {
            id,
            name,
            path: to_display_relative_path(&root, &path),
            source: classify_mcp_plugin_source(&root, &path),
            description,
            activation,
            tool_count,
            skill_count,
            status: "stopped".to_string(),
            supported: parsed
                .get("id")
                .and_then(Value::as_str)
                .map(|value| value == "browser")
                .unwrap_or(false),
        });
    }

    items.sort_by(|left, right| left.id.cmp(&right.id).then(left.path.cmp(&right.path)));
    let total_count = items.len();
    let summary = if total_count > 0 {
        format!("OpenCow 已安装 {total_count} 个 MCP。")
    } else {
        "OpenCow 还没有安装任何 MCP。".to_string()
    };

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
    let plugin_files = collect_installed_local_mcp_plugin_files()?;
    let scanned_root_count = usize::from(opencow_installed_mcp_root()?.exists());
    let tokens = tokenize_query(&query);
    let mut items = Vec::new();

    for path in plugin_files {
        let raw = fs::read_to_string(&path)
            .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let parsed: Value = serde_json::from_str(&raw)
            .map_err(|error| format!("failed to parse {}: {error}", path.display()))?;
        let relative_path = to_display_relative_path(&root, &path);
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
        let score = score_mcp_plugin_match(
            &query,
            &tokens,
            &id,
            &description,
            &tool_names,
            &skill_paths,
            &path,
        );

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
    let items = items
        .into_iter()
        .map(|(_, item)| item)
        .take(3)
        .collect::<Vec<_>>();
    let match_count = items.len();
    let summary = if match_count > 0 {
        format!("找到 {match_count} 个已安装 MCP 详情。")
    } else {
        "没有找到匹配的已安装 MCP。".to_string()
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
pub fn local_mcp_plugin_start_preview(
    query: String,
) -> Result<LocalMcpPluginStartPreviewResult, String> {
    let root = resolve_workspace_root()?;
    let plugin_files = collect_installed_local_mcp_plugin_files()?;
    let scanned_root_count = usize::from(opencow_installed_mcp_root()?.exists());
    let tokens = tokenize_query(&query);
    let mut items = Vec::new();

    for path in plugin_files {
        let raw = fs::read_to_string(&path)
            .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let parsed: Value = serde_json::from_str(&raw)
            .map_err(|error| format!("failed to parse {}: {error}", path.display()))?;
        let relative_path = to_display_relative_path(&root, &path);
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
        let score = score_mcp_plugin_match(
            &query,
            &tokens,
            &id,
            &description,
            &tool_names,
            &skill_paths,
            &path,
        );

        if score == 0 {
            continue;
        }

        let working_directory = if id == "browser" {
            "vendor/openclaw".to_string()
        } else {
            path.parent()
                .map(|value| to_display_relative_path(&root, value))
                .unwrap_or_else(|| ".".to_string())
        };
        let (requires_config, config_hint) = analyze_mcp_plugin_config_schema(&parsed);
        let startup_allowed = id == "browser";
        let command_preview = if id == "browser" {
            "node vendor/openclaw/openclaw.mjs browser start".to_string()
        } else {
            "当前版本尚未为这个 MCP 提供受支持的宿主命令".to_string()
        };
        let risk_summary = if id == "browser" {
            "会尝试通过 OpenClaw browser CLI 启动浏览器控制服务；如果本地依赖缺失会返回明确诊断。"
                .to_string()
        } else {
            "这个 MCP 已进入产品目录，但当前桌面端还没有为它开放受控启动宿主。".to_string()
        };

        items.push((
            score,
            LocalMcpPluginStartPreviewItem {
                id: id.clone(),
                path: relative_path,
                source: classify_mcp_plugin_source(&root, &path),
                activation: activation.clone(),
                startup_allowed,
                command_preview,
                working_directory,
                risk_summary,
                requires_config,
                config_hint,
            },
        ));
    }

    items.sort_by(|left, right| right.0.cmp(&left.0).then(left.1.path.cmp(&right.1.path)));
    let items = items
        .into_iter()
        .map(|(_, item)| item)
        .take(3)
        .collect::<Vec<_>>();
    let match_count = items.len();
    let summary = if match_count > 0 {
        format!("找到 {match_count} 个 MCP 启动预览。")
    } else {
        "没有找到可预览的 MCP。".to_string()
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
        return Err("当前只支持启动 browser MCP。".to_string());
    }

    let plugin_manifest = opencow_installed_mcp_root()?
        .join("browser")
        .join("openclaw.plugin.json");

    if !plugin_manifest.exists() {
        return Err("browser MCP 尚未安装到 OpenCow 产品目录。".to_string());
    }

    let vendor_root = root.join("vendor").join("openclaw");
    let launcher = vendor_root.join("openclaw.mjs");

    if !launcher.exists() {
        return Err(format!(
            "未找到 browser MCP 启动入口：{}",
            launcher.display()
        ));
    }

    let output = Command::new("node")
        .current_dir(&vendor_root)
        .arg("openclaw.mjs")
        .arg("browser")
        .arg("start")
        .output()
        .map_err(|error| format!("启动 browser MCP 失败: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let combined = if !stdout.is_empty() && !stderr.is_empty() {
        format!("{stdout}\n{stderr}")
    } else if !stdout.is_empty() {
        stdout
    } else if !stderr.is_empty() {
        stderr
    } else {
        "browser MCP 已执行启动命令，但没有输出。".to_string()
    };
    let line_count = combined.lines().count().max(1);
    let summary = if output.status.success() {
        "browser MCP 启动命令已执行。".to_string()
    } else {
        "browser MCP 启动失败，请检查输出诊断。".to_string()
    };

    Ok(LocalMcpPluginStartResult {
        plugin_id: "browser".to_string(),
        command_label: "openclaw browser start".to_string(),
        working_directory: "vendor/openclaw".to_string(),
        stdout_preview: combined,
        line_count,
        summary,
    })
}

#[tauri::command]
pub fn recommended_mcp_manifest() -> Result<RecommendedMcpManifestResult, String> {
    let items = read_recommended_mcp_manifest_items()?;
    let total_count = items.len();
    let summary = if total_count > 0 {
        format!("OpenCow 推荐 MCP 清单已加载，共 {total_count} 项。")
    } else {
        "OpenCow 推荐 MCP 清单当前为空。".to_string()
    };

    Ok(RecommendedMcpManifestResult {
        summary,
        total_count,
        items,
    })
}

#[tauri::command]
pub fn local_mcp_plugin_install(
    app: AppHandle,
    query: String,
    rollback_context: Option<RollbackContextPayload>,
) -> Result<LocalMcpPluginInstallResult, String> {
    let root = resolve_workspace_root()?;
    let items = read_recommended_mcp_manifest_items()?;
    let tokens = tokenize_query(&query);
    let matched = items
        .into_iter()
        .filter(|item| item.supported)
        .filter_map(|item| {
            let score = score_mcp_plugin_match(
                &query,
                &tokens,
                &item.id,
                &item.description,
                &[],
                &[],
                Path::new(&item.install_query),
            );
            if score == 0 {
                None
            } else {
                Some((score, item))
            }
        })
        .max_by(|left, right| left.0.cmp(&right.0))
        .map(|(_, item)| item)
        .ok_or_else(|| format!("没有匹配到可安装的 MCP：{query}"))?;

    let source_path = root
        .join("vendor")
        .join("openclaw")
        .join("extensions")
        .join(&matched.id)
        .join("openclaw.plugin.json");
    if !source_path.exists() {
        return Err(format!("未找到推荐 MCP 源文件：{}", source_path.display()));
    }

    let target_dir = opencow_installed_mcp_root()?.join(&matched.id);
    let target_file = target_dir.join("openclaw.plugin.json");
    capture_paths_for_context(&app, &rollback_context, &[target_dir.clone()])?;
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
        format!("{} 已存在于 OpenCow MCP 目录。", matched.name)
    } else {
        format!("{} 已安装到 OpenCow MCP 目录。", matched.name)
    };

    Ok(LocalMcpPluginInstallResult {
        query,
        installed_plugin_id: matched.id,
        installed_plugin_name: matched.name,
        installed_plugin_path: to_opencow_product_relative_path(&target_file),
        source_plugin_path: to_workspace_relative_path(&root, &source_path),
        status,
        summary,
    })
}

#[tauri::command]
pub fn local_mcp_plugin_uninstall(
    app: AppHandle,
    query: String,
    rollback_context: Option<RollbackContextPayload>,
) -> Result<LocalMcpPluginUninstallResult, String> {
    let root = resolve_workspace_root()?;
    let plugin_files = collect_installed_local_mcp_plugin_files()?;
    let tokens = tokenize_query(&query);
    let mut best_match: Option<(usize, PathBuf, String)> = None;

    for path in plugin_files {
        let raw = fs::read_to_string(&path)
            .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let parsed: Value = serde_json::from_str(&raw)
            .map_err(|error| format!("failed to parse {}: {error}", path.display()))?;
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
        let score = score_mcp_plugin_match(&query, &tokens, &id, &description, &[], &[], &path);
        if score == 0 {
            continue;
        }
        match &best_match {
            Some((best_score, _, _)) if *best_score >= score => {}
            _ => best_match = Some((score, path.clone(), id)),
        }
    }

    let Some((_, matched_path, matched_id)) = best_match else {
        return Err(format!("没有匹配到已安装 MCP：{query}"));
    };

    let removed_path = to_display_relative_path(&root, &matched_path);
    let removed_name = if matched_id == "browser" {
        "浏览器控制".to_string()
    } else {
        matched_id.clone()
    };
    let status = if matched_path.exists() {
        let parent = matched_path
            .parent()
            .ok_or_else(|| format!("failed to resolve parent for {}", matched_path.display()))?;
        capture_paths_for_context(&app, &rollback_context, &[parent.to_path_buf()])?;
        fs::remove_dir_all(parent)
            .map_err(|error| format!("failed to remove {}: {error}", parent.display()))?;
        "removed".to_string()
    } else {
        "not-installed".to_string()
    };
    let summary = if status == "removed" {
        format!("{removed_name} 已从 OpenCow MCP 目录删除。")
    } else {
        format!("{removed_name} 当前并未安装。")
    };

    Ok(LocalMcpPluginUninstallResult {
        query,
        removed_plugin_id: matched_id,
        removed_plugin_name: removed_name,
        removed_plugin_path: removed_path,
        status,
        summary,
    })
}

#[tauri::command]
pub fn local_skill_scan() -> Result<LocalSkillScanResult, String> {
    let root = resolve_workspace_root()?;
    let skill_files = collect_opencow_installed_skill_files()?;
    let scanned_root_count = count_existing_skill_roots(&root);
    let enabled_skills = read_enabled_skill_registry(&opencow_enabled_skills_registry_path()?)?;
    let mut items = Vec::new();

    for path in skill_files {
        let raw = fs::read_to_string(&path)
            .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let name =
            parse_skill_frontmatter_name(&raw).unwrap_or_else(|| infer_skill_name_from_path(&path));
        let description = parse_skill_frontmatter_description(&raw).unwrap_or_else(|| {
            format!(
                "Local skill discovered at {}.",
                to_display_relative_path(&root, &path)
            )
        });

        items.push(LocalSkillScanItem {
            enabled: is_skill_enabled(
                &enabled_skills,
                &name,
                &to_display_relative_path(&root, &path),
            ),
            name,
            path: to_display_relative_path(&root, &path),
            source: classify_skill_source(&root, &path),
            description,
        });
    }

    items.sort_by(|left, right| left.name.cmp(&right.name).then(left.path.cmp(&right.path)));
    let total_count = items.len();
    let summary = format!(
        "Local skills scan found {total_count} skills across {scanned_root_count} scanned roots."
    );

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
    let skill_files = collect_opencow_installed_skill_files()?;
    let scanned_root_count = count_existing_skill_roots(&root);
    let enabled_skills = read_enabled_skill_registry(&opencow_enabled_skills_registry_path()?)?;
    let tokens = tokenize_query(&query);
    let mut items = Vec::new();

    for path in skill_files {
        let raw = fs::read_to_string(&path)
            .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let name =
            parse_skill_frontmatter_name(&raw).unwrap_or_else(|| infer_skill_name_from_path(&path));
        let description = parse_skill_frontmatter_description(&raw).unwrap_or_else(|| {
            format!(
                "Local skill discovered at {}.",
                to_display_relative_path(&root, &path)
            )
        });
        let content_preview = extract_skill_content_preview(&raw);
        let score = score_skill_match(
            &query,
            &tokens,
            &name,
            &description,
            &content_preview,
            &path,
        );

        if score == 0 {
            continue;
        }

        let relative_path = to_display_relative_path(&root, &path);

        items.push((
            score,
            LocalSkillInspectItem {
                enabled: is_skill_enabled(&enabled_skills, &name, &relative_path),
                name,
                path: relative_path,
                source: classify_skill_source(&root, &path),
                description,
                content_preview,
            },
        ));
    }

    items.sort_by(|left, right| right.0.cmp(&left.0).then(left.1.path.cmp(&right.1.path)));
    let items = items
        .into_iter()
        .map(|(_, item)| item)
        .take(3)
        .collect::<Vec<_>>();
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
pub fn local_skill_enable(
    app: AppHandle,
    query: String,
    rollback_context: Option<RollbackContextPayload>,
) -> Result<LocalSkillEnableResult, String> {
    let root = resolve_workspace_root()?;
    let skill_files = collect_opencow_installed_skill_files()?;
    let tokens = tokenize_query(&query);
    let mut best_match: Option<(usize, LocalSkillScanItem)> = None;

    for path in skill_files {
        let raw = fs::read_to_string(&path)
            .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let name =
            parse_skill_frontmatter_name(&raw).unwrap_or_else(|| infer_skill_name_from_path(&path));
        let description = parse_skill_frontmatter_description(&raw).unwrap_or_else(|| {
            format!(
                "Local skill discovered at {}.",
                to_display_relative_path(&root, &path)
            )
        });
        let content_preview = extract_skill_content_preview(&raw);
        let score = score_skill_match(
            &query,
            &tokens,
            &name,
            &description,
            &content_preview,
            &path,
        );

        if score == 0 {
            continue;
        }

        let candidate = LocalSkillScanItem {
            enabled: false,
            name,
            path: to_display_relative_path(&root, &path),
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

    let registry_relative_path = "skills/enabled-skills.json";
    let registry_path = opencow_enabled_skills_registry_path()?;
    let registry_dir = registry_path
        .parent()
        .ok_or_else(|| "failed to resolve skill registry directory".to_string())?;
    capture_paths_for_context(&app, &rollback_context, &[registry_path.clone()])?;
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

    let status = if already_enabled {
        "already-enabled"
    } else {
        "enabled"
    };
    let summary = if already_enabled {
        format!(
            "Local skill enablement confirmed {} is already present in the OpenCow skill registry.",
            matched_skill.name
        )
    } else {
        format!(
            "Local skill enablement registered {} in the OpenCow skill registry.",
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
pub fn local_skill_install(
    app: AppHandle,
    query: String,
    rollback_context: Option<RollbackContextPayload>,
) -> Result<LocalSkillInstallResult, String> {
    local_skill_install_with_app(&app, query, rollback_context)
}

fn local_skill_install_with_app<R: Runtime>(
    app: &AppHandle<R>,
    query: String,
    rollback_context: Option<RollbackContextPayload>,
) -> Result<LocalSkillInstallResult, String> {
    let root = resolve_workspace_root()?;
    let skill_files = collect_installable_local_skill_files(&root)?;
    let tokens = tokenize_query(&query);
    let mut best_match: Option<(usize, PathBuf, String, String)> = None;

    for path in skill_files {
        let relative_path = to_display_relative_path(&root, &path);

        if relative_path.starts_with("skills/installed/") {
            continue;
        }

        let raw = fs::read_to_string(&path)
            .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let name =
            parse_skill_frontmatter_name(&raw).unwrap_or_else(|| infer_skill_name_from_path(&path));
        let description = parse_skill_frontmatter_description(&raw).unwrap_or_else(|| {
            format!(
                "Local skill discovered at {}.",
                to_display_relative_path(&root, &path)
            )
        });
        let content_preview = extract_skill_content_preview(&raw);
        let score = score_skill_match(
            &query,
            &tokens,
            &name,
            &description,
            &content_preview,
            &path,
        );

        if score == 0 {
            continue;
        }

        match &best_match {
            Some((best_score, best_path, _, _))
                if *best_score > score
                    || (*best_score == score
                        && to_display_relative_path(&root, best_path) <= relative_path) => {}
            _ => {
                best_match = Some((score, path.clone(), name, relative_path));
            }
        }
    }

    let Some((_, source_path, installed_skill_name, source_skill_path)) = best_match else {
        return Err(format!("no local skill matched install request: {query}"));
    };

    let skill_directory_name = sanitize_skill_directory_name(&installed_skill_name);
    let target_dir = opencow_installed_skills_root()?.join(&skill_directory_name);
    let target_file = target_dir.join("SKILL.md");
    let installed_skill_path = to_opencow_product_relative_path(&target_file);

    capture_paths_for_context(&app, &rollback_context, &[target_dir.clone()])?;
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
            "Local skill installation confirmed {} is already present in the OpenCow skills directory.",
            installed_skill_name
        )
    } else {
        format!(
            "Local skill installation copied {} into the OpenCow skills directory.",
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
pub fn recommended_skill_manifest() -> Result<RecommendedSkillManifestResult, String> {
    let items = read_recommended_skill_manifest_items()?;
    let total_count = items.len();
    let summary = if total_count > 0 {
        format!("OpenCow 推荐技能清单已加载，共 {total_count} 项。")
    } else {
        "OpenCow 推荐技能清单当前为空。".to_string()
    };

    Ok(RecommendedSkillManifestResult {
        summary,
        total_count,
        items,
    })
}

#[tauri::command]
pub fn local_skill_disable(
    app: AppHandle,
    query: String,
    rollback_context: Option<RollbackContextPayload>,
) -> Result<LocalSkillDisableResult, String> {
    local_skill_disable_with_app(&app, query, rollback_context)
}

fn local_skill_disable_with_app<R: Runtime>(
    app: &AppHandle<R>,
    query: String,
    rollback_context: Option<RollbackContextPayload>,
) -> Result<LocalSkillDisableResult, String> {
    let root = resolve_workspace_root()?;
    let registry_relative_path = "skills/enabled-skills.json";
    let registry_path = opencow_enabled_skills_registry_path()?;
    let enabled_skills = read_enabled_skill_registry(&registry_path)?;
    let enabled_items = build_enabled_local_skill_items(enabled_skills.clone());
    let tokens = tokenize_query(&query);
    let mut best_match: Option<(usize, EnabledLocalSkillItem)> = None;

    for item in enabled_items {
        let absolute_path = resolve_registered_local_path(&root, &item.path)?;
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
                if *best_score > score || (*best_score == score && best_item.path <= item.path) => {
            }
            _ => {
                best_match = Some((score, item));
            }
        }
    }

    let Some((_, matched_skill)) = best_match else {
        return Err(format!(
            "no enabled local skill matched disable request: {query}"
        ));
    };

    let remaining_entries = enabled_skills
        .into_iter()
        .filter(|entry| {
            let name_matches =
                entry.get("name").and_then(Value::as_str) == Some(&matched_skill.name);
            let path_matches =
                entry.get("path").and_then(Value::as_str) == Some(&matched_skill.path);

            !(name_matches && path_matches)
        })
        .collect::<Vec<_>>();
    let registry_dir = registry_path
        .parent()
        .ok_or_else(|| "failed to resolve skill registry directory".to_string())?;
    capture_paths_for_context(&app, &rollback_context, &[registry_path.clone()])?;
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
            "Local skill disablement removed {} from the OpenCow skill registry.",
            matched_skill.name
        ),
    })
}

#[tauri::command]
pub fn opencow_self_repair_enabled_skills_registry(
    app: AppHandle,
    query: String,
    rollback_context: Option<RollbackContextPayload>,
) -> Result<OpencowSelfRepairEnabledSkillsRegistryResult, String> {
    opencow_self_repair_enabled_skills_registry_with_app(&app, query, rollback_context)
}

fn opencow_self_repair_enabled_skills_registry_with_app<R: Runtime>(
    app: &AppHandle<R>,
    query: String,
    rollback_context: Option<RollbackContextPayload>,
) -> Result<OpencowSelfRepairEnabledSkillsRegistryResult, String> {
    let registry_relative_path = "skills/enabled-skills.json";
    let registry_path = opencow_enabled_skills_registry_path()?;
    let registry_dir = registry_path
        .parent()
        .ok_or_else(|| "failed to resolve enabled skills registry directory".to_string())?;
    capture_paths_for_context(&app, &rollback_context, &[registry_path.clone()])?;
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

    let verified_raw = fs::read_to_string(&registry_path)
        .map_err(|error| format!("failed to re-read {}: {error}", registry_path.display()))?;
    let verified_parsed: Value = serde_json::from_str(&verified_raw).map_err(|error| {
        format!(
            "failed to verify repaired registry {}: {error}",
            registry_path.display()
        )
    })?;
    let verified_version = verified_parsed
        .get("version")
        .and_then(Value::as_u64)
        .ok_or_else(|| {
            format!(
                "repaired registry {} is missing numeric version",
                registry_path.display()
            )
        })? as usize;
    let verified_entry_count = verified_parsed
        .get("enabled_skills")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            format!(
                "repaired registry {} is missing enabled_skills array",
                registry_path.display()
            )
        })?
        .len();

    Ok(OpencowSelfRepairEnabledSkillsRegistryResult {
        query,
        repair_target: "enabled-skills-registry".to_string(),
        repaired_path: registry_relative_path.to_string(),
        status: "repaired".to_string(),
        preserved_entry_count,
        verified_version,
        verified_entry_count,
        summary:
            "Opencow self-repair restored the enabled skills registry to a verified default schema."
                .to_string(),
    })
}

#[tauri::command]
pub fn opencow_self_repair_workspace_project_runtime_registry(
    app: AppHandle,
    query: String,
    rollback_context: Option<RollbackContextPayload>,
) -> Result<OpencowSelfRepairWorkspaceProjectRuntimeRegistryResult, String> {
    opencow_self_repair_workspace_project_runtime_registry_with_app(&app, query, rollback_context)
}

fn opencow_self_repair_workspace_project_runtime_registry_with_app<R: Runtime>(
    app: &AppHandle<R>,
    query: String,
    rollback_context: Option<RollbackContextPayload>,
) -> Result<OpencowSelfRepairWorkspaceProjectRuntimeRegistryResult, String> {
    let root = resolve_workspace_root()?;
    let registry_relative_path = ".opencow/runtime/workspace-project-runs.json";
    let registry_path = workspace_project_runtime_registry_path(&root);
    capture_paths_for_context(&app, &rollback_context, &[registry_path.clone()])?;
    let preserved_runs = read_workspace_project_runtime_records(&root).unwrap_or_default();
    let preserved_entry_count = preserved_runs.len();

    write_workspace_project_runtime_registry(
        &root,
        &WorkspaceProjectRuntimeRegistry {
            version: 1,
            runs: preserved_runs,
        },
    )?;

    let verified_raw = fs::read_to_string(&registry_path)
        .map_err(|error| format!("failed to re-read {}: {error}", registry_path.display()))?;
    let verified_parsed: Value = serde_json::from_str(&verified_raw).map_err(|error| {
        format!(
            "failed to verify repaired runtime registry {}: {error}",
            registry_path.display()
        )
    })?;
    let verified_version = verified_parsed
        .get("version")
        .and_then(Value::as_u64)
        .ok_or_else(|| {
            format!(
                "repaired runtime registry {} is missing numeric version",
                registry_path.display()
            )
        })? as usize;
    let verified_run_count = verified_parsed
        .get("runs")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            format!(
                "repaired runtime registry {} is missing runs array",
                registry_path.display()
            )
        })?
        .len();

    Ok(OpencowSelfRepairWorkspaceProjectRuntimeRegistryResult {
        query,
        repair_target: "workspace-project-runtime-registry".to_string(),
        repaired_path: registry_relative_path.to_string(),
        status: "repaired".to_string(),
        preserved_entry_count,
        verified_version,
        verified_run_count,
        summary: "Opencow self-repair restored the workspace project runtime registry to a verified default schema."
            .to_string(),
    })
}

#[tauri::command]
pub fn local_enabled_skill_list() -> Result<EnabledLocalSkillsResult, String> {
    let registry_relative_path = "skills/enabled-skills.json";
    let registry_path = opencow_enabled_skills_registry_path()?;
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
    let registry_relative_path = "skills/enabled-skills.json";
    let registry_path = opencow_enabled_skills_registry_path()?;
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

        let absolute_path = resolve_registered_local_path(&root, path)?;
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
            name,
            description,
            &content_preview,
            &absolute_path,
        );

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
    let items = items
        .into_iter()
        .map(|(_, item)| item)
        .take(3)
        .collect::<Vec<_>>();
    let match_count = items.len();
    let summary = if match_count > 0 {
        format!("Enabled local skill matching found {match_count} recommended skill across {enabled_skill_count} enabled entr{}.", if enabled_skill_count == 1 { "y" } else { "ies" })
    } else if enabled_skill_count > 0 {
        format!("Enabled local skill matching found no recommended skills across {enabled_skill_count} enabled entr{}.", if enabled_skill_count == 1 { "y" } else { "ies" })
    } else {
        "Enabled local skills registry is currently empty, so no recommendation is available."
            .to_string()
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
pub fn workspace_readonly_command(
    command_id: String,
) -> Result<ReadonlyShellCommandResult, String> {
    let root = resolve_workspace_root()?;
    let spec = build_readonly_shell_command(&command_id, &root)?;
    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-Command")
        .args(&spec.args)
        .current_dir(&root)
        .output()
        .map_err(|error| {
            format!("failed to execute readonly shell command {command_id}: {error}")
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!(
            "readonly shell command {command_id} failed with status {}: {}",
            output.status, stderr
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).replace("\r\n", "\n");
    let stdout_preview = truncate_preview(stdout.trim(), 20);
    let line_count = stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .count();
    let summary =
        format!("Readonly shell command completed successfully with {line_count} output lines.");

    Ok(ReadonlyShellCommandResult {
        command_id: spec.command_id.to_string(),
        command_label: spec.command_label.to_string(),
        stdout_preview,
        line_count,
        summary,
    })
}

#[tauri::command]
pub fn workspace_write_command(
    command_id: String,
    rollback_context: Option<RollbackContextPayload>,
    app: AppHandle,
) -> Result<WorkspaceWriteShellCommandResult, String> {
    workspace_write_command_with_app(command_id, rollback_context, &app)
}

fn workspace_write_command_with_app<R: Runtime>(
    command_id: String,
    rollback_context: Option<RollbackContextPayload>,
    app: &AppHandle<R>,
) -> Result<WorkspaceWriteShellCommandResult, String> {
    let root = resolve_workspace_root()?;
    let spec = build_workspace_write_shell_command(&command_id, &root)?;
    let snapshot_paths = match command_id.as_str() {
        "create-temp-output-dir" => vec![root.join("temp-output")],
        _ => Vec::new(),
    };
    capture_paths_for_context(&app, &rollback_context, &snapshot_paths)?;
    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-Command")
        .args(&spec.args)
        .current_dir(&root)
        .output()
        .map_err(|error| {
            format!("failed to execute workspace-write shell command {command_id}: {error}")
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!(
            "workspace-write shell command {command_id} failed with status {}: {}",
            output.status, stderr
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).replace("\r\n", "\n");
    let stdout_preview = truncate_preview(stdout.trim(), 20);
    let line_count = stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .count();
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
pub fn controlled_full_command(
    command_id: String,
    rollback_context: Option<RollbackContextPayload>,
    app: AppHandle,
) -> Result<ControlledFullShellCommandResult, String> {
    controlled_full_command_with_app(command_id, rollback_context, &app)
}

fn controlled_full_command_with_app<R: Runtime>(
    command_id: String,
    rollback_context: Option<RollbackContextPayload>,
    app: &AppHandle<R>,
) -> Result<ControlledFullShellCommandResult, String> {
    let root = resolve_workspace_root()?;
    let spec = build_controlled_full_shell_command(&command_id, &root)?;
    let snapshot_paths = match command_id.as_str() {
        "remove-temp-output-dir" => vec![root.join("temp-output")],
        _ => Vec::new(),
    };
    capture_paths_for_context(&app, &rollback_context, &snapshot_paths)?;
    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-Command")
        .args(&spec.args)
        .current_dir(&root)
        .output()
        .map_err(|error| {
            format!("failed to execute controlled-full shell command {command_id}: {error}")
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!(
            "controlled-full shell command {command_id} failed with status {}: {}",
            output.status, stderr
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).replace("\r\n", "\n");
    let stdout_preview = truncate_preview(stdout.trim(), 20);
    let line_count = stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .count();
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
    if let Ok(explicit_root) = std::env::var("OPENCOW_WORKSPACE_ROOT") {
        let trimmed = explicit_root.trim();

        if !trimmed.is_empty() {
            let explicit_path = PathBuf::from(trimmed);

            if looks_like_workspace_root(&explicit_path) {
                return Ok(explicit_path);
            }

            return Err(format!(
                "OPENCOW_WORKSPACE_ROOT does not point to a valid workspace root: {}",
                explicit_path.display()
            ));
        }
    }

    let current_dir = std::env::current_dir()
        .map_err(|error| format!("failed to resolve current directory: {error}"))?;

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

    Ok(fs::read_dir(&packages_root)
        .map_err(|error| format!("failed to read packages directory: {error}"))?
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false))
        .filter_map(|entry| entry.file_name().into_string().ok())
        .collect::<Vec<_>>())
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

fn collect_workspace_project_run_candidates(
    root: &Path,
) -> Result<Vec<WorkspaceProjectRunCandidateInternal>, String> {
    let mut candidates = Vec::new();
    collect_project_candidates_from_directory(root, &root.join("apps"), "apps", &mut candidates)?;
    collect_project_candidates_from_directory(
        root,
        &root.join("packages"),
        "packages",
        &mut candidates,
    )?;

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

fn build_project_run_command_label(
    candidate: &WorkspaceProjectRunCandidateInternal,
) -> Option<String> {
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

fn infer_project_expected_url(
    candidate: Option<&WorkspaceProjectRunCandidateInternal>,
) -> Option<String> {
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

fn build_npc_showcase_screenshot_artifact_path(
    root: &Path,
    project_name: &str,
    timestamp: &str,
) -> PathBuf {
    root.join(".opencow")
        .join("artifacts")
        .join("npc-showcase")
        .join(format!(
            "{}-screenshot-{}.png",
            sanitize_artifact_segment(project_name),
            timestamp
        ))
}

fn build_npc_showcase_site_root(root: &Path, project_name: &str) -> PathBuf {
    root.join(".opencow")
        .join("artifacts")
        .join("npc-showcase")
        .join("sites")
        .join(sanitize_artifact_segment(project_name))
}

fn sanitize_artifact_segment(value: &str) -> String {
    let mut sanitized = String::new();

    for character in value.chars() {
        if character.is_ascii_alphanumeric() {
            sanitized.push(character.to_ascii_lowercase());
        } else if (character == '-' || character == '_') && !sanitized.ends_with('-') {
            sanitized.push('-');
        }
    }

    let sanitized = sanitized.trim_matches('-').to_string();
    if sanitized.is_empty() {
        "artifact".to_string()
    } else {
        sanitized
    }
}

fn capture_url_to_png_via_edge(url: &str, artifact_path: &Path) -> Result<(), String> {
    let artifact_parent = artifact_path.parent().ok_or_else(|| {
        format!(
            "failed to resolve screenshot artifact parent for {}",
            artifact_path.display()
        )
    })?;
    fs::create_dir_all(artifact_parent)
        .map_err(|error| format!("failed to create {}: {error}", artifact_parent.display()))?;

    let status = Command::new("msedge")
        .arg("--headless")
        .arg("--disable-gpu")
        .arg("--hide-scrollbars")
        .arg("--window-size=1440,1024")
        .arg(format!("--screenshot={}", artifact_path.display()))
        .arg(url)
        .status()
        .map_err(|error| format!("failed to launch Edge headless screenshot capture: {error}"))?;

    if !status.success() {
        return Err(format!(
            "Edge headless screenshot capture failed with status {}",
            status
        ));
    }

    Ok(())
}

fn find_latest_npc_showcase_screenshot_artifact(
    root: &Path,
    project_name: &str,
) -> Result<Option<PathBuf>, String> {
    let artifact_root = root.join(".opencow").join("artifacts").join("npc-showcase");
    if !artifact_root.exists() {
        return Ok(None);
    }

    let prefix = format!("{}-screenshot-", sanitize_artifact_segment(project_name));
    let mut matches = Vec::new();

    for entry in fs::read_dir(&artifact_root)
        .map_err(|error| format!("failed to read {}: {error}", artifact_root.display()))?
    {
        let entry = entry.map_err(|error| {
            format!("failed to read {} entry: {error}", artifact_root.display())
        })?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };

        if file_name.starts_with(&prefix) && file_name.ends_with(".png") {
            matches.push(path);
        }
    }

    matches.sort();
    Ok(matches.pop())
}

fn write_npc_showcase_site_html(
    entry_file: &Path,
    project_name: &str,
    project_path: &str,
    expected_url: Option<&str>,
    screenshot_artifact: &Path,
) -> Result<(), String> {
    let parent = entry_file.parent().ok_or_else(|| {
        format!(
            "failed to resolve showcase-site parent for {}",
            entry_file.display()
        )
    })?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;

    let screenshot_file_name = screenshot_artifact
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("screenshot.png");
    let expected_url_line = expected_url.unwrap_or("not inferred");
    let html = format!(
        concat!(
            "<!doctype html>\n",
            "<html lang=\"en\">\n",
            "<head><meta charset=\"utf-8\"><title>{}</title></head>\n",
            "<body>\n",
            "<h1>{}</h1>\n",
            "<p>Project path: {}</p>\n",
            "<p>Expected URL: {}</p>\n",
            "<p>Screenshot artifact: {}</p>\n",
            "<p>Generated by the NPC showcase workflow for local review.</p>\n",
            "</body>\n",
            "</html>\n"
        ),
        project_name, project_name, project_path, expected_url_line, screenshot_file_name
    );

    fs::write(entry_file, html)
        .map_err(|error| format!("failed to write {}: {error}", entry_file.display()))?;
    Ok(())
}

fn workspace_project_runtime_registry_path(root: &Path) -> PathBuf {
    root.join(".opencow")
        .join("runtime")
        .join("workspace-project-runs.json")
}

fn opencow_app_data_root() -> Result<PathBuf, String> {
    if let Ok(explicit_root) = std::env::var("OPENCOW_APP_DATA_ROOT") {
        let candidate = PathBuf::from(explicit_root);
        if candidate.as_os_str().is_empty() {
            return Err("OPENCOW_APP_DATA_ROOT is empty".to_string());
        }

        return Ok(candidate);
    }

    if let Ok(appdata) = std::env::var("APPDATA") {
        let candidate = PathBuf::from(appdata).join("OpenCow");
        return Ok(candidate);
    }

    if let Ok(home) = std::env::var("HOME") {
        return Ok(PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("OpenCow"));
    }

    Err("failed to resolve OpenCow app data root".to_string())
}

fn opencow_installed_skills_root() -> Result<PathBuf, String> {
    Ok(opencow_app_data_root()?.join("skills").join("installed"))
}

fn opencow_enabled_skills_registry_path() -> Result<PathBuf, String> {
    Ok(opencow_app_data_root()?
        .join("skills")
        .join("enabled-skills.json"))
}

fn opencow_recommended_skills_manifest_path() -> Result<PathBuf, String> {
    Ok(opencow_app_data_root()?
        .join("skills")
        .join("manifest")
        .join("recommended-skills.json"))
}

fn opencow_knowledge_root() -> Result<PathBuf, String> {
    Ok(opencow_app_data_root()?.join("knowledge"))
}

fn opencow_mcp_root() -> Result<PathBuf, String> {
    Ok(opencow_app_data_root()?.join("mcp"))
}

fn opencow_installed_mcp_root() -> Result<PathBuf, String> {
    Ok(opencow_mcp_root()?.join("installed"))
}

fn opencow_recommended_mcp_manifest_path() -> Result<PathBuf, String> {
    Ok(opencow_mcp_root()?
        .join("manifest")
        .join("recommended-mcp.json"))
}

fn opencow_knowledge_files_root() -> Result<PathBuf, String> {
    Ok(opencow_knowledge_root()?.join("files"))
}

fn opencow_knowledge_registry_path() -> Result<PathBuf, String> {
    Ok(opencow_knowledge_root()?.join("imported-files.json"))
}

fn to_opencow_product_relative_path(path: &Path) -> String {
    let root = match opencow_app_data_root() {
        Ok(root) => root,
        Err(_) => return path.to_string_lossy().replace('\\', "/"),
    };

    path.strip_prefix(&root)
        .ok()
        .and_then(|relative| relative.to_str())
        .unwrap_or_else(|| path.to_str().unwrap_or("document"))
        .replace('\\', "/")
}

fn to_display_relative_path(root: &Path, path: &Path) -> String {
    if let Ok(app_root) = opencow_app_data_root() {
        if path.starts_with(&app_root) {
            return to_opencow_product_relative_path(path);
        }
    }

    to_workspace_relative_path(root, path)
}

fn resolve_registered_local_path(root: &Path, path: &str) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(path);

    if candidate.is_absolute() {
        return Ok(candidate);
    }

    let app_root = opencow_app_data_root()?;
    let app_candidate = app_root.join(path);
    if app_candidate.exists() || path.starts_with("skills/") || path.starts_with("knowledge/") {
        return Ok(app_candidate);
    }

    Ok(root.join(path))
}

fn default_workspace_project_runtime_registry() -> WorkspaceProjectRuntimeRegistry {
    WorkspaceProjectRuntimeRegistry {
        version: 1,
        runs: Vec::new(),
    }
}

fn read_workspace_project_runtime_records(
    root: &Path,
) -> Result<Vec<WorkspaceProjectRuntimeRecord>, String> {
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

    if let Ok(legacy_value_runs) = serde_json::from_str::<Vec<Value>>(&raw) {
        let migrated_runs = legacy_value_runs
            .into_iter()
            .filter_map(|entry| {
                Some(WorkspaceProjectRuntimeRecord {
                    project_name: entry.get("project_name")?.as_str()?.to_string(),
                    project_path: entry.get("project_path")?.as_str()?.to_string(),
                    command_label: entry.get("command_label")?.as_str()?.to_string(),
                    working_directory: entry.get("working_directory")?.as_str()?.to_string(),
                    pid: entry.get("pid")?.as_u64()? as u32,
                    launched_at: "legacy-migrated".to_string(),
                    last_status: "legacy-migrated".to_string(),
                    last_checked_at: "legacy-migrated".to_string(),
                })
            })
            .collect::<Vec<_>>();
        write_workspace_project_runtime_registry(
            root,
            &WorkspaceProjectRuntimeRegistry {
                version: 1,
                runs: migrated_runs.clone(),
            },
        )?;
        return Ok(migrated_runs);
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
    let parent = registry_path.parent().ok_or_else(|| {
        format!(
            "failed to resolve runtime registry parent for {}",
            registry_path.display()
        )
    })?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    let serialized = serde_json::to_string_pretty(registry).map_err(|error| {
        format!("failed to serialize workspace project runtime registry: {error}")
    })?;
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
    Ok(records
        .into_iter()
        .find(|entry| entry.project_path == project_path))
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

fn current_unix_timestamp_string() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn parse_workspace_project_run_pid(stdout_preview: &str) -> Option<u32> {
    let pid = stdout_preview
        .strip_prefix("pid:")
        .and_then(|value| value.trim().parse::<u32>().ok())?;

    (pid > 0).then_some(pid)
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

fn knowledge_registry_path(_root: &Path) -> PathBuf {
    opencow_knowledge_registry_path()
        .unwrap_or_else(|_| PathBuf::from("knowledge/imported-files.json"))
}

fn default_knowledge_library() -> KnowledgeLibraryRecord {
    KnowledgeLibraryRecord {
        id: "default-library".to_string(),
        label: "默认知识库".to_string(),
        description: "系统默认知识库。".to_string(),
        imported_files: Vec::new(),
    }
}

fn normalize_knowledge_registry(mut registry: KnowledgeImportRegistry) -> KnowledgeImportRegistry {
    if registry.libraries.is_empty() {
        registry.libraries.push(default_knowledge_library());
    }

    if !registry
        .libraries
        .iter()
        .any(|library| library.id == registry.active_library_id)
    {
        registry.active_library_id = registry
            .libraries
            .first()
            .map(|library| library.id.clone())
            .unwrap_or_else(|| "default-library".to_string());
    }

    registry
}

fn create_default_knowledge_registry() -> KnowledgeImportRegistry {
    let library = default_knowledge_library();

    KnowledgeImportRegistry {
        version: 2,
        active_library_id: library.id.clone(),
        libraries: vec![library],
    }
}

fn read_legacy_knowledge_import_registry(
    root: &Path,
) -> Result<Option<KnowledgeImportRegistry>, String> {
    let path = knowledge_registry_path(root);
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
    let parsed = serde_json::from_str::<serde_json::Value>(&raw)
        .map_err(|error| format!("failed to parse {}: {error}", path.display()))?;
    let imported_files = parsed
        .get("imported_files")
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    item.get("path")
                        .and_then(|value| value.as_str())
                        .map(|path| ImportedKnowledgeFileRecord {
                            path: path.to_string(),
                        })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if imported_files.is_empty()
        && !parsed.get("imported_files").is_some()
        && !parsed.get("libraries").is_some()
    {
        return Ok(None);
    }

    Ok(Some(KnowledgeImportRegistry {
        version: 2,
        active_library_id: "default-library".to_string(),
        libraries: vec![KnowledgeLibraryRecord {
            id: "default-library".to_string(),
            label: "默认知识库".to_string(),
            description: "系统默认知识库。".to_string(),
            imported_files,
        }],
    }))
}

fn resolve_knowledge_library_id(
    registry: &KnowledgeImportRegistry,
    library_id: Option<String>,
) -> String {
    if let Some(candidate) = library_id {
        if registry
            .libraries
            .iter()
            .any(|library| library.id == candidate)
        {
            return candidate;
        }
    }

    registry.active_library_id.clone()
}

fn read_knowledge_import_registry(root: &Path) -> Result<KnowledgeImportRegistry, String> {
    let path = knowledge_registry_path(root);

    if !path.exists() {
        return Ok(create_default_knowledge_registry());
    }

    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
    match serde_json::from_str::<KnowledgeImportRegistry>(&raw) {
        Ok(registry) => Ok(normalize_knowledge_registry(registry)),
        Err(_) => {
            if let Some(legacy_registry) = read_legacy_knowledge_import_registry(root)? {
                write_knowledge_import_registry(root, &legacy_registry)?;
                Ok(normalize_knowledge_registry(legacy_registry))
            } else {
                Err(format!("failed to parse {}", path.display()))
            }
        }
    }
}

fn write_knowledge_import_registry(
    root: &Path,
    registry: &KnowledgeImportRegistry,
) -> Result<(), String> {
    let path = knowledge_registry_path(root);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }

    let serialized = serde_json::to_string_pretty(registry)
        .map_err(|error| format!("failed to serialize knowledge import registry: {error}"))?;
    fs::write(&path, format!("{serialized}\n"))
        .map_err(|error| format!("failed to write {}: {error}", path.display()))
}

fn normalize_workspace_relative_knowledge_path(root: &Path, path: &str) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("knowledge path cannot be empty".to_string());
    }

    let candidate = PathBuf::from(trimmed);
    if candidate.is_absolute() {
        if !candidate.exists() {
            return Err(format!(
                "knowledge file does not exist: {}",
                candidate.display()
            ));
        }

        let storage_root = opencow_knowledge_files_root()?;
        fs::create_dir_all(&storage_root)
            .map_err(|error| format!("failed to create {}: {error}", storage_root.display()))?;
        let file_name = candidate
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| format!("invalid knowledge file path: {}", candidate.display()))?;
        let target_path = storage_root.join(file_name);

        if !target_path.exists() {
            fs::copy(&candidate, &target_path).map_err(|error| {
                format!(
                    "failed to copy {} to {}: {error}",
                    candidate.display(),
                    target_path.display()
                )
            })?;
        }

        return Ok(to_opencow_product_relative_path(&target_path));
    }

    if trimmed.starts_with("knowledge/files/") {
        let storage_path = opencow_app_data_root()?.join(trimmed);
        if !storage_path.exists() {
            return Err(format!(
                "knowledge file does not exist: {}",
                storage_path.display()
            ));
        }

        return Ok(trimmed.replace('\\', "/"));
    }

    let workspace_candidate = root.join(trimmed);
    ensure_path_stays_in_workspace(root, &workspace_candidate)?;

    Ok(to_workspace_relative_path(root, &workspace_candidate))
}

fn build_knowledge_inventory(
    root: &Path,
    requested_library_id: Option<String>,
) -> Result<KnowledgeInventoryResult, String> {
    let registry = read_knowledge_import_registry(root)?;
    let registry_path = to_opencow_product_relative_path(&knowledge_registry_path(root));
    let active_library_id = resolve_knowledge_library_id(&registry, requested_library_id);
    let active_library = registry
        .libraries
        .iter()
        .find(|library| library.id == active_library_id)
        .cloned()
        .unwrap_or_else(default_knowledge_library);
    let mut imported_files = Vec::new();

    for entry in &active_library.imported_files {
        let absolute_path = resolve_registered_local_path(root, &entry.path)?;
        let title = absolute_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("document")
            .to_string();
        let status = if absolute_path.exists() {
            "ready"
        } else {
            "missing"
        };

        imported_files.push(KnowledgeInventoryFileItem {
            path: entry.path.clone(),
            title,
            status: status.to_string(),
        });
    }

    imported_files.sort_by(|left, right| left.path.cmp(&right.path));

    let imported_paths: std::collections::BTreeSet<String> = imported_files
        .iter()
        .map(|entry| entry.path.clone())
        .collect();
    let indexed_document_count = imported_files
        .iter()
        .filter(|entry| entry.status == "ready")
        .count();
    let mut available_files = collect_all_workspace_knowledge_candidates(root)?
        .into_iter()
        .map(|path| to_display_relative_path(root, &path))
        .filter(|path| !imported_paths.contains(path))
        .map(|path| {
            let title = Path::new(&path)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("document")
                .to_string();

            KnowledgeInventoryAvailableFileItem { path, title }
        })
        .collect::<Vec<_>>();

    available_files.sort_by(|left, right| left.path.cmp(&right.path));
    let available_file_count = available_files.len();

    Ok(KnowledgeInventoryResult {
        imported_files,
        available_files,
        indexed_document_count,
        registry_path,
        summary: format!(
            "Knowledge inventory loaded with {} imported files and {} available files.",
            indexed_document_count, available_file_count
        ),
        active_library_id: active_library.id.clone(),
        active_library_label: active_library.label.clone(),
        libraries: registry
            .libraries
            .iter()
            .map(|library| KnowledgeInventoryLibraryItem {
                id: library.id.clone(),
                label: library.label.clone(),
                description: library.description.clone(),
                document_count: library.imported_files.len(),
            })
            .collect(),
    })
}

fn collect_all_workspace_knowledge_candidates(_root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut candidates = Vec::new();
    let knowledge_files_root = opencow_knowledge_files_root()?;

    if knowledge_files_root.exists() {
        collect_local_knowledge_candidates_recursive(&knowledge_files_root, &mut candidates)?;
    }

    candidates.sort();
    candidates.dedup();

    Ok(candidates)
}

fn collect_installable_local_skill_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut candidates = Vec::new();

    let workspace_skills = opencow_installed_skills_root()?;

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

fn collect_opencow_installed_skill_files() -> Result<Vec<PathBuf>, String> {
    let mut candidates = Vec::new();
    let installed_root = opencow_installed_skills_root()?;

    if installed_root.exists() {
        collect_local_skill_files_recursive(&installed_root, &mut candidates)?;
    }

    candidates.sort();
    candidates.dedup();

    Ok(candidates)
}

fn read_enabled_skill_registry(path: &Path) -> Result<Vec<Value>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(path)
        .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
    let parsed: Value = serde_json::from_str(&raw)
        .map_err(|error| format!("failed to parse {}: {error}", path.display()))?;

    Ok(parsed
        .get("enabled_skills")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default())
}

fn collect_local_skill_files_recursive(
    root: &Path,
    candidates: &mut Vec<PathBuf>,
) -> Result<(), String> {
    for entry in
        fs::read_dir(root).map_err(|error| format!("failed to read {}: {error}", root.display()))?
    {
        let entry = entry
            .map_err(|error| format!("failed to inspect {} entry: {error}", root.display()))?;
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

fn collect_local_mcp_plugin_files_recursive(
    root: &Path,
    candidates: &mut Vec<PathBuf>,
) -> Result<(), String> {
    for entry in
        fs::read_dir(root).map_err(|error| format!("failed to read {}: {error}", root.display()))?
    {
        let entry = entry
            .map_err(|error| format!("failed to inspect {} entry: {error}", root.display()))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|error| format!("failed to inspect {} type: {error}", path.display()))?;

        if file_type.is_dir() {
            collect_local_mcp_plugin_files_recursive(&path, candidates)?;
            continue;
        }

        if file_type.is_file()
            && is_local_mcp_plugin_file(&path)
            && !is_ignored_mcp_plugin_path(&path)
        {
            candidates.push(path);
        }
    }

    Ok(())
}

fn collect_extension_skill_files(root: &Path, candidates: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in
        fs::read_dir(root).map_err(|error| format!("failed to read {}: {error}", root.display()))?
    {
        let entry = entry
            .map_err(|error| format!("failed to inspect {} entry: {error}", root.display()))?;
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
    [opencow_installed_skills_root().unwrap_or_else(|_| root.join("skills"))]
        .into_iter()
        .filter(|path| path.exists())
        .count()
}

fn collect_local_knowledge_candidates_recursive(
    root: &Path,
    candidates: &mut Vec<PathBuf>,
) -> Result<(), String> {
    for entry in
        fs::read_dir(root).map_err(|error| format!("failed to read {}: {error}", root.display()))?
    {
        let entry = entry
            .map_err(|error| format!("failed to inspect {} entry: {error}", root.display()))?;
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
    let normalized = path
        .to_string_lossy()
        .replace('\\', "/")
        .to_ascii_lowercase();

    normalized.contains("/test/")
        || normalized.contains("/tests/")
        || normalized.contains("/fixtures/")
        || normalized.contains("/__tests__/")
}

fn is_ignored_mcp_plugin_path(path: &Path) -> bool {
    let normalized = path
        .to_string_lossy()
        .replace('\\', "/")
        .to_ascii_lowercase();

    normalized.contains("/test/")
        || normalized.contains("/tests/")
        || normalized.contains("/fixtures/")
        || normalized.contains("/__tests__/")
        || normalized.contains("/node_modules/")
}

fn split_knowledge_segments(content: &str) -> Vec<String> {
    content
        .split("\n\n")
        .map(|segment| {
            segment
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .collect::<Vec<_>>()
                .join(" ")
        })
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
            return content
                .get(body_start..)
                .unwrap_or(content)
                .trim_start_matches(['\r', '\n']);
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
            let normalized = value
                .trim()
                .trim_matches('"')
                .trim_matches('\'')
                .to_string();

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
    let relative = to_display_relative_path(root, path);

    if relative.starts_with("vendor/openclaw/extensions/") {
        return "vendor-openclaw-extension-skill".to_string();
    }

    if relative.starts_with("vendor/openclaw/skills/") {
        return "vendor-openclaw-skill".to_string();
    }

    if relative.starts_with("skills/installed/") {
        return "opencow-installed-skill".to_string();
    }

    "workspace-skill".to_string()
}

fn default_recommended_skill_manifest_items() -> Vec<RecommendedSkillManifestItem> {
    vec![
        RecommendedSkillManifestItem {
            name: "coding-agent".to_string(),
            description: "适合代码实现、重构和定向修复。".to_string(),
            source: "opencow-builtin-manifest".to_string(),
            install_query: "coding-agent".to_string(),
            rationale: "OpenCow 本地助手最常见的是代码落地与修复，这项覆盖率最高。".to_string(),
        },
        RecommendedSkillManifestItem {
            name: "docs-helper".to_string(),
            description: "适合整理文档、说明和产品交接内容。".to_string(),
            source: "opencow-builtin-manifest".to_string(),
            install_query: "docs-helper".to_string(),
            rationale: "本地助手经常需要整理规则、交接文档和知识说明，适合作为默认文档能力。"
                .to_string(),
        },
        RecommendedSkillManifestItem {
            name: "browser-automation".to_string(),
            description: "适合页面联调、真实按钮点击验证和前端回归检查。".to_string(),
            source: "opencow-builtin-manifest".to_string(),
            install_query: "browser-automation".to_string(),
            rationale: "桌面端和本地 Web 联调频繁，浏览器自动化是最能直接提升闭环效率的能力之一。"
                .to_string(),
        },
    ]
}

fn read_recommended_skill_manifest_items() -> Result<Vec<RecommendedSkillManifestItem>, String> {
    let manifest_path = opencow_recommended_skills_manifest_path()?;

    if !manifest_path.exists() {
        let items = default_recommended_skill_manifest_items();
        write_recommended_skill_manifest_items(&manifest_path, &items)?;
        return Ok(items);
    }

    let raw = fs::read_to_string(&manifest_path)
        .map_err(|error| format!("failed to read {}: {error}", manifest_path.display()))?;
    let parsed: Value = serde_json::from_str(&raw)
        .map_err(|error| format!("failed to parse {}: {error}", manifest_path.display()))?;
    let items = parsed
        .get("items")
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(|entry| {
                    Some(RecommendedSkillManifestItem {
                        name: entry.get("name")?.as_str()?.trim().to_string(),
                        description: entry
                            .get("description")
                            .and_then(Value::as_str)
                            .unwrap_or("这个技能还没有补充简介。")
                            .trim()
                            .to_string(),
                        source: entry
                            .get("source")
                            .and_then(Value::as_str)
                            .unwrap_or("opencow-local-manifest")
                            .trim()
                            .to_string(),
                        install_query: entry
                            .get("install_query")
                            .and_then(Value::as_str)
                            .or_else(|| entry.get("installQuery").and_then(Value::as_str))
                            .or_else(|| entry.get("name").and_then(Value::as_str))
                            .unwrap_or_default()
                            .trim()
                            .to_string(),
                        rationale: entry
                            .get("rationale")
                            .and_then(Value::as_str)
                            .unwrap_or("OpenCow 已审核的推荐能力。")
                            .trim()
                            .to_string(),
                    })
                })
                .filter(|item| !item.name.is_empty() && !item.install_query.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if items.is_empty() {
        let fallback = default_recommended_skill_manifest_items();
        write_recommended_skill_manifest_items(&manifest_path, &fallback)?;
        return Ok(fallback);
    }

    Ok(items)
}

fn write_recommended_skill_manifest_items(
    manifest_path: &Path,
    items: &[RecommendedSkillManifestItem],
) -> Result<(), String> {
    let parent = manifest_path.parent().ok_or_else(|| {
        format!(
            "failed to resolve manifest parent for {}",
            manifest_path.display()
        )
    })?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    let payload = serde_json::json!({
        "version": 1,
        "items": items.iter().map(|item| serde_json::json!({
            "name": item.name,
            "description": item.description,
            "source": item.source,
            "install_query": item.install_query,
            "rationale": item.rationale
        })).collect::<Vec<_>>()
    });
    let pretty = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("failed to serialize {}: {error}", manifest_path.display()))?;
    fs::write(manifest_path, format!("{pretty}\n"))
        .map_err(|error| format!("failed to write {}: {error}", manifest_path.display()))
}

fn default_recommended_mcp_manifest_items() -> Vec<RecommendedMcpManifestItem> {
    vec![
        RecommendedMcpManifestItem {
            id: "browser".to_string(),
            name: "浏览器控制".to_string(),
            description: "用于浏览器联调、页面检查和点击操作。".to_string(),
            source: "opencow-builtin-manifest".to_string(),
            install_query: "browser".to_string(),
            rationale: "这是 OpenCow 当前最成熟、最适合本地桌面端闭环联调的一类 MCP。".to_string(),
            supported: true,
        },
        RecommendedMcpManifestItem {
            id: "fetch".to_string(),
            name: "网页读取".to_string(),
            description: "适合后续补充网页内容抓取和结构化读取。".to_string(),
            source: "opencow-builtin-manifest".to_string(),
            install_query: "fetch".to_string(),
            rationale: "先进入 OpenCow 推荐清单，后续再补稳定宿主与安装流程。".to_string(),
            supported: false,
        },
    ]
}

fn write_recommended_mcp_manifest_items(
    manifest_path: &Path,
    items: &[RecommendedMcpManifestItem],
) -> Result<(), String> {
    let parent = manifest_path.parent().ok_or_else(|| {
        format!(
            "failed to resolve manifest parent for {}",
            manifest_path.display()
        )
    })?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    let payload = serde_json::json!({
        "version": 1,
        "items": items.iter().map(|item| serde_json::json!({
            "id": item.id,
            "name": item.name,
            "description": item.description,
            "source": item.source,
            "install_query": item.install_query,
            "rationale": item.rationale,
            "supported": item.supported
        })).collect::<Vec<_>>()
    });
    let pretty = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("failed to serialize {}: {error}", manifest_path.display()))?;
    fs::write(manifest_path, format!("{pretty}\n"))
        .map_err(|error| format!("failed to write {}: {error}", manifest_path.display()))
}

fn read_recommended_mcp_manifest_items() -> Result<Vec<RecommendedMcpManifestItem>, String> {
    let manifest_path = opencow_recommended_mcp_manifest_path()?;

    if !manifest_path.exists() {
        let items = default_recommended_mcp_manifest_items();
        write_recommended_mcp_manifest_items(&manifest_path, &items)?;
        return Ok(items);
    }

    let raw = fs::read_to_string(&manifest_path)
        .map_err(|error| format!("failed to read {}: {error}", manifest_path.display()))?;
    let parsed: Value = serde_json::from_str(&raw)
        .map_err(|error| format!("failed to parse {}: {error}", manifest_path.display()))?;
    let items = parsed
        .get("items")
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(|entry| {
                    Some(RecommendedMcpManifestItem {
                        id: entry.get("id")?.as_str()?.trim().to_string(),
                        name: entry.get("name")?.as_str()?.trim().to_string(),
                        description: entry
                            .get("description")
                            .and_then(Value::as_str)
                            .unwrap_or("这个 MCP 还没有补充简介。")
                            .trim()
                            .to_string(),
                        source: entry
                            .get("source")
                            .and_then(Value::as_str)
                            .unwrap_or("opencow-local-manifest")
                            .trim()
                            .to_string(),
                        install_query: entry
                            .get("install_query")
                            .and_then(Value::as_str)
                            .or_else(|| entry.get("installQuery").and_then(Value::as_str))
                            .or_else(|| entry.get("id").and_then(Value::as_str))
                            .unwrap_or_default()
                            .trim()
                            .to_string(),
                        rationale: entry
                            .get("rationale")
                            .and_then(Value::as_str)
                            .unwrap_or("OpenCow 已审核的推荐 MCP。")
                            .trim()
                            .to_string(),
                        supported: entry
                            .get("supported")
                            .and_then(Value::as_bool)
                            .unwrap_or(false),
                    })
                })
                .filter(|item| !item.id.is_empty() && !item.name.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if items.is_empty() {
        let fallback = default_recommended_mcp_manifest_items();
        write_recommended_mcp_manifest_items(&manifest_path, &fallback)?;
        return Ok(fallback);
    }

    Ok(items)
}

fn collect_installed_local_mcp_plugin_files() -> Result<Vec<PathBuf>, String> {
    let installed_root = opencow_installed_mcp_root()?;

    if !installed_root.exists() {
        return Ok(Vec::new());
    }

    let mut candidates = Vec::new();
    collect_local_mcp_plugin_files_recursive(&installed_root, &mut candidates)?;
    candidates.sort();
    candidates.dedup();
    Ok(candidates)
}

fn classify_mcp_plugin_source(root: &Path, path: &Path) -> String {
    let relative = to_display_relative_path(root, path);

    if relative.starts_with("vendor/openclaw/extensions/") {
        return "vendor-openclaw-extension-plugin".to_string();
    }

    if relative.starts_with("mcp/installed/") {
        return "opencow-installed-mcp".to_string();
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
        return (
            false,
            "No required config schema fields were detected.".to_string(),
        );
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

fn build_readonly_shell_command(
    command_id: &str,
    root: &Path,
) -> Result<ReadonlyShellCommandSpec, String> {
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
            args: vec![format!(
                "Get-ChildItem -LiteralPath '{}' -Name",
                escape_powershell_single_quote(&root_arg)
            )],
        }),
        "packages-dir-list" => Ok(ReadonlyShellCommandSpec {
            command_id: "packages-dir-list",
            command_label: "Get-ChildItem packages -Name",
            args: vec![format!(
                "Get-ChildItem -LiteralPath '{}' -Name",
                escape_powershell_single_quote(&packages_arg)
            )],
        }),
        _ => Err(format!(
            "unsupported readonly shell command id: {command_id}"
        )),
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
        _ => Err(format!(
            "unsupported OpenClaw capability id: {capability_id}"
        )),
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
        build_controlled_full_shell_command, build_enabled_local_skill_items,
        build_fact_snippets_from_html, build_knowledge_inventory,
        build_npc_showcase_screenshot_artifact_path,
        build_npc_showcase_site_root, build_openclaw_capability_spec, build_readonly_shell_command,
        build_workspace_write_shell_command, classify_mcp_plugin_source,
        controlled_full_command_with_app,
        extract_skill_content_preview, is_local_knowledge_file, is_local_mcp_plugin_file,
        list_workspace_npc_configs_for_selection, local_mcp_plugin_inspect, local_mcp_plugin_scan,
        local_mcp_plugin_start_preview, local_skill_disable_with_app, local_skill_install_with_app,
        looks_like_workspace_root, normalize_network_search_query, normalize_npc_workspace_record,
        normalize_search_result_text, strip_low_value_html_sections,
        opencow_self_repair_enabled_skills_registry_with_app,
        opencow_self_repair_workspace_project_runtime_registry_with_app, parse_skill_frontmatter_name,
        parse_workspace_project_run_pid, read_enabled_skill_registry,
        read_knowledge_import_registry, read_workspace_project_runtime_records,
        resolve_workspace_root, result_matches_query, score_mcp_plugin_match, score_skill_match,
        score_snippet, split_knowledge_segments, tokenize_query, truncate_preview,
        upsert_workspace_npc_config, workspace_project_npc_screenshot_capture,
        workspace_project_npc_showcase_publish_preview, workspace_project_npc_showcase_site_write_with_app,
        workspace_project_run, workspace_project_run_preview, workspace_project_status,
        workspace_project_stop, workspace_readonly_command, workspace_write_command_with_app,
        write_knowledge_import_registry, ImportedKnowledgeFileRecord, KnowledgeImportRegistry,
        KnowledgeLibraryRecord, NpcWorkspaceConfigUpsertPayload,
    };
    use serde_json::{json, Value};
    use std::{
        env, fs,
        path::Path,
        sync::{Mutex, OnceLock},
        time::{SystemTime, UNIX_EPOCH},
    };
    use tauri::test::{mock_app, MockRuntime};

    fn workspace_test_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn lock_workspace_test_guard() -> std::sync::MutexGuard<'static, ()> {
        workspace_test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn test_app_handle() -> tauri::AppHandle<MockRuntime> {
        mock_app().handle().clone()
    }

    #[test]
    fn builds_git_status_readonly_command() {
        let spec =
            build_readonly_shell_command("git-status", Path::new("E:\\2026\\opencow")).unwrap();

        assert_eq!(spec.command_id, "git-status");
        assert_eq!(spec.command_label, "git status --short");
        assert_eq!(spec.args, vec!["git status --short".to_string()]);
    }

    #[test]
    fn normalizes_spoken_network_search_queries_into_keywords() {
        assert_eq!(
            normalize_network_search_query("帮我上网搜索字节跳动"),
            "字节跳动"
        );
        assert_eq!(
            normalize_network_search_query("帮我上网搜索豆包相关信息"),
            "豆包"
        );
        assert_eq!(
            normalize_network_search_query("请帮我联网搜索一下 OpenAI 最新信息"),
            "OpenAI"
        );
    }

    #[test]
    fn strips_navigation_and_footer_sections_before_fact_extraction() {
        let html = r#"
            <html>
              <body>
                <nav>导航入口 推荐内容</nav>
                <article>
                  <p>豆包提供智能问答能力。</p>
                  <p>豆包支持写作辅助。</p>
                </article>
                <footer>页脚 推荐阅读 版权说明</footer>
              </body>
            </html>
        "#;

        let sanitized = strip_low_value_html_sections(html);

        assert!(!sanitized.contains("导航入口"));
        assert!(!sanitized.contains("页脚"));
        assert!(sanitized.contains("豆包提供智能问答能力"));
        assert!(sanitized.contains("豆包支持写作辅助"));
    }

    #[test]
    fn strips_recommendation_blocks_and_keeps_main_article_facts() {
        let html = r#"
            <html>
              <body>
                <section class="recommend">推荐阅读：更多模型评测，猜你喜欢</section>
                <main>
                  <div>DeepSeek 提供代码和推理相关能力。</div>
                  <div>DeepSeek 支持多轮对话。</div>
                </main>
                <div class="sidebar">相关文章：热门推荐</div>
              </body>
            </html>
        "#;

        let snippets = build_fact_snippets_from_html(html);
        let joined = snippets.join(" ");

        assert!(!joined.contains("推荐阅读"));
        assert!(!joined.contains("猜你喜欢"));
        assert!(!joined.contains("相关文章"));
        assert!(joined.contains("DeepSeek 提供代码和推理相关能力"));
        assert!(joined.contains("DeepSeek 支持多轮对话"));
    }

    #[test]
    fn keeps_primary_article_sentences_as_fact_snippets() {
        let html = r#"
            <html>
              <body>
                <article>
                  <p>MCP 用于连接模型与外部工具。</p>
                  <p>MCP 可以统一工具调用上下文。</p>
                  <p>这能降低多工具集成复杂度。</p>
                </article>
              </body>
            </html>
        "#;

        let snippets = build_fact_snippets_from_html(html);

        assert!(snippets.iter().any(|item| item.contains("MCP 用于连接模型与外部工具")));
        assert!(snippets.iter().any(|item| item.contains("MCP 可以统一工具调用上下文")));
        assert!(snippets.iter().any(|item| item.contains("降低多工具集成复杂度")));
    }

    #[test]
    fn filters_out_unrelated_search_results() {
        let tokens = vec!["字节跳动".to_string()];

        assert!(result_matches_query(
            &tokens,
            "字节跳动 - 官网",
            "北京字节跳动科技有限公司成立于2012年",
            "https://www.bytedance.com/"
        ));
        assert!(!result_matches_query(
            &tokens,
            "Kansas City Weather News",
            "Missouri Weather Updates",
            "https://www.kmbc.com/weather"
        ));
    }

    #[test]
    fn strips_html_attribute_noise_from_search_titles() {
        let normalized = normalize_search_result_text(
            "class=\"vr-title\" vrcid=\"title.b429921\" 银龄AI小课堂|豆包是什么它能帮助我们做些什么"
        );

        assert_eq!(normalized, "银龄AI小课堂|豆包是什么它能帮助我们做些什么");
    }

    #[test]
    fn builds_packages_directory_readonly_command() {
        let spec =
            build_readonly_shell_command("packages-dir-list", Path::new("E:\\2026\\opencow"))
                .unwrap();

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
        let spec = build_workspace_write_shell_command(
            "create-temp-output-dir",
            Path::new("E:\\2026\\opencow"),
        )
        .unwrap();

        assert_eq!(spec.command_id, "create-temp-output-dir");
        assert_eq!(
            spec.command_label,
            "New-Item -ItemType Directory -Force temp-output"
        );
        assert!(spec.args[0].contains("temp-output"));
    }

    #[test]
    fn builds_controlled_full_temp_output_remove_command() {
        let spec = build_controlled_full_shell_command(
            "remove-temp-output-dir",
            Path::new("E:\\2026\\opencow"),
        )
        .unwrap();

        assert_eq!(spec.command_id, "remove-temp-output-dir");
        assert_eq!(
            spec.command_label,
            "Remove-Item -LiteralPath temp-output -Recurse -Force"
        );
        assert!(spec.args[0].contains("temp-output"));
        assert!(spec.args[0].contains("Remove-Item"));
    }

    #[test]
    fn rejects_unknown_readonly_shell_command_id() {
        let error = match build_readonly_shell_command(
            "unknown-readonly-command",
            Path::new("E:\\2026\\opencow"),
        ) {
            Ok(_) => panic!("expected unsupported readonly shell command id error"),
            Err(error) => error,
        };

        assert_eq!(
            error,
            "unsupported readonly shell command id: unknown-readonly-command"
        );
    }

    #[test]
    fn rejects_unknown_workspace_write_shell_command_id() {
        let error = match build_workspace_write_shell_command(
            "unknown-workspace-write-command",
            Path::new("E:\\2026\\opencow"),
        ) {
            Ok(_) => panic!("expected unsupported workspace-write shell command id error"),
            Err(error) => error,
        };

        assert_eq!(
            error,
            "unsupported workspace-write shell command id: unknown-workspace-write-command"
        );
    }

    #[test]
    fn rejects_unknown_controlled_full_shell_command_id() {
        let error = match build_controlled_full_shell_command(
            "unknown-controlled-full-command",
            Path::new("E:\\2026\\opencow"),
        ) {
            Ok(_) => panic!("expected unsupported controlled-full shell command id error"),
            Err(error) => error,
        };

        assert_eq!(
            error,
            "unsupported controlled-full shell command id: unknown-controlled-full-command"
        );
    }

    #[test]
    fn workspace_readonly_command_lists_workspace_root_entries() {
        if !cfg!(target_os = "windows") {
            return;
        }
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-workspace-readonly-command-{unique}"));

        fs::create_dir_all(workspace_root.join("apps")).unwrap();
        fs::create_dir_all(workspace_root.join("docs")).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();

        env::set_current_dir(&workspace_root).unwrap();

        let result = workspace_readonly_command("workspace-root-list".to_string()).unwrap();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(result.command_id, "workspace-root-list".to_string());
        assert_eq!(result.command_label, "Get-ChildItem -Name".to_string());
        assert!(result.stdout_preview.contains("apps"));
        assert!(result.stdout_preview.contains("docs"));
        assert!(result.line_count >= 3);
    }

    #[test]
    fn npc_registry_preserves_created_npc_as_selected_when_list_is_sorted() {
        let _guard = lock_workspace_test_guard();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-npc-selection-create-{unique}"));
        fs::create_dir_all(&workspace_root).unwrap();

        upsert_workspace_npc_config(
            &test_app_handle(),
            &workspace_root,
            NpcWorkspaceConfigUpsertPayload {
                id: "alpha-bot".to_string(),
                name: "Alpha Bot".to_string(),
                description: "first".to_string(),
                default_model: "qwen".to_string(),
                persona_title: "Alpha".to_string(),
                persona_prompt: "".to_string(),
                output_style: "简洁".to_string(),
                agent_draft: "".to_string(),
                rules_draft: "".to_string(),
                enabled_skill_names: Vec::new(),
                knowledge_library_ids: Vec::new(),
            },
            None,
        )
        .unwrap();
        upsert_workspace_npc_config(
            &test_app_handle(),
            &workspace_root,
            NpcWorkspaceConfigUpsertPayload {
                id: "zeta-bot".to_string(),
                name: "Zeta Bot".to_string(),
                description: "second".to_string(),
                default_model: "qwen".to_string(),
                persona_title: "Zeta".to_string(),
                persona_prompt: "".to_string(),
                output_style: "简洁".to_string(),
                agent_draft: "".to_string(),
                rules_draft: "".to_string(),
                enabled_skill_names: Vec::new(),
                knowledge_library_ids: Vec::new(),
            },
            None,
        )
        .unwrap();

        let result =
            list_workspace_npc_configs_for_selection(&workspace_root, Some("zeta-bot".to_string()))
                .unwrap();

        assert_eq!(result.selected_npc_id.as_deref(), Some("zeta-bot"));
        assert_eq!(
            result.items.first().map(|item| item.id.as_str()),
            Some("alpha-bot")
        );

        fs::remove_dir_all(&workspace_root).unwrap();
    }

    #[test]
    fn npc_registry_preserves_updated_npc_as_selected_when_list_is_sorted() {
        let _guard = lock_workspace_test_guard();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-npc-selection-update-{unique}"));
        fs::create_dir_all(&workspace_root).unwrap();

        let npc_directory = workspace_root.join(".opencow").join("npcs");
        fs::create_dir_all(&npc_directory).unwrap();
        fs::write(
            npc_directory.join("alpha-bot.json"),
            serde_json::to_string_pretty(&normalize_npc_workspace_record(
                &json!({
                    "id": "alpha-bot",
                    "name": "Alpha Bot",
                    "description": "first",
                    "default_model": "qwen",
                    "persona_title": "Alpha",
                    "output_style": "简洁"
                }),
                Path::new("alpha-bot.json"),
            ))
            .unwrap(),
        )
        .unwrap();
        fs::write(
            npc_directory.join("zeta-bot.json"),
            serde_json::to_string_pretty(&normalize_npc_workspace_record(
                &json!({
                    "id": "zeta-bot",
                    "name": "Zeta Bot",
                    "description": "second",
                    "default_model": "qwen",
                    "persona_title": "Zeta",
                    "output_style": "简洁"
                }),
                Path::new("zeta-bot.json"),
            ))
            .unwrap(),
        )
        .unwrap();

        let result =
            list_workspace_npc_configs_for_selection(&workspace_root, Some("zeta-bot".to_string()))
                .unwrap();

        assert_eq!(result.selected_npc_id.as_deref(), Some("zeta-bot"));
        assert_eq!(
            result.items.first().map(|item| item.id.as_str()),
            Some("alpha-bot")
        );

        fs::remove_dir_all(&workspace_root).unwrap();
    }

    #[test]
    fn workspace_write_command_creates_temp_output_directory_inside_workspace() {
        if !cfg!(target_os = "windows") {
            return;
        }
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-workspace-write-command-{unique}"));

        fs::create_dir_all(workspace_root.join("apps")).unwrap();
        fs::create_dir_all(workspace_root.join("docs")).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();

        env::set_current_dir(&workspace_root).unwrap();

        let result =
            workspace_write_command_with_app("create-temp-output-dir".to_string(), None, &test_app_handle())
                .unwrap();
        let temp_output_exists = workspace_root.join("temp-output").exists();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(result.command_id, "create-temp-output-dir".to_string());
        assert_eq!(
            result.command_label,
            "New-Item -ItemType Directory -Force temp-output".to_string()
        );
        assert!(temp_output_exists);
        assert!(result.stdout_preview.contains("temp-output"));
        assert!(result.line_count >= 1);
    }

    #[test]
    fn controlled_full_command_removes_temp_output_directory_inside_workspace() {
        if !cfg!(target_os = "windows") {
            return;
        }
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-controlled-full-command-{unique}"));
        let temp_output = workspace_root.join("temp-output");

        fs::create_dir_all(workspace_root.join("apps")).unwrap();
        fs::create_dir_all(workspace_root.join("docs")).unwrap();
        fs::create_dir_all(&temp_output).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();
        fs::write(temp_output.join("note.txt"), "temporary").unwrap();

        env::set_current_dir(&workspace_root).unwrap();

        let result =
            controlled_full_command_with_app("remove-temp-output-dir".to_string(), None, &test_app_handle())
                .unwrap();
        let temp_output_exists = temp_output.exists();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(result.command_id, "remove-temp-output-dir".to_string());
        assert_eq!(
            result.command_label,
            "Remove-Item -LiteralPath temp-output -Recurse -Force".to_string()
        );
        assert!(!temp_output_exists);
        assert!(result.stdout_preview.contains("temp-output removed"));
        assert!(result.line_count >= 1);
    }

    #[test]
    fn builds_rag_capability_spec() {
        let spec = build_openclaw_capability_spec("rag").unwrap();

        assert_eq!(spec.title, "OpenClaw RAG capability overview");
        assert_eq!(
            spec.required_directories,
            &["llm-core", "llm-runtime", "model-catalog-core"]
        );
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

        assert_eq!(
            segments,
            vec![
                "# Title line one".to_string(),
                "line two line three".to_string()
            ]
        );
    }

    #[test]
    fn recognizes_markdown_knowledge_files() {
        assert!(is_local_knowledge_file(Path::new(
            "docs/v1.0/06-rag-skills-npc-mcp.md"
        )));
        assert!(is_local_knowledge_file(Path::new(
            "notes/local-rag-rules.txt"
        )));
        assert!(!is_local_knowledge_file(Path::new("docs/product/faq.mdx")));
        assert!(!is_local_knowledge_file(Path::new("package.json")));
    }

    #[test]
    fn reads_missing_knowledge_registry_as_empty() {
        let _guard = lock_workspace_test_guard();
        let original_app_data_root = env::var("OPENCOW_APP_DATA_ROOT").ok();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-knowledge-registry-empty-{unique}"));
        let app_data_root =
            env::temp_dir().join(format!("opencow-knowledge-registry-empty-storage-{unique}"));

        fs::create_dir_all(&workspace_root).unwrap();
        env::set_var("OPENCOW_APP_DATA_ROOT", &app_data_root);

        let registry = read_knowledge_import_registry(&workspace_root).unwrap();

        assert_eq!(registry.version, 2);
        assert_eq!(registry.libraries.len(), 1);
        assert_eq!(registry.libraries[0].id, "default-library");
        assert!(registry.libraries[0].imported_files.is_empty());

        if let Some(value) = original_app_data_root {
            env::set_var("OPENCOW_APP_DATA_ROOT", value);
        } else {
            env::remove_var("OPENCOW_APP_DATA_ROOT");
        }
        let _ = fs::remove_dir_all(&workspace_root);
        let _ = fs::remove_dir_all(&app_data_root);
    }

    #[test]
    fn persists_knowledge_registry_entries() {
        let _guard = lock_workspace_test_guard();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-knowledge-registry-write-{unique}"));

        fs::create_dir_all(&workspace_root).unwrap();

        write_knowledge_import_registry(
            &workspace_root,
            &KnowledgeImportRegistry {
                version: 2,
                active_library_id: "default-library".to_string(),
                libraries: vec![KnowledgeLibraryRecord {
                    id: "default-library".to_string(),
                    label: "默认知识库".to_string(),
                    description: "系统默认知识库。".to_string(),
                    imported_files: vec![ImportedKnowledgeFileRecord {
                        path: "docs/guide.md".to_string(),
                    }],
                }],
            },
        )
        .unwrap();

        let registry = read_knowledge_import_registry(&workspace_root).unwrap();

        assert_eq!(registry.libraries.len(), 1);
        assert_eq!(registry.libraries[0].imported_files.len(), 1);
        assert_eq!(
            registry.libraries[0].imported_files[0].path,
            "docs/guide.md"
        );

        let _ = fs::remove_dir_all(&workspace_root);
    }

    #[test]
    fn recognizes_openclaw_plugin_manifest_files() {
        assert!(is_local_mcp_plugin_file(Path::new(
            "vendor/openclaw/extensions/browser/openclaw.plugin.json"
        )));
        assert!(!is_local_mcp_plugin_file(Path::new(
            "vendor/openclaw/extensions/browser/package.json"
        )));
    }

    #[test]
    fn recognizes_workspace_root_markers() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-workspace-root-markers-{unique}"));

        fs::create_dir_all(workspace_root.join("apps/desktop/src-tauri")).unwrap();
        fs::create_dir_all(workspace_root.join("packages")).unwrap();
        fs::create_dir_all(workspace_root.join("docs")).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();

        let detected = looks_like_workspace_root(&workspace_root);

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert!(detected);
    }

    #[test]
    fn resolves_workspace_root_from_nested_tauri_directory() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-workspace-root-resolve-{unique}"));
        let tauri_dir = workspace_root.join("apps/desktop/src-tauri");

        fs::create_dir_all(&tauri_dir).unwrap();
        fs::create_dir_all(workspace_root.join("packages")).unwrap();
        fs::create_dir_all(workspace_root.join("docs")).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();

        env::set_current_dir(&tauri_dir).unwrap();

        let resolved = resolve_workspace_root().unwrap().canonicalize().unwrap();
        let expected = workspace_root.canonicalize().unwrap();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(resolved, expected);
    }

    #[test]
    fn resolves_workspace_root_from_explicit_environment_override() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let original_root = env::var("OPENCOW_WORKSPACE_ROOT").ok();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-workspace-root-env-override-{unique}"));
        let fake_current_dir =
            env::temp_dir().join(format!("opencow-non-workspace-current-{unique}"));

        fs::create_dir_all(workspace_root.join("apps")).unwrap();
        fs::create_dir_all(workspace_root.join("packages")).unwrap();
        fs::create_dir_all(workspace_root.join("docs")).unwrap();
        fs::create_dir_all(&fake_current_dir).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();

        env::set_var("OPENCOW_WORKSPACE_ROOT", &workspace_root);
        env::set_current_dir(&fake_current_dir).unwrap();

        let resolved = resolve_workspace_root().unwrap();

        env::set_current_dir(&original_dir).unwrap();
        if let Some(value) = original_root {
            env::set_var("OPENCOW_WORKSPACE_ROOT", value);
        } else {
            env::remove_var("OPENCOW_WORKSPACE_ROOT");
        }
        let _ = fs::remove_dir_all(&workspace_root);
        let _ = fs::remove_dir_all(&fake_current_dir);

        assert_eq!(resolved, workspace_root);
    }

    #[test]
    fn classifies_vendor_extension_plugin_source() {
        let root = Path::new("/tmp/opencow");
        let path = Path::new("/tmp/opencow/vendor/openclaw/extensions/browser/openclaw.plugin.json");

        assert_eq!(
            classify_mcp_plugin_source(root, path),
            "vendor-openclaw-extension-plugin".to_string()
        );
    }

    #[test]
    fn parses_skill_name_from_frontmatter() {
        let content = "---\nname: coding-agent\ndescription: Writes code\n---\nbody";

        assert_eq!(
            parse_skill_frontmatter_name(content),
            Some("coding-agent".to_string())
        );
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
        assert_eq!(
            items[0].path,
            "vendor/openclaw/skills/coding-agent/SKILL.md"
        );
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
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let original_app_data_root = env::var("OPENCOW_APP_DATA_ROOT").ok();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-local-skill-disable-{unique}"));
        let app_data_root =
            env::temp_dir().join(format!("opencow-local-skill-disable-storage-{unique}"));
        let vendor_skill_path = workspace_root.join("vendor/openclaw/skills/coding-agent/SKILL.md");
        let installed_skill_path = app_data_root.join("skills/installed/coding-agent/SKILL.md");
        let registry_path = app_data_root.join("skills/enabled-skills.json");

        fs::create_dir_all(vendor_skill_path.parent().unwrap()).unwrap();
        fs::create_dir_all(installed_skill_path.parent().unwrap()).unwrap();
        fs::create_dir_all(registry_path.parent().unwrap()).unwrap();
        fs::write(
            &vendor_skill_path,
            "---\nname: coding-agent\ndescription: Vendor coding agent\n---\nUse this skill for vendor coding tasks.\n",
        )
        .unwrap();
        fs::write(
            &installed_skill_path,
            "---\nname: coding-agent\ndescription: Installed coding agent\n---\nUse this skill for installed coding tasks.\n",
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
                "      \"path\": \"skills/installed/coding-agent/SKILL.md\",\n",
                "      \"source\": \"opencow-installed-skill\",\n",
                "      \"description\": \"Installed coding agent\"\n",
                "    }\n",
                "  ]\n",
                "}\n"
            ),
        )
        .unwrap();

        env::set_current_dir(&workspace_root).unwrap();
        env::set_var("OPENCOW_APP_DATA_ROOT", &app_data_root);

        let result = local_skill_disable_with_app(
            &test_app_handle(),
            "disable the vendor coding-agent skill".to_string(),
            None,
        )
        .unwrap();
        let remaining_entries = read_enabled_skill_registry(&registry_path).unwrap();

        env::set_current_dir(&original_dir).unwrap();
        if let Some(value) = original_app_data_root {
            env::set_var("OPENCOW_APP_DATA_ROOT", value);
        } else {
            env::remove_var("OPENCOW_APP_DATA_ROOT");
        }
        let _ = fs::remove_dir_all(&workspace_root);
        let _ = fs::remove_dir_all(&app_data_root);

        assert_eq!(result.disabled_skill_name, "coding-agent");
        assert_eq!(remaining_entries.len(), 1);
        assert_eq!(
            remaining_entries[0]
                .get("path")
                .and_then(|value| value.as_str()),
            Some("skills/installed/coding-agent/SKILL.md")
        );
    }

    #[test]
    fn local_mcp_plugin_scan_reads_vendor_plugin_manifests() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let original_app_data_root = env::var("OPENCOW_APP_DATA_ROOT").ok();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-local-mcp-plugin-scan-{unique}"));
        let app_data_root =
            env::temp_dir().join(format!("opencow-local-mcp-plugin-scan-storage-{unique}"));
        let browser_plugin = app_data_root.join("mcp/installed/browser/openclaw.plugin.json");
        let supervisor_plugin =
            app_data_root.join("mcp/installed/codex-supervisor/openclaw.plugin.json");

        fs::create_dir_all(&workspace_root).unwrap();
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
        env::set_var("OPENCOW_APP_DATA_ROOT", &app_data_root);

        let result = local_mcp_plugin_scan().unwrap();

        env::set_current_dir(&original_dir).unwrap();
        if let Some(value) = original_app_data_root {
            env::set_var("OPENCOW_APP_DATA_ROOT", value);
        } else {
            env::remove_var("OPENCOW_APP_DATA_ROOT");
        }
        let _ = fs::remove_dir_all(&workspace_root);
        let _ = fs::remove_dir_all(&app_data_root);

        assert_eq!(result.total_count, 2);
        assert_eq!(result.scanned_root_count, 1);
        assert_eq!(result.items[0].id, "browser");
        assert_eq!(result.items[0].source, "opencow-installed-mcp");
        assert_eq!(result.items[0].path, "mcp/installed/browser/openclaw.plugin.json");
        assert_eq!(result.items[0].activation, "startup");
        assert_eq!(result.items[0].tool_count, 1);
        assert_eq!(result.items[0].skill_count, 1);
        assert_eq!(result.items[1].id, "codex-supervisor");
        assert_eq!(result.items[1].activation, "manual");
        assert_eq!(result.items[1].tool_count, 3);
    }

    #[test]
    fn local_mcp_plugin_inspect_reads_matching_vendor_plugin_manifest_details() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let original_app_data_root = env::var("OPENCOW_APP_DATA_ROOT").ok();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-local-mcp-plugin-inspect-{unique}"));
        let app_data_root =
            env::temp_dir().join(format!("opencow-local-mcp-plugin-inspect-storage-{unique}"));
        let browser_plugin = app_data_root.join("mcp/installed/browser/openclaw.plugin.json");
        let supervisor_plugin =
            app_data_root.join("mcp/installed/codex-supervisor/openclaw.plugin.json");

        fs::create_dir_all(&workspace_root).unwrap();
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
        env::set_var("OPENCOW_APP_DATA_ROOT", &app_data_root);

        let result =
            local_mcp_plugin_inspect("show details for the browser mcp plugin".to_string())
                .unwrap();

        env::set_current_dir(&original_dir).unwrap();
        if let Some(value) = original_app_data_root {
            env::set_var("OPENCOW_APP_DATA_ROOT", value);
        } else {
            env::remove_var("OPENCOW_APP_DATA_ROOT");
        }
        let _ = fs::remove_dir_all(&workspace_root);
        let _ = fs::remove_dir_all(&app_data_root);

        assert_eq!(result.match_count, 1);
        assert_eq!(result.scanned_root_count, 1);
        assert_eq!(result.items[0].id, "browser");
        assert_eq!(result.items[0].path, "mcp/installed/browser/openclaw.plugin.json");
        assert_eq!(result.items[0].source, "opencow-installed-mcp");
        assert_eq!(result.items[0].activation, "startup");
        assert_eq!(
            result.items[0].description,
            "Browser automation plugin entry.".to_string()
        );
        assert_eq!(result.items[0].tool_names, vec!["browser".to_string()]);
        assert_eq!(result.items[0].skill_paths, vec!["./skills".to_string()]);
    }

    #[test]
    fn local_mcp_plugin_start_preview_reads_matching_vendor_plugin_preview_fields() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let original_app_data_root = env::var("OPENCOW_APP_DATA_ROOT").ok();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-local-mcp-plugin-start-preview-{unique}"));
        let app_data_root = env::temp_dir()
            .join(format!("opencow-local-mcp-plugin-start-preview-storage-{unique}"));
        let browser_plugin = app_data_root.join("mcp/installed/browser/openclaw.plugin.json");
        let supervisor_plugin =
            app_data_root.join("mcp/installed/codex-supervisor/openclaw.plugin.json");

        fs::create_dir_all(&workspace_root).unwrap();
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
        env::set_var("OPENCOW_APP_DATA_ROOT", &app_data_root);

        let result = local_mcp_plugin_start_preview(
            "preview starting the browser mcp plugin locally".to_string(),
        )
        .unwrap();

        env::set_current_dir(&original_dir).unwrap();
        if let Some(value) = original_app_data_root {
            env::set_var("OPENCOW_APP_DATA_ROOT", value);
        } else {
            env::remove_var("OPENCOW_APP_DATA_ROOT");
        }
        let _ = fs::remove_dir_all(&workspace_root);
        let _ = fs::remove_dir_all(&app_data_root);

        assert_eq!(result.match_count, 1);
        assert_eq!(result.items[0].id, "browser");
        assert!(result.items[0].startup_allowed);
        assert_eq!(result.items[0].activation, "startup");
        assert_eq!(
            result.items[0].command_preview,
            "node vendor/openclaw/openclaw.mjs browser start".to_string()
        );
        assert_eq!(
            result.items[0].working_directory,
            "vendor/openclaw".to_string()
        );
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
        let original_app_data_root = env::var("OPENCOW_APP_DATA_ROOT").ok();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-local-skill-install-{unique}"));
        let app_data_root = env::temp_dir().join(format!("opencow-local-skill-install-storage-{unique}"));
        let vendor_skill_path = workspace_root.join("vendor/openclaw/skills/gpt-taste/SKILL.md");

        fs::create_dir_all(vendor_skill_path.parent().unwrap()).unwrap();
        fs::create_dir_all(workspace_root.join("apps")).unwrap();
        fs::create_dir_all(workspace_root.join("packages")).unwrap();
        fs::create_dir_all(workspace_root.join("docs")).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();
        fs::write(
            &vendor_skill_path,
            "---\nname: gpt-taste\ndescription: Elite UX/UI and motion skill\n---\nUse this skill for advanced UX and motion refinement.\n",
        )
        .unwrap();

        env::set_current_dir(&workspace_root).unwrap();
        env::set_var("OPENCOW_APP_DATA_ROOT", &app_data_root);

        let result = local_skill_install_with_app(
            &test_app_handle(),
            "install the gpt-taste skill into this workspace skills folder".to_string(),
            None,
        )
        .unwrap();

        env::set_current_dir(&original_dir).unwrap();
        if let Some(value) = original_app_data_root {
            env::set_var("OPENCOW_APP_DATA_ROOT", value);
        } else {
            env::remove_var("OPENCOW_APP_DATA_ROOT");
        }

        let installed_path = app_data_root.join("skills/installed/gpt-taste/SKILL.md");
        let installed_contents = fs::read_to_string(&installed_path).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);
        let _ = fs::remove_dir_all(&app_data_root);

        assert_eq!(result.installed_skill_name, "gpt-taste".to_string());
        assert_eq!(
            result.installed_skill_path,
            "skills/installed/gpt-taste/SKILL.md".to_string()
        );
        assert_eq!(
            result.source_skill_path,
            "vendor/openclaw/skills/gpt-taste/SKILL.md".to_string()
        );
        assert_eq!(result.status, "installed".to_string());
        assert!(installed_contents.contains("Elite UX/UI and motion skill"));
    }

    #[test]
    fn knowledge_inventory_is_empty_by_default_and_does_not_scan_workspace_files() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let original_app_data_root = env::var("OPENCOW_APP_DATA_ROOT").ok();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-knowledge-inventory-default-{unique}"));
        let app_data_root =
            env::temp_dir().join(format!("opencow-knowledge-app-data-default-{unique}"));

        fs::create_dir_all(workspace_root.join("apps")).unwrap();
        fs::create_dir_all(workspace_root.join("packages")).unwrap();
        fs::create_dir_all(workspace_root.join("docs")).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();
        fs::write(
            workspace_root.join("README.md"),
            "# repo file that should not appear in knowledge inventory\n",
        )
        .unwrap();

        env::set_current_dir(&workspace_root).unwrap();
        env::set_var("OPENCOW_APP_DATA_ROOT", &app_data_root);

        let result = build_knowledge_inventory(&workspace_root, None).unwrap();

        env::set_current_dir(&original_dir).unwrap();
        if let Some(value) = original_app_data_root {
            env::set_var("OPENCOW_APP_DATA_ROOT", value);
        } else {
            env::remove_var("OPENCOW_APP_DATA_ROOT");
        }
        let _ = fs::remove_dir_all(&workspace_root);
        let _ = fs::remove_dir_all(&app_data_root);

        assert_eq!(result.imported_files.len(), 0);
        assert_eq!(result.available_files.len(), 0);
        assert_eq!(result.indexed_document_count, 0);
        assert_eq!(
            result.registry_path,
            "knowledge/imported-files.json".to_string()
        );
    }

    #[test]
    fn local_skill_install_copies_vendor_skill_into_opencow_app_skill_directory() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let original_app_data_root = env::var("OPENCOW_APP_DATA_ROOT").ok();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-local-skill-install-app-data-{unique}"));
        let app_data_root =
            env::temp_dir().join(format!("opencow-local-skill-install-storage-{unique}"));
        let vendor_skill_path = workspace_root.join("vendor/openclaw/skills/gpt-taste/SKILL.md");

        fs::create_dir_all(vendor_skill_path.parent().unwrap()).unwrap();
        fs::create_dir_all(workspace_root.join("apps")).unwrap();
        fs::create_dir_all(workspace_root.join("packages")).unwrap();
        fs::create_dir_all(workspace_root.join("docs")).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();
        fs::write(
            &vendor_skill_path,
            "---\nname: gpt-taste\ndescription: Elite UX/UI and motion skill\n---\nUse this skill for advanced UX and motion refinement.\n",
        )
        .unwrap();

        env::set_current_dir(&workspace_root).unwrap();
        env::set_var("OPENCOW_APP_DATA_ROOT", &app_data_root);

        let result = local_skill_install_with_app(
            &test_app_handle(),
            "install the gpt-taste skill into opencow".to_string(),
            None,
        )
        .unwrap();

        env::set_current_dir(&original_dir).unwrap();
        if let Some(value) = original_app_data_root {
            env::set_var("OPENCOW_APP_DATA_ROOT", value);
        } else {
            env::remove_var("OPENCOW_APP_DATA_ROOT");
        }

        let installed_path = app_data_root.join("skills/installed/gpt-taste/SKILL.md");
        let installed_contents = fs::read_to_string(&installed_path).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);
        let _ = fs::remove_dir_all(&app_data_root);

        assert_eq!(result.installed_skill_name, "gpt-taste".to_string());
        assert_eq!(
            result.installed_skill_path,
            "skills/installed/gpt-taste/SKILL.md".to_string()
        );
        assert_eq!(
            result.source_skill_path,
            "vendor/openclaw/skills/gpt-taste/SKILL.md".to_string()
        );
        assert_eq!(result.status, "installed".to_string());
        assert!(installed_contents.contains("Elite UX/UI and motion skill"));
    }

    #[test]
    fn opencow_self_repair_enabled_skills_registry_recovers_from_invalid_json() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let original_app_data_root = env::var("OPENCOW_APP_DATA_ROOT").ok();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-self-repair-enabled-skills-{unique}"));
        let app_data_root =
            env::temp_dir().join(format!("opencow-self-repair-enabled-skills-storage-{unique}"));
        let registry_path = app_data_root.join("skills/enabled-skills.json");

        fs::create_dir_all(workspace_root.join("apps")).unwrap();
        fs::create_dir_all(workspace_root.join("packages")).unwrap();
        fs::create_dir_all(workspace_root.join("docs")).unwrap();
        fs::create_dir_all(registry_path.parent().unwrap()).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();
        fs::write(&registry_path, "{ invalid json").unwrap();

        env::set_current_dir(&workspace_root).unwrap();
        env::set_var("OPENCOW_APP_DATA_ROOT", &app_data_root);

        let result = opencow_self_repair_enabled_skills_registry_with_app(
            &test_app_handle(),
            "diagnose opencow and continue repairing its enabled skills registry".to_string(),
            None,
        )
        .unwrap();

        env::set_current_dir(&original_dir).unwrap();
        if let Some(value) = original_app_data_root {
            env::set_var("OPENCOW_APP_DATA_ROOT", value);
        } else {
            env::remove_var("OPENCOW_APP_DATA_ROOT");
        }

        let repaired = fs::read_to_string(&registry_path).unwrap();
        let parsed: Value = serde_json::from_str(&repaired).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);
        let _ = fs::remove_dir_all(&app_data_root);

        assert_eq!(result.repair_target, "enabled-skills-registry".to_string());
        assert_eq!(
            result.repaired_path,
            "skills/enabled-skills.json".to_string()
        );
        assert_eq!(result.status, "repaired".to_string());
        assert_eq!(result.preserved_entry_count, 0);
        assert_eq!(result.verified_version, 1);
        assert_eq!(result.verified_entry_count, 0);
        assert_eq!(parsed.get("version").and_then(Value::as_u64), Some(1));
        assert!(parsed
            .get("enabled_skills")
            .and_then(Value::as_array)
            .is_some());
    }

    #[test]
    fn opencow_self_repair_workspace_project_runtime_registry_recovers_from_invalid_json() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-self-repair-runtime-registry-{unique}"));
        let registry_path = workspace_root
            .join(".opencow")
            .join("runtime")
            .join("workspace-project-runs.json");

        fs::create_dir_all(workspace_root.join("apps")).unwrap();
        fs::create_dir_all(workspace_root.join("packages")).unwrap();
        fs::create_dir_all(workspace_root.join("docs")).unwrap();
        fs::create_dir_all(registry_path.parent().unwrap()).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();
        fs::write(&registry_path, "{ invalid json").unwrap();

        env::set_current_dir(&workspace_root).unwrap();

        let result = opencow_self_repair_workspace_project_runtime_registry_with_app(
            &test_app_handle(),
            "diagnose opencow and continue repairing its workspace project runtime registry"
                .to_string(),
            None,
        )
        .unwrap();

        env::set_current_dir(&original_dir).unwrap();

        let repaired = fs::read_to_string(&registry_path).unwrap();
        let parsed: Value = serde_json::from_str(&repaired).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(
            result.repair_target,
            "workspace-project-runtime-registry".to_string()
        );
        assert_eq!(
            result.repaired_path,
            ".opencow/runtime/workspace-project-runs.json".to_string()
        );
        assert_eq!(result.status, "repaired".to_string());
        assert_eq!(result.preserved_entry_count, 0);
        assert_eq!(result.verified_version, 1);
        assert_eq!(result.verified_run_count, 0);
        assert_eq!(parsed.get("version").and_then(Value::as_u64), Some(1));
        assert!(parsed.get("runs").and_then(Value::as_array).is_some());
    }

    #[test]
    fn workspace_project_run_preview_matches_app_with_dev_script_and_expected_url() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-workspace-run-preview-{unique}"));
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

        let result =
            workspace_project_run_preview("run the desktop app locally".to_string()).unwrap();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(result.inspected_project_count, 3);
        assert_eq!(result.matched_project_name, Some("desktop".to_string()));
        assert_eq!(
            result.matched_project_path,
            Some("apps/desktop".to_string())
        );
        assert_eq!(result.matched_project_source, Some("apps".to_string()));
        assert_eq!(result.dev_command, Some("npm run dev".to_string()));
        assert_eq!(result.build_command, Some("npm run build".to_string()));
        assert_eq!(
            result.expected_url,
            Some("http://127.0.0.1:1420".to_string())
        );
        assert_eq!(
            result.next_required_permission,
            "workspace-write".to_string()
        );
    }

    #[test]
    fn workspace_project_run_starts_matched_app_and_returns_handle() {
        if !cfg!(target_os = "windows") {
            return;
        }
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-workspace-run-{unique}"));
        let app_dir = workspace_root.join("apps/desktop");
        let package_dir = workspace_root.join("packages/openclaw-adapter");
        let docs_dir = workspace_root.join("docs");

        fs::create_dir_all(&app_dir).unwrap();
        fs::create_dir_all(&package_dir).unwrap();
        fs::create_dir_all(&docs_dir).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();
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
        assert_eq!(
            result.expected_url,
            Some("http://127.0.0.1:1420".to_string())
        );
        assert!(result.pid > 0);
        assert!(result.stdout_preview.contains("pid:"));
    }

    #[test]
    fn workspace_project_status_reports_active_runtime_handle_for_matched_app() {
        if !cfg!(target_os = "windows") {
            return;
        }
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-workspace-status-{unique}"));
        let app_dir = workspace_root.join("apps/desktop");
        let package_dir = workspace_root.join("packages/openclaw-adapter");
        let docs_dir = workspace_root.join("docs");

        fs::create_dir_all(&app_dir).unwrap();
        fs::create_dir_all(&package_dir).unwrap();
        fs::create_dir_all(&docs_dir).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();
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
        let status_result =
            workspace_project_status("show the status of the desktop app local run".to_string())
                .unwrap();
        let runtime_registry_path = workspace_root
            .join(".opencow")
            .join("runtime")
            .join("workspace-project-runs.json");
        let persisted = fs::read_to_string(&runtime_registry_path).unwrap();
        let parsed: Value = serde_json::from_str(&persisted).unwrap();
        let runs = parsed
            .get("runs")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(status_result.project_name, "desktop".to_string());
        assert_eq!(status_result.project_path, "apps/desktop".to_string());
        assert_eq!(status_result.command_label, "npm run dev".to_string());
        assert_eq!(status_result.working_directory, "apps/desktop".to_string());
        assert_eq!(
            status_result.expected_url,
            Some("http://127.0.0.1:1420".to_string())
        );
        assert_eq!(status_result.pid, Some(run_result.pid));
        assert_eq!(status_result.status, "running".to_string());
        assert!(status_result.stdout_preview.contains("running:"));

        assert_eq!(runs.len(), 1);
        assert!(runs[0].get("launched_at").and_then(Value::as_str).is_some());
        assert_eq!(
            runs[0].get("last_status").and_then(Value::as_str),
            Some("running")
        );
        assert!(runs[0]
            .get("last_checked_at")
            .and_then(Value::as_str)
            .is_some());
    }

    #[test]
    fn workspace_project_status_recovers_runtime_registry_from_invalid_json() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-workspace-status-repair-{unique}"));
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
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();
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

        let status_result =
            workspace_project_status("show the status of the desktop app local run".to_string())
                .unwrap();

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
        if !cfg!(target_os = "windows") {
            return;
        }
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-workspace-status-migrate-{unique}"));
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
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();
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

        let status_result =
            workspace_project_status("show the status of the desktop app local run".to_string())
                .unwrap();

        env::set_current_dir(&original_dir).unwrap();

        let repaired = fs::read_to_string(&runtime_registry_path).unwrap();
        let parsed: Value = serde_json::from_str(&repaired).unwrap();
        let runs = parsed
            .get("runs")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(status_result.project_name, "desktop".to_string());
        assert_eq!(status_result.project_path, "apps/desktop".to_string());
        assert_eq!(status_result.status, "running".to_string());
        assert_eq!(parsed.get("version").and_then(Value::as_u64), Some(1));
        assert_eq!(runs.len(), 1);
        assert_eq!(
            runs[0].get("project_path").and_then(Value::as_str),
            Some("apps/desktop")
        );
        assert_eq!(
            runs[0].get("launched_at").and_then(Value::as_str),
            Some("legacy-migrated")
        );
        assert_eq!(
            runs[0].get("last_status").and_then(Value::as_str),
            Some("running")
        );
        assert!(runs[0]
            .get("last_checked_at")
            .and_then(Value::as_str)
            .is_some());
    }

    #[test]
    fn workspace_project_stop_stops_matched_app_and_clears_runtime_handle() {
        if !cfg!(target_os = "windows") {
            return;
        }
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root = env::temp_dir().join(format!("opencow-workspace-stop-{unique}"));
        let app_dir = workspace_root.join("apps/desktop");
        let package_dir = workspace_root.join("packages/openclaw-adapter");
        let docs_dir = workspace_root.join("docs");

        fs::create_dir_all(&app_dir).unwrap();
        fs::create_dir_all(&package_dir).unwrap();
        fs::create_dir_all(&docs_dir).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();
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
        let stop_result =
            workspace_project_stop("stop the desktop app local run".to_string()).unwrap();
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
        assert!(stop_result.stdout_preview.contains("descendants:"));
        assert!(registry_records.is_empty());
    }

    #[test]
    fn parse_workspace_project_run_pid_rejects_zero_and_invalid_values() {
        assert_eq!(parse_workspace_project_run_pid("pid:1234"), Some(1234));
        assert_eq!(parse_workspace_project_run_pid("pid:0"), None);
        assert_eq!(parse_workspace_project_run_pid("pid:not-a-number"), None);
        assert_eq!(parse_workspace_project_run_pid("started"), None);
    }

    #[test]
    fn workspace_project_npc_screenshot_capture_returns_error_without_active_runtime_handle() {
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-workspace-npc-screenshot-{unique}"));
        let project_dir = workspace_root.join("apps/cattle");
        let package_dir = workspace_root.join("packages/openclaw-adapter");
        let docs_dir = workspace_root.join("docs");

        fs::create_dir_all(&project_dir).unwrap();
        fs::create_dir_all(&package_dir).unwrap();
        fs::create_dir_all(&docs_dir).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();
        fs::write(
            project_dir.join("package.json"),
            concat!(
                "{\n",
                "  \"name\": \"cattle\",\n",
                "  \"scripts\": {\n",
                "    \"dev\": \"vite\"\n",
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

        let error = workspace_project_npc_screenshot_capture(
            "use npc collaboration to capture a screenshot from the matched cattle project now"
                .to_string(),
        )
        .unwrap_err();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert!(error.contains("No active matched local project run is available"));
    }

    #[test]
    fn workspace_project_npc_screenshot_capture_artifact_path_stays_inside_workspace_artifacts_root(
    ) {
        let workspace_root = Path::new("E:/2026/opencow");
        let artifact_path =
            build_npc_showcase_screenshot_artifact_path(workspace_root, "cattle", "1700000000");

        assert!(artifact_path.ends_with(Path::new(
            ".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png"
        )));
    }

    #[test]
    fn workspace_project_npc_showcase_site_write_returns_error_without_screenshot_artifact() {
        if !cfg!(target_os = "windows") {
            return;
        }
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-workspace-npc-showcase-site-{unique}"));
        let project_dir = workspace_root.join("apps/cattle");
        let package_dir = workspace_root.join("packages/openclaw-adapter");
        let docs_dir = workspace_root.join("docs");

        fs::create_dir_all(&project_dir).unwrap();
        fs::create_dir_all(&package_dir).unwrap();
        fs::create_dir_all(&docs_dir).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();
        fs::write(
            project_dir.join("package.json"),
            concat!(
                "{\n",
                "  \"name\": \"cattle\",\n",
                "  \"scripts\": {\n",
                "    \"dev\": \"vite\"\n",
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

        let run_result = workspace_project_run("run the cattle app locally".to_string()).unwrap();
        assert_eq!(run_result.project_name, "cattle".to_string());

        let error = workspace_project_npc_showcase_site_write_with_app(
            &test_app_handle(),
            "use npc collaboration to generate the showcase site for the matched cattle project now".to_string(),
            None,
        )
        .unwrap_err();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert!(error.contains("No screenshot artifact"));
    }

    #[test]
    fn workspace_project_npc_showcase_site_write_output_path_stays_inside_workspace_artifacts_root()
    {
        let workspace_root = Path::new("E:/2026/opencow");
        let site_root = build_npc_showcase_site_root(workspace_root, "cattle");

        assert!(site_root.ends_with(Path::new(".opencow/artifacts/npc-showcase/sites/cattle")));
    }

    #[test]
    fn workspace_project_npc_showcase_publish_preview_returns_error_without_site_output() {
        if !cfg!(target_os = "windows") {
            return;
        }
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root =
            env::temp_dir().join(format!("opencow-workspace-npc-publish-preview-{unique}"));
        let project_dir = workspace_root.join("apps/cattle");
        let package_dir = workspace_root.join("packages/openclaw-adapter");
        let docs_dir = workspace_root.join("docs");

        fs::create_dir_all(&project_dir).unwrap();
        fs::create_dir_all(&package_dir).unwrap();
        fs::create_dir_all(&docs_dir).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();
        fs::write(
            project_dir.join("package.json"),
            concat!(
                "{\n",
                "  \"name\": \"cattle\",\n",
                "  \"scripts\": {\n",
                "    \"dev\": \"vite\"\n",
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

        let run_result = workspace_project_run("run the cattle app locally".to_string()).unwrap();
        assert_eq!(run_result.project_name, "cattle".to_string());

        let error = workspace_project_npc_showcase_publish_preview(
            "use npc collaboration to preview the generated showcase output for the matched cattle project before git"
                .to_string(),
        )
        .unwrap_err();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert!(error.contains("No generated showcase site output"));
    }

    #[test]
    fn workspace_project_npc_showcase_publish_preview_reads_deterministic_project_scoped_paths() {
        if !cfg!(target_os = "windows") {
            return;
        }
        let _guard = lock_workspace_test_guard();
        let original_dir = env::current_dir().unwrap();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let workspace_root = env::temp_dir().join(format!(
            "opencow-workspace-npc-publish-preview-success-{unique}"
        ));
        let project_dir = workspace_root.join("apps/cattle");
        let package_dir = workspace_root.join("packages/openclaw-adapter");
        let docs_dir = workspace_root.join("docs");
        let artifacts_root = workspace_root
            .join(".opencow")
            .join("artifacts")
            .join("npc-showcase");
        let site_root = artifacts_root.join("sites").join("cattle");

        fs::create_dir_all(&project_dir).unwrap();
        fs::create_dir_all(&package_dir).unwrap();
        fs::create_dir_all(&docs_dir).unwrap();
        fs::create_dir_all(&site_root).unwrap();
        fs::write(
            workspace_root.join("package.json"),
            "{\n  \"name\": \"opencow\"\n}\n",
        )
        .unwrap();
        fs::write(
            project_dir.join("package.json"),
            concat!(
                "{\n",
                "  \"name\": \"cattle\",\n",
                "  \"scripts\": {\n",
                "    \"dev\": \"vite\"\n",
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
            site_root.join("index.html"),
            "<html><body>cattle showcase</body></html>",
        )
        .unwrap();
        fs::write(
            artifacts_root.join("cattle-screenshot-1700000000.png"),
            b"fake-png",
        )
        .unwrap();

        env::set_current_dir(&workspace_root).unwrap();

        let run_result = workspace_project_run("run the cattle app locally".to_string()).unwrap();
        assert_eq!(run_result.project_name, "cattle".to_string());

        let result = workspace_project_npc_showcase_publish_preview(
            "use npc collaboration to review the changed showcase files for the matched cattle project before commit"
                .to_string(),
        )
        .unwrap();

        env::set_current_dir(&original_dir).unwrap();
        let _ = fs::remove_dir_all(&workspace_root);

        assert_eq!(result.project_name, "cattle".to_string());
        assert_eq!(result.project_path, "apps/cattle".to_string());
        assert_eq!(
            result.site_root,
            ".opencow/artifacts/npc-showcase/sites/cattle".to_string()
        );
        assert_eq!(
            result.entry_file,
            ".opencow/artifacts/npc-showcase/sites/cattle/index.html".to_string()
        );
        assert_eq!(
            result.changed_paths,
            vec![".opencow/artifacts/npc-showcase/sites/cattle/index.html".to_string()]
        );
        assert_eq!(
            result.source_screenshot_path,
            ".opencow/artifacts/npc-showcase/cattle-screenshot-1700000000.png".to_string()
        );
        assert_eq!(
            result.next_git_step,
            "Git commit or push is still separate and requires its own explicit confirmation stage."
                .to_string()
        );
    }
}
