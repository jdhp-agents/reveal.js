// Figure « convergence à la racine » sur FrozenLake (deck rl_mcts.html) : en
// fonction du nombre d'itérations n (échelle log), l'estimation Q(s₀, a) de
// chaque action (à gauche, avec la valeur exacte Q*(s₀, a) en pointillés) et la
// part des visites N(s₀, a)/n (à droite). Même exécution que la figure « après
// n itérations » (frozenlake_long_run.ts).
//
// Usage : <svg class="fl-convergence" data-initial-frame="1" data-frames="2 3"></svg>
// Jeton 1 = courbes Q seules, 2 = + valeurs exactes Q*, 3 = + parts des visites.
import * as d3 from 'd3';
import { ACTION_ARROWS } from './frozenlake';
import { COLORS, uniqueId } from './draw';
import { syncWithFragments } from './frames';
import { qStarRoot, rootActions, ACTION_COLORS, LONG_N } from './frozenlake_long_run';

// Abscisses log-espacées de 4 à LONG_N.
const ns = d3.range(0, 121).map(i => Math.round(Math.exp(Math.log(4) + (i / 120) * (Math.log(LONG_N) - Math.log(4)))))
	.filter((v, i, a) => i === 0 || v !== a[i - 1]);

for (const el of document.querySelectorAll<SVGSVGElement>('svg.fl-convergence')) {
	const W = 960, H = 400, PW = 360, PH = 300, top = 40, gap = 150;
	const svg = d3.select(el).attr('viewBox', `0 0 ${W} ${H}`).classed('mcts-fig', true);

	const panel = (dx: number, title: string, yDomain: [number, number], yFormat: (v: number) => string) => {
		const g = svg.append('g').attr('transform', `translate(${dx},${top})`);
		const x = d3.scaleLog().domain([4, LONG_N]).range([0, PW]);
		const y = d3.scaleLinear().domain(yDomain).range([PH, 0]);
		g.append('g').attr('transform', `translate(0,${PH})`)
			.call(d3.axisBottom(x).tickValues([10, 100, 1000, 10000]).tickFormat(d3.format(',')))
			.attr('font-size', 13);
		g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(v => yFormat(+v))).attr('font-size', 13);
		g.append('text').attr('x', PW / 2).attr('y', -16).attr('text-anchor', 'middle').attr('font-size', 18)
			.attr('font-weight', 'bold').attr('fill', COLORS.ink).text(title);
		g.append('text').attr('x', PW).attr('y', PH + 38).attr('text-anchor', 'end').attr('font-size', 14)
			.attr('fill', COLORS.muted).text('iterations n (log scale)');
		// Les courbes sont coupées au cadre (les toutes premières estimations sont très bruitées).
		const clipId = uniqueId('conv-clip');
		svg.append('clipPath').attr('id', clipId).append('rect').attr('width', PW).attr('height', PH);
		const curves = g.append('g').attr('clip-path', `url(#${clipId})`);
		return { g, x, y, curves };
	};

	// --- Q(s₀, a) en fonction de n, et Q* -------------------------------------
	const left = panel(60, 'Estimate Q(s₀, a) at the root', [0, 0.5], v => v.toFixed(1));
	const qStarG = left.g.append('g');
	rootActions.forEach(a => {
		const pts = ns.map(n => [left.x(n), left.y(Math.max(0, a.hist.at(n).Q))] as [number, number]);
		left.curves.append('path').attr('d', d3.line()(pts)!).attr('fill', 'none')
			.attr('stroke', ACTION_COLORS[a.a]).attr('stroke-width', 2.5);
		qStarG.append('line').attr('x1', 0).attr('x2', PW).attr('y1', left.y(qStarRoot[a.a])).attr('y2', left.y(qStarRoot[a.a]))
			.attr('stroke', ACTION_COLORS[a.a]).attr('stroke-width', 2).attr('stroke-dasharray', '6 4');
		qStarG.append('text').attr('x', PW + 6).attr('y', left.y(qStarRoot[a.a])).attr('dy', '0.35em')
			.attr('font-size', 14).attr('font-weight', 'bold').attr('fill', ACTION_COLORS[a.a])
			.text(`${ACTION_ARROWS[a.a]} Q* = ${qStarRoot[a.a].toFixed(2)}`);
	});

	// --- N(s₀, a) / n en fonction de n ------------------------------------------
	const right = svg.append('g');
	const rp = panel(60 + PW + gap, 'Visit share N(s₀, a) / n', [0, 1], v => `${Math.round(100 * v)}%`);
	right.node()!.appendChild(rp.g.node()!);
	rootActions.forEach(a => {
		const pts = ns.map(n => [rp.x(n), rp.y(a.hist.at(n).N / n)] as [number, number]);
		rp.curves.append('path').attr('d', d3.line()(pts)!).attr('fill', 'none')
			.attr('stroke', ACTION_COLORS[a.a]).attr('stroke-width', 2.5);
		const last = pts[pts.length - 1];
		rp.g.append('text').attr('x', last[0] + 6).attr('y', last[1]).attr('dy', '0.35em').attr('font-size', 15)
			.attr('font-weight', 'bold').attr('fill', ACTION_COLORS[a.a]).text(ACTION_ARROWS[a.a]);
	});

	syncWithFragments(el, token => {
		const k = parseInt(token ?? '3', 10) || 3;
		qStarG.transition().duration(300).attr('opacity', k >= 2 ? 1 : 0);
		right.transition().duration(300).attr('opacity', k >= 3 ? 1 : 0);
	});
}
