# dexOS App Developer Guide

This guide explains the APIs exposed to dexOS apps. It is scoped to app-facing behavior and lifecycle.

## App Contract
Apps are factory functions registered via `host.registerApp(id, factory)`.

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

Lifecycle:
- `host.start(id, ctx)` mounts an app and expects a `{ destroy() }` handler.
- `host.switchTo(id, ctx)` destroys the current app (if any) and mounts the new one.

Apps should:
- Only use data via `host.getPokemon()` and the `dexos:data:updated` event.
- Use `host.audio` and `host.storage` helpers for media/state.
- Register menu actions through `host.registerMenu()`.

## App Context (`ctx`)
- `config`: config object from `window.__POKEDEX_CONFIG__`.
- `moduleVersion`: query string for cache-busting module imports (e.g. `?v=...`).
- `elements`: DOM references (`listEl`, `detailPanelEl`, `detailContentEl`, `pagePrevEl`, `pageNextEl`, `pageInfoEl`, `pageProgressEl`, `overlayEl`).
- `isMobile()`: returns `true` when mobile layout is active.
- `hideOverlay()`: hides the mobile detail overlay.
- `host`: dexOS host API (menu, data, audio, storage, power, intro, LEDs).

## Data API
- `host.loadPokemon({ cacheBust, source })`: fetch data and dispatch update event.
- `host.getPokemon()`: return last loaded Pokemon list.
- `host.getTypeInfo()`: return cached type info (from config).
- `host.getMoveInfo()`: currently returns `null`.

Event payload example:
```js
{
  pokemon: [...],
  source: 'init' | 'load' | 'reload'
}
```

Listen for updates:
```js
window.addEventListener('dexos:data:updated', onDataUpdated);
```

## Menu API
- `host.registerMenu(items)`: register menu items (excluding `reload`).
  - Shape: `{ settings: { handler() {}, pokedexNumber: 25 } }`
  - `pokedexNumber` is required; dexOS renders that Pokémon’s illustration next to the item.
- `host.clearMenu()`: remove registered menu handlers.
- `host.showMenu()` / `host.hideMenu()`: control menu overlays.

Notes:
- The `reload` menu item is owned by dexOS, uses Pokémon #137 (Porygon) as its illustration, and always triggers a data refresh.
- Apps register handlers only for additional menu items; avoid adding extra emojis since illustrations are shown automatically.

## Audio API
```js
host.audio.get(url)     // returns cached Audio or creates one
host.audio.preload(url) // loads and preloads the audio
host.audio.play(url)    // resets to 0 and plays (safe no-op on errors)
```

## LED API
```js
host.leds.set(index, state)          // set LED on/off
host.leds.pulse(index, { interval }) // pulse LED, returns stop() function
```

## Power API
```js
host.setDefaultApp(id, ctx) // sets the default app on power-on
host.startDefault()         // starts the default app
host.power.on()             // power on
host.power.off()            // power off
host.power.isOn()           // returns boolean
```

## Boot API (system)
```js
host.boot({ cacheBust, source }) // runs intro, loads data, starts default app
```

Notes:
- Intended for the initial boot sequence, not per-app usage.

## Storage API
```js
host.storage.get(key, fallback) // reads JSON or raw string (fallback if missing)
host.storage.set(key, value)    // writes JSON unless value is a string
host.storage.remove(key)        // removes a key
host.storage.clear()            // clears storage backend
```

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
  example: {
    handler() {
      detailContentEl.innerHTML = '<div>Menu action.</div>';
    },
    pokedexNumber: 25,
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
