async (page) => {
  // Speaker-notes fit check, for the playwright MCP tool `browser_run_code_unsafe`
  // (pass this file as `filename`). Navigate to the deck FIRST (browser_navigate):
  // the script measures the deck currently open in `page`.
  //
  // It renders every slide's notes inside the real speaker-view CSS
  // (plugin/notes/speaker-view.html, "notes-only" layout) and reports, per slide,
  // the number of rendered lines and whether they overflow a 1920x1080 window
  // (full screen) and a 1920x960 one (maximized window: browser chrome + taskbar).
  const deckUrl = page.url();
  await page.goto(deckUrl);
  await page.waitForFunction(() => window.Reveal && Reveal.isReady && Reveal.isReady());
  await page.waitForTimeout(1500); // let jdhp.js (window.onload) style and trim the notes
  const slides = await page.evaluate(() => Reveal.getSlides().map((s, i) => {
    const h = s.querySelector('h3,h2,h1'), h4 = s.querySelector('h4');
    const title = (h ? h.textContent.trim().slice(0, 40) : '(no title)') + (h4 ? ' / ' + h4.textContent.trim().slice(0, 30) : '');
    return { i, idx: Reveal.getIndices(s), title, notes: Reveal.getSlideNotes(s) };
  }));
  const html = await page.evaluate(() => fetch('/plugin/notes/speaker-view.html').then(r => r.text()));
  const sv = await page.context().newPage();
  const res = {};
  for (const H of [1080, 960]) {
    await sv.setViewportSize({ width: 1920, height: H });
    await sv.setContent(html.replace(/<script[\s\S]*?<\/script>/g, ''));
    await sv.evaluate(() => {
      document.body.setAttribute('data-speaker-layout', 'notes-only');
      document.querySelector('.speaker-controls-notes').classList.remove('hidden');
      const cs = document.getElementById('connection-status');
      if (cs) cs.style.display = 'none';
    });
    for (const s of slides) {
      const m = await sv.evaluate((n) => {
        const v = document.querySelector('.speaker-controls-notes .value');
        v.innerHTML = n;
        const c = document.getElementById('speaker-controls');
        return { over: c.scrollHeight - c.clientHeight, lines: Math.round(v.offsetHeight / (parseFloat(getComputedStyle(v).fontSize) * 1.4)) };
      }, s.notes);
      res[s.i] = res[s.i] || { title: s.title, idx: s.idx };
      res[s.i][H] = m;
    }
  }
  await sv.close();
  await page.goto('about:blank'); // don't leave a deck running headless
  const fmt = (m) => (m.over > 0 ? 'OVER+' + m.over + 'px' : 'ok');
  return Object.entries(res).map(([i, r]) =>
    `${i}\t#/${r.idx.h}${r.idx.v ? '/' + r.idx.v : ''}\t~${r[1080].lines} lines\t1080:${fmt(r[1080])}\t960:${fmt(r[960])}\t${r.title}`
  ).join('\n');
}
