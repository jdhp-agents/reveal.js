#!/usr/bin/env python3
"""Read a deck's English speaker notes aloud with Kokoro-82M and save them as one MP3.

Usage (from the repo root):
    python3 .claude/skills/narrate-deck/narrate.py <master>.html --dry-run
    ~/.venvs/kokoro/bin/python .claude/skills/narrate-deck/narrate.py <master>.html [options]

Expands the `<!-- @include ... -->` chapter directives like the dev server does, drops
commented-out slides, then takes the `.en-notes` block of every slide in deck order, turns it
into plain spoken text (tags stripped, stage directions such as [click] turned into pauses)
and synthesizes it on CPU. Slides with empty notes are skipped. Writes the MP3 and, next to
it, a `.txt` list of the time at which each slide starts.

--dry-run only prints the text that would be read, slide by slide, with warnings on what a
TTS reads badly; it needs neither the venv nor the model. Slide numbers are the `#k` it
prints (same numbering as speaker-notes/skeleton.py) and are what --slides expects.
"""
import argparse
import html
import re
import sys
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
INCLUDE = re.compile(r'^[ \t]*<!--\s*@include\s+(\S+?)\s*-->[ \t]*$', re.M)
STAGE = re.compile(r'<i[^>]*>\s*\[[^\]]*\]\s*</i>|^[ \t]*\[[^\]\n]*\][ \t]*$', re.M)
QUOTES = str.maketrans({'’': "'", '‘': "'", '“': '"', '”': '"'})

SAMPLE_RATE = 24000    # Kokoro output rate
PAUSE_PARAGRAPH = 0.6  # seconds of silence between paragraphs (and at each [click])
PAUSE_SLIDE = 1.5      # seconds of silence between two slides
WORDS_PER_MINUTE = 150  # af_heart at speed 1.0, for the --dry-run estimate

# Pronunciation fixes, applied to the spoken text only (the notes stay as written).
# Key: regex on the notes text; value: a respelling ("Hero") or misaki's inline phoneme
# syntax "[word](/phonemes/)". By default all-caps words are spelled out letter by letter.
RESPELL: dict[str, str] = {
    # r'\bHIRO\b': '[HIRO](/hˈɪɹO/)',
    r'\bHIerarchical\b': 'Hierarchical',  # acronym-style capitals, otherwise read "H ierarchical"
    r'\bUP\b': 'Up',  # action names in capitals, otherwise spelled "U P", "D O W N"
    r'\bDOWN\b': 'Down',
    r'\bv, a\b': 'v, [a](/ˈA/)',  # the variable a (state-action pair), otherwise read as the article
}

# Things a TTS reads badly or not at all: the notes should be fixed, not the script.
LINT = {
    'TODO left in the notes': re.compile(r'\bTODO\b'),
    'LaTeX (say the formula in words)': re.compile(r'\\[(\[a-zA-Z]|\$'),
    'list bullet (write sentences)': re.compile(r'^[ \t]*[-*•] ', re.M),
}


def expand(path: Path) -> str:
    text = path.read_text(encoding='utf-8')

    def include(m: re.Match) -> str:
        target = m.group(1)
        return expand(ROOT / target[1:] if target.startswith('/') else path.parent / target)

    return INCLUDE.sub(include, text)


def spoken(notes: str) -> tuple[list[str], list[str]]:
    """Paragraphs to read for one notes block, and lint warnings about it."""
    text = html.unescape(re.sub(r'<[^>]+>', '', STAGE.sub('\n\n', notes))).translate(QUOTES)
    problems = [label for label, pattern in LINT.items() if pattern.search(text)]
    for pattern, replacement in RESPELL.items():
        text = re.sub(pattern, replacement, text)
    paragraphs = [' '.join(p.split()) for p in re.split(r'\n[ \t]*\n', text)]
    return [p for p in paragraphs if p], problems


def slides(master: Path) -> list[tuple[int, str, list[str], list[str]]]:
    """(number, heading, paragraphs, warnings) for every .en-notes block, in deck order."""
    page = re.sub(r'<!--.*?-->', '', expand(master), flags=re.S)
    result = []
    for k, m in enumerate(re.finditer(r'<div class="en-notes">(.*?)</div>', page, re.S)):
        start = page.rfind('<section', 0, m.start())
        h = re.search(r'<h[1-6][^>]*>(.*?)</h[1-6]>', page[start:m.start()], re.S)
        heading = ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', h.group(1))).split()) if h else '(no heading)'
        result.append((k, heading, *spoken(m.group(1))))
    return result


def timestamp(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f'{m // 60}:{m % 60:02d}:{s:02d}' if m >= 60 else f'{m:02d}:{s:02d}'


def dry_run(deck: list) -> None:
    for k, heading, paragraphs, problems in deck:
        print(f'#{k} {heading}')
        for p in paragraphs or ['(no notes: skipped)']:
            print(f'    {p}')
        for problem in problems:
            print(f'    WARNING: {problem}')
    words = sum(len(p.split()) for _, _, ps, _ in deck for p in ps)
    empty = [k for k, _, ps, _ in deck if not ps]
    print(f'\n{len(deck)} slides, {len(deck) - len(empty)} with notes, {words} words '
          f'≈ {words / WORDS_PER_MINUTE:.0f} min at speed 1.0')
    if empty:
        print(f'Slides without notes (silent): {" ".join(f"#{k}" for k in empty)}')


def narrate(deck: list, voice: str, speed: float, out: Path) -> None:
    warnings.filterwarnings('ignore')
    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline

    pipeline = KPipeline(lang_code=voice[0], repo_id='hexgrad/Kokoro-82M')
    audio, chapters, length = [], [], 0

    def add(samples: np.ndarray) -> None:
        nonlocal length
        audio.append(samples)
        length += len(samples)

    def silence(seconds: float) -> np.ndarray:
        return np.zeros(int(seconds * SAMPLE_RATE), dtype=np.float32)

    for k, heading, paragraphs, problems in deck:
        if not paragraphs:
            print(f'#{k} (no notes: skipped) {heading}', flush=True)
            continue
        if audio:
            add(silence(PAUSE_SLIDE))
        start = length
        chapters.append(f'{timestamp(start / SAMPLE_RATE)}  #{k}  {heading}')
        for i, paragraph in enumerate(paragraphs):
            if i:
                add(silence(PAUSE_PARAGRAPH))
            for result in pipeline(paragraph, voice=voice, speed=speed, split_pattern=None):
                if result.audio is not None:
                    add(result.audio.numpy())
                dropped = [t.text for t in result.tokens or [] if not t.phonemes and any(c.isalnum() for c in t.text)]
                if dropped:
                    print(f'    WARNING: not pronounced: {" ".join(dropped)}')
        print(f'#{k} {(length - start) / SAMPLE_RATE:5.1f}s {heading}', flush=True)
        for problem in problems:
            print(f'    WARNING: {problem}')

    if not audio:
        sys.exit('No notes to read.')
    out.parent.mkdir(parents=True, exist_ok=True)
    sf.write(out, np.concatenate(audio).clip(-1, 1), SAMPLE_RATE, format='MP3')
    out.with_suffix('.txt').write_text('\n'.join(chapters) + '\n', encoding='utf-8')
    print(f'\nWrote {out} ({timestamp(length / SAMPLE_RATE)}, {out.stat().st_size / 1e6:.1f} MB) '
          f'and {out.with_suffix(".txt")}')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('master', type=Path, help='deck to read, e.g. csc-53439-ep_lecture-3_2026.html')
    parser.add_argument('--dry-run', action='store_true', help='print the text to read, no audio')
    parser.add_argument('--voice', default='af_heart', help='English Kokoro voice (a*: US, b*: UK)')
    parser.add_argument('--speed', type=float, default=1.0, help='speech rate (default 1.0)')
    parser.add_argument('--slides', help='only these slides, e.g. 12-15 or 7 (numbers from --dry-run)')
    parser.add_argument('--out', type=Path, help='output MP3 (default: out/<deck>.mp3)')
    args = parser.parse_args()

    deck = slides(args.master)
    out = args.out or ROOT / 'out' / f'{args.master.stem}.mp3'
    if args.slides:
        first, _, last = args.slides.partition('-')
        deck = [s for s in deck if int(first) <= s[0] <= int(last or first)]
        out = args.out or out.with_stem(f'{out.stem}_{args.slides}')
    if args.dry_run:
        dry_run(deck)
    elif not re.fullmatch(r'[ab][fm]_\w+', args.voice):
        sys.exit(f'{args.voice}: not an English Kokoro voice (expected af_*, am_*, bf_* or bm_*)')
    else:
        narrate(deck, args.voice, args.speed, out)


if __name__ == '__main__':
    main()
