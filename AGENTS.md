## graphify

This project stores Graphify outputs in repo-local folders with a stable naming rule:
- whole repo -> `graphify/`
- submodule -> `graphify_<submodule_name>/`

When the user types `/graphify`, use the repo wrapper first instead of calling raw `graphify extract` directly.

Rules:
- For the whole repository, run `npm run graphify -- . --clean`. This writes outputs to `./graphify/`.
- For a submodule such as `apps/desktop`, run `npm run graphify -- apps/desktop --clean`. This writes outputs to `./graphify_apps_desktop/`.
- Submodule folder names must replace path separators with underscores, matching the wrapper behavior.
- If no supported LLM API key is available, the wrapper will fall back to code-only extraction with `--no-cluster` so the project still gets a structural graph.
- After extraction, prefer `graphify query`, `graphify explain`, `graphify path`, and `graphify tree` against the generated `graph.json` inside the repo-local output folder.
- Only use raw `graphify-out/` paths if the user explicitly asks for the upstream default layout.
