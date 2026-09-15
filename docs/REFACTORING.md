# Refactoring analysis — kanban-gantt toward maintainable sources

State after the initial import (commit 631f28c): the whole renderer lives in a
single self-contained `desktop/plugin.js` (~2.2k lines of hand-written
`jsx()`/`jsxs()` calls, plain JS, with the pure timeline logic embedded in a
`GANTT_CORE_SRC` template string extracted by tests). The backend is a single
`dashboard/plugin_api.py` (~700 lines).

## Constraint that shapes everything

Hermes loads disk plugins **uncompiled** — plain ESM, only `@hermes/plugin-sdk`,
`react`, `react/jsx-runtime` importable. So "rewrite in TSX" cannot mean
"distribute TSX": we need a **build step** that compiles authoring sources into
the single distributable `desktop/plugin.js`, with `@hermes/plugin-sdk`,
`react`, `react/jsx-runtime` kept **external** (imported, not bundled) and
everything else inlined. The docs' "Bundled" tier (in-tree TSX) is not available
to third-party repos, so the pipeline is: author TS → esbuild → commit the
artifact (or attach it to a release and pin the repo to it).

## Proposed target layout

```
src/
  core/                  PURE logic, no React, no SDK (unit-testable directly)
    timeline.ts          domain, bar range, ticks, weekend bands (ex-GANTT_CORE_SRC)
    status.ts            STATUS_META, ACTION_MATRIX, transitions
  ui/
    GanttPage.tsx        page shell, layout, docked/overlay drawer
    TaskRow.tsx          sticky label cell, connector, checkbox, dot
    Bars.tsx             timeline bars, weekend bands, ruler
    Drawer.tsx           task detail drawer (+ dock/resize handles)
    menus.tsx            Radix dropdown wrappers (assignee, status, bulk, "...").
    i18n.ts              locale bundles (en/fr), bindI18n
  state.ts               atoms ($boardSlug, $labelW, $drawerW, $drawerDocked…)
  api.ts                 fetch wrappers over ctx.rest
desktop/plugin.js        BUILD ARTIFACT (esbuild out) — committed
dashboard/plugin_api.py  backend (already clean; see backend notes)
tests/
  core/                  vitest or node:test against src/core (TS, no stubs)
  ui/                    newswire-style: ESM loader stubs + render smoke tests
  api/                   pytest (existing test_plugin_api.py)
```

## Steps, in order

1. **Toolchain** — add `package.json` (private), esbuild script:
   `esbuild src/main.tsx --bundle --format=esm --outfile=desktop/plugin.js
   --external:@hermes/plugin-sdk --external:react --external:react/jsx-runtime
   --jsx=automatic`. CI: build + `node --check` + tests, fail if
   `desktop/plugin.js` is out of date.
2. **Extract the pure core first** (lowest risk): move `GANTT_CORE_SRC` contents
   into `src/core/timeline.ts` as real exported functions; the template string
   disappears; `tests/gantt-core.test.mjs` imports the TS module through the
   same bundler (or stays on the artifact). Behavior-identical, no UI change.
3. **Split the renderer** into the `ui/` components above, one commit per
   component, verifying after each with the existing manual checklist
   (titlebar switcher, docked drawer, menus, sticky labels).
4. **Type the SDK boundary**: a small `sdk.d.ts` declaring the subset of
   `@hermes/plugin-sdk` we use (atoms, useQuery, DropdownMenu*, areas…) until
   upstream ships types.
5. **Tests to Hermes expectations**:
   - keep pytest backend suite as-is;
   - port `test_sticky.mjs` (playwright, optional) and add newswire-style ESM
     render smoke tests with `.stubs/` (react/sdk/jsx-runtime) so the default
     run has no browser dependency;
   - add core unit tests for every date/zoom edge case (DST boundaries,
     min-bar width, archived filtering).
6. **Backend notes** (smaller): split `plugin_api.py` routes into a package
   (`routes/boards.py`, `routes/gantt.py`, `routes/tasks.py`) if it keeps
   growing; keep the single-file option — it is still fine at this size.

## What NOT to do yet

- No behavior changes during the port (commits must be mechanically verifiable).
- No dependency on a React framework/build beyond esbuild.
- No TS strictness war: start `strict: false`, tighten per module.

## Risks

- **Artifact drift** — the committed `desktop/plugin.js` can go stale vs `src/`.
  Mitigation: CI check (rebuild + `git diff --exit-code desktop/plugin.js`).
- **Radix/Slot pitfalls** (`asChild` single child) and Electron drag regions
  are regression-prone — keep the AGENTS.md gotchas and the UI smoke tests.
- The GANTT_CORE_SRC extraction trick is what the demo uses; after the split,
  the demo server should serve the built artifact instead.
