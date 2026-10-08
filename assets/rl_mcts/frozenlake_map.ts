// Figure « l'environnement FrozenLake » (deck rl_mcts.html) : la carte 4×4 de
// Gymnasium et, au fil des fragments, les issues possibles d'une action depuis
// l'état racine du deck (glissement : direction voulue ou l'une des deux
// perpendiculaires, probabilité 1/3 chacune).
//
// Usage : <svg class="frozenlake-map" data-initial-frame="map" data-frames="DOWN LEFT"></svg>
// Jeton = « map » (carte seule + agent) ou un nom d'action (LEFT, DOWN, RIGHT, UP).
import * as d3 from 'd3';
import { FrozenLake, ACTION_NAMES } from './frozenlake';
import type { Action } from './frozenlake';
import { COLORS, drawLake, cellCenter, arrowMarker, fraction } from './draw';
import type { G } from './draw';
import { syncWithFragments } from './frames';
import config from './mcts_config.json';

const env = new FrozenLake(config.frozenlake.map);
const s0 = config.frozenlake.root;

for (const el of document.querySelectorAll<SVGSVGElement>('svg.frozenlake-map')) {
	const cell = 78, M = cell * env.ncol;
	const svg = d3.select(el).attr('viewBox', `-6 -6 ${M + 12} ${M + 46}`).classed('mcts-fig', true);
	drawLake(svg.append('g') as unknown as G, env, cell, { numbers: true });
	const ov = svg.append('g');
	const caption = svg.append('text').attr('x', M / 2).attr('y', M + 28).attr('text-anchor', 'middle')
		.attr('font-size', 17).attr('fill', COLORS.ink);
	const red = arrowMarker(svg, 'map-red', COLORS.red, 5);
	const center = (s: number) => cellCenter(env, s, cell);

	syncWithFragments(el, token => {
		ov.selectAll('*').remove();
		const [ax, ay] = center(s0);
		const a = ACTION_NAMES.indexOf(token ?? 'map') as Action | -1;
		if (a >= 0) {
			// Direction voulue (gris), puis les 3 issues (rouge), étiquetées par leur probabilité.
			const outs = env.outcomes(s0, a as Action);
			const intended = env.move(s0, a as Action);
			const [ix, iy] = center(intended);
			// Direction voulue : large bande grise sous les issues.
			ov.append('line').attr('x1', ax).attr('y1', ay).attr('x2', ax + (ix - ax) * 0.8).attr('y2', ay + (iy - ay) * 0.8)
				.attr('stroke', '#888').attr('stroke-width', 22).attr('stroke-linecap', 'round').attr('opacity', 0.22);
			ov.append('text').attr('x', ax + (ix - ax) * 0.5 + (iy !== ay ? 16 : 0)).attr('y', ay + (iy - ay) * 0.5 + (ix !== ax ? -16 : 0))
				.attr('text-anchor', iy !== ay ? 'start' : 'middle').attr('font-size', 13).attr('font-style', 'italic')
				.attr('fill', '#666').text('intended');
			const agg = env.transition(s0, a as Action);
			for (const [next, p] of agg) {
				const [x, y] = center(next);
				const dx = x - ax, dy = y - ay, len = Math.hypot(dx, dy);
				ov.append('line').attr('x1', ax + dx / len * 18).attr('y1', ay + dy / len * 18)
					.attr('x2', x - dx / len * 16).attr('y2', y - dy / len * 16)
					.attr('stroke', COLORS.red).attr('stroke-width', 3).attr('stroke-dasharray', '6 3').attr('marker-end', red);
				const hole = env.cell(next) === 'H';
				// Étiquette à côté de la pointe, décalée perpendiculairement à la flèche.
				const px = -dy / len * 22, py = dx / len * 22;
				ov.append('text').attr('x', x - dx / len * 26 + px).attr('y', y - dy / len * 26 + py).attr('dy', '0.35em')
					.attr('text-anchor', 'middle')
					.attr('font-size', 17).attr('font-weight', 'bold').attr('fill', hole ? '#fff' : COLORS.red)
					.text(fraction(p));
			}
			const holes = outs.filter(o => env.cell(o.next) === 'H').length;
			caption.text(`${ACTION_NAMES[a]} from s = ${s0}: ${holes ? `${fraction(holes / 3)} chance to fall into a hole` : 'can never fall into a hole'}`);
		} else {
			caption.text(`Agent at s₀ = ${s0}: reach G (+1) without falling into a hole H`);
		}
		ov.append('circle').attr('cx', ax).attr('cy', ay).attr('r', 13).attr('fill', COLORS.red)
			.attr('stroke', '#fff').attr('stroke-width', 2);
	});
}
