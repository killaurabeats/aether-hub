"""Headless DMG layout for Aether Hub (no Finder automation required).

Usage:
  dmgbuild -s tools/dmg_settings.py "Aether Hub" \
    "src-tauri/target/release/bundle/dmg/Aether Hub_1.1.0_aarch64.dmg"
"""
import os

root = os.environ.get("AETHER_ROOT", os.getcwd())
app_path = os.path.join(root, "src-tauri/target/release/bundle/macos/Aether Hub.app")

files = [app_path]
symlinks = {"Applications": "/Applications"}
background = os.path.join(root, "src-tauri/dmg/background.png")

window_rect = ((90, 90), (660, 420))
default_view = "icon-view"
icon_size = 128
text_size = 12

icon_locations = {
    "Aether Hub.app": (180, 195),
    "Applications": (480, 195),
}

format = "UDZO"
filesystem = "HFS+"
