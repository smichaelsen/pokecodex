---
id: task-2.3
title: Implement main button events
status: To Do
assignee: []
created_date: '2025-12-25 11:04'
labels:
  - os
  - device
dependencies: []
parent_task_id: task-2
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The component must detect taps and 5s long presses, emitting dexos-device:main-button:pressed and dexos-device:main-button:long-pressed events so the OS (and only the OS) can control the power state. Update any existing listeners to rely on these events instead of DOM interactions.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add press/long-press detection logic inside the component. 2. Emit the documented custom events with relevant detail. 3. Wire createDexOS to listen for those events and respond (power state, menu toggling).
<!-- SECTION:PLAN:END -->
