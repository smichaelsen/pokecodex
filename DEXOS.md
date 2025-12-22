# dexOS (Current Capabilities)

This document describes the current, implemented behavior of dexOS. It does not include planned features.

## Location
- Implementation: `public/js/dexOS/dexOS.js`
- Entry wiring: `public/js/app.js`

## Scope
- Owns menu behavior (hardware button, overlays).
- Owns Pokemon data loading and refresh.
- Provides a small app host for mounting apps.

## App Contract
dexOS apps are factory functions registered via `host.registerApp(id, factory)`.

Factory signature:
```js
export async function createApp(ctx) {
  // mount / render
  return {
    destroy() {
      // remove listeners, cleanup
    },
  };
}
```

Context (`ctx`) fields:
- `config`: config object from `window.__POKEDEX_CONFIG__`.
- `moduleVersion`: query string for cache-busting module imports (e.g. `?v=...`).
- `elements`: DOM references (`listEl`, `detailPanelEl`, `detailContentEl`, `pagePrevEl`, `pageNextEl`, `pageInfoEl`, `pageProgressEl`, `overlayEl`).
- `isMobile()`: returns `true` when mobile layout is active.
- `hideOverlay()`: hides the mobile detail overlay.
- `host`: dexOS host API (menu, data, audio, storage).

Lifecycle:
- `host.start(id, ctx)` mounts an app and expects a `{ destroy() }` handler.
- `host.switchTo(id, ctx)` destroys the current app (if any) and mounts the new one.

Apps should:
- Only use data via `host.getPokemon()` and `dexos:data:updated` events.
- Use `host.audio` and `host.storage` helpers for media/state.
- Register any menu actions through `host.registerMenu()`.

## Example App Skeleton
```js
export async function createExampleApp(ctx) {
  const { elements, host } = ctx;
  const { listEl, detailContentEl } = elements;

  const onDataUpdated = (event) => {
    const { pokemon = [] } = event.detail || {};
    listEl.innerHTML = pokemon.map((p) => `<div>${p.name?.de || p.slug}</div>`).join('');
    detailContentEl.innerHTML = '<div>Bereit.</div>';
  };

  host.registerMenu({
    example() {
      detailContentEl.innerHTML = '<div>Menu action.</div>';
    },
  });

  window.addEventListener('dexos:data:updated', onDataUpdated);
  onDataUpdated({ detail: { pokemon: host.getPokemon() || [] } });

  return {
    destroy() {
      window.removeEventListener('dexos:data:updated', onDataUpdated);
      host.clearMenu();
    },
  };
}
```

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
- `registerMenu(handlers)`: register menu handlers for menu items (excluding `reload`).
- `clearMenu()`: remove registered menu handlers.
- `showMenu()` / `hideMenu()`: control menu overlays.
- `loadPokemon({ cacheBust, source })`: fetch data and dispatch update event.
- `getPokemon()`: return last loaded Pokemon list.
- `getTypeInfo()`: return cached type info (from config).
- `getMoveInfo()`: currently returns `null`.
- `audio`: audio helpers (see below).
- `leds`: LED helpers (see below).
- `storage`: localStorage-backed helpers (see below).
- `destroy()`: remove handlers and clean up.

## Menu Ownership
- dexOS owns menu visibility and the hardware button.
- The `reload` menu item is owned by dexOS and triggers a data refresh.
- Other menu items can be wired by apps via `registerMenu`.

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

## Audio Helpers
dexOS provides a small audio helper with caching to centralize audio behavior:

```js
host.audio.get(url)     // returns cached Audio or creates one
host.audio.preload(url) // loads and preloads the audio
host.audio.play(url)    // resets to 0 and plays (safe no-op on errors)
```

Audio LED behavior:
- LED 0 lights while any audio is playing (host-managed).

## LED Helpers
dexOS exposes LED helpers to let apps signal device state:

```js
host.leds.set(index, state)          // set LED on/off
host.leds.pulse(index, { interval }) // pulse LED, returns stop() function
```

## Storage Helpers
dexOS provides storage helpers backed by `localStorage` (with an in-memory fallback):

```js
host.storage.get(key, fallback) // reads JSON or raw string (fallback if missing)
host.storage.set(key, value)    // writes JSON unless value is a string
host.storage.remove(key)        // removes a key
host.storage.clear()            // clears storage backend
```
