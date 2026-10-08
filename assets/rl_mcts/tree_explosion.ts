// Figure « l'arbre exhaustif explose, MCTS construit un arbre asymétrique »
// (deck rl_mcts.html) : à partir de la position de tic-tac-toe du deck, l'arbre
// de jeu complet (toutes les parties possibles) à gauche, et à droite l'arbre
// construit par MCTS après n itérations — même disposition radiale, même
// échelle de profondeur (un anneau par coup joué).
//
// Usage : <svg class="tree-explosion" data-iterations="200"
//              data-initial-frame="0" data-frames="1"></svg>
// Jeton 0 = arbre complet seul, 1 = + arbre MCTS.
import * as d3 from 'd3';
import { mctsTwoPlayer } from './mcts';
import type { GameNode } from './mcts';
import * as ttt from './tictactoe';
import { COLORS } from './draw';
import { syncWithFragments } from './frames';
import config from './mcts_config.json';

interface TNode { board: string; children: TNode[]; N?: number; }

/** Arbre de jeu complet (un nœud par séquence de coups, pas de fusion des transpositions). */
function fullTree(board: string): TNode {
	return { board, children: ttt.legalMoves(board).map(m => fullTree(ttt.play(board, m))) };
}

function fromMcts(n: GameNode): TNode {
	return { board: n.board, N: n.N, children: n.children.map(fromMcts) };
}

for (const el of document.querySelectorAll<SVGSVGElement>('svg.tree-explosion')) {
	const n = parseInt(el.dataset.iterations ?? '200', 10);
	const W = 860, H = 430, RAD = 175;
	const svg = d3.select(el).attr('viewBox', `0 0 ${W} ${H}`).classed('mcts-fig', true);

	const full = d3.hierarchy(fullTree(config.tictactoe.root), d => d.children);
	const run = mctsTwoPlayer({ root: config.tictactoe.root, c: config.tictactoe.c, seed: config.tictactoe.seed, iterations: n });
	const mcts = d3.hierarchy(fromMcts(run.root), d => d.children);
	const maxDepth = full.height;

	const draw = (h: d3.HierarchyNode<TNode>, cx: number, title: string, sub: string, sized: boolean) => {
		const side = svg.append('g');
		const g = side.append('g').attr('transform', `translate(${cx},${H / 2 + 6})`);
		// Rayon = profondeur (anneaux identiques à gauche et à droite).
		const laid = d3.tree<TNode>().size([2 * Math.PI, RAD])
			.separation((a, b) => (a.parent === b.parent ? 1 : 2) / Math.max(1, a.depth))(h);
		const radius = (d: d3.HierarchyPointNode<TNode>) => (d.depth / maxDepth) * RAD;
		const pt = (d: d3.HierarchyPointNode<TNode>): [number, number] =>
			[radius(d) * Math.sin(d.x), -radius(d) * Math.cos(d.x)];
		for (let k = 1; k <= maxDepth; k++) {
			g.append('circle').attr('r', (k / maxDepth) * RAD).attr('fill', 'none')
				.attr('stroke', '#eee').attr('stroke-width', 1);
		}
		const total = run.root.N;
		g.append('g').selectAll('line').data(laid.links()).join('line')
			.attr('x1', d => pt(d.source)[0]).attr('y1', d => pt(d.source)[1])
			.attr('x2', d => pt(d.target)[0]).attr('y2', d => pt(d.target)[1])
			.attr('stroke', sized ? COLORS.blue : '#b5b5b5')
			.attr('stroke-width', d => sized ? 0.6 + 7 * Math.sqrt((d.target.data.N ?? 0) / total) : 0.35)
			.attr('stroke-opacity', sized ? 0.8 : 0.9);
		g.append('g').selectAll('circle').data(laid.descendants()).join('circle')
			.attr('cx', d => pt(d)[0]).attr('cy', d => pt(d)[1])
			.attr('r', d => sized ? 1.2 + 9 * Math.sqrt((d.data.N ?? 0) / total) : d.depth === 0 ? 4 : 0.9)
			.attr('fill', d => {
				const w = ttt.winner(d.data.board);
				return w === 'X' ? COLORS.X : w === 'O' ? COLORS.O : w === 'draw' ? '#999' : COLORS.ink;
			})
			.attr('fill-opacity', sized ? 0.85 : 1);
		side.append('text').attr('x', cx).attr('y', 18).attr('text-anchor', 'middle').attr('font-size', 20)
			.attr('font-weight', 'bold').attr('fill', COLORS.ink).text(title);
		side.append('text').attr('x', cx).attr('y', H - 4).attr('text-anchor', 'middle').attr('font-size', 15)
			.attr('fill', COLORS.muted).text(sub);
		return side;
	};

	const nFull = full.descendants().length, nLeaves = full.leaves().length;
	draw(full, W * 0.25, 'Exhaustive game tree', `${nFull.toLocaleString('en')} nodes, ${nLeaves.toLocaleString('en')} complete games`, false);
	const right = draw(mcts, W * 0.75, `MCTS tree after n = ${n} iterations`,
		`${mcts.descendants().length} nodes: size ∝ visits, deep only where it matters`, true);

	syncWithFragments(el, token => {
		const show = (parseInt(token ?? '1', 10) || 0) >= 1;
		right.transition().duration(300).attr('opacity', show ? 1 : 0);
	});
}
