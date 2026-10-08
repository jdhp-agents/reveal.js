// FrozenLake (Gymnasium, FrozenLake-v1, is_slippery=True) — modèle exact de
// l'environnement, utilisé comme simulateur par le MCTS du deck rl_mcts.html.
//
// Dynamique reproduite à l'identique de gymnasium/envs/toy_text/frozen_lake.py :
//   - actions : 0 = LEFT, 1 = DOWN, 2 = RIGHT, 3 = UP ;
//   - glissement : l'agent part dans la direction voulue a ou dans l'une des
//     deux directions perpendiculaires (a − 1) mod 4 et (a + 1) mod 4, avec une
//     probabilité de 1/3 chacune ; un mouvement vers un bord laisse sur place ;
//   - récompense 1 en arrivant sur G, 0 sinon ; G et les trous H sont terminaux.
// Les états sont numérotés ligne par ligne : s = ligne × ncol + colonne.

export type Action = 0 | 1 | 2 | 3;
export const ACTIONS: Action[] = [0, 1, 2, 3];
export const ACTION_NAMES = ['LEFT', 'DOWN', 'RIGHT', 'UP'];
export const ACTION_ARROWS = ['←', '↓', '→', '↑'];

/** La carte 4×4 standard de Gymnasium. */
export const MAP_4X4 = ['SFFF', 'FHFH', 'FFFH', 'HFFG'];

/** Une issue possible de (s, a) : probabilité, état suivant, récompense. */
export interface Outcome {
	p: number;
	next: number;
	r: number;
	/** Direction effectivement suivie (après glissement). */
	dir: Action;
}

export class FrozenLake {
	readonly nrow: number;
	readonly ncol: number;
	readonly nS: number;

	constructor(readonly desc: string[] = MAP_4X4) {
		this.nrow = desc.length;
		this.ncol = desc[0].length;
		this.nS = this.nrow * this.ncol;
	}

	cell(s: number): string {
		return this.desc[Math.floor(s / this.ncol)][s % this.ncol];
	}

	isTerminal(s: number): boolean {
		const c = this.cell(s);
		return c === 'H' || c === 'G';
	}

	/** Case atteinte en suivant la direction d depuis s (sans glissement). */
	move(s: number, d: Action): number {
		let row = Math.floor(s / this.ncol), col = s % this.ncol;
		if (d === 0) col = Math.max(col - 1, 0);
		else if (d === 1) row = Math.min(row + 1, this.nrow - 1);
		else if (d === 2) col = Math.min(col + 1, this.ncol - 1);
		else row = Math.max(row - 1, 0);
		return row * this.ncol + col;
	}

	/**
	 * Les 3 issues équiprobables de (s, a), dans l'ordre de Gymnasium
	 * ((a − 1) mod 4, a, (a + 1) mod 4) — deux issues peuvent mener au même état.
	 */
	outcomes(s: number, a: Action): Outcome[] {
		if (this.isTerminal(s)) return [{ p: 1, next: s, r: 0, dir: a }];
		return [((a + 3) % 4) as Action, a, ((a + 1) % 4) as Action].map(dir => {
			const next = this.move(s, dir);
			return { p: 1 / 3, next, r: this.cell(next) === 'G' ? 1 : 0, dir };
		});
	}

	/** P(s' | s, a) agrégée par état suivant. */
	transition(s: number, a: Action): Map<number, number> {
		const m = new Map<number, number>();
		for (const o of this.outcomes(s, a)) m.set(o.next, (m.get(o.next) ?? 0) + o.p);
		return m;
	}

	/** Le simulateur (modèle génératif) : tire une issue de (s, a). */
	step(s: number, a: Action, uniform: () => number): Outcome {
		const outs = this.outcomes(s, a);
		return outs[Math.min(Math.floor(uniform() * outs.length), outs.length - 1)];
	}

	/**
	 * Itération sur les valeurs (le modèle est connu) : Q*(s, a) exact, pour
	 * comparer les estimations du MCTS à la vérité terrain.
	 */
	qStar(gamma: number, tol = 1e-12): number[][] {
		const V = new Array<number>(this.nS).fill(0);
		const Q = Array.from({ length: this.nS }, () => [0, 0, 0, 0]);
		for (let it = 0; it < 100000; it++) {
			let delta = 0;
			for (let s = 0; s < this.nS; s++) {
				if (this.isTerminal(s)) continue;
				for (const a of ACTIONS) {
					Q[s][a] = this.outcomes(s, a)
						.reduce((acc, o) => acc + o.p * (o.r + gamma * V[o.next]), 0);
				}
				const v = Math.max(...Q[s]);
				delta = Math.max(delta, Math.abs(v - V[s]));
				V[s] = v;
			}
			if (delta < tol) break;
		}
		return Q;
	}
}
