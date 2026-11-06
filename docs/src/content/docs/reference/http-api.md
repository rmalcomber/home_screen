---
title: HTTP API
description: The JSON endpoints Home Screen's own interface uses.
sidebar:
  order: 3
---

Everything the dashboard does goes through a small JSON API on the same port. There is no authentication, and the server only listens on `127.0.0.1` unless you start it with `--host`.

| Method and path | Purpose |
|---|---|
| `GET /api/tiles` | List tiles |
| `POST /api/tiles` | Create a tile |
| `PUT /api/tiles/{id}` | Replace a tile |
| `DELETE /api/tiles/{id}` | Delete a tile |
| `PUT /api/layout` | Bulk-update `x, y, w, h, collapsed, parent_id, page_id` for many tiles (`page_id: 0` leaves the page alone) |
| `GET /api/pages`, `POST /api/pages` | List and create pages (`{ name, mode, cols }`) |
| `PUT /api/pages/{id}`, `DELETE /api/pages/{id}` | Rename, change mode or order; delete a page and its tiles (`409` for the last page) |
| `GET /api/icons`, `POST /api/icons` | List and upload SVG icons (`{ name, svg }`) |
| `GET /api/icons/{id}`, `DELETE /api/icons/{id}` | Serve and delete an icon |
| `POST /api/images?name=…` | Upload a raster image (raw body, `Content-Type: image/png` and so on) |
| `GET /api/images/{id}`, `DELETE /api/images/{id}` | Serve and delete an image |
| `GET /api/settings`, `PUT /api/settings` | Read and merge settings (`bgColor`, `bgImage`, `glass`, `autoHideBar`) |
| `POST /api/run` | Run an HTTP request for the [curl runner](/launcher/curl/) (localhost origin only) |

A tile looks like this:

```json
{
  "id": 1,
  "type": "bookmarks",
  "title": "AWS",
  "icon": "iconify:fa6-brands:aws",
  "x": 0, "y": 0, "w": 3, "h": 12,
  "collapsed": false,
  "color": null,
  "parent_id": null,
  "page_id": 1,
  "config": { "links": [{ "title": "Console home", "url": "https://aws.amazon.com/console/" }] }
}
```

`type` is `bookmarks`, `dev`, `github`, `widget` or `group`, and `config` depends on the type. `color` is a palette name such as `blue` (or `null`), `parent_id` is the group the tile sits in (or `null` for the page), and `page_id` is the page. Deleting a group deletes the tiles inside it. A page has `{ id, name, mode, cols, position }`, where `mode` is `free` or `columns` and `cols` is 2 to 6. The API is an implementation detail of the interface: it can change between beta versions.
