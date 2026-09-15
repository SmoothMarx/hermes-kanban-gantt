# Hermes Kanban Gantt

[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue?style=for-the-badge)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-24%20passed-brightgreen?style=for-the-badge)](#tests)
[![Zero API keys](https://img.shields.io/badge/zero-API%20keys-00d26a?style=for-the-badge)](#architecture)

A **Gantt timeline view** plugin for [Hermes Desktop](https://hermes-agent.nousresearch.com) — a full-page `/kanban-gantt` route that renders any Hermes kanban board as a timeline of real work (created / started / done timestamps), not a forecast planner.

```
Kanban Gantt ── 20 ────────────────────────────────  [◄ zoom ►] [Refresh]
TÂCHES        │ LUN 7 ── MAR 8 ── MER 9 ── JEU 10 ── VEN 11 ── …
☑ Epic X      │        ▓▓▓▓▓▓▓░░░░░░░▓▓▓▓ (running)
☐ Sub-task A  │              ▓▓▓▓▓ (done)
```

## Features

- **Full desktop page** (`/kanban-gantt`) + sidebar entry + ⌘K palette command.
- **Board switcher** projected into the desktop titlebar band (`titleBar.center`), with an "All boards" aggregate mode; per-board badges on rows in aggregate view.
- **Real timeline bars** — from the kanban tasks' actual timestamps (created / started / review / done), with live-activity arc on running tasks, weekend shading, zoom (7 days at 100%), auto-scroll to "now".
- **Dependencies** — parent → child links drawn as tree connectors in the task column and dependency chains in the timeline.
- **Task detail drawer** — status transitions (action matrix), assignee, comments, runs, attachments; dockable (`«` / `»`) beside the gantt instead of overlaying, resizable, position persisted.
- **Bulk operations** — multi-select rows (header checkbox, shift-click) → move status, assign, archive, delete.
- **Filters** — by assignee, by status, show/hide archived, text search.
- **Readable by design** — sticky opaque label column, opaque dropdown menus, resizable label column, all state persisted per plugin.

## Install

```bash
git clone https://github.com/e-is/hermes-kanban-gantt ~/.hermes/plugins/kanban-gantt/
# renderer half — either let Hermes lift it automatically on next start, or run:
~/.hermes/plugins/kanban-gantt/install.sh
# enable the backend (plugins.enabled must be a real YAML list):
#   edit ~/.hermes/config.yaml → plugins: enabled: [- kanban-gantt]
# then restart Hermes Desktop so the backend mounts.
```

Verify: `Mounted plugin API routes: /api/plugins/kanban-gantt/` in `~/.hermes/logs/agent.log`, then ⌘K → « Kanban Gantt ».

## Layout

```
plugin.yaml          unified plugin manifest
__init__.py          no-op register() (capability probe only)
dashboard/           backend — FastAPI router → /api/plugins/kanban-gantt/
  manifest.json      name/label/version/api pointer
  plugin_api.py      gantt snapshot, boards, task detail, status/comment routes
desktop/
  plugin.js          renderer — plain ESM, loaded uncompiled by Hermes Desktop
install.sh           optional convenience installer (desktop half + backend half)
tests/               node:test suite (pure gantt core, sticky label), pytest backend
                     suite, demo server (one port: demo + API + plugin.js)
```

## Architecture

- **Backend owns** all data access: reads the shared kanban SQLite store
  (`~/.hermes/kanban/boards/<slug>/kanban.db`), serves the Gantt snapshot
  (rows, bars, domain, dependencies), and routes status transitions /
  comments / bulk writes through the same domain layer as the core kanban.
  Mounted at `/api/plugins/kanban-gantt/` by the desktop's `hermes serve`.
- **Renderer owns** everything visual: timeline math (pure `GANTT_CORE_SRC`
  core, testable in isolation), rows, bars, filters, drawer, and the
  desktop-page chrome (sidebar entry, palette command, titlebar switcher).
- **Zero API keys, zero model tokens** — no network I/O beyond the local
  Hermes gateway and the local SQLite store.

## Tests

```bash
# pure core + sticky label (node:test, no deps)
node --test tests/gantt-core.test.mjs tests/test_sticky.mjs

# backend (isolated venv; HERMES_AGENT_HOME points at a hermes-agent checkout)
tests/run_tests.sh
```

## License

GPL-3.0 — see [LICENSE](LICENSE).
