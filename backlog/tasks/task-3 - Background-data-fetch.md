---
id: task-3
title: Background data fetch
status: Done
assignee: []
created_date: '2025-12-23 11:19'
updated_date: '2025-12-27 16:56'
labels:
  - os
  - feature
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Instead of offering the menu item to refresh data, the OS should regularly do that in the background.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started branch topic/task-3-background-data.

Clarified with user: keep manual menu reload; add background auto-refresh every 2 minutes.

Implemented auto-refresh every 2 minutes using dexOS interval; keeps manual reload intact. Auto-refresh skips when powered off and avoids overlapping fetches; cleared on destroy. Build pipeline succeeded.

Wrap-up: auto-refresh every 2 minutes running alongside manual reload; build pipeline successful.
<!-- SECTION:NOTES:END -->
