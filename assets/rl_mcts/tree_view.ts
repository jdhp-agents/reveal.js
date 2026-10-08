// Vue d'arbre générique, partagée par les figures « MCTS pas à pas » du deck
// rl_mcts.html (FrozenLake et tic-tac-toe).
//
// À chaque appel de render(), l'arbre visible (racine + fonction children) est
// redisposé avec d3.tree (Reingold-Tilford, profondeur = couche), mis à
// l'échelle pour tenir dans le rectangle alloué, puis réconcilié avec le DOM
// par des jointures d3 indexées par l'identifiant des nœuds : les nouveaux
// nœuds poussent depuis leur parent, ceux qui disparaissent (navigation
// arrière) s'estompent, tout le reste glisse vers sa nouvelle place. Les
// surcouches propres à chaque figure (dé, rollout, valeurs rétropropagées) se
// dessinent dans `overlay`, qui partage le repère (et le zoom) de l'arbre.
import * as d3 from 'd3';
import { COLORS } from './draw';
import type { G } from './draw';

export interface Highlight {
	/** Nœuds du chemin courant (racine → nœud courant). */
	path: Set<number>;
	/** Nœud « ici et maintenant ». */
	current: number | null;
}

export interface TreeViewOptions<T> {
	id: (t: T) => number;
	/** Rectangle alloué dans le viewBox du SVG. */
	box: { x: number; y: number; w: number; h: number };
	layerHeight: number;
	/** Écart horizontal minimal entre deux nœuds voisins d'une même couche. */
	separation: (a: T, b: T, siblings: boolean) => number;
	/** Marges autour des nœuds extrêmes (étiquettes, rollout sous les feuilles). */
	pad: { left: number; right: number; bottom: number };
	/** Dessin du nœud, une seule fois, à sa création (centré en (0, 0)). */
	drawNode: (g: G, t: T) => void;
	/** Mise à jour à chaque frame (étiquettes N, Q…). */
	updateNode?: (g: G, t: T) => void;
	/** Forme du halo de surlignage. */
	halo: (t: T) => { w: number; h: number; round: boolean };
	/** Étiquette de l'arête parent → t (ex. probabilité de transition). */
	linkLabel?: (t: T) => string | null;
	/** Échelle maximale (1 = taille nominale). */
	maxScale?: number;
}

type HNode<T> = d3.HierarchyPointNode<T>;

export class TreeView<T> {
	readonly root: G;
	readonly overlay: G;
	private readonly links: G;
	private readonly nodes: G;
	private prevPos = new Map<number, [number, number]>();
	/** Positions (repère de l'arbre) de la dernière disposition. */
	pos = new Map<number, [number, number]>();
	private transform = { tx: 0, ty: 0, k: 1 };

	constructor(parent: G, private readonly opts: TreeViewOptions<T>) {
		this.root = parent.append('g').attr('class', 'tree-zoom');
		this.links = this.root.append('g').attr('class', 'tree-links');
		this.nodes = this.root.append('g').attr('class', 'tree-nodes');
		this.overlay = this.root.append('g').attr('class', 'tree-overlay');
	}

	/** Dispose et dessine l'arbre ; retourne les positions des nœuds. */
	render(rootItem: T, children: (t: T) => T[], hl: Highlight, duration: number): Map<number, [number, number]> {
		const { id, box, layerHeight, separation, pad } = this.opts;
		const hier = d3.hierarchy(rootItem, children);
		const layout = d3.tree<T>().nodeSize([1, layerHeight])
			.separation((a, b) => separation(a.data, b.data, a.parent === b.parent));
		const laid = layout(hier);
		const all = laid.descendants();

		// Mise à l'échelle : tout l'arbre (+ marges) doit tenir dans `box`.
		const minX = d3.min(all, d => d.x)! - pad.left;
		const maxX = d3.max(all, d => d.x)! + pad.right;
		const maxY = d3.max(all, d => d.y)! + pad.bottom;
		const k = Math.min(this.opts.maxScale ?? 1, box.w / (maxX - minX), box.h / (maxY + 1e-9));
		// Centrage horizontal sur la racine tant que possible, sinon sur l'étendue.
		let tx = box.x + box.w / 2 - laid.x * k;
		if (tx + minX * k < box.x) tx = box.x - minX * k;
		if (tx + maxX * k > box.x + box.w) tx = box.x + box.w - maxX * k;
		const ty = box.y;
		this.transform = { tx, ty, k };
		this.root.transition().duration(duration)
			.attr('transform', `translate(${tx},${ty}) scale(${k})`);

		this.prevPos = this.pos;
		this.pos = new Map(all.map(d => [id(d.data), [d.x, d.y] as [number, number]]));
		const parentPos = (d: HNode<T>): [number, number] => {
			const p = d.parent ? this.prevPos.get(id(d.parent.data)) ?? this.pos.get(id(d.parent.data)) : undefined;
			return p ?? [d.x, d.y];
		};

		// --- Arêtes -----------------------------------------------------------
		const linkData = all.filter(d => d.parent);
		const linkSel = this.links.selectAll<SVGGElement, HNode<T>>('g.link')
			.data(linkData, d => String(id(d.data)));
		const linkEnter = linkSel.enter().append('g').attr('class', 'link').attr('opacity', 0);
		linkEnter.append('line').attr('class', 'halo').attr('stroke', COLORS.highlight)
			.attr('stroke-width', 7).attr('stroke-linecap', 'round').attr('opacity', 0);
		linkEnter.append('line').attr('class', 'base').attr('stroke', COLORS.edge).attr('stroke-width', 1.3);
		linkEnter.append('text').attr('class', 'link-label').attr('font-size', 9.5)
			.attr('fill', COLORS.muted).attr('text-anchor', 'end').attr('dy', '0.35em');
		linkEnter.each(function (d) {
			const [px, py] = parentPos(d);
			d3.select(this).selectAll('line').attr('x1', px).attr('y1', py).attr('x2', px).attr('y2', py);
		});
		const linkAll = linkEnter.merge(linkSel);
		linkAll.transition().duration(duration).attr('opacity', 1);
		linkAll.selectAll<SVGLineElement, unknown>('line').transition().duration(duration)
			.attr('x1', function () { return (d3.select(this.parentNode as SVGGElement).datum() as HNode<T>).parent!.x; })
			.attr('y1', function () { return (d3.select(this.parentNode as SVGGElement).datum() as HNode<T>).parent!.y; })
			.attr('x2', function () { return (d3.select(this.parentNode as SVGGElement).datum() as HNode<T>).x; })
			.attr('y2', function () { return (d3.select(this.parentNode as SVGGElement).datum() as HNode<T>).y; });
		linkAll.select('line.halo').transition().duration(duration)
			.attr('opacity', d => hl.path.has(id(d.data)) && hl.path.has(id(d.parent!.data)) ? 0.85 : 0);
		linkAll.select<SVGTextElement>('text.link-label')
			.text(d => this.opts.linkLabel?.(d.data) ?? '')
			.transition().duration(duration)
			.attr('x', d => d.parent!.x + (d.x - d.parent!.x) * 0.55 - 3)
			.attr('y', d => d.parent!.y + (d.y - d.parent!.y) * 0.55);
		linkSel.exit().transition().duration(duration * 0.6).attr('opacity', 0).remove();

		// --- Nœuds ------------------------------------------------------------
		const opts = this.opts;
		const nodeSel = this.nodes.selectAll<SVGGElement, HNode<T>>('g.node')
			.data(all, d => String(id(d.data)));
		const nodeEnter = nodeSel.enter().append('g').attr('class', 'node')
			.attr('transform', d => { const [px, py] = parentPos(d); return `translate(${px},${py}) scale(0.2)`; })
			.attr('opacity', 0);
		nodeEnter.each(function (d) {
			const g = d3.select(this) as unknown as G;
			const shape = opts.halo(d.data);
			g.append(shape.round ? 'circle' : 'rect').attr('class', 'halo')
				.attr('fill', COLORS.highlight).attr('opacity', 0)
				.call(sel => shape.round
					? sel.attr('r', shape.w / 2)
					: sel.attr('x', -shape.w / 2).attr('y', -shape.h / 2).attr('width', shape.w).attr('height', shape.h).attr('rx', 4));
			opts.drawNode(g.append('g').attr('class', 'glyph') as unknown as G, d.data);
		});
		const nodeAll = nodeEnter.merge(nodeSel);
		nodeAll.transition().duration(duration)
			.attr('transform', d => `translate(${d.x},${d.y}) scale(1)`).attr('opacity', 1);
		nodeAll.select('.halo').transition().duration(duration)
			.attr('opacity', d => id(d.data) === hl.current ? 0.95 : hl.path.has(id(d.data)) ? 0.55 : 0);
		if (opts.updateNode) nodeAll.each(function (d) { opts.updateNode!(d3.select(this) as unknown as G, d.data); });
		nodeSel.exit().transition().duration(duration * 0.6).attr('opacity', 0).remove();

		// Les nœuds du chemin passent au-dessus des autres.
		nodeAll.filter(d => hl.path.has(id(d.data))).raise();
		return this.pos;
	}

	/** Conversion repère de l'arbre → repère du SVG (après zoom). */
	toSvg([x, y]: [number, number]): [number, number] {
		const { tx, ty, k } = this.transform;
		return [tx + x * k, ty + y * k];
	}
}
