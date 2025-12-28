---
id: task-10
title: Modularize dexOS host
status: In Progress
assignee: []
created_date: '2025-12-28 13:17'
updated_date: '2025-12-28 13:24'
labels:
  - os
  - dev
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Split dexOS.js into cohesive modules (audio, power/menu, data refresh, app registry, leds/storage helpers) and wire via thin createDexOS entrypoint.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Map current dexOS.js responsibilities (audio, leds, power/menu, data loading, app switching, storage) and shared state.
2) Define target module layout (e.g., dexOS/audio.js, leds.js, powerMenu.js, data.js, apps.js, storage.js) and boundaries: what each exports and how createDexOS composes them.
3) Extract code into modules without behavior changes; wire imports/exports through a thin createDexOS entrypoint; adjust consumers if needed.
4) Update docs/README references if structure changes; sanity check via lightweight manual run or lint/build if available.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Modules added: audio.js, leds.js, storage.js, data.js, apps.js, menu.js; dexOS.js now composes these and keeps API stable; docs updated with module list.
<!-- SECTION:NOTES:END -->
