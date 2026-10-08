// Slide « Why clipping only matters with data reuse » : les ratios ρ_t(θ) des
// T transitions d'un lot du couloir, au début de chaque époque de PPO (une
// ligne par époque, une colonne par transition). À la première époque, θ =
// θ_old et tous les ratios valent 1 : le clip ne fait rien. Une cellule
// entourée est « clippée » (gradient nul). Jeton = dernière ligne affichée
// (1, 2, …, K, end). Le lot est pris après quelques itérations de PPO
// (warmupIterations) pour que le critique et les avantages soient non triviaux.
import * as d3 from 'd3';
import config from './ppo_config.json';
import { Corridor, rollout, gae, update, probs, isClipped, RIGHT } from './corridor';
import type { GradStep, UpdateOptions } from './corridor';
import { mulberry32 } from './prng';
import { syncWithFragments } from './frames';
import { COLORS, advColor, richText } from './draw';

const env = new Corridor(config.corridor);
const c = config.ratioEpochs;
const uniform = mulberry32(c.seed);
const theta = env.zeroLogits(), w = env.zeroValues();
const opts: UpdateOptions = {
	objective: 'clip', epochs: c.epochs, minibatches: c.minibatches, lrActor: c.lrActor,
	lrCritic: c.lrCritic, clipEps: c.clipEps, entropyCoef: c.entropyCoef,
};
let s0 = env.start;
for (let i = 0; i < c.warmupIterations; i++) {
	const r = rollout(env, theta, s0, c.T, uniform);
	s0 = r.last;
	update(r.batch, gae(r.batch, w, env.gamma, c.lambda), theta, w, opts, uniform);
}
const { batch } = rollout(env, theta, s0, c.T, uniform);
const advs = gae(batch, w, env.gamma, c.lambda);
const trace: GradStep[] = [];
update(batch, advs, theta, w, opts, uniform, trace);
/** rows[k] = ratios au début de l'époque k+1 (k = K : après la mise à jour). */
const rows = d3.range(c.epochs + 1).map(k => {
	const th = k === 0 ? null : trace[k * c.minibatches - 1].theta;
	return batch.map(tr => (th ? probs(th, tr.s)[tr.a] / tr.pOld : 1));
});

document.querySelectorAll<SVGSVGElement>('svg.ppo-ratio-epochs').forEach(svgEl => {
	const svg = d3.select(svgEl);
	const T = batch.length;
	const x0 = 150, cw = 41, top = 72, ch = 40;
	const color = (r: number) => {
		const t = Math.min(Math.abs(Math.log(r)) / Math.log(2), 1);   // 0 à ρ = 1, 1 à ρ = 2 ou 1/2
		return d3.interpolateRgb('#ffffff', r >= 1 ? COLORS.reuse : '#56b4e9')(t);
	};

	// en-têtes : transition, action, avantage
	for (let t = 0; t < T; t++) {
		const tr = batch[t], cx = x0 + (t + 0.5) * cw;
		svg.append('text').attr('x', cx).attr('y', 14).attr('text-anchor', 'middle').attr('font-size', 13)
			.attr('fill', COLORS.ink).text(`${tr.s}${tr.a === RIGHT ? '→' : '←'}`);
		const A = advs.adv[t];
		const h = Math.max(Math.min(Math.abs(A) * 44, 24), 1);
		svg.append('rect').attr('x', cx - 13).attr('width', 26).attr('y', A >= 0 ? 44 - h : 44)
			.attr('height', h).attr('fill', advColor(A));
	}
	svg.append('line').attr('x1', x0).attr('x2', x0 + T * cw).attr('y1', 44).attr('y2', 44).attr('stroke', COLORS.faint);
	svg.append('text').attr('x', x0 - 10).attr('y', 14).attr('text-anchor', 'end').attr('font-size', 13).attr('fill', COLORS.muted)
		.text('(Sₜ, Aₜ)');
	svg.append('text').attr('x', x0 - 10).attr('y', 44).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-size', 13)
		.attr('fill', COLORS.muted).text('advantage');

	const body = svg.append('g');
	function render(token: string | null) {
		const last = token === 'end' ? c.epochs : Math.max(1, parseInt(token ?? '1', 10) || 1) - 1;
		body.selectAll('*').remove();
		for (let k = 0; k <= last; k++) {
			const y = top + k * ch;
			const name = k === c.epochs ? 'after the update' : k === 0 ? 'epoch 1 (θ = θ_{old})' : `epoch ${k + 1}`;
			richText(body.append('text').attr('x', x0 - 10).attr('y', y + ch / 2).attr('dy', '0.35em').attr('text-anchor', 'end')
				.attr('font-size', 14).attr('fill', k === 0 ? COLORS.code : COLORS.ink), name);
			let nClip = 0;
			for (let t = 0; t < T; t++) {
				const r = rows[k][t];
				const clipped = isClipped(r, advs.adv[t], c.clipEps);
				if (clipped) nClip++;
				body.append('rect').attr('x', x0 + t * cw + 1).attr('y', y + 1).attr('width', cw - 2).attr('height', ch - 2)
					.attr('rx', 3).attr('fill', color(r)).attr('stroke', clipped ? COLORS.clip : '#ddd').attr('stroke-width', clipped ? 3.5 : 1);
				body.append('text').attr('x', x0 + (t + 0.5) * cw).attr('y', y + ch / 2).attr('dy', '0.35em').attr('text-anchor', 'middle')
					.attr('font-size', 12).attr('fill', COLORS.ink).text(r.toFixed(2));
			}
			body.append('text').attr('x', x0 + T * cw + 10).attr('y', y + ch / 2).attr('dy', '0.35em').attr('font-size', 14)
				.attr('fill', nClip ? COLORS.clip : COLORS.muted).text(`${nClip} clipped`);
		}
	}
	syncWithFragments(svgEl, render);
});
