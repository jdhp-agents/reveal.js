// Slide « Does it work? Four variants on the corridor » : courbes
// d'apprentissage (vraie performance J(θ) = v_π(start), exacte) de quatre
// variantes, mêmes rollouts (T, λ) et même pas d'apprentissage :
//   a2c     1 époque, 1 minibatch, gradient de politique (A2C + GAE)
//   naive   K époques sur L^CPI (réutilisation sans clip)
//   ppo     K époques sur L^CLIP
//   ppoent  PPO + bonus d'entropie
// Fines lignes : `shownSeeds` exécutions ; trait épais : moyenne sur `seeds`.
// Jeton = dernière variante affichée.
import * as d3 from 'd3';
import config from './ppo_config.json';
import { Corridor, run, exactValues } from './corridor';
import type { RunOptions } from './corridor';
import { syncWithFragments } from './frames';
import { COLORS, styleAxis } from './draw';

const env = new Corridor(config.corridor);
const c = config.learningCurves;
const base: Omit<RunOptions, 'seed'> = {
	iterations: c.iterations, T: c.T, lambda: c.lambda, epochs: c.epochs, minibatches: c.minibatches,
	lrActor: c.lrActor, lrCritic: c.lrCritic, clipEps: c.clipEps, entropyCoef: 0, objective: 'clip',
};
const VARIANTS = [
	{ key: 'a2c', name: 'A2C (1 gradient step)', color: COLORS.gae, opts: { objective: 'pg' as const, epochs: 1, minibatches: 1 } },
	{ key: 'naive', name: `${c.epochs} epochs, no clipping`, color: COLORS.reuse, opts: { objective: 'cpi' as const } },
	{ key: 'ppo', name: `PPO (${c.epochs} epochs, clip)`, color: COLORS.clip, opts: { objective: 'clip' as const } },
	{ key: 'ppoent', name: `PPO + entropy (c₂ = ${c.entropyCoef})`, color: COLORS.ent, opts: { objective: 'clip' as const, entropyCoef: c.entropyCoef } },
];
const optimum = exactValues(env, () => [0, 1])[env.start];
const trap = exactValues(env, () => [1, 0])[env.start];
const results = VARIANTS.map(v => {
	const curves = d3.range(1, c.seeds + 1).map(seed => run(env, { ...base, ...v.opts, seed }).map(it => it.J));
	const mean = curves[0].map((_, i) => d3.mean(curves, cv => cv[i])!);
	const finals = curves.map(cv => cv[cv.length - 1]);
	return { ...v, curves, mean, stuck: finals.filter(j => j < (trap + 0.02)).length / c.seeds, finalMean: d3.mean(finals)! };
});

document.querySelectorAll<SVGSVGElement>('svg.ppo-curves').forEach(svgEl => {
	const svg = d3.select(svgEl);
	const pw = 178, ph = 280, gap = 44, x0 = 46, top = 44;
	const steps = c.iterations * c.T;
	const x = d3.scaleLinear().domain([0, steps]).range([0, pw]);
	const y = d3.scaleLinear().domain([0.3, 0.76]).range([top + ph, top]).clamp(false);
	const panels = results.map((r, i) => {
		const g = svg.append('g').attr('transform', `translate(${x0 + i * (pw + gap)}, 0)`);
		g.append('text').attr('x', pw / 2).attr('y', 16).attr('text-anchor', 'middle').attr('font-size', 14)
			.attr('font-weight', 'bold').attr('fill', r.color).text(r.name);
		g.append('g').attr('transform', `translate(0, ${top + ph})`).call(d3.axisBottom(x).ticks(3).tickFormat(d3.format('~s'))).call(styleAxis);
		g.append('g').call(d3.axisLeft(y).ticks(5)).call(styleAxis);
		for (const [v, name] of [[optimum, 'always →'], [trap, 'always ←']] as const) {
			g.append('line').attr('x1', 0).attr('x2', pw).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', COLORS.ink)
				.attr('stroke-dasharray', '4 3').attr('opacity', 0.5);
			g.append('text').attr('x', pw).attr('y', y(v) - 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', COLORS.muted).text(name);
		}
		const line = d3.line<number>().x((_, k) => x(k * c.T)).y(j => y(j));
		const clipId = `ppo-curves-clip-${i}`;
		g.append('clipPath').attr('id', clipId).append('rect').attr('x', 0).attr('y', top - 4).attr('width', pw + 2).attr('height', ph + 4);
		const body = g.append('g');
		const curves = body.append('g').attr('clip-path', `url(#${clipId})`);
		r.curves.slice(0, c.shownSeeds).forEach(cv => curves.append('path').attr('d', line(cv)).attr('fill', 'none')
			.attr('stroke', r.color).attr('stroke-width', 1).attr('opacity', 0.28));
		curves.append('path').attr('d', line(r.mean)).attr('fill', 'none').attr('stroke', r.color).attr('stroke-width', 3.5);
		body.append('text').attr('x', pw / 2).attr('y', top + ph + 44).attr('text-anchor', 'middle').attr('font-size', 13)
			.attr('fill', COLORS.ink).text(`stuck on the left: ${Math.round(r.stuck * 100)}%`);
		body.append('text').attr('x', pw / 2).attr('y', top + ph + 62).attr('text-anchor', 'middle').attr('font-size', 13)
			.attr('fill', COLORS.ink).text(`final mean J: ${r.finalMean.toFixed(2)}`);
		return { key: r.key, body };
	});
	svg.append('text').attr('x', x0 - 34).attr('y', top + ph / 2).attr('text-anchor', 'middle').attr('font-size', 13)
		.attr('fill', COLORS.muted).attr('transform', `rotate(-90, ${x0 - 34}, ${top + ph / 2})`).text('J(θ)');
	svg.append('text').attr('x', x0 + 2 * (pw + gap) - gap / 2).attr('y', top + ph + 86).attr('text-anchor', 'middle')
		.attr('font-size', 13).attr('fill', COLORS.muted).text('x axis: environment steps; dashed lines: deterministic policies (optimum \u2192, trap \u2190)');

	syncWithFragments(svgEl, token => {
		const last = Math.max(0, VARIANTS.findIndex(v => v.key === (token ?? 'a2c')));
		panels.forEach((p, i) => p.body.attr('display', i <= last ? null : 'none'));
	});
});
