# Pokedex App

## Location
- Implementation: `public/js/apps/pokedexApp/pokedexApp.js`
- Loaded by dexOS from `public/js/app.js`

## Responsibilities
- Render the Pokedex list and detail views.
- Handle paging, selection, and UI interactions.
- Use dexOS host APIs for data, audio, and menu actions.

## Data Model (File-Based Content)
- `data/pokemon/{kanto-number}_{slug}.yml`: Content per Pokemon
  - `id` (Kanto index), `slug`, `name.de`, `name_tts.de` (optional), `entry.de`,
    `types` (English slugs), `height_m`, `weight_kg`, `evolves_from`,
    `signature_move` (English move slug), `evolutions` (target number + condition).
  - Evolutions reference Pokedex numbers; missing entries show as "???" until present.
  - Example: `apps/pokedex/data/pokemon/025_pikachu.yml`.
  - Optional: `region_forms`, `sprites`, `audio`.
- `data/types.yml`: Type list with `name.de`, `description.de`, and effectiveness.
- `data/moves.yml`: Shared move reference data.
- `public/assets/sprites/`: Official artwork (e.g. `001.png`, `025.png`).
- `public/audio/de/pokemon/{id}.mp3`: Generated name audio files.
- `public/audio/de/descriptions/{id}.mp3`: Generated description audio files.
- `public/audio/chimes/{id}.ogg`: Optional Pokemon call/chime audio files.

## Frontend Requirements
- List sorted by Kanto index (default), optional sorting/filtering later.
- Detail view includes name, description, types, moves, evolutions, sprite.
- Audio: clicking illustration plays the chime; clicking name plays the spoken name;
  clicking description plays the spoken description (preloaded on detail open).
- If audio is missing, the UI shows a hint or disables buttons.
- Client loads data as static bundles (pre-rendered JSON) from `data/`/`public/`.
- Menu button opens an overlay menu on the screen; menu items include emojis.
- Menu item: "Reload data" triggers a fresh data pull (or full page refresh).
- Illustration usage: list uses small images, detail uses large images with fallback.
- Missing entries appear as empty slots (number only) and are not clickable.
- Type badges are styled from `data/types.yml`.

## Audio Generation (German)
- `scripts/generate_name_audio.sh` generates name audio using Piper (offline).
- `scripts/generate_description_audio.sh` generates `entry.de` audio.
- If `name_tts.de` is present, it overrides `name.de` for spoken output.
- Chime audio is downloaded by a separate script.

## Admin Flow (Filesystem)
- Edit YAML under `data/` for names, descriptions, types, and moves.
- Add Pokemon: create YAML, add sprite, run scripts, verify audio.
- Regenerate audio: delete target files and re-run the scripts.
- Deployment ships `public/` and `data/` together.

## Extensions (Optional)
- Additional regions/sets as `data/pokemon_johto/` etc.
- Localization with additional language folders (audio + data).
- Performance: precompiled JSON per region.
- Accessibility: subtitles for audio, keyboard navigation, high contrast.
