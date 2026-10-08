// Slide « Starting point: one-step TD Actor-Critic » : l'algorithme de Sutton &
// Barto (§13.5) exécuté sur le couloir, ligne par ligne, synchronisé avec le
// pseudo-code (.ppo-tdac-code) par les jetons de data-frames :
//   init              initialisation (lignes 2-4)
//   k:act|step|delta|critic|actor|next   pas k détaillé (lignes 6 à 11)
//   k:all             pas k complet (toutes les mises à jour faites)
//   long              après `longRunSteps` pas
import * as d3 from 'd3';
import config from './ppo_config.json';
import { Corridor, tdActorCritic, probs, performance, exactValues, RIGHT } from './corridor';
import type { TdStep } from './corridor';
import { syncWithFragments, highlightLines } from './frames';
import { COLORS, drawCorridor, fmt, fmtSigned, advColor } from './draw';
import type { G } from './draw';

const env = new Corridor(config.corridor);
const cfg = config.tdActorCritic;
const trace = tdActorCritic(env, {
	steps: cfg.longRunSteps, alphaTheta: cfg.alphaTheta, alphaW: cfg.alphaW, seed: cfg.seed,
});
const optimalJ = exactValues(env, () => [0, 1])[env.start];

const LINES: Record<string, number[]> = {
	init: [2, 3, 4], act: [6], step: [7], delta: [8], critic: [9], actor: [10], next: [11],
	all: [6, 7, 8, 9, 10, 11], long: [],
};
const arrowName = (a: number) => (a === RIGHT ? '→' : '←');

document.querySelectorAll<SVGSVGElement>('svg.ppo-tdac').forEach(svgEl => {
	const svg = d3.select(svgEl);
	const code = svgEl.closest('section')?.querySelector('.ppo-tdac-code') ?? null;
	const cell = 62, x0 = 32, y0 = 92;
	const info = svg.append('g').attr('transform', 'translate(0, 24)');
	const corr = svg.append('g').attr('transform', `translate(${x0}, ${y0})`) as unknown as G;
	const panel = svg.append('g').attr('transform', `translate(0, ${y0 + cell + 62})`);

	const text = (g: d3.Selection<SVGGElement, unknown, null, undefined>, y: number, s: string, opts: { color?: string; size?: number; bold?: boolean } = {}) =>
		g.append('text').attr('x', 0).attr('y', y).attr('font-size', opts.size ?? 17)
			.attr('font-weight', opts.bold ? 'bold' : null).attr('fill', opts.color ?? COLORS.ink).text(s);

	function render(token: string | null) {
		token = token ?? 'init';
		info.selectAll('*').remove();
		panel.selectAll('*').remove();
		const [kStr, phase] = token.includes(':') ? token.split(':') : ['0', token];
		highlightLines(code, LINES[phase] ?? []);

		if (phase === 'init') {
			drawCorridor(corr, env, { theta: env.zeroLogits(), w: env.zeroValues(), agent: env.start },
				{ cell, values: true, valueLabel: 'v̂(s,w)' });
			text(info, 0, 'Initialization: θ = 0 (uniform policy), w = 0', { color: COLORS.muted });
			return;
		}
		if (phase === 'long') {
			const last = trace[trace.length - 1];
			const episodes = trace.filter(x => x.done).length;
			drawCorridor(corr, env, { theta: last.thetaAfter, w: last.wAfter, agent: env.start },
				{ cell, values: true, valueLabel: 'v̂(s,w)' });
			text(info, 0, `After ${trace.length} steps (${episodes} episodes)`, { bold: true });
			const J = performance(env, last.thetaAfter);
			text(panel, 0, `From the start (state ${env.start}), the agent goes left: trapped`, { color: COLORS.code });
			text(panel, 24, 'by the nearby small reward.', { color: COLORS.code });
			text(panel, 56, `J(θ) = vπ(${env.start}) = ${J.toFixed(2)}, optimum (always →) = ${optimalJ.toFixed(2)}`, { color: COLORS.muted, size: 15 });
			return;
		}

		const k = parseInt(kStr, 10);
		const st: TdStep = trace[k - 1];
		const episode = trace.slice(0, k - 1).filter(x => x.done).length + 1;
		const stepInEpisode = (() => { let n = 0; for (let i = k - 2; i >= 0 && !trace[i].done; i--) n++; return n; })();
		text(info, 0, `Episode ${episode}, time step ${stepInEpisode}`, { bold: true });

		const order = ['act', 'step', 'delta', 'critic', 'actor', 'next', 'all'];
		const at = (p: string) => order.indexOf(phase) >= order.indexOf(p);
		const theta = at('actor') ? st.thetaAfter : st.thetaBefore;
		const w = at('critic') ? st.wAfter : st.wBefore;
		const agent = phase === 'next' || phase === 'all' ? (st.done ? undefined : st.s2) : st.s;
		drawCorridor(corr, env, {
			theta, w, agent: agent ?? st.s2,
			move: at('step') ? { s: st.s, s2: st.s2, r: st.r } : undefined,
			highlight: [st.s],
		}, { cell, values: true, valueLabel: 'v̂(s,w)' });

		const p = probs(st.thetaBefore, st.s);
		let y = 0;
		if (at('act')) { text(panel, y, `S = ${st.s},  A = ${arrowName(st.a)}   (probability ${p[st.a].toFixed(2)})`); y += 26; }
		if (at('step')) { text(panel, y, `S′ = ${st.s2}${st.done ? ' (terminal)' : ''},  R = ${st.r}`); y += 26; }
		if (at('delta')) {
			const vNext = st.done ? '0' : fmt(st.wBefore[st.s2]);
			text(panel, y, `δ = ${st.r} + ${env.gamma} × ${vNext} − ${fmt(st.wBefore[st.s])} = ${fmtSigned(st.delta)}`,
				{ color: st.delta === 0 ? COLORS.muted : advColor(st.delta), bold: true });
			y += 26;
		}
		if (at('critic') && phase !== 'all') {
			text(panel, y, `v̂(${st.s}): ${fmt(st.wBefore[st.s])} → ${fmt(st.wAfter[st.s])}`, { size: 16, color: COLORS.muted });
			y += 24;
		}
		if (at('actor') && phase !== 'all') {
			const pa = probs(st.thetaAfter, st.s);
			text(panel, y, `π(${arrowName(st.a)}|${st.s}): ${p[st.a].toFixed(2)} → ${pa[st.a].toFixed(2)}   (I = ${st.I.toFixed(2)})`, { size: 16, color: COLORS.muted });
			y += 24;
		}
		if (phase === 'all') {
			const pa = probs(st.thetaAfter, st.s);
			text(panel, y, `v̂(${st.s}): ${fmt(st.wBefore[st.s])} → ${fmt(st.wAfter[st.s])},  π(${arrowName(st.a)}|${st.s}): ${p[st.a].toFixed(2)} → ${pa[st.a].toFixed(2)}`, { size: 16, color: COLORS.muted });
			y += 24;
		}
		if (phase === 'next') {
			text(panel, y, st.done ? 'S′ is terminal: a new episode starts' : `S ← ${st.s2}`, { size: 16, color: COLORS.muted });
		}
		if (st.delta === 0 && at('critic')) {
			text(panel, y + (phase === 'next' ? 26 : 0), 'δ = 0: nothing is learned', { size: 16, color: COLORS.code });
		}
	}

	syncWithFragments(svgEl, render);
});
