// Version d3.js des figures « CEM sur la fonction de Rosenbrock » (contours de
// f, ellipses de la proposal distribution, échantillons et élites par itération).
//
// Contrairement à la v2 (assets/optimization_cem_v2/), les données par itération
// ne sont pas lues dans un JSON précalculé : elles sont recalculées au chargement
// de la page par l'implémentation TypeScript du CEM (cem.ts), avec une seed de
// random fixée — l'exécution est donc parfaitement reproductible. L'apparence
// (fonction objectif, paramètres du CEM, niveaux de contours, couleurs) vient de
// cem_rosenbrock_config.json, éditable à la main.
//
// Usage dans une slide — figure statique :
//   <svg class="cem-rosenbrock-fig" data-iteration="3" data-phase="fit" …></svg>
// ou figure pilotée par les fragments de sa <section> (un jeton "k:phase" par
// data-fragment-index, data-initial-frame pour l'état avant le premier fragment,
// absent = figure cachée) :
//   <svg class="cem-rosenbrock-fig" data-initial-frame="1:proposal"
//        data-frames="1:samples 1:fit 2:proposal …"></svg>
// Phases : objective = contours de f seuls (fond, sans titre d'itération) ;
//          proposal = ellipses de la distribution courante seules ;
//          samples  = + échantillons ; elite = échantillons + élites en rouge
//          (sans distribution) ; fit = + distribution ajustée sur les élites
//          (rouge, = proposal de l'itération k+1).
//
// Zoom progressif : le CEM concentrant échantillons et ellipses sur une zone de
// plus en plus petite, les figures pilotées par fragments n'affichent pas
// toujours le domaine complet mais la fenêtre (range x/y) définie pour
// l'itération courante dans config.zoom.views ; le passage d'une fenêtre à la
// suivante est animé (~1 s, config.zoom.transitionDuration). Le fond (contours,
// étiquettes, axes) et le contenu dynamique suivent le même zoom. Les figures
// statiques (data-iteration) gardent le domaine complet, pour rester comparables
// entre elles.
import * as d3 from 'd3';
import { cem } from './cem';
import config from './cem_rosenbrock_config.json';

type Phase = 'objective' | 'proposal' | 'samples' | 'elite' | 'fit';
interface Frame { k: number; phase: Phase; }
/** Fenêtre d'affichage : domaines [min, max] des deux axes. */
interface View { x: number[]; y: number[]; }

const VB_W = 420, VB_H = 400;
const margin = { top: 28, right: 25, bottom: 32, left: 55 };
const plotW = VB_W - margin.left - margin.right;   // 340
const plotH = VB_H - margin.top - margin.bottom;   // 340

// Échelles de base (domaine complet) : servent à construire une seule fois le
// fond partagé (contours, étiquettes) ; chaque figure zoome ensuite sur des
// copies dont seul le domaine change.
const [x0, x1] = config.objective.xDomain;
const [y0, y1] = config.objective.yDomain;
const xScale = d3.scaleLinear().domain([x0, x1]).range([0, plotW]);
const yScale = d3.scaleLinear().domain([y0, y1]).range([plotH, 0]);

// ---------------------------------------------------------------------------
// Fonction objectif (partagée par les courbes de niveau et par le CEM) et
// exécution du CEM : calculées une seule fois, pour toutes les figures de la
// page. `run[k - 1]` contient tout ce que l'itération k a produit.
// ---------------------------------------------------------------------------
const f = new Function('x', 'y', `return ${config.objective.expression};`) as
	(x: number, y: number) => number;

const run = cem(([x, y]) => f(x, y), config.cem);

// ---------------------------------------------------------------------------
// Fenêtres de zoom par itération (config.zoom.views). Chaque fenêtre est
// recadrée pour garder le rapport d'aspect du domaine complet — les pixels
// restent isométriques, ce que suppose gaussianLevelEllipses.
// ---------------------------------------------------------------------------
const fullView: View = { x: [x0, x1], y: [y0, y1] };

function normalizeView(v: View): View {
	const target = (x1 - x0) / (y1 - y0);
	const sx = v.x[1] - v.x[0], sy = v.y[1] - v.y[0];
	if (Math.abs(sx / sy - target) < 1e-9) return v;
	if (sx / sy < target) {
		const cx = (v.x[0] + v.x[1]) / 2, half = (sy * target) / 2;
		return { x: [cx - half, cx + half], y: v.y };
	}
	const cy = (v.y[0] + v.y[1]) / 2, half = (sx / target) / 2;
	return { x: v.x, y: [cy - half, cy + half] };
}

const zoomViews = new Map<number, View>(
	Object.entries(config.zoom.views)
		.map(([k, v]) => [parseInt(k, 10), normalizeView(v)]));

/** Fenêtre de l'itération k : celle du plus grand k' <= k défini, sinon tout. */
function viewForIteration(k: number): View {
	let view = fullView, bestK = 0;
	for (const [kk, v] of zoomViews) {
		if (kk <= k && kk >= bestK) { bestK = kk; view = v; }
	}
	return view;
}

// Contours de la fonction objectif. La grille est calculée sur un domaine
// étendu : l'union du domaine complet et de toutes les fenêtres de zoom, plus
// une marge de quelques cellules qui rejette hors de toute fenêtre les
// segments artificiels refermant les anneaux au bord de la grille — ainsi les
// courbes de niveau restent définies quand une fenêtre déborde du domaine des
// axes. La densité de cellules est celle de gridResolution sur le domaine
// complet.
const cell = (x1 - x0) / config.objective.gridResolution;
let cx0 = x0, cx1 = x1, cy0 = y0, cy1 = y1;
for (const v of zoomViews.values()) {
	cx0 = Math.min(cx0, v.x[0]); cx1 = Math.max(cx1, v.x[1]);
	cy0 = Math.min(cy0, v.y[0]); cy1 = Math.max(cy1, v.y[1]);
}
const gridMargin = 8 * cell;
cx0 -= gridMargin; cy0 -= gridMargin;
const nx = Math.ceil((cx1 + gridMargin - cx0) / cell);
const ny = Math.ceil((cy1 + gridMargin - cy0) / cell);
const values = new Array<number>(nx * ny);
for (let j = 0; j < ny; j++) {
	const y = cy0 + (j + 0.5) * cell;
	for (let i = 0; i < nx; i++) {
		values[j * nx + i] = f(cx0 + (i + 0.5) * cell, y);
	}
}
const levels = config.objective.contourLevels;
const objectiveContours = d3.contours().size([nx, ny]).thresholds(levels)(values);

// grille -> pixels de la zone de tracé (au domaine complet)
const gridToSvg = (gx: number, gy: number): [number, number] =>
	[xScale(cx0 + gx * cell), yScale(cy0 + gy * cell)];
const contourPath = d3.geoPath(d3.geoTransform({
	point(gx, gy) { this.stream.point(...gridToSvg(gx, gy)); }
}));

const logMin = Math.log(levels[0]), logMax = Math.log(levels[levels.length - 1]);
const levelColor = (lv: number): string =>
	d3.interpolateViridis(1 - (Math.log(lv) - logMin) / (logMax - logMin));

// Étiquettes inline des niveaux (façon matplotlib clabel) : 1 ou 2 par anneau
// selon la longueur de sa portion visible au domaine complet, orientées le
// long de la courbe. x/y sont en pixels du domaine complet ; chaque figure les
// replace selon sa fenêtre courante (et masque celles qui sortent de la zone
// de tracé).
interface Label { x: number; y: number; angle: number; text: string; color: string; }
const contourLabels: Label[] = [];
const inFullPlot = (px: number, py: number): boolean =>
	px >= 0 && px <= plotW && py >= 0 && py <= plotH;
for (const contour of objectiveContours) {
	if (!config.objective.labeledLevels.some(lv => Math.abs(lv - contour.value) < 1e-9)) continue;
	for (const polygon of contour.coordinates) {
		const ring = (polygon[0] as [number, number][]).map(p => gridToSvg(p[0], p[1]));
		// longueur des segments, comptée nulle hors de la zone de tracé du
		// domaine complet (la grille étendue déborde des axes) : les étiquettes
		// se répartissent sur la seule portion visible de l'anneau
		const segLen = ring.map((p, i) => {
			const q = ring[(i + 1) % ring.length];
			return inFullPlot(p[0], p[1]) && inFullPlot(q[0], q[1])
				? Math.hypot(q[0] - p[0], q[1] - p[1]) : 0;
		});
		const perimeter = d3.sum(segLen);
		if (perimeter === 0) continue;
		const fractions = perimeter > 300 ? [0.25, 0.75] : [0.5];
		for (const frac of fractions) {
			let target = frac * perimeter, i = 0;
			while (i < ring.length - 1 && target > segLen[i]) target -= segLen[i++];
			const [px, py] = ring[i];
			const [qx, qy] = ring[(i + 1) % ring.length];
			let angle = Math.atan2(qy - py, qx - px) * 180 / Math.PI;
			if (angle > 90) angle -= 180;
			if (angle < -90) angle += 180;
			contourLabels.push({
				x: px, y: py, angle,
				text: String(Math.round(contour.value)),
				color: levelColor(contour.value)
			});
		}
	}
}

// ---------------------------------------------------------------------------
// Ellipses de niveau d'une gaussienne N(mu, sigma) : la densité vaut `level`
// sur l'ellipse de rayon de Mahalanobis r = sqrt(2 ln(pic / level)).
// Calculées dans les échelles courantes (donc la fenêtre de zoom) de la figure.
// ---------------------------------------------------------------------------
interface EllipseSpec { cx: number; cy: number; rx: number; ry: number; rotate: number; }
function gaussianLevelEllipses(
	mu: number[], sigma: number[][],
	xs: d3.ScaleLinear<number, number>, ys: d3.ScaleLinear<number, number>
): EllipseSpec[] {
	const [a, b, c] = [sigma[0][0], sigma[0][1], sigma[1][1]];
	const det = a * c - b * b;
	if (det <= 0) return [];
	const peak = 1 / (2 * Math.PI * Math.sqrt(det));
	const disc = Math.sqrt(Math.max(((a - c) / 2) ** 2 + b * b, 0));
	const l1 = (a + c) / 2 + disc, l2 = (a + c) / 2 - disc; // valeurs propres
	const theta = 0.5 * Math.atan2(2 * b, a - c);           // orientation de l1
	const xd = xs.domain();
	const pxPerUnit = plotW / (xd[1] - xd[0]);              // repère isométrique
	return config.proposal.pdfLevels
		.filter(lv => lv < peak)
		.map(lv => {
			const r = Math.sqrt(2 * Math.log(peak / lv));
			return {
				cx: xs(mu[0]), cy: ys(mu[1]),
				rx: r * Math.sqrt(l1) * pxPerUnit, ry: r * Math.sqrt(l2) * pxPerUnit,
				rotate: -theta * 180 / Math.PI // y inversé en SVG
			};
		});
}

// ---------------------------------------------------------------------------
// Construction d'une figure dans un <svg> : fond construit une fois (contours
// de f, étiquettes, axes, cadre) puis repositionné selon la fenêtre courante ;
// ellipses et échantillons redessinés à chaque frame et à chaque pas du zoom.
// ---------------------------------------------------------------------------
let uid = 0;
function setupFigure(el: SVGSVGElement, zoomEnabled: boolean): (frame: Frame | null) => void {
	const svg = d3.select(el)
		.attr('viewBox', `0 0 ${VB_W} ${VB_H}`)
		.attr('preserveAspectRatio', 'xMidYMid meet');
	const clipId = `cem-rosenbrock-clip-${uid++}`;
	svg.append('defs').append('clipPath').attr('id', clipId)
		.append('rect').attr('width', plotW).attr('height', plotH);
	const root = svg.append('g')
		.attr('transform', `translate(${margin.left},${margin.top})`);

	// Échelles de la figure : mêmes pixels, domaine = fenêtre de zoom courante.
	const xs = xScale.copy(), ys = yScale.copy();

	// Fond : contours tracés en pixels du domaine complet dans un groupe dont la
	// transformation affine réalise le zoom (le clip reste sur le groupe parent,
	// non transformé) ; vector-effect garde l'épaisseur de trait constante.
	const gStatic = root.append('g').attr('clip-path', `url(#${clipId})`).append('g');
	for (const contour of objectiveContours) {
		gStatic.append('path')
			.attr('d', contourPath(contour))
			.attr('fill', 'none')
			.attr('stroke', levelColor(contour.value))
			.attr('stroke-width', config.objective.strokeWidth)
			.attr('vector-effect', 'non-scaling-stroke');
	}
	const labelTexts = root.append('g')
		.selectAll<SVGTextElement, Label>('text')
		.data(contourLabels)
		.join('text')
		.attr('text-anchor', 'middle').attr('dy', '0.35em')
		.attr('font-size', 12).attr('font-family', 'sans-serif')
		.attr('fill', lab => lab.color)
		.attr('stroke', '#ffffff').attr('stroke-width', 3)
		.attr('paint-order', 'stroke')
		.text(lab => lab.text);

	// Axes + cadre (boîte complète, comme matplotlib)
	const tickText = (sel: d3.Selection<SVGGElement, unknown, null, undefined>) =>
		sel.selectAll('text').attr('font-size', 13).attr('font-family', 'sans-serif').attr('fill', '#000');
	const gxAxis = root.append('g').attr('transform', `translate(0,${plotH})`);
	const gyAxis = root.append('g');
	root.append('rect')
		.attr('width', plotW).attr('height', plotH)
		.attr('fill', 'none').attr('stroke', '#000').attr('stroke-width', 1);

	const title = root.append('text')
		.attr('x', plotW / 2).attr('y', -10)
		.attr('text-anchor', 'middle')
		.attr('font-size', 16).attr('font-family', 'sans-serif').attr('fill', '#000');

	const gProposal = root.append('g').attr('clip-path', `url(#${clipId})`);
	const gSamples = root.append('g').attr('clip-path', `url(#${clipId})`);

	// Contenu dynamique de la frame courante, redessiné par position()
	let dists: { mu: number[]; sigma: number[][]; color: string }[] = [];
	let dots: { x: number[]; color: string }[] = [];

	// (Re)dessine tout ce qui dépend de la fenêtre courante — appelée à chaque
	// changement de frame et à chaque pas de l'animation de zoom.
	function position(): void {
		const [dx0, dx1] = xs.domain(), [dy0, dy1] = ys.domain();
		const isFull = Math.abs(dx0 - x0) < 1e-9 && Math.abs(dx1 - x1) < 1e-9
			&& Math.abs(dy0 - y0) < 1e-9 && Math.abs(dy1 - y1) < 1e-9;

		// Axes : graduations de la config au domaine complet, automatiques sinon
		// (les valeurs fixes de la config deviendraient trop rares en zoomant)
		gxAxis.call(isFull
			? d3.axisBottom(xs).tickValues(config.axes.xTicks).tickFormat(d3.format('d')).tickSizeOuter(0)
			: d3.axisBottom(xs).ticks(5).tickSizeOuter(0))
			.call(tickText);
		gyAxis.call(isFull
			? d3.axisLeft(ys).tickValues(config.axes.yTicks).tickFormat(d3.format('.1f')).tickSizeOuter(0)
			: d3.axisLeft(ys).ticks(5).tickSizeOuter(0))
			.call(tickText);

		// Fond : transformation affine « pixels du domaine complet -> fenêtre »
		const kx = (x1 - x0) / (dx1 - dx0), tx = xs(x0);
		const ky = (y1 - y0) / (dy1 - dy0), ty = ys(y1);
		gStatic.attr('transform', `translate(${tx},${ty}) scale(${kx},${ky})`);
		labelTexts
			.attr('transform', lab =>
				`translate(${kx * lab.x + tx},${ky * lab.y + ty}) rotate(${lab.angle})`)
			.attr('display', lab => {
				const px = kx * lab.x + tx, py = ky * lab.y + ty;
				return (px < 14 || px > plotW - 14 || py < 12 || py > plotH - 12) ? 'none' : null;
			});

		// Ellipses et échantillons, dans les échelles courantes
		const ellipses = dists.flatMap(d =>
			gaussianLevelEllipses(d.mu, d.sigma, xs, ys).map(e => ({ ...e, color: d.color })));
		gProposal.selectAll<SVGEllipseElement, EllipseSpec & { color: string }>('ellipse')
			.data(ellipses)
			.join('ellipse')
			.attr('cx', e => e.cx).attr('cy', e => e.cy)
			.attr('rx', e => e.rx).attr('ry', e => e.ry)
			.attr('transform', e => `rotate(${e.rotate},${e.cx},${e.cy})`)
			.attr('fill', 'none')
			.attr('stroke', e => e.color)
			.attr('stroke-width', config.proposal.strokeWidth)
			.attr('stroke-dasharray', config.proposal.dash);
		gSamples.selectAll<SVGCircleElement, { x: number[]; color: string }>('circle')
			.data(dots)
			.join('circle')
			.attr('cx', d => xs(d.x[0])).attr('cy', d => ys(d.x[1]))
			.attr('r', config.samples.radius)
			.attr('fill', d => d.color)
			.attr('stroke', d => d.color)
			.attr('stroke-width', config.samples.strokeWidth);
	}

	// Applique une fenêtre, en animant le passage si demandé. `target` évite de
	// relancer la transition quand un événement Reveal re-rend la même frame.
	let target = fullView;
	function setView(view: View, animate: boolean): void {
		const same = view.x[0] === target.x[0] && view.x[1] === target.x[1]
			&& view.y[0] === target.y[0] && view.y[1] === target.y[1];
		target = view;
		if (same) {
			position();
			return;
		}
		if (!animate) {
			svg.interrupt('cem-zoom');
			xs.domain(view.x);
			ys.domain(view.y);
			position();
			return;
		}
		const ix = d3.interpolate(xs.domain(), view.x);
		const iy = d3.interpolate(ys.domain(), view.y);
		svg.transition('cem-zoom')
			.duration(config.zoom.transitionDuration)
			.tween('view', () => t => {
				xs.domain(ix(t));
				ys.domain(iy(t));
				position();
			});
	}

	let visible = false;
	return (frame: Frame | null): void => {
		if (frame === null || frame.k > run.length) {
			svg.style('visibility', 'hidden');
			visible = false;
			return;
		}
		svg.style('visibility', 'visible');
		title.text(frame.phase === 'objective' ? '' : config.title.replace('{k}', String(frame.k)));
		const iter = run[frame.k - 1];

		dists = [];
		if (frame.phase === 'proposal' || frame.phase === 'samples') {
			dists.push({ ...iter.proposal, color: config.proposal.currentColor });
		} else if (frame.phase === 'fit') {
			dists.push({ ...iter.fitted, color: config.proposal.fittedColor });
		}

		dots = [];
		if (frame.phase !== 'objective' && frame.phase !== 'proposal') {
			const showElite = frame.phase === 'elite' || frame.phase === 'fit';
			dots = iter.samples.map(s => ({
				x: s.x,
				color: showElite && s.elite ? config.samples.eliteColor : config.samples.color
			}));
		}

		// Zoom animé seulement si la figure était déjà affichée (arrivée directe
		// sur une frame — chargement, saut de slide — : mise en place immédiate)
		setView(zoomEnabled ? viewForIteration(frame.k) : fullView, visible);
		visible = true;
	};
}

// ---------------------------------------------------------------------------
// Enregistrement des figures de la page et synchronisation avec les fragments.
// ---------------------------------------------------------------------------
function parseFrame(token: string): Frame {
	const [k, phase] = token.split(':');
	return { k: parseInt(k, 10), phase: phase as Phase };
}

interface DynamicFig {
	render: (frame: Frame | null) => void;
	section: HTMLElement;
	frames: Frame[];
	initial: Frame | null;
}
const dynamicFigs: DynamicFig[] = [];

document.querySelectorAll<SVGSVGElement>('svg.cem-rosenbrock-fig').forEach(el => {
	if (el.dataset.frames) {
		const render = setupFigure(el, true);
		const frames = el.dataset.frames.trim().split(/\s+/).map(parseFrame);
		const initial = el.dataset.initialFrame ? parseFrame(el.dataset.initialFrame) : null;
		dynamicFigs.push({ render, section: el.closest('section')!, frames, initial });
		render(initial);
	} else {
		setupFigure(el, false)({
			k: parseInt(el.dataset.iteration ?? '1', 10),
			phase: (el.dataset.phase ?? 'fit') as Phase
		});
	}
});

// Frame courante = plus grand data-fragment-index visible dans la <section>
// (les slides utilisent des index explicites, partagés entre texte et figure).
function update(): void {
	for (const fig of dynamicFigs) {
		let idx = -1;
		fig.section.querySelectorAll('.fragment.visible').forEach(fr => {
			const i = parseInt(fr.getAttribute('data-fragment-index') ?? '', 10);
			if (!Number.isNaN(i) && i > idx) idx = i;
		});
		const frame = idx < 0 ? fig.initial : fig.frames[Math.min(idx, fig.frames.length - 1)];
		fig.render(frame ?? null);
	}
}

if (dynamicFigs.length > 0) {
	const Reveal = (window as unknown as { Reveal?: { on?: (ev: string, cb: () => void) => void } }).Reveal;
	if (Reveal?.on) {
		for (const ev of ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden']) {
			Reveal.on(ev, update);
		}
	}
	update();
}
