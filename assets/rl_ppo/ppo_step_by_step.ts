// Slide « PPO, step by step » : PPO complet sur le couloir, ligne par ligne,
// synchronisé avec le pseudo-code (.ppo-sbs-code). En haut le couloir
// (politique et critique courants), en dessous le lot (buffer) qui se remplit :
// (S_t, A_t), R_{t+1}, δ_t, Adv_t, ρ_t. Jetons de data-frames :
//   init        initialisation
//   old         θ_old ← θ (itération 1)
//   c1 … cT     collecte du pas t
//   delta, gae  erreurs TD, puis avantages à rebours
//   eXmY        époque X, minibatch Y : ratios, échantillons clippés, pas de gradient
//   next        θ_old ← θ (itération 2), le lot est jeté
//   after       après `afterIterations` itérations
import * as d3 from 'd3';
import config from './ppo_config.json';
import { Corridor, rollout, gae, update, performance, RIGHT } from './corridor';
import type { GradStep, UpdateOptions, Logits, Values } from './corridor';
import { mulberry32 } from './prng';
import { syncWithFragments, highlightLines } from './frames';
import { COLORS, drawCorridor, advColor, fmtSigned, richText, arrowMarker } from './draw';
import type { G } from './draw';

const env = new Corridor(config.corridor);
const c = config.stepByStep;
const opts: UpdateOptions = {
	objective: 'clip', epochs: c.epochs, minibatches: c.minibatches, lrActor: c.lrActor,
	lrCritic: c.lrCritic, clipEps: c.clipEps, entropyCoef: c.entropyCoef,
};
const uniform = mulberry32(c.seed);
const theta0 = env.zeroLogits(), w0 = env.zeroValues();
const theta = env.zeroLogits(), w = env.zeroValues();
const first = rollout(env, theta, env.start, c.T, uniform);
const batch = first.batch;
const advs = gae(batch, w, env.gamma, c.lambda);
const trace: GradStep[] = [];
update(batch, advs, theta, w, opts, uniform, trace);
const theta1: Logits = theta.map(r => [...r]), w1: Values = [...w];
let s = first.last;
for (let i = 1; i < c.afterIterations; i++) {
	const r = rollout(env, theta, s, c.T, uniform);
	s = r.last;
	update(r.batch, gae(r.batch, w, env.gamma, c.lambda), theta, w, opts, uniform);
}
const thetaAfter = theta, wAfter = w;

const LINES: Record<string, number[]> = {
	init: [1], old: [2, 3], collect: [4, 5], delta: [6], gae: [7], epoch: [8, 9, 10, 11, 12, 13], next: [2, 3], after: [],
};

document.querySelectorAll<SVGSVGElement>('svg.ppo-sbs').forEach(svgEl => {
	const svg = d3.select(svgEl);
	const code = svgEl.closest('section')?.querySelector('.ppo-sbs-code') ?? null;
	const cell = 56, cx0 = 62, cy0 = 74;
	const corr = svg.append('g').attr('transform', `translate(${cx0}, ${cy0})`) as unknown as G;
	const head = svg.append('g');
	const table = svg.append('g').attr('transform', 'translate(0, 182)');
	const foot = svg.append('g').attr('transform', 'translate(0, 392)');
	const backHead = arrowMarker(svg, 'ppo-sbs-back', COLORS.gae, 11);

	// géométrie du lot
	const tx0 = 84, tw = 47, rowH = 31;
	const ROWS = ['(Sₜ, Aₜ)', 'Rₜ₊₁', 'δₜ', 'Advₜ', 'ρₜ'];
	const colX = (t: number) => tx0 + t * tw;

	const text = (g: d3.Selection<SVGGElement, unknown, null, undefined>, x: number, y: number, str: string,
		o: { size?: number; color?: string; anchor?: string; bold?: boolean } = {}) =>
		richText(g.append('text').attr('x', x).attr('y', y).attr('font-size', o.size ?? 15).attr('fill', o.color ?? COLORS.ink)
			.attr('text-anchor', o.anchor ?? 'start').attr('font-weight', o.bold ? 'bold' : null), str);

	function drawTable(nCollected: number, showDelta: boolean, showAdv: boolean, step: GradStep | null) {
		table.selectAll('*').remove();
		ROWS.forEach((name, i) => {
			text(table, tx0 - 10, i * rowH + rowH / 2 + 5, name, { size: 14, color: COLORS.muted, anchor: 'end' });
		});
		for (let t = 0; t < c.T; t++) {
			table.append('text').attr('x', colX(t) + tw / 2).attr('y', -8).attr('text-anchor', 'middle').attr('font-size', 12)
				.attr('fill', COLORS.muted).text(`t=${t}`);
			const inMb = step?.samples.find(x => x.t === t);
			for (let i = 0; i < ROWS.length; i++) {
				table.append('rect').attr('x', colX(t) + 1).attr('y', i * rowH + 1).attr('width', tw - 2).attr('height', rowH - 2)
					.attr('fill', step && inMb ? '#fdf3dc' : '#fafafa').attr('stroke', '#e3e3e3');
			}
			if (t >= nCollected) continue;
			const tr = batch[t];
			const mid = colX(t) + tw / 2;
			text(table, mid, rowH / 2 + 5, `${tr.s}${tr.a === RIGHT ? '→' : '←'}`, { anchor: 'middle' });
			text(table, mid, rowH * 1.5 + 5, tr.r ? `+${tr.r}` : '0', { anchor: 'middle', color: tr.r ? '#9a7300' : COLORS.muted, bold: !!tr.r });
			if (tr.done && t < c.T - 1) {
				table.append('line').attr('x1', colX(t + 1)).attr('x2', colX(t + 1)).attr('y1', -16).attr('y2', ROWS.length * rowH + 4)
					.attr('stroke', COLORS.ink).attr('stroke-width', 2.5);
			}
			if (showDelta) {
				const d = advs.delta[t];
				text(table, mid, rowH * 2.5 + 5, Math.abs(d) < 5e-3 ? '0' : fmtSigned(d), { anchor: 'middle', size: 13, color: Math.abs(d) < 5e-3 ? COLORS.muted : advColor(d) });
			}
			if (showAdv) {
				const A = advs.adv[t];
				table.append('rect').attr('x', colX(t) + 3).attr('y', rowH * 3 + 3).attr('width', tw - 6).attr('height', rowH - 6)
					.attr('fill', advColor(A)).attr('opacity', Math.min(Math.abs(A), 1) * 0.6 + 0.1);
				text(table, mid, rowH * 3.5 + 5, fmtSigned(A), { anchor: 'middle', size: 13, bold: true });
			}
			if (step) {
				const smp = step.samples.find(x => x.t === t);
				if (smp) {
					table.append('rect').attr('x', colX(t) + 3).attr('y', rowH * 4 + 3).attr('width', tw - 6).attr('height', rowH - 6)
						.attr('fill', 'none').attr('stroke', smp.clipped ? COLORS.clip : 'none').attr('stroke-width', 3).attr('rx', 3);
					text(table, mid, rowH * 4.5 + 5, smp.ratio.toFixed(2), { anchor: 'middle', size: 13, color: smp.clipped ? COLORS.clip : COLORS.ink, bold: smp.clipped });
				}
			}
		}
		if (nCollected > 0 && !showDelta) {
			const anyDone = batch.slice(0, nCollected).some((x, i) => x.done && i < c.T - 1);
			if (anyDone) text(table, colX(c.T) - 2, ROWS.length * rowH + 22, 'thick bar: end of an episode', { size: 12, color: COLORS.muted, anchor: 'end' });
		}
	}

	function render(token: string | null) {
		token = token ?? 'init';
		head.selectAll('*').remove();
		foot.selectAll('*').remove();
		const epochMatch = /^e(\d+)m(\d+)$/.exec(token);
		const collectMatch = /^c(\d+)$/.exec(token);
		const phase = epochMatch ? 'epoch' : collectMatch ? 'collect' : token;
		highlightLines(code, LINES[phase] ?? []);

		const title = (str: string) => text(head, 0, 18, str, { bold: true, size: 16 });
		if (phase === 'after') {
			drawCorridor(corr, env, { theta: thetaAfter, w: wAfter, agent: env.start }, { cell, values: true, valueLabel: 'v̂' });
			title(`After ${c.afterIterations} iterations (${c.afterIterations * c.T} steps)`);
			drawTable(0, false, false, null);
			text(foot, 0, 20, `The agent now goes right: J(θ) = ${performance(env, thetaAfter).toFixed(2)}`, { color: COLORS.code });
			text(foot, 0, 44, `(optimum: 0.73; trap on the left: 0.45)`, { color: COLORS.muted, size: 14 });
			return;
		}
		if (phase === 'init' || phase === 'old') {
			drawCorridor(corr, env, { theta: theta0, w: w0, agent: env.start }, { cell, values: true, valueLabel: 'v̂' });
			title(phase === 'init' ? 'Initialization: uniform policy, v̂ = 0' : 'Iteration 1: θ_{old} ← θ');
			drawTable(0, false, false, null);
			return;
		}
		if (phase === 'collect') {
			const k = parseInt(collectMatch![1], 10);
			const tr = batch[k - 1];
			drawCorridor(corr, env, { theta: theta0, w: w0, agent: tr.s2, move: { s: tr.s, s2: tr.s2, r: tr.r } },
				{ cell, values: true, valueLabel: 'v̂' });
			title(`Rollout with θ_{old}: step t = ${k - 1}`);
			drawTable(k, false, false, null);
			if (tr.done) text(foot, 0, 20, `Episode ends (R = +${tr.r}): the next step starts again from state ${env.start}`, { color: COLORS.muted, size: 14 });
			return;
		}
		if (phase === 'delta' || phase === 'gae') {
			drawCorridor(corr, env, { theta: theta0, w: w0 }, { cell, values: true, valueLabel: 'v̂' });
			title(phase === 'delta' ? 'TD errors δₜ (the critic still knows nothing)' : 'GAE, backwards: Advₜ = δₜ + γλ Advₜ₊₁');
			drawTable(c.T, true, phase === 'gae', null);
			if (phase === 'gae') {
				const y = 182 + ROWS.length * rowH + 12;
				head.append('path').attr('d', `M${colX(c.T) - 6},${y} L${colX(0) + 6},${y}`).attr('stroke', COLORS.gae)
					.attr('stroke-width', 2.5).attr('marker-end', backHead);
				text(foot, 0, 20, 'The reward signal flows back along the whole trajectory, in one pass;', { size: 14, color: COLORS.gae });
				text(foot, 0, 40, 'it is reset at the end of an episode.', { size: 14, color: COLORS.gae });
			}
			return;
		}
		if (phase === 'epoch') {
			const e = parseInt(epochMatch![1], 10), m = parseInt(epochMatch![2], 10);
			const idx = (e - 1) * c.minibatches + (m - 1);
			const step = trace[idx];
			drawCorridor(corr, env, { theta: step.theta, w: step.w }, { cell, values: true, valueLabel: 'v̂' });
			title(`Epoch ${e} of ${c.epochs}, minibatch ${m} of ${c.minibatches}`);
			drawTable(c.T, true, true, step);
			const nClip = step.samples.filter(x => x.clipped).length;
			const ts = step.samples.map(x => x.t).sort((a, b) => a - b).join(', ');
			text(foot, 0, 20, `B = {${ts}};  ${nClip ? `${nClip} clipped sample${nClip > 1 ? 's' : ''} (purple): no gradient` : 'no sample clipped'}`, { size: 14, color: nClip ? COLORS.clip : COLORS.muted });
			text(foot, 0, 42, 'The arrows and v̂ show θ and w after this gradient step.', { size: 13, color: COLORS.muted });
			return;
		}
		if (phase === 'next') {
			drawCorridor(corr, env, { theta: theta1, w: w1, agent: first.last }, { cell, values: true, valueLabel: 'v̂' });
			title('Iteration 2: θ_{old} ← θ, and the batch is thrown away');
			drawTable(0, false, false, null);
			text(foot, 0, 20, `J(θ): ${performance(env, theta0).toFixed(2)} → ${performance(env, theta1).toFixed(2)} after one iteration`, { size: 14, color: COLORS.muted });
		}
	}

	syncWithFragments(svgEl, render);
});
