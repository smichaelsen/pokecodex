---
id: task-2.1
title: Create dexos-device component structure
status: In Progress
assignee: []
created_date: '2025-12-25 11:04'
updated_date: '2025-12-25 11:16'
labels:
  - os
  - device
dependencies: []
parent_task_id: task-2
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Move the current menu button, lights, and screen cover markup into a dedicated <dexos-device> component that owns the shell chrome. The component should host its own template/shadow DOM so the OS can treat it as a single element and let apps focus on slots/styling.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Build a <dexos-device> component module that owns the chrome template, attaches a shadow DOM, and provides slots for the list and detail panels.
2. Move the list/detail markup into the component via slots so the device chrome stays encapsulated.
3. Keep the original app styles for the panels while keeping the component-specific styling inside its own shadow root.
<!-- SECTION:PLAN:END -->
