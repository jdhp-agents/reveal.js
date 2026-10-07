---
name: narrate-deck
description: Use when asked to generate an audio recording / MP3 / voice-over of a personal deck that reads its English speaker notes aloud (enregistrement audio, lire les notes présentateur, synthèse vocale, text-to-speech, Kokoro) — e.g. "génère l'enregistrement audio de csc-53439-ep_lecture-3_2026.html". Produces one MP3 for the whole deck (chapters included) with the Kokoro-82M TTS model on CPU, plus a list of slide timestamps.
---

# Reading a deck's speaker notes aloud (one MP3)

`narrate.py` (next to this file) reads the `.en-notes` of every slide of a master deck,
in deck order, and writes a single MP3 with the Kokoro-82M model
(https://huggingface.co/hexgrad/Kokoro-82M, Apache-2.0, runs on CPU). It
expands `@include` chapters like the dev server, skips commented-out slides and slides with
empty notes, and turns `[click]`-style stage directions into short pauses. English only:
`.fr-notes` are ignored.

The notes are read **as written**: this skill never edits them. They must already be a
spoken script (the `speaker-notes` skill produces exactly that). If the user hasn't asked
for a rewrite, report text problems instead of fixing them.

## 1. Environment (one-time, already done if the check passes)

    ~/.venvs/kokoro/bin/python -c "import kokoro, soundfile, en_core_web_sm" && echo ready

If it fails, install it (≈ 1.2 GB in the persistent `/home/user` volume, no root needed):

    command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
    ~/.local/bin/uv venv --python 3.12 ~/.venvs/kokoro
    ~/.local/bin/uv pip install --python ~/.venvs/kokoro --torch-backend cpu \
        kokoro soundfile "transformers>=4.45" "spacy>=3.8,<3.9"
    ~/.local/bin/uv pip install --python ~/.venvs/kokoro "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl"

Why each detail matters:

- **Python 3.12 via uv**: `kokoro` requires Python < 3.13 and the container has 3.13
  (and no `ensurepip`, so `python3 -m venv` can't create a venv with pip anyway).
- **`--torch-backend cpu`**: there is no GPU; the default PyPI torch pulls 3–5 GB of
  CUDA libraries and the disk is nearly full.
- **`transformers>=4.45`**: without this floor the resolver falls back to transformers 4.12,
  whose `tokenizers` needs a Rust compiler and fails to build.
- **spaCy model preinstalled**: misaki (Kokoro's English phonemizer) otherwise downloads it
  on first run with `pip`, which uv venvs don't have. Its version must match spaCy's minor
  version (3.8 here).
- No ffmpeg and no system espeak-ng needed: MP3 is written by the libsndfile bundled with
  `soundfile`, and misaki ships its own espeak-ng (`espeakng-loader`) for unknown words.
- The model weights (≈ 330 MB) are downloaded from Hugging Face on the first run and
  cached in `~/.cache/huggingface`. The "unauthenticated requests" warning is harmless.

## 2. Check the text before synthesizing

    python3 .claude/skills/narrate-deck/narrate.py <master>.html --dry-run

This needs neither the venv nor the model. For each slide (`#k` = same numbering as
`speaker-notes/skeleton.py`) it prints the exact text that will be read, one line per
paragraph. It ends with the word count, the estimated duration and the slides without notes.
`WARNING` lines flag what a TTS reads badly: `TODO`, LaTeX, list bullets (a paragraph made of
`- item - item` comes out as one run-on sentence). If there are warnings, or slides
without notes the user may not expect to be silent, tell the user before generating.

## 3. Generate

    ~/.venvs/kokoro/bin/python .claude/skills/narrate-deck/narrate.py <master>.html

Run it as a **background** Bash task (`run_in_background: true`). Synthesis on the 12 CPU
cores takes ≈ 0.25 s per second of audio: ≈ 4–5 min for a 17-min lecture, and longer decks
can exceed the 10-min foreground limit. It prints one line per slide (`#k duration heading`)
as it goes.

Output, in `out/` (gitignored, never commit the audio):

- `out/<master>.mp3`: 24 kHz mono, ≈ 0.45 MB per minute.
- `out/<master>.txt`: start time of each slide (`MM:SS  #k  heading`), useful to find a
  passage or to paste as video/podcast chapters.

Options:

- `--voice`: default `af_heart` (US female, the best-rated voice). Other good English voices,
  per the model's VOICES.md: `af_bella` (US female), `af_nicole` and `bf_emma` (US and UK
  female), `am_michael`, `am_fenrir` and `am_puck` (US male), `bm_george` and `bm_fable`
  (UK male). Use the voice the user names; if they want to choose, generate a short sample
  per candidate with `--slides`.
- `--speed`: `1.0` by default; `0.9` for a slower lecture pace.
- `--slides 12-15` (or `--slides 7`): only those slides, written to `out/<master>_12-15.mp3`.
  Use it for voice samples and to check fixes without regenerating everything.
- `--out path.mp3` to write somewhere else.
- Pause lengths (`PAUSE_PARAGRAPH`, `PAUSE_SLIDE`) are constants at the top of the script.

## 4. Verify and report

You can't listen to the result, so check what you can:

- Every slide that has notes has a line with a non-zero duration, and no
  `WARNING: not pronounced` (a word the phonemizer silently dropped).
- The total duration is close to the `--dry-run` estimate plus pauses.
- `~/.venvs/kokoro/bin/python -c "import soundfile as sf; print(sf.info('out/<master>.mp3'))"`
  reports an MP3 with the expected duration.

Report the path, duration, size and voice, the slides that were silent (no notes), and any
warnings. Ask the user to listen and to name mispronounced words.

**Fixing a pronunciation** without touching the notes: add an entry to `RESPELL` at the top of
`narrate.py`: a regex mapped to a respelling (`r'\bHIRO\b': 'Hero'`) or to misaki's inline
phoneme syntax (`'[HIRO](/hˈɪɹO/)'`). To see how a word is phonemized:

    ~/.venvs/kokoro/bin/python -c "from kokoro import KPipeline; print(KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M').g2p('HIRO and HAC')[0])"

By default, all-caps acronyms are spelled letter by letter (RLHF → "R L H F"), numbers are
read out, and Greek letters are named (β → "beta"). Check the fix with `--slides` on the
affected slide, then regenerate the full MP3.
