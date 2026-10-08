// Figure « les quatre phases d'une itération de MCTS » (deck rl_mcts.html),
// dans le vocabulaire visuel des figures pas à pas : surlignage doré du chemin
// courant, rollout en pointillés bleus, rétropropagation en rouge.
//
// Usage : <svg class="mcts-phases" data-initial-frame="1" data-frames="2 3 4 5"></svg>
// Jeton = nombre de panneaux affichés (1 à 4) ; 5 = + la boucle « repeat ».
import * as d3 from 'd3';
import { COLORS, arrowMarker } from './draw';
import { syncWithFragments } from './frames';

interface PNode { id: string; x: number; y: number; parent?: string; }

// Arbre de base, commun aux quatre panneaux (repère d'un panneau : 200 × 230).
const BASE: PNode[] = [
	{ id: 'r', x: 100, y: 22 },
	{ id: 'a', x: 52, y: 78, parent: 'r' },
	{ id: 'b', x: 148, y: 78, parent: 'r' },
	{ id: 'a1', x: 26, y: 134, parent: 'a' },
	{ id: 'a2', x: 78, y: 134, parent: 'a' },
	{ id: 'b1', x: 126, y: 134, parent: 'b' },
	{ id: 'b2', x: 172, y: 134, parent: 'b' },
	{ id: 'b11', x: 104, y: 190, parent: 'b1' },
];
const NEW: PNode = { id: 'new', x: 148, y: 190, parent: 'b1' };
const PATH = ['r', 'b', 'b1'];
const R = 11;

const TITLES = ['Selection', 'Expansion', 'Simulation', 'Backpropagation'];
const SUBTITLES = [
	'descend with the tree policy (UCB1)',
	'add a new node',
	'random rollout to the end',
	'update N and Q on the path',
];

for (const el of document.querySelectorAll<SVGSVGElement>('svg.mcts-phases')) {
	const W = 900, H = 396, PW = 200, GAP = (W - 4 * PW) / 3;
	const svg = d3.select(el).attr('viewBox', `0 0 ${W} ${H}`).classed('mcts-fig', true);
	const blue = arrowMarker(svg, 'phases-blue', COLORS.blue, 6);
	const red = arrowMarker(svg, 'phases-red', COLORS.code, 6);
	const gold = arrowMarker(svg, 'phases-gold', '#c99400', 6);
	const ink = arrowMarker(svg, 'phases-ink', COLORS.muted, 7);

	const panels = [0, 1, 2, 3].map(i => {
		const g = svg.append('g').attr('transform', `translate(${i * (PW + GAP)}, 0)`).attr('opacity', 0);
		const nodes = i === 0 ? BASE : [...BASE, NEW];
		const byId = new Map(nodes.map(n => [n.id, n]));
		const onPath = (id: string) => PATH.includes(id) || (i > 0 && id === 'new');

		// Arêtes (halo doré sur le chemin), puis nœuds.
		for (const n of nodes.filter(n => n.parent)) {
			const p = byId.get(n.parent!)!;
			if (onPath(n.id) && onPath(p.id)) {
				g.append('line').attr('x1', p.x).attr('y1', p.y).attr('x2', n.x).attr('y2', n.y)
					.attr('stroke', COLORS.highlight).attr('stroke-width', 8).attr('stroke-linecap', 'round').attr('opacity', 0.7);
			}
			g.append('line').attr('x1', p.x).attr('y1', p.y).attr('x2', n.x).attr('y2', n.y)
				.attr('stroke', COLORS.edge).attr('stroke-width', 1.5)
				.attr('stroke-dasharray', n.id === 'new' && i === 1 ? '4 3' : null);
		}
		for (const n of nodes) {
			if (onPath(n.id)) {
				g.append('circle').attr('cx', n.x).attr('cy', n.y).attr('r', R + 5).attr('fill', COLORS.highlight)
					.attr('opacity', n.id === 'new' && i === 1 ? 0.95 : 0.5);
			}
			g.append('circle').attr('cx', n.x).attr('cy', n.y).attr('r', R).attr('fill', '#fff')
				.attr('stroke', COLORS.ink).attr('stroke-width', 1.5)
				.attr('stroke-dasharray', n.id === 'new' && i === 1 ? '3 2' : null);
		}

		if (i === 0) {
			// Flèches de descente le long du chemin.
			for (let j = 1; j < PATH.length; j++) {
				const p = byId.get(PATH[j - 1])!, n = byId.get(PATH[j])!;
				const dx = n.x - p.x, dy = n.y - p.y, len = Math.hypot(dx, dy);
				const ox = -dy / len * 16, oy = dx / len * 16;
				g.append('line').attr('x1', p.x + dx * 0.25 + ox).attr('y1', p.y + dy * 0.25 + oy)
					.attr('x2', p.x + dx * 0.75 + ox).attr('y2', p.y + dy * 0.75 + oy)
					.attr('stroke', '#c99400').attr('stroke-width', 2.2).attr('marker-end', gold);
			}
		}
		if (i === 1) {
			g.append('text').attr('x', NEW.x + 16).attr('y', NEW.y + 4).attr('font-size', 15)
				.attr('font-weight', 'bold').attr('fill', '#c99400').text('new');
		}
		if (i === 2) {
			const pts: [number, number][] = [[NEW.x, NEW.y + R + 2]];
			for (let j = 1; j <= 8; j++) pts.push([NEW.x + (j % 2 ? 7 : -7), NEW.y + R + 2 + j * 7]);
			pts[pts.length - 1] = [NEW.x, NEW.y + R + 2 + 56];
			g.append('path').attr('d', d3.line()(pts)!).attr('fill', 'none').attr('stroke', COLORS.blue)
				.attr('stroke-width', 2.2).attr('stroke-dasharray', '5 3').attr('marker-end', blue);
			g.append('rect').attr('x', NEW.x - 8).attr('y', NEW.y + R + 64).attr('width', 16).attr('height', 16)
				.attr('fill', COLORS.ink).attr('rx', 2);
			g.append('text').attr('x', NEW.x + 14).attr('y', NEW.y + R + 77).attr('font-size', 15)
				.attr('fill', COLORS.blue).attr('font-weight', 'bold').text('G');
		}
		if (i === 3) {
			const chain = [...PATH, 'new'].map(id => byId.get(id)!);
			for (let j = chain.length - 1; j > 0; j--) {
				const n = chain[j], p = chain[j - 1];
				const dx = p.x - n.x, dy = p.y - n.y, len = Math.hypot(dx, dy);
				const ox = dy / len * 17, oy = -dx / len * 17;
				g.append('line').attr('x1', n.x + dx * 0.22 + ox).attr('y1', n.y + dy * 0.22 + oy)
					.attr('x2', n.x + dx * 0.78 + ox).attr('y2', n.y + dy * 0.78 + oy)
					.attr('stroke', COLORS.code).attr('stroke-width', 2.2).attr('marker-end', red);
			}
			g.append('text').attr('x', NEW.x + 16).attr('y', NEW.y + 4).attr('font-size', 15)
				.attr('font-weight', 'bold').attr('fill', COLORS.code).text('G');
		}
		g.append('text').attr('x', PW / 2).attr('y', 310).attr('text-anchor', 'middle').attr('font-size', 21)
			.attr('font-weight', 'bold').attr('fill', COLORS.ink).text(`${i + 1}. ${TITLES[i]}`);
		g.append('text').attr('x', PW / 2).attr('y', 332).attr('text-anchor', 'middle').attr('font-size', 15)
			.attr('fill', COLORS.muted).text(SUBTITLES[i]);
		if (i < 3) {
			g.append('line').attr('x1', PW + 6).attr('x2', PW + GAP - 6).attr('y1', 110).attr('y2', 110)
				.attr('stroke', COLORS.muted).attr('stroke-width', 2).attr('marker-end', ink);
		}
		return g;
	});

	// Boucle « repeat » : du panneau 4 vers le panneau 1, sous les titres.
	const loop = svg.append('g').attr('opacity', 0);
	loop.append('path').attr('d', `M${W - PW / 2},340 C${W - PW / 2},392 ${PW / 2},392 ${PW / 2},340`)
		.attr('fill', 'none').attr('stroke', COLORS.muted).attr('stroke-width', 2).attr('marker-end', ink);
	loop.append('text').attr('x', W / 2).attr('y', 368).attr('text-anchor', 'middle').attr('font-size', 15)
		.attr('fill', COLORS.muted).attr('font-style', 'italic').text('repeat n times, then play the most visited action at the root');

	syncWithFragments(el, token => {
		const k = parseInt(token ?? '4', 10) || 4;
		panels.forEach((g, i) => g.transition().duration(300).attr('opacity', i < k ? 1 : 0));
		loop.transition().duration(300).attr('opacity', k >= 5 ? 1 : 0);
	});
}
