// Figure « MCTS pas à pas sur le tic-tac-toe » (deck rl_mcts.html) : jeu
// déterministe à deux joueurs et à somme nulle. Un nœud = une position (le
// coup et la position suivante sont confondus) ; W(v)/N(v) est compté du point
// de vue du joueur qui a joué le coup menant à v.
//
// Le MCTS (mcts.ts, mctsTwoPlayer) est exécuté au chargement de la page avec la
// seed de mcts_config.json ; la figure rejoue sa trace. Éléments reconnus dans
// une <section> :
//
//   <svg class="mcts-fig ttt-tree" data-frames="…" data-initial-frame="0:all">
//        l'arbre (obligatoire) ; un jeton par fragment (frame_steps.js) ;
//   <svg class="mcts-fig ttt-ucb">      les scores UCB1 du nœud courant ;
//   <svg class="mcts-fig ttt-rollout">  la partie aléatoire (playout) ;
//   <div class="mcts-code">             le pseudo-code (lignes [data-ln]).
//
// Jetons de frame « k:événement » : k:init  k:ucb.d  k:expand  k:rollout
// k:backprop (voir GameEvent dans mcts.ts) ; k:all = arbre à la fin de
// l'itération k sans surlignage (0:all = racine seule) ; k:return = idem +
// ligne « return » et coup recommandé.
import * as d3 from 'd3';
import { mctsTwoPlayer } from './mcts';
import type { GameEvent, GameNode, GameRun } from './mcts';
import * as ttt from './tictactoe';
import { COLORS, drawBoard, drawUcbPanel, arrowMarker } from './draw';
import type { G } from './draw';
import { TreeView } from './tree_view';
import { syncWithFragments, highlightLines, isOnCurrentSlide } from './frames';
import config from './mcts_config.json';

const cfg = config.tictactoe;

const { CELL_NAMES } = ttt;

const CODE_LINES: Record<GameEvent['type'] | 'return', number[]> = {
	init: [1, 2], ucb: [3, 4], expand: [5, 6], rollout: [7], backprop: [8, 9, 10, 11], return: [12],
};

interface Frame {
	k: number;
	e: number;
	rest: boolean;
	isReturn: boolean;
	ev: GameEvent | null;
}

// ---------------------------------------------------------------------------
// Exécution du MCTS, une seule pour toute la page.
// ---------------------------------------------------------------------------
const figures = Array.from(document.querySelectorAll<SVGSVGElement>('svg.ttt-tree'));
const tokensOf = (el: Element) => [
	...(el.getAttribute('data-frames') ?? '').split(/\s+/),
	el.getAttribute('data-initial-frame') ?? '', el.getAttribute('data-frame') ?? '',
].filter(Boolean);
const maxK = Math.max(1, ...figures.flatMap(el => tokensOf(el).map(t => parseInt(t, 10) || 0)));
const run: GameRun = mctsTwoPlayer({ root: cfg.root, c: cfg.c, seed: cfg.seed, iterations: maxK, traced: () => true });

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
		console.warn(`mcts_tictactoe: no event "${what}" in iteration ${k} (seed ${cfg.seed})`);
		return { k, e: evs.length - 1, rest: true, isReturn: false, ev: null };
	}
	return { k, e, rest: false, isReturn: false, ev: evs[e] };
}

const isVisible = (n: GameNode, f: Frame) => n.born.k < f.k || (n.born.k === f.k && n.born.e <= f.e);
const statIter = (f: Frame) => (f.rest || f.ev?.type === 'backprop') ? f.k : f.k - 1;

function pathAt(f: Frame): number[] {
	const path = [run.root.id];
	if (f.rest) return path;
	const evs = run.events.get(f.k) ?? [];
	for (let i = 0; i <= f.e; i++) {
		const ev = evs[i];
		if (ev.type === 'ucb') path.push(ev.chosen);
		else if (ev.type === 'expand') path.push(ev.child);
	}
	return path;
}

const phaseOf = (f: Frame): string => {
	if (f.isReturn) return 'Recommendation';
	if (f.rest || !f.ev) return '';
	return { init: 'Selection', ucb: 'Selection', expand: 'Expansion', rollout: 'Simulation', backprop: 'Backpropagation' }[f.ev.type];
};

const fmtW = (w: number) => Number.isInteger(w) ? String(w) : w.toFixed(1);
const resultText = (r: ttt.Player | 'draw') => r === 'draw' ? 'draw' : `${r} wins`;

function caption(f: Frame): string {
	const ev = f.ev;
	if (f.k === 0) return `Root v₀: ${ttt.toMove(cfg.root)} to play`;
	if (f.isReturn) return 'Recommend the most visited move at the root';
	if (f.rest || !ev) return '';
	switch (ev.type) {
		case 'init': return 'Start from the root';
		case 'ucb': {
			const p = ttt.toMove(run.nodes[ev.node].board);
			return `All moves tried, ${p} to play → child with the best UCB1 score for ${p}`;
		}
		case 'expand': {
			const ch = run.nodes[ev.child];
			return `Untried move → new child: ${ch.mover} plays ${CELL_NAMES[ch.move!]}`;
		}
		case 'rollout': {
			const n = ev.boards.length - 1;
			return n === 0 ? `Terminal position: ${resultText(ev.result)}`
				: `Random playout: ${n} move${n > 1 ? 's' : ''} → ${resultText(ev.result)}`;
		}
		case 'backprop': return 'Each node on the path adds the reward of the player who moved into it';
	}
}

// ---------------------------------------------------------------------------
// Dessin des nœuds : plateau + W/N (couleur du joueur qui a joué le coup).
// ---------------------------------------------------------------------------
const BOARD = 34;

function drawNode(g: G, n: GameNode): void {
	drawBoard(g, n.board, BOARD, { last: n.move });
	if (n.depth === 0) {
		g.append('text').attr('x', -BOARD / 2 - 6).attr('y', 0).attr('dy', '0.35em').attr('text-anchor', 'end')
			.attr('font-size', 13).attr('fill', COLORS.ink).text('v₀');
	}
	// W/N sous le plateau ; à la racine (W sans objet), N à droite.
	g.append('text').attr('class', 'wn-label')
		.attr('x', n.depth === 0 ? BOARD / 2 + 5 : 0).attr('y', n.depth === 0 ? -BOARD / 2 + 9 : BOARD / 2 + 13)
		.attr('text-anchor', n.depth === 0 ? 'start' : 'middle')
		.attr('font-size', 12).attr('font-weight', 'bold').attr('fill', n.depth === 0 ? COLORS.muted : COLORS[n.mover]);
}

function setupFigure(treeSvgEl: SVGSVGElement): (token: string | null) => void {
	const section = treeSvgEl.closest('section')!;
	const vb = treeSvgEl.viewBox?.baseVal;
	const W = vb && vb.width ? vb.width : 530, H = vb && vb.height ? vb.height : 400;
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
	const view = new TreeView<GameNode>(svg.append('g') as unknown as G, {
		id: n => n.id,
		box: { x: 6, y: 48 + BOARD / 2 + 6, w: W - 12, h: H - 48 - BOARD / 2 - 8 },
		layerHeight: 76,
		separation: (_a, _b, siblings) => siblings ? 46 : 54,
		pad: { left: 30, right: 30, bottom: 64 },
		maxScale: 1.25,
		halo: () => ({ w: BOARD + 12, h: BOARD + 12, round: false }),
		drawNode,
		updateNode: (g, n) => {
			const st = n.hist.at(statIter(frame));
			g.select('.wn-label').text(n.depth === 0 ? `N=${st.N}` : st.N === 0 ? '' : `${fmtW(st.W)}/${st.N}`);
		},
	});

	const ucbEl = section.querySelector<SVGSVGElement>('svg.ttt-ucb');
	const ucb = ucbEl ? setupUcb(ucbEl) : null;
	const rolloutEl = section.querySelector<SVGSVGElement>('svg.ttt-rollout');
	const rollout = rolloutEl ? setupRollout(rolloutEl) : null;
	const code = section.querySelector('.mcts-code');
	const blueArrow = arrowMarker(svg, 'ttt-tree-arrow-blue', COLORS.blue, 5);

	return (token: string | null) => {
		frame = resolve(token);
		const f = frame;
		const duration = isOnCurrentSlide(treeSvgEl) ? 450 : 0;
		const path = pathAt(f);
		const current = f.rest ? null : path[path.length - 1];
		const children = (n: GameNode) => n.children.filter(ch => isVisible(ch, f)).sort((a, b) => a.move! - b.move!);
		const pos = view.render(run.root, children, { path: new Set(f.rest ? [] : path), current }, duration);

		iterLabel.text(f.k === 0 ? 'Before the first iteration' : `Iteration ${f.k}${f.rest && !f.isReturn ? ' (done)' : ''}`);
		phaseLabel.text(phaseOf(f));
		captionLabel.text(caption(f));

		const ov = view.overlay;
		ov.selectAll('*').remove();
		const ev = f.ev;
		if (ev?.type === 'rollout') {
			const [x, y] = pos.get(ev.from)!;
			const y0 = y + BOARD / 2 + 18;
			if (ev.boards.length > 1) {
				const pts: [number, number][] = [[x, y0]];
				for (let i = 1; i <= 6; i++) pts.push([x + (i % 2 ? 5 : -5), y0 + i * 5]);
				pts[pts.length - 1] = [x, y0 + 30];
				ov.append('path').attr('d', d3.line()(pts)!).attr('fill', 'none').attr('stroke', COLORS.blue)
					.attr('stroke-width', 1.8).attr('stroke-dasharray', '4 2').attr('marker-end', blueArrow);
			}
			const r = ev.result;
			ov.append('text').attr('x', x).attr('y', y0 + (ev.boards.length > 1 ? 44 : 4)).attr('text-anchor', 'middle')
				.attr('font-size', 12).attr('font-weight', 'bold')
				.attr('fill', r === 'draw' ? COLORS.muted : COLORS[r]).text(resultText(r));
		}
		if (ev?.type === 'backprop') {
			for (const st of ev.steps) {
				const n = run.nodes[st.node];
				if (n.depth === 0) continue;
				const [x, y] = pos.get(st.node)!;
				// Pastille sur le coin haut-droit du plateau.
				const bx = x + BOARD / 2 - 6, by = y - BOARD / 2 - 4;
				ov.append('rect').attr('x', bx - 11).attr('y', by - 8).attr('width', 24).attr('height', 16).attr('rx', 3)
					.attr('fill', '#fff').attr('stroke', COLORS[st.mover]).attr('stroke-width', 1.2);
				ov.append('text').attr('x', bx + 1).attr('y', by).attr('dy', '0.35em').attr('text-anchor', 'middle')
					.attr('font-size', 11.5).attr('font-weight', 'bold').attr('fill', COLORS[st.mover])
					.text(st.z === 0.5 ? '+½' : `+${st.z}`);
			}
		}
		if (f.isReturn) {
			const maxN = Math.max(...run.root.children.map(ch => ch.hist.at(f.k).N));
			const best = run.root.children.filter(ch => ch.hist.at(f.k).N === maxN);
			for (const ch of best) {
				const [x, y] = pos.get(ch.id)!;
				ov.append('rect').attr('x', x - BOARD / 2 - 5).attr('y', y - BOARD / 2 - 5).attr('width', BOARD + 10)
					.attr('height', BOARD + 10).attr('rx', 4).attr('fill', 'none').attr('stroke', COLORS.code).attr('stroke-width', 2.5);
				ov.append('text').attr('x', x).attr('y', y - BOARD / 2 - 10).attr('text-anchor', 'middle').attr('font-size', 12)
					.attr('font-weight', 'bold').attr('fill', COLORS.code)
					.text(best.length > 1 ? 'tie' : `play ${CELL_NAMES[ch.move!]}`);
			}
		}

		ucb?.(f);
		rollout?.(f);
		highlightLines(code, f.isReturn ? CODE_LINES.return : f.rest || !ev ? [] : CODE_LINES[ev.type]);
	};
}

// ---------------------------------------------------------------------------
// Panneau UCB1 : une barre par fils, pictogramme = le fils (coup surligné).
// ---------------------------------------------------------------------------
function setupUcb(el: SVGSVGElement): (f: Frame) => void {
	const W = 230, H = 160;
	const svg = d3.select(el).attr('viewBox', `0 0 ${W} ${H}`).classed('mcts-fig', true);
	const g = svg.append('g');
	return f => {
		g.selectAll('*').remove();
		const ev = f.ev;
		if (ev?.type !== 'ucb') {
			g.append('text').attr('x', W / 2).attr('y', H / 2 - 8).attr('text-anchor', 'middle').attr('font-size', 11)
				.attr('fill', COLORS.faint).text('UCB1 scores');
			g.append('text').attr('x', W / 2).attr('y', H / 2 + 8).attr('text-anchor', 'middle').attr('font-size', 10)
				.attr('fill', COLORS.faint).text('(when all moves are tried)');
			return;
		}
		const v = run.nodes[ev.node];
		const p = ttt.toMove(v.board);
		const bars = [...ev.scores].sort((a, b) => run.nodes[a.id].move! - run.nodes[b.id].move!).map(sc => {
			const ch = run.nodes[sc.id];
			return {
				label: '', mean: sc.mean, bonus: sc.bonus, N: sc.N, chosen: sc.id === ev.chosen,
				icon: (ig: G) => drawBoard(ig, ch.board, 18, { last: ch.move }),
			};
		});
		drawUcbPanel(g as unknown as G, W, H, bars, {
			title: `UCB1 for ${p}  (N(v) = ${v.hist.at(f.k - 1).N})`, fontSize: 11, labelSize: 22,
		});
	};
}

// ---------------------------------------------------------------------------
// Bande « playout » : les positions de la partie aléatoire, jusqu'à la fin.
// ---------------------------------------------------------------------------
function setupRollout(el: SVGSVGElement): (f: Frame) => void {
	const W = 260, H = 90, B = 30;
	const svg = d3.select(el).attr('viewBox', `0 0 ${W} ${H}`).classed('mcts-fig', true);
	const g = svg.append('g');
	const arrow = arrowMarker(svg, 'ttt-rollout-arrow', COLORS.blue, 5);
	return f => {
		g.selectAll('*').remove();
		const ev = f.ev?.type === 'rollout' || f.ev?.type === 'backprop'
			? run.events.get(f.k)!.find(e => e.type === 'rollout') as Extract<GameEvent, { type: 'rollout' }>
			: null;
		if (!ev) {
			g.append('text').attr('x', W / 2).attr('y', H / 2).attr('text-anchor', 'middle').attr('font-size', 11)
				.attr('fill', COLORS.faint).text('random playout');
			return;
		}
		g.append('text').attr('x', W / 2).attr('y', 11).attr('text-anchor', 'middle').attr('font-size', 11)
			.attr('fill', COLORS.ink).text('Random playout');
		const n = ev.boards.length;
		const step = Math.min(44, (W - B) / Math.max(1, n - 1));
		const x0 = W / 2 - (step * (n - 1)) / 2;
		ev.boards.forEach((b, i) => {
			const prev = i > 0 ? ev.boards[i - 1] : null;
			const last = prev ? [...b].findIndex((c, j) => c !== prev[j]) : null;
			drawBoard(g.append('g').attr('transform', `translate(${x0 + i * step},${42})`) as unknown as G, b, B, { last });
			if (i > 0) {
				g.append('line').attr('x1', x0 + (i - 1) * step + B / 2 + 2).attr('x2', x0 + i * step - B / 2 - 3)
					.attr('y1', 42).attr('y2', 42).attr('stroke', COLORS.blue).attr('stroke-width', 1.5)
					.attr('stroke-dasharray', '3 2').attr('marker-end', arrow);
			}
		});
		const r = ev.result;
		const zO = r === 'draw' ? '½' : r === 'O' ? '1' : '0';
		const zX = r === 'draw' ? '½' : r === 'X' ? '1' : '0';
		const t = g.append('text').attr('x', W / 2).attr('y', 78).attr('text-anchor', 'middle').attr('font-size', 11.5);
		t.append('tspan').attr('font-weight', 'bold').attr('fill', r === 'draw' ? COLORS.muted : COLORS[r]).text(resultText(r));
		t.append('tspan').attr('fill', COLORS.ink).text('   → reward ');
		t.append('tspan').attr('fill', COLORS.O).attr('font-weight', 'bold').text(`O: ${zO}`);
		t.append('tspan').attr('fill', COLORS.ink).text(', ');
		t.append('tspan').attr('fill', COLORS.X).attr('font-weight', 'bold').text(`X: ${zX}`);
	};
}

for (const el of figures) {
	const render = setupFigure(el);
	if (el.hasAttribute('data-frames')) syncWithFragments(el, render);
	else render(el.getAttribute('data-frame'));
}
