// Figure « l'arbre de MCTS après n itérations » sur FrozenLake (deck
// rl_mcts.html) : à gauche l'arbre (élagué des nœuds rarement visités), la
// taille des nœuds et l'épaisseur des arêtes proportionnelles aux visites,
// chaque sous-arbre de la racine teinté de la couleur de son action ; à droite
// les statistiques de la racine : part des visites N(s₀, a)/n et estimation
// Q(s₀, a) comparée à la valeur exacte Q*(s₀, a).
//
// Usage : <svg class="fl-overview" data-initial-frame="11" data-frames="100 1000 10000 20000"></svg>
//         <input type="range" class="mcts-slider fl-overview-slider">   (optionnel)
// Jeton = n. Le curseur (échelle log) permet de choisir n librement en direct ;
// le fragment suivant reprend la main.
import * as d3 from 'd3';
import { ACTION_ARROWS, ACTION_NAMES } from './frozenlake';
import type { StochNode, StateNode, ActionNode } from './mcts';
import { COLORS } from './draw';
import { syncWithFragments } from './frames';
import { env, longRun, qStarRoot, rootActions, ACTION_COLORS, LONG_N, fmtN } from './frozenlake_long_run';

const MAX_STATE_DEPTH = 5;

/** Visites d'un nœud à l'itération n (un nœud état compte aussi sa création). */
function visits(node: StochNode, n: number): number {
	return node.kind === 'action' ? node.hist.at(n).N : node.hist.at(n).N + 1;
}

/** Couleur du sous-arbre : celle de l'action de la racine dont il descend. */
function rootActionOf(node: StochNode): number {
	let u: StochNode = node;
	while (u.depth > 0 || u.kind === 'action') {
		if (u.kind === 'action' && u.depth === 0) return u.a;
		u = u.kind === 'action' ? u.parent : u.parent!;
	}
	return -1;
}

for (const el of document.querySelectorAll<SVGSVGElement>('svg.fl-overview')) {
	const W = 900, H = 420, TREE_W = 560;
	const svg = d3.select(el).attr('viewBox', `0 0 ${W} ${H}`).classed('mcts-fig', true);
	const title = svg.append('text').attr('x', TREE_W / 2).attr('y', 18).attr('text-anchor', 'middle')
		.attr('font-size', 20).attr('font-weight', 'bold').attr('fill', COLORS.ink);
	const subtitle = svg.append('text').attr('x', TREE_W / 2).attr('y', H - 4).attr('text-anchor', 'middle')
		.attr('font-size', 13).attr('fill', COLORS.muted);
	const treeG = svg.append('g');
	const statsG = svg.append('g').attr('transform', `translate(${TREE_W + 40}, 20)`);

	const section = el.closest('section')!;
	const slider = section.querySelector<HTMLInputElement>('input.fl-overview-slider');
	const toSlider = (n: number) => Math.round(1000 * Math.log(n) / Math.log(LONG_N));
	const fromSlider = (v: number) => Math.max(1, Math.round(Math.exp((v / 1000) * Math.log(LONG_N))));

	const render = (n: number) => {
		n = Math.max(1, Math.min(LONG_N, n));
		title.text(`MCTS tree after n = ${fmtN(n)} iteration${n > 1 ? 's' : ''}`);
		const theta = Math.max(1, Math.round(n / 150));
		subtitle.text(theta > 1 ? `nodes visited at least ${theta} times (${fmtN(longRun.nodes.filter(x => x.born.k <= n).length)} nodes in total)` : `all ${longRun.nodes.filter(x => x.born.k <= n).length} nodes`);

		// --- Arbre élagué -----------------------------------------------------
		const keep = (x: StochNode) => x.born.k <= n && visits(x, n) >= theta
			&& !(x.kind === 'state' && x.depth > MAX_STATE_DEPTH);
		const children = (x: StochNode): StochNode[] => x.kind === 'state'
			? x.children.filter(keep).sort((a, b) => a.a - b.a)
			: x.children.filter(keep).sort((a, b) => a.s - b.s);
		const h = d3.hierarchy<StochNode>(longRun.root, children);
		const laid = d3.tree<StochNode>().nodeSize([10, 1]).separation((a, b) => a.parent === b.parent ? 1 : 1.4)(h);
		const nodes = laid.descendants();
		const [minX, maxX] = d3.extent(nodes, d => d.x) as [number, number];
		const depthMax = d3.max(nodes, d => d.depth) ?? 1;
		const layer = Math.min(64, (H - 90) / Math.max(1, depthMax));
		const kx = Math.min(4, (TREE_W - 40) / Math.max(1, maxX - minX));
		const X = (d: d3.HierarchyPointNode<StochNode>) => 20 + (d.x - minX) * kx + (maxX === minX ? (TREE_W - 40) / 2 : 0);
		const Y = (d: d3.HierarchyPointNode<StochNode>) => 50 + d.depth * layer;
		const total = n;

		treeG.selectAll('*').remove();
		treeG.append('g').selectAll('line').data(laid.links()).join('line')
			.attr('x1', d => X(d.source)).attr('y1', d => Y(d.source)).attr('x2', d => X(d.target)).attr('y2', d => Y(d.target))
			.attr('stroke', d => { const a = rootActionOf(d.target.data); return a >= 0 ? ACTION_COLORS[a] : COLORS.edge; })
			.attr('stroke-opacity', 0.75)
			.attr('stroke-width', d => 0.5 + 9 * Math.sqrt(visits(d.target.data, n) / total));
		const ng = treeG.append('g').selectAll('g').data(nodes).join('g')
			.attr('transform', d => `translate(${X(d)},${Y(d)})`);
		ng.filter(d => d.data.kind === 'action').append('circle')
			.attr('r', d => 1.5 + 9 * Math.sqrt(visits(d.data, n) / total))
			.attr('fill', d => ACTION_COLORS[rootActionOf(d.data)]).attr('stroke', '#fff').attr('stroke-width', 0.5);
		ng.filter(d => d.data.kind === 'state').append('rect')
			.attr('x', d => d.depth === 0 ? -9 : -3).attr('y', d => d.depth === 0 ? -9 : -3)
			.attr('width', d => d.depth === 0 ? 18 : 6).attr('height', d => d.depth === 0 ? 18 : 6)
			.attr('fill', d => { const c = env.cell((d.data as StateNode).s); return c === 'H' ? COLORS.hole : c === 'G' ? COLORS.goal : '#fff'; })
			.attr('stroke', COLORS.ink).attr('stroke-width', 0.7);
		// Flèches des actions de la racine.
		ng.filter(d => d.data.kind === 'action' && d.depth === 1).append('text')
			.attr('x', 0).attr('y', -12).attr('text-anchor', 'middle').attr('font-size', 14).attr('font-weight', 'bold')
			.attr('fill', d => ACTION_COLORS[(d.data as ActionNode).a]).text(d => ACTION_ARROWS[(d.data as ActionNode).a]);

		// --- Statistiques de la racine ---------------------------------------
		statsG.selectAll('*').remove();
		const SW = W - TREE_W - 60, rowH = 34;
		const shareX = d3.scaleLinear().domain([0, 1]).range([40, SW]);
		statsG.append('text').attr('x', 0).attr('y', 6).attr('font-size', 15).attr('font-weight', 'bold')
			.attr('fill', COLORS.ink).text('Visit share N(s₀, a) / n');
		rootActions.forEach((a, i) => {
			const st = a.hist.at(n), y = 22 + i * rowH;
			statsG.append('text').attr('x', 18).attr('y', y + 11).attr('text-anchor', 'middle').attr('font-size', 17)
				.attr('font-weight', 'bold').attr('fill', ACTION_COLORS[a.a]).text(ACTION_ARROWS[a.a]);
			statsG.append('rect').attr('x', shareX(0)).attr('y', y).attr('height', 20)
				.attr('width', shareX(st.N / n) - shareX(0)).attr('fill', ACTION_COLORS[a.a]);
			statsG.append('text').attr('x', shareX(st.N / n) + 4).attr('y', y + 14).attr('font-size', 12)
				.attr('fill', COLORS.ink).text(`${Math.round(100 * st.N / n)}%`);
		});
		const qTop = 22 + 4 * rowH + 36;
		const qX = d3.scaleLinear().domain([0, 0.5]).range([40, SW]);
		statsG.append('text').attr('x', 0).attr('y', qTop - 17).attr('font-size', 15).attr('font-weight', 'bold')
			.attr('fill', COLORS.ink).text('Q(s₀, a) estimate vs exact Q*');
		rootActions.forEach((a, i) => {
			const st = a.hist.at(n), y = qTop + i * rowH;
			statsG.append('text').attr('x', 18).attr('y', y + 6).attr('text-anchor', 'middle').attr('font-size', 17)
				.attr('font-weight', 'bold').attr('fill', ACTION_COLORS[a.a]).text(ACTION_ARROWS[a.a]);
			statsG.append('line').attr('x1', qX(0)).attr('x2', qX(0.5)).attr('y1', y + 1).attr('y2', y + 1).attr('stroke', '#eee');
			statsG.append('line').attr('x1', qX(qStarRoot[a.a])).attr('x2', qX(qStarRoot[a.a])).attr('y1', y - 8).attr('y2', y + 10)
				.attr('stroke', COLORS.red).attr('stroke-width', 2.5);
			statsG.append('circle').attr('cx', qX(Math.max(0, st.Q))).attr('cy', y + 1).attr('r', 6).attr('fill', ACTION_COLORS[a.a]);
		});
		const axisY = qTop + 4 * rowH - 14;
		statsG.append('g').attr('transform', `translate(0,${axisY})`)
			.call(d3.axisBottom(qX).ticks(5).tickSizeOuter(0)).attr('font-size', 11);
		const legend = statsG.append('text').attr('x', qX(0)).attr('y', axisY + 36).attr('font-size', 13);
		legend.append('tspan').attr('fill', COLORS.muted).text('● MCTS estimate Q');
		legend.append('tspan').attr('fill', COLORS.red).attr('dx', 14).text('| exact Q* (value iteration)');
		const best = rootActions.reduce((x, y) => y.hist.at(n).N > x.hist.at(n).N ? y : x);
		statsG.append('text').attr('x', 0).attr('y', axisY + 60).attr('font-size', 15).attr('fill', COLORS.code)
			.attr('font-weight', 'bold').text(`Most visited: ${ACTION_NAMES[best.a]} → play ${ACTION_ARROWS[best.a]}`);

		if (slider) slider.value = String(toSlider(n));
		const label = section.querySelector('.fl-overview-n');
		if (label) label.textContent = `n = ${fmtN(n)}`;
	};

	if (slider) {
		slider.min = '0'; slider.max = '1000'; slider.step = '1';
		slider.addEventListener('input', () => render(fromSlider(parseInt(slider.value, 10))));
		// Rend la main au clavier de reveal.js (flèches) après usage du curseur.
		slider.addEventListener('change', () => slider.blur());
	}
	syncWithFragments(el, token => render(parseInt(token ?? '11', 10) || 11));
}
