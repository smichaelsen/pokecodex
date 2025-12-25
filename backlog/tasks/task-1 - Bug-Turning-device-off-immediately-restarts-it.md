---
id: task-1
title: 'Bug: Turning device off immediately restarts it'
status: Done
assignee: []
created_date: '2025-12-23 08:50'
updated_date: '2025-12-25 10:33'
labels:
  - os
  - device
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After long pressing the hardware button, the device shuts off, but then immediatelly turns on again.

Expected behaviour: Device stays off. Pressing the button again will start it again.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Will add a guard that drops the first click after long-press power-off so the device stays off until the button is pressed again.
<!-- SECTION:NOTES:END -->
