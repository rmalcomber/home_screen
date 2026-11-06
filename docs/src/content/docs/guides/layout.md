---
title: Layout
description: Move, resize and collapse tiles on the 12-column grid.
sidebar:
  order: 2
---

- **Move** a tile by dragging its title bar.
- **Resize** it with the handle in the bottom-right corner.
- **Collapse and expand** it by clicking its title bar or the ▾ button. It behaves like an accordion: collapsed tiles shrink to their header and the tiles below move up.

The grid is **12 columns** wide. Dropping a tile on top of another pushes the other tile down, and gaps close up automatically. Positions, sizes and collapsed state are saved to the database as soon as you let go.

On narrow windows (under 640 pixels) tiles stack in a single column and dragging is turned off.

![The dashboard with tiles of different sizes arranged on the grid.](../../../assets/screenshots/dashboard-hero.webp)

:::tip
Make a tile wider if its content wraps. For example, a developer tile with several services reads best at five or six columns, so each service's Dev, Stage and Prod buttons sit on one line.
:::
