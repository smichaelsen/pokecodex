# Pokedex Web App Concept

## Goal
- The web frontend only shows the Pokedex interface (list + details), no admin UI.
- Default sorting is by Kanto index; later sorting (type, alphabet, regions) is optional.
- All content is in German: names, descriptions, types, moves; audio output for names and descriptions.

## Language Policy
- Documentation and development discussions are in English.
- Data content and UI copy remain in German.

## File-Based Content Model
- `data/pokemon/{kanto-number}_{slug}.yml`: Content per Pokemon  
  - `id` (Kanto index), `slug`, `name.de`, `description.de`, `types` (array), `height_m`, `weight_kg`, `abilities` (array with `name.de`/`description.de`), `moves` (array with `name`/`type`/`power`/`accuracy`/`pp`/`description.de`), `evolutions` (list with target number + condition such as level/item/friendship).
  - Evolutions reference Pokedex numbers (not slug/name). The build pipeline resolves numbers to readable names; if a referenced number is missing, the name is shown as "???".
  - Example: `apps/pokedex/data/pokemon/025_pikachu.yml` would reference evolutions by number (evolves from #172, evolves into #26).
  - Optional: `region_forms`, `sprites` (path to images), `audio` (path to pre-rendered audio).
- `data/types.yml`: List of all types with `name.de`, `description.de`, effectiveness (strong/normal/weak) against other types.
- `data/moves.yml`: Shared move reference if moves are reused.
- `public/assets/sprites/`: Official illustrations/sprites, file-based (e.g., `001.png`, `025.png`, `other/official-artwork/XXX.png` if desired). Copied by the build to `dist/assets/sprites/`.
- `public/audio/de/pokemon/{id}.mp3` and `public/audio/de/descriptions/{id}.mp3`: Generated audio files.
- `public/audio/chimes/{id}.mp3`: Optional Pokemon call/chime audio file (downloaded).
- Admin is done by directly editing these files (no backoffice). Changes are versioned.

## Frontend Requirements
- List sorted by Kanto index (default), optional toggles for other sorting/filtering later (type, search, favorites).
- Detail view per Pokemon with name (DE), description (DE), type badges, moves, evolutions (with conditions), sprite/illustration.
- Audio behavior: clicking the illustration plays the call/chime; clicking the name plays the spoken name; clicking the description plays the spoken description.
- If audio is missing, the UI shows a hint or disables buttons.
- Client loads data as static bundles (e.g., pre-rendered JSON files) from `data/`/`public/`.
- Illustration usage:
  - List: small image next to name/types (CSS scaling, path e.g. `assets/sprites/{id}.png`).
  - Detail: large image (max-width 100%), falls back to a placeholder if missing.
- Missing entries: like in the game, non-existent dex entries appear as empty slots (number only) and are not clickable until data exists.
- Type colors: type badges are styled based on `data/types.yml`.

## Audio Generation (German)
- Goal: script-based TTS generation, reproducible and file-based for name and description audio.
- Proposal: `scripts/generate_audio.sh` uses `espeak-ng` (or `piper` if available) without network access.
- Example workflow:
  ```bash
  # Name
  espeak-ng -v de -s 150 -w public/audio/de/pokemon/001.wav "Bisasam"
  # Description
  espeak-ng -v de -s 150 -w public/audio/de/descriptions/001.wav "$(yq '.description.de' data/pokemon/001_bisasam.yml)"
  ffmpeg -i public/audio/de/descriptions/001.wav -ar 44100 -ac 2 public/audio/de/descriptions/001.mp3
  ```
  - `yq` reads the German text; `ffmpeg` compresses to MP3. Alternatively play WAV directly if MP3 is not needed.
  - Script iterates over all Pokemon files, generates missing audio, leaves existing files untouched.
  - Optional hash file (`data/audio_manifest.json`) to only re-render changed texts.
- Chime/call audio is fetched by a separate download script (source online).

## Admin Flow (Filesystem)
- Adjust content: edit YAML files under `data/` (names, descriptions, types, moves).
- New Pokemon: add YAML file, add sprite, run script, verify audio.
- Regenerate audio: `scripts/generate_audio.sh --force` or automatically when text changes.
- Deployment: static assets (`public/`) and data (`data/`) are shipped together; frontend reads only these sources.

## Extensions (Optional)
- Additional regions/sets as separate directories (`data/pokemon_johto/` etc.).
- Localization: additional language folders analogous to `public/audio/de` and `name.de`/`description.de`.
- Performance: precompiled JSON per region for faster load times.
- Accessibility: subtitles for audio, keyboard navigation, high contrast.
