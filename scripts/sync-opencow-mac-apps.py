#!/usr/bin/env python3

from __future__ import annotations

import shutil
import subprocess
import tempfile
import time
from pathlib import Path


ROOT = Path("/Users/apple/Desktop/2026/opencow")
DESKTOP_BUILD_CMD = ["npm", "--workspace", "apps/desktop", "run", "build"]
DESKTOP_TAURI_BUILD_CMD = ["npm", "run", "tauri:build"]
DESKTOP_BUNDLE = ROOT / "apps" / "desktop" / "src-tauri" / "target" / "release" / "bundle" / "macos" / "opencow.app"
DESKTOP_TARGET = Path("/Users/apple/Desktop/OpenCow桌面端.app")
DESKTOP_APP_BUNDLE_ID = "cn.opencow.desktop"
DESKTOP_APP_EXECUTABLE = "opencow-desktop"


def run_command(args: list[str], *, check: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, check=check, text=True, capture_output=True)


def close_existing_desktop_app() -> None:
    run_command(["osascript", "-e", f'tell application id "{DESKTOP_APP_BUNDLE_ID}" to quit'])
    time.sleep(1.0)
    run_command(["pkill", "-x", DESKTOP_APP_EXECUTABLE])
    time.sleep(0.5)


def clear_path_attributes(path: Path) -> None:
    run_command(["xattr", "-cr", str(path)])
    run_command(["chmod", "-R", "u+w", str(path)])


def remove_path(path: Path) -> None:
    if not path.exists():
        return

    clear_path_attributes(path)
    shutil.rmtree(path)


def remove_path_via_finder(path: Path) -> bool:
    if not path.exists():
        return True

    script = f'''
tell application "Finder"
  try
    delete POSIX file "{path}"
    return "ok"
  on error
    return "failed"
  end try
end tell
'''
    result = run_command(["osascript", "-e", script])
    if result.returncode != 0:
        return False

    for _ in range(40):
        if not path.exists():
            return True
        time.sleep(0.25)

    return not path.exists()


def move_path(src: Path, dst: Path) -> None:
    if dst.exists():
        remove_path(dst)
    src.rename(dst)


def copy_app_bundle(source: Path, destination: Path) -> None:
    tmp_root = Path(tempfile.mkdtemp(prefix="opencow-app-sync-"))
    staging_destination = tmp_root / destination.name
    backup_destination = destination.with_name(f"{destination.name}.sync-backup")
    remove_path(backup_destination)
    shutil.copytree(source, staging_destination, symlinks=True)

    if destination.exists():
        try:
            remove_path(destination)
        except PermissionError:
            close_existing_desktop_app()
            try:
                remove_path(destination)
            except PermissionError:
                if not remove_path_via_finder(destination):
                    move_path(destination, backup_destination)

    move_path(staging_destination, destination)
    remove_path(backup_destination)
    remove_path(tmp_root)


def refresh_finder_metadata(app_path: Path) -> None:
    subprocess.run(["xattr", "-cr", str(app_path)], check=False)
    subprocess.run(["touch", str(app_path)], check=False)


def main() -> None:
    close_existing_desktop_app()
    subprocess.run(DESKTOP_BUILD_CMD, cwd=ROOT, check=True)
    subprocess.run(DESKTOP_TAURI_BUILD_CMD, cwd=ROOT / "apps" / "desktop", check=True)
    if not DESKTOP_BUNDLE.exists():
        raise SystemExit(f"missing desktop bundle: {DESKTOP_BUNDLE}")

    copy_app_bundle(DESKTOP_BUNDLE, DESKTOP_TARGET)
    refresh_finder_metadata(DESKTOP_TARGET)
    print(f"synced {DESKTOP_TARGET}")


if __name__ == "__main__":
    main()
