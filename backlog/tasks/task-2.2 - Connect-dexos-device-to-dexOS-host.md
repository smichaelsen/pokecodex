---
id: task-2.2
title: Connect dexos-device to dexOS host
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
Refactor app.js/createDexOS so the host controls the new component instead of manipulating raw DOM nodes. The host should call into the component to toggle the cover, manage screen-off state, and drive the LED indicators, keeping the chrome behavior centralized.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update app boot code to grab the new component instead of separate button/led elements. 2. Extend createDexOS to accept a component reference and expose helper methods (e.g. setCoverState, updateScreenOff). 3. Ensure menu and reload wiring continues to work through the component.
<!-- SECTION:PLAN:END -->
