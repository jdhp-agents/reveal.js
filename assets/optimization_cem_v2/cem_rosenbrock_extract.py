#!/usr/bin/env python3
"""Génère cem_rosenbrock_data.json à partir des SVG matplotlib d'origine.

Les figures assets/optimization_cem/cem_rosenbrock_*.svg (générées en 2024 par un
script matplotlib aujourd'hui perdu) contiennent les vraies données de l'exécution
du CEM sur Rosenbrock : ce script les ré-extrait pour que la version d3.js du deck
optimization_cem_v2.html redessine exactement les mêmes figures.

Ce qui est extrait / reconstruit, pour chaque itération k (1..10) :
  - les échantillons : positions des marqueurs de PathCollection_1 dans
    cem_rosenbrock_{k}.svg, converties en coordonnées données via la calibration
    sur les ticks des axes ;
  - le statut élite : appartenance à PathCollection_2 (marqueurs rouges) de
    cem_rosenbrock_{k}_elite.svg ;
  - les paramètres (mu, sigma) de la proposal distribution : itération 1 = N(0, I)
    (vérifié sur les ellipses de cem_rosenbrock_01_p.svg), puis ajustement sur les
    élites de l'itération précédente — mu = moyenne, sigma = covariance empirique
    en 1/(n-1) (équivalent np.cov). Vérifications faites lors de la rétro-ingénierie :
      * les contours rouges de {k}_elite.svg == les contours noirs de {k+1}_p.svg
        (identiques point à point) ;
      * le centre des ellipses de {k+1}_p.svg == la moyenne des élites de k ;
      * les contours tracés correspondent aux niveaux de densité pdf absolus
        [0.01, 0.04, 0.1, 0.95] (constants d'une itération à l'autre) — ces niveaux
        sont dans cem_rosenbrock_config.json, pas ici.

Un 11e enregistrement ne contient que la proposal ajustée sur les élites de
l'itération 10 : la phase « fit » de l'itération k dessine la proposal de k+1.

Usage :  python3 assets/optimization_cem_v2/cem_rosenbrock_extract.py
(réécrit assets/optimization_cem_v2/cem_rosenbrock_data.json)

Le JSON produit est fait pour être édité à la main (un échantillon par ligne) :
ce script n'est là que pour régénérer le point de départ.
"""
import re
import xml.etree.ElementTree as ET
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SVGDIR = REPO / 'assets' / 'optimization_cem'
OUT = Path(__file__).with_name('cem_rosenbrock_data.json')
NS = {'svg': 'http://www.w3.org/2000/svg'}
N_ITER = 10


def groups(name):
    root = ET.parse(SVGDIR / name).getroot()
    return {g.get('id'): g for g in root.iter('{http://www.w3.org/2000/svg}g')}


def calibrate(gs):
    """Applications linéaires (x_svg -> x_données, y_svg -> y_données), par
    régression sur les positions des ticks (x : -2..2 pas 1 ; y : -2..2 pas 0.5)."""
    def linfit(pairs):
        n = len(pairs)
        sx = sum(p for p, _ in pairs); sv = sum(v for _, v in pairs)
        sxx = sum(p * p for p, _ in pairs); sxv = sum(p * v for p, v in pairs)
        a = (n * sxv - sx * sv) / (n * sxx - sx * sx)
        b = (sv - a * sx) / n
        return lambda p: a * p + b
    xt = [(float(gs[f'xtick_{i}'].find('.//svg:use', NS).get('x')), v)
          for i, v in zip(range(1, 6), [-2, -1, 0, 1, 2])]
    yt = [(float(gs[f'ytick_{i}'].find('.//svg:use', NS).get('y')), v)
          for i, v in zip(range(1, 10), [-2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0])]
    return linfit(xt), linfit(yt)


def markers(gs, gid, fx, fy):
    g = gs.get(gid)
    if g is None:
        return []
    return [(fx(float(u.get('x'))), fy(float(u.get('y'))))
            for u in g.findall('.//svg:use', NS)]


def fit_gaussian(points):
    """mu = moyenne, sigma = covariance en 1/(n-1) (comme np.cov)."""
    n = len(points)
    mx = sum(x for x, _ in points) / n
    my = sum(y for _, y in points) / n
    sxx = sum((x - mx) ** 2 for x, _ in points) / (n - 1)
    syy = sum((y - my) ** 2 for _, y in points) / (n - 1)
    sxy = sum((x - mx) * (y - my) for x, y in points) / (n - 1)
    return [mx, my], [[sxx, sxy], [sxy, syy]]


iterations = []
proposal = ([0.0, 0.0], [[1.0, 0.0], [0.0, 1.0]])  # itération 1 : N(0, I)
for k in range(1, N_ITER + 1):
    gs = groups(f'cem_rosenbrock_{k:02d}.svg')
    fx, fy = calibrate(gs)
    samples = markers(gs, 'PathCollection_1', fx, fy)
    gse = groups(f'cem_rosenbrock_{k:02d}_elite.svg')
    fxe, fye = calibrate(gse)
    elite_pts = markers(gse, 'PathCollection_2', fxe, fye)

    def is_elite(s):
        return any(abs(s[0] - e[0]) < 1e-5 and abs(s[1] - e[1]) < 1e-5 for e in elite_pts)

    flagged = [(x, y, is_elite((x, y))) for x, y in samples]
    n_elite = sum(1 for *_, f in flagged if f)
    assert n_elite == len(elite_pts), f'itération {k}: {n_elite} élites != {len(elite_pts)} marqueurs rouges'
    iterations.append({'proposal': proposal, 'samples': flagged})
    proposal = fit_gaussian([(x, y) for x, y, f in flagged if f])

# 11e enregistrement : proposal ajustée sur les élites de l'itération 10, sans échantillons
iterations.append({'proposal': proposal, 'samples': []})

# --- Sérialisation lisible : un échantillon par ligne
def num(v, nd):
    r = round(v, nd)
    return f'{int(r)}' if r == int(r) else f'{r}'

lines = ['{', '  "iterations": [']
for i, it in enumerate(iterations):
    mu, sig = it['proposal']
    lines.append('    {')
    lines.append(f'      "iteration": {i + 1},')
    lines.append(f'      "proposal": {{')
    lines.append(f'        "mu":    [{num(mu[0], 6)}, {num(mu[1], 6)}],')
    lines.append(f'        "sigma": [[{num(sig[0][0], 8)}, {num(sig[0][1], 8)}],')
    lines.append(f'                  [{num(sig[1][0], 8)}, {num(sig[1][1], 8)}]]')
    lines.append(f'      }},')
    lines.append('      "samples": [')
    for j, (x, y, f) in enumerate(it['samples']):
        comma = ',' if j < len(it['samples']) - 1 else ''
        lines.append(f'        {{"x": {num(x, 4)}, "y": {num(y, 4)}, "elite": {str(f).lower()}}}{comma}')
    lines.append('      ]')
    lines.append('    }' + (',' if i < len(iterations) - 1 else ''))
lines += ['  ]', '}', '']
OUT.write_text('\n'.join(lines))
print(f'{OUT} écrit : {len(iterations)} enregistrements, '
      f'{sum(len(it["samples"]) for it in iterations)} échantillons')
