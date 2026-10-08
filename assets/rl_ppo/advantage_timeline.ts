// Slides « n-step advantages » (data-mode="nstep") et « GAE(λ) »
// (data-mode="gae") : une trajectoire fixée du couloir, les erreurs TD δ_t sous
// chaque transition, et l'estimateur de l'avantage de (S_0, A_0) :
//   - nstep : Â^(n)_0 = Σ_{l<n} γ^l δ_l, jeton = n (1, 2, 3, inf ; 0 = aucun) ;
//   - gae   : Â_0 = Σ_l (γλ)^l δ_l, jeton = λ, curseur .ppo-lambda-slider.
// Le critique est « en retard » : v̂ = valeurs exactes de la politique uniforme.
import * as d3 from 'd3';
import config from './ppo_config.json';
import { Corridor, exactValues } from './corridor';
import { syncWithFragments, bindSlider } from './frames';
import { COLORS, fmt, fmtSigned, advColor, arrowMarker, styleAxis } from './draw';

const env = new Corridor(config.corridor);
const vhat = exactValues(env, () => [0.5, 0.5]);
const gamma = env.gamma;

// la trajectoire : S_0 = start, actions fixées
const states = [env.start];
const rewards: number[] = [];
const deltas: number[] = [];
for (const a of config.advantageTimeline.actions) {
	const s = states[states.length - 1];
	const { s2, r, done } = env.step(s, a);
	rewards.push(r);
	deltas.push(r + (done ? 0 : gamma * vhat[s2]) - vhat[s]);
	states.push(s2);
	if (done) break;
}
const T = deltas.length;
/** Â^(n)_0, n = 1..T (n ≥ T : Monte Carlo). */
const nstep = d3.range(1, T + 1).map(n => d3.sum(deltas.slice(0, n), (d, l) => gamma ** l * d));
const gaeValue = (lam: number) => d3.sum(deltas, (d, l) => (gamma * lam) ** l * d);

document.querySelectorAll<SVGSVGElement>('svg.ppo-adv-timeline').forEach(svgEl => {
	const mode = svgEl.dataset.mode === 'gae' ? 'gae' : 'nstep';
	const svg = d3.select(svgEl);
	const section = svgEl.closest('section') as HTMLElement;
	const slider = section.querySelector<HTMLInputElement>('input.ppo-lambda-slider');
	const label = section.querySelector<HTMLElement>('.ppo-lambda-label');
	const head = arrowMarker(svg, 'ppo-tl-arrow', COLORS.muted, 9);

	// --- géométrie
	const xL = 70, dx = 82;
	const xs = (t: number) => xL + t * dx;           // état S_t
	const xm = (t: number) => xL + (t + 0.5) * dx;   // transition t → t+1
	const yState = 46, yBase = 175, scale = 230;     // barres δ : 0.3 → 69 px
	const yW = 300, wScale = 46;                     // ligne des poids

	// --- partie fixe : états, récompenses, δ
	const fixed = svg.append('g');
	fixed.append('text').attr('x', 0).attr('y', yState).attr('dy', '0.35em').attr('font-size', 15)
		.attr('fill', COLORS.muted).text('Sₜ');
	fixed.append('text').attr('x', 0).attr('y', yState + 34).attr('font-size', 13).attr('fill', COLORS.muted).text('v̂(Sₜ)');
	fixed.append('text').attr('x', 0).attr('y', yBase).attr('dy', '0.35em').attr('font-size', 15)
		.attr('fill', COLORS.muted).text('δₜ');
	fixed.append('line').attr('x1', xL - 20).attr('x2', xs(T) + 10).attr('y1', yBase).attr('y2', yBase)
		.attr('stroke', COLORS.faint);
	for (let t = 0; t <= T; t++) {
		const term = env.isTerminal(states[t]);
		fixed.append('circle').attr('cx', xs(t)).attr('cy', yState).attr('r', 17)
			.attr('fill', term ? COLORS.gold : COLORS.cell).attr('stroke', term ? '#b8901f' : COLORS.cellStroke).attr('stroke-width', 1.5);
		fixed.append('text').attr('x', xs(t)).attr('y', yState).attr('dy', '0.35em').attr('text-anchor', 'middle')
			.attr('font-size', 16).attr('font-weight', 'bold').attr('fill', COLORS.ink).text(states[t]);
		if (!term) {
			fixed.append('text').attr('x', xs(t)).attr('y', yState + 34).attr('text-anchor', 'middle')
				.attr('font-size', 13).attr('fill', COLORS.muted).text(fmt(vhat[states[t]]));
		}
	}
	for (let t = 0; t < T; t++) {
		fixed.append('line').attr('x1', xs(t) + 19).attr('x2', xs(t + 1) - 21).attr('y1', yState).attr('y2', yState)
			.attr('stroke', COLORS.muted).attr('stroke-width', 1.5).attr('marker-end', head);
		if (rewards[t]) {
			fixed.append('text').attr('x', xm(t)).attr('y', yState - 24).attr('text-anchor', 'middle')
				.attr('font-size', 14).attr('fill', '#9a7300').attr('font-weight', 'bold').text(`R = +${rewards[t]}`);
		}
		const h = deltas[t] * scale;
		fixed.append('rect').attr('class', 'delta-bar').attr('x', xm(t) - 13).attr('width', 26)
			.attr('y', Math.min(yBase, yBase - h)).attr('height', Math.max(Math.abs(h), 1))
			.attr('fill', advColor(deltas[t]));
		fixed.append('text').attr('x', xm(t)).attr('y', h >= 0 ? yBase - h - 6 : yBase - h + 15)
			.attr('text-anchor', 'middle').attr('font-size', 13).attr('fill', COLORS.ink).text(fmtSigned(deltas[t], 3));
	}
	fixed.append('text').attr('x', xs(0)).attr('y', yState + 54).attr('text-anchor', 'middle').attr('font-size', 13)
		.attr('fill', COLORS.code).text('A₀ = →');

	// --- partie variable : poids, estimateur
	const dyn = svg.append('g');
	const xR = 640, wR = 250;   // panneau de droite

	function drawWeights(weights: number[], title: string) {
		dyn.append('text').attr('x', 0).attr('y', yW - 36).attr('font-size', 13).attr('fill', COLORS.muted).text(title);
		dyn.append('line').attr('x1', xL - 20).attr('x2', xs(T) + 10).attr('y1', yW + 20).attr('y2', yW + 20).attr('stroke', COLORS.faint);
		for (let t = 0; t < T; t++) {
			const w = weights[t];
			dyn.append('rect').attr('x', xm(t) - 13).attr('width', 26).attr('y', yW + 20 - w * wScale)
				.attr('height', w * wScale).attr('fill', w > 0 ? COLORS.gae : 'none').attr('opacity', 0.75);
			dyn.append('text').attr('x', xm(t)).attr('y', yW + 37).attr('text-anchor', 'middle').attr('font-size', 12)
				.attr('fill', w > 0 ? COLORS.ink : COLORS.faint).text(w > 0 ? w.toFixed(2) : '0');
		}
		// opacité des barres δ selon le poids
		svg.selectAll<SVGRectElement, unknown>('rect.delta-bar').attr('opacity', (_, t) => (weights[t] > 0 ? 0.25 + 0.75 * weights[t] : 0.15));
	}

	function renderNstep(token: string | null) {
		dyn.selectAll('*').remove();
		const n = token === 'inf' ? T : parseInt(token ?? '0', 10) || 0;
		drawWeights(d3.range(T).map(l => (l < n ? gamma ** l : 0)), 'weight of δₜ:  γᵗ');
		// panneau de droite : Â^(n)_0 pour n = 1..T
		const g = dyn.append('g').attr('transform', `translate(${xR}, 0)`);
		g.append('text').attr('x', wR / 2).attr('y', yState - 10).attr('text-anchor', 'middle').attr('font-size', 15)
			.attr('fill', COLORS.ink).text('estimate of the advantage of (S₀, A₀)');
		g.append('line').attr('x1', 0).attr('x2', wR).attr('y1', yBase).attr('y2', yBase).attr('stroke', COLORS.faint);
		const bw = wR / T;
		for (let i = 0; i < T; i++) {
			const nn = i + 1, v = nstep[i];
			const shown = nn <= n;
			const h = v * scale;
			g.append('text').attr('x', (i + 0.5) * bw).attr('y', yBase + 95).attr('text-anchor', 'middle')
				.attr('font-size', 13).attr('fill', nn === n ? COLORS.code : COLORS.muted)
				.text(nn === T ? '∞' : nn);
			if (!shown) continue;
			g.append('rect').attr('x', (i + 0.15) * bw).attr('width', bw * 0.7)
				.attr('y', Math.min(yBase, yBase - h)).attr('height', Math.max(Math.abs(h), 1.5))
				.attr('fill', advColor(v)).attr('opacity', nn === n ? 1 : 0.4)
				.attr('stroke', nn === n ? COLORS.ink : 'none');
			if (nn === n) {
				g.append('text').attr('x', (i + 0.5) * bw).attr('y', h >= 0 ? yBase - h - 6 : yBase - h + 16)
					.attr('text-anchor', 'middle').attr('font-size', 15).attr('font-weight', 'bold').attr('fill', COLORS.ink)
					.text(fmtSigned(v, 3));
			}
		}
		g.append('text').attr('x', wR / 2).attr('y', yBase + 115).attr('text-anchor', 'middle').attr('font-size', 13)
			.attr('fill', COLORS.muted).text('n');
		if (n > 0) {
			const name = n === 1 ? 'n = 1: TD error δ₀' : n === T ? 'n = ∞: Monte Carlo, G₀ − v̂(S₀)' : `n = ${n}: G₀:${n} − v̂(S₀)`;
			g.append('text').attr('x', wR / 2).attr('y', yW + 10).attr('text-anchor', 'middle').attr('font-size', 15)
				.attr('fill', COLORS.code).text(name);
		}
	}

	function renderGae(lam: number) {
		dyn.selectAll('*').remove();
		if (label) label.textContent = `λ = ${lam.toFixed(2)}`;
		if (slider) slider.value = String(lam);
		drawWeights(d3.range(T).map(l => (gamma * lam) ** l), 'weight of δₜ:  (γλ)ᵗ');
		// panneau de droite : Â_0(λ) pour λ ∈ [0, 1], et le λ courant
		const g = dyn.append('g').attr('transform', `translate(${xR}, 0)`);
		g.append('text').attr('x', wR / 2).attr('y', yState - 10).attr('text-anchor', 'middle').attr('font-size', 15)
			.attr('fill', COLORS.ink).text('GAE estimate of the advantage of (S₀, A₀)');
		const x = d3.scaleLinear().domain([0, 1]).range([0, wR]);
		const y = (v: number) => yBase - v * scale;
		g.append('line').attr('x1', 0).attr('x2', wR).attr('y1', yBase).attr('y2', yBase).attr('stroke', COLORS.faint);
		g.append('g').attr('transform', `translate(0, ${yBase + 75})`)
			.call(d3.axisBottom(x).ticks(5).tickSizeOuter(0))
			.call(styleAxis);
		g.append('text').attr('x', wR / 2).attr('y', yBase + 112).attr('text-anchor', 'middle').attr('font-size', 13)
			.attr('fill', COLORS.muted).text('λ');
		const pts = d3.range(0, 1.0001, 0.01).map(l => [x(l), y(gaeValue(l))] as [number, number]);
		g.append('path').attr('d', d3.line()(pts)).attr('fill', 'none').attr('stroke', COLORS.gae).attr('stroke-width', 2.5);
		const v = gaeValue(lam);
		g.append('line').attr('x1', x(lam)).attr('x2', x(lam)).attr('y1', yBase).attr('y2', y(v))
			.attr('stroke', advColor(v)).attr('stroke-width', 3);
		g.append('circle').attr('cx', x(lam)).attr('cy', y(v)).attr('r', 6).attr('fill', advColor(v)).attr('stroke', COLORS.ink);
		g.append('text').attr('x', x(lam)).attr('y', y(v) + (v >= 0 ? -12 : 22)).attr('text-anchor', 'middle')
			.attr('font-size', 15).attr('font-weight', 'bold').attr('fill', COLORS.ink).text(fmtSigned(v, 3));
		g.append('text').attr('x', x(0)).attr('y', yBase + 58).attr('font-size', 12).attr('fill', COLORS.muted).text('TD');
		g.append('text').attr('x', x(1)).attr('y', yBase + 58).attr('text-anchor', 'end').attr('font-size', 12)
			.attr('fill', COLORS.muted).text('Monte Carlo');
	}

	if (mode === 'nstep') {
		syncWithFragments(svgEl, token => renderNstep(token));
	} else {
		syncWithFragments(svgEl, token => renderGae(parseFloat(token ?? '0') || 0));
		bindSlider(slider, renderGae);
	}
});
