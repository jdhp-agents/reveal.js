// Méthode de l'entropie croisée (CEM) — implémentation TypeScript autonome,
// sans dépendance, utilisée par les figures du deck optimization_cem_v3.html
// pour calculer « à la volée » les données que la v2 lisait dans un JSON
// précalculé (assets/optimization_cem_v2/cem_rosenbrock_data.json).
//
// L'algorithme (ici en minimisation) suit le pseudo-code présenté dans le deck.
// À chaque itération :
//   1. tirer `sampleSize` échantillons de la proposal distribution N(mu, sigma) ;
//   2. garder les `eliteSize` meilleurs selon la fonction objectif f (les « élites ») ;
//   3. réajuster (mu, sigma) sur les élites par maximum de vraisemblance
//      (mu = moyenne empirique, sigma = covariance empirique en 1/n,
//      les formules données sur la slide « maximum likelihood estimate »).
//
// Tout l'aléa provient d'un générateur pseudo-aléatoire seedé : deux exécutions
// avec la même seed produisent exactement le même déroulé, donc les mêmes figures.

/** Une distribution normale multivariée N(mu, sigma), en dimension quelconque. */
export interface Gaussian {
	mu: number[];
	sigma: number[][];
}

/** Un point échantillonné : position, valeur de f, et appartenance aux élites. */
export interface Sample {
	x: number[];
	score: number;
	elite: boolean;
}

/**
 * Tout ce qui s'est passé pendant une itération — la structure que les figures
 * consomment. `proposal` est la distribution depuis laquelle `samples` ont été
 * tirés ; `fitted` est son réajustement sur les élites, c'est-à-dire la
 * `proposal` de l'itération suivante.
 */
export interface CemIteration {
	proposal: Gaussian;
	samples: Sample[];
	fitted: Gaussian;
}

export interface CemOptions {
	/** Paramètres initiaux (mu, sigma) de la proposal distribution. */
	initialProposal: Gaussian;
	/** m : nombre d'échantillons tirés à chaque itération. */
	sampleSize: number;
	/** m_elite : nombre de meilleurs échantillons conservés pour le réajustement. */
	eliteSize: number;
	/** Critère d'arrêt : nombre d'itérations. */
	iterations: number;
	/** Seed du générateur pseudo-aléatoire (entier). */
	seed: number;
}

/**
 * Minimise `f` par la méthode de l'entropie croisée et retourne l'historique
 * complet de l'exécution, une entrée par itération.
 */
export function cem(f: (x: number[]) => number, options: CemOptions): CemIteration[] {
	const nextNormal = normalSampler(mulberry32(options.seed));
	const history: CemIteration[] = [];
	let proposal = options.initialProposal;

	for (let k = 0; k < options.iterations; k++) {
		// 1. Échantillonner : x = mu + L·z avec L·Lᵀ = sigma et z ~ N(0, I).
		const chol = cholesky(proposal.sigma);
		const samples: Sample[] = Array.from({ length: options.sampleSize }, () => {
			const z = proposal.mu.map(nextNormal);
			const x = proposal.mu.map((m, i) => m + dot(chol[i], z));
			return { x, score: f(x), elite: false };
		});

		// 2. Sélectionner les élites : les `eliteSize` scores les plus bas
		// (le tri se fait sur une copie, `samples` garde l'ordre de tirage).
		[...samples]
			.sort((a, b) => a.score - b.score)
			.slice(0, options.eliteSize)
			.forEach(s => { s.elite = true; });

		// 3. Réajuster la distribution sur les élites (maximum de vraisemblance).
		const elites = samples.filter(s => s.elite).map(s => s.x);
		const mu = mean(elites);
		const fitted = { mu, sigma: covariance(elites, mu) };

		history.push({ proposal, samples, fitted });
		proposal = fitted;
	}
	return history;
}

// ---------------------------------------------------------------------------
// Générateur pseudo-aléatoire seedé
// ---------------------------------------------------------------------------

/** PRNG mulberry32 : rapide, déterministe, uniforme sur [0, 1). */
function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Tirages N(0, 1) par la transformation de Box-Muller. */
function normalSampler(uniform: () => number): () => number {
	return () => {
		const u1 = 1 - uniform(); // sur (0, 1] pour éviter log(0)
		const u2 = uniform();
		return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
	};
}

// ---------------------------------------------------------------------------
// Petite algèbre linéaire (dimension quelconque)
// ---------------------------------------------------------------------------

function dot(a: number[], b: number[]): number {
	return a.reduce((acc, ai, i) => acc + ai * b[i], 0);
}

/**
 * Décomposition de Cholesky d'une matrice symétrique définie positive :
 * retourne L triangulaire inférieure telle que L·Lᵀ = a.
 */
function cholesky(a: number[][]): number[][] {
	const n = a.length;
	const l = a.map(row => row.map(() => 0));
	for (let i = 0; i < n; i++) {
		for (let j = 0; j <= i; j++) {
			const partial = a[i][j] - dot(l[i].slice(0, j), l[j].slice(0, j));
			l[i][j] = i === j ? Math.sqrt(partial) : partial / l[j][j];
		}
	}
	return l;
}

/** Moyenne empirique d'un nuage de points. */
function mean(points: number[][]): number[] {
	return points[0].map((_, i) =>
		points.reduce((acc, p) => acc + p[i], 0) / points.length);
}

/** Covariance empirique (estimateur du maximum de vraisemblance, en 1/n). */
function covariance(points: number[][], mu: number[]): number[][] {
	return mu.map((_, i) => mu.map((_, j) =>
		points.reduce((acc, p) => acc + (p[i] - mu[i]) * (p[j] - mu[j]), 0) / points.length));
}
