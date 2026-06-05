mod ollama;

#[tauri::command]
fn health() -> &'static str {
    "ok"
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![health, ollama::ollama_overview])
        .run(tauri::generate_context!())
        .expect("failed to run opencow desktop");
}
