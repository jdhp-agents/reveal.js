# Pourquoi d3.js est vendoré dans `lib/` plutôt qu'installé via npm

Les decks utilisant des figures d3.js (à commencer par `optimization_cem_v2.html`) chargent
d3 depuis un fichier commité dans le dépôt :

```html
<script src="lib/d3.v7.min.js"></script>
```

et non depuis npm (`npm install d3`) ni depuis un CDN. Ce choix est délibéré ; voici le
raisonnement, pour mémoire.

## 1. Les decks n'ont pas de pipeline de build — et c'est voulu

Les pages HTML à la racine (decks personnels, `demo.html`) sont servies par Vite comme de
simples fichiers statiques : elles chargent leurs scripts par `<script src="...">`, sans
étape d'import ni de bundling. Le cycle d'édition est « modifier le HTML/JS → recharger la
page », sans rebuild.

Or npm est un mécanisme de *build* : installer d3 par npm n'a de sens que si quelque chose
consomme le paquet — typiquement un `import * as d3 from 'd3'` dans un fichier traité par un
bundler. Passer par npm aurait donc imposé l'un des deux compromis suivants :

- **créer un pipeline de build pour les decks** (bundler les JS de figures), ce qui casserait
  le cycle « éditer + recharger » actuel ;
- **référencer `/node_modules/d3/dist/d3.min.js` directement dans le HTML**, ce qui
  fonctionne sous le dev server Vite mais est fragile : le jour où les decks sont déployés
  comme fichiers statiques sur un autre site (leur destin naturel — ils viennent d'ailleurs
  d'un autre layout de site), `node_modules/` ne suit pas.

## 2. `package.json` appartient au framework, pas aux decks

Ce dépôt est un clone de reveal.js upstream ; son `package.json` décrit les dépendances du
*framework* (build, tests). d3 est une dépendance du *contenu* (les decks personnels). Les
mélanger aurait deux coûts :

- du bruit de merge à chaque synchronisation avec l'upstream ;
- rendre implicite le fait que les decks exigeraient un `npm install` pour fonctionner,
  alors qu'aujourd'hui n'importe quel serveur statique suffit.

## 3. Reproductibilité et fonctionnement hors-ligne

Un fichier exact commité dans `lib/` garantit que les présentations fonctionnent dans dix
ans, sur n'importe quelle machine, sans réseau ni `npm install`, avec précisément la version
testée (**d3 v7.9.0**). C'est cohérent avec la convention existante du dépôt : `jdhp.css` /
`jdhp.js` à la racine, médias commités dans `assets/` — le contenu pédagogique est
entièrement autoporté. (C'est aussi la raison du refus d'un CDN : une salle de cours sans
réseau ne doit pas empêcher les slides de s'afficher.)

## En résumé

npm est le bon canal quand le code est *construit* ; ici les decks sont *servis tels quels*,
donc la bibliothèque doit exister comme fichier statique dans le dépôt.

**Alternative hybride possible** si le besoin apparaît un jour : `npm install d3` comme
source de vérité et un petit script qui copie `node_modules/d3/dist/d3.min.js` vers `lib/`.
On y gagnerait les mises à jour via `npm update`, au prix d'une dépendance de plus dans le
manifeste du framework et d'une étape de synchronisation. Pour une bibliothèque aussi stable
que d3, dont on veut de toute façon figer la version pour des slides de cours, le fichier
vendoré offre le meilleur rapport simplicité/robustesse.

## Mise à jour de la version vendorée

Le cas échéant :

```bash
curl -sL -o lib/d3.v7.min.js https://d3js.org/d3.v7.min.js
```

(ou télécharger la version majeure voulue depuis <https://d3js.org>), puis vérifier les
decks concernés dans le navigateur avant de commiter, et mettre à jour le numéro de version
mentionné ci-dessus.
