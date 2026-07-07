---
name: new-slides
description: Use when creating a new personal slide deck or adding/editing slides in the existing decks at the repo root (csc-53439-ep_*.html, inf581_optimization.html, optimization_cem*.html). Covers the deck boilerplate, the mandatory Reveal.initialize settings (maxScale 4.0, no width/height), the house authoring patterns (fragments with synchronized visuals, MathJax macros, bilingual speaker notes, draft slides), and how to verify the result.
---

# Creating and editing slides in the personal decks

The personal decks are standalone `*.html` files at the repo root; their media live in
`assets/<deck-name>/`. The target style is 3Blue1Brown-like: very technical *and* very
visual — algorithm listings stepped through fragment by fragment with a synchronized visual
alongside. Preserving/extending that interactivity matters more than static layout polish.

## Starting a new deck

Copy an existing deck as the skeleton (`optimization_cem.html` is the smallest) rather than
writing the boilerplate from scratch. A deck needs, in this order:

- Head: `dist/reset.css`, `dist/reveal.css`, a theme (`dist/theme/white.css`,
  `id="theme"`), `dist/plugin/highlight/monokai.css` (`id="highlight-theme"`), and
  `jdhp.css` if the deck uses `section.draft` highlighting.
- Body end: `dist/reveal.js`, then the plugin scripts actually used
  (`dist/plugin/zoom.js`, `notes.js`, `search.js`, `markdown.js`, `highlight.js`,
  `math.js`), then the inline `Reveal.initialize({...})`, then `jdhp.js` **after all other
  scripts** if the deck has `.fr-notes`/`.en-notes` speaker notes (it hides one language;
  note: the `optimization_cem*.html` decks currently have such notes without loading
  `jdhp.js` — load it when touching those decks' notes matters).
- New media go in `assets/<deck-name>/`; prefer SVG over PNG/JPEG for figures (sharp at the
  ~3× scale of 4K screens).
- Add a link to the new deck in the landing page `index.html` (plain static page, ~line 60).

## Reveal.initialize — mandatory settings

See `FORMATS-ECRAN.md` (repo root) for the tested rationale. Non-negotiable in every deck:

- `maxScale: 4.0` — the author presents on 4K screens; without it slides cap at 2× and
  float small in the middle of the display. Harmless on smaller screens.
- **No `width`/`height` keys**: content is calibrated for the default 960×700 canvas;
  overriding them breaks sizing and centering everywhere.
- House defaults: `controls: true`, `progress: true`, `center: true`, `hash: true`,
  `slideNumber: 'h.v'`, plugins `[ RevealZoom, RevealNotes, RevealSearch, RevealMarkdown,
  RevealHighlight, RevealMath.MathJax2 ]` and the `mathjax2` block with the deck's TeX
  macros (`\R`, `\set`, ...).

## Slide authoring patterns (house style)

- Slides are `<section>` elements; titles are `<h3>`. Per-slide tuning goes in inline
  styles on the section, e.g. `<section style="text-align: left; font-size: 65%;">` with
  the title re-centered via `style="text-align: center;"`. Sizes inside slides are always
  relative (`%`, `em`), never absolute pixels.
- Math: inline `$...$` / display `$$...$$` (MathJax2). Deck-wide macros are defined in a
  `$$ \newcommand... $$` block on the **first** slide (e.g. `\vs`/`\ms` for bold
  vector/matrix symbols).
- **Fragment-stepped algorithm with synchronized visual** — the signature pattern:
  - Each algorithm line is a `<span class="fragment highlight-current-red"
    data-fragment-index="N">`, so exactly one line is highlighted per step.
  - The visual alongside is an `<div class="r-stack">` of images stacked in place:
    `<img class="fragment current-visible" data-fragment-index="N" src="..." width="400">`
    — the image with index N shows exactly while line N is highlighted. The first image of
    the stack uses `fragment fade-out` with the first index so something is visible before
    stepping starts.
  - To loop the algorithm several iterations on one slide, nest whole `<ol class="fragment">`
    blocks in an outer `r-stack`, each wrapped in `fragment fade-out` with the index where
    the next iteration takes over (see `optimization_cem.html`, "At each iteration" slide).
  - Keep `data-fragment-index` sequences contiguous and keep listing indices and visual
    indices in lockstep — an off-by-one desynchronizes text and visual.
- Speaker notes: `<aside class="notes">` containing `<div class="fr-notes">` and
  `<div class="en-notes">` (both languages; `jdhp.js` shows one).
- Work-in-progress slides: add class `draft` to the section — `jdhp.css` gives them a
  yellow background so they're easy to spot; remove the class when the slide is done.
- **d3.js-generated figures** (the pattern of `optimization_cem_v2.html`, where static PNGs
  are progressively replaced by figures drawn on the fly — preferred for new figures):
  - d3 v7 is vendored at `lib/d3.v7.min.js` (no CDN; decks must work offline). Load it once
    in the deck's `<head>`.
  - In the slide: `<div class="r-stretch">` wrapping an `<svg>` with an `id`, a `viewBox`
    (~760×420) and `preserveAspectRatio="xMidYMid meet"`.
  - Drawing code goes in its own file `assets/<deck-name>/<figure-name>.js` (named after the
    image it replaces), never inline — the deck HTML must stay light. Reference it with
    `<script src="..."></script>` right after the div, inside the same `<section>`: external
    scripts run in document order (d3 is already loaded from the head) and MathJax skips
    script tags, so each figure stays self-contained in its slide.
  - When reproducing an existing figure, keep its color code (e.g. black objective/samples,
    blue `#4aa3df` / red `#ee6a6a` fits — a validated CVD-safe pair) and compute the curves
    from the real math (actual pdfs, samples placed exactly on the function).
  - The `reveald3` plugin is NOT used (this repo doesn't build it; it targets iframe-embedded
    external d3 pages) — its `Reveal.initialize` references stay commented out. To animate a
    figure with fragments, use `Reveal.on('fragmentshown', ...)` in the figure's JS file.

## Verifying

Follow the `run` skill (`.claude/skills/run/SKILL.md`): dev server via `npm start`
(background task), then drive the deck through the playwright MCP server. Deck HTML edits
only need a page reload — no rebuild. Check the browser console first (an uninitialized
deck renders as stacked plain text), then step through the new fragments with
`browser_press_key` ArrowRight and screenshot to confirm the listing/visual stay in sync.
