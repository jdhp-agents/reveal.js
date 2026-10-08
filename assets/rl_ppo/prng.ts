// Aléa reproductible des figures du deck rl_ppo.html : toutes les figures
// recalculent leurs données au chargement de la page à partir d'une seed fixée
// (ppo_config.json), donc deux chargements donnent exactement les mêmes figures.

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

/** Générateur gaussien N(0, 1) (Box-Muller) branché sur un PRNG uniforme. */
export function gaussian(uniform: () => number): () => number {
	let spare: number | null = null;
	return () => {
		if (spare !== null) { const z = spare; spare = null; return z; }
		let u = 0;
		while (u <= 1e-12) u = uniform();
		const v = uniform();
		const r = Math.sqrt(-2 * Math.log(u));
		spare = r * Math.sin(2 * Math.PI * v);
		return r * Math.cos(2 * Math.PI * v);
	};
}

/** Moyenne et écart-type (population) d'une liste de nombres. */
export function meanStd(xs: number[]): { mean: number; std: number } {
	const n = xs.length;
	const mean = xs.reduce((s, x) => s + x, 0) / n;
	const v = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
	return { mean, std: Math.sqrt(v) };
}
