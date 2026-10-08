// Figure « les 6 coups de O à la racine » (deck rl_mcts.html), en deux modes :
//
//   data-mode="puzzle" — l'énigme : jetons « moves » (les 6 coups), « flat »
//     (+ estimation flat Monte Carlo : taux de gain de O sur des parties
//     aléatoires), « minimax » (+ valeur exacte : les coins perdent, X bloque et
//     fait une fourchette ; les bords font nulle) ;
//   data-mode="mcts" — MCTS après n itérations (jeton = n ; même seed que la
//     figure pas à pas) : part des visites N/n, taux de gain W/N de O, coup
//     recommandé. Curseur optionnel <input class="mcts-slider ttt-moves-slider">.
import * as d3 from 'd3';
import { mctsTwoPlayer, mulberry32 } from './mcts';
import * as ttt from './tictactoe';
import { COLORS, drawBoard } from './draw';
import type { G } from './draw';
import { syncWithFragments } from './frames';
import config from './mcts_config.json';

const root = config.tictactoe.root;
const moves = ttt.legalMoves(root);
const LONG_N = 5000;

/** Valeur minimax pour O (au trait à la racine) de chaque coup : 1, ½ ou 0. */
const memo = new Map<string, number>();
const minimaxForO = moves.map(m => 1 - ttt.minimax(ttt.play(root, m), memo));

/** Flat Monte Carlo : récompense moyenne de O sur `R` parties aléatoires par coup. */
function flatMonteCarlo(R: number, seed: number): number[] {
	const uniform = mulberry32(seed);
	return moves.map(m => {
		let total = 0;
		for (let i = 0; i < R; i++) {
			let b = ttt.play(root, m);
			while (!ttt.isTerminal(b)) {
				const legal = ttt.legalMoves(b);
				b = ttt.play(b, legal[Math.min(Math.floor(uniform() * legal.length), legal.length - 1)]);
			}
			total += ttt.reward(b, 'O');
		}
		return total / R;
	});
}

/** La réfutation d'un coup perdant : la réponse de X qui crée une fourchette. */
function refutation(m: number): { board: string; threats: number[] } | null {
	const b = ttt.play(root, m);
	for (const r of ttt.legalMoves(b)) {
		const b2 = ttt.play(b, r);
		if (ttt.minimax(b2, memo) !== 0) continue; // O doit perdre après ce coup de X
		const threats = ttt.legalMoves(b2).filter(c => ttt.winner(b2.slice(0, c) + 'X' + b2.slice(c + 1)) === 'X');
		if (threats.length >= 2) return { board: b2, threats };
	}
	return null;
}

let mctsRun: ReturnType<typeof mctsTwoPlayer> | null = null;
const getRun = () => mctsRun ??= mctsTwoPlayer({ root, c: config.tictactoe.c, seed: config.tictactoe.seed, iterations: LONG_N });

for (const el of document.querySelectorAll<SVGSVGElement>('svg.ttt-moves')) {
	const mode = el.dataset.mode ?? 'puzzle';
	const W = 900, H = 440, CW = W / moves.length, B = 62;
	const svg = d3.select(el).attr('viewBox', `0 0 ${W} ${H}`).classed('mcts-fig', true);
	const fixed = svg.append('g');
	const dyn = svg.append('g');

	moves.forEach((m, i) => {
		const cx = (i + 0.5) * CW;
		drawBoard(fixed.append('g').attr('transform', `translate(${cx},${50})`) as unknown as G, ttt.play(root, m), B, { last: m });
		fixed.append('text').attr('x', cx).attr('y', 50 + B / 2 + 20).attr('text-anchor', 'middle').attr('font-size', 15)
			.attr('fill', COLORS.O).text(ttt.CELL_NAMES[m]);
	});

	const barTop = 150, barH = 112;
	const y = d3.scaleLinear().domain([0, 1]).range([barTop + barH, barTop]);
	const verdict = (g: d3.Selection<SVGGElement, unknown, null, undefined>, top: number) => {
		moves.forEach((m, i) => {
			const cx = (i + 0.5) * CW, v = minimaxForO[i];
			g.append('text').attr('x', cx).attr('y', top).attr('text-anchor', 'middle').attr('font-size', 17)
				.attr('font-weight', 'bold').attr('fill', v === 0 ? COLORS.code : v === 1 ? COLORS.goal : COLORS.muted)
				.text(v === 0 ? 'O loses' : v === 1 ? 'O wins' : 'draw');
			const ref = v === 0 ? refutation(m) : null;
			if (ref) {
				const bg = g.append('g').attr('transform', `translate(${cx},${top + 42})`) as unknown as G;
				const prev = ttt.play(root, m);
				drawBoard(bg, ref.board, 50, { last: [...ref.board].findIndex((c, j) => c !== prev[j]) });
				for (const t of ref.threats) {
					bg.append('circle').attr('cx', ((t % 3) - 1) * 50 / 3).attr('cy', (Math.floor(t / 3) - 1) * 50 / 3)
						.attr('r', 4.5).attr('fill', COLORS.X).attr('opacity', 0.9);
				}
				g.append('text').attr('x', cx).attr('y', top + 84).attr('text-anchor', 'middle').attr('font-size', 13)
					.attr('fill', COLORS.ink).text('X blocks & forks');
			}
		});
	};

	if (mode === 'puzzle') {
		const flat = flatMonteCarlo(20000, 2026);
		const best = Math.max(...flat);
		syncWithFragments(el, token => {
			dyn.selectAll('*').remove();
			const step = token ?? 'moves';
			if (step === 'moves') {
				dyn.append('text').attr('x', W / 2).attr('y', 200).attr('text-anchor', 'middle').attr('font-size', 22)
					.attr('fill', COLORS.ink).text('O to play: which move?');
				return;
			}
			dyn.append('text').attr('x', 6).attr('y', barTop - 12).attr('font-size', 14).attr('fill', COLORS.muted)
				.text('flat Monte Carlo: mean reward of O over 20,000 random games per move');
			moves.forEach((_, i) => {
				const cx = (i + 0.5) * CW, v = flat[i], isBest = Math.abs(v - best) < 0.01;
				dyn.append('rect').attr('x', cx - 22).attr('y', y(v)).attr('width', 44).attr('height', y(0) - y(v))
					.attr('fill', isBest ? COLORS.highlight : '#c9c9c9');
				dyn.append('text').attr('x', cx).attr('y', y(v) - 6).attr('text-anchor', 'middle').attr('font-size', 15)
					.attr('font-weight', isBest ? 'bold' : 'normal').attr('fill', COLORS.ink).text(v.toFixed(3));
			});
			if (step === 'minimax') {
				const g = dyn.append('g');
				g.append('text').attr('x', 6).attr('y', barTop + barH + 26).attr('font-size', 14).attr('fill', COLORS.muted)
					.text('minimax (perfect play by both players):');
				verdict(g, barTop + barH + 50);
			}
		});
	} else {
		const section = el.closest('section')!;
		const slider = section.querySelector<HTMLInputElement>('input.ttt-moves-slider');
		const toSlider = (n: number) => Math.round(1000 * Math.log(n) / Math.log(LONG_N));
		const fromSlider = (v: number) => Math.max(1, Math.round(Math.exp((v / 1000) * Math.log(LONG_N))));
		const render = (n: number) => {
			n = Math.max(1, Math.min(LONG_N, n));
			const run = getRun();
			dyn.selectAll('*').remove();
			const kids = moves.map(m => run.root.children.find(c => c.move === m)!);
			const stats = kids.map(c => c && c.born.k <= n ? c.hist.at(n) : { N: 0, W: 0 });
			const maxN = Math.max(...stats.map(s => s.N));
			// Échelle des parts de visites : au moins 0–40 %, pour que les barres restent lisibles.
			const ys = d3.scaleLinear().domain([0, Math.max(0.4, maxN / n)]).range([barTop + barH, barTop]);
			dyn.append('text').attr('x', 6).attr('y', barTop - 12).attr('font-size', 14).attr('fill', COLORS.muted)
				.text(`MCTS after n = ${n.toLocaleString('en')} iterations: visit share N/n (bar) and O's win rate W/N`);
			stats.forEach((s, i) => {
				const cx = (i + 0.5) * CW, share = s.N / n, isBest = s.N === maxN;
				dyn.append('rect').attr('x', cx - 22).attr('y', ys(share)).attr('width', 44).attr('height', ys(0) - ys(share))
					.attr('fill', COLORS.blue).attr('stroke', isBest ? COLORS.highlight : 'none').attr('stroke-width', 4);
				dyn.append('text').attr('x', cx).attr('y', ys(share) - 6).attr('text-anchor', 'middle').attr('font-size', 15)
					.attr('font-weight', isBest ? 'bold' : 'normal').attr('fill', COLORS.ink).text(`${Math.round(100 * share)}%`);
				dyn.append('text').attr('x', cx).attr('y', barTop + barH + 22).attr('text-anchor', 'middle').attr('font-size', 15)
					.attr('fill', COLORS.O).text(s.N ? `W/N = ${(s.W / s.N).toFixed(2)}` : '–');
				if (isBest) {
					dyn.append('text').attr('x', cx).attr('y', barTop + barH + 42).attr('text-anchor', 'middle').attr('font-size', 14)
						.attr('font-weight', 'bold').attr('fill', COLORS.code).text('MCTS plays this');
				}
			});
			verdict(dyn.append('g').attr('opacity', 0.9), barTop + barH + 72);
			if (slider) slider.value = String(toSlider(n));
			const label = section.querySelector('.ttt-moves-n');
			if (label) label.textContent = `n = ${n.toLocaleString('en')}`;
		};
		if (slider) {
			slider.min = '0'; slider.max = '1000'; slider.step = '1';
			slider.addEventListener('input', () => render(fromSlider(parseInt(slider.value, 10))));
			slider.addEventListener('change', () => slider.blur());
		}
		syncWithFragments(el, token => render(parseInt(token ?? '19', 10) || 19));
	}
}
