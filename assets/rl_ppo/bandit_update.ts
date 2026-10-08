// Slides « Maximizing the surrogate: what goes wrong » (data-objective="cpi")
// et « Clipping in action » (data-objective="clip") : une seule mise à jour de
// PPO sur un lot fixé de 12 actions du bandit gaussien, époque par époque.
// Même lot, même optimiseur (montée de gradient simple), même nombre
// d'époques ; seul l'objectif change. Jeton = numéro d'époque k (0 = θ_old).
//
//   en haut à gauche : π_old (gris), π_θk (couleur de l'ingrédient), R(a) (or) ;
//   au milieu       : les échantillons a_i et leurs avantages Â_i ;
//   en bas          : le ratio ρ(a) = π_θk(a) / π_old(a) (échelle log), bande
//                     [1−ε, 1+ε], échantillons clippés évidés ;
//   à droite        : objectif de substitution estimé vs vrai gain J(θk) − J(θ_old).
import * as d3 from 'd3';
import config from './ppo_config.json';
import { sampleBatch, updateOnBatch, pdf, reward, sigma } from './bandit';
import type { Epoch } from './bandit';
import { mulberry32, gaussian } from './prng';
import { syncWithFragments } from './frames';
import { COLORS, advColor, fmt, fmtSigned, styleAxis, richText } from './draw';

const cfg = config.bandit.update;
const old = config.bandit.policy0;
const samples = sampleBatch(cfg.bumps, old, cfg.samples, cfg.noise, gaussian(mulberry32(cfg.seed)));
const runs: Record<'cpi' | 'clip', Epoch[]> = {
	cpi: updateOnBatch(cfg.bumps, old, samples, { objective: 'cpi', epochs: cfg.epochs, lr: cfg.lr, eps: cfg.clipEps }),
	clip: updateOnBatch(cfg.bumps, old, samples, { objective: 'clip', epochs: cfg.epochs, lr: cfg.lr, eps: cfg.clipEps }),
};

document.querySelectorAll<SVGSVGElement>('svg.ppo-bandit-update').forEach((svgEl, figIndex) => {
	const objective = svgEl.dataset.objective === 'clip' ? 'clip' : 'cpi';
	const run = runs[objective];
	const color = objective === 'clip' ? COLORS.clip : COLORS.reuse;
	const svg = d3.select(svgEl);
	const clipId = `ppo-bu-clip-${figIndex}`;

	// --- géométrie
	const xL0 = 50, wL = 500;
	const x = d3.scaleLinear().domain([-3, 4]).range([0, wL]);
	const dTop = 10, dH = 160;                          // densités
	const yd = d3.scaleLinear().domain([0, 0.75]).range([dTop + dH, dTop]);
	const sBase = dTop + dH + 42, sScale = 34;          // échantillons
	const rTop = sBase + 58, rH = 116;                  // ratios
	const yr = d3.scaleLog().domain([0.05, 20]).range([rTop + rH, rTop]).clamp(true);
	const left = svg.append('g').attr('transform', `translate(${xL0}, 0)`);
	svg.append('defs').append('clipPath').attr('id', clipId)
		.append('rect').attr('x', -5).attr('y', dTop).attr('width', wL + 10).attr('height', dH);
	const grid = d3.range(-3, 4.0001, 0.02);

	// partie fixe : R(a), π_old, axes
	const area = d3.area<number>().x(a => x(a)).y0(yd(0)).y1(a => yd(0.6 * reward(cfg.bumps, a)));
	left.append('path').attr('d', area(grid)).attr('fill', COLORS.goldLight).attr('stroke', COLORS.gold);
	left.append('text').attr('x', 0).attr('y', dTop + 36).attr('font-size', 13)
		.attr('fill', '#9a7300').text('gold: mean reward R(a), unknown to the agent');
	const line = d3.line<number>().x(a => x(a));
	left.append('path').attr('d', line.y(a => yd(pdf(old, a)))(grid)).attr('fill', 'none')
		.attr('stroke', COLORS.old).attr('stroke-width', 2).attr('stroke-dasharray', '6 4');
	richText(left.append('text').attr('x', x(-1.25)).attr('y', yd(pdf(old, -1.25)) - 8).attr('text-anchor', 'end')
		.attr('font-size', 14).attr('fill', COLORS.old), 'π_{old}');
	left.append('g').attr('transform', `translate(0, ${yd(0)})`).call(d3.axisBottom(x).ticks(7).tickSize(4)).call(styleAxis);
	left.append('text').attr('x', wL + 8).attr('y', yd(0) + 4).attr('font-size', 14).attr('fill', COLORS.muted).text('a');

	// échantillons
	left.append('line').attr('x1', 0).attr('x2', wL).attr('y1', sBase).attr('y2', sBase).attr('stroke', COLORS.faint);
	left.append('text').attr('x', -8).attr('y', sBase).attr('dy', '0.35em').attr('text-anchor', 'end')
		.attr('font-size', 14).attr('fill', COLORS.muted).text('adv.');

	// ratios
	const yAxisR = left.append('g').call(d3.axisLeft(yr).tickValues([0.1, 1, 10]).tickFormat(d => String(d)));
	styleAxis(yAxisR, 11);
	left.append('rect').attr('x', 0).attr('width', wL).attr('y', yr(1 + cfg.clipEps)).attr('height', yr(1 - cfg.clipEps) - yr(1 + cfg.clipEps))
		.attr('fill', COLORS.clip).attr('opacity', 0.15);
	left.append('line').attr('x1', 0).attr('x2', wL).attr('y1', yr(1)).attr('y2', yr(1)).attr('stroke', COLORS.clip).attr('stroke-width', 1);
	richText(left.append('text').attr('x', 0).attr('y', rTop - 8).attr('font-size', 14).attr('fill', COLORS.muted),
		'ratio ρ(a) = π_{θ}(a) / π_{old}(a)   (log scale)');
	left.append('text').attr('x', wL + 8).attr('y', yr(1)).attr('dy', '0.35em').attr('font-size', 13).attr('fill', COLORS.clip)
		.text(`1 ± ε (ε = ${cfg.clipEps})`);

	const dyn = left.append('g');

	// --- panneau de droite : substitut vs vrai gain
	const xR0 = 690, wR = 200, gTop = 20, gH = 200;
	const right = svg.append('g').attr('transform', `translate(${xR0}, 0)`);
	const xe = d3.scaleLinear().domain([0, cfg.epochs]).range([0, wR]);
	const allVals = [...runs.cpi, ...runs.clip].flatMap(e => [e.surrogate, e.improvement]);
	const ye = d3.scaleLinear().domain([Math.min(-0.2, d3.min(allVals)!), d3.max(allVals)! * 1.05]).range([gTop + gH, gTop]).nice();
	right.append('g').attr('transform', `translate(0, ${gTop + gH})`).call(d3.axisBottom(xe).ticks(5).tickSize(4)).call(styleAxis);
	right.append('g').call(d3.axisLeft(ye).ticks(6).tickSize(4)).call(styleAxis);
	right.append('line').attr('x1', 0).attr('x2', wR).attr('y1', ye(0)).attr('y2', ye(0)).attr('stroke', COLORS.faint);
	right.append('text').attr('x', wR / 2).attr('y', gTop + gH + 34).attr('text-anchor', 'middle').attr('font-size', 13)
		.attr('fill', COLORS.muted).text('epoch k');
	const legend = [
		{ name: objective === 'clip' ? 'L^{CLIP} (estimated on the batch)' : 'L^{CPI} (estimated on the batch)', color, dash: null },
		{ name: 'true gain J(θ_{k}) − J(θ_{old})', color: COLORS.ink, dash: null },
		...(objective === 'clip' ? [{ name: 'true gain without clipping', color: COLORS.reuse, dash: '4 3' }] : []),
	];
	legend.forEach((l, i) => {
		const y = gTop + gH + 60 + i * 20;
		right.append('line').attr('x1', -30).attr('x2', -8).attr('y1', y).attr('y2', y).attr('stroke', l.color)
			.attr('stroke-width', 2.5).attr('stroke-dasharray', l.dash).attr('opacity', l.dash ? 0.6 : 1);
		richText(right.append('text').attr('x', -2).attr('y', y).attr('dy', '0.35em').attr('font-size', 13).attr('fill', COLORS.ink), l.name);
	});
	const rdyn = right.append('g');

	function render(token: string | null) {
		const k = Math.max(0, Math.min(cfg.epochs, parseInt(token ?? '0', 10) || 0));
		const ep = run[k];
		dyn.selectAll('*').remove();
		rdyn.selectAll('*').remove();

		// densité courante
		if (k > 0) {
			const peak = pdf(ep.policy, ep.policy.mu);
			dyn.append('path').attr('d', line.y(a => yd(pdf(ep.policy, a)))(grid)).attr('fill', color).attr('fill-opacity', 0.15)
				.attr('stroke', color).attr('stroke-width', 2.5).attr('clip-path', `url(#${clipId})`);
			const mx = x(ep.policy.mu);
			if (peak > 0.75) {
				dyn.append('text').attr('x', mx).attr('y', dTop - 2).attr('text-anchor', 'middle').attr('font-size', 13)
					.attr('fill', color).text(`↑ peak ${peak.toFixed(1)}`);
			}
			const aLab = ep.policy.mu + 1.3 * sigma(ep.policy);
			richText(dyn.append('text').attr('x', Math.min(x(aLab) + 6, wL - 20)).attr('y', Math.max(yd(pdf(ep.policy, aLab)) - 4, dTop + 34))
				.attr('font-size', 15).attr('font-weight', 'bold').attr('fill', color), 'π_{θ}');
		}
		dyn.append('text').attr('x', 0).attr('y', dTop + 14).attr('font-size', 14).attr('fill', COLORS.ink)
			.text(`epoch ${k}:  μ = ${fmt(ep.policy.mu)},  σ = ${sigma(ep.policy).toFixed(2)}`);

		// échantillons
		samples.forEach((s, i) => {
			const h = s.adv * sScale / 0.7;
			const clipped = objective === 'clip' && k > 0 && ep.clipped[i];
			dyn.append('line').attr('x1', x(s.a)).attr('x2', x(s.a)).attr('y1', sBase).attr('y2', sBase - h)
				.attr('stroke', advColor(s.adv)).attr('stroke-width', 3).attr('opacity', clipped ? 0.35 : 1);
			dyn.append('circle').attr('cx', x(s.a)).attr('cy', sBase - h).attr('r', 4.5)
				.attr('fill', clipped ? '#fff' : advColor(s.adv)).attr('stroke', advColor(s.adv)).attr('stroke-width', 2);
		});

		// ratios
		const ratio = (a: number) => pdf(ep.policy, a) / pdf(old, a);
		dyn.append('path').attr('d', d3.line<number>().x(a => x(a)).y(a => yr(Math.max(ratio(a), 1e-6)))(grid))
			.attr('fill', 'none').attr('stroke', k > 0 ? color : COLORS.old).attr('stroke-width', 2);
		samples.forEach((s, i) => {
			const r = ep.ratios[i];
			const clipped = objective === 'clip' && k > 0 && ep.clipped[i];
			dyn.append('circle').attr('cx', x(s.a)).attr('cy', yr(Math.max(r, 1e-6))).attr('r', 5)
				.attr('fill', clipped ? '#fff' : advColor(s.adv)).attr('stroke', advColor(s.adv)).attr('stroke-width', 2);
		});
		if (d3.min(ep.ratios)! < 0.05) {
			dyn.append('text').attr('x', wL).attr('y', rTop + rH + 16).attr('text-anchor', 'end').attr('font-size', 12)
				.attr('fill', COLORS.code).text('↓ ratios below 0.05 drawn at the bottom');
		}

		// panneau de droite
		const upTo = run.slice(0, k + 1);
		const ln = (f: (e: Epoch) => number) => d3.line<Epoch>().x((_, i) => xe(i)).y(e => ye(f(e)));
		if (objective === 'clip') {
			rdyn.append('path').attr('d', ln(e => e.improvement)(runs.cpi.slice(0, k + 1))).attr('fill', 'none')
				.attr('stroke', COLORS.reuse).attr('stroke-width', 2).attr('stroke-dasharray', '4 3').attr('opacity', 0.6);
		}
		rdyn.append('path').attr('d', ln(e => e.surrogate)(upTo)).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2.5);
		rdyn.append('path').attr('d', ln(e => e.improvement)(upTo)).attr('fill', 'none').attr('stroke', COLORS.ink).attr('stroke-width', 2.5);
		rdyn.append('circle').attr('cx', xe(k)).attr('cy', ye(ep.surrogate)).attr('r', 4.5).attr('fill', color);
		rdyn.append('circle').attr('cx', xe(k)).attr('cy', ye(ep.improvement)).attr('r', 4.5).attr('fill', COLORS.ink);
		rdyn.append('text').attr('x', wR / 2).attr('y', gTop - 6).attr('text-anchor', 'middle').attr('font-size', 13)
			.attr('fill', COLORS.ink).text(`true gain ${fmtSigned(ep.improvement)},  KL ${ep.kl < 100 ? ep.kl.toFixed(2) : '> 100'}`);
	}

	syncWithFragments(svgEl, render);
});
