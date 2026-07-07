# Figures d3.js du deck `optimization_cem_v2.html`

Ce dossier contient les figures dessinées à la volée avec d3.js qui remplacent
progressivement les images statiques du deck (`optimization_cem_v2.html` est la réécriture
de `optimization_cem.html`, conservé intact comme référence). L'architecture générale
(une figure = un fichier TypeScript, transpilé à la volée par Vite en dev, compilé en
bundle autonome par `npm run build:decks` à la publication) est documentée dans
[`D3-FIGURES.md`](../../D3-FIGURES.md) à la racine du dépôt.

## Figures présentes

| Figure | Slides | Remplace |
|---|---|---|
| `optimization_cem_mixture.ts` | « not always the right family of distributions » | `assets/optimization_cem/optimization_cem_mixture.png` |
| `cem_rosenbrock.ts` (+ 2 JSON) | #/3, #/4, #/5 | les 40 images `assets/optimization_cem/cem_rosenbrock_*.svg` |

Les images d'origine restent dans `assets/optimization_cem/` : le deck de référence
`optimization_cem.html` les utilise toujours.

## La figure `cem_rosenbrock` : exécution du CEM sur la fonction de Rosenbrock

Elle montre, itération par itération, la méthode de l'entropie croisée : courbes de niveau
de la fonction objectif, ellipses de niveau de la proposal distribution (normale
multivariée), échantillons tirés et sous-population élite. Elle est **pilotée par les
données** : tout ce qu'un humain peut vouloir changer vit dans deux fichiers JSON séparés
du code de rendu.

### `cem_rosenbrock_data.json` — les données par itération

```json
{
  "iteration": 2,
  "proposal": {
    "mu":    [0.025887, 0.346285],
    "sigma": [[0.60591923, 0.0334348], [0.0334348, 0.21596991]]
  },
  "samples": [
    {"x": -0.3919, "y": 0.9538, "elite": false},
    ...
  ]
}
```

- `samples` : un échantillon par ligne — déplacer un point, en ajouter, en supprimer ou
  changer son statut `elite` se fait directement ici (éditer + recharger la page suffit
  en dev).
- `proposal` : les paramètres (μ, Σ) de la proposal distribution *courante* de
  l'itération (celle depuis laquelle les échantillons ont été tirés).
- Le 11ᵉ enregistrement ne porte que la `proposal` ajustée sur les élites de
  l'itération 10, sans échantillons : la phase `fit` de l'itération k dessine la
  distribution de k+1 (voir les phases plus bas).

Cohérence à connaître si vous éditez les points : dans les données d'origine, la
`proposal` de l'itération k+1 est l'ajustement par maximum de vraisemblance des élites de
l'itération k (μ = moyenne, Σ = covariance empirique en 1/(n-1), comme `np.cov`),
l'itération 1 partant de N(0, I). Le module de rendu ne recalcule PAS cet ajustement : il
dessine ce que le JSON contient — si vous changez les élites, mettez à jour les `mu`/`sigma`
suivants vous-même si vous voulez garder cette cohérence.

### `cem_rosenbrock_config.json` — l'apparence

- `objective.expression` : la formulation de la fonction objectif, comme expression
  JavaScript de `x` et `y` (l'opérateur `**` est autorisé) — par défaut Rosenbrock
  `(1 - x)**2 + 100 * (y - x**2)**2`.
- `objective.xDomain` / `yDomain` / `gridResolution` : domaine tracé et finesse de la
  grille servant au calcul des courbes de niveau (`d3.contours`).
- `objective.contourLevels` : les valeurs de f dont on trace la courbe de niveau
  (couleurs : viridis inversé sur échelle log, comme les figures matplotlib d'origine) ;
  `labeledLevels` : le sous-ensemble étiqueté sur la figure.
- `proposal.pdfLevels` : les niveaux **absolus** de densité de N(μ, Σ) tracés en
  ellipses (0.01 / 0.04 / 0.1 / 0.95 dans les figures d'origine). Un niveau supérieur au
  pic de la densité est simplement ignoré — c'est pour ça que les premières itérations
  n'affichent que 3 ellipses et les suivantes 4.
- couleurs, épaisseurs, pointillés (`dash`), ticks des axes, gabarit du titre
  (`{k}` = numéro d'itération).

### `cem_rosenbrock.ts` — le rendu

Le module dessine dans chaque `<svg class="cem-rosenbrock-fig">` de la page. Les courbes
de niveau de l'objectif sont calculées une fois avec `d3.contours` (étiquettes inline
orientées le long des courbes, façon `clabel` de matplotlib) ; les ellipses de la
gaussienne sont calculées analytiquement depuis μ/Σ (valeurs propres + rayon de
Mahalanobis correspondant à chaque niveau de densité).

Deux modes d'utilisation dans le HTML :

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

<script type="module" src="assets/optimization_cem_v2/cem_rosenbrock.ts"></script>
```

Les quatre phases (mêmes états que les suffixes des SVG d'origine) :

| Phase | Contenu | Équivalent d'origine |
|---|---|---|
| `proposal` | ellipses de la distribution courante seules (noir, pointillé) | `*_p.svg` |
| `samples` | + échantillons (points noirs) | `*.svg` |
| `elite` | échantillons avec élites en rouge, **sans** distribution | `*_elite_nop.svg` |
| `fit` | + distribution ajustée en rouge (= `proposal` de l'itération k+1) | `*_elite.svg` |

Le module s'abonne aux événements `fragmentshown` / `fragmenthidden` / `slidechanged` de
Reveal et recalcule la frame courante comme le plus grand `data-fragment-index` visible
dans la `<section>` : la navigation arrière et l'arrivée en milieu de slide par hash URL
fonctionnent sans état interne. Le même `<script type="module">` peut être colocalisé
dans chaque `<section>` concernée : le navigateur ne l'exécute qu'une fois (même URL) et
il prend en charge toutes les figures de la page.

Piège de mise en page : la règle reveal `min-width: 0; object-fit: contain` des
conteneurs flex `r-hstack`/`r-vstack` ne s'applique qu'aux `img`/`video` — un `<svg>`
ne rétrécit donc pas comme une image ; donnez-lui sa taille explicitement via les
attributs `width`/`height` (le dessin s'adapte, `viewBox` + `preserveAspectRatio`).

### `cem_rosenbrock_extract.py` — provenance des données

Le script matplotlib qui avait généré les `cem_rosenbrock_*.svg` en 2024 est perdu, mais
les SVG contiennent les données exactes. Ce script (Python 3, sans dépendance) les
ré-extrait vers `cem_rosenbrock_data.json` :

- positions des échantillons = marqueurs de `PathCollection_1`, reconvertis en
  coordonnées données par calibration sur les ticks des axes ;
- statut élite = appartenance aux marqueurs rouges de `PathCollection_2` des fichiers
  `*_elite.svg` ;
- μ/Σ par itération = N(0, I) pour l'itération 1 puis ajustement MLE sur les élites,
  hypothèses **vérifiées** lors de la rétro-ingénierie : contours rouges de `k_elite.svg`
  identiques point à point aux contours noirs de `(k+1)_p.svg`, centre des ellipses égal
  à la moyenne des élites, niveaux de densité constants [0.01, 0.04, 0.1, 0.95].

```
python3 assets/optimization_cem_v2/cem_rosenbrock_extract.py
```

réécrit `cem_rosenbrock_data.json` (utile uniquement pour repartir des figures
d'origine ; le JSON est fait pour être édité à la main ensuite).

## Cycle de développement

- `npm start` puis http://localhost:8000/optimization_cem_v2.html — éditer un `.ts` ou
  un `.json` + recharger, aucun build nécessaire.
- `npx tsc --noEmit` — type-check (les figures sont dans l'`include` du `tsconfig.json`
  racine, qui a `resolveJsonModule`).
- `npm run build:decks` — site publiable dans `_site/` ; les JSON sont alors inclus dans
  le bundle `cem_rosenbrock.js` (les modifier après build nécessite de rebuilder).
