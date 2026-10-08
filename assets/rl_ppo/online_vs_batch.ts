// Slide « From online updates to rollouts » : schéma comparant la mise à jour
// online de TD actor-critic (une mise à jour après chaque transition, la
// politique change à chaque pas) et les rollouts (T transitions collectées avec
// θ_old, avantages calculés à rebours, puis mise à jour). Jetons :
//   online    ligne du haut seulement
//   batch     + ligne des rollouts
//   backward  + passe arrière de GAE
//   reuse     + boucle « réutiliser le lot » (partie 2)
import * as d3 from 'd3';
import { syncWithFragments } from './frames';
import { COLORS, arrowMarker, richText } from './draw';

const T = 8;
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number) => String(n).split('').map(d => SUB[+d]).join('');

document.querySelectorAll<SVGSVGElement>('svg.ppo-online-batch').forEach(svgEl => {
	const svg = d3.select(svgEl);
	const headInk = arrowMarker(svg, 'ppo-ob-ink', COLORS.ink, 9);
	const headGae = arrowMarker(svg, 'ppo-ob-gae', COLORS.gae, 12);
	const headReuse = arrowMarker(svg, 'ppo-ob-reuse', COLORS.reuse, 12);
	const x0 = 190, bw = 52, gap = 22;
	const bx = (t: number) => x0 + t * (bw + gap);

	const label = (g: d3.Selection<SVGGElement, unknown, null, undefined>, y: number, title: string, subtitle: string) => {
		g.append('text').attr('x', 0).attr('y', y).attr('font-size', 17).attr('font-weight', 'bold').attr('fill', COLORS.ink).text(title);
		g.append('text').attr('x', 0).attr('y', y + 20).attr('font-size', 14).attr('fill', COLORS.muted).text(subtitle);
	};
	const transition = (g: d3.Selection<SVGGElement, unknown, null, undefined>, t: number, y: number, fill: string, policy: string) => {
		g.append('rect').attr('x', bx(t)).attr('y', y).attr('width', bw).attr('height', 34).attr('rx', 5)
			.attr('fill', fill).attr('stroke', COLORS.cellStroke);
		g.append('text').attr('x', bx(t) + bw / 2).attr('y', y + 17).attr('dy', '0.35em').attr('text-anchor', 'middle')
			.attr('font-size', 14).attr('fill', COLORS.ink).text(`t = ${t}`);
		richText(g.append('text').attr('x', bx(t) + bw / 2).attr('y', y + 50).attr('text-anchor', 'middle')
			.attr('font-size', 13).attr('fill', COLORS.muted), policy);
	};

	// --- ligne 1 : online
	const online = svg.append('g');
	const y1 = 22;
	label(online, y1 + 14, 'Online', 'TD Actor-Critic');
	for (let t = 0; t < T; t++) {
		transition(online, t, y1, COLORS.cell, `θ${sub(t)}`);
		// mise à jour juste après la transition
		const xu = bx(t) + bw + gap / 2;
		online.append('path').attr('d', `M${xu},${y1 + 36} L${xu},${y1 - 2}`).attr('stroke', COLORS.code)
			.attr('stroke-width', 2).attr('marker-end', null);
		online.append('circle').attr('cx', xu).attr('cy', y1 + 17).attr('r', 4).attr('fill', COLORS.code);
	}
	online.append('text').attr('x', bx(T) - gap / 2).attr('y', y1 + 76).attr('text-anchor', 'end').attr('font-size', 14)
		.attr('fill', COLORS.code).text('● update θ, w after every transition, with δₜ only: the future is not known yet');

	// --- ligne 2 : rollouts
	const batch = svg.append('g');
	const y2 = 168;
	label(batch, y2 + 14, 'Rollouts', 'A2C, PPO');
	for (let t = 0; t < T; t++) transition(batch, t, y2, '#d9f0e8', 'θ_{old}');
	const xEnd = bx(T - 1) + bw;
	batch.append('path')
		.attr('d', `M${bx(0)},${y2 + 62} L${bx(0)},${y2 + 70} L${xEnd},${y2 + 70} L${xEnd},${y2 + 62}`)
		.attr('fill', 'none').attr('stroke', COLORS.gae).attr('stroke-width', 2);
	richText(batch.append('text').attr('x', (bx(0) + xEnd) / 2).attr('y', y2 + 90).attr('text-anchor', 'middle').attr('font-size', 15)
		.attr('fill', COLORS.gae), `one batch of T = ${T} transitions, all collected with the same policy θ_{old}`);
	const xu = xEnd + 30;
	batch.append('line').attr('x1', xEnd + 4).attr('x2', xu - 2).attr('y1', y2 + 17).attr('y2', y2 + 17)
		.attr('stroke', COLORS.ink).attr('stroke-width', 1.5).attr('marker-end', headInk);
	batch.append('circle').attr('cx', xu + 8).attr('cy', y2 + 17).attr('r', 8).attr('fill', COLORS.code);
	batch.append('text').attr('x', xu + 8).attr('y', y2 + 50).attr('text-anchor', 'middle').attr('font-size', 13)
		.attr('fill', COLORS.code).text('update');

	// --- passe arrière
	const backward = svg.append('g');
	backward.append('path')
		.attr('d', `M${xEnd - 6},${y2 - 10} C${xEnd - 120},${y2 - 46} ${bx(0) + 120},${y2 - 46} ${bx(0) + 6},${y2 - 10}`)
		.attr('fill', 'none').attr('stroke', COLORS.gae).attr('stroke-width', 2.5).attr('marker-end', headGae);
	backward.append('text').attr('x', (bx(0) + xEnd) / 2).attr('y', y2 - 42).attr('text-anchor', 'middle')
		.attr('font-size', 15).attr('font-weight', 'bold').attr('fill', COLORS.gae)
		.text('compute δₜ, then the advantages backwards: t = T−1, …, 0');

	// --- réutilisation
	const reuse = svg.append('g');
	const cx = xu + 8, cy = y2 + 17;
	reuse.append('path')
		.attr('d', `M${cx + 12},${cy - 6} C${cx + 48},${cy - 50} ${cx - 48},${cy - 50} ${cx - 10},${cy - 10}`)
		.attr('fill', 'none').attr('stroke', COLORS.reuse).attr('stroke-width', 2.5).attr('marker-end', headReuse);
	reuse.append('text').attr('x', cx).attr('y', cy - 46).attr('text-anchor', 'middle').attr('font-size', 15)
		.attr('font-weight', 'bold').attr('fill', COLORS.reuse).text('× K ?');

	syncWithFragments(svgEl, token => {
		const order = ['online', 'batch', 'backward', 'reuse'];
		const i = order.indexOf(token ?? 'online');
		batch.attr('display', i >= 1 ? null : 'none');
		backward.attr('display', i >= 2 ? null : 'none');
		reuse.attr('display', i >= 3 ? null : 'none');
	});
});
