// Figure « UCB1 sur un bandit manchot » (deck rl_mcts.html) : K bras de
// Bernoulli de moyennes inconnues (mcts_config.json, section bandit) ; à
// chaque tour t, UCB1 tire le bras qui maximise  moyenne empirique + bonus
// d'exploration  c √(ln t / N_a).
//
// Usage : <svg class="ucb-bandit" data-frames="4 5 6 7 8 30 300 3000"
//              data-initial-frame="0"></svg>
// Un jeton = un nombre t de tirages déjà effectués : la figure montre les
// scores UCB1 pour choisir le tirage t + 1 (bras choisi encadré), les vraies
// moyennes en pointillés rouges (inconnues de l'algorithme) et les effectifs.
import * as d3 from 'd3';
import { mulberry32 } from './mcts';
import { drawUcbPanel } from './draw';
import type { G } from './draw';
import { syncWithFragments } from './frames';
import config from './mcts_config.json';

const { means, c, seed } = config.bandit;
const K = means.length;

interface BanditState { t: number; N: number[]; mean: number[]; }

/** États après t = 0, 1, …, T tirages (les K premiers : chaque bras une fois). */
function simulate(T: number): BanditState[] {
	const uniform = mulberry32(seed);
	const N = new Array<number>(K).fill(0), S = new Array<number>(K).fill(0);
	const states: BanditState[] = [{ t: 0, N: [...N], mean: new Array<number>(K).fill(0) }];
	for (let t = 1; t <= T; t++) {
		const a = t <= K ? t - 1 : choose(N, S, t - 1);
		const reward = uniform() < means[a] ? 1 : 0;
		N[a]++; S[a] += reward;
		states.push({ t, N: [...N], mean: N.map((n, i) => n ? S[i] / n : 0) });
	}
	return states;
}

function choose(N: number[], S: number[], t: number): number {
	let best = 0, bestScore = -Infinity;
	for (let a = 0; a < K; a++) {
		const score = S[a] / N[a] + c * Math.sqrt(Math.log(t) / N[a]);
		if (score > bestScore) { best = a; bestScore = score; }
	}
	return best;
}

for (const el of document.querySelectorAll<SVGSVGElement>('svg.ucb-bandit')) {
	const tokens = [...(el.getAttribute('data-frames') ?? '').split(/\s+/), el.getAttribute('data-initial-frame') ?? '']
		.map(t => parseInt(t, 10)).filter(t => !Number.isNaN(t));
	const states = simulate(Math.max(K, ...tokens));
	const W = 460, H = 300;
	const svg = d3.select(el).attr('viewBox', `0 0 ${W} ${H}`).classed('mcts-fig', true);
	const g = svg.append('g').attr('transform', 'translate(0, 4)');

	syncWithFragments(el, token => {
		g.selectAll('*').remove();
		const t = parseInt(token ?? '0', 10) || 0;
		const st = states[t];
		if (t < K) {
			// Phase d'initialisation : chaque bras est tiré une fois.
			const bars = means.map((m, a) => ({
				label: `arm ${a + 1}`, mean: st.mean[a], bonus: 0, N: st.N[a], chosen: a === t, truth: m,
			}));
			drawUcbPanel(g as unknown as G, W, H - 10, bars, {
				yMax: 3, fontSize: 17, title: t === 0 ? 'Before any pull: true means unknown (dashed red)' : `t = ${t}: pull each arm once first`,
			});
			return;
		}
		const chosen = choose(st.N, st.N.map((n, a) => st.mean[a] * n), t);
		const bars = means.map((m, a) => ({
			label: `arm ${a + 1}`, mean: st.mean[a], bonus: c * Math.sqrt(Math.log(t) / st.N[a]),
			N: st.N[a], chosen: a === chosen, truth: m,
		}));
		// Échelle adaptée au tour t : les bonus fondent quand les N_a grandissent.
		const yMax = Math.max(1, ...bars.map(b => b.mean + b.bonus)) * 1.12;
		drawUcbPanel(g as unknown as G, W, H - 10, bars, {
			yMax, fontSize: 17, title: `t = ${t}: next pull → arm ${chosen + 1}`,
		});
	});
}
