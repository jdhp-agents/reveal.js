# Figures d3.js du deck `optimization_cem_v3.html`

Troisième version du deck CEM. Comme la v2 (`assets/optimization_cem_v2/`, dont ce dossier
est issu), les figures sont dessinées à la volée avec d3.js ; la différence est la
provenance des données de la figure `cem_rosenbrock` :

- **v2** : données précalculées lues dans `cem_rosenbrock_data.json` (extraites des SVG
  matplotlib d'origine par un script Python) ;
- **v3** : données **recalculées au chargement de la page** par une implémentation
  TypeScript de l'algorithme CEM ([`cem.ts`](cem.ts)), avec une seed de random fixée —
  l'exécution est parfaitement reproductible d'un chargement à l'autre.

L'architecture générale (une figure = un fichier TypeScript, transpilé à la volée par Vite
en dev, compilé en bundle autonome par `npm run build:decks` à la publication) est
documentée dans [`D3-FIGURES.md`](../../D3-FIGURES.md) à la racine du dépôt.

## Fichiers

| Fichier | Rôle |
|---|---|
| `cem.ts` | Implémentation autonome du CEM (PRNG seedé, sans dépendance) |
| `cem_rosenbrock.ts` | Rendu d3.js : exécute le CEM puis dessine les figures |
| `cem_rosenbrock_config.json` | Paramètres du CEM + apparence des figures (éditable à la main) |
| `optimization_cem_mixture.ts` | Figure « mixture model », copiée telle quelle de la v2 |

## `cem.ts` — l'implémentation du CEM

Implémentation en dimension quelconque, écrite pour être lue : elle suit pas à pas le
pseudo-code présenté dans le deck (échantillonner → sélectionner les élites → réajuster
par maximum de vraisemblance). Briques internes documentées dans le fichier :

- **PRNG seedé** (`mulberry32`) + **Box-Muller** pour les tirages N(0, 1) — tout l'aléa
  passe par là, d'où la reproductibilité ;
- **décomposition de Cholesky** de Σ pour échantillonner N(μ, Σ) : x = μ + L·z ;
- **fit MLE** : μ = moyenne empirique des élites, Σ = covariance empirique en 1/n
  (les formules de la slide « maximum likelihood estimate » — la v2 utilisait
  l'estimateur en 1/(n−1) de `np.cov`, différence négligeable avec 20 élites).

```ts
const run: CemIteration[] = cem(f, { initialProposal, sampleSize, eliteSize, iterations, seed });
```

Chaque `CemIteration` contient tout ce que les figures consomment : `proposal` (la
distribution depuis laquelle les échantillons ont été tirés), `samples` (positions, score,
drapeau `elite`, dans l'ordre de tirage) et `fitted` (le réajustement sur les élites,
c'est-à-dire la `proposal` de l'itération suivante). La phase `fit` de l'itération k
dessine donc `run[k-1].fitted` — plus besoin du 11ᵉ enregistrement « proposal seule » que
la v2 gardait dans son JSON.

## `cem_rosenbrock_config.json` — paramètres et apparence

En plus des sections d'apparence héritées de la v2 (`objective`, `proposal`, `samples`,
`axes`, `title` — voir le README de la v2 pour leur détail), une section `cem` paramètre
l'exécution :

- `seed` : la changer donne une autre exécution, toujours reproductible. La seed 63 a été
  retenue car son déroulé ressemble beaucoup à celui des figures matplotlib d'origine
  (rétrécissement progressif de la covariance, convergence vers ≈ (0.84, 0.71) en
  10 itérations le long de la vallée de Rosenbrock) ;
- `sampleSize` (m = 100), `eliteSize` (m_elite = 20), `iterations` (10, ≥ la plus grande
  itération référencée par les `data-iteration`/`data-frames` du deck) ;
- `initialProposal` : N(0, I) au départ.

`objective.expression` sert à la fois aux courbes de niveau **et** à l'exécution du CEM :
changer la fonction objectif dans le JSON change les deux, de façon cohérente.

## `cem_rosenbrock.ts` — le rendu

Identique à la v2 au branchement des données près : le CEM est exécuté une seule fois au
chargement du module, puis chaque `<svg class="cem-rosenbrock-fig">` de la page est
dessiné depuis `run`. Les deux modes d'utilisation dans le HTML sont inchangés :

```html
<!-- figure statique : une itération, une phase -->
<svg class="cem-rosenbrock-fig" width="235" height="224"
     data-iteration="3" data-phase="fit"></svg>

<!-- figure synchronisée avec les fragments de sa <section> : un jeton
     "itération:phase" par data-fragment-index ; data-initial-frame est l'état
     avant le premier fragment (absent = figure cachée) -->
<svg class="cem-rosenbrock-fig" width="400" height="381"
     data-initial-frame="1:proposal"
     data-frames="1:samples 1:fit 2:proposal 2:samples 2:fit ..."></svg>

<script type="module" src="assets/optimization_cem_v3/cem_rosenbrock.ts"></script>
```

Les quatre phases : `proposal` (ellipses de la distribution courante seules, noir
pointillé), `samples` (+ échantillons), `elite` (échantillons avec élites en rouge, sans
distribution), `fit` (+ distribution ajustée en rouge).

Piège de mise en page (hérité de la v2) : la règle reveal `min-width: 0; object-fit:
contain` des conteneurs flex `r-hstack`/`r-vstack` ne s'applique qu'aux `img`/`video` —
donnez aux `<svg>` leur taille explicitement via les attributs `width`/`height`.

## Cycle de développement

- `npm start` puis http://localhost:8000/optimization_cem_v3.html — éditer un `.ts` ou
  le `.json` + recharger, aucun build nécessaire.
- `npx tsc --noEmit` — type-check (les figures sont dans l'`include` du `tsconfig.json`
  racine, qui a `resolveJsonModule`).
- `npm run build:decks` — site publiable dans `_site/` ; la config JSON est alors incluse
  dans le bundle `cem_rosenbrock.js` (la modifier après build nécessite de rebuilder).
