#!/usr/bin/env bash
# =============================================================================
#  Aether Hub - universal plugin deploy
#
#  Usage:
#    deploy-plugin.sh <plugin-dir> <version> <free|pro|beta> [options]
#
#  Options:
#    --slug <slug>              defaults to the kebab-case folder name
#    --title <title>            defaults to the folder name
#    --product-tag <TAG>        defaults to AETHER-<SLUG-UPPER>
#    --cover <image>            cover JPG/PNG (auto-detected otherwise)
#    --windows-zip <file>       Windows VST3 ZIP to upload
#    --windows-url <url>        already-hosted Windows ZIP (metadata only)
#    --description-ru <text>
#    --description-en <text>
#    --featured                 pin on the home page
#    --dry-run                  print the publish payload without uploading
#
#  Release descriptions must follow docs/RELEASE_DESCRIPTIONS.md:
#  two short, musician-friendly sentences, no implementation details, library
#  names, formats/platforms or changelog lists; only the short hyphen "-".
#
#  Credentials are read from the hub .env (or the current environment):
#    VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_AETHER_ADMIN_TOKEN
#
#  It packages the latest macOS VST3/AU (and Windows VST3 when present),
#  uploads everything to the aether-assets bucket through a signed upload URL,
#  and upserts the release row through the aether-admin Edge Function.
# =============================================================================
set -euo pipefail

usage() {
  sed -n '2,29p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

if [[ $# -lt 3 || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage 0
fi

PLUGIN_DIR="$1"
VERSION="$2"
TIER="$(echo "$3" | tr '[:upper:]' '[:lower:]')"
shift 3

case "$TIER" in
  free|pro|beta) ;;
  *) echo "✗ tier must be free, pro or beta (got: $TIER)" >&2; exit 1 ;;
esac

SLUG=""
TITLE=""
PRODUCT_TAG=""
COVER=""
WINDOWS_ZIP=""
WINDOWS_URL=""
DESCRIPTION_RU=""
DESCRIPTION_EN=""
FEATURED="false"
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slug) SLUG="${2:-}"; shift 2 ;;
    --title) TITLE="${2:-}"; shift 2 ;;
    --product-tag) PRODUCT_TAG="${2:-}"; shift 2 ;;
    --cover) COVER="${2:-}"; shift 2 ;;
    --windows-zip) WINDOWS_ZIP="${2:-}"; shift 2 ;;
    --windows-url) WINDOWS_URL="${2:-}"; shift 2 ;;
    --description-ru) DESCRIPTION_RU="${2:-}"; shift 2 ;;
    --description-en) DESCRIPTION_EN="${2:-}"; shift 2 ;;
    --featured) FEATURED="true"; shift ;;
    --dry-run) DRY_RUN="true"; shift ;;
    *) echo "✗ unknown option: $1" >&2; usage 1 ;;
  esac
done

PLUGIN_DIR="$(cd "$PLUGIN_DIR" && pwd)"
FOLDER="$(basename "$PLUGIN_DIR")"

if [[ -z "$SLUG" ]]; then
  SLUG="$(echo "$FOLDER" | sed -E 's/([a-z0-9])([A-Z])/\1-\2/g' | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9-' '-' | sed 's/^-//;s/-$//')"
fi
[[ -z "$TITLE" ]] && TITLE="$FOLDER"
if [[ -z "$PRODUCT_TAG" ]]; then
  TAG_BASE="$(echo "$SLUG" | sed 's/^aether-//')"
  PRODUCT_TAG="AETHER-$(echo "$TAG_BASE" | tr '[:lower:]-' '[:upper:]_')"
fi

# ---------------------------------------------------------------- hub & env ---
find_hub_root() {
  if [[ -n "${AETHER_HUB_ROOT:-}" && -f "$AETHER_HUB_ROOT/.env" ]]; then
    echo "$AETHER_HUB_ROOT"; return
  fi
  if [[ -f "$PWD/.env" && -f "$PWD/src-tauri/tauri.conf.json" ]]; then
    echo "$PWD"; return
  fi
  local guess="$HOME/Desktop/OpenCode Project/Aether Hub v1.1"
  if [[ -f "$guess/.env" ]]; then echo "$guess"; return; fi
  echo ""
}

HUB_ROOT="$(find_hub_root)"
if [[ -n "$HUB_ROOT" && -f "$HUB_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$HUB_ROOT/.env"
  set +a
fi

SUPABASE_URL="${VITE_SUPABASE_URL:-${SUPABASE_URL:-}}"
ANON_KEY="${VITE_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-}}"
ADMIN_TOKEN="${VITE_AETHER_ADMIN_TOKEN:-${AETHER_ADMIN_TOKEN:-}}"

if [[ "$DRY_RUN" != "true" ]]; then
  if [[ -z "$SUPABASE_URL" || -z "$ANON_KEY" || -z "$ADMIN_TOKEN" ]]; then
    echo "✗ Missing Supabase credentials." >&2
    echo "  Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_AETHER_ADMIN_TOKEN in the hub .env." >&2
    exit 1
  fi
  SUPABASE_URL="${SUPABASE_URL%/}"
fi

for tool in curl jq shasum; do
  command -v "$tool" >/dev/null 2>&1 || { echo "✗ required tool missing: $tool" >&2; exit 1; }
done

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/aether-deploy.XXXXXX")"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

# ------------------------------------------------------------- macOS build ---
find_macos_zip() {
  local found=""
  if [[ -d "$PLUGIN_DIR/dist" ]]; then
    found="$(find "$PLUGIN_DIR/dist" -maxdepth 2 -type f \( -iname '*mac*.zip' -o -iname '*osx*.zip' -o -iname '*universal*.zip' \) | head -1)"
  fi
  if [[ -z "$found" ]]; then
    found="$(find "$PLUGIN_DIR" -maxdepth 2 -type f -iname '*.zip' 2>/dev/null | grep -Ei 'mac|osx|universal' | head -1 || true)"
  fi
  echo "$found"
}

package_macos_from_build() {
  local stage="$TMP_DIR/macos-stage"
  mkdir -p "$stage"
  local count=0
  while IFS= read -r bundle; do
    [[ -z "$bundle" ]] && continue
    cp -R "$bundle" "$stage/"
    count=$((count + 1))
  done < <(find "$PLUGIN_DIR" \
      \( -path '*/dist/*' -o -path '*/third_party/*' -o -path '*/.git/*' \) -prune -o \
      -maxdepth 6 -type d \( -iname '*.vst3' -o -iname '*.component' \) -print 2>/dev/null | \
      grep -Ei 'build-release|Release|build' | head -4)

  if [[ "$count" -eq 0 ]]; then
    echo ""
    return
  fi

  # Ad-hoc sign so the bundles open without a broken-signature prompt.
  if command -v codesign >/dev/null 2>&1; then
    find "$stage" -maxdepth 1 -type d \( -iname '*.vst3' -o -iname '*.component' \) -exec codesign --force --deep --timestamp=none -s - {} \; 2>/dev/null || true
  fi

  for manual in MANUAL_EN.txt MANUAL_RU.txt; do
    [[ -f "$PLUGIN_DIR/$manual" ]] && cp "$PLUGIN_DIR/$manual" "$stage/"
  done

  local out="$TMP_DIR/${SLUG}-macos-${VERSION}.zip"
  ditto -c -k --norsrc "$stage" "$out"
  echo "$out"
}

MAC_ZIP="$(find_macos_zip)"
if [[ -z "$MAC_ZIP" || ! -f "$MAC_ZIP" ]]; then
  echo "▸ No macOS ZIP in dist/ - packaging from build artefacts…"
  MAC_ZIP="$(package_macos_from_build)"
fi
if [[ -z "$MAC_ZIP" || ! -f "$MAC_ZIP" ]]; then
  echo "✗ No macOS build found. Run the plugin's macOS build first (VST3 + AU)." >&2
  exit 1
fi

# ------------------------------------------------------------ Windows build ---
if [[ -z "$WINDOWS_ZIP" && -d "$PLUGIN_DIR/dist" ]]; then
  WINDOWS_ZIP="$(find "$PLUGIN_DIR/dist" -maxdepth 2 -type f -iname '*.zip' | grep -Ei 'win|windows' | head -1 || true)"
fi

if [[ -z "$WINDOWS_ZIP" && -z "$WINDOWS_URL" ]]; then
  echo "▸ Windows VST3 is not built locally. Publishing macOS now, Windows metadata can be"
  echo "  attached later with: --windows-zip <file> or --windows-url <url>."
fi

# ------------------------------------------------------------------- cover ---
if [[ -z "$COVER" ]]; then
  for candidate in \
    "${HUB_ROOT:+$HUB_ROOT/public/covers/$SLUG-beta.jpg}" \
    "${HUB_ROOT:+$HUB_ROOT/public/covers/$SLUG.jpg}" \
    "$PLUGIN_DIR/hub/$SLUG.jpg" \
    "$PLUGIN_DIR/hub/$SLUG-beta.jpg" \
    "$PLUGIN_DIR/preview_large.png" \
    "$PLUGIN_DIR/preview.png"; do
    [[ -n "$candidate" && -f "$candidate" ]] && { COVER="$candidate"; break; }
  done
fi

if [[ -z "$DESCRIPTION_RU" ]]; then
  DESCRIPTION_RU="$TITLE $VERSION - плагин Aether Plugins. Установка в один клик, VST3/AU, автоматическая лицензия."
fi
if [[ -z "$DESCRIPTION_EN" ]]; then
  DESCRIPTION_EN="$TITLE $VERSION by Aether Plugins. One-click install, VST3/AU, automatic licence."
fi

BADGE="NEW"
[[ "$TIER" == "beta" ]] && BADGE="EARLY ACCESS"

# --------------------------------------------------------------- uploading ---
sign_upload() {
  local bucket="$1" path="$2"
  local body
  body="$(jq -n --arg token "$ADMIN_TOKEN" --arg bucket "$bucket" --arg path "$path" \
    '{token:$token,action:"sign_upload",payload:{bucket:$bucket,path:$path}}')"

  local response
  response="$(curl -sS -X POST "$SUPABASE_URL/functions/v1/aether-admin" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    --data "$body")"

  local signed public
  signed="$(jq -r '.signedUrl // empty' <<<"$response")"
  public="$(jq -r '.publicUrl // empty' <<<"$response")"
  if [[ -z "$signed" || -z "$public" ]]; then
    echo "✗ Could not sign upload for $path: $response" >&2
    exit 1
  fi

  local file="$3" content_type="$4"
  local http
  http="$(curl -sS -o /dev/null -w '%{http_code}' -X PUT "$signed" \
    -H "Content-Type: $content_type" \
    -H "x-upsert: true" \
    --data-binary "@$file")"
  if [[ "$http" != "200" && "$http" != "201" ]]; then
    echo "✗ Upload failed for $path (HTTP $http)" >&2
    exit 1
  fi
  echo "$public"
}

upload_file() {
  local bucket="$1" remote_path="$2" file="$3" content_type="$4"
  echo "  ↑ $remote_path ($(du -h "$file" | cut -f1))" >&2
  sign_upload "$bucket" "$remote_path" "$file" "$content_type"
}

MAC_NAME="$(basename "$MAC_ZIP")"
MAC_SIZE="$(stat -f%z "$MAC_ZIP" 2>/dev/null || stat -c%s "$MAC_ZIP")"
MAC_SHA="$(shasum -a 256 "$MAC_ZIP" | awk '{print $1}')"

FILES="{}"
MAC_URL=""
WIN_URL="$WINDOWS_URL"
WIN_SIZE=0
WIN_NAME=""

if [[ "$DRY_RUN" != "true" ]]; then
  echo "▸ Uploading macOS build…"
  MAC_URL="$(upload_file "aether-assets" "releases/${SLUG}/${SLUG}-macos-${VERSION}.zip" "$MAC_ZIP" "application/zip")"
  if [[ -n "$WINDOWS_ZIP" ]]; then
    WIN_NAME="$(basename "$WINDOWS_ZIP")"
    WIN_SIZE="$(stat -f%z "$WINDOWS_ZIP" 2>/dev/null || stat -c%s "$WINDOWS_ZIP")"
    echo "▸ Uploading Windows build…"
    WIN_URL="$(upload_file "aether-assets" "releases/${SLUG}/${SLUG}-windows-${VERSION}.zip" "$WINDOWS_ZIP" "application/zip")"
  fi
  if [[ -n "$COVER" && -f "$COVER" ]]; then
    echo "▸ Uploading cover…"
    COVER_EXT="${COVER##*.}"
    COVER_EXT="$(echo "$COVER_EXT" | tr '[:upper:]' '[:lower:]')"
    COVER_TYPE="image/jpeg"
    [[ "$COVER_EXT" == "png" ]] && COVER_TYPE="image/png"
    COVER_URL="$(upload_file "aether-assets" "covers/${SLUG}/${SLUG}-${VERSION}.${COVER_EXT}" "$COVER" "$COVER_TYPE")"
  fi
else
  MAC_URL="https://example.invalid/${SLUG}-macos-${VERSION}.zip"
  COVER_URL="${COVER:+file://$COVER}"
  [[ -n "$WINDOWS_ZIP" ]] && WIN_URL="https://example.invalid/${SLUG}-windows-${VERSION}.zip"
fi

FILES="$(jq -n \
  --arg macUrl "$MAC_URL" --argjson macSize "$MAC_SIZE" --arg macName "$MAC_NAME" \
  '{macos:{url:$macUrl,sizeBytes:$macSize,filename:$macName}}')"

if [[ -n "$WIN_URL" ]]; then
  FILES="$(jq -n --argjson current "$FILES" \
    --arg url "$WIN_URL" --argjson size "$WIN_SIZE" --arg name "${WIN_NAME:-${SLUG}-windows-${VERSION}.zip}" \
    '$current + {windows:{url:$url,sizeBytes:$size,filename:$name}}')"
fi

RELEASE_PAYLOAD="$(jq -n \
  --arg slug "$SLUG" \
  --arg title "$TITLE" \
  --arg version "$VERSION" \
  --arg tier "$TIER" \
  --arg productTag "$PRODUCT_TAG" \
  --arg descriptionRu "$DESCRIPTION_RU" \
  --arg descriptionEn "$DESCRIPTION_EN" \
  --arg coverUrl "${COVER_URL:-}" \
  --arg badge "$BADGE" \
  --argjson featured "$FEATURED" \
  --argjson files "$FILES" \
  '{
    slug: $slug,
    category: "plugins",
    title: $title,
    version: $version,
    description: $descriptionEn,
    descriptionRu: $descriptionRu,
    descriptionEn: $descriptionEn,
    coverUrl: (if $coverUrl == "" then null else $coverUrl end),
    files: $files,
    productTag: $productTag,
    tier: $tier,
    featured: $featured,
    badge: $badge,
    previews: []
  }')"

echo ""
echo "▸ Release payload:"
jq . <<<"$RELEASE_PAYLOAD"
echo "▸ SHA256 (macOS): $MAC_SHA"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "✓ Dry run complete - nothing uploaded."
  exit 0
fi

echo "▸ Publishing to Supabase…"
PUBLISH_BODY="$(jq -n --arg token "$ADMIN_TOKEN" --argjson release "$RELEASE_PAYLOAD" \
  '{token:$token,action:"publish",payload:{release:$release}}')"

PUBLISH_RESPONSE="$(curl -sS -X POST "$SUPABASE_URL/functions/v1/aether-admin" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  --data "$PUBLISH_BODY")"

if jq -e '.error' >/dev/null 2>&1 <<<"$PUBLISH_RESPONSE"; then
  echo "✗ Publish failed: $PUBLISH_RESPONSE" >&2
  exit 1
fi

echo "✓ Published $TITLE v$VERSION ($TIER)"
jq -r '[
  "  id: " + (.id // "-"),
  "  slug: " + (.slug // "-"),
  "  tier: " + (.tier // "-"),
  "  mac: " + (.files.macos.url // "-"),
  "  win: " + (.files.windows.url // "-")
] | .[]' <<<"$PUBLISH_RESPONSE"
