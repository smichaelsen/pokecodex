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
  - `id` (Kanto index), `slug`, `name.de`, `name_tts.de` (optional pronunciation override), `entry.de`, `types` (English slugs), `height_m`, `weight_kg`, `evolves_from`, `signature_move` (English move slug), `evolutions` (list with target number + condition such as level/item/friendship).
  - Evolutions reference Pokedex numbers (not slug/name). The build pipeline resolves numbers to readable names; if a referenced number is missing, the name is shown as "???".
  - Example: `apps/pokedex/data/pokemon/025_pikachu.yml` would reference evolutions by number (evolves from #172, evolves into #26).
  - Optional: `region_forms`, `sprites` (path to images), `audio` (path to pre-rendered audio).
- `data/types.yml`: List of all types with `name.de`, `description.de`, effectiveness (strong/normal/weak) against other types.
- `data/moves.yml`: Shared move reference if moves are reused.
- `public/assets/sprites/`: Official illustrations/sprites, file-based (e.g., `001.png`, `025.png`, `other/official-artwork/XXX.png` if desired). Copied by the build to `dist/assets/sprites/`.
- `public/audio/de/pokemon/{id}.mp3`: Generated name audio files.
- `public/audio/de/descriptions/{id}.mp3`: Generated description audio files.
- `public/audio/chimes/{id}.ogg`: Optional Pokemon call/chime audio file (downloaded).
- Admin is done by directly editing these files (no backoffice). Changes are versioned.

## Frontend Requirements
- List sorted by Kanto index (default), optional toggles for other sorting/filtering later (type, search, favorites).
- Detail view per Pokemon with name (DE), description (DE), type badges, moves, evolutions (with conditions), sprite/illustration.
- Audio behavior: clicking the illustration plays the call/chime; clicking the name plays the spoken name; clicking the description plays the spoken description (preloaded on detail view open).
- If audio is missing, the UI shows a hint or disables buttons.
- Client loads data as static bundles (e.g., pre-rendered JSON files) from `data/`/`public/`.
- Menu interaction: a physical-style button on the Pokedex rim opens an overlay menu on the screen. Menu items include emoji for kid-friendly recognition.
- Menu item: “🔄 Reload data” triggers a fresh data pull from the server; if that’s not practical, fall back to a full page refresh.
- Illustration usage:
  - List: small image next to name/types (CSS scaling, path e.g. `assets/sprites/{id}.png`).
  - Detail: large image (max-width 100%), falls back to a placeholder if missing.
- Missing entries: like in the game, non-existent dex entries appear as empty slots (number only) and are not clickable until data exists.
- Type colors: type badges are styled based on `data/types.yml`.

## Audio Generation (German)
- Goal: script-based TTS generation, reproducible and file-based for name and description audio.
- `scripts/generate_name_audio.sh` uses Piper with a German voice model and runs offline after the model is downloaded.
- `scripts/generate_description_audio.sh` uses the same model and generates `entry.de` audio.
  - Example workflow:
    ```bash
    # Name
    piper --model .cache/piper/models/de_DE-thorsten-high.onnx \
      --output_file public/audio/de/pokemon/001.wav \
      --text "Bisasam"
    ffmpeg -i public/audio/de/pokemon/001.wav -ar 44100 -ac 2 public/audio/de/pokemon/001.mp3
    ```
  - `ffmpeg` compresses to MP3. Alternatively play WAV directly if MP3 is not needed.
  - Script iterates over all Pokemon files, generates missing audio, leaves existing files untouched.
  - If `name_tts.de` is present, it is used as the spoken string instead of `name.de`.
- Chime/call audio is fetched by a separate download script (source online).

## Admin Flow (Filesystem)
- Adjust content: edit YAML files under `data/` (names, descriptions, types, moves).
- New Pokemon: add YAML file, add sprite, run scripts, verify audio.
- Regenerate audio: use `scripts/generate_name_audio.sh --force` and `scripts/generate_description_audio.sh --force` or delete target files and re-run.
- Deployment: static assets (`public/`) and data (`data/`) are shipped together; frontend reads only these sources.

## Extensions (Optional)
- Additional regions/sets as separate directories (`data/pokemon_johto/` etc.).
- Localization: additional language folders analogous to `public/audio/de` and `name.de`/`description.de`.
- Performance: precompiled JSON per region for faster load times.
- Accessibility: subtitles for audio, keyboard navigation, high contrast.

## Pokédex OS (dexOS) Concept
- Name: dexOS.
- Purpose: a thin OS layer that owns device-level behavior and provides stable APIs for apps.
- Documentation: apps should rely on a well-defined, versioned API contract (documented alongside dexOS).
- Apps: each app renders into the two panes (left list, right detail) using a shared contract (mount, update, destroy).
- Menu control: OS owns the hardware menu button and shows the overlay UI in the right pane; apps register menu actions.
- Data API: OS provides `loadPokemon()` (with cache-busting) and a `getTypeInfo()`/`getMoveInfo()` lookup so apps do not access files directly.
- Audio API: OS exposes `playName(id)`, `playDescription(id)`, `playChime(id)`, and `playType(slug)`; preloading and missing-audio handling are centralized.
- LED API: OS exposes `setLed(index, state)` and `pulseLed(index, pattern)` for the three top LEDs; apps can signal activity or mode.
- Navigation: OS manages current app, back/close behavior on mobile, and keeps per-app UI state (e.g., page index, selection).
- Storage: OS provides a small key-value cache for app preferences (sorting, last selection) backed by browser `localStorage`.
- Diagnostics: OS can expose a lightweight debug overlay or console logging toggle.

## dexOS Implementation Plan
1. Create a new `public/js/dexOS/` module with a minimal app contract and host registry; keep behavior identical to the current app host.
2. Move menu ownership into dexOS (hardware button, overlay handling, menu actions) and expose a `registerMenu()` API for apps.
3. Move data loading into dexOS (`loadPokemon`, `getTypeInfo`, `getMoveInfo`), own the “Reload data” menu action, and dispatch a `dexos:data:updated` event that apps listen to.
4. Centralize audio handling in dexOS (preload, play helpers, missing-audio behavior).
5. Introduce dexOS storage helpers backed by `localStorage` for app state.
6. Add the LED API (no-op in web for now) so apps can signal state consistently.
7. Document the dexOS API contract and example app skeleton for new features (quiz, etc.).

## TODO (Maintainability Roadmap)
1. (Done) Extract CSS into `public/css/app.css` and reference it from the generated HTML.
2. (Done) Extract JS into ES modules under `public/js/` (e.g., `app.js`, `render.js`, `audio.js`, `state.js`, `utils/escapeHtml.js`).
3. (Done) Move `index.html` into `public/` as a template; inject `assetVersion`/`audioVersions` via a small config file or placeholder replacement in `build.js`.
4. (Done) Add HTML escaping for all user-provided strings before inserting into the DOM.
5. (Done) Replace per-element listeners with event delegation on the detail/list containers.
6. (Done) Normalize pagination page size (single shared constant between list render and paging logic).
7. (Done) Remove unused `resetListScroll` helper.
8. (Done) Remove unused `${badgeCss}` placeholder from `public/css/app.css`.
