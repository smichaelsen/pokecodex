#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bash "$ROOT/scripts/lint_data.sh"

bash "$ROOT/scripts/fetch_sprites.sh"
bash "$ROOT/scripts/fetch_chimes.sh"
bash "$ROOT/scripts/generate_name_audio.sh"
bash "$ROOT/scripts/generate_description_audio.sh"
bash "$ROOT/scripts/generate_move_audio.sh"
bash "$ROOT/scripts/generate_type_audio.sh"

node "$ROOT/scripts/build.js"
