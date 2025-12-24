---
id: task-2
title: Device Web Component
status: To Do
assignee: []
created_date: '2025-12-23 11:17'
updated_date: '2025-12-23 12:43'
labels:
  - os
  - device
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The device Chrome should be a web component controlling the device chrome, lights, the button, the screens on and off (=black), etc. It's called <dexos-device> and emits dexos-device:main-button:pressed and dexos:main-button:long-pressed custom events. Only the OS operates on the APIs offered by the device. All apps may only use OS APIs.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Long pressing the button for 5s emits the long press event, and no event when releasing it. Pressing and releasing it before 5s just emits the regular press event.
<!-- SECTION:NOTES:END -->
