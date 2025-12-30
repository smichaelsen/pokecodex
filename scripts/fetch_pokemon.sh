#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <pokedex-number>"
  exit 1
fi

ID="$1"
BASE="https://pokeapi.co/api/v2"

fetch_json() {
  curl -s "$1"
}

species_json=$(fetch_json "$BASE/pokemon-species/$ID")
pokemon_json=$(fetch_json "$BASE/pokemon/$ID")
evo_chain_url=$(jq -r '.evolution_chain.url' <<< "$species_json")
evo_json=$(fetch_json "$evo_chain_url")

name_de=$(jq -r '.names[] | select(.language.name=="de") | .name' <<< "$species_json" | head -n1)
name_de=${name_de:-"(unnamed)"}
name_en=$(jq -r '.names[] | select(.language.name=="en") | .name' <<< "$species_json" | head -n1)
name_en=${name_en:-"(unnamed)"}

types=$(jq -r '.types | map(.type.name) | join(", ")' <<< "$pokemon_json")
height_m=$(jq -r '.height / 10' <<< "$pokemon_json")
weight_kg=$(jq -r '.weight / 10' <<< "$pokemon_json")
moves_list=$(jq -r '
  [.moves[].move.name]
  | sort
  | unique
  | map("  - " + .)
  | join("\n")
' <<< "$pokemon_json")

preferred_flavor_text=$(jq -r '
  def entry_text: (.flavor_text // "kein Text verfügbar") | gsub("\n"; " ");
  def best_in(stream):
    [stream] | .[0];
  def best_de_with(version):
    best_in(.flavor_text_entries[]
      | select(.language.name == "de" and .version.name == version)
      | entry_text);
  def best_de_any:
    best_in(.flavor_text_entries[]
      | select(.language.name == "de")
      | entry_text);
  best_de_with("shield")
  // best_de_with("sword")
  // best_de_any
  // (.flavor_text_entries[0]? | entry_text)
  // "kein Text verfügbar"
' <<< "$species_json")

evolution_chain=$(jq -r '
  def capture_id:
    (capture("(?<id>[0-9]+)/?$") | .id);
  def detail:
    "trigger=\(.trigger.name // "none") min_level=\(if .min_level == null then "none" else .min_level end) item=\(.item.name // "none") trade_species=\(.trade_species.name // "none")";
  def details:
    (.evolution_details
    | if length == 0 then ["none"] else map(detail) end)
    | join("; ");
  def evolves_to_ids:
    (.evolves_to // []) | map(.species.url | capture_id) | join(", ");
  def id_from_url:
    (.species.url | capture_id);
  def format_node:
    "  - species_id: \(id_from_url)\n    evolves_to: [\(evolves_to_ids)]\n    details: \(details)";
  def nodes:
    .chain
    | .. | select(.species? != null);
  reduce nodes as $node ({}; .[$node.species.url] = $node)
  | [.[]]
  | map(format_node)
  | .[]
' <<< "$evo_json")

cat <<EOF
# Snapshot for Pokédex #$ID
id: $ID
name_de: "$name_de"
name_en: "$name_en"
types: [$types]
height_m: $height_m
weight_kg: $weight_kg
flavor_text: "$preferred_flavor_text"
moves:
$moves_list
evolution_chain:
$evolution_chain
EOF
