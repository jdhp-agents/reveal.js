// Figure « structure de l'arbre de recherche » (deck rl_mcts.html) :
//   - stochastic : nœuds état (décision : l'agent choisit a) et nœuds action
//     (chance : le simulateur tire s′ ~ P(·|s, a)), sur FrozenLake ;
//   - deterministic : un nœud = une position, une arête = un coup, l'état
//     suivant est une fonction de (s, a) : pas de nœud de chance (tic-tac-toe).
//
// Usage : <svg class="node-types" data-variant="stochastic|deterministic|both"></svg>
// Option data-frames="…" : jeton « 1 » = annotations visibles (sinon toujours visibles).
import * as d3 from 'd3';
import { FrozenLake, ACTION_ARROWS } from './frozenlake';
import type { Action } from './frozenlake';
import * as ttt from './tictactoe';
import { COLORS, drawLakeThumb, drawBoard, fraction } from './draw';
import type { G } from './draw';
import { syncWithFragments } from './frames';
import config from './mcts_config.json';

const env = new FrozenLake(config.frozenlake.map);
const s0 = config.frozenlake.root;
const W1 = 520, H1 = 340;

const edge = (g: G, x1: number, y1: number, x2: number, y2: number, dashed = false) =>
	g.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2)
		.attr('stroke', COLORS.edge).attr('stroke-width', 1.5).attr('stroke-dasharray', dashed ? '3 3' : null);

function note(g: G, x: number, y: number, lines: string[], color: string = COLORS.ink, anchor = 'start'): void {
	const t = g.append('text').attr('x', x).attr('y', y).attr('font-size', 14).attr('fill', color).attr('text-anchor', anchor);
	lines.forEach((l, i) => t.append('tspan').attr('x', x).attr('dy', i === 0 ? 0 : '1.2em')
		.attr('font-weight', i === 0 ? 'bold' : 'normal').text(l));
}

/** Arbre stochastique : s₀ → actions → issues (avec probabilités). */
function drawStochastic(g: G, notes: G): void {
	const T = 40;
	const root: [number, number] = [166, 40];
	const acts: { a: Action; x: number }[] = [{ a: 0, x: 76 }, { a: 1, x: 262 }];
	const ay = 125, sy = 215;
	for (const { a, x } of acts) {
		edge(g, root[0], root[1], x, ay);
		const outs = [...env.transition(s0, a)].sort((p, q) => p[0] - q[0]);
		outs.forEach(([next, p], i) => {
			const sx = x + (i - (outs.length - 1) / 2) * 54;
			edge(g, x, ay, sx, sy);
			// (étiquette aux 3/5 de l'arête, là où les arêtes sœurs sont assez écartées)
			g.append('text').attr('x', x + (sx - x) * 0.6 + (sx > x ? 4 : -4)).attr('y', ay + (sy - ay) * 0.6 + 2)
				.attr('text-anchor', sx <= x ? 'end' : 'start')
				.attr('font-size', 12).attr('fill', COLORS.muted).text(fraction(p));
			drawLakeThumb(g.append('g').attr('transform', `translate(${sx},${sy})`) as unknown as G, env, next, T);
			g.append('text').attr('x', sx).attr('y', sy + T / 2 + 14).attr('text-anchor', 'middle').attr('font-size', 12)
				.attr('fill', env.isTerminal(next) ? COLORS.code : COLORS.ink).text(`s′=${next}${env.cell(next) === 'H' ? ' (H)' : ''}`);
		});
	}
	drawLakeThumb(g.append('g').attr('transform', `translate(${root[0]},${root[1]})`) as unknown as G, env, s0, T + 4);
	for (const { a, x } of acts) {
		g.append('circle').attr('cx', x).attr('cy', ay).attr('r', 13).attr('fill', '#fff').attr('stroke', COLORS.ink).attr('stroke-width', 1.5);
		g.append('text').attr('x', x).attr('y', ay).attr('dy', '0.36em').attr('text-anchor', 'middle')
			.attr('font-size', 19).attr('font-weight', 'bold').text(ACTION_ARROWS[a]);
	}
	note(notes, 216, 30, ['state node v (decision)', 'the agent chooses a — stores N(v)'], COLORS.ink);
	note(notes, 288, 120, ['action node (v, a) (chance)', 'the simulator draws s′ ~ P(·|s, a)', 'stores N(v, a), Q(v, a)'], COLORS.blue);
	note(notes, 168, 282, ['2 of the 4 actions shown; each action node has', 'up to 3 children, one per sampled outcome s′'], COLORS.muted, 'middle');
}

/** Arbre déterministe : position → positions suivantes (un coup par arête), deux niveaux. */
function drawDeterministic(g: G, notes: G): void {
	const B = 40;
	const rootBoard = config.tictactoe.root;
	const root: [number, number] = [170, 30];
	const cy = 135, gy = 245;
	const label = (x: number, y: number, text: string, color: string) =>
		g.append('text').attr('x', x).attr('y', y).attr('text-anchor', 'middle').attr('font-size', 12)
			.attr('fill', color).text(text);
	const children = [1, 2, 3].map((m, i) => ({ m, x: 60 + i * 110 }));
	for (const { x } of children) edge(g, root[0], root[1], x, cy);
	edge(g, root[0], root[1], 380, cy - 25, true);
	g.append('text').attr('x', 386).attr('y', cy - 20).attr('font-size', 16).attr('fill', COLORS.muted).text('…');
	// Deux réponses de X sous le premier fils : les joueurs alternent.
	const first = ttt.play(rootBoard, children[0].m);
	const replies = [2, 6].map((m, i) => ({ m, x: 30 + i * 100 }));
	// (arêtes partant sous l'étiquette du coup, pour ne pas la barrer)
	const fromY = cy + B / 2 + 20;
	for (const { x } of replies) edge(g, children[0].x, fromY, x, gy - B / 2);
	edge(g, children[0].x, fromY, 170, gy - 20, true);
	g.append('text').attr('x', 174).attr('y', gy - 16).attr('font-size', 16).attr('fill', COLORS.muted).text('…');

	drawBoard(g.append('g').attr('transform', `translate(${root[0]},${root[1]})`) as unknown as G, rootBoard, B + 4);
	for (const { m, x } of children) {
		drawBoard(g.append('g').attr('transform', `translate(${x},${cy})`) as unknown as G, ttt.play(rootBoard, m), B, { last: m });
		label(x, cy + B / 2 + 15, `O: ${ttt.CELL_NAMES[m]}`, COLORS.O);
	}
	for (const { m, x } of replies) {
		drawBoard(g.append('g').attr('transform', `translate(${x},${gy})`) as unknown as G, ttt.play(first, m), B, { last: m });
		label(x, gy + B / 2 + 15, `X: ${ttt.CELL_NAMES[m]}`, COLORS.X);
	}
	note(notes, 205, 22, ['node v = a position', 'player to move: O'], COLORS.ink);
	note(notes, 290, 190, ['edge = move a, child = s′ = f(s, a):', 'deterministic, no chance node'], COLORS.ink);
	note(notes, 200, 252, ['players alternate:', 'now X to move'], COLORS.X);
	note(notes, 250, 312, ['each node stores N(v), and W(v) for the player who moved into v'], COLORS.muted, 'middle');
}

for (const el of document.querySelectorAll<SVGSVGElement>('svg.node-types')) {
	const variant = el.dataset.variant ?? 'stochastic';
	const both = variant === 'both';
	const svg = d3.select(el).attr('viewBox', `0 0 ${both ? 2 * W1 : W1} ${H1}`).classed('mcts-fig', true);
	const allNotes: G[] = [];
	const panel = (dx: number, title: string | null, fn: (g: G, notes: G) => void) => {
		const g = svg.append('g').attr('transform', `translate(${dx + 10},${title ? 30 : 10})`) as unknown as G;
		const notes = svg.append('g').attr('transform', `translate(${dx + 10},${title ? 30 : 10})`) as unknown as G;
		if (title) {
			svg.append('text').attr('x', dx + W1 / 2).attr('y', 18).attr('text-anchor', 'middle').attr('font-size', 18)
				.attr('font-weight', 'bold').attr('fill', COLORS.ink).text(title);
		}
		fn(g, notes);
		allNotes.push(notes);
	};
	if (variant !== 'deterministic') panel(0, both ? 'Stochastic MDP (FrozenLake)' : null, drawStochastic);
	if (variant !== 'stochastic') panel(both ? W1 : 0, both ? 'Deterministic game (tic-tac-toe)' : null, drawDeterministic);
	if (el.hasAttribute('data-frames')) {
		syncWithFragments(el, token => {
			for (const n of allNotes) n.transition().duration(300).attr('opacity', token === '1' ? 1 : 0);
		});
	}
}
