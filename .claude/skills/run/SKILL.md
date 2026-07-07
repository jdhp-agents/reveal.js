---
name: run
description: Use when it is required to run, start, launch, or preview this repo's reveal.js presentations (the Vite dev server), or to visually verify a slide/CSS/JS change in a real browser through the playwright MCP server. Covers how the agent should launch/stop the server, which pages work, when a rebuild of dist/ is needed, and how to navigate slides with Playwright.
---

# Running and viewing the presentations (agent workflow)

This repo is reveal.js itself (v6, Vite-based) plus a few personal slide decks (`*.html` at the
repo root). There is no backend, no database: everything is static HTML served by the Vite dev
server.

## Launch: one background task

Start the dev server as a background Bash task:

    npm start

- Vite serves the repo root on `http://localhost:8000` (port set in `vite.config.ts`; override
  with `npm start --port=8001` if 8000 is busy).
- Confirm it is up with `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/demo.html`
  (expect `200`).
- Stop it with `TaskStop` on the task ID you launched. Leave it running for the rest of the
  session otherwise — restarting it brings no benefit.
- Dependencies are already in `node_modules`; if Vite is missing, run `npm install`.

Do NOT fall back to `python3 -m http.server` or similar unless Vite itself is broken: the decks
work the same, but you lose auto-reload and it hides real Vite problems.

## What is served, and what actually works

Every file under the repo root is reachable by its path:

- `http://localhost:8000/demo.html` — the full reveal.js demo. Loads and initializes correctly;
  use it as the reference "known good" page.
- `http://localhost:8000/index.html` — plain static landing page (not a reveal.js deck) listing
  links to the personal decks below.
- `http://localhost:8000/examples/*.html` — feature-specific examples (scroll, math, media,
  auto-animate, ...), known good.
- `http://localhost:8000/<personal deck>.html` — the personal decks (`csc-53439-ep_*.html`
  except the plan file, `inf581_optimization.html`, `optimization_cem.html`). They load the same
  `dist/*` files as `demo.html`, plus `jdhp.css`/`jdhp.js` at the repo root, and initialize
  correctly.

## Seeing a change take effect

- **Editing a deck's HTML**: just reload the page in Playwright (`browser_navigate` again).
- **Editing reveal.js sources (`js/`, `css/`, `plugin/`)**: the root HTML pages load the
  *prebuilt* files in `dist/`, which Vite serves as static assets — source edits are invisible
  until you rebuild. Run `npm run build` (full), or the faster `npm run build:styles` for
  theme/CSS-only changes, then reload.
- **Unit tests**: `npm test` (QUnit via Puppeteer) — independent from the dev server.

## Viewing and driving slides via the playwright MCP server

A headless Chromium is available through the `playwright` MCP server (project-scoped in
`.mcp.json`). Point it at the Vite server (`http://localhost:8000/...`). Snapshots, screenshots
and console logs are written under `.playwright-mcp/` — Read those files, don't guess.

Typical flow:

1. `browser_navigate` to the page. The tool result already reports the page title and the
   console error count.
2. **Check the console first** (`browser_console_messages` or the log file linked in the
   result): a deck whose slides all render stacked as plain text almost always means Reveal
   failed to initialize (missing script), and a screenshot alone won't tell you why.
3. `browser_take_screenshot` to actually look at the rendered slide;
   `browser_snapshot` (accessibility tree) when you need element refs to click on.

Slide-specific navigation — reveal.js shows one slide at a time, so plan how to reach the one
you care about:

- **Direct URL**: `#/3`, `#/3/2` (horizontal/vertical index) or `#/<section-id>` for slides
  with an `id` attribute, e.g. `http://localhost:8000/demo.html#/themes`.
- **Keyboard**: `browser_press_key` with `ArrowRight` / `ArrowLeft` / `ArrowDown` / `ArrowUp`;
  fragments (step-by-step reveals) advance with the same keys. `Escape` toggles the overview.
- **Reveal API** via `browser_evaluate`: `Reveal.next()`, `Reveal.slide(h, v)`,
  `Reveal.getIndices()`, `Reveal.getTotalSlides()`, `Reveal.isLastSlide()`. Useful to iterate
  over all slides or assert the current position instead of eyeballing it.
- **Query-string modes** for specific features: `?print-pdf` (PDF export layout),
  `?view=scroll` (scroll view), `?transition=fade` etc.

Avoid opening the speaker-notes plugin (`S` key): it spawns a popup window that is awkward to
drive headlessly.

If the playwright MCP tools aren't available, say so explicitly rather than claiming a visual
check was done.
