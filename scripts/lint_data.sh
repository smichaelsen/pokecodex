#!/usr/bin/env bash
set -euo pipefail

node "$(dirname "$0")/lint_types_yaml.js"
node "$(dirname "$0")/lint_moves_yaml.js"
node "$(dirname "$0")/lint_pokemon_yaml.js"
