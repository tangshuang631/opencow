# DEBUG REPORT: Tauri Ollama overview timeout

- **Symptom:** The frontend bounded Ollama startup/model detection with a 15 second race, but the Tauri-side `ollama_overview` HTTP request used `reqwest::get` without an explicit client timeout.
- **Root cause:** UI recovery and backend network lifetime were not aligned. If local Ollama accepted a connection slowly or became unresponsive, the UI could recover while the backend request continued longer than intended.
- **Fix:** `apps/desktop/src-tauri/src/ollama.rs` now builds the overview request with a 15 second `reqwest::Client` timeout, matching the startup probe budget used by the frontend service layer.
- **Regression test:** `ollama_overview_request_timeout_matches_startup_probe_budget` verifies the Tauri overview timeout budget.
- **Evidence:** `cargo test ollama -- --nocapture` passed locally on 2026-06-12 with 26 Ollama-focused tests.
- **Status:** DONE
