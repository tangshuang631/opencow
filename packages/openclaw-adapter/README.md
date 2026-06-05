# @opencow/openclaw-adapter

Controlled adapter boundary between opencow and the vendored OpenClaw source under `vendor/openclaw`.

Current scope:

- Locate the vendored OpenClaw root.
- Read upstream package metadata for audit and license checks.
- Inspect expected upstream capability packages without importing runtime code.

This package must stay small, tested, and safety-aware. UI code should not access `vendor/openclaw` directly.
