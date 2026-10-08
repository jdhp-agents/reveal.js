// Palette et primitives de dessin partagées par les figures d3.js du deck
// rl_ppo.html : le couloir (cases, politique, valeurs, agent), flèches,
// formatage des nombres.
import * as d3 from 'd3';
import { Corridor, probs, LEFT, RIGHT } from './corridor';
import type { Logits, Values } from './corridor';
import { INGREDIENT_COLORS } from './frames';

export type G = d3.Selection<SVGGElement, unknown, null, undefined>;

/** Palette du deck (bleu / rouge = paire validée CVD des decks CEM et MCTS). */
export const COLORS = {
	ink: '#222222',
	muted: '#888888',
	faint: '#cccccc',
	grid: '#eeeeee',
	/** Avantage positif / négatif. */
	pos: '#4aa3df',
	neg: '#ee6a6a',
	/** Même rouge que les fragments highlight-current-red du pseudo-code. */
	code: '#ff2c2d',
	/** Récompenses (cases terminales du couloir, paysage R(a) du bandit). */
	gold: '#f2c14e',
	goldLight: '#fdf1cf',
	cell: '#eef6fc',
	cellStroke: '#a7cbe6',
	/** Ancienne politique π(·|·, θ_old). */
	old: '#9a9a9a',
	...INGREDIENT_COLORS,
};

/** Couleur d'un avantage selon son signe. */
export const advColor = (x: number) => (x >= 0 ? COLORS.pos : COLORS.neg);

/** Format compact signé : +0.12 / −0.05 (vrai signe moins). */
export function fmtSigned(x: number, digits = 2): string {
	const s = Math.abs(x).toFixed(digits);
	return (x < 0 && Number(s) !== 0 ? '−' : '+') + s;
}
export function fmt(x: number, digits = 2): string {
	const s = Math.abs(x).toFixed(digits);
	return (x < 0 && Number(s) !== 0 ? '−' : '') + s;
}

/** Identifiant unique par <svg> (les id de marqueurs doivent être uniques dans le document). */
const svgUids = new WeakMap<SVGSVGElement, number>();
let nextUid = 0;

/**
 * Définit (une fois par svg) un marqueur de flèche de la couleur donnée (taille
 * en px) et renvoie la référence url(#…) à utiliser dans marker-end. L'id est
 * propre à chaque svg : reveal.js masque (display: none) les slides non
 * affichées, et un marker-end qui pointe vers un marqueur d'une slide masquée
 * n'est pas dessiné.
 */
export function arrowMarker(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, id: string, color: string, size = 7): string {
	const node = svg.node()!;
	if (!svgUids.has(node)) svgUids.set(node, nextUid++);
	const uid = `${id}-${svgUids.get(node)}`;
	let defs = svg.select<SVGDefsElement>('defs');
	if (defs.empty()) defs = svg.append('defs');
	if (defs.select(`#${uid}`).empty()) {
		defs.append('marker').attr('id', uid).attr('viewBox', '0 0 10 10').attr('refX', 8).attr('refY', 5)
			.attr('markerUnits', 'userSpaceOnUse')
			.attr('markerWidth', size).attr('markerHeight', size).attr('orient', 'auto-start-reverse')
			.append('path').attr('d', 'M0,0 L10,5 L0,10 z').attr('fill', color);
	}
	return `url(#${uid})`;
}

// ---------------------------------------------------------------------------
// Le couloir
// ---------------------------------------------------------------------------

export interface CorridorState {
	theta?: Logits;
	w?: Values;
	/** Case de l'agent. */
	agent?: number;
	/** Transition à dessiner (flèche courbe S → S′, avec R). */
	move?: { s: number; s2: number; r: number };
	/** Cases à surligner (contour épais). */
	highlight?: number[];
	/** Couleur du surlignage. */
	highlightColor?: string;
}

export interface CorridorOptions {
	cell: number;
	/** Afficher v̂ sous chaque case. */
	values?: boolean;
	/** Libellé de la ligne des valeurs. */
	valueLabel?: string;
	/** Afficher les probabilités en clair à côté des flèches. */
	probLabels?: boolean;
}

/**
 * Dessine le couloir dans `g` (coin haut-gauche en (0, 0)) : cases, numéros,
 * récompenses terminales, flèches de politique (longueur ∝ π(a|s)), valeurs
 * v̂(s) dessous, agent, transition courante. Redessine tout à chaque appel.
 */
export function drawCorridor(g: G, env: Corridor, st: CorridorState, opts: CorridorOptions): void {
	g.selectAll('*').remove();
	const c = opts.cell;
	const svg = d3.select(g.node()!.ownerSVGElement!) as d3.Selection<SVGSVGElement, unknown, null, undefined>;
	const head = arrowMarker(svg, 'ppo-corr-arrow', COLORS.ink, c * 0.16);
	const moveHead = arrowMarker(svg, 'ppo-corr-move', COLORS.code, 12);
	for (let s = 0; s < env.nS; s++) {
		const x = s * c;
		const term = env.isTerminal(s);
		const r = s === 0 ? env.cfg.rewardLeft : env.cfg.rewardRight;
		g.append('rect').attr('x', x).attr('y', 0).attr('width', c).attr('height', c)
			.attr('fill', term ? (r >= env.cfg.rewardRight ? COLORS.gold : COLORS.goldLight) : COLORS.cell)
			.attr('stroke', COLORS.cellStroke).attr('stroke-width', 1.2);
		g.append('text').attr('x', x + 4).attr('y', 4).attr('dy', '0.8em')
			.attr('font-size', c * 0.17).attr('fill', '#89a').text(s);
		if (term) {
			g.append('text').attr('x', x + c / 2).attr('y', c / 2).attr('dy', '0.35em')
				.attr('text-anchor', 'middle').attr('font-size', c * 0.3).attr('font-weight', 'bold')
				.attr('fill', '#7a5a00').text(`+${r}`);
			continue;
		}
		if (st.theta) {
			const p = probs(st.theta, s);
			const cy = c * 0.62, maxLen = c * 0.44;
			for (const a of [LEFT, RIGHT]) {
				const dir = a === RIGHT ? 1 : -1;
				const len = c * 0.06 + (maxLen - c * 0.06) * p[a];
				g.append('line').attr('x1', x + c / 2).attr('y1', cy).attr('x2', x + c / 2 + dir * len).attr('y2', cy)
					.attr('stroke', COLORS.ink).attr('stroke-width', 1.5 + 2.5 * p[a]).attr('opacity', 0.3 + 0.7 * p[a])
					.attr('marker-end', head);
				if (opts.probLabels) {
					g.append('text').attr('x', x + c / 2 + dir * c * 0.25).attr('y', cy - c * 0.12)
						.attr('text-anchor', 'middle').attr('font-size', c * 0.16).attr('fill', COLORS.muted)
						.text(p[a].toFixed(2));
				}
			}
			g.append('circle').attr('cx', x + c / 2).attr('cy', cy).attr('r', 2).attr('fill', COLORS.ink);
		}
		if (opts.values && st.w) {
			g.append('text').attr('x', x + c / 2).attr('y', c + c * 0.28).attr('text-anchor', 'middle')
				.attr('font-size', c * 0.2).attr('fill', COLORS.ink).text(fmt(st.w[s]));
		}
	}
	if (opts.values && st.w && opts.valueLabel) {
		g.append('text').attr('x', -8).attr('y', c + c * 0.28).attr('text-anchor', 'end')
			.attr('font-size', c * 0.2).attr('fill', COLORS.muted).text(opts.valueLabel);
	}
	for (const s of st.highlight ?? []) {
		g.append('rect').attr('x', s * c + 1.5).attr('y', 1.5).attr('width', c - 3).attr('height', c - 3)
			.attr('fill', 'none').attr('stroke', st.highlightColor ?? COLORS.code).attr('stroke-width', 3);
	}
	if (st.move) {
		const { s, s2 } = st.move;
		const x1 = (s + 0.5) * c, x2 = (s2 + 0.5) * c;
		g.append('path')
			.attr('d', `M${x1},${-4} C${x1},${-c * 0.55} ${x2},${-c * 0.55} ${x2},${-6}`)
			.attr('fill', 'none').attr('stroke', COLORS.code).attr('stroke-width', 2).attr('marker-end', moveHead);
		g.append('text').attr('x', (x1 + x2) / 2).attr('y', -c * 0.5).attr('text-anchor', 'middle')
			.attr('font-size', c * 0.2).attr('fill', COLORS.code).text(`R = ${st.move.r}`);
	}
	if (st.agent !== undefined) {
		g.append('circle').attr('cx', (st.agent + 0.5) * c).attr('cy', c * 0.3).attr('r', c * 0.11)
			.attr('fill', COLORS.ink).attr('stroke', '#fff').attr('stroke-width', 1.5);
	}
}

/**
 * Remplit un <text> SVG avec une chaîne où `_{…}` et `^{…}` marquent des
 * indices et exposants (ex. 'θ_{old}', 'π(a|s, θ_{old})').
 */
export function richText<E extends SVGTextElement>(sel: d3.Selection<E, unknown, null, undefined>, s: string): d3.Selection<E, unknown, null, undefined> {
	sel.text(null);
	const re = /([_^])\{([^}]*)\}/g;
	let last = 0, m: RegExpExecArray | null;
	while ((m = re.exec(s))) {
		if (m.index > last) sel.append('tspan').text(s.slice(last, m.index));
		sel.append('tspan').attr('baseline-shift', m[1] === '_' ? 'sub' : 'super').attr('font-size', '72%').text(m[2]);
		last = m.index + m[0].length;
	}
	if (last < s.length) sel.append('tspan').text(s.slice(last));
	return sel;
}

/** Style commun des axes d3 : police du deck (pas « sans-serif » imposée par d3), taille 12. */
export function styleAxis<E extends SVGGElement>(ax: d3.Selection<E, unknown, null, undefined>, size = 12): void {
	ax.attr('font-family', null).attr('font-size', null);
	ax.selectAll('text').attr('font-size', size).attr('fill', COLORS.ink);
	ax.selectAll('line, path').attr('stroke', '#666');
}
