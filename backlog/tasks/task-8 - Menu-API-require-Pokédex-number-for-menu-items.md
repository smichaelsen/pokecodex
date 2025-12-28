---
id: task-8
title: 'Menu API: require Pokédex number for menu items'
status: Done
assignee: []
created_date: '2025-12-27 17:18'
updated_date: '2025-12-28 11:56'
labels:
  - os
  - feature
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When registering a menu item in the OS menu API, callers must provide a Pokédex number; dexOS should render the corresponding Pokémon illustration next to the menu item. Using extra emojis is discouraged; the OS data refresh menu item should use Pokémon #137 (Porygon) as its illustration.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started branch topic/task-8-menu-illustrations. Plan: add required pokedex number to menu registration, render illustration in menu, set reload menu to Porygon (#137), discourage emojis.
<!-- SECTION:NOTES:END -->
