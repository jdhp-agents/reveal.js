# Figures d3.js dans les decks : architecture et choix techniques

Les decks utilisant des figures d3.js (à commencer par `optimization_cem_v2.html`)
remplacent progressivement leurs images statiques (PNG/SVG) par des figures dessinées à la
volée avec d3 — l'objectif étant, à terme, des figures interactives et animées,
synchronisées avec les fragments (style 3Blue1Brown).

## Architecture

**Une figure = un fichier TypeScript** dans le dossier d'assets du deck, nommé d'après
l'image qu'il remplace :

```
assets/optimization_cem_v2/optimization_cem_mixture.ts
```

Le fichier importe d3 depuis npm (`import * as d3 from 'd3'` — d3 et `@types/d3` sont en
devDependencies) et dessine dans un SVG identifié de la slide. Côté HTML, la slide
contient :

```html
<div class="r-stretch">
    <svg id="cem-mixture-fig" viewBox="0 0 760 420" preserveAspectRatio="xMidYMid meet"
         style="width: 100%; height: 100%;"></svg>
</div>
<script type="module" src="assets/optimization_cem_v2/optimization_cem_mixture.ts"></script>
```

Le `<script type="module">` référence **directement le fichier `.ts`** et reste colocalisé
avec sa slide dans la `<section>` : chaque figure est autoportante.

Les figures sont type-checkées avec le reste du projet : `assets/**/*.ts` est dans
l'`include` du `tsconfig.json` racine (donc `tsc --noEmit`, l'IDE et le build les
couvrent).

## Figures pilotées par les données : le pattern `cem_rosenbrock`

> Documentation détaillée (format des JSON, phases, provenance des données, pièges) :
> [`assets/optimization_cem_v2/README.md`](assets/optimization_cem_v2/README.md).

Pour les figures dont le contenu est de la *donnée* (points, paramètres de distributions…)
plutôt que du dessin pur, les données et les réglages d'apparence vivent dans des fichiers
séparés du code, éditables à la main. Exemple de référence : les figures « CEM sur
Rosenbrock » de `optimization_cem_v2.html` (elles remplacent les 40 images
`assets/optimization_cem/cem_rosenbrock_*.svg`, conservées comme référence pour
`optimization_cem.html`) :

- `cem_rosenbrock_data.json` — les données par itération : échantillons `{x, y, elite}`
  et paramètres `mu`/`sigma` de la proposal distribution (normale multivariée). Un 11ᵉ
  enregistrement ne porte que la proposal ajustée sur les élites de l'itération 10.
  Généré par `cem_rosenbrock_extract.py` (rétro-ingénierie des SVG matplotlib d'origine :
  positions exactes des marqueurs, ajustement MLE vérifié point à point), puis modifiable
  à la main — un échantillon par ligne.
- `cem_rosenbrock_config.json` — l'apparence : expression JavaScript de la fonction
  objectif, domaine, niveaux de contours (objectif et pdf de la proposal), couleurs,
  pointillés, ticks, gabarit de titre.
- `cem_rosenbrock.ts` — le rendu d3 (contours calculés avec `d3.contours`, ellipses de
  niveau de la gaussienne calculées analytiquement, étiquettes inline façon `clabel`).
  Il importe les deux JSON (`resolveJsonModule`) : en dev, éditer un JSON + recharger
  suffit ; à la publication ils sont inclus dans le bundle.

Une même figure sert plusieurs slides via des attributs `data-*` sur le `<svg>` :

```html
<!-- figure statique -->
<svg class="cem-rosenbrock-fig" width="235" height="224"
     data-iteration="3" data-phase="fit"></svg>

<!-- figure synchronisée avec les fragments de sa <section> : un jeton
     "itération:phase" par data-fragment-index ; data-initial-frame est l'état
     avant le premier fragment (absent = figure cachée) -->
<svg class="cem-rosenbrock-fig" width="400" height="381"
     data-initial-frame="1:proposal"
     data-frames="1:samples 1:fit 2:proposal …"></svg>
```

Phases : `proposal` (ellipses de la distribution courante), `samples` (+ échantillons),
`elite` (échantillons avec élites en rouge, sans distribution), `fit` (+ distribution
ajustée en rouge = proposal de l'itération suivante). Le module s'abonne aux événements
`fragmentshown`/`fragmenthidden`/`slidechanged` de Reveal et recalcule la frame courante
comme le plus grand `data-fragment-index` visible de la `<section>` — la navigation
arrière et l'arrivée en milieu de slide (hash URL) fonctionnent donc sans état interne.
Le même `<script type="module">` peut être colocalisé dans chaque `<section>` concernée :
les navigateurs ne l'exécutent qu'une fois (même URL), et il gère toutes les figures de
la page.

Attention aux `<svg>` dans les conteneurs flex `r-hstack`/`r-vstack` : la règle
`min-width: 0; object-fit: contain` de reveal ne s'applique qu'aux `img`/`video`, donc un
`<svg>` ne rétrécit pas comme une image — donner directement la taille voulue via les
attributs `width`/`height`.

## En développement : aucun build

`npm start` sert le repo tel quel et **le dev server Vite transpile les `.ts` à la volée**
quand le navigateur les demande : le cycle reste « éditer + recharger la page », comme pour
le HTML des decks. L'import `d3` est résolu vers `node_modules/` par Vite (fonctionne
hors-ligne une fois `npm install` fait).

## À la publication : `npm run build:decks` → `_site/`

```
npm run build:decks
  = tsc --noEmit                          # type-check du projet entier
  + node scripts/build-decks.mjs          # assemble _site/ (copies + réécriture .ts → .js)
  + vite build -c vite.config.decks.ts    # compile chaque figure vers _site/assets/…/<figure>.js
```

- `scripts/build-decks.mjs` copie dans `_site/` : tous les `*.html` de la racine (en
  réécrivant les `<script src="….ts">` en `.js`), `dist/`, `assets/` (sans les sources
  `.ts`), `jdhp.css`, `jdhp.js`. Tout est copié tel quel, sans hachage ni réécriture
  d'URL : pas de duplication d'assets (ils pèsent ~270 Mo), et les URLs relatives
  fonctionnent inchangées sous le sous-chemin GitHub Pages
  (`https://<user>.github.io/<repo>/`).
- `vite.config.decks.ts` découvre chaque `assets/**/*.ts` et le compile en un bundle
  ES module autonome au chemin miroir dans `_site/assets/` (d3 y est inclus, tree-shaké :
  ~56 Ko au lieu des ~280 Ko de d3 complet).
- **Le framework n'est pas rebuilé** : `dist/` est commité et copié tel quel — on publie
  exactement ce qui a été testé localement.

`_site/` est dans `.gitignore`.

## CI/CD : GitHub Actions → GitHub Pages

`.github/workflows/deploy-slides.yml` : à chaque push sur `master` (ou manuellement via
*workflow_dispatch*), la CI exécute `npm ci && npm run build:decks` puis déploie `_site/`
sur GitHub Pages.

**Prérequis une seule fois, dans les réglages du dépôt GitHub** : *Settings → Pages →
Build and deployment → Source : « GitHub Actions »*.

## Historique de la décision (pour mémoire)

**v1 — d3 vendoré** (`lib/d3.v7.min.js` commité, figures en `.js` chargées par
`<script src>` classique) : ce choix découlait d'une contrainte alors en vigueur — *aucun
build pour les decks*, n'importe quel serveur statique devait suffire. npm n'avait donc
pas de consommateur (pas de bundler), et `package.json` appartient au framework upstream
(bruit de merge). Le vendoring garantissait aussi le hors-ligne et la reproductibilité.

**v2 — npm + TypeScript + Vite** (état actuel) : l'auteur a accepté une étape de build
avant publication, ce qui a fait tomber l'hypothèse de départ. Dès lors npm redevient le
canal naturel (version figée par `package-lock.json`), le typage d3 attrape les erreurs à
l'édition au lieu de figures qui échouent silencieusement dans le navigateur, et le
confort de dev est intégralement préservé puisque Vite transpile à la volée. Le hors-ligne
reste garanti : par `node_modules/` en dev, par le bundle en publication.
