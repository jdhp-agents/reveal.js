// Monte Carlo Tree Search — implémentations TypeScript autonomes (sans
// dépendance) des deux variantes présentées dans le deck rl_mcts.html, écrites
// pour suivre ligne à ligne les pseudo-codes des slides :
//
//   - mctsStochastic : MDP stochastique (FrozenLake), arbre alternant nœuds
//     état (on choisit une action par UCB1) et nœuds action = nœuds de chance
//     (on *tire* l'état suivant avec le simulateur) ; retours actualisés ;
//   - mctsTwoPlayer : jeu déterministe à deux joueurs et à somme nulle
//     (tic-tac-toe), un nœud = une position, l'action et l'état suivant sont
//     confondus ; chaque nœud stocke les gains du joueur qui y a mené.
//
// En plus de l'arbre final, chaque exécution enregistre une *trace* : la suite
// des événements (une ligne du pseudo-code chacun) des itérations demandées,
// et, pour chaque nœud, sa date de création et l'historique de ses
// statistiques. Les figures reconstruisent ainsi l'état de l'arbre à n'importe
// quel instant (itération k, événement e) sans relancer l'algorithme.
//
// Tout l'aléa provient d'un PRNG seedé (mulberry32) : deux exécutions avec la
// même seed produisent exactement le même arbre, donc les mêmes figures.

import { FrozenLake, ACTIONS } from './frozenlake';
import type { Action } from './frozenlake';
import * as ttt from './tictactoe';
import type { Board, Player } from './tictactoe';

/** PRNG mulberry32 : rapide, déterministe, uniforme sur [0, 1). */
export function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function randomChoice<T>(items: T[], uniform: () => number): T {
	return items[Math.min(Math.floor(uniform() * items.length), items.length - 1)];
}

/** Score UCB1 d'un fils : moyenne + bonus d'exploration. */
export function ucb1(mean: number, nParent: number, nChild: number, c: number): number {
	return mean + c * Math.sqrt(Math.log(nParent) / nChild);
}

/** Argmax avec départage aléatoire des ex æquo. */
function argmax<T>(items: T[], score: (x: T) => number, uniform: () => number): T {
	let best: T[] = [], bestScore = -Infinity;
	for (const x of items) {
		const sc = score(x);
		if (sc > bestScore + 1e-12) { best = [x]; bestScore = sc; }
		else if (Math.abs(sc - bestScore) <= 1e-12) best.push(x);
	}
	return randomChoice(best, uniform);
}

/** Instant d'exécution : itération k (à partir de 1), événement e (à partir de 0). */
export interface Instant { k: number; e: number; }

/** a est-il antérieur ou égal à b ? */
export function notAfter(a: Instant, b: Instant): boolean {
	return a.k < b.k || (a.k === b.k && a.e <= b.e);
}

/**
 * Historique des statistiques d'un nœud : une entrée par mise à jour, datée
 * par l'itération qui l'a faite. Lecture « au début de l'itération k » ou
 * « à la fin de l'itération k » par recherche dans l'historique.
 */
export class StatHistory<S> {
	private ks: number[] = [];
	private values: S[] = [];
	constructor(private readonly initial: S) {}
	push(k: number, s: S): void { this.ks.push(k); this.values.push(s); }
	/** Statistiques après toutes les mises à jour des itérations <= k. */
	at(k: number): S {
		let lo = 0, hi = this.ks.length;
		while (lo < hi) { const mid = (lo + hi) >> 1; if (this.ks[mid] <= k) lo = mid + 1; else hi = mid; }
		return lo === 0 ? this.initial : this.values[lo - 1];
	}
}

// ===========================================================================
// 1. MDP stochastique : nœuds état / nœuds action (chance)
// ===========================================================================

export interface StateNode {
	kind: 'state';
	id: number;
	s: number;
	terminal: boolean;
	depth: number;
	parent: ActionNode | null;
	/** Récompense reçue sur la transition qui mène à ce nœud. */
	r: number;
	/** P(s | s_parent, a_parent) — probabilité de l'arête depuis le nœud action. */
	p: number;
	children: ActionNode[];
	born: Instant;
	N: number;
	hist: StatHistory<{ N: number }>;
}

export interface ActionNode {
	kind: 'action';
	id: number;
	a: Action;
	depth: number;
	parent: StateNode;
	children: StateNode[];
	born: Instant;
	N: number;
	Q: number;
	hist: StatHistory<{ N: number; Q: number }>;
}

export type StochNode = StateNode | ActionNode;

/** Un candidat de la sélection UCB1, tel qu'affiché sur la figure. */
export interface UcbScore {
	id: number;
	mean: number;
	N: number;
	bonus: number;
	score: number;
}

/**
 * Les événements d'une itération, un par ligne exécutée du pseudo-code
 * (d = profondeur de descente, 0 à la racine).
 */
export type StochEvent =
	| { type: 'init' }
	| { type: 'ucb'; d: number; node: number; scores: UcbScore[]; chosen: number }
	| { type: 'try'; d: number; node: number; action: number }
	| { type: 'sim'; d: number; action: number; next: number; r: number; dir: Action; isNew: boolean }
	| { type: 'new'; d: number; state: number }
	| { type: 'move'; d: number; state: number }
	| { type: 'rollout'; from: number; states: number[]; dirs: Action[]; rewards: number[]; G: number }
	| { type: 'backprop'; steps: { state: number; action: number; r: number; G: number }[] };

export interface StochOptions {
	root: number;
	gamma: number;
	/** Constante d'exploration de UCB1. */
	c: number;
	iterations: number;
	seed: number;
	/** Nombre maximal de pas d'un rollout. */
	rolloutHorizon: number;
	/** Itérations dont on enregistre les événements (les autres ne sont pas tracées). */
	traced?: (k: number) => boolean;
}

export interface StochRun {
	env: FrozenLake;
	options: StochOptions;
	root: StateNode;
	nodes: StochNode[];
	/** events.get(k) = événements de l'itération k (si tracée). */
	events: Map<number, StochEvent[]>;
}

export function mctsStochastic(env: FrozenLake, options: StochOptions): StochRun {
	const uniform = mulberry32(options.seed);
	const { gamma, c } = options;
	const nodes: StochNode[] = [];
	const events = new Map<number, StochEvent[]>();

	const newState = (s: number, parent: ActionNode | null, r: number, p: number, born: Instant): StateNode => {
		const node: StateNode = {
			kind: 'state', id: nodes.length, s, terminal: env.isTerminal(s),
			depth: parent ? parent.depth + 1 : 0, parent, r, p, children: [], born,
			N: 0, hist: new StatHistory({ N: 0 }),
		};
		nodes.push(node);
		parent?.children.push(node);
		return node;
	};
	const newAction = (a: Action, parent: StateNode, born: Instant): ActionNode => {
		const node: ActionNode = {
			kind: 'action', id: nodes.length, a, depth: parent.depth, parent, children: [], born,
			N: 0, Q: 0, hist: new StatHistory({ N: 0, Q: 0 }),
		};
		nodes.push(node);
		parent.children.push(node);
		return node;
	};

	const root = newState(options.root, null, 0, 1, { k: 0, e: 0 });

	for (let k = 1; k <= options.iterations; k++) {
		const ev: StochEvent[] = [];
		const now = (): Instant => ({ k, e: ev.length });
		ev.push({ type: 'init' });

		// --- Sélection (+ expansion), une profondeur par tour de boucle -------
		let v = root;
		const path: { v: StateNode; act: ActionNode; r: number }[] = [];
		let d = 0;
		while (!v.terminal) {
			let act: ActionNode;
			const untried = ACTIONS.filter(a => !v.children.some(ch => ch.a === a));
			if (untried.length === 0) {
				const scores: UcbScore[] = v.children.map(ch => {
					const bonus = c * Math.sqrt(Math.log(v.N) / ch.N);
					return { id: ch.id, mean: ch.Q, N: ch.N, bonus, score: ch.Q + bonus };
				});
				const best = argmax(scores, x => x.score, uniform);
				act = v.children.find(ch => ch.id === best.id)!;
				ev.push({ type: 'ucb', d, node: v.id, scores, chosen: act.id });
			} else {
				act = newAction(randomChoice(untried, uniform), v, now());
				ev.push({ type: 'try', d, node: v.id, action: act.id });
			}
			const out = env.step(v.s, act.a, uniform);
			let child = act.children.find(ch => ch.s === out.next);
			ev.push({ type: 'sim', d, action: act.id, next: out.next, r: out.r, dir: out.dir, isNew: !child });
			path.push({ v, act, r: out.r });
			if (!child) {
				const p = env.transition(v.s, act.a).get(out.next) ?? 0;
				child = newState(out.next, act, out.r, p, now());
				ev.push({ type: 'new', d, state: child.id });
				v = child;
				break;
			}
			ev.push({ type: 'move', d, state: child.id });
			v = child;
			d++;
		}

		// --- Simulation : rollout avec la politique aléatoire ---------------
		const states = [v.s], dirs: Action[] = [], rewards: number[] = [];
		let s = v.s, G = 0, discount = 1;
		for (let t = 0; t < options.rolloutHorizon && !env.isTerminal(s); t++) {
			const out = env.step(s, randomChoice(ACTIONS, uniform), uniform);
			dirs.push(out.dir); rewards.push(out.r); states.push(out.next);
			G += discount * out.r;
			discount *= gamma;
			s = out.next;
		}
		ev.push({ type: 'rollout', from: v.id, states, dirs, rewards, G });

		// --- Rétropropagation, du bas vers le haut ---------------------------
		const steps: { state: number; action: number; r: number; G: number }[] = [];
		for (let i = path.length - 1; i >= 0; i--) {
			const { v: sv, act, r } = path[i];
			G = r + gamma * G;
			sv.N += 1;
			act.N += 1;
			act.Q += (G - act.Q) / act.N;
			sv.hist.push(k, { N: sv.N });
			act.hist.push(k, { N: act.N, Q: act.Q });
			steps.push({ state: sv.id, action: act.id, r, G });
		}
		// Comme dans le pseudo-code, seuls les couples (v, a) du chemin sont
		// mis à jour : N(v) = Σ_a N(v, a), la feuille garde N = 0 jusqu'à ce
		// qu'une action y soit essayée.
		ev.push({ type: 'backprop', steps });

		if (options.traced?.(k)) events.set(k, ev);
	}
	return { env, options, root, nodes, events };
}

// ===========================================================================
// 2. Jeu déterministe à deux joueurs, somme nulle : un nœud = une position
// ===========================================================================

export interface GameNode {
	id: number;
	board: Board;
	/** Le coup qui mène à ce nœud (null à la racine). */
	move: number | null;
	/** Le joueur qui a joué ce coup : W est compté de SON point de vue. */
	mover: Player;
	terminal: boolean;
	depth: number;
	parent: GameNode | null;
	children: GameNode[];
	born: Instant;
	N: number;
	W: number;
	hist: StatHistory<{ N: number; W: number }>;
}

export type GameEvent =
	| { type: 'init' }
	| { type: 'ucb'; d: number; node: number; scores: UcbScore[]; chosen: number }
	| { type: 'expand'; node: number; child: number }
	| { type: 'rollout'; from: number; boards: Board[]; result: Player | 'draw' }
	| { type: 'backprop'; steps: { node: number; mover: Player; z: number }[] };

export interface GameOptions {
	root: Board;
	c: number;
	iterations: number;
	seed: number;
	traced?: (k: number) => boolean;
}

export interface GameRun {
	options: GameOptions;
	root: GameNode;
	nodes: GameNode[];
	events: Map<number, GameEvent[]>;
}

export function mctsTwoPlayer(options: GameOptions): GameRun {
	const uniform = mulberry32(options.seed);
	const { c } = options;
	const nodes: GameNode[] = [];
	const events = new Map<number, GameEvent[]>();

	const newNode = (board: Board, move: number | null, parent: GameNode | null, born: Instant): GameNode => {
		const node: GameNode = {
			id: nodes.length, board, move,
			mover: ttt.other(ttt.toMove(board)),
			terminal: ttt.isTerminal(board),
			depth: parent ? parent.depth + 1 : 0, parent, children: [], born,
			N: 0, W: 0, hist: new StatHistory({ N: 0, W: 0 }),
		};
		nodes.push(node);
		parent?.children.push(node);
		return node;
	};
	const untriedMoves = (v: GameNode) =>
		ttt.legalMoves(v.board).filter(m => !v.children.some(ch => ch.move === m));

	const root = newNode(options.root, null, null, { k: 0, e: 0 });

	for (let k = 1; k <= options.iterations; k++) {
		const ev: GameEvent[] = [];
		ev.push({ type: 'init' });

		// --- Sélection : descendre tant que le nœud est complètement développé
		let v = root, d = 0;
		while (!v.terminal && untriedMoves(v).length === 0) {
			const parent = v;
			const scores: UcbScore[] = parent.children.map(ch => {
				const mean = ch.W / ch.N;
				const bonus = c * Math.sqrt(Math.log(parent.N) / ch.N);
				return { id: ch.id, mean, N: ch.N, bonus, score: mean + bonus };
			});
			const best = argmax(scores, x => x.score, uniform);
			v = parent.children.find(ch => ch.id === best.id)!;
			ev.push({ type: 'ucb', d, node: parent.id, scores, chosen: v.id });
			d++;
		}

		// --- Expansion : un nouveau fils pour un coup non essayé --------------
		if (!v.terminal) {
			const m = randomChoice(untriedMoves(v), uniform);
			const child = newNode(ttt.play(v.board, m), m, v, { k, e: ev.length });
			ev.push({ type: 'expand', node: v.id, child: child.id });
			v = child;
		}

		// --- Simulation : partie aléatoire jusqu'à la fin -------------------
		const boards = [v.board];
		let b = v.board;
		while (!ttt.isTerminal(b)) {
			b = ttt.play(b, randomChoice(ttt.legalMoves(b), uniform));
			boards.push(b);
		}
		const result = ttt.winner(b)!;
		ev.push({ type: 'rollout', from: v.id, boards, result });

		// --- Rétropropagation : chaque nœud ajoute le gain de SON joueur ------
		const steps: { node: number; mover: Player; z: number }[] = [];
		for (let u: GameNode | null = v; u; u = u.parent) {
			const z = ttt.reward(b, u.mover);
			u.N += 1;
			u.W += z;
			u.hist.push(k, { N: u.N, W: u.W });
			steps.push({ node: u.id, mover: u.mover, z });
		}
		ev.push({ type: 'backprop', steps });

		if (options.traced?.(k)) events.set(k, ev);
	}
	return { options, root, nodes, events };
}
