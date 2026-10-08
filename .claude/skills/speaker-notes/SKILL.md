---
name: speaker-notes
description: Use when asked to write, complete, improve or review the speaker notes of a personal deck (notes présentateur, `<div class="en-notes">` / `.fr-notes`, "ce que je dois dire à l'oral") — e.g. "complète les notes présentateur de csc-53439-ep_lecture-2_2026.html". Turns every slide's notes into a spoken script that can be read aloud as is, with red keywords as the narrative thread, blue for the sentences also written on the slide, fragment cues, and a length that fits one HD screen in the speaker view.
---

# Writing the speaker notes of a personal deck

The author presents in English (as a non-native speaker) and wants, for every slide, notes
that are **exactly what they would say out loud**: they improvise from the red keywords, and
when stress makes them lose their words, they read the script word for word — and the
audience must not notice the difference. So the notes are a spoken script, not documentation.

## Scope

- **Every visible slide** of the master deck the user names: the master's own slides (title,
  outline, part dividers, conclusion) *and* every slide of the chapters it `@include`s.
  Commented-out slides (`<!-- <section> ... </section> -->`) are not shown: skip them.
- Edit the **chapter file** (`decks/<deck>/...html`), never the expanded page. Chapters are
  shared by several masters (`grep -l "@include.*<chapter>" *.html`): keep chapter notes
  free of context that holds for one master only (no "this morning", no date).
- Write the `en-notes` only. Leave `fr-notes` as they are unless the user asks.
- Slides with empty notes get notes; existing notes are rewritten into the spoken format
  (keep their correct facts, drop their written style).

## 1. Gather the material before writing

Notes must describe what is *on screen*, so look at everything first:

- Read each slide's HTML: bullets, formulas, captions, and its **fragments** (sort the
  `data-fragment-index` values: each distinct index = one click; index 0 is the *first*
  click, not the initial state; ignore fragments inside HTML comments).
- **Look at every figure** with the Read tool (`assets/<deck>/*.png|jpg|svg`): describe what
  the audience actually sees ("on the left...", "the big bar at zero...").
- **Videos**: no ffmpeg here. Start the dev server (`run` skill), then build a contact sheet
  with `browser_run_code_unsafe` — create a `<video>` on a page of the dev server origin
  (`page.goto('http://localhost:8000/index.html')` first: `about:blank` can't load it), wait
  for `loadeddata`, seek to ~20 timestamps, `drawImage` each frame into a grid `<canvas>`,
  screenshot the canvas into `.playwright-mcp/`, Read it. Subtitles burnt into the video are
  a good guide for the narration.
- Check facts you will state (scores, years, authors, hyperparameters). The notes are read
  aloud to students: a wrong number is worse than no number.

## 2. Style: spoken, simple, rhythmic

- **One sentence per line.** Short sentences (≈ 8–15 words), simple everyday words, the
  rhythm of speech. Prefer two sentences to a long one with commas. A slightly longer
  sentence may be split at a natural pause (before "and", "but", "because", "so", "which",
  or after a comma): one breath group per line, never a break inside a group of words.
- **Flow: link the sentences, no staccato.** The script must sound like someone explaining,
  not like bullet points read one after the other. Each sentence follows from the previous
  one, with a simple connector — "so", "but", "and then", "because", "that's why", "this
  means that", "in other words", "for example", "by contrast", "until now", "here", "this
  time", "as a result" — or with words that point back ("this problem", "the same", "it").
  Each paragraph opens with a transition from the previous one. Write complete sentences
  with a verb: no telegraphic fragments like "Two parts.", "The question is simple.",
  "First, sample efficiency." or "One cell at a time.". Vary the connectors (not "So," on
  every line), and keep the sentences short: the connector removes the abrupt break, it
  must not make the sentence long. Rhetorical questions to the audience are welcome when
  they are introduced and answered ("So, how can agents do the same?").
  Example — instead of "So, here is the plan for today. / Two parts. / First, hierarchical
  reinforcement learning. / How can an agent solve long and complex tasks, by breaking them
  into smaller subtasks?", write "So, here is the plan for today. / We will cover two
  parts. / The first one is about hierarchical reinforcement learning. / We will see how an
  agent can solve long and complex tasks, by breaking them into smaller subtasks."
  And instead of "The question is simple. / So far, our agents choose one small action at
  each time step. / How can they plan over long horizons, like we humans do?", write
  "Until now, our agents have picked one low-level action per time step. / Humans, by
  contrast, plan over long horizons. / How can agents do the same?"
- Sound improvised, not read: natural openers where they fit — "So,", "Well,", "OK,",
  "Now,", "Look at...", "Why does it work?", "And here is the key point." — and questions to
  the audience, followed by the answer.
- Simple English a French speaker reads comfortably: avoid rare idioms and tongue-twisters.
- **No LaTeX, no markdown, no lists** (the speaker view doesn't render them): say formulas the
  way they are spoken — "Z of s, a", "gamma", "Q star", "one over the square root of N",
  "z i times p i", "Q-bert" rather than "Q*bert".
- Paragraph = one idea, separated by **one blank line**. Typical arc: hook/transition →
  what's on screen → why it works / key insight → limit or link to the next slide.
- Short divider slides (title, "Part 2") get 2–6 lines: a transition, not a lecture.

## 3. Markup

Inside `<div class="en-notes">`, text starts at **column 0** (`jdhp.js` sets
`white-space: pre-wrap`, so indentation would show). Keep the newline after the opening tag
and before `</div>` as in the rest of the file — `jdhp.js` trims them in the speaker view.

- **Red = the narrative thread**: `<b style="color:red">key concept</b>` on the words that
  *must* be said (concepts, names of methods, the punchline). Everything that could be
  rephrased stays black. About 4–10 red spans per slide, mostly a few words each — never a
  whole sentence. Test: reading only the red words of the whole deck tells the story
  (`skeleton.py` below prints exactly that).
- **Blue = also written on the slide**: a note line (a sentence, or one breath group of a
  split sentence) that appears *as is* in the slide's own text is wrapped whole in
  `<span style="color:blue">...</span>`. At a glance, the speaker knows they can read this
  line on the screen, facing the audience, instead of staying glued to the notes. "As is"
  means: same words, same order, contiguous, inside one text block of the slide (title,
  paragraph, bullet, table cell, caption) — the whole slide sentence or a contiguous part
  of it — ignoring only case, punctuation, quotes, emoji and the simple connectors that
  open the line ("So,", "And", "But", "Now,", "OK,", "Well,", "Then", "Also", "First,",
  "Second,", "Finally,", "Because", "Here,", "That's why", "In other words", "For example",
  "By contrast"... — full list in `OPENERS` in `on_slide.py`), with at least 2 words left. A paraphrase, a sentence only partly on the slide, text inside a figure or
  a video, and formulas don't count: they stay black. Red spans inside a blue sentence
  stay red; stage directions are never blue. Don't color by hand: once the notes are
  written, run `on_slide.py --fix` (section 5), which applies exactly this rule and also
  removes blue from sentences that no longer match.
  Example — slide bullet "Where an option is available, the agent can choose it instead of
  a **primitive action**" → note line
  `<span style="color:blue">Where an option is available, the agent can choose it, instead of a primitive action.</span>`.
  Counter-example — slide "First fully differentiable framework for learning options", note
  "It was the first fully differentiable framework to learn options." → stays black.
- **Stage directions** in gray italics, on their own line, preceded by a blank line:
  `<i style="color:gray">[click]</i>` once per fragment step, exactly where the click
  happens; `<i style="color:gray">[play the video]</i>` on video slides. Count the clicks
  against the fragment indices.
- Titles of works in plain `<i>...</i>` if needed. No other HTML (besides the red, blue and
  gray markup above).
- References that are useful to the speaker but not spoken (URLs, papers the notes rely on)
  go in an HTML comment **after** the `en-notes` div, inside the `<aside>`:

```html
	<aside class="notes">
		<div class="fr-notes">
		</div>
		<div class="en-notes">
So, how do we explore in practice?
The simplest family of methods is called <b style="color:red">unstructured exploration</b>.

<i style="color:gray">[click]</i>
In practice, ε is not constant.
Then we <b style="color:red">decrease ε over time</b>, down to a small minimum value.
		</div>
		<!-- Sources:
		- https://lilianweng.github.io/posts/2020-06-07-exploration-drl/
		-->
	</aside>
```

## 4. Length: one HD screen

Each slide's notes must fit, without scrolling, in the speaker view (`S` key, layout
"notes-only") on a 1920×1080 screen — and preferably in a maximized (not full-screen)
window too. In practice: **≤ 20 lines, blank lines and `[click]` lines included**, each line
≤ ~130 characters. Trim by merging or dropping secondary sentences, not by removing
paragraph breaks or stage directions.

## 5. Verify

1. Dev server running (`run` skill). `browser_navigate` to the master deck, then run
   `browser_run_code_unsafe` with `filename: .claude/skills/speaker-notes/measure_notes.js`
   (absolute path). It renders every slide's notes in the real speaker-view CSS and prints,
   per slide, the line count and `ok` / `OVER+Npx` at 1080 and 960 px high. Fix every `OVER`
   at 1080; aim for `ok` at 960 too. It leaves the page on `about:blank`.
2. `python3 .claude/skills/speaker-notes/skeleton.py <master>.html` prints the red words of
   each slide: read it top to bottom as the outline of the talk; a slide with
   "(no red keyword)" or a meaningless chain needs work.
3. `python3 .claude/skills/speaker-notes/on_slide.py <master>.html --fix` colors in blue
   the sentences also written on their slide (rule in section 3) and uncolors stale ones,
   in the master and its chapter files; it prints every blue line with its `file:line`.
   Read that list: each blue line must be readable as is on the slide. Without `--fix`,
   it only checks (exit status 1 if a line must be colored or uncolored).
4. Check the files still parse: same number of `<section>`, `<aside>`, `<div>` opening and
   closing tags in each edited file (comments excluded), and no console error when loading
   the deck. An `Edit` whose `old_string` stops at `</div>` but whose `new_string` adds a
   trailing comment + newline easily leaves a duplicated `</aside>` or a stray blank line —
   look at the result around each Sources comment.
5. Optional visual check: inject one slide's `Reveal.getSlideNotes()` into a page built from
   `/plugin/notes/speaker-view.html` (scripts stripped, `data-speaker-layout="notes-only"`,
   `.speaker-controls-notes` un-hidden) at 1920×1080 and screenshot it. Don't open the real
   speaker view popup (see the `run` skill). Close the browser at the end.

When reporting, list slides whose facts you corrected or could not verify, and any
structural change (e.g. a mention moved from one slide to another).
