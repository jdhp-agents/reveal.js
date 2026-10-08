// Longue exécution du MCTS sur FrozenLake, partagée par les figures « après n
// itérations » et « convergence » du deck rl_mcts.html (un module ES n'est
// exécuté qu'une fois par page : le calcul, ~0,1 s, n'est fait qu'une fois).
//
// Même seed et mêmes paramètres que la figure pas à pas (mcts_frozenlake.ts) :
// les premières itérations sont donc exactement celles montrées pas à pas.
// L'état de l'arbre après n itérations (n <= LONG_N) se lit dans l'historique
// des nœuds (born, hist.at(n)), sans relancer l'algorithme.
import { FrozenLake } from './frozenlake';
import { mctsStochastic } from './mcts';
import type { ActionNode } from './mcts';
import config from './mcts_config.json';

const cfg = config.frozenlake;

export const LONG_N = 20000;
export const env = new FrozenLake(cfg.map);
export const longRun = mctsStochastic(env, {
	root: cfg.root, gamma: cfg.gamma, c: cfg.c, seed: cfg.seed,
	rolloutHorizon: cfg.rolloutHorizon, iterations: LONG_N,
});
/** Q*(s₀, a) exact (itération sur les valeurs), indexé par l'action. */
export const qStarRoot = env.qStar(cfg.gamma)[cfg.root];
/** Les nœuds action de la racine, dans l'ordre des actions (LEFT, DOWN, RIGHT, UP). */
export const rootActions: ActionNode[] = [...longRun.root.children].sort((a, b) => a.a - b.a);

/** Une couleur par action de la racine (sous-arbres colorés de la même teinte). */
export const ACTION_COLORS = ['#4aa3df', '#f0a030', '#9467bd', '#8c8c8c'];

/** n en clair : 1 234 → « 1,234 ». */
export const fmtN = (n: number) => n.toLocaleString('en');
