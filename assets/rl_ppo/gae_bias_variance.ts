// Slide « λ trades bias for variance » : 2000 épisodes du couloir commençant
// par (S_0, A_0) = (2, →), politique π(→|s) = 0.7, critique « en retard »
// (valeurs exactes de la politique uniforme). À gauche, l'histogramme des
// estimations GAE de l'avantage pour le λ courant ; à droite, |biais|,
// écart-type et erreur quadratique moyenne (RMSE) en fonction de λ.
// Cible : q_π(S_0, A_0) − v̂(S_0) (une ligne de base ne dépendant que de l'état
// ne biaise pas le gradient). Jeton = λ ; curseur .ppo-lambda-slider.
import * as d3 from 'd3';
import config from './ppo_config.json';
import { Corridor, exactValues, exactQ, LEFT, RIGHT } from './corridor';
import { mulberry32, meanStd } from './prng';
import { syncWithFragments, bindSlider } from './frames';
import { COLORS, fmtSigned, fmt, styleAxis } from './draw';

const env = new Corridor(config.corridor);
const cfg = config.gaeBiasVariance;
const policy = (): [number, number] => [1 - cfg.pRight, cfg.pRight];
const vTrue = exactValues(env, policy);
const vhat = exactValues(env, () => [0.5, 0.5]);
const target = exactQ(env, vTrue, cfg.state, cfg.action) - vhat[cfg.state];

// épisodes : listes de δ_t
const uniform = mulberry32(cfg.seed);
const episodes: number[][] = [];
for (let i = 0; i < cfg.episodes; i++) {
	let s = cfg.state, a = cfg.action;
	const ds: number[] = [];
	for (;;) {
		const { s2, r, done } = env.step(s, a);
		ds.push(r + (done ? 0 : env.gamma * vhat[s2]) - vhat[s]);
		if (done) break;
		s = s2;
		a = uniform() < cfg.pRight ? RIGHT : LEFT;
	}
	episodes.push(ds);
}
const estimates = (lam: number) => episodes.map(ds => ds.reduce((acc, d, l) => acc + (env.gamma * lam) ** l * d, 0));
const lambdas = d3.range(0, 1.0001, 0.01);
const stats = lambdas.map(lam => {
	const { mean, std } = meanStd(estimates(lam));
	return { lam, bias: mean - target, std, rmse: Math.sqrt((mean - target) ** 2 + std ** 2) };
});

document.querySelectorAll<SVGSVGElement>('svg.ppo-gae-bv').forEach(svgEl => {
	const svg = d3.select(svgEl);
	const section = svgEl.closest('section') as HTMLElement;
	const slider = section.querySelector<HTMLInputElement>('input.ppo-lambda-slider');
	const label = section.querySelector<HTMLElement>('.ppo-lambda-label');
	const H = 300, top = 30;

	// --- panneau gauche : histogramme
	const wL = 470, xL0 = 40;
	const x = d3.scaleLinear().domain([-0.4, 0.7]).range([0, wL]);
	const yMax = 0.3;
	const y = d3.scaleLinear().domain([0, yMax]).range([H, 0]);
	const left = svg.append('g').attr('transform', `translate(${xL0}, ${top})`);
	left.append('g').attr('transform', `translate(0, ${H})`).call(d3.axisBottom(x).ticks(6).tickFormat(d => fmt(+d, 1)))
		.call(styleAxis);
	left.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('.0%')))
		.call(styleAxis);
	left.append('text').attr('x', wL / 2).attr('y', H + 38).attr('text-anchor', 'middle').attr('font-size', 14)
		.attr('fill', COLORS.muted).text('estimate of the advantage of (S₀, A₀) = (2, →)');
	const bars = left.append('g');
	const marks = left.append('g');

	// --- panneau droit : biais, écart-type, RMSE
	const xR0 = 600, wR = 280;
	const xr = d3.scaleLinear().domain([0, 1]).range([0, wR]);
	const yr = d3.scaleLinear().domain([0, 0.25]).range([H, 0]);
	const right = svg.append('g').attr('transform', `translate(${xR0}, ${top})`);
	right.append('g').attr('transform', `translate(0, ${H})`).call(d3.axisBottom(xr).ticks(5))
		.call(styleAxis);
	right.append('g').call(d3.axisLeft(yr).ticks(5)).call(styleAxis);
	right.append('text').attr('x', wR / 2).attr('y', H + 38).attr('text-anchor', 'middle').attr('font-size', 14)
		.attr('fill', COLORS.muted).text('λ');
	const series: { key: 'bias' | 'std' | 'rmse'; name: string; color: string; width: number }[] = [
		{ key: 'bias', name: '|bias|', color: '#d55e00', width: 2 },
		{ key: 'std', name: 'standard deviation', color: '#56b4e9', width: 2 },
		{ key: 'rmse', name: '√(bias² + variance)', color: COLORS.ink, width: 3 },
	];
	series.forEach((sr, i) => {
		const line = d3.line<typeof stats[number]>().x(d => xr(d.lam)).y(d => yr(Math.abs(d[sr.key])));
		right.append('path').attr('d', line(stats)).attr('fill', 'none').attr('stroke', sr.color).attr('stroke-width', sr.width);
		right.append('line').attr('x1', 120).attr('x2', 142).attr('y1', 8 + i * 20).attr('y2', 8 + i * 20)
			.attr('stroke', sr.color).attr('stroke-width', sr.width);
		right.append('text').attr('x', 148).attr('y', 8 + i * 20).attr('dy', '0.35em').attr('font-size', 13)
			.attr('fill', COLORS.ink).text(sr.name);
	});
	const cursor = right.append('g');

	function render(lam: number) {
		lam = Math.round(lam * 100) / 100;
		if (label) label.textContent = `λ = ${lam.toFixed(2)}`;
		if (slider) slider.value = String(lam);
		const est = estimates(lam);
		const { mean, std } = meanStd(est);
		const bins = d3.bin().domain(x.domain() as [number, number]).thresholds(d3.range(-0.4, 0.7, 0.02))(est);
		bars.selectAll('*').remove();
		marks.selectAll('*').remove();
		for (const b of bins) {
			if (!b.length) continue;
			const p = b.length / est.length;
			const h = Math.min(p, yMax);
			bars.append('rect').attr('x', x(b.x0!) + 0.5).attr('width', Math.max(x(b.x1!) - x(b.x0!) - 1, 1))
				.attr('y', y(h)).attr('height', H - y(h)).attr('fill', COLORS.gae).attr('opacity', 0.75);
			if (p > yMax) {
				bars.append('text').attr('x', x((b.x0! + b.x1!) / 2)).attr('y', y(yMax) - 4).attr('text-anchor', 'middle')
					.attr('font-size', 12).attr('fill', COLORS.ink).text(`${Math.round(p * 100)}% ↑`);
			}
		}
		marks.append('line').attr('x1', x(target)).attr('x2', x(target)).attr('y1', -6).attr('y2', H)
			.attr('stroke', COLORS.ink).attr('stroke-width', 2.5);
		marks.append('text').attr('x', x(target) + 5).attr('y', 8).attr('font-size', 13).attr('fill', COLORS.ink)
			.text(`target ${fmtSigned(target)}`);
		marks.append('line').attr('x1', x(mean)).attr('x2', x(mean)).attr('y1', 30).attr('y2', H)
			.attr('stroke', '#d55e00').attr('stroke-width', 2).attr('stroke-dasharray', '5 3');
		marks.append('text').attr('x', x(mean) + (mean < target ? -5 : 5)).attr('y', 44)
			.attr('text-anchor', mean < target ? 'end' : 'start').attr('font-size', 13).attr('fill', '#d55e00')
			.text(`mean ${fmtSigned(mean)}`);
		marks.append('text').attr('x', wL).attr('y', 80).attr('text-anchor', 'end').attr('font-size', 14).attr('fill', COLORS.ink)
			.text(`bias ${fmtSigned(mean - target)}   std ${std.toFixed(2)}`);
		marks.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', H).attr('y2', H + 6).attr('stroke', COLORS.ink);

		cursor.selectAll('*').remove();
		cursor.append('line').attr('x1', xr(lam)).attr('x2', xr(lam)).attr('y1', 0).attr('y2', H)
			.attr('stroke', COLORS.gae).attr('stroke-width', 2).attr('stroke-dasharray', '4 3');
		const st = stats[Math.round(lam * 100)];
		cursor.append('circle').attr('cx', xr(lam)).attr('cy', yr(st.rmse)).attr('r', 5).attr('fill', COLORS.ink);
	}

	syncWithFragments(svgEl, token => render(parseFloat(token ?? '0') || 0));
	bindSlider(slider, render);
});
