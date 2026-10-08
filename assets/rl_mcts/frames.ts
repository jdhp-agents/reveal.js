// Synchronisation des figures du deck rl_mcts.html avec les fragments de leur
// <section> — même principe que cem_rosenbrock.ts (deck CEM) :
//
//   - la figure porte data-frames="jeton0 jeton1 …" (un jeton par fragment,
//     les fragments étant créés par frame_steps.js) et, optionnellement,
//     data-initial-frame (état avant le premier fragment) ;
//   - la frame courante est le jeton d'indice = plus grand data-fragment-index
//     visible dans la section. Sans état interne : la navigation arrière et
//     l'arrivée en milieu de slide par l'URL fonctionnent d'office.
//
// Ce module injecte aussi les styles CSS partagés par les slides du deck
// (pseudo-code surligné, mise en page), pour que le chapitre reste autonome
// quel que soit le deck maître qui l'inclut.

type RevealApi = {
	on?: (ev: string, cb: () => void) => void;
	getCurrentSlide?: () => HTMLElement | undefined;
};

/** Le plus grand data-fragment-index visible dans la section (−1 si aucun). */
export function currentFragmentIndex(section: HTMLElement): number {
	let idx = -1;
	section.querySelectorAll('.fragment.visible').forEach(fr => {
		const i = parseInt(fr.getAttribute('data-fragment-index') ?? '', 10);
		if (!Number.isNaN(i) && i > idx) idx = i;
	});
	return idx;
}

/**
 * Abonne `render` aux changements de fragment de la section de `el`.
 * `render(token, isActive)` reçoit le jeton de la frame courante (ou
 * data-initial-frame, ou null) ; `isActive` dit si la slide est affichée
 * (utile pour ne lancer les animations que sur la slide visible).
 */
export function syncWithFragments(
	el: Element,
	render: (token: string | null, index: number) => void,
): void {
	const section = el.closest('section') as HTMLElement;
	const tokens = (el.getAttribute('data-frames') ?? '').trim().split(/\s+/).filter(Boolean);
	const initial = el.getAttribute('data-initial-frame');
	let last: string | undefined;
	const update = () => {
		const idx = currentFragmentIndex(section);
		const token = idx < 0 ? initial : tokens[Math.min(idx, tokens.length - 1)] ?? null;
		const key = `${idx}|${token}`;
		if (key === last) return;
		last = key;
		render(token, idx);
	};
	const Reveal = (window as unknown as { Reveal?: RevealApi }).Reveal;
	if (Reveal?.on) {
		for (const ev of ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden']) {
			Reveal.on(ev, update);
		}
	}
	update();
}

/** Vrai si la section de `el` est la slide affichée. */
export function isOnCurrentSlide(el: Element): boolean {
	const Reveal = (window as unknown as { Reveal?: RevealApi }).Reveal;
	const current = Reveal?.getCurrentSlide?.();
	return !!current && current.contains(el);
}

/**
 * Surligne les lignes de pseudo-code (éléments [data-ln] du conteneur) dont le
 * numéro est dans `lines` — même rouge que les fragments highlight-current-red.
 */
export function highlightLines(code: Element | null, lines: number[]): void {
	if (!code) return;
	code.querySelectorAll<HTMLElement>('[data-ln]').forEach(ln => {
		const n = parseInt(ln.dataset.ln ?? '', 10);
		ln.classList.toggle('current', lines.includes(n));
	});
}

const CSS = `
.mcts-code { font-family: inherit; line-height: 1.32; text-align: left; }
.mcts-code [data-ln] { position: relative; white-space: nowrap; transition: color 0.2s; }
.mcts-code [data-ln]::before {
	content: attr(data-ln); position: absolute; left: -1.9em; width: 1.4em;
	text-align: right; color: #aaa; font-size: 75%; top: 0.18em;
}
.mcts-code [data-ln].current { color: #ff2c2d; }
.mcts-code .kw { font-weight: bold; }
.mcts-code .cm { color: #999; font-size: 85%; }
.mcts-code [data-ln].current .cm { color: #ff2c2d; opacity: 0.75; }
/* lignes qui diffèrent entre les deux variantes (slide de comparaison) */
.mcts-code [data-ln].diff { background: #fff1c4; border-radius: 0.2em; }
.mcts-code .i1 { padding-left: 1.2em; } .mcts-code .i2 { padding-left: 2.4em; }
.mcts-code .i3 { padding-left: 3.6em; }
svg.mcts-fig { font-family: "Source Sans Pro", Helvetica, sans-serif; overflow: visible; }
svg.mcts-fig text { user-select: none; }
.mcts-slider { width: 100%; accent-color: #4aa3df; }
`;

if (!document.getElementById('rl-mcts-styles')) {
	const style = document.createElement('style');
	style.id = 'rl-mcts-styles';
	style.textContent = CSS;
	document.head.appendChild(style);
}
