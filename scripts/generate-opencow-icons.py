#!/usr/bin/env python3

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path("/Users/apple/Desktop/2026/opencow")
ICON_ROOT = ROOT / "assets" / "brand" / "opencow-icons"
MASTER_DIR = ICON_ROOT / "master"
EXPORT_DIR = ICON_ROOT / "exports"
ICONSET_DIR = EXPORT_DIR / "opencow.iconset"
WEB_ICONSET_DIR = EXPORT_DIR / "opencow-web.iconset"
TAURI_ICON_DIR = ROOT / "apps" / "desktop" / "src-tauri" / "icons"
DESKTOP_APP = Path("/Users/apple/Desktop/OpenCow桌面端.app")
WEB_APP = Path("/Users/apple/Desktop/OpenCow网页端.app")
LATEST_TEST_APP = Path("/Users/apple/Desktop/opencow最新测试版.app")

MASTER_PATH = MASTER_DIR / "opencow-cow-o-master.png"
PNG_PATH = EXPORT_DIR / "icon.png"
ICO_PATH = EXPORT_DIR / "icon.ico"
ICNS_PATH = EXPORT_DIR / "icon.icns"
WEB_ICNS_PATH = EXPORT_DIR / "web-launcher.icns"


def ensure_dirs() -> None:
    for directory in (MASTER_DIR, EXPORT_DIR, TAURI_ICON_DIR):
        directory.mkdir(parents=True, exist_ok=True)


def draw_master_icon(size: int = 1024) -> Image.Image:
    image = Image.new("RGBA", (size, size), (245, 239, 231, 255))
    draw = ImageDraw.Draw(image)

    dark = "#2F241C"
    brown = "#8F5E40"
    spot = "#5B4030"

    pad = int(size * 0.11)
    radius = int(size * 0.22)
    draw.rounded_rectangle((pad, pad, size - pad, size - pad), radius=radius, fill="#FBF6EF", outline=dark, width=int(size * 0.03))

    horn_w = int(size * 0.12)
    horn_h = int(size * 0.11)
    left_horn = [
        (int(size * 0.28), int(size * 0.15)),
        (int(size * 0.28) + horn_w // 2, int(size * 0.15) - horn_h),
        (int(size * 0.28) + horn_w, int(size * 0.15) + horn_h // 2),
    ]
    right_horn = [
        (int(size * 0.72), int(size * 0.15)),
        (int(size * 0.72) - horn_w // 2, int(size * 0.15) - horn_h),
        (int(size * 0.72) - horn_w, int(size * 0.15) + horn_h // 2),
    ]
    draw.polygon(left_horn, fill=brown)
    draw.polygon(right_horn, fill=brown)

    ear_w = int(size * 0.13)
    ear_h = int(size * 0.16)
    draw.rounded_rectangle((int(size * 0.17), int(size * 0.23), int(size * 0.17) + ear_w, int(size * 0.23) + ear_h), radius=int(size * 0.03), fill="#604433")
    draw.rounded_rectangle((int(size * 0.70), int(size * 0.23), int(size * 0.70) + ear_w, int(size * 0.23) + ear_h), radius=int(size * 0.03), fill="#604433")

    ring_left = int(size * 0.26)
    ring_top = int(size * 0.28)
    ring_right = int(size * 0.74)
    ring_bottom = int(size * 0.76)
    draw.ellipse((ring_left, ring_top, ring_right, ring_bottom), outline=dark, width=int(size * 0.08))

    draw.ellipse((int(size * 0.39), int(size * 0.45), int(size * 0.44), int(size * 0.50)), fill=dark)
    draw.ellipse((int(size * 0.56), int(size * 0.45), int(size * 0.61), int(size * 0.50)), fill=dark)

    muzzle = (int(size * 0.40), int(size * 0.59), int(size * 0.60), int(size * 0.69))
    draw.rounded_rectangle(muzzle, radius=int(size * 0.05), fill="#EFC8B5")
    draw.ellipse((int(size * 0.45), int(size * 0.62), int(size * 0.48), int(size * 0.65)), fill="#6D4A37")
    draw.ellipse((int(size * 0.52), int(size * 0.62), int(size * 0.55), int(size * 0.65)), fill="#6D4A37")
    draw.rounded_rectangle((int(size * 0.485), int(size * 0.66), int(size * 0.515), int(size * 0.685)), radius=int(size * 0.01), fill=dark)

    draw.ellipse((int(size * 0.34), int(size * 0.36), int(size * 0.43), int(size * 0.44)), fill=spot)
    draw.ellipse((int(size * 0.59), int(size * 0.60), int(size * 0.66), int(size * 0.67)), fill=spot)

    return image


def save_master() -> None:
    image = draw_master_icon()
    image.save(MASTER_PATH)
    image.resize((512, 512), Image.LANCZOS).save(PNG_PATH)
    image.save(ICO_PATH, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


def prepare_iconset(base_path: Path, iconset_path: Path) -> None:
    if iconset_path.exists():
        shutil.rmtree(iconset_path)
    iconset_path.mkdir(parents=True, exist_ok=True)

    source = Image.open(base_path).convert("RGBA")
    sizes = {
        "icon_16x16.png": 16,
        "icon_16x16@2x.png": 32,
        "icon_32x32.png": 32,
        "icon_32x32@2x.png": 64,
        "icon_128x128.png": 128,
        "icon_128x128@2x.png": 256,
        "icon_256x256.png": 256,
        "icon_256x256@2x.png": 512,
        "icon_512x512.png": 512,
        "icon_512x512@2x.png": 1024,
    }

    for name, size in sizes.items():
      source.resize((size, size), Image.LANCZOS).save(iconset_path / name)


def build_icns(iconset_path: Path, output_path: Path) -> None:
    subprocess.run(["iconutil", "-c", "icns", str(iconset_path), "-o", str(output_path)], check=True)


def sync_outputs() -> None:
    shutil.copy2(PNG_PATH, TAURI_ICON_DIR / "icon.png")
    shutil.copy2(ICO_PATH, TAURI_ICON_DIR / "icon.ico")
    shutil.copy2(ICNS_PATH, TAURI_ICON_DIR / "icon.icns")

    desktop_icns_target = DESKTOP_APP / "Contents" / "Resources" / "icon.icns"
    desktop_icns_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ICNS_PATH, desktop_icns_target)

    info_plist = DESKTOP_APP / "Contents" / "Info.plist"
    if info_plist.exists():
        subprocess.run(["/usr/libexec/PlistBuddy", "-c", "Set :CFBundleIconFile icon.icns", str(info_plist)], check=False)
        subprocess.run(["/usr/libexec/PlistBuddy", "-c", "Set :CFBundleIconName icon", str(info_plist)], check=False)
        subprocess.run(["/usr/libexec/PlistBuddy", "-c", "Add :CFBundleIconFile string icon.icns", str(info_plist)], check=False)
        subprocess.run(["/usr/libexec/PlistBuddy", "-c", "Add :CFBundleIconName string icon", str(info_plist)], check=False)

    web_icns_target = WEB_APP / "Contents" / "Resources" / "applet.icns"
    if web_icns_target.exists():
        shutil.copy2(WEB_ICNS_PATH, web_icns_target)

    latest_test_icns_target = LATEST_TEST_APP / "Contents" / "Resources" / "applet.icns"
    if latest_test_icns_target.exists():
        shutil.copy2(ICNS_PATH, latest_test_icns_target)


def main() -> None:
    ensure_dirs()
    save_master()
    prepare_iconset(MASTER_PATH, ICONSET_DIR)
    prepare_iconset(MASTER_PATH, WEB_ICONSET_DIR)
    build_icns(ICONSET_DIR, ICNS_PATH)
    build_icns(WEB_ICONSET_DIR, WEB_ICNS_PATH)
    sync_outputs()
    print(f"Generated icons under {EXPORT_DIR}")


if __name__ == "__main__":
    main()
