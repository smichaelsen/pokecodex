#!/usr/bin/env bash
set -euo pipefail

# Generate German TTS audio for Pokemon descriptions using Piper.
# Uses IDs and entry.de from YAML files and writes to public/audio/de/descriptions/{id}.mp3.
# Existing files are left untouched unless --force is provided.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$ROOT/data/pokemon"
OUT_DIR="$ROOT/public/audio/de/descriptions"
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

get_block_de_value() {
  local file="$1"
  local block="$2"
  awk -v block="$block" '
    $0 ~ "^" block ":" { in_block=1; next }
    in_block && $0 ~ "^[^ ]" { in_block=0 }
    in_block && $0 ~ "^[ ]+de:" {
      sub(/^[ ]+de:[ ]*/, "", $0)
      print $0
      exit
    }
  ' "$file"
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

generated=0
skipped=0
failed=0

for file in "$DATA_DIR"/*.yml; do
  [[ -e "$file" ]] || continue
  id_line="$(awk -F': ' '/^id:/{print $2; exit}' "$file")"
  if [[ -z "${id_line:-}" ]]; then
    echo "Skip $file (no id found)"
    ((failed++)) || true
    continue
  fi

  entry_de="$(get_block_de_value "$file" "entry")"
  entry_de="$(strip_quotes "${entry_de:-}")"
  if [[ -z "${entry_de:-}" ]]; then
    echo "Skip $file (no entry.de found)"
    ((failed++)) || true
    continue
  fi

  dest="$OUT_DIR/${id_line}.mp3"
  if [[ -f "$dest" && "$FORCE" -ne 1 ]]; then
    ((skipped++)) || true
    continue
  fi

  tmp_wav="$(mktemp "$CACHE_DIR/tts-desc-${id_line}-XXXX.wav")"
  echo "Generate $dest"
  if printf '%s' "$entry_de" | "$PIPER_BIN" --model "$MODEL_FILE" --output_file "$tmp_wav" --quiet; then
    if ffmpeg -y -i "$tmp_wav" -ar 44100 -ac 2 "$dest" >/dev/null 2>&1; then
      ((generated++)) || true
    else
      echo "Failed to convert $tmp_wav to $dest"
      ((failed++)) || true
    fi
  else
    echo "Failed to generate audio for $file"
    ((failed++)) || true
  fi
  rm -f "$tmp_wav"
done

echo "Generate description audio done. generated=$generated skipped=$skipped failed=$failed"
