#!/usr/bin/env bash
set -euo pipefail

# Download missing Pokemon cries from the PokeAPI cries repository.
# Uses IDs from YAML files under data/pokemon and writes to public/audio/chimes/{id}.ogg.
# Existing files are left untouched.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$ROOT/data/pokemon"
OUT_DIR="$ROOT/public/audio/chimes"
BASE_URL="https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest"

mkdir -p "$OUT_DIR"

downloaded=0
skipped=0
failed=0

for file in "$DATA_DIR"/*.yml; do
  [[ -e "$file" ]] || continue
  id_line="$(grep -m1 '^id:' "$file" | awk '{print $2}')"
  if [[ -z "${id_line:-}" ]]; then
    echo "Skip $file (no id found)"
    ((failed++)) || true
    continue
  fi

  dest="$OUT_DIR/$id_line.ogg"

  if [[ -f "$dest" ]]; then
    echo "Skip $file (chime exists: $dest)"
    ((skipped++)) || true
    continue
  fi

  url="$BASE_URL/${id_line}.ogg"
  echo "Fetch $url -> $dest"
  if curl -fL "$url" -o "$dest"; then
    ((downloaded++)) || true
  else
    echo "Failed to download $url"
    rm -f "$dest"
    ((failed++)) || true
  fi
done

echo "Done. downloaded=$downloaded skipped=$skipped failed=$failed"
