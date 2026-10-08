// Synchronisation des figures du deck rl_ppo.html avec les fragments de leur
// <section> — même principe que assets/rl_mcts/frames.ts (dont ce fichier est
// une copie adaptée, pour que le deck reste autonome) :
//
//   - la figure porte data-frames="jeton0 jeton1 …" (un jeton par fragment,
//     les fragments étant créés par frame_steps.js) et, optionnellement,
//     data-initial-frame (état avant le premier fragment) ;
//   - la frame courante est le jeton d'indice = plus grand data-fragment-index
//     visible dans la section. Sans état interne : la navigation arrière et
//     l'arrivée en milieu de slide par l'URL fonctionnent d'office.
//
// Ce module injecte aussi les styles CSS partagés par les slides du deck
// (pseudo-code surligné, lignes « diff » de chaque ingrédient, feuille de
// route, curseurs).

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
 * `render(token, index)` reçoit le jeton de la frame courante (ou
 * data-initial-frame, ou null) et l'indice du fragment courant (−1 avant le
 * premier).
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

/**
 * Branche un curseur <input type="range"> : `onInput(value)` à chaque
 * mouvement ; le curseur perd le focus au relâchement pour que les flèches du
 * clavier pilotent de nouveau reveal.js.
 */
export function bindSlider(input: HTMLInputElement | null, onInput: (v: number) => void): void {
	if (!input) return;
	input.addEventListener('input', () => onInput(parseFloat(input.value)));
	input.addEventListener('change', () => input.blur());
	// les flèches ←/→ sur un curseur ayant le focus ne doivent pas changer de slide
	input.addEventListener('keydown', e => e.stopPropagation());
}

/** Couleurs des quatre ingrédients ajoutés à TD actor-critic (feuille de route, diffs). */
export const INGREDIENT_COLORS = {
	gae: '#009e73',
	reuse: '#e69f00',
	clip: '#cc79a7',
	ent: '#0072b2',
};

const C = INGREDIENT_COLORS;
const tint = (hex: string, a: number) => {
	const n = parseInt(hex.slice(1), 16);
	return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

const CSS = `
.ppo-code { font-family: inherit; line-height: 1.32; text-align: left; }
.ppo-code [data-ln] { position: relative; white-space: nowrap; transition: color 0.2s; border-radius: 0.15em; }
.ppo-code [data-ln]::before {
	content: attr(data-ln); position: absolute; left: -1.9em; width: 1.4em;
	text-align: right; color: #aaa; font-size: 75%; top: 0.18em;
}
.ppo-code [data-ln].current { color: #ff2c2d; }
/* ligne de continuation : même numéro (surlignée avec la ligne), numéro non répété */
.ppo-code [data-ln].cont::before { content: ''; }
.ppo-code .kw { font-weight: bold; }
.ppo-code .cm { color: #999; font-size: 85%; }
.ppo-code [data-ln].current .cm { color: #ff2c2d; opacity: 0.75; }
.ppo-code .i1 { padding-left: 1.2em; } .ppo-code .i2 { padding-left: 2.4em; }
.ppo-code .i3 { padding-left: 3.6em; } .ppo-code .i4 { padding-left: 4.8em; }
/* lignes ajoutées par chaque ingrédient (pseudo-code « diff ») */
.ppo-code .add-gae { background: ${tint(C.gae, 0.13)}; box-shadow: inset 0.22em 0 0 ${C.gae}; }
.ppo-code .add-reuse { background: ${tint(C.reuse, 0.16)}; box-shadow: inset 0.22em 0 0 ${C.reuse}; }
.ppo-code .add-clip { background: ${tint(C.clip, 0.16)}; box-shadow: inset 0.22em 0 0 ${C.clip}; }
.ppo-code .add-ent { background: ${tint(C.ent, 0.12)}; box-shadow: inset 0.22em 0 0 ${C.ent}; }
.ppo-code .gone { color: #bbb; text-decoration: line-through; }
.ppo-c-gae { color: ${C.gae}; } .ppo-c-reuse { color: ${C.reuse}; }
.ppo-c-clip { color: ${C.clip}; } .ppo-c-ent { color: ${C.ent}; }

/* feuille de route : TD AC → +GAE → +réutilisation → +clip → +entropie */
.ppo-roadmap { display: flex; justify-content: center; align-items: stretch; gap: 0.35em; margin: 0.6em 0; }
.ppo-roadmap .step {
	--c: #555; border: 0.12em solid var(--c); border-radius: 0.45em; padding: 0.35em 0.55em;
	color: var(--c); background: #fff; opacity: 0.3; text-align: center; line-height: 1.15;
	display: flex; flex-direction: column; justify-content: center; min-width: 5.2em;
}
.ppo-roadmap .step small { display: block; font-size: 70%; color: inherit; opacity: 0.9; }
.ppo-roadmap .step.done { opacity: 1; }
.ppo-roadmap .step.current { opacity: 1; background: var(--c); color: #fff; }
.ppo-roadmap .arrow { align-self: center; color: #999; }
.ppo-roadmap .step.gae { --c: ${C.gae}; } .ppo-roadmap .step.reuse { --c: ${C.reuse}; }
.ppo-roadmap .step.clip { --c: ${C.clip}; } .ppo-roadmap .step.ent { --c: ${C.ent}; }
.ppo-roadmap .step.ppo { --c: #222; }

svg.ppo-fig { font-family: "Source Sans Pro", Helvetica, sans-serif; overflow: visible; }
svg.ppo-fig text { user-select: none; }
svg.ppo-fig .halo { paint-order: stroke; stroke: #fff; stroke-width: 3px; stroke-linejoin: round; }
.ppo-slider { width: 100%; accent-color: #4aa3df; }
.ppo-slider-row { display: flex; align-items: center; gap: 0.8em; margin: 0 auto; }
.ppo-slider-row .lbl { min-width: 6em; text-align: right; white-space: nowrap; }
`;

if (!document.getElementById('rl-ppo-styles')) {
	const style = document.createElement('style');
	style.id = 'rl-ppo-styles';
	style.textContent = CSS;
	document.head.appendChild(style);
}
