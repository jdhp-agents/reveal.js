// Slide « The clipped objective » : le terme de L^CLIP d'un échantillon en
// fonction du ratio ρ, pour un avantage positif (à gauche) et négatif (à
// droite) — la figure 1 du papier PPO, construite fragment par fragment :
//   none       axes seuls
//   unclipped  + ρ·Adv (tirets gris)
//   clipped    + clip(ρ, 1−ε, 1+ε)·Adv (violet)
//   min        + min des deux = L^CLIP (trait épais)
//   zero       + zones où le gradient est nul
// Curseur .ppo-eps-slider pour ε.
import * as d3 from 'd3';
import { syncWithFragments, bindSlider } from './frames';
import { COLORS, styleAxis, richText } from './draw';

document.querySelectorAll<SVGSVGElement>('svg.ppo-clip-objective').forEach(svgEl => {
	const svg = d3.select(svgEl);
	const section = svgEl.closest('section') as HTMLElement;
	const slider = section.querySelector<HTMLInputElement>('input.ppo-eps-slider');
	const label = section.querySelector<HTMLElement>('.ppo-eps-label');
	const order = ['none', 'unclipped', 'clipped', 'min', 'zero'];
	let step = 0, eps = 0.2;

	const W = 360, H = 240, top = 40;
	const x = d3.scaleLinear().domain([0, 2]).range([0, W]);
	const panels = [
		{ sign: 1, x0: 60, title: 'Adv > 0: the action was better than average' },
		{ sign: -1, x0: 510, title: 'Adv < 0: the action was worse than average' },
	].map(p => {
		const y = d3.scaleLinear().domain(p.sign > 0 ? [0, 2] : [-2, 0]).range([top + H, top]);
		const g = svg.append('g').attr('transform', `translate(${p.x0}, 0)`);
		return { ...p, y, g, dyn: g.append('g') };
	});

	function render() {
		if (label) label.textContent = `ε = ${eps.toFixed(2)}`;
		if (slider) slider.value = String(eps);
		const clip = (r: number) => Math.min(Math.max(r, 1 - eps), 1 + eps);
		const rs = d3.range(0, 2.0001, 0.005);
		for (const p of panels) {
			const { g, y, sign } = p;
			g.selectAll('.static').remove();
			p.dyn.selectAll('*').remove();
			const st = g.append('g').attr('class', 'static');
			st.append('text').attr('x', W / 2).attr('y', 14).attr('text-anchor', 'middle').attr('font-size', 15)
				.attr('font-weight', 'bold').attr('fill', sign > 0 ? COLORS.pos : COLORS.neg).text(p.title);
			st.append('g').attr('transform', `translate(0, ${sign > 0 ? top + H : top})`)
				.call((sign > 0 ? d3.axisBottom(x) : d3.axisTop(x)).tickValues([0, 1 - eps, 1, 1 + eps, 2]).tickFormat(d3.format('.2~f')))
				.call(styleAxis);
			st.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(d => `${d3.format('~f')(d)}·|Adv|`)).call(styleAxis);
			richText(st.append('text').attr('x', W + 8).attr('y', sign > 0 ? top + H : top).attr('dy', '0.35em')
				.attr('font-size', 15).attr('fill', COLORS.muted), 'ρ_{t}');
			for (const v of [1 - eps, 1 + eps]) {
				st.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', top).attr('y2', top + H)
					.attr('stroke', COLORS.clip).attr('stroke-dasharray', '3 3').attr('opacity', 0.6);
			}

			const d = p.dyn;
			const line = (f: (r: number) => number) => d3.line<number>().x(r => x(r)).y(r => y(f(r)))(rs);
			if (step >= 4) {
				// zone à gradient nul
				const [a, b] = sign > 0 ? [1 + eps, 2] : [0, 1 - eps];
				d.append('rect').attr('x', x(a)).attr('width', x(b) - x(a)).attr('y', top).attr('height', H)
					.attr('fill', '#999').attr('opacity', 0.15);
				d.append('text').attr('x', (x(a) + x(b)) / 2).attr('y', top + H - 40).attr('text-anchor', 'middle')
					.attr('font-size', 13).attr('fill', COLORS.ink).text('gradient = 0');
				d.append('text').attr('x', (x(a) + x(b)) / 2).attr('y', top + H - 22).attr('text-anchor', 'middle')
					.attr('font-size', 13).attr('fill', COLORS.ink).text('no incentive to go further');
				// pessimisme : la pénalité reste entière dans le mauvais sens
				const [c, e] = sign > 0 ? [0, 1 - eps] : [1 + eps, 2];
				d.append('text').attr('x', (x(c) + x(e)) / 2).attr('y', top + 30).attr('text-anchor', 'middle')
					.attr('font-size', 13).attr('fill', COLORS.code).text('wrong way: full penalty kept');
			}
			if (step >= 1) {
				d.append('path').attr('d', line(r => sign * r)).attr('fill', 'none').attr('stroke', COLORS.muted)
					.attr('stroke-width', 2).attr('stroke-dasharray', '6 4');
				richText(d.append('text').attr('x', sign > 0 ? x(1.97) : x(0.4)).attr('y', sign > 0 ? y(1.97) + 18 : y(-0.3))
					.attr('text-anchor', sign > 0 ? 'end' : 'start')
					.attr('font-size', 14).attr('fill', COLORS.muted), 'ρ_{t} Adv_{t}');
			}
			if (step >= 2) {
				d.append('path').attr('d', line(r => sign * clip(r))).attr('fill', 'none').attr('stroke', COLORS.clip).attr('stroke-width', 2.5);
				richText(d.append('text').attr('x', x(0.05)).attr('y', y(sign * (1 - eps)) - 10)
					.attr('font-size', 14).attr('fill', COLORS.clip), 'clip(ρ_{t}, 1−ε, 1+ε) Adv_{t}');
			}
			if (step >= 3) {
				d.append('path').attr('d', line(r => Math.min(sign * r, sign * clip(r)))).attr('fill', 'none')
					.attr('stroke', COLORS.ink).attr('stroke-width', 5).attr('opacity', 0.85);
				richText(d.append('text').attr('x', sign > 0 ? x(1.45) : x(1.25)).attr('y', sign > 0 ? y(1 + eps) - 14 : y(-1.7))
					.attr('text-anchor', 'middle').attr('font-size', 15).attr('font-weight', 'bold').attr('fill', COLORS.ink), 'L^{CLIP}_{t}');
				d.append('circle').attr('cx', x(1)).attr('cy', y(sign)).attr('r', 5).attr('fill', COLORS.code);
			}
		}
	}

	syncWithFragments(svgEl, token => { step = Math.max(0, order.indexOf(token ?? 'none')); render(); });
	bindSlider(slider, v => { eps = v; render(); });
});
