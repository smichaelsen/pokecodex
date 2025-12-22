# dexOS (Current Capabilities)

This document describes the current, implemented behavior of dexOS. It does not include planned features.

## Location
- Implementation: `public/js/dexOS/dexOS.js`
- Entry wiring: `public/js/app.js`

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
- `registerMenu(handlers)`: register menu handlers for menu items (excluding `reload`).
- `clearMenu()`: remove registered menu handlers.
- `showMenu()` / `hideMenu()`: control menu overlays.
- `loadPokemon({ cacheBust, source })`: fetch data and dispatch update event.
- `getPokemon()`: return last loaded Pokemon list.
- `getTypeInfo()`: return cached type info (from config).
- `getMoveInfo()`: currently returns `null`.
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
