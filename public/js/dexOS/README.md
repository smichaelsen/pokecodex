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
- `power`: power helpers (see below).
- `intro`: boot animation helpers (see below).
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

## Power Helpers
dexOS supports a power-off state controlled by the hardware button:

Behavior:
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
- The right pane shows the “dexOS” label.
- LED sequence: wait 1s, blue on 1s, green on 1s, yellow on 1s, all off.
- 1s after the sequence, the covers are removed.
- Menu button clicks are ignored during the intro (power-off hold still works).

API:
```js
host.startIntro() // runs the boot animation
```

## Storage Helpers
dexOS provides storage helpers backed by `localStorage` (with an in-memory fallback):

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

## Implementation Plan
1. Create a `public/js/dexOS/` module with a minimal app contract and host registry.
2. Move menu ownership into dexOS (hardware button, overlay handling, menu actions).
3. Move data loading into dexOS (`loadPokemon`, `getTypeInfo`, `getMoveInfo`) and dispatch `dexos:data:updated`.
4. Centralize audio handling in dexOS (preload, play helpers, missing-audio behavior).
5. Introduce dexOS storage helpers backed by `localStorage` for app state.
6. (Done) Add the LED API (no-op in web for now) so apps can signal state consistently.
7. (Done) Document the dexOS API contract and example app skeleton for new features.

## Device Web Component Plan
1. Create a `<dex-device>` custom element that owns the chrome (shell, LEDs, button, covers, panes).
2. Move device markup from `public/index.html` into the component template.
3. Expose a minimal imperative API on the element (LEDs, covers, screen off, menu enabled).
4. Emit `dex-device:button` and `dex-device:button-hold` events for input handling.
5. Update dexOS to use the component API instead of direct DOM nodes.
6. Update `app.js` to locate the `<dex-device>` element and pass it into dexOS.
7. Add a note that hardware APIs are private and apps must only use dexOS APIs.
