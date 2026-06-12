# DEBUG REPORT: launcher check mode failure path

- **Symptom:** `start-opencow-test.bat check` could look frozen after a startup/build/environment failure because the shared failure footer always waited for a keypress.
- **Root cause:** The launcher used one `:done` failure path for both manual double-click startup and non-interactive `check` automation. The manual path should keep errors visible with `pause`, but `check` mode must return the failure code immediately.
- **Fix:** `start-opencow-test.bat` now exits before `pause >nul` when `%MODE%` is `check`. `scripts/check-health.mjs` now guards that contract, and `scripts/check-encoding.mjs` includes the launcher in UTF-8 checks.
- **Regression test:** `apps/desktop/src/app/app.dev-server-config.test.ts` asserts that check-mode failure exit remains before the pause.
- **Evidence:** `npm run check:health`, `npm run check:encoding`, desktop unit tests, and `npm run desktop:test:check` passed locally on 2026-06-12.
- **Status:** DONE
