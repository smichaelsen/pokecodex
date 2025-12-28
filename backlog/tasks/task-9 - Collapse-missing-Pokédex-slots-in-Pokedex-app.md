---
id: task-9
title: Collapse missing Pokédex slots in Pokedex app
status: Done
assignee: []
created_date: '2025-12-28 08:39'
updated_date: '2025-12-28 09:05'
labels:
  - ux
  - pokedex
  - feature
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
UX: In the Pokedex app, contiguous missing Pokédex numbers should collapse into a single range tile (e.g., if 158 and 163 exist but 159–162 are missing, show one tile "Nr. 159 - Nr. 162" instead of four empty slots).
Scope/requirements:
- Implement purely in the Pokedex app runtime/UI (no build/OS changes).
- Apply to any contiguous missing range in the current ordering; keep real entries intact and clickable; range tile is non-clickable.
- Preserve numeric order without extra blank rows.
- Page browser/pagination must count shown/total based on the collapsed data (ranges count as one).
- Keep UI copy in German; code/tasks in English.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Review Pokedex app list/pagination pipeline and how missing slots render today.
2) Introduce a collapse step that converts contiguous missing Pokédex numbers into range entries before pagination; keep real entries untouched.
3) Render range entries as non-clickable tiles with German label "Nr. X - Nr. Y" (or single number when length 1 if needed) and adjust selection logic to skip them.
4) Ensure pagination/total counts and visible items derive from the collapsed list, so ranges count as one item.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated range placeholder label to a simple dash to keep kid-friendly minimal text.

Implementation merged to branch topic/task-9-collapse-slots. Range placeholders collapsed and labeled with dash; pagination uses collapsed list. Ready for review/merge.

Fixed render module import paths after moving into pokedexApp folder (escapeHtml/dom).

Fixed render import paths to point to /js/dom.js and /js/utils/escapeHtml.js (../../ instead of ../).
<!-- SECTION:NOTES:END -->
