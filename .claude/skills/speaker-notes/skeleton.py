#!/usr/bin/env python3
"""Print the red-keyword skeleton of a deck's English speaker notes, one line per slide.

Usage (from the repo root):  python3 .claude/skills/speaker-notes/skeleton.py <master>.html

Expands the `<!-- @include ... -->` chapter directives like the dev server does, drops
commented-out slides, then prints, for each `.en-notes` block, only the words marked with
<b style="color:red">. Reading this output top to bottom must tell the story of the talk:
if a slide's line is empty or unreadable, its red words are badly chosen. The line count
of each block is shown too (blank lines included).
"""
import re
import sys
from pathlib import Path

INCLUDE = re.compile(r'^[ \t]*<!-- @include (\S+) -->[ \t]*$', re.M)


def expand(path: Path) -> str:
    text = path.read_text(encoding='utf-8')
    return INCLUDE.sub(lambda m: expand(path.parent / m.group(1)), text)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    html = re.sub(r'<!--.*?-->', '', expand(Path(sys.argv[1])), flags=re.S)
    for k, m in enumerate(re.finditer(r'<div class="en-notes">(.*?)</div>', html, re.S)):
        body = m.group(1).strip('\n').rstrip()
        reds = re.findall(r'<b style="color:red">(.*?)</b>', body)
        n_lines = len(body.split('\n')) if body.strip() else 0
        print(f'{k:3d} [{n_lines:2d} lines] ' + (' → '.join(reds) if reds else '(no red keyword)'))


if __name__ == '__main__':
    main()
