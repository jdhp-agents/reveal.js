// d3.js version of assets/optimization_cem/optimization_cem_mixture.png
// Draws into the #cem-mixture-fig SVG (slide "not always the right family of distributions").
import * as d3 from 'd3';

const svg = d3.select<SVGSVGElement, unknown>('#cem-mixture-fig');
const margin = { top: 15, right: 215, bottom: 55, left: 65 };
const width = 760 - margin.left - margin.right;
const height = 420 - margin.top - margin.bottom;

const g = svg.append('g')
	.attr('transform', `translate(${margin.left},${margin.top})`);

const x = d3.scaleLinear().domain([-6, 6]).range([0, width]);
const y = d3.scaleLinear().domain([0, 0.3]).range([height, 0]);

const normalPdf = (v: number, mu: number, sigma: number): number =>
	Math.exp(-((v - mu) * (v - mu)) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));
const well = (u: number): number => Math.exp(-(u * u * u * u)); // smooth bump used to dig the two minima of f

// Bimodal objective function (minima at x = ±3) and the two fitted proposal distributions
const f = (v: number): number => 0.275 - 0.25 * (well((v - 3) / 1.25) + well((v + 3) / 1.25));
const normalFit = (v: number): number => normalPdf(v, 0, 3.2);
const mixtureFit = (v: number): number => 0.5 * normalPdf(v, -3, 1) + 0.5 * normalPdf(v, 3, 1);

const xs = d3.range(-6, 6.001, 0.02);
const path = (fn: (v: number) => number): string =>
	d3.line<number>().x(v => x(v)).y(v => y(fn(v)))(xs) ?? '';

const color = { f: '#222222', mixture: '#4aa3df', normal: '#ee6a6a' };

// Axes
g.append('g')
	.attr('transform', `translate(0,${height})`)
	.call(d3.axisBottom(x).tickValues([-5, 0, 5]).tickSizeOuter(0))
	.call(ax => ax.selectAll('text').attr('font-size', 17).attr('fill', '#444'))
	.call(ax => ax.selectAll('line, path').attr('stroke', '#999'));
g.append('g')
	.call(d3.axisLeft(y).tickValues([0, 0.1, 0.2, 0.3]).tickFormat(d3.format('~g')).tickSizeOuter(0))
	.call(ax => ax.selectAll('text').attr('font-size', 17).attr('fill', '#444'))
	.call(ax => ax.selectAll('line, path').attr('stroke', '#999'));
g.append('text')
	.attr('x', width / 2).attr('y', height + 48)
	.attr('text-anchor', 'middle').attr('font-size', 20)
	.attr('font-style', 'italic').attr('fill', '#444')
	.text('x');

// Samples drawn from the objective function (fixed for reproducibility)
const sampleX: number[] = [-4.7, -3.9, -3.75, -3.15, -3.05, 2.15, 2.9, 3.0, 4.1, 4.35];

// Layers in order of appearance: each non-static one is a reveal.js fragment,
// and its legend row (same order, top to bottom) shares its fragment index so
// both fade in together.
interface Layer {
	label: string;
	color: string;
	fn?: (v: number) => number; // curve layers
	strokeWidth?: number;
	dot?: boolean; // samples layer
	italic?: boolean;
	onTop?: boolean; // kept above the fitted curves
	static?: boolean; // shown as soon as the slide appears, not a fragment
	captionSelector?: string; // slide element revealed together with this layer
}
const layers: Layer[] = [
	{ label: 'f', color: color.f, fn: f, strokeWidth: 2.5, italic: true, onTop: true, static: true },
	{ label: 'samples', color: color.f, dot: true, onTop: true },
	{ label: 'normal fit', color: color.normal, fn: normalFit, strokeWidth: 2 },
	{ label: 'mixture model fit', color: color.mixture, fn: mixtureFit, strokeWidth: 2, captionSelector: '.cem-mixture-caption' }
];

const legend = g.append('g')
	.attr('transform', `translate(${width + 35},25)`)
	.attr('font-size', 18);

const asFragment = <S extends d3.Selection<SVGGElement, unknown, HTMLElement, unknown>>(sel: S, index: number): S =>
	sel.attr('class', 'fragment').attr('data-fragment-index', index);

let fragmentIndex = 0;
const layerGroups = layers.map((layer, i) => {
	const group = g.append('g');
	if (layer.dot) {
		group.selectAll('circle').data(sampleX).join('circle')
			.attr('cx', v => x(v)).attr('cy', v => y(f(v))).attr('r', 5)
			.attr('fill', layer.color).attr('stroke', '#fff').attr('stroke-width', 1.5);
	} else {
		group.append('path').attr('d', path(layer.fn!))
			.attr('fill', 'none').attr('stroke', layer.color).attr('stroke-width', layer.strokeWidth!);
	}

	const row = legend.append('g')
		.attr('transform', `translate(0,${i * 38})`);
	if (!layer.static) {
		asFragment(group, fragmentIndex);
		asFragment(row, fragmentIndex);
		if (layer.captionSelector) {
			// Fragment indices must be set here, after Reveal.initialize: reveal.js
			// renumbers any index hardcoded in the slide HTML before this module runs.
			svg.node()?.closest('section')?.querySelectorAll(layer.captionSelector).forEach(el => {
				el.classList.add('fragment');
				el.setAttribute('data-fragment-index', String(fragmentIndex));
			});
		}
		fragmentIndex++;
	}
	if (layer.dot) {
		row.append('circle').attr('cx', 14).attr('cy', 0).attr('r', 5).attr('fill', layer.color);
	} else {
		row.append('line').attr('x1', 0).attr('x2', 28).attr('y1', 0).attr('y2', 0)
			.attr('stroke', layer.color).attr('stroke-width', layer.strokeWidth!);
	}
	row.append('text').attr('x', 38).attr('y', 6).attr('fill', '#333')
		.attr('font-style', layer.italic ? 'italic' : 'normal')
		.text(layer.label);

	return group;
});

// f and the samples are appended before the fitted curves but must stay above them
layers.forEach((layer, i) => { if (layer.onTop) layerGroups[i].raise(); });
