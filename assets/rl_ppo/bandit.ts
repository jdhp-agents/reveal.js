// Le bandit continu 1D, exemple jouet « mise à jour de politique » du deck
// rl_ppo.html (ratio d'importance, effondrement de l'objectif naïf, clipping,
// bonus d'entropie).
//
// Un seul état : la politique est une gaussienne π(a|θ) = N(μ, σ²) avec
// θ = (μ, log σ), et la récompense moyenne R(a) est une somme de bosses
// gaussiennes. Les récompenses observées sont bruitées : r = R(a) + bruit.
// Avantages estimés Â_i = r_i − moyenne(r) (la ligne de base est la moyenne du
// lot). La vraie performance J(θ) = E_{a~π_θ}[R(a)] est exacte (forme close).
//
// Montée de gradient avec Adam, comme dans les implémentations de PPO.

import { mulberry32, gaussian } from './prng';

export interface Bump { center: number; height: number; width: number; }
export interface Policy { mu: number; logSigma: number; }

export function sigma(p: Policy): number { return Math.exp(p.logSigma); }

export function logPdf(p: Policy, a: number): number {
	const s = sigma(p);
	return -0.5 * ((a - p.mu) / s) ** 2 - p.logSigma - 0.5 * Math.log(2 * Math.PI);
}
export function pdf(p: Policy, a: number): number { return Math.exp(logPdf(p, a)); }

/** Récompense moyenne R(a). */
export function reward(bumps: Bump[], a: number): number {
	return bumps.reduce((s, b) => s + b.height * Math.exp(-0.5 * ((a - b.center) / b.width) ** 2), 0);
}

/** J(θ) = E_{a~N(μ,σ²)}[R(a)] (convolution de deux gaussiennes). */
export function performance(bumps: Bump[], p: Policy): number {
	const s2 = sigma(p) ** 2;
	return bumps.reduce((s, b) => {
		const v = s2 + b.width ** 2;
		return s + b.height * b.width / Math.sqrt(v) * Math.exp(-0.5 * (p.mu - b.center) ** 2 / v);
	}, 0);
}

/** KL(π_old ‖ π_θ) entre deux gaussiennes. */
export function kl(old: Policy, p: Policy): number {
	const so = sigma(old), s = sigma(p);
	return Math.log(s / so) + (so ** 2 + (old.mu - p.mu) ** 2) / (2 * s ** 2) - 0.5;
}

/** Entropie de N(μ, σ²). */
export function entropy(p: Policy): number { return p.logSigma + 0.5 * Math.log(2 * Math.PI * Math.E); }

export interface Sample { a: number; r: number; adv: number; }

/** Tire n actions de π, observe des récompenses bruitées, calcule les avantages. */
export function sampleBatch(bumps: Bump[], p: Policy, n: number, noise: number, normal: () => number): Sample[] {
	const xs = Array.from({ length: n }, () => p.mu + sigma(p) * normal());
	const rs = xs.map(a => reward(bumps, a) + noise * normal());
	const base = rs.reduce((s, r) => s + r, 0) / n;
	return xs.map((a, i) => ({ a, r: rs[i], adv: rs[i] - base }));
}

export type Objective = 'cpi' | 'clip';

export function isClipped(ratio: number, adv: number, eps: number): boolean {
	return (adv > 0 && ratio > 1 + eps) || (adv < 0 && ratio < 1 - eps);
}

/** Valeur de l'objectif de substitution (estimation sur le lot). */
export function surrogate(samples: Sample[], old: Policy, p: Policy, objective: Objective, eps: number): number {
	let L = 0;
	for (const s of samples) {
		const ratio = Math.exp(logPdf(p, s.a) - logPdf(old, s.a));
		L += objective === 'cpi' ? ratio * s.adv
			: Math.min(ratio * s.adv, Math.min(Math.max(ratio, 1 - eps), 1 + eps) * s.adv);
	}
	return L / samples.length;
}

/** Gradient de (objectif + c·H) par rapport à (μ, log σ). */
function gradient(samples: Sample[], old: Policy, p: Policy, objective: Objective, eps: number, entropyCoef: number): [number, number] {
	const s = sigma(p);
	let gMu = 0, gLs = 0;
	for (const x of samples) {
		const ratio = Math.exp(logPdf(p, x.a) - logPdf(old, x.a));
		if (objective === 'clip' && isClipped(ratio, x.adv, eps)) continue;
		const z = (x.a - p.mu) / s;
		gMu += x.adv * ratio * z / s;            // ∂ρ/∂μ = ρ (a−μ)/σ²
		gLs += x.adv * ratio * (z * z - 1);      // ∂ρ/∂log σ = ρ ((a−μ)²/σ² − 1)
	}
	return [gMu / samples.length, gLs / samples.length + entropyCoef];
}

/** Optimiseur Adam (montée) sur θ = (μ, log σ). */
export class Adam {
	private m = [0, 0]; private v = [0, 0]; private t = 0;
	constructor(private lr: number, private b1 = 0.9, private b2 = 0.999, private eps = 1e-8) {}
	step(p: Policy, g: [number, number]): Policy {
		this.t++;
		const out = [p.mu, p.logSigma];
		for (let i = 0; i < 2; i++) {
			this.m[i] = this.b1 * this.m[i] + (1 - this.b1) * g[i];
			this.v[i] = this.b2 * this.v[i] + (1 - this.b2) * g[i] * g[i];
			const mh = this.m[i] / (1 - this.b1 ** this.t), vh = this.v[i] / (1 - this.b2 ** this.t);
			out[i] += this.lr * mh / (Math.sqrt(vh) + this.eps);
		}
		return { mu: out[0], logSigma: out[1] };
	}
}

/** Montée de gradient simple, même interface qu'Adam. */
export class Sgd {
	constructor(private lr: number) {}
	step(p: Policy, g: [number, number]): Policy {
		return { mu: p.mu + this.lr * g[0], logSigma: p.logSigma + this.lr * g[1] };
	}
}

export interface Epoch {
	/** θ après k époques (k = 0 : θ_old). */
	policy: Policy;
	ratios: number[];
	clipped: boolean[];
	/** Objectif de substitution estimé sur le lot (celui qu'on optimise). */
	surrogate: number;
	/** Vraie amélioration J(θ_k) − J(θ_old). */
	improvement: number;
	kl: number;
}

/**
 * Une seule mise à jour de PPO sur un lot fixé : K époques (lot complet) de
 * montée sur L^CPI (« naïf ») ou L^CLIP. Renvoie l'état après chaque époque.
 */
export function updateOnBatch(bumps: Bump[], old: Policy, samples: Sample[],
	opts: { objective: Objective; epochs: number; lr: number; eps: number; entropyCoef?: number; optimizer?: 'sgd' | 'adam' }): Epoch[] {
	const adam = opts.optimizer === 'adam' ? new Adam(opts.lr) : new Sgd(opts.lr);
	const J0 = performance(bumps, old);
	const out: Epoch[] = [];
	let p = { ...old };
	for (let k = 0; k <= opts.epochs; k++) {
		const ratios = samples.map(x => Math.exp(logPdf(p, x.a) - logPdf(old, x.a)));
		out.push({
			policy: p, ratios,
			clipped: ratios.map((r, i) => isClipped(r, samples[i].adv, opts.eps)),
			surrogate: surrogate(samples, old, p, opts.objective, opts.eps),
			improvement: performance(bumps, p) - J0,
			kl: kl(old, p),
		});
		if (k < opts.epochs) p = adam.step(p, gradient(samples, old, p, opts.objective, opts.eps, opts.entropyCoef ?? 0));
	}
	return out;
}

export interface BanditIteration { policy: Policy; J: number; samples: Sample[]; }

/** PPO complet sur le bandit : `iterations` lots successifs, K époques chacun. */
export function runPpo(bumps: Bump[], init: Policy, opts: {
	iterations: number; batch: number; noise: number; epochs: number; lr: number; eps: number;
	entropyCoef: number; seed: number; optimizer?: 'sgd' | 'adam';
}): BanditIteration[] {
	const normal = gaussian(mulberry32(opts.seed));
	const adam = opts.optimizer === 'adam' ? new Adam(opts.lr) : new Sgd(opts.lr);
	let p = { ...init };
	const out: BanditIteration[] = [];
	for (let i = 0; i < opts.iterations; i++) {
		const samples = sampleBatch(bumps, p, opts.batch, opts.noise, normal);
		out.push({ policy: p, J: performance(bumps, p), samples });
		const old = p;
		for (let k = 0; k < opts.epochs; k++) {
			p = adam.step(p, gradient(samples, old, p, 'clip', opts.eps, opts.entropyCoef));
		}
	}
	out.push({ policy: p, J: performance(bumps, p), samples: [] });
	return out;
}
