// Le « couloir », exemple jouet temporel du deck rl_ppo.html (TD actor-critic,
// GAE, PPO complet), et toutes les variantes d'algorithmes qui y tournent.
//
//   cases 0 1 2 3 4 5 6 : 0 et 6 sont terminales ; entrer en 0 rapporte
//   rewardLeft (petite récompense proche), entrer en 6 rapporte rewardRight
//   (grande récompense lointaine). Départ en `start`. Actions ← (0) et → (1),
//   déterministes. Toutes les autres récompenses sont nulles.
//
// Politique tabulaire softmax π(a|s,θ) = exp θ[s][a] / Σ_b exp θ[s][b] et
// critique tabulaire v̂(s,w) = w[s] : les gradients sont exacts et analytiques,
// et la vraie valeur v_π se calcule exactement (système linéaire), ce qui
// permet de tracer la performance réelle J(θ) = v_π(start) sans bruit.
//
// Notations de Sutton & Barto (2e éd.) : S_t, A_t, R_{t+1}, δ_t, ρ_t.

import { mulberry32 } from './prng';

export interface CorridorConfig {
	nCells: number;
	start: number;
	rewardLeft: number;
	rewardRight: number;
	gamma: number;
}

export const LEFT = 0, RIGHT = 1;
export type Logits = number[][];   // θ[s][a]
export type Values = number[];     // w[s]

export class Corridor {
	readonly nS: number;
	readonly start: number;
	readonly gamma: number;
	constructor(readonly cfg: CorridorConfig) {
		this.nS = cfg.nCells;
		this.start = cfg.start;
		this.gamma = cfg.gamma;
	}
	isTerminal(s: number): boolean { return s === 0 || s === this.nS - 1; }
	/** Transition déterministe : (S_{t+1}, R_{t+1}, épisode terminé ?). */
	step(s: number, a: number): { s2: number; r: number; done: boolean } {
		const s2 = a === RIGHT ? s + 1 : s - 1;
		const r = s2 === 0 ? this.cfg.rewardLeft : s2 === this.nS - 1 ? this.cfg.rewardRight : 0;
		return { s2, r, done: this.isTerminal(s2) };
	}
	/** États non terminaux. */
	states(): number[] { return range(1, this.nS - 1); }
	zeroLogits(): Logits { return Array.from({ length: this.nS }, () => [0, 0]); }
	zeroValues(): Values { return new Array(this.nS).fill(0); }
}

function range(a: number, b: number): number[] {
	const out: number[] = [];
	for (let i = a; i < b; i++) out.push(i);
	return out;
}

/** π(·|s,θ) pour une politique softmax tabulaire. */
export function probs(theta: Logits, s: number): [number, number] {
	const [l0, l1] = theta[s];
	const m = Math.max(l0, l1);
	const e0 = Math.exp(l0 - m), e1 = Math.exp(l1 - m);
	return [e0 / (e0 + e1), e1 / (e0 + e1)];
}

export function cloneLogits(theta: Logits): Logits { return theta.map(r => [...r]); }

// ---------------------------------------------------------------------------
// Évaluation exacte
// ---------------------------------------------------------------------------

/** Résout A x = b (élimination de Gauss avec pivot partiel). */
function solve(A: number[][], b: number[]): number[] {
	const n = b.length;
	const M = A.map((row, i) => [...row, b[i]]);
	for (let c = 0; c < n; c++) {
		let p = c;
		for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
		[M[c], M[p]] = [M[p], M[c]];
		for (let r = 0; r < n; r++) {
			if (r === c) continue;
			const f = M[r][c] / M[c][c];
			for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
		}
	}
	return M.map((row, i) => row[n] / row[i]);
}

/** v_π exacte (v = 0 sur les cases terminales). */
export function exactValues(env: Corridor, policy: (s: number) => [number, number]): Values {
	const n = env.nS;
	const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
	const b = new Array(n).fill(0);
	for (const s of env.states()) {
		const p = policy(s);
		for (const a of [LEFT, RIGHT]) {
			const { s2, r, done } = env.step(s, a);
			b[s] += p[a] * r;
			if (!done) A[s][s2] -= p[a] * env.gamma;
		}
	}
	return solve(A, b);
}

/** q_π(s, a) exacte. */
export function exactQ(env: Corridor, v: Values, s: number, a: number): number {
	const { s2, r, done } = env.step(s, a);
	return r + (done ? 0 : env.gamma * v[s2]);
}

/** Performance exacte J(θ) = v_π(start). */
export function performance(env: Corridor, theta: Logits): number {
	return exactValues(env, s => probs(theta, s))[env.start];
}

// ---------------------------------------------------------------------------
// Collecte et GAE
// ---------------------------------------------------------------------------

export interface Transition {
	s: number; a: number; r: number; s2: number; done: boolean;
	/** π(A_t|S_t, θ_old) au moment de la collecte. */
	pOld: number;
}

/** Collecte T pas avec π(·|·,θ) ; l'épisode repart de `start` quand il se termine. */
export function rollout(env: Corridor, theta: Logits, s0: number, T: number, uniform: () => number):
	{ batch: Transition[]; last: number } {
	const batch: Transition[] = [];
	let s = s0;
	for (let t = 0; t < T; t++) {
		const p = probs(theta, s);
		const a = uniform() < p[RIGHT] ? RIGHT : LEFT;
		const { s2, r, done } = env.step(s, a);
		batch.push({ s, a, r, s2, done, pOld: p[a] });
		s = done ? env.start : s2;
	}
	return { batch, last: s };
}

export interface Advantages {
	/** δ_t = R_{t+1} + γ v̂(S_{t+1}) − v̂(S_t) (v̂ = 0 après une fin d'épisode). */
	delta: number[];
	/** GAE(λ) : Â_t = δ_t + γλ Â_{t+1} (remise à zéro en fin d'épisode). */
	adv: number[];
	/** Cible du critique : Â_t + v̂(S_t). */
	target: number[];
}

export function gae(batch: Transition[], w: Values, gamma: number, lambda: number): Advantages {
	const T = batch.length;
	const delta = new Array(T).fill(0), adv = new Array(T).fill(0);
	let carry = 0;
	for (let t = T - 1; t >= 0; t--) {
		const tr = batch[t];
		delta[t] = tr.r + (tr.done ? 0 : gamma * w[tr.s2]) - w[tr.s];
		carry = delta[t] + (tr.done ? 0 : gamma * lambda * carry);
		adv[t] = carry;
	}
	return { delta, adv, target: adv.map((x, t) => x + w[batch[t].s]) };
}

// ---------------------------------------------------------------------------
// Mise à jour : A2C (une montée de gradient), réutilisation naïve (L^CPI),
// PPO-clip (L^CLIP), avec bonus d'entropie optionnel
// ---------------------------------------------------------------------------

export type Objective = 'pg' | 'cpi' | 'clip';

export interface UpdateOptions {
	objective: Objective;
	epochs: number;
	minibatches: number;
	lrActor: number;
	lrCritic: number;
	clipEps: number;
	entropyCoef: number;
}

/** Ce qu'a vu chaque échantillon lors d'un pas de gradient (pour les figures). */
export interface SampleStep { t: number; ratio: number; clipped: boolean; }
export interface GradStep {
	epoch: number;
	minibatch: number;
	samples: SampleStep[];
	/** θ et w APRÈS ce pas. */
	theta: Logits;
	w: Values;
}

/** Le ratio d'importance ρ_t(θ) est-il « clippé » (gradient nul) ? */
export function isClipped(ratio: number, adv: number, eps: number): boolean {
	return (adv > 0 && ratio > 1 + eps) || (adv < 0 && ratio < 1 - eps);
}

/**
 * K époques de montée de gradient (SGD simple) sur le lot, en minibatches
 * consécutifs mélangés à chaque époque. Modifie theta et w en place.
 */
export function update(batch: Transition[], advs: Advantages, theta: Logits, w: Values,
	opts: UpdateOptions, uniform: () => number, trace?: GradStep[]): void {
	const T = batch.length;
	const idx = range(0, T);
	const mbSize = Math.ceil(T / opts.minibatches);
	for (let k = 0; k < opts.epochs; k++) {
		if (opts.minibatches > 1) shuffle(idx, uniform);
		for (let m = 0; m < opts.minibatches; m++) {
			const mb = idx.slice(m * mbSize, (m + 1) * mbSize);
			if (!mb.length) continue;
			const gTheta = theta.map(() => [0, 0]);
			const gW = new Array(w.length).fill(0);
			const samples: SampleStep[] = [];
			for (const t of mb) {
				const tr = batch[t];
				const p = probs(theta, tr.s);
				const ratio = p[tr.a] / tr.pOld;
				const A = advs.adv[t];
				const clipped = opts.objective === 'clip' && isClipped(ratio, A, opts.clipEps);
				samples.push({ t, ratio, clipped });
				// ∇_θ[s] de ρ·Â (ou de log π·Â pour A2C) : coef · (e_a − π(·|s))
				const coef = clipped ? 0 : opts.objective === 'pg' ? A : A * ratio;
				for (const b of [LEFT, RIGHT]) {
					gTheta[tr.s][b] += coef * ((b === tr.a ? 1 : 0) - p[b]);
					if (opts.entropyCoef) {
						// ∇ H(π(·|s)) par rapport aux logits : −π_b (log π_b + H)
						const H = -(p[0] * Math.log(p[0]) + p[1] * Math.log(p[1]));
						gTheta[tr.s][b] += opts.entropyCoef * -p[b] * (Math.log(p[b]) + H);
					}
				}
				gW[tr.s] += advs.target[t] - w[tr.s];
			}
			for (let s = 0; s < theta.length; s++) {
				for (const b of [LEFT, RIGHT]) theta[s][b] += opts.lrActor * gTheta[s][b] / mb.length;
				w[s] += opts.lrCritic * gW[s] / mb.length;
			}
			trace?.push({ epoch: k, minibatch: m, samples, theta: cloneLogits(theta), w: [...w] });
		}
	}
}

function shuffle<T>(xs: T[], uniform: () => number): void {
	for (let i = xs.length - 1; i > 0; i--) {
		const j = Math.floor(uniform() * (i + 1));
		[xs[i], xs[j]] = [xs[j], xs[i]];
	}
}

// ---------------------------------------------------------------------------
// Boucle complète (A2C / réutilisation naïve / PPO)
// ---------------------------------------------------------------------------

export interface RunOptions extends UpdateOptions {
	iterations: number;
	T: number;
	lambda: number;
	seed: number;
}

export interface Iteration {
	/** Nombre total de pas d'environnement à la fin de l'itération. */
	steps: number;
	theta: Logits;
	w: Values;
	J: number;
}

export function run(env: Corridor, opts: RunOptions): Iteration[] {
	const uniform = mulberry32(opts.seed);
	const theta = env.zeroLogits(), w = env.zeroValues();
	const out: Iteration[] = [{ steps: 0, theta: cloneLogits(theta), w: [...w], J: performance(env, theta) }];
	let s = env.start;
	for (let i = 1; i <= opts.iterations; i++) {
		const { batch, last } = rollout(env, theta, s, opts.T, uniform);
		s = last;
		const advs = gae(batch, w, env.gamma, opts.lambda);
		update(batch, advs, theta, w, opts, uniform);
		out.push({ steps: i * opts.T, theta: cloneLogits(theta), w: [...w], J: performance(env, theta) });
	}
	return out;
}

// ---------------------------------------------------------------------------
// TD actor-critic à un pas (Sutton & Barto, 2e éd., section 13.5), tracé
// ---------------------------------------------------------------------------

export interface TdStep {
	s: number; a: number; r: number; s2: number; done: boolean;
	delta: number; I: number;
	/** θ, w après la mise à jour de w, puis après celle de θ. */
	wAfter: Values; thetaAfter: Logits;
	/** θ, w avant ce pas. */
	wBefore: Values; thetaBefore: Logits;
}

export function tdActorCritic(env: Corridor, opts: { steps: number; alphaTheta: number; alphaW: number; seed: number }): TdStep[] {
	const uniform = mulberry32(opts.seed);
	const theta = env.zeroLogits(), w = env.zeroValues();
	const out: TdStep[] = [];
	let s = env.start, I = 1;
	for (let t = 0; t < opts.steps; t++) {
		const thetaBefore = cloneLogits(theta), wBefore = [...w];
		const p = probs(theta, s);
		const a = uniform() < p[RIGHT] ? RIGHT : LEFT;
		const { s2, r, done } = env.step(s, a);
		const delta = r + (done ? 0 : env.gamma * w[s2]) - w[s];
		w[s] += opts.alphaW * delta;
		for (const b of [LEFT, RIGHT]) theta[s][b] += opts.alphaTheta * I * delta * ((b === a ? 1 : 0) - p[b]);
		out.push({ s, a, r, s2, done, delta, I, wAfter: [...w], thetaAfter: cloneLogits(theta), wBefore, thetaBefore });
		I *= env.gamma;
		if (done) { s = env.start; I = 1; } else s = s2;
	}
	return out;
}
