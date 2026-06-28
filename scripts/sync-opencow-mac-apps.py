#!/usr/bin/env python3

from __future__ import annotations

import shutil
import subprocess
import plistlib
import stat
import tempfile
import time
from pathlib import Path


ROOT = Path("/Users/apple/Desktop/2026/opencow")
DESKTOP_BUILD_CMD = ["npm", "--workspace", "apps/desktop", "run", "build"]
DESKTOP_TAURI_BUILD_CMD = ["npm", "run", "tauri:build"]
DESKTOP_BUNDLE = ROOT / "apps" / "desktop" / "src-tauri" / "target" / "release" / "bundle" / "macos" / "opencow.app"
DESKTOP_TARGET = Path("/Users/apple/Desktop/OpenCow桌面端.app")
WEB_TARGET = Path("/Users/apple/Desktop/OpenCow网页端.app")
WEB_ICON_SOURCE = ROOT / "assets" / "brand" / "opencow-icons" / "exports" / "web-launcher.icns"
LATEST_TEST_APP = Path("/Users/apple/Desktop/opencow最新测试版.app")
LATEST_TEST_ICON_SOURCE = ROOT / "assets" / "brand" / "opencow-icons" / "exports" / "icon.icns"
LATEST_TEST_EXECUTABLE_NAME = "opencow-latest-launcher"
LATEST_TEST_LAUNCH_SCRIPT = ROOT / "scripts" / "start-opencow-latest-desktop-mac.command"
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


def update_web_launcher_icon() -> None:
    if not WEB_TARGET.exists() or not WEB_ICON_SOURCE.exists():
        return
    icon_target = WEB_TARGET / "Contents" / "Resources" / "applet.icns"
    shutil.copy2(WEB_ICON_SOURCE, icon_target)


def write_latest_test_launcher_app() -> None:
    contents_dir = LATEST_TEST_APP / "Contents"
    macos_dir = contents_dir / "MacOS"
    resources_dir = contents_dir / "Resources"
    macos_dir.mkdir(parents=True, exist_ok=True)
    resources_dir.mkdir(parents=True, exist_ok=True)

    plist = {
        "CFBundleDevelopmentRegion": "zh_CN",
        "CFBundleDisplayName": "opencow最新测试版",
        "CFBundleExecutable": LATEST_TEST_EXECUTABLE_NAME,
        "CFBundleIconFile": "icon",
        "CFBundleIdentifier": "cn.opencow.latest-test",
        "CFBundleInfoDictionaryVersion": "6.0",
        "CFBundleName": "opencow最新测试版",
        "CFBundlePackageType": "APPL",
        "CFBundleShortVersionString": "0.1.0",
        "CFBundleVersion": "1",
        "LSMinimumSystemVersion": "12.0",
    }
    with (contents_dir / "Info.plist").open("wb") as file:
        plistlib.dump(plist, file, sort_keys=False)
    (contents_dir / "PkgInfo").write_text("APPL????", encoding="ascii")

    executable = macos_dir / LATEST_TEST_EXECUTABLE_NAME
    executable.write_text(
        f"""#!/bin/zsh
set -euo pipefail

LOG_FILE="/tmp/opencow-latest-desktop-launch.log"
LAUNCHER_SCRIPT="{LATEST_TEST_LAUNCH_SCRIPT}"

{{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] handing off latest desktop launch to Terminal"
  /usr/bin/open "${{LAUNCHER_SCRIPT}}"
}} > "${{LOG_FILE}}" 2>&1
""",
        encoding="utf-8",
    )
    executable.chmod(executable.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    LATEST_TEST_LAUNCH_SCRIPT.chmod(
        LATEST_TEST_LAUNCH_SCRIPT.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH
    )

    if LATEST_TEST_ICON_SOURCE.exists():
        shutil.copy2(LATEST_TEST_ICON_SOURCE, resources_dir / "icon.icns")


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
    update_web_launcher_icon()
    write_latest_test_launcher_app()
    refresh_finder_metadata(DESKTOP_TARGET)
    if WEB_TARGET.exists():
        refresh_finder_metadata(WEB_TARGET)
    refresh_finder_metadata(LATEST_TEST_APP)
    print(f"synced {DESKTOP_TARGET}")


if __name__ == "__main__":
    main()
