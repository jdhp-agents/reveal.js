// Tic-tac-toe — règles du jeu, utilisées comme simulateur par le MCTS
// « deux joueurs, somme nulle » du deck rl_mcts.html.
//
// Un plateau est une chaîne de 9 caractères ('X', 'O' ou '.'), cases numérotées
// ligne par ligne :   0 | 1 | 2
//                     3 | 4 | 5
//                     6 | 7 | 8
// X joue toujours en premier : le joueur au trait se déduit donc du plateau.

export type Player = 'X' | 'O';

/** Noms des cases, pour les légendes des figures. */
export const CELL_NAMES = ['top-left', 'top', 'top-right', 'left', 'center', 'right',
	'bottom-left', 'bottom', 'bottom-right'];
export type Board = string;

export const LINES = [
	[0, 1, 2], [3, 4, 5], [6, 7, 8],
	[0, 3, 6], [1, 4, 7], [2, 5, 8],
	[0, 4, 8], [2, 4, 6],
];

export function toMove(b: Board): Player {
	let x = 0, o = 0;
	for (const c of b) { if (c === 'X') x++; else if (c === 'O') o++; }
	return x === o ? 'X' : 'O';
}

export function other(p: Player): Player {
	return p === 'X' ? 'O' : 'X';
}

/** Le gagnant, 'draw' si le plateau est plein sans alignement, null sinon. */
export function winner(b: Board): Player | 'draw' | null {
	for (const [i, j, k] of LINES) {
		if (b[i] !== '.' && b[i] === b[j] && b[j] === b[k]) return b[i] as Player;
	}
	return b.includes('.') ? null : 'draw';
}

/** La ligne gagnante (indices des 3 cases), s'il y en a une. */
export function winningLine(b: Board): number[] | null {
	for (const line of LINES) {
		const [i, j, k] = line;
		if (b[i] !== '.' && b[i] === b[j] && b[j] === b[k]) return line;
	}
	return null;
}

export function isTerminal(b: Board): boolean {
	return winner(b) !== null;
}

export function legalMoves(b: Board): number[] {
	if (isTerminal(b)) return [];
	const moves: number[] = [];
	for (let i = 0; i < 9; i++) if (b[i] === '.') moves.push(i);
	return moves;
}

export function play(b: Board, move: number): Board {
	return b.slice(0, move) + toMove(b) + b.slice(move + 1);
}

/**
 * Résultat d'une partie terminée du point de vue du joueur p :
 * 1 = victoire, ½ = nulle, 0 = défaite (récompenses dans [0, 1], comme le
 * suppose la constante d'exploration c = √2 de UCB1).
 */
export function reward(b: Board, p: Player): number {
	const w = winner(b);
	return w === 'draw' ? 0.5 : w === p ? 1 : 0;
}

/**
 * Valeur minimax exacte de la position pour le joueur au trait
 * (1 = gain forcé, ½ = nulle, 0 = perte forcée), avec mémoïsation.
 */
export function minimax(b: Board, memo = new Map<Board, number>()): number {
	const cached = memo.get(b);
	if (cached !== undefined) return cached;
	let v: number;
	if (isTerminal(b)) {
		v = reward(b, toMove(b));
	} else {
		// La valeur pour le joueur au trait est 1 − la valeur de l'adversaire
		// dans la position suivante (somme nulle) : negamax.
		v = Math.max(...legalMoves(b).map(m => 1 - minimax(play(b, m), memo)));
	}
	memo.set(b, v);
	return v;
}
