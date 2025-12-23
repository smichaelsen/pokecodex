#!/usr/bin/env bash
set -euo pipefail

# Download missing official artwork sprites from the PokeAPI sprite repository.
# Uses IDs from YAML files under data/pokemon and writes to public/assets/sprites/{id}.png (3-digit padded).
# Existing files are left untouched.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$ROOT/data/pokemon"
OUT_DIR="$ROOT/public/assets/sprites"
BASE_URL="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork"

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

  printf -v id_padded "%03d" "$id_line"
  dest="$OUT_DIR/$id_padded.png"

  if [[ -f "$dest" ]]; then
    ((skipped++)) || true
    continue
  fi

  url="$BASE_URL/${id_line}.png"
  echo "Fetch $url -> $dest"
  if curl -fL "$url" -o "$dest"; then
    ((downloaded++)) || true
  else
    echo "Failed to download $url"
    rm -f "$dest"
    ((failed++)) || true
  fi
done

echo "Fetch sprites done. downloaded=$downloaded skipped=$skipped failed=$failed"
