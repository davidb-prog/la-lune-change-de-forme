/*
 * Les petites Lunes des pictogrammes (frise du curseur, boutons-moments,
 * ligne du défi) : du SVG inline, aux couleurs de la Lune du hublot — jamais
 * un emoji système, dont le dessin et la couleur changent d'un appareil à
 * l'autre (jaune sur iOS, autre jaune sur Android, blanc ailleurs).
 *
 * La forme vient du modèle (formeLune). Une seule licence de pictogramme :
 * une partie éclairée qui ferait moins de FRACTION_ICONE_MIN (20 %) est
 * portée à 20 % du bon côté — à 26 px, un croissant du soir 3 (7 %) ne fait
 * qu'un fil de 2 px. La forme exacte, c'est le hublot qui la montre.
 *
 * Aucun accès DOM : le module fabrique des chaînes, il se teste avec
 * `node test/icone.test.mjs`.
 */
import { TAU, CYCLE_JOURS, formeLune } from './model.js';

export var FRACTION_ICONE_MIN = 0.2;

var LUNE_CLAIRE = '#ebe5d2';
var LUNE_SOMBRE = '#1a2038';
var LISERE = 'rgba(233, 237, 248, 0.35)';

/* Le jour du cycle où la fraction éclairée vaut f, côté droit (Lune
 * croissante) ou côté gauche (décroissante) — l'inverse de (1 − cos θ) / 2. */
export function jourPourFraction(f, cote) {
  var j = (Math.acos(1 - 2 * f) / TAU) * CYCLE_JOURS;
  return cote === 'gauche' ? CYCLE_JOURS - j : j;
}

/* La forme d'icône d'un soir : celle du modèle, croissants épaissis. */
export function formeIcone(jour) {
  var forme = formeLune(jour);
  if (forme.fraction > 0.005 && forme.fraction < FRACTION_ICONE_MIN) {
    return formeLune(jourPourFraction(FRACTION_ICONE_MIN, forme.cote));
  }
  return forme;
}

/* La forme d'icône d'une cible du jeu (DEFIS[].cible). */
var FRACTIONS_CIBLES = {
  'nouvelle': [0, 'droite'],
  'croissant-1': [FRACTION_ICONE_MIN, 'droite'],
  'quartier-1': [0.5, 'droite'],
  'pleine': [1, 'droite'],
  'quartier-2': [0.5, 'gauche'],
  'croissant-2': [FRACTION_ICONE_MIN, 'gauche']
};
export function formeIconeDefi(cible) {
  var c = FRACTIONS_CIBLES[cible] || FRACTIONS_CIBLES.pleine;
  return formeLune(jourPourFraction(c[0], c[1]));
}

/* Le SVG inline d'une Lune de forme { fraction, cote, k }. Disque sombre
 * cerclé (la nouvelle lune reste visible), partie éclairée = limbe éclairé
 * puis terminateur en arc d'ellipse de demi-axe |k| — le même dessin que le
 * hublot, en une vingtaine de caractères de chemin. */
export function svgLune(forme) {
  var f = forme.fraction;
  var eclaire = '';
  if (f >= 0.995) {
    eclaire = '<circle r="1" fill="' + LUNE_CLAIRE + '"/>';
  } else if (f > 0.005) {
    var droite = forme.cote !== 'gauche';
    var k = forme.k;
    if (Math.abs(k) < 0.01) k = k >= 0 ? 0.01 : -0.01;
    /* du haut (0,−1) au bas (0,1) par le limbe éclairé (sens horaire = par la
     * droite en repère SVG), puis retour par le terminateur : k > 0, il
     * bombe vers la droite ; k < 0, vers la gauche */
    var limbe = 'A 1 1 0 0 ' + (droite ? 1 : 0) + ' 0 1';
    var terminateur = 'A ' + Math.abs(k).toFixed(3) + ' 1 0 0 ' + (k > 0 ? 0 : 1) + ' 0 -1';
    eclaire = '<path d="M 0 -1 ' + limbe + ' ' + terminateur + ' Z" fill="' + LUNE_CLAIRE + '"/>';
  }
  return '<svg class="icone-lune" viewBox="-1.15 -1.15 2.3 2.3" aria-hidden="true" focusable="false">' +
    '<circle r="1" fill="' + LUNE_SOMBRE + '" stroke="' + LISERE + '" stroke-width="0.08"/>' +
    eclaire + '</svg>';
}
