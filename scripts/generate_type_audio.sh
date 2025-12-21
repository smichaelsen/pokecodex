#!/usr/bin/env bash
set -euo pipefail

# Generate German TTS audio for Pokemon types using Piper.
# Uses name/tts from data/types.yml and writes to public/audio/de/types/{type}.mp3.
# Existing files are left untouched unless --force is provided.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_FILE="$ROOT/data/types.yml"
OUT_DIR="$ROOT/public/audio/de/types"
CACHE_DIR="$ROOT/.cache/piper"
PIPER_DIR="$CACHE_DIR/piper"
MODEL_DIR="$CACHE_DIR/models"
MODEL_NAME="de_DE-thorsten-high"
MODEL_BASE_URL="https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/high"
MODEL_FILE="$MODEL_DIR/${MODEL_NAME}.onnx"
MODEL_JSON="$MODEL_DIR/${MODEL_NAME}.onnx.json"
PIPER_URL="https://github.com/rhasspy/piper/releases/latest/download/piper_linux_x86_64.tar.gz"

FORCE=0
if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
fi

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

strip_quotes() {
  local value="$1"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
}

find_piper_bin() {
  find "$PIPER_DIR" -type f -name piper -perm -111 2>/dev/null | head -n 1
}

ensure_piper() {
  local bin
  bin="$(find_piper_bin)"
  if [[ -n "$bin" ]]; then
    echo "$bin"
    return
  fi

  mkdir -p "$CACHE_DIR"
  local archive="$CACHE_DIR/piper.tar.gz"
  echo "Downloading Piper..."
  curl -fL "$PIPER_URL" -o "$archive"
  rm -rf "$PIPER_DIR"
  mkdir -p "$PIPER_DIR"
  tar -xzf "$archive" -C "$PIPER_DIR"

  bin="$(find_piper_bin)"
  if [[ -n "$bin" ]]; then
    echo "$bin"
    return
  fi

  echo "Failed to locate Piper binary after extraction." >&2
  exit 1
}

ensure_model() {
  mkdir -p "$MODEL_DIR"
  if [[ ! -f "$MODEL_FILE" ]]; then
    echo "Downloading model $MODEL_NAME..."
    curl -fL "$MODEL_BASE_URL/${MODEL_NAME}.onnx" -o "$MODEL_FILE"
  fi
  if [[ ! -f "$MODEL_JSON" ]]; then
    curl -fL "$MODEL_BASE_URL/${MODEL_NAME}.onnx.json" -o "$MODEL_JSON"
  fi
}

require_cmd curl
require_cmd tar
require_cmd ffmpeg

PIPER_BIN="$(ensure_piper)"
ensure_model

export LD_LIBRARY_PATH="$(dirname "$PIPER_BIN")${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

mkdir -p "$OUT_DIR"

downloaded=0
skipped=0
failed=0

current_name=""
current_tts=""

flush_type() {
  local name="$1"
  local tts="$2"
  if [[ -z "${name:-}" ]]; then
    return
  fi
  local spoken="${tts:-$name}"
  if [[ -z "${spoken:-}" ]]; then
    ((failed++)) || true
    return
  fi
  local dest="$OUT_DIR/${name}.mp3"
  if [[ -f "$dest" && "$FORCE" -ne 1 ]]; then
    echo "Skip type $name (audio exists: $dest)"
    ((skipped++)) || true
    return
  fi
  local safe_name
  safe_name="$(printf '%s' "$name" | tr ' /' '__')"
  local tmp_wav
  tmp_wav="$(mktemp "$CACHE_DIR/tts-type-${safe_name}-XXXX.wav")"
  echo "Generate $dest"
  if printf '%s' "$spoken" | "$PIPER_BIN" --model "$MODEL_FILE" --output_file "$tmp_wav" --quiet; then
    if ffmpeg -y -i "$tmp_wav" -ar 44100 -ac 2 "$dest" >/dev/null 2>&1; then
      ((downloaded++)) || true
    else
      echo "Failed to convert $tmp_wav to $dest"
      ((failed++)) || true
    fi
  else
    echo "Failed to generate audio for type $name"
    ((failed++)) || true
  fi
  rm -f "$tmp_wav"
}

while IFS= read -r line; do
  [[ -z "${line// }" ]] && continue
  if [[ "$line" =~ ^-?[[:space:]]*name:[[:space:]]*(.*)$ ]]; then
    flush_type "$current_name" "$current_tts"
    current_name="$(strip_quotes "${BASH_REMATCH[1]}")"
    current_tts=""
    continue
  fi
  if [[ "$line" =~ ^[[:space:]]*tts:[[:space:]]*(.*)$ ]]; then
    current_tts="$(strip_quotes "${BASH_REMATCH[1]}")"
  fi
done < "$DATA_FILE"

flush_type "$current_name" "$current_tts"

echo "Done. generated=$downloaded skipped=$skipped failed=$failed"
