# dexOS Internal Documentation

This document covers internal features and device integration details for dexOS.

## Location
- Implementation: `public/js/dexOS/dexOS.js` (composes helpers under `public/js/dexOS/`)
- Entry wiring: `public/js/app.js`

### Modules
- `audio.js`: audio caching/playback orchestration and LED hooks
- `apps.js`: app registry and switching
- `data.js`: Pokémon data loading and cache
- `leds.js`: LED helpers (set, pulse, flash)
- `menu.js`: menu overlays and menu item registration (incl. reload)
- `storage.js`: localStorage-backed helper with in-memory fallback

## Scope
- Owns menu behavior (hardware button, overlays).
- Owns Pokemon data loading and refresh.
- Provides a small app host for mounting apps.

## API: createDexOS
```js
createDexOS({
  menuButtonEl,
  menuOverlayLeftEl,
  menuOverlayRightEl,
  menuItems,
  config,
  dataUrl,
})
```

Arguments
- `menuButtonEl`: button element for the hardware menu.
- `menuOverlayLeftEl`: overlay element covering the left pane.
- `menuOverlayRightEl`: overlay element covering the right pane.
- `menuItems`: map of menu item IDs to elements (e.g. `{ reload: buttonEl }`).
- `config`: client config object (uses `assetVersion` and `typeInfo`).
- `dataUrl`: optional data endpoint (defaults to `data/pokemon.json`).

Returns
- `registerApp(id, factory)`: register an app factory.
- `start(id, ctx)`: start the given app.
- `switchTo(id, ctx)`: switch to another app, destroying the current one.
- `registerMenu(items)`: register menu items (excluding `reload`; each item must include `pokedexNumber` so dexOS can render the Pokémon illustration).
- `clearMenu()`: remove registered menu handlers.
- `showMenu()` / `hideMenu()`: control menu overlays.
- `loadPokemon({ cacheBust, source })`: fetch data and dispatch update event.
- `getPokemon()`: return last loaded Pokemon list.
- `getTypeInfo()`: return cached type info (from config).
- `getMoveInfo()`: currently returns `null`.
- `audio`: audio helpers (app-level playback orchestration).
- `leds`: LED helpers (hardware indicators).
- `storage`: localStorage-backed helpers.
- `power`: power helpers (power on/off state).
- `boot({ cacheBust, source })`: run intro, load data, and start default app.
- `destroy()`: remove handlers and clean up.

## Menu Ownership
- dexOS owns menu visibility and the hardware button.
- The `reload` menu item is owned by dexOS, uses Pokémon #137 (Porygon) as its illustration, and triggers a data refresh.
- Other menu items can be wired by apps via `registerMenu`; each must provide a `pokedexNumber`. Extra emojis are discouraged since dexOS shows the Pokémon illustration.

## Data Ownership
- dexOS fetches `data/pokemon.json` and stores it in memory.
- On load/refresh, dexOS dispatches `dexos:data:updated`.

Event payload example:
```js
{
  pokemon: [...],
  source: 'init' | 'load' | 'reload'
}
```

## Audio + LED Integration
- Audio playback is centralized through `host.audio` for consistent caching and controls.
- LED 2 (yellow) lights while audio is loading.
- LED 0 (blue) lights only while audio is actively playing.
- LED 1 (red) flashes 3x on audio load failures (including timeouts).

## LED Helpers
```js
host.leds.set(index, state)          // set LED on/off
host.leds.pulse(index, { interval }) // pulse LED, returns stop() function
```

## Power Behavior
- Hold the hardware button for 5 seconds to power off (unmount app, black screens).
- Click the button to power on and load the default app.

API:
```js
host.setDefaultApp(id, ctx) // sets the default app on power-on
host.startDefault()         // starts the default app
host.power.on()             // power on
host.power.off()            // power off
host.power.isOn()           // returns boolean
```

## Intro Animation
dexOS shows a boot animation on initial start and when powering on:
- Both panes are covered with white layers.
- The right pane shows the "dexOS" label.
- LED sequence: wait 1s, blue on 1s, red on 1s, yellow on 1s, all off.
- 1s after the sequence, the covers are removed.
- Menu button clicks are ignored during the intro (power-off hold still works).

Boot sequence:
```js
host.boot({ cacheBust, source })
```

## Storage Helpers
Storage is backed by `localStorage` with an in-memory fallback:

```js
host.storage.get(key, fallback) // reads JSON or raw string (fallback if missing)
host.storage.set(key, value)    // writes JSON unless value is a string
host.storage.remove(key)        // removes a key
host.storage.clear()            // clears storage backend
```

## Concept
- Purpose: a thin OS layer that owns device-level behavior and provides stable APIs for apps.
- Apps render into two panes (left list, right detail) using a shared contract (mount, update, destroy).
- Menu control: OS owns the hardware menu button and overlay UI; apps register menu actions.
- Data API: OS provides `loadPokemon()` and `getTypeInfo()`/`getMoveInfo()` so apps avoid file access.
- Audio API: OS exposes `playName(id)`, `playDescription(id)`, `playChime(id)`, and `playType(slug)`.
- LED API: OS exposes `setLed(index, state)` and `pulseLed(index, pattern)`.
- Navigation: OS manages current app, back/close behavior on mobile, and per-app UI state.
- Storage: OS provides a small key-value cache backed by `localStorage`.
- Diagnostics: OS can expose a lightweight debug overlay or console logging toggle.
