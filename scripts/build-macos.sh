#!/usr/bin/env bash
# Builds Aether Hub.app and a styled DMG without requiring Finder automation.
#
#   ./scripts/build-macos.sh
#
# One-time extra tool (optional, prettier DMG):
#   python3 -m pip install --user dmgbuild
#
# Without dmgbuild the script falls back to a plain `hdiutil` image.

set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -d node_modules ]]; then
  npm ci
fi

echo "▸ Building the .app bundle…"
npm run tauri:build -- --bundles app

# Tauri's linker signature does not cover bundle resources; ad-hoc sign the
# complete bundle so `codesign --verify` and Gatekeeper are consistent.
echo "▸ Signing the app bundle (ad-hoc)…"
codesign --force --deep --sign - "src-tauri/target/release/bundle/macos/Aether Hub.app"
codesign --verify --deep --strict "src-tauri/target/release/bundle/macos/Aether Hub.app"

VERSION="$(node -p "require('./package.json').version")"
ARCH="$(uname -m)"
[[ "$ARCH" == "arm64" ]] && ARCH="aarch64"

APP="src-tauri/target/release/bundle/macos/Aether Hub.app"
OUT_DIR="src-tauri/target/release/bundle/dmg"
DMG="$OUT_DIR/Aether Hub_${VERSION}_${ARCH}.dmg"

if [[ ! -d "$APP" ]]; then
  echo "✗ App bundle not found at $APP" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

DMGBUILD="$(command -v dmgbuild || true)"
if [[ -z "$DMGBUILD" && -x "$HOME/Library/Python/3.9/bin/dmgbuild" ]]; then
  DMGBUILD="$HOME/Library/Python/3.9/bin/dmgbuild"
fi

if [[ -n "$DMGBUILD" ]]; then
  echo "▸ Building DMG with dmgbuild…"
  AETHER_ROOT="$PWD" "$DMGBUILD" -s tools/dmg_settings.py "Aether Hub" "$DMG"
else
  echo "▸ dmgbuild not found — using hdiutil fallback"
  STAGE="$(mktemp -d)"
  cp -R "$APP" "$STAGE/"
  ln -s /Applications "$STAGE/Applications"
  hdiutil create -volname "Aether Hub" -srcfolder "$STAGE" -ov -format UDZO "$DMG"
  rm -rf "$STAGE"
fi

echo ""
echo "✓ App: $APP"
echo "✓ DMG: $DMG"
echo "  $(du -sh "$APP" | cut -f1) app · $(du -sh "$DMG" | cut -f1) dmg"
