# Affichage des slides selon le format d'écran

Notes sur le comportement de reveal.js (v6) face aux différentes tailles d'écran, et les
règles à respecter dans les decks de ce dépôt pour garder un rendu homogène partout.
Tout ce qui suit a été vérifié empiriquement sur `optimization_cem.html` (juillet 2026).

## Comment reveal.js adapte une slide à l'écran

Chaque slide est un **canevas de taille fixe** — par défaut 960 × 700 px (options `width` /
`height` de `Reveal.initialize()`). reveal.js ne « re-met pas en page » le contenu selon
l'écran : il calcule un facteur d'échelle unique et applique une transformation CSS
(`transform: scale(...)`) au canevas entier, centré dans la fenêtre.

Le facteur d'échelle vaut approximativement :

```
scale = min(largeur_fenêtre / width, hauteur_fenêtre / height) / (1 + margin)
```

puis est borné par `minScale` (défaut 0.2) et `maxScale` (défaut 2.0). `margin` (défaut 0.04)
réserve un liseré vide autour du contenu.

**Conséquence clé** : les proportions internes de la slide (tailles de police relatives,
placement des images, colonnes en `%`) sont identiques sur tous les écrans. L'homogénéité est
garantie *par construction*, tant qu'on ne casse pas ce mécanisme (voir « Pièges » plus bas).

## Comportement constaté par type d'écran

| Écran | Fenêtre (CSS px) | Échelle | Comportement |
|---|---|---|---|
| Smartphone portrait | 390 × 844 | — | **Scroll view automatique** (voir ci-dessous) |
| Smartphone paysage | 844 × 390 | ≈ 0.5 | Mode slide classique, mise en page identique, réduite |
| PC Full HD | 1920 × 1080 | ≈ 1.48 | Mode slide classique, remplit l'écran |
| Écran 4K | 3840 × 2160 | ≈ 2.96 | Remplit l'écran **uniquement si `maxScale: 4.0`** |

### Smartphone portrait : la scroll view automatique

Sous **435 px** de largeur de fenêtre (option `scrollActivationWidth`, défaut 435), reveal.js
v6 bascule automatiquement en *scroll view* : le deck devient une page qui défile
verticalement, chaque slide occupant la largeur de l'écran. C'est le comportement mobile
voulu par le framework et il rend bien ; la navigation par flèches/swipe horizontal est
remplacée par le défilement.

- Pour désactiver cette bascule et garder la navigation par slides même en portrait :
  `scrollActivationWidth: 0`.
- Pour forcer la scroll view sur n'importe quel écran : ouvrir l'URL avec `?view=scroll`.

### Écran 4K : pourquoi `maxScale: 4.0` est obligatoire

Avec le `maxScale` par défaut (2.0), un canevas 960 × 700 est agrandi au maximum à
1920 × 1400 px : sur un écran 4K la slide flotte au centre, entourée de grandes marges vides,
et le texte paraît petit.

Avec `maxScale: 4.0`, l'échelle atteinte en 4K est ≈ 2.96 (limitée par la hauteur :
2160 / 700 / 1.04). La slide remplit alors la hauteur de l'écran ; le plafond de 4 laisse
même de la réserve pour des écrans plus grands. Sur les écrans ordinaires (≤ Full HD),
l'échelle naturelle reste sous 2 : cette option n'y change strictement rien.

Netteté à forte échelle :

- Texte, formules MathJax, animations d3.js : vectoriels, parfaitement nets à toute échelle.
- Images **SVG** : nettes à toute échelle — à préférer systématiquement pour les figures
  (courbes matplotlib exportées en SVG, diagrammes...).
- Images **PNG/JPEG** : légèrement adoucies à l'échelle ~3×. Si c'est gênant, réexporter la
  figure en SVG ou en PNG haute résolution (~3× la taille d'affichage).

## Pièges — ce qui casse l'homogénéité

1. **Ne jamais imposer `width` / `height` dans `Reveal.initialize()`.** Tout le contenu des
   decks de ce dépôt est calibré pour le canevas par défaut 960 × 700. Un override (p. ex.
   1920 × 1080) rend le texte deux fois trop petit et tasse le contenu dans le coin
   supérieur gauche — c'est exactement le bug corrigé sur `optimization_cem.html` en
   juillet 2026. C'est le *scaling* qui adapte à l'écran, pas les dimensions du canevas.
2. **Dimensionner en relatif à l'intérieur des slides** : `width: 50%`, `font-size: 0.85em`,
   etc. (comme le font déjà les decks existants), jamais en pixels absolus pensés pour un
   écran particulier.
3. Ne pas utiliser `disableLayout: true` (désactive tout le mécanisme d'échelle).

## Configuration type pour les decks de ce dépôt

```js
Reveal.initialize({
    // PAS de width/height : canevas par défaut 960×700, le scaling fait le reste

    center: true,
    hash: true,
    slideNumber: 'h.v',

    // Obligatoire : permet à la slide de remplir les écrans 4K
    // (sans effet sur les écrans ordinaires, où l'échelle reste < 2)
    maxScale: 4.0,

    // minScale: 0.2 (défaut) — convient au mobile
    // scrollActivationWidth: 435 (défaut) — scroll view auto sous 435 px de large

    // ... plugins, mathjax2, etc.
});
```
