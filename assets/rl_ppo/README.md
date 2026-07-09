# Figures d3.js du deck `rl_ppo.html` (Proximal Policy Optimization)

Le deck `rl_ppo.html` (chapitre `decks/rl_ppo/rl_ppo.html`) construit PPO à partir de TD
actor-critic en ajoutant un ingrédient à la fois : rollouts + GAE, réutilisation du lot (ratio
d'importance), clipping, bonus d'entropie. Chaque ingrédient a sa couleur, partout dans le deck
(feuille de route, pseudo-code « diff », figures) : vert = rollouts/GAE, orange = réutilisation,
violet = clipping, bleu foncé = entropie (`INGREDIENT_COLORS` dans `frames.ts`).

Comme pour les decks CEM et MCTS (voir [`D3-FIGURES.md`](../../D3-FIGURES.md)), aucune donnée
n'est précalculée : tous les algorithmes sont **exécutés au chargement de la page** par une
implémentation TypeScript autonome, avec des seeds fixées dans `ppo_config.json`.

Notations de Sutton & Barto (2e éd.) : $S_t, A_t, R_{t+1}$, $\pi(a|s,\boldsymbol\theta)$,
$\hat v(s,\mathbf w)$, $\delta_t$, ratio $\rho_t(\boldsymbol\theta)$ (noté $r_t(\theta)$ dans le
papier PPO). L'avantage est noté $\mathrm{Adv}$ (et non $A$, qui est l'action) ; les macros
MathJax (`\hAdv`, `\thold`, `\Lclip`…) sont définies dans `rl_ppo.html`.

## Deux exemples jouets

- **Le couloir** (`corridor.ts`) : cases 0 à 6, départ en 2, +0.5 en entrant en 0 (proche),
  +1 en entrant en 6 (loin), γ = 0.9, actions ← / → déterministes. Politique softmax et critique
  tabulaires : gradients exacts, et vraie performance $J(\theta) = v_\pi(2)$ exacte (système
  linéaire). L'optimum (toujours →) vaut 0.73, le piège (toujours ←) 0.45. Sert à tout ce qui
  est *temporel* : TD actor-critic, GAE, PPO complet, courbes d'apprentissage.
- **Le bandit gaussien** (`bandit.ts`) : un seul état, action $a \in \mathbb R$, politique
  $\mathcal N(\mu, \sigma^2)$ avec $\theta = (\mu, \ln\sigma)$, récompense moyenne = somme de
  bosses gaussiennes (+ bruit), avantages $r_i - \bar r$ (ligne de base de groupe, comme GRPO),
  $J(\theta)$ en forme close. Sert à tout ce qui concerne *la mise à jour de la politique* :
  ratio, divergence de l'objectif naïf, clipping, entropie.

## Fichiers

| Fichier | Rôle |
|---|---|
| `prng.ts` | PRNG mulberry32, gaussienne (Box-Muller), moyenne / écart-type |
| `corridor.ts` | Couloir, évaluation exacte, rollouts, GAE, mise à jour A2C / naïve / PPO (+ trace), boucle complète, TD actor-critic tracé |
| `bandit.ts` | Bandit gaussien, $J$ et KL exacts, objectifs L^CPI et L^CLIP, SGD et Adam, une mise à jour époque par époque, PPO complet |
| `ppo_config.json` | Tous les paramètres et toutes les seeds (éditable à la main) |
| `frames.ts` | Synchronisation figures ↔ fragments, surlignage du pseudo-code, curseurs, CSS partagé (pseudo-code « diff », feuille de route) |
| `frame_steps.js` | Script **classique** qui crée un fragment vide par jeton de `data-frames` (copie de `assets/rl_mcts/frame_steps.js`) |
| `draw.ts` | Palette, dessin du couloir, marqueurs de flèches (id uniques par svg), `richText` (indices `_{…}`), style des axes |
| `roadmap.ts` | Feuille de route TD AC → … → PPO (`<div class="ppo-roadmap" data-step="k">`) |
| `td_actor_critic.ts` | « Starting point » : TD actor-critic pas à pas sur le couloir, puis après 1000 pas |
| `advantage_timeline.ts` | « n-step advantages » (`data-mode="nstep"`) et « GAE(λ) » (`data-mode="gae"`, curseur λ) |
| `online_vs_batch.ts` | « From online updates to rollouts » : schéma online vs lot, passe arrière, réutilisation |
| `gae_bias_variance.ts` | « λ trades bias for variance » : histogramme des estimations, biais / écart-type / RMSE en fonction de λ |
| `bandit_update.ts` | « What goes wrong » (`data-objective="cpi"`) et « Clipping in action » (`data-objective="clip"`) |
| `clip_objective.ts` | « The clipped objective » : terme de L^CLIP en fonction de ρ (figure 1 du papier), curseur ε |
| `ratio_epochs.ts` | « Why clipping only matters with data reuse » : ratios ρ_t à chaque époque |
| `entropy_bonus.ts` | « Entropy bonus » : bandit à deux modes, une exécution + statistiques sur 100 seeds, curseur c₂ |
| `ppo_step_by_step.ts` | « PPO, step by step » : PPO complet sur le couloir, pseudo-code synchronisé, lot (buffer) |
| `learning_curves.ts` | « Does it work? » : A2C / 10 époques sans clip / PPO / PPO + entropie, 100 seeds |

## Seeds et histoires racontées

Les listes `data-frames` des slides « pas à pas » ne dépendent que de T, K et du nombre de
minibatches (pas des seeds). En revanche, les **notes présentateur** décrivent ce que montrent les
seeds actuelles : changer une seed impose de relire les notes de la slide concernée.

- **TD actor-critic** (seed 10) : épisodes 1 et 2 vont 2 → 1 → 0 ; δ = 0 au premier pas, 0.5 au
  deuxième, puis l'information remonte d'une case par visite ; après 1000 pas l'agent est piégé
  à gauche (J = 0.45).
- **Trajectoire n pas / GAE** : actions fixées (→ ← → → → →), critique = valeurs de la politique
  uniforme : δ₀ < 0 alors que l'estimation Monte Carlo est nettement positive.
- **Biais–variance** (π(→) = 0.7, 2000 épisodes, seed 5) : λ = 0 biaisé (même de mauvais signe),
  λ = 1 sans biais mais variable, RMSE minimale vers λ ≈ 0.75.
- **Bandit, une mise à jour** (12 actions, seed 1, SGD lr = 1, 10 époques) : sans clip, J monte
  jusqu'à l'époque 7, σ s'effondre, le gradient explose à l'époque 8 et J finit sous sa valeur
  initiale ; avec clip, petit gain stable. Sur 200 seeds, la divergence est fréquente (≈ la
  moitié des lots finissent avec J < J₀ après 10 époques sans clip).
- **Ratios par époque** (seed 8, 3 itérations de préchauffage) : 0, 0, 5, 7, 9 échantillons
  clippés au début des époques 1 à 4 puis après la mise à jour.
- **Entropie** (100 seeds par c₂, exécution montrée : seed 13) : grand mode trouvé par ≈ 17–19 %
  des exécutions avec c₂ = 0, ≈ 77 % avec c₂ = 0.05, 0 % avec c₂ = 0.2 (σ diverge).
- **PPO pas à pas** (seed 28) : le lot contient un épisode terminé à gauche (+0.5) puis un
  épisode terminé à droite (+1) ; GAE propage le signal sur toute la trajectoire et se remet à
  zéro en fin d'épisode ; après 30 itérations, J = 0.69.
- **Courbes d'apprentissage** (100 seeds) : bloquées à gauche en fin d'apprentissage : A2C 1 %
  (mais lent), 10 époques sans clip 38 %, PPO 18 %, PPO + entropie (c₂ = 0.02) 3 %.

Les calculs utilisent `Math.exp`/`Math.log`/`Math.sin`… : d'un moteur JavaScript à l'autre, les
derniers bits peuvent différer, ce qui peut changer marginalement les statistiques sur 100 seeds
(ex. 17 % sous Node 20, 19 % sous Chromium pour l'entropie) et, rarement, l'issue d'une exécution
chaotique. Les histoires ci-dessus ont été vérifiées dans Chromium.

## Ajouter ou modifier une figure

Même architecture que les autres decks : un module TS par figure, importé par
`<script type="module">` dans la `<section>`, synchronisé par `syncWithFragments` (jeton courant
= plus grand `data-fragment-index` visible). Pour une slide pilotée par une liste de frames,
placer `data-frames` sur l'élément de la figure et charger `frame_steps.js` (script classique)
juste après, avant le module.
