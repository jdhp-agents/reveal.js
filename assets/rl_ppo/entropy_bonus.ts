// Slide « Entropy bonus: keep exploring » : PPO (clip) sur le bandit gaussien à
// deux modes (petit mode proche, grand mode lointain), pour plusieurs
// coefficients d'entropie c₂.
//   à gauche : une exécution (seed shownSeed) — la densité de la politique à
//              chaque itération (une ligne par itération, de haut en bas) ;
//   à droite : sur `seeds` exécutions par valeur de c₂, la part de celles qui
//              trouvent le grand mode (J final > 0.75) et le J final moyen.
// Jeton = c₂ ; curseur .ppo-c2-slider (indice dans la liste des c₂).
import * as d3 from 'd3';
import config from './ppo_config.json';
import { runPpo, pdf, reward, sigma } from './bandit';
import type { BanditIteration } from './bandit';
import { syncWithFragments, bindSlider } from './frames';
import { COLORS, styleAxis, fmt } from './draw';

const c = config.bandit.entropy;
const init = config.bandit.policy0;
const SUCCESS = 0.75;
const runOpts = (coef: number, seed: number) => ({
	iterations: c.iterations, batch: c.batch, noise: c.noise, epochs: c.epochs, lr: c.lr,
	eps: c.clipEps, entropyCoef: coef, seed,
});
const shown: Record<number, BanditIteration[]> = {};
const stats = c.coefs.map(coef => {
	const finals: number[] = [];
	for (let seed = 1; seed <= c.seeds; seed++) {
		const it = runPpo(c.bumps, init, runOpts(coef, seed));
		if (seed === c.shownSeed) shown[coef] = it;
		finals.push(it[it.length - 1].J);
	}
	return { coef, success: finals.filter(j => j > SUCCESS).length / c.seeds, meanJ: d3.mean(finals)! };
});

document.querySelectorAll<SVGSVGElement>('svg.ppo-entropy').forEach(svgEl => {
	const svg = d3.select(svgEl);
	const section = svgEl.closest('section') as HTMLElement;
	const slider = section.querySelector<HTMLInputElement>('input.ppo-c2-slider');
	const label = section.querySelector<HTMLElement>('.ppo-c2-label');
	if (slider) { slider.min = '0'; slider.max = String(c.coefs.length - 1); slider.step = '1'; }

	// --- panneau gauche : densités au fil des itérations
	const xL0 = 40, wL = 470, rTop = 10, rH = 60, hTop = rTop + rH + 8, hH = 280;
	const x = d3.scaleLinear().domain([-4, 6]).range([0, wL]);
	const left = svg.append('g').attr('transform', `translate(${xL0}, 0)`);
	const grid = d3.range(-4, 6.0001, 0.05);
	const yR = d3.scaleLinear().domain([0, 1]).range([rTop + rH, rTop]);
	left.append('path').attr('d', d3.area<number>().x(a => x(a)).y0(yR(0)).y1(a => yR(reward(c.bumps, a)))(grid))
		.attr('fill', COLORS.goldLight).attr('stroke', COLORS.gold);
	left.append('text').attr('x', x(-1.2)).attr('y', yR(0.5) - 6).attr('text-anchor', 'middle').attr('font-size', 13).attr('fill', '#9a7300').text('small mode');
	left.append('text').attr('x', x(2.8)).attr('y', yR(1) + 14).attr('text-anchor', 'start').attr('dx', 30).attr('font-size', 13).attr('fill', '#9a7300').text('big mode');
	left.append('text').attr('x', -8).attr('y', yR(0.5)).attr('text-anchor', 'end').attr('font-size', 13).attr('fill', '#9a7300').text('R(a)');
	const yI = d3.scaleLinear().domain([0, c.iterations]).range([hTop, hTop + hH]);
	left.append('g').attr('transform', `translate(0, ${hTop + hH})`).call(d3.axisBottom(x).ticks(6)).call(styleAxis);
	left.append('g').call(d3.axisLeft(yI).ticks(4)).call(styleAxis);
	left.append('text').attr('x', -32).attr('y', hTop + hH / 2).attr('text-anchor', 'middle').attr('font-size', 13)
		.attr('fill', COLORS.muted).attr('transform', `rotate(-90, -32, ${hTop + hH / 2})`).text('iteration');
	left.append('text').attr('x', wL + 6).attr('y', hTop + hH + 4).attr('font-size', 14).attr('fill', COLORS.muted).text('a');
	const heat = left.append('g');
	const info = left.append('g');

	// --- panneau droit : statistiques sur toutes les seeds
	const xR0 = 600, wR = 280;
	const right = svg.append('g').attr('transform', `translate(${xR0}, 0)`);
	const xb = d3.scaleBand<number>().domain(c.coefs).range([0, wR]).padding(0.25);
	const ys = d3.scaleLinear().domain([0, 1]).range([170, 30]);
	const yj = d3.scaleLinear().domain([0, 1]).range([360, 230]);
	right.append('text').attr('x', wR / 2).attr('y', 16).attr('text-anchor', 'middle').attr('font-size', 14).attr('fill', COLORS.ink)
		.text(`runs that find the big mode (${c.seeds} seeds)`);
	right.append('text').attr('x', wR / 2).attr('y', 216).attr('text-anchor', 'middle').attr('font-size', 14).attr('fill', COLORS.ink)
		.text('mean final performance J');
	right.append('g').attr('transform', 'translate(0, 170)').call(d3.axisBottom(xb).tickFormat(d => String(d))).call(styleAxis);
	right.append('g').call(d3.axisLeft(ys).ticks(4).tickFormat(d3.format('.0%'))).call(styleAxis);
	right.append('g').attr('transform', 'translate(0, 360)').call(d3.axisBottom(xb).tickFormat(d => String(d))).call(styleAxis);
	right.append('g').call(d3.axisLeft(yj).ticks(4)).call(styleAxis);
	right.append('text').attr('x', wR / 2).attr('y', 394).attr('text-anchor', 'middle').attr('font-size', 13).attr('fill', COLORS.muted)
		.text('entropy coefficient c₂');
	const bars = right.append('g');

	function render(coef: number) {
		const i = Math.max(0, c.coefs.indexOf(coef));
		coef = c.coefs[i];
		if (label) label.textContent = `c₂ = ${coef}`;
		if (slider) slider.value = String(i);
		const run = shown[coef];

		heat.selectAll('*').remove();
		const rowH = hH / c.iterations;
		run.forEach((it, k) => {
			if (k >= c.iterations) return;
			const dens = grid.map(a => pdf(it.policy, a));
			const mx = d3.max(dens)! || 1;
			const g = heat.append('g');
			for (let j = 0; j < grid.length - 1; j++) {
				const v = dens[j] / mx;
				if (v < 0.03) continue;
				g.append('rect').attr('x', x(grid[j])).attr('y', yI(k)).attr('width', x(grid[j + 1]) - x(grid[j]) + 0.5)
					.attr('height', rowH + 0.5).attr('fill', COLORS.ent).attr('opacity', v);
			}
		});
		info.selectAll('*').remove();
		const last = run[run.length - 1];
		const sig = sigma(last.policy);
		info.append('text').attr('x', wL / 2).attr('y', hTop + hH + 40).attr('text-anchor', 'middle').attr('font-size', 14).attr('fill', COLORS.ink)
			.text(`one run (seed ${c.shownSeed}): final μ = ${fmt(last.policy.mu)}, σ = ${sig < 100 ? sig.toFixed(2) : '> 100'}, J = ${last.J.toFixed(2)}`);

		bars.selectAll('*').remove();
		for (const st of stats) {
			const cur = st.coef === coef;
			bars.append('rect').attr('x', xb(st.coef)!).attr('width', xb.bandwidth()).attr('y', ys(st.success)).attr('height', 170 - ys(st.success))
				.attr('fill', COLORS.ent).attr('opacity', cur ? 1 : 0.3);
			bars.append('rect').attr('x', xb(st.coef)!).attr('width', xb.bandwidth()).attr('y', yj(st.meanJ)).attr('height', 360 - yj(st.meanJ))
				.attr('fill', COLORS.ink).attr('opacity', cur ? 0.9 : 0.2);
			if (cur) {
				bars.append('text').attr('x', xb(st.coef)! + xb.bandwidth() / 2).attr('y', ys(st.success) - 5).attr('text-anchor', 'middle')
					.attr('font-size', 13).attr('font-weight', 'bold').attr('fill', COLORS.ent).text(`${Math.round(st.success * 100)}%`);
				bars.append('text').attr('x', xb(st.coef)! + xb.bandwidth() / 2).attr('y', yj(st.meanJ) - 5).attr('text-anchor', 'middle')
					.attr('font-size', 13).attr('font-weight', 'bold').attr('fill', COLORS.ink).text(st.meanJ.toFixed(2));
			}
		}
	}

	syncWithFragments(svgEl, token => render(parseFloat(token ?? '0') || 0));
	bindSlider(slider, v => render(c.coefs[Math.round(v)]));
});
