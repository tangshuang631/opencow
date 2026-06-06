# opencow

基于 openclaw 的本地优先、安全、轻量化大模型助手。

opencow is a local-first Windows desktop AI assistant based on OpenClaw. It prioritizes Ollama, strict permissions, audit logs, rollback points, and a simple light desktop workbench.

Read first:

- [OPENCOW_CORE_RULES.md](./OPENCOW_CORE_RULES.md)
- [docs/v1.0/00-overview.md](./docs/v1.0/00-overview.md)

Development starts on the `dev` branch.

Quick desktop test startup:

- Double-click `start-opencow-test.bat`
- Or run `npm run desktop:test:start`
- Environment-only check: `npm run desktop:test:check`

Notes:

- Docker is not required for the current desktop-first local testing path.
- The launcher is a plain static `.bat` file, uses UTF-8 console output, checks `npm` and `cargo`, installs npm dependencies when needed, verifies Ollama reachability, and then launches the desktop Tauri dev app.
- For safety and antivirus compatibility, the launcher does not generate dynamic scripts and does not auto-start Ollama in the background. If Ollama is not running, it exits with a clear hint.
