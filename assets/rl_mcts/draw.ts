// Primitives de dessin partagées par les figures d3.js du deck rl_mcts.html :
// palette, carte FrozenLake (grande et en vignette), plateau de tic-tac-toe,
// panneau « scores UCB1 » (barres moyenne + bonus d'exploration), flèches.
import * as d3 from 'd3';
import type { FrozenLake } from './frozenlake';
import * as ttt from './tictactoe';

export type G = d3.Selection<SVGGElement, unknown, null, undefined>;

/** Palette du deck (bleu / rouge = paire validée CVD des decks CEM). */
export const COLORS = {
	ink: '#222222',
	muted: '#888888',
	faint: '#cccccc',
	edge: '#a9a9a9',
	blue: '#4aa3df',
	blueLight: '#cfe7f7',
	red: '#ee6a6a',
	/** Surlignage « ici et maintenant » (nœud courant, chemin, nouveauté). */
	highlight: '#f5b700',
	/** Même rouge que les fragments highlight-current-red du pseudo-code. */
	code: '#ff2c2d',
	ice: '#eef6fc',
	iceStroke: '#a7cbe6',
	hole: '#2f4058',
	goal: '#5aae61',
	/** Joueurs du tic-tac-toe. */
	X: '#4aa3df',
	O: '#ee6a6a',
};

// ---------------------------------------------------------------------------
// FrozenLake
// ---------------------------------------------------------------------------

/** Centre de la case s dans une carte dont les cases font `cell` de côté. */
export function cellCenter(env: FrozenLake, s: number, cell: number): [number, number] {
	return [(s % env.ncol + 0.5) * cell, (Math.floor(s / env.ncol) + 0.5) * cell];
}

function cellFill(c: string): string {
	return c === 'H' ? COLORS.hole : c === 'G' ? COLORS.goal : COLORS.ice;
}

/** Carte complète, coin haut-gauche en (0, 0), lettres S/H/G. */
export function drawLake(g: G, env: FrozenLake, cell: number, opts: { letters?: boolean; numbers?: boolean } = {}): void {
	for (let s = 0; s < env.nS; s++) {
		const x = (s % env.ncol) * cell, y = Math.floor(s / env.ncol) * cell;
		const c = env.cell(s);
		g.append('rect').attr('x', x).attr('y', y).attr('width', cell).attr('height', cell)
			.attr('fill', cellFill(c)).attr('stroke', COLORS.iceStroke).attr('stroke-width', 1);
		if (opts.letters !== false && c !== 'F') {
			g.append('text').attr('x', x + cell / 2).attr('y', y + cell / 2).attr('dy', '0.35em')
				.attr('text-anchor', 'middle').attr('font-size', cell * 0.42).attr('font-weight', 'bold')
				.attr('fill', c === 'S' ? '#9ab' : '#fff').attr('opacity', c === 'S' ? 1 : 0.9).text(c);
		}
		if (opts.numbers) {
			g.append('text').attr('x', x + 3).attr('y', y + 3).attr('dy', '0.8em')
				.attr('font-size', cell * 0.2).attr('fill', c === 'F' || c === 'S' ? '#89a' : '#ddd').text(s);
		}
	}
}

/**
 * Vignette d'un état (nœud état de l'arbre) : la carte en miniature, centrée
 * en (0, 0), avec l'agent (point rouge) sur la case s.
 */
export function drawLakeThumb(g: G, env: FrozenLake, s: number, size: number): void {
	const cell = size / env.ncol;
	const inner = g.append('g').attr('transform', `translate(${-size / 2},${-size / 2})`);
	inner.append('rect').attr('x', -1.5).attr('y', -1.5).attr('width', size + 3).attr('height', size + 3)
		.attr('rx', 2).attr('fill', '#fff').attr('stroke', COLORS.ink).attr('stroke-width', 1.2);
	for (let i = 0; i < env.nS; i++) {
		const c = env.cell(i);
		inner.append('rect').attr('x', (i % env.ncol) * cell).attr('y', Math.floor(i / env.ncol) * cell)
			.attr('width', cell).attr('height', cell).attr('fill', cellFill(c))
			.attr('stroke', '#fff').attr('stroke-width', 0.4);
	}
	const [cx, cy] = cellCenter(env, s, cell);
	inner.append('circle').attr('cx', cx).attr('cy', cy).attr('r', cell * 0.36)
		.attr('fill', COLORS.red).attr('stroke', '#fff').attr('stroke-width', 0.6);
}

// ---------------------------------------------------------------------------
// Tic-tac-toe
// ---------------------------------------------------------------------------

/**
 * Plateau centré en (0, 0). `last` = case du dernier coup (fond surligné),
 * la ligne gagnante éventuelle est barrée.
 */
export function drawBoard(g: G, board: string, size: number, opts: { last?: number | null; frame?: boolean } = {}): void {
	const cell = size / 3;
	const inner = g.append('g').attr('transform', `translate(${-size / 2},${-size / 2})`);
	if (opts.frame !== false) {
		inner.append('rect').attr('x', -2).attr('y', -2).attr('width', size + 4).attr('height', size + 4)
			.attr('rx', 2.5).attr('fill', '#fff').attr('stroke', COLORS.ink).attr('stroke-width', 1.1);
	}
	if (opts.last !== undefined && opts.last !== null) {
		inner.append('rect').attr('x', (opts.last % 3) * cell).attr('y', Math.floor(opts.last / 3) * cell)
			.attr('width', cell).attr('height', cell).attr('fill', '#fff1c4');
	}
	for (let i = 1; i < 3; i++) {
		inner.append('line').attr('x1', i * cell).attr('x2', i * cell).attr('y1', 1).attr('y2', size - 1)
			.attr('stroke', '#999').attr('stroke-width', Math.max(0.6, size / 60));
		inner.append('line').attr('y1', i * cell).attr('y2', i * cell).attr('x1', 1).attr('x2', size - 1)
			.attr('stroke', '#999').attr('stroke-width', Math.max(0.6, size / 60));
	}
	const sw = Math.max(1, size / 22);
	for (let i = 0; i < 9; i++) {
		const cx = (i % 3 + 0.5) * cell, cy = (Math.floor(i / 3) + 0.5) * cell, h = cell * 0.28;
		if (board[i] === 'X') {
			inner.append('path').attr('d', `M${cx - h},${cy - h}L${cx + h},${cy + h}M${cx + h},${cy - h}L${cx - h},${cy + h}`)
				.attr('stroke', COLORS.X).attr('stroke-width', sw).attr('stroke-linecap', 'round');
		} else if (board[i] === 'O') {
			inner.append('circle').attr('cx', cx).attr('cy', cy).attr('r', h)
				.attr('fill', 'none').attr('stroke', COLORS.O).attr('stroke-width', sw);
		}
	}
	const line = ttt.winningLine(board);
	if (line) {
		const p = (i: number) => [(i % 3 + 0.5) * cell, (Math.floor(i / 3) + 0.5) * cell];
		const [a, b] = [p(line[0]), p(line[2])];
		const dx = (b[0] - a[0]) * 0.18, dy = (b[1] - a[1]) * 0.18;
		inner.append('line').attr('x1', a[0] - dx).attr('y1', a[1] - dy).attr('x2', b[0] + dx).attr('y2', b[1] + dy)
			.attr('stroke', COLORS.ink).attr('stroke-width', sw * 0.9).attr('stroke-linecap', 'round').attr('opacity', 0.8);
	}
}

// ---------------------------------------------------------------------------
// Panneau UCB1
// ---------------------------------------------------------------------------

export interface UcbBar {
	label: string;
	labelColor?: string;
	/** Pictogramme dessiné à la place de l'étiquette texte (centré en (0, 0)). */
	icon?: (g: G) => void;
	/** Vraie valeur (inconnue de l'algorithme), tracée en pointillés rouges. */
	truth?: number;
	mean: number;
	bonus: number;
	N: number;
	chosen: boolean;
}

/**
 * Barres empilées moyenne (bleu plein) + bonus d'exploration (bleu clair),
 * score total au-dessus, effectif N sous l'étiquette. Le panneau occupe
 * [0, w] × [0, h] ; `yMax` fixe l'échelle (sinon max des scores).
 */
export function drawUcbPanel(g: G, w: number, h: number, bars: UcbBar[], opts: { yMax?: number; title?: string; fontSize?: number; labelSize?: number } = {}): void {
	const fs = opts.fontSize ?? 11;
	const ls = opts.labelSize ?? fs;
	const top = opts.title ? fs * 2.6 : fs * 1.4, bottom = (opts.labelSize ?? fs) * 1.05 + fs * 1.4;
	const plotH = h - top - bottom;
	const yMax = opts.yMax ?? Math.max(1e-9, ...bars.map(b => b.mean + b.bonus)) * 1.05;
	const y = d3.scaleLinear().domain([0, yMax]).range([plotH, 0]);
	const x = d3.scaleBand<number>().domain(bars.map((_, i) => i)).range([0, w]).paddingInner(0.3).paddingOuter(0.15);
	if (opts.title) {
		g.append('text').attr('x', w / 2).attr('y', fs * 0.9).attr('text-anchor', 'middle')
			.attr('font-size', fs).attr('fill', COLORS.ink).text(opts.title);
	}
	const plot = g.append('g').attr('transform', `translate(0,${top})`);
	plot.append('line').attr('x1', 0).attr('x2', w).attr('y1', plotH).attr('y2', plotH).attr('stroke', COLORS.muted);
	bars.forEach((b, i) => {
		const x0 = x(i)!, bw = x.bandwidth();
		const meanH = plotH - y(Math.max(0, b.mean));
		const bonusTop = y(b.mean + b.bonus);
		if (b.chosen) {
			plot.append('rect').attr('x', x0 - 3).attr('y', bonusTop - 3).attr('width', bw + 6)
				.attr('height', plotH - bonusTop + 3).attr('fill', 'none').attr('stroke', COLORS.highlight)
				.attr('stroke-width', 3).attr('rx', 2);
		}
		plot.append('rect').attr('x', x0).attr('y', bonusTop).attr('width', bw).attr('height', Math.max(0, y(b.mean) - bonusTop))
			.attr('fill', COLORS.blueLight).attr('stroke', COLORS.blue).attr('stroke-width', 0.8);
		plot.append('rect').attr('x', x0).attr('y', plotH - meanH).attr('width', bw).attr('height', meanH)
			.attr('fill', COLORS.blue);
		if (b.truth !== undefined) {
			plot.append('line').attr('x1', x0 - 4).attr('x2', x0 + bw + 4).attr('y1', y(b.truth)).attr('y2', y(b.truth))
				.attr('stroke', COLORS.red).attr('stroke-width', 2).attr('stroke-dasharray', '4 2');
		}
		plot.append('text').attr('x', x0 + bw / 2).attr('y', bonusTop - 4).attr('text-anchor', 'middle')
			.attr('font-size', fs * 0.85).attr('font-weight', b.chosen ? 'bold' : 'normal')
			.attr('fill', COLORS.ink).text((b.mean + b.bonus).toFixed(2));
		if (b.icon) {
			b.icon(plot.append('g').attr('transform', `translate(${x0 + bw / 2},${plotH + ls * 0.6})`) as unknown as G);
		} else {
			plot.append('text').attr('x', x0 + bw / 2).attr('y', plotH + ls * 0.95).attr('text-anchor', 'middle')
				.attr('font-size', ls).attr('font-weight', 'bold').attr('fill', b.labelColor ?? COLORS.ink).text(b.label);
		}
		plot.append('text').attr('x', x0 + bw / 2).attr('y', plotH + ls * 0.95 + fs * 1.05).attr('text-anchor', 'middle')
			.attr('font-size', fs * 0.8).attr('fill', COLORS.muted).text(`N=${b.N}`);
	});
}

// ---------------------------------------------------------------------------
// Divers
// ---------------------------------------------------------------------------

/** Définit (une fois par SVG) un marqueur de pointe de flèche de couleur donnée. */
export function arrowMarker(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, id: string, color: string, size = 6): string {
	let defs = svg.select<SVGDefsElement>('defs');
	if (defs.empty()) defs = svg.insert('defs', ':first-child');
	if (defs.select(`#${id}`).empty()) {
		defs.append('marker').attr('id', id).attr('viewBox', '0 0 10 10').attr('refX', 8).attr('refY', 5)
			.attr('markerWidth', size).attr('markerHeight', size).attr('orient', 'auto-start-reverse')
			.append('path').attr('d', 'M0,0L10,5L0,10z').attr('fill', color);
	}
	return `url(#${id})`;
}

/** Fraction lisible pour une probabilité de transition FrozenLake. */
export function fraction(p: number): string {
	const t = Math.round(p * 3);
	if (Math.abs(p - t / 3) < 1e-9) return t === 3 ? '1' : `${t}/3`;
	return p.toFixed(2);
}

/** Identifiant unique par figure (marqueurs, clipPaths). */
let uid = 0;
export function uniqueId(prefix: string): string {
	return `${prefix}-${++uid}`;
}
