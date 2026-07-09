# Figures d3.js du deck `rl_mcts.html` (Monte Carlo Tree Search)

Le deck `rl_mcts.html` (chapitre `decks/rl_mcts/rl_mcts.html`) présente MCTS sur deux
environnements : **FrozenLake** (MDP stochastique : nœuds état + nœuds action/chance,
retours actualisés) et le **tic-tac-toe** (jeu déterministe à deux joueurs et à somme nulle :
un nœud = une position, valeurs vues par chaque joueur).

Comme pour le deck CEM (voir [`D3-FIGURES.md`](../../D3-FIGURES.md)), aucune donnée n'est
précalculée : les deux variantes de MCTS sont **exécutées au chargement de la page** par une
implémentation TypeScript autonome, avec une seed fixée — les figures sont parfaitement
reproductibles, et changer un paramètre de `mcts_config.json` suffit à tout recalculer.

## Fichiers

| Fichier | Rôle |
|---|---|
| `frozenlake.ts` | Modèle exact de FrozenLake-v1 (Gymnasium, glissant) + itération sur les valeurs (Q* exact) |
| `tictactoe.ts` | Règles du tic-tac-toe + minimax exact (negamax, valeurs 1 / ½ / 0) |
| `mcts.ts` | Les deux MCTS (`mctsStochastic`, `mctsTwoPlayer`), PRNG mulberry32, **trace** des événements |
| `mcts_config.json` | Seeds, c, γ, état/position racine, bandit (éditable à la main) |
| `frames.ts` | Synchronisation figures ↔ fragments, surlignage du pseudo-code, CSS partagé |
| `frame_steps.js` | Script **classique** qui crée un fragment vide par jeton de `data-frames` |
| `draw.ts` | Palette et primitives : carte/vignettes FrozenLake, plateaux, panneau UCB1, flèches |
| `tree_view.ts` | Vue d'arbre générique (d3.tree, transitions animées, surlignage du chemin, zoom auto) |
| `mcts_frozenlake.ts` | Slide « MCTS on FrozenLake, step by step » : arbre + carte + scores UCB1 + pseudo-code |
| `mcts_tictactoe.ts` | Slide « MCTS on tic-tac-toe, step by step » : arbre + playout + scores UCB1 + pseudo-code |
| `frozenlake_long_run.ts` | Exécution longue (20 000 itérations, même seed) partagée par les deux figures suivantes |
| `mcts_frozenlake_overview.ts` | Arbre après n itérations (élagué, taille ∝ visites) + stats de la racine vs Q*, curseur |
| `frozenlake_convergence.ts` | Q(s₀, a) et N(s₀, a)/n en fonction de n (échelle log), avec Q* |
| `ttt_root_moves.ts` | Les 6 coups de O : flat Monte Carlo vs minimax (`puzzle`), ou MCTS après n itérations (`mcts`) |
| `ucb_bandit.ts` | UCB1 sur un bandit de Bernoulli à 4 bras |
| `mcts_phases.ts` | Schéma des 4 phases (sélection, expansion, simulation, rétropropagation) |
| `tree_explosion.ts` | Arbre de jeu exhaustif vs arbre MCTS (disposition radiale) |
| `frozenlake_map.ts` | La carte FrozenLake et les 3 issues glissantes d'une action |
| `node_types.ts` | Schémas « nœuds état / nœuds de chance » vs « un nœud = une position » |

## Les slides « pas à pas » : la trace et les jetons de frame

`mcts.ts` enregistre, pour les itérations demandées, la suite des **événements** (un par
ligne exécutée du pseudo-code), et pour chaque nœud sa date de création (itération,
événement) et l'historique de ses statistiques. Une figure peut ainsi reconstruire l'arbre
à n'importe quel instant sans relancer l'algorithme.

La liste des frames d'une slide est écrite dans l'attribut `data-frames` de la figure, un
jeton par clic :

```html
<svg class="fl-tree" data-initial-frame="0:all"
     data-frames="1:init 1:try.0 1:sim.0 1:new.0 1:rollout 1:backprop 2:all …"></svg>
<script src="assets/rl_mcts/frame_steps.js"></script>
<script type="module" src="assets/rl_mcts/mcts_frozenlake.ts"></script>
```

- `k:événement[.d]` : itération `k`, événement de la trace (`d` = profondeur de descente,
  0 à la racine) — FrozenLake : `init ucb try sim new move rollout backprop` ;
  tic-tac-toe : `init ucb expand rollout backprop` ;
- `k:all` : l'arbre à la fin de l'itération `k`, sans surlignage (`0:all` = racine seule) ;
- `k:return` : idem + ligne `return` et action recommandée.

Un jeton qui ne correspond à aucun événement (après un changement de seed, par exemple)
est signalé dans la console du navigateur (`no event "…" in iteration k`) : il faut alors
réécrire la liste. Pour choisir les itérations à montrer, lire la trace (événements par
itération) avec un petit script Node (`esbuild` est disponible dans `node_modules/.bin`).

**Pourquoi `frame_steps.js` est un script classique** : reveal.js démarre pendant l'analyse
de la page (le `Reveal.initialize()` du bas de page), avant l'exécution des modules
`type="module"`. Les fragments « compteurs » doivent donc exister avant : un script
classique placé dans la `<section>` s'exécute au moment où il est analysé, et crée un
fragment vide par jeton de `data-frames`. reveal.js les voit comme des fragments écrits à la
main (navigation arrière, accès direct par l'URL `#/<id>/<fragment>`, vue présentateur).
La figure lit ensuite le plus grand `data-fragment-index` visible de la section pour savoir
quelle frame afficher — sans état interne, comme `cem_rosenbrock.ts`.

Le pseudo-code est un `<div class="mcts-code">` dont chaque ligne porte `data-ln="…"` ; la
figure surligne en rouge (classe `current`) les lignes de l'événement courant.

## Seeds et histoire racontée

- **FrozenLake** (racine s₀ = 10, γ = 0.95, c = √2, seed 986) : itération 1, LEFT glisse en
  14 et le rollout atteint le but ; itération 3, RIGHT tombe directement dans le trou
  (feuille terminale) ; itération 5, égalité UCB1 et descente par une issue déjà connue ;
  itération 6, nouvelle issue sous un nœud action existant ; itération 8, UCB1 choisit UP
  par le seul bonus d'exploration ; après 11 itérations MCTS jouerait DOWN. Sur l'exécution
  longue, LEFT (l'action optimale, Q* = 0.40 contre 0.35 pour DOWN : elle ne peut jamais
  glisser dans un trou) devient la plus visitée vers n ≈ 10 000, alors que les Q estimés
  restent nettement sous Q*.
- **Tic-tac-toe** (racine `X...O...X`, O au trait, c = √2, seed 1014) : les coins perdent
  (X bloque et fait une fourchette), les bords font nulle ; le flat Monte Carlo préfère
  pourtant les coins. MCTS favorise d'abord le coin bas-gauche (premier playout gagnant),
  le joue encore après 19 itérations, puis l'abandonne et converge vers un bord.

Les seeds ont été choisies par balayage (premières itérations didactiques, rollouts courts).
