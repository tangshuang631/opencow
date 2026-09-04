# OpenCow Unified Icons

This directory is the single source of truth for OpenCow launcher and desktop icons.

Outputs generated from the master source:

- `master/opencow-cow-o-master.png`: main high-resolution source
- `exports/icon.png`: Tauri desktop bundle source PNG
- `exports/icon.ico`: Windows icon
- `exports/icon.icns`: macOS desktop app icon
- `exports/web-launcher.icns`: macOS web launcher icon

Consumers:

- `apps/desktop/src-tauri/icons/`
- `/Users/apple/Desktop/OpenCow桌面端.app`

The macOS desktop sync keeps `/Users/apple/Desktop/OpenCow桌面端.app` as the single manual-test bundle. The web preview uses Vite and does not require a second `.app` wrapper.

Regenerate with:

```bash
python3 scripts/generate-opencow-icons.py
```
