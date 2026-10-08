#!/usr/bin/env python3
"""Color in blue the speaker-note sentences that are also written, as is, on their slide.

Usage (from the repo root):
    python3 .claude/skills/speaker-notes/on_slide.py <master>.html          # check only
    python3 .claude/skills/speaker-notes/on_slide.py <master>.html --fix    # apply

Processes the master and every chapter file it `@include`s (each slide lives in one file),
skipping commented-out slides. For each line of a `.en-notes` block (one sentence per
line), the sentence is "on the slide" when its words, after dropping case, punctuation,
quotes, emoji and the simple spoken connectors that open the line (So, And, But, Now, OK,
That's why, In other words, For example... see OPENERS), are at least 2 and appear in the
same order, contiguous,
inside one text block of the slide (title, paragraph, bullet, table cell, caption).
Formulas and the content of images/videos never match. Such a line is wrapped whole in
<span style="color:blue">...</span>; a blue line that no longer matches is unwrapped.
Stage directions (<i style="color:gray">[...]</i>) are never blue.

Check mode prints every match (`blue`), every line to color (`ADD`) or to uncolor
(`REMOVE`), and exits with status 1 if there is anything to fix.
"""
import html
import re
import sys
from pathlib import Path

INCLUDE = re.compile(r'^[ \t]*<!-- @include (\S+) -->[ \t]*$', re.M)
BLUE_OPEN, BLUE_CLOSE = '<span style="color:blue">', '</span>'
# Simple spoken connectors that may open a note line without being on the slide
OPENERS = sorted((tuple(o.split()) for o in [
    'so', 'and', 'but', 'now', 'ok', 'okay', 'well', 'then', 'also', 'first', 'second',
    'third', 'finally', 'because', 'here', 'still', 'yet', 'however', 'indeed', 'in fact',
    "that's why", 'this is why', 'in other words', 'for example', 'for instance',
    'by contrast', 'by comparison', 'in comparison', 'until now', 'in practice',
    'of course', 'as a result', 'on top of that', 'this way', 'this time']), key=len, reverse=True)
LEAF = re.compile(r'<section\b[^>]*>(?:(?!<section\b).)*?</section>', re.S)
NOTES = re.compile(r'(<div class="en-notes">)(.*?)(</div>)', re.S)
BLOCK = re.compile(r'</?(?:li|p|h[1-6]|td|th|tr|figcaption|br|div|ul|ol|table|blockquote)\b[^>]*>', re.I)
MATH = re.compile(r'\$\$.*?\$\$|\$[^$\n]*\$|\\\(.*?\\\)|\\\[.*?\\\]', re.S)
NOMATCH = ' \x00 '  # stands for a formula: a "word" no note sentence contains


def chapter_files(path):
    out = [path]
    for m in INCLUDE.finditer(path.read_text(encoding='utf-8')):
        out += chapter_files(path.parent / m.group(1))
    return out


def blank_comments(text):
    """Same length, comments replaced by spaces: offsets stay valid in the original text."""
    return re.sub(r'<!--.*?-->', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), text, flags=re.S)


def words(fragment):
    s = html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).lower()
    s = s.replace('’', "'").replace('‘', "'")
    s = re.sub(r"[^\w\s'\-\x00]|_", ' ', s)
    s = re.sub(r"(?<![\w])['\-]|['\-](?![\w])", ' ', s)  # keep only intra-word ' and -
    return s.split()


def slide_blocks(section):
    s = re.sub(r'<aside\b.*?</aside>', ' ', section, flags=re.S | re.I)
    s = MATH.sub(NOMATCH, s)
    return [' ' + ' '.join(words(b)) + ' ' for b in BLOCK.split(s)]


def on_slide(line, blocks):
    ws = words(line)
    stripped = True
    while stripped:
        stripped = False
        for o in OPENERS:
            if tuple(ws[:len(o)]) == o:
                ws, stripped = ws[len(o):], True
                break
    if len(ws) < 2:
        return False
    needle = ' ' + ' '.join(ws) + ' '
    return any(needle in b for b in blocks)


def process(path, fix):
    text = path.read_text(encoding='utf-8')
    blanked = blank_comments(text)
    edits, report = [], []
    for sec in LEAF.finditer(blanked):
        notes = NOTES.search(blanked, sec.start(), sec.end())
        if not notes:
            continue
        blocks = slide_blocks(text[sec.start():sec.end()])
        body_start = notes.start(2)
        new_lines = []
        for k, line in enumerate(text[body_start:notes.end(2)].split('\n')):
            inner = line
            was_blue = line.startswith(BLUE_OPEN) and line.endswith(BLUE_CLOSE)
            if was_blue:
                inner = line[len(BLUE_OPEN):-len(BLUE_CLOSE)]
            is_stage = inner.lstrip().startswith('<i style="color:gray">')
            blue = bool(inner.strip()) and not is_stage and on_slide(inner, blocks)
            lineno = text.count('\n', 0, body_start) + 1 + k
            if blue or was_blue:
                status = 'blue' if blue == was_blue else ('ADD' if blue else 'REMOVE')
                report.append(f'{path}:{lineno}: {status:6s} {re.sub(r"<[^>]+>", "", inner).strip()}')
            new_lines.append(BLUE_OPEN + inner + BLUE_CLOSE if blue else inner)
        new_body = '\n'.join(new_lines)
        if new_body != text[body_start:notes.end(2)]:
            edits.append((body_start, notes.end(2), new_body))
    if fix and edits:
        for a, b, new in reversed(edits):
            text = text[:a] + new + text[b:]
        path.write_text(text, encoding='utf-8')
    return report, bool(edits)


def main():
    args = [a for a in sys.argv[1:] if a != '--fix']
    if len(args) != 1:
        sys.exit(__doc__)
    fix = '--fix' in sys.argv
    dirty = False
    for path in chapter_files(Path(args[0])):
        report, changed = process(path, fix)
        dirty |= changed
        for r in report:
            print(r)
    if dirty and not fix:
        sys.exit(1)


if __name__ == '__main__':
    main()
