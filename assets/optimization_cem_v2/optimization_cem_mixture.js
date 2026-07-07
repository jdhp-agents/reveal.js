// d3.js version of assets/optimization_cem/optimization_cem_mixture.png
// Draws into the #cem-mixture-fig SVG (slide "not always the right family of distributions").
(function () {
	const svg = d3.select('#cem-mixture-fig');
	const margin = { top: 15, right: 215, bottom: 55, left: 65 };
	const width = 760 - margin.left - margin.right;
	const height = 420 - margin.top - margin.bottom;

	const g = svg.append('g')
		.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

	const x = d3.scaleLinear().domain([-6, 6]).range([0, width]);
	const y = d3.scaleLinear().domain([0, 0.3]).range([height, 0]);

	const normalPdf = (v, mu, sigma) =>
		Math.exp(-((v - mu) * (v - mu)) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));
	const well = u => Math.exp(-(u * u * u * u)); // smooth bump used to dig the two minima of f

	// Bimodal objective function (minima at x = ±3) and the two fitted proposal distributions
	const f = v => 0.275 - 0.25 * (well((v - 3) / 1.25) + well((v + 3) / 1.25));
	const normalFit = v => normalPdf(v, 0, 3.2);
	const mixtureFit = v => 0.5 * normalPdf(v, -3, 1) + 0.5 * normalPdf(v, 3, 1);

	const xs = d3.range(-6, 6.001, 0.02);
	const path = fn => d3.line().x(v => x(v)).y(v => y(fn(v)))(xs);

	const color = { f: '#222222', mixture: '#4aa3df', normal: '#ee6a6a' };

	// Axes
	g.append('g')
		.attr('transform', 'translate(0,' + height + ')')
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

	// Curves (f drawn last so it stays on top)
	g.append('path').attr('d', path(normalFit))
		.attr('fill', 'none').attr('stroke', color.normal).attr('stroke-width', 2);
	g.append('path').attr('d', path(mixtureFit))
		.attr('fill', 'none').attr('stroke', color.mixture).attr('stroke-width', 2);
	g.append('path').attr('d', path(f))
		.attr('fill', 'none').attr('stroke', color.f).attr('stroke-width', 2.5);

	// Samples drawn from the objective function (fixed for reproducibility)
	const sampleX = [-4.7, -3.9, -3.75, -3.15, -3.05, 2.15, 2.9, 3.0, 4.1, 4.35];
	g.selectAll('circle.sample').data(sampleX).join('circle')
		.attr('class', 'sample')
		.attr('cx', v => x(v)).attr('cy', v => y(f(v))).attr('r', 5)
		.attr('fill', color.f).attr('stroke', '#fff').attr('stroke-width', 1.5);

	// Legend
	const legend = g.append('g')
		.attr('transform', 'translate(' + (width + 35) + ',25)')
		.attr('font-size', 18);
	const entries = [
		{ label: 'f', color: color.f, italic: true },
		{ label: 'mixture model fit', color: color.mixture },
		{ label: 'normal fit', color: color.normal },
		{ label: 'samples', color: color.f, dot: true }
	];
	entries.forEach((e, i) => {
		const row = legend.append('g').attr('transform', 'translate(0,' + (i * 38) + ')');
		if (e.dot) {
			row.append('circle').attr('cx', 14).attr('cy', 0).attr('r', 5).attr('fill', e.color);
		} else {
			row.append('line').attr('x1', 0).attr('x2', 28).attr('y1', 0).attr('y2', 0)
				.attr('stroke', e.color).attr('stroke-width', e.label === 'f' ? 2.5 : 2);
		}
		row.append('text').attr('x', 38).attr('y', 6).attr('fill', '#333')
			.attr('font-style', e.italic ? 'italic' : 'normal')
			.text(e.label);
	});
})();
