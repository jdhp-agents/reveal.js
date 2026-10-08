// Figure « MCTS pas à pas sur FrozenLake » (deck rl_mcts.html) : l'arbre de
// recherche qui grandit, synchronisé avec le pseudo-code et avec une vue de
// l'environnement.
//
// Le MCTS (mcts.ts, variante stochastique à nœuds de chance) est exécuté au
// chargement de la page avec la seed de mcts_config.json ; la figure rejoue sa
// trace. Éléments reconnus dans une <section> :
//
//   <svg class="mcts-fig fl-tree" data-frames="…" data-initial-frame="0:all">
//        l'arbre (obligatoire) ; porte la liste des frames, un jeton par
//        fragment (fragments créés par frame_steps.js) ;
//   <svg class="mcts-fig fl-grid">   la carte, avec la trajectoire courante ;
//   <svg class="mcts-fig fl-ucb">    les scores UCB1 du nœud courant ;
//   <div class="mcts-code">          le pseudo-code (lignes [data-ln]).
//
// Jetons de frame « k:événement » (k = itération) :
//   k:init  k:ucb.d  k:try.d  k:sim.d  k:new.d  k:move.d  k:rollout  k:backprop
//   (d = profondeur de descente, 0 à la racine — voir StochEvent dans mcts.ts),
//   k:all = arbre à la fin de l'itération k, sans surlignage (0:all = racine
//   seule), k:return = idem + ligne « return » et action recommandée.
// Variante statique (sans fragments) : data-frame="k:all" au lieu de data-frames.
import * as d3 from 'd3';
import { FrozenLake, ACTION_ARROWS, ACTION_NAMES } from './frozenlake';
import { mctsStochastic } from './mcts';
import type { StochEvent, StochNode, StateNode, ActionNode, StochRun } from './mcts';
import { COLORS, drawLake, drawLakeThumb, cellCenter, drawUcbPanel, arrowMarker, fraction } from './draw';
import type { G } from './draw';
import { TreeView } from './tree_view';
import { syncWithFragments, highlightLines, isOnCurrentSlide } from './frames';
import config from './mcts_config.json';

const cfg = config.frozenlake;
const env = new FrozenLake(cfg.map);

/** Lignes du pseudo-code surlignées pour chaque type d'événement. */
const CODE_LINES: Record<StochEvent['type'] | 'return', number[]> = {
	init: [1, 2], ucb: [4, 5], try: [6], sim: [7, 8], new: [9, 10], move: [11],
	rollout: [12], backprop: [13, 14, 15, 16], return: [17],
};

interface Frame {
	k: number;
	e: number;
	/** Arbre « au repos » (fin d'itération), sans surlignage. */
	rest: boolean;
	isReturn: boolean;
	ev: StochEvent | null;
}

// ---------------------------------------------------------------------------
// Exécution du MCTS : une seule pour toute la page, assez longue pour la plus
// grande itération citée par les figures.
// ---------------------------------------------------------------------------
const figures = Array.from(document.querySelectorAll<SVGSVGElement>('svg.fl-tree'));
const tokensOf = (el: Element) => [
	...(el.getAttribute('data-frames') ?? '').split(/\s+/),
	el.getAttribute('data-initial-frame') ?? '', el.getAttribute('data-frame') ?? '',
].filter(Boolean);
const maxK = Math.max(1, ...figures.flatMap(el => tokensOf(el).map(t => parseInt(t, 10) || 0)));
const run: StochRun = mctsStochastic(env, {
	root: cfg.root, gamma: cfg.gamma, c: cfg.c, seed: cfg.seed,
	rolloutHorizon: cfg.rolloutHorizon, iterations: maxK, traced: () => true,
});

function resolve(token: string | null): Frame {
	const [kStr, what = 'all'] = (token ?? '0:all').split(':');
	const k = parseInt(kStr, 10) || 0;
	const evs = run.events.get(k) ?? [];
	if (k === 0) return { k: 0, e: 0, rest: true, isReturn: false, ev: null };
	if (what === 'all' || what === 'return') {
		return { k, e: evs.length - 1, rest: true, isReturn: what === 'return', ev: null };
	}
	const [type, dStr] = what.split('.');
	const d = dStr === undefined ? undefined : parseInt(dStr, 10);
	const e = evs.findIndex(ev => ev.type === type && (d === undefined || ('d' in ev && ev.d === d)));
	if (e < 0) {
		console.warn(`mcts_frozenlake: no event "${what}" in iteration ${k} (seed ${cfg.seed})`);
		return { k, e: evs.length - 1, rest: true, isReturn: false, ev: null };
	}
	return { k, e, rest: false, isReturn: false, ev: evs[e] };
}

const isVisible = (n: StochNode, f: Frame) =>
	n.born.k < f.k || (n.born.k === f.k && n.born.e <= f.e);

/** Statistiques affichées : fin de l'itération k pendant/après la rétropropagation. */
const statIter = (f: Frame) => (f.rest || f.ev?.type === 'backprop') ? f.k : f.k - 1;

/** Chemin racine → nœud courant parcouru par l'itération k jusqu'à l'événement e. */
function pathAt(f: Frame): number[] {
	const path = [run.root.id];
	if (f.rest) return path;
	const evs = run.events.get(f.k) ?? [];
	for (let i = 0; i <= f.e; i++) {
		const ev = evs[i];
		if (ev.type === 'ucb') path.push(ev.chosen);
		else if (ev.type === 'try') path.push(ev.action);
		else if (ev.type === 'new' || ev.type === 'move') path.push(ev.state);
	}
	return path;
}

const phaseOf = (f: Frame): string => {
	if (f.isReturn) return 'Recommendation';
	if (f.rest || !f.ev) return '';
	switch (f.ev.type) {
		case 'init': case 'ucb': case 'move': return 'Selection';
		case 'try': case 'new': return 'Expansion';
		case 'sim': return run.nodes[f.ev.action].born.k === f.k ? 'Expansion' : 'Selection';
		case 'rollout': return 'Simulation';
		case 'backprop': return 'Backpropagation';
	}
};

// ---------------------------------------------------------------------------
// Dessin des nœuds
// ---------------------------------------------------------------------------
const THUMB = 34;

function drawNode(g: G, n: StochNode): void {
	if (n.kind === 'state') {
		drawLakeThumb(g, env, n.s, THUMB);
		if (n.depth === 0) {
			g.append('text').attr('x', -THUMB / 2 - 6).attr('y', 0).attr('dy', '0.35em').attr('text-anchor', 'end')
				.attr('font-size', 13).attr('fill', COLORS.ink).text('v₀');
		}
		g.append('text').attr('class', 'n-label').attr('x', THUMB / 2 + 4).attr('y', -THUMB / 2 + 6)
			.attr('font-size', 11).attr('fill', COLORS.muted);
	} else {
		g.append('circle').attr('r', 11).attr('fill', '#fff').attr('stroke', COLORS.ink).attr('stroke-width', 1.4);
		g.append('text').attr('dy', '0.35em').attr('text-anchor', 'middle').attr('font-size', 17)
			.attr('font-weight', 'bold').attr('fill', COLORS.ink).text(ACTION_ARROWS[n.a]);
		g.append('text').attr('class', 'q-label').attr('x', 14).attr('y', -2).attr('font-size', 11.5).attr('fill', COLORS.blue);
		g.append('text').attr('class', 'n-label').attr('x', 14).attr('y', 10).attr('font-size', 11).attr('fill', COLORS.muted);
	}
}

// ---------------------------------------------------------------------------
// Une figure (arbre + grille + panneau UCB + pseudo-code d'une même section)
// ---------------------------------------------------------------------------
function setupFigure(treeSvgEl: SVGSVGElement): (token: string | null) => void {
	const section = treeSvgEl.closest('section')!;
	const vb = treeSvgEl.viewBox?.baseVal;
	const W = vb && vb.width ? vb.width : 470, H = vb && vb.height ? vb.height : 360;
	const svg = d3.select(treeSvgEl);
	if (!vb || !vb.width) svg.attr('viewBox', `0 0 ${W} ${H}`);
	svg.classed('mcts-fig', true);

	const header = svg.append('g').attr('class', 'header');
	const iterLabel = header.append('text').attr('x', 2).attr('y', 14).attr('font-size', 15)
		.attr('font-weight', 'bold').attr('fill', COLORS.ink);
	const phaseLabel = header.append('text').attr('x', W - 2).attr('y', 14).attr('text-anchor', 'end')
		.attr('font-size', 15).attr('font-style', 'italic').attr('fill', COLORS.code);
	const captionLabel = header.append('text').attr('x', 2).attr('y', 33).attr('font-size', 13).attr('fill', COLORS.ink);

	let frame: Frame = resolve(null);
	const view = new TreeView<StochNode>(svg.append('g') as unknown as G, {
		id: n => n.id,
		box: { x: 6, y: 48 + THUMB / 2 + 6, w: W - 12, h: H - 48 - THUMB / 2 - 8 },
		layerHeight: 62,
		separation: (a, _b, siblings) => {
			const base = a.kind === 'state' ? 46 : 76;
			return siblings ? base : base + 10;
		},
		pad: { left: 30, right: 58, bottom: 74 },
		maxScale: 1.25,
		halo: n => n.kind === 'state' ? { w: THUMB + 12, h: THUMB + 12, round: false } : { w: 34, h: 34, round: true },
		drawNode,
		updateNode: (g, n) => {
			const kk = statIter(frame);
			if (n.kind === 'action') {
				const st = n.hist.at(kk);
				g.select('.q-label').text(st.N > 0 ? `Q=${st.Q.toFixed(2)}` : 'Q=–');
				g.select('.n-label').text(`N=${st.N}`);
			} else {
				const st = n.hist.at(kk);
				// N(v) = Σ_a N(v, a) : affiché à la racine seulement (allège la figure).
				g.select('.n-label').text(n.depth === 0 ? `N=${st.N}` : '');
			}
		},
		linkLabel: n => n.kind === 'state' && n.parent ? fraction(n.p) : null,
	});

	const gridSvgEl = section.querySelector<SVGSVGElement>('svg.fl-grid');
	const grid = gridSvgEl ? setupGrid(gridSvgEl) : null;
	const ucbSvgEl = section.querySelector<SVGSVGElement>('svg.fl-ucb');
	const ucb = ucbSvgEl ? setupUcb(ucbSvgEl) : null;
	const code = section.querySelector('.mcts-code');
	const dieMarker = arrowMarker(svg, 'fl-tree-arrow-blue', COLORS.blue, 5);

	return (token: string | null) => {
		frame = resolve(token);
		const f = frame;
		const duration = isOnCurrentSlide(treeSvgEl) ? 450 : 0;
		const path = pathAt(f);
		const current = f.rest ? null : path[path.length - 1];

		// Fils dans un ordre stable : actions dans l'ordre de Gymnasium, issues par état.
		const children = (n: StochNode): StochNode[] => n.kind === 'state'
			? n.children.filter(ch => isVisible(ch, f)).sort((a, b) => a.a - b.a)
			: n.children.filter(ch => isVisible(ch, f)).sort((a, b) => a.s - b.s);
		const pos = view.render(run.root, children, { path: new Set(f.rest ? [] : path), current }, duration);

		iterLabel.text(f.k === 0 ? 'Before the first iteration' : `Iteration ${f.k}${f.rest && !f.isReturn ? ' (done)' : ''}`);
		phaseLabel.text(phaseOf(f));

		// --- Surcouches de l'arbre (dé, rollout, retours rétropropagés) -------
		const ov = view.overlay;
		ov.selectAll('*').remove();
		const ev = f.ev;
		if (ev?.type === 'sim') {
			const [x, y] = pos.get(ev.action)!;
			const lab = ov.append('g').attr('transform', `translate(${x - 16},${y + 20})`);
			drawDie(lab, 0, 0);
			lab.append('text').attr('x', -10).attr('y', 1).attr('dy', '0.35em').attr('text-anchor', 'end')
				.attr('font-size', 11).attr('fill', COLORS.ink)
				.text(`s′ = ${ev.next}${ev.isNew ? ' (new)' : ''}`);
		}
		if (ev?.type === 'rollout') {
			const [x, y] = pos.get(ev.from)!;
			drawRolloutSquiggle(ov, x, y + THUMB / 2 + 2, ev, dieMarker);
		}
		if (ev?.type === 'backprop') {
			for (const st of ev.steps) {
				const [x, y] = pos.get(st.action)!;
				// Sous les étiquettes Q/N, à droite de l'arête vers l'issue tirée.
				ov.append('rect').attr('x', x + 10).attr('y', y + 16).attr('width', 46).attr('height', 17).attr('rx', 3)
					.attr('fill', '#fff').attr('stroke', COLORS.code).attr('stroke-width', 1.2);
				ov.append('text').attr('x', x + 33).attr('y', y + 24.5).attr('dy', '0.35em').attr('text-anchor', 'middle')
					.attr('font-size', 11.5).attr('fill', COLORS.code).text(`G=${st.G.toFixed(2)}`);
			}
		}
		if (f.isReturn) {
			const maxN = Math.max(...run.root.children.map(a => a.hist.at(f.k).N));
			const best = run.root.children.filter(a => a.hist.at(f.k).N === maxN);
			for (const a of best) {
				const [x, y] = pos.get(a.id)!;
				ov.append('circle').attr('cx', x).attr('cy', y).attr('r', 16).attr('fill', 'none')
					.attr('stroke', COLORS.code).attr('stroke-width', 2.5);
				ov.append('text').attr('x', x).attr('y', y - 21).attr('text-anchor', 'middle').attr('font-size', 12)
					.attr('font-weight', 'bold').attr('fill', COLORS.code)
					.text(best.length > 1 ? 'tie' : `play ${ACTION_NAMES[a.a]}`);
			}
		}

		captionLabel.text(caption(f, path));
		grid?.(f, path);
		ucb?.(f);
		highlightLines(code, f.isReturn ? CODE_LINES.return : f.rest || !ev ? [] : CODE_LINES[ev.type]);
	};
}

/** Petit dé (le simulateur tire l'issue) centré en (x, y). */
function drawDie(g: G, x: number, y: number): void {
	const s = 12;
	g.append('rect').attr('x', x - s / 2).attr('y', y - s / 2).attr('width', s).attr('height', s).attr('rx', 2.5)
		.attr('fill', '#fff').attr('stroke', COLORS.ink).attr('stroke-width', 1);
	for (const [dx, dy] of [[-0.25, -0.25], [0, 0], [0.25, 0.25]]) {
		g.append('circle').attr('cx', x + dx * s).attr('cy', y + dy * s).attr('r', 1.2).attr('fill', COLORS.ink);
	}
}

/** Rollout : trait en zigzag pointillé sous la feuille, fin de partie et retour G. */
function drawRolloutSquiggle(g: G, x: number, y: number, ev: Extract<StochEvent, { type: 'rollout' }>, marker: string): void {
	const steps = Math.max(1, Math.min(ev.states.length - 1, 6));
	const len = 40, amp = 6;
	const pts: [number, number][] = [[x, y]];
	for (let i = 1; i <= steps * 2; i++) pts.push([x + (i % 2 ? amp : -amp), y + (len * i) / (steps * 2)]);
	pts[pts.length - 1] = [x, y + len];
	if (ev.states.length > 1) {
		g.append('path').attr('d', d3.line()(pts)!).attr('fill', 'none').attr('stroke', COLORS.blue)
			.attr('stroke-width', 1.8).attr('stroke-dasharray', '4 2').attr('marker-end', marker);
	}
	const last = ev.states[ev.states.length - 1];
	const c = env.cell(last);
	const endY = ev.states.length > 1 ? y + len + 8 : y + 4;
	g.append('rect').attr('x', x - 7).attr('y', endY).attr('width', 14).attr('height', 14).attr('rx', 2)
		.attr('fill', c === 'G' ? COLORS.goal : c === 'H' ? COLORS.hole : COLORS.ice).attr('stroke', COLORS.ink).attr('stroke-width', 0.8);
	g.append('text').attr('x', x).attr('y', endY + 7).attr('dy', '0.35em').attr('text-anchor', 'middle')
		.attr('font-size', 9).attr('font-weight', 'bold').attr('fill', '#fff').text(c === 'F' ? '' : c);
	g.append('text').attr('x', x + 12).attr('y', endY + 7).attr('dy', '0.35em').attr('font-size', 11)
		.attr('fill', COLORS.blue).attr('font-weight', 'bold').text(`G = ${ev.G.toFixed(2)}`);
}

// ---------------------------------------------------------------------------
// Vue de l'environnement : la carte, la trajectoire de la descente (rouge), le
// glissement au moment du tirage, le rollout (bleu pointillé).
// ---------------------------------------------------------------------------
function setupGrid(el: SVGSVGElement): (f: Frame, path: number[]) => void {
	const cell = 34, W = cell * env.ncol, H = cell * env.nrow;
	const svg = d3.select(el).attr('viewBox', `-3 -3 ${W + 6} ${H + 6}`).classed('mcts-fig', true);
	drawLake(svg.append('g') as unknown as G, env, cell, { numbers: true });
	const ov = svg.append('g');
	const red = arrowMarker(svg, 'fl-grid-red', COLORS.red, 5);
	const gray = arrowMarker(svg, 'fl-grid-gray', COLORS.muted, 5);
	const blue = arrowMarker(svg, 'fl-grid-blue', COLORS.blue, 5);
	const center = (s: number) => cellCenter(env, s, cell);

	const arrow = (from: number, to: number, color: string, marker: string, dashed = false, shrink = 9) => {
		const [x1, y1] = center(from), [x2, y2] = center(to);
		const len = Math.hypot(x2 - x1, y2 - y1);
		if (len < 1) return;
		const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
		ov.append('line').attr('x1', x1 + ux * shrink).attr('y1', y1 + uy * shrink)
			.attr('x2', x2 - ux * shrink).attr('y2', y2 - uy * shrink)
			.attr('stroke', color).attr('stroke-width', 2.2).attr('marker-end', marker)
			.attr('stroke-dasharray', dashed ? '4 3' : null);
	};

	return (f, path) => {
		ov.selectAll('*').remove();
		const states = statesOnPath(path);
		for (let i = 1; i < states.length; i++) arrow(states[i - 1], states[i], COLORS.red, red);
		const ev = f.ev;
		let agent = states[states.length - 1];
		if (ev?.type === 'sim') {
			const act = run.nodes[ev.action] as ActionNode;
			const from = act.parent.s;
			if (ev.dir !== act.a) arrow(from, env.move(from, act.a), COLORS.muted, gray, true);
			if (ev.next !== from) arrow(from, ev.next, COLORS.red, red);
			agent = ev.next;
		}
		const ro = rolloutOf(f);
		if (ro) {
			const pts = ro.states.map((s, i) => {
				const [x, y] = center(s);
				// léger décalage pour distinguer les allers-retours sur une même case
				const j = (i % 3 - 1) * 3;
				return [x + j, y + j] as [number, number];
			});
			if (pts.length > 1) {
				ov.append('path').attr('d', d3.line()(pts)!).attr('fill', 'none').attr('stroke', COLORS.blue)
					.attr('stroke-width', 2).attr('stroke-dasharray', '4 2').attr('marker-end', blue);
			}
			agent = ro.states[ro.states.length - 1];
		}
		const [ax, ay] = center(agent);
		ov.append('circle').attr('cx', ax).attr('cy', ay).attr('r', 7).attr('fill', COLORS.red)
			.attr('stroke', '#fff').attr('stroke-width', 1.5);
	};
}

const statesOnPath = (path: number[]) =>
	path.map(id => run.nodes[id]).filter((n): n is StateNode => n.kind === 'state').map(n => n.s);

/** Le rollout de l'itération, pendant les événements rollout et backprop. */
function rolloutOf(f: Frame): Extract<StochEvent, { type: 'rollout' }> | null {
	if (f.ev?.type !== 'rollout' && f.ev?.type !== 'backprop') return null;
	return run.events.get(f.k)!.find(e => e.type === 'rollout') as Extract<StochEvent, { type: 'rollout' }>;
}

/** Légende de la frame : ce que fait la ligne courante, en clair. */
function caption(f: Frame, path: number[]): string {
	const ev = f.ev;
	if (f.k === 0) return `Root v₀: state s₀ = ${cfg.root}`;
	if (f.isReturn) return 'Recommend the most visited action at the root';
	if (f.rest || !ev) return '';
	switch (ev.type) {
		case 'init': return 'Start from the root, empty path';
		case 'ucb': {
			const best = Math.max(...ev.scores.map(x => x.score));
			const tie = ev.scores.filter(x => Math.abs(x.score - best) < 1e-9).length > 1;
			return `s = ${(run.nodes[ev.node] as StateNode).s}: all actions tried → best UCB1 score${tie ? ' (tie broken at random)' : ''}`;
		}
		case 'try': return `s = ${(run.nodes[ev.node] as StateNode).s}: try ${ACTION_NAMES[(run.nodes[ev.action] as ActionNode).a]} for the first time`;
		case 'sim': {
			const act = run.nodes[ev.action] as ActionNode;
			const slip = ev.dir === act.a ? 'no slip' : `slips ${ACTION_NAMES[ev.dir]}`;
			return `Simulator: ${ACTION_NAMES[act.a]} ${slip} → s′ = ${ev.next}, r = ${ev.r}${ev.isNew ? '  (new outcome)' : '  (already in the tree)'}`;
		}
		case 'new': {
			const n = run.nodes[ev.state] as StateNode;
			return `Add the new state node s′ = ${n.s}${n.terminal ? (env.cell(n.s) === 'H' ? ' (hole: terminal)' : ' (goal: terminal)') : ''}`;
		}
		case 'move': return `Go down to the existing child s′ = ${statesOnPath(path).slice(-1)[0]}`;
		case 'rollout': {
			const end = env.cell(ev.states[ev.states.length - 1]);
			const n = ev.states.length - 1;
			if (n === 0) return `Leaf is terminal: nothing to simulate, G = 0`;
			return `Random rollout: ${n} step${n > 1 ? 's' : ''}, ${end === 'G' ? 'reaches the goal' : end === 'H' ? 'falls into a hole' : 'horizon reached'} → G = ${ev.G.toFixed(2)}`;
		}
		case 'backprop': return `Back up G ← r + γG (γ = ${cfg.gamma}) and update N, Q along the path`;
	}
}

// ---------------------------------------------------------------------------
// Panneau des scores UCB1 (affiché pendant les événements « ucb »).
// ---------------------------------------------------------------------------
function setupUcb(el: SVGSVGElement): (f: Frame) => void {
	const W = 170, H = 150;
	const svg = d3.select(el).attr('viewBox', `0 0 ${W} ${H}`).classed('mcts-fig', true);
	const g = svg.append('g');
	return f => {
		g.selectAll('*').remove();
		const ev = f.ev;
		if (ev?.type !== 'ucb') {
			g.append('text').attr('x', W / 2).attr('y', H / 2 - 8).attr('text-anchor', 'middle').attr('font-size', 11)
				.attr('fill', COLORS.faint).text('UCB1 scores');
			g.append('text').attr('x', W / 2).attr('y', H / 2 + 8).attr('text-anchor', 'middle').attr('font-size', 10)
				.attr('fill', COLORS.faint).text('(when all actions are tried)');
			return;
		}
		const v = run.nodes[ev.node] as StateNode;
		const bars = [...ev.scores].sort((x, y) => (run.nodes[x.id] as ActionNode).a - (run.nodes[y.id] as ActionNode).a).map(sc => {
			const a = run.nodes[sc.id] as ActionNode;
			return { label: ACTION_ARROWS[a.a], mean: sc.mean, bonus: sc.bonus, N: sc.N, chosen: sc.id === ev.chosen };
		});
		drawUcbPanel(g as unknown as G, W, H, bars, { title: `UCB1 at s = ${v.s}  (N(v) = ${v.hist.at(f.k - 1).N})`, fontSize: 11, labelSize: 15 });
	};
}

// ---------------------------------------------------------------------------
// Enregistrement des figures de la page.
// ---------------------------------------------------------------------------
for (const el of figures) {
	const render = setupFigure(el);
	if (el.hasAttribute('data-frames')) syncWithFragments(el, render);
	else render(el.getAttribute('data-frame'));
}
