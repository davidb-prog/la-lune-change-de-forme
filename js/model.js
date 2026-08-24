/*
 * Le modèle pur de l'épisode « Pourquoi la Lune change de forme ? »
 * Aucun accès DOM : tout se teste avec `node test/model.test.mjs`.
 *
 * Conventions géométriques (vue du dessus, depuis le pôle Nord) :
 * - coordonnées mathématiques (x vers la droite, y vers le haut) — les vues
 *   font elles-mêmes la bascule vers le repère canvas (y vers le bas) ;
 * - le Soleil est FIXE, très loin dans la direction SOLEIL_DIR (vers la
 *   gauche) : c'est l'objet-repère de la série, il ne bouge jamais ;
 * - la Lune tourne autour de la Terre dans le sens trigonométrique (le vrai
 *   sens, vu du pôle Nord) ; jour 0 = nouvelle lune (Lune côté Soleil).
 */

export var TAU = Math.PI * 2;

/* Durée du cycle affiché, en jours. Le vrai mois synodique dure 29,53 jours —
 * on arrondit à 29,5 (documenté dans la note aux parents et le README). */
export var CYCLE_JOURS = 29.5;

/* Jour de la pleine lune : à mi-chemin du cycle. */
export var JOUR_PLEINE = CYCLE_JOURS / 2;

/* Soir affiché à l'arrivée sur la page : un premier croissant — on voit une
 * Lune dès le début (au jour 0, nouvelle lune, le ciel serait vide). */
export var JOUR_DEPART = 2.5;

/* Direction du Soleil (unitaire, constante) : l'objet-repère fixe. */
export var SOLEIL_DIR = { x: -1, y: 0 };

/* Epsilon des seuils géométriques (sin(π) ≈ 1e-16 n'est pas « décroissant »). */
export var EPS = 1e-9;

/* Seuils de classification des phases, en fraction éclairée. */
export var SEUIL_NOUVELLE = 0.04;   /* en dessous : nouvelle lune */
export var SEUIL_PLEINE = 0.965;    /* au dessus : pleine lune */
export var SEUIL_QUARTIER_BAS = 0.40;
export var SEUIL_QUARTIER_HAUT = 0.60;

/* La lecture automatique (bouton ⏸/▶ harmonisé de la famille) : un cycle
 * complet de la Lune défile en ce nombre de secondes. */
export var LECTURE_SECONDES_PAR_CYCLE = 90;

/* Ramène un jour dans [0, CYCLE_JOURS[. */
export function jourNormalise(jour) {
  var j = jour % CYCLE_JOURS;
  if (j < 0) j += CYCLE_JOURS;
  return j;
}

/* Angle de la Lune sur son orbite, en radians dans [0, τ[.
 * 0 = nouvelle lune (Lune du côté du Soleil). */
export function angleOrbite(jour) {
  return (jourNormalise(jour) / CYCLE_JOURS) * TAU;
}

/* Position de la Lune (vecteur unitaire Terre → Lune, coordonnées math).
 * Jour 0 : la Lune est vers le Soleil, soit (−1, 0). Le jour qui avance fait
 * tourner ce vecteur dans le sens trigonométrique. */
export function positionLune(jour) {
  var t = angleOrbite(jour);
  return { x: -Math.cos(t), y: -Math.sin(t) };
}

/* La moitié éclairée de la Lune fait TOUJOURS face au Soleil : la direction
 * d'éclairage (Lune → Soleil) est constante, car le Soleil est très loin.
 * C'est la vérité n° 1 de l'épisode. */
export function directionEclairee(jour) {
  return { x: SOLEIL_DIR.x, y: SOLEIL_DIR.y };
}

/* Fraction éclairée du disque VUE DEPUIS LA TERRE, dans [0, 1].
 * 0 = nouvelle lune, 1 = pleine lune. Formule : (1 − cos θ) / 2. */
export function fractionEclairee(jour) {
  return (1 - Math.cos(angleOrbite(jour))) / 2;
}

/* La Lune grossit-elle ce soir-là ? (première moitié du cycle) */
export function luneCroissante(jour) {
  return Math.sin(angleOrbite(jour)) >= -EPS && jourNormalise(jour) < JOUR_PLEINE + EPS;
}

/* Côté éclairé du disque vu depuis chez nous (hémisphère nord) :
 * Lune qui grossit → côté droit éclairé ; Lune qui rapetisse → côté gauche.
 * (La « Lune menteuse » : elle dessine un D quand elle croît.) */
export function coteEclaire(jour) {
  return luneCroissante(jour) ? 'droite' : 'gauche';
}

/* Tout ce qu'il faut pour dessiner le disque dans le hublot :
 * - fraction : fraction éclairée [0, 1] ;
 * - cote : 'droite' | 'gauche' (côté du limbe éclairé) ;
 * - k : demi-axe signé du terminateur, en fraction du rayon, dans [−1, 1].
 *   k = dir · (1 − 2·fraction), avec dir = +1 (droite) / −1 (gauche).
 *   k > 0 : le terminateur bombe vers la droite ; k < 0 : vers la gauche.
 *   Croissant fin → |k| proche de 1 côté éclairé ; quartier → k ≈ 0 ;
 *   gibbeuse → le terminateur bombe vers le côté sombre. */
export function formeLune(jour) {
  var f = fractionEclairee(jour);
  var cote = coteEclaire(jour);
  var dir = cote === 'droite' ? 1 : -1;
  return { fraction: f, cote: cote, k: dir * (1 - 2 * f) };
}

/* Les huit phases du cycle, dans l'ordre — cet ordre ne s'inverse jamais. */
export var ORDRE_PHASES = [
  'nouvelle', 'croissant-1', 'quartier-1', 'gibbeuse-1',
  'pleine', 'gibbeuse-2', 'quartier-2', 'croissant-2'
];

var NOMS_PHASES = {
  'nouvelle': 'nouvelle lune',
  'croissant-1': 'premier croissant',
  'quartier-1': 'premier quartier',
  'gibbeuse-1': 'presque pleine',
  'pleine': 'pleine lune',
  'gibbeuse-2': 'encore bien ronde',
  'quartier-2': 'dernier quartier',
  'croissant-2': 'dernier croissant'
};

/* La phase du soir : { cle, nom, croissante }. */
export function phaseInfo(jour) {
  var f = fractionEclairee(jour);
  var croissante = luneCroissante(jour);
  var cle;
  if (f < SEUIL_NOUVELLE) cle = 'nouvelle';
  else if (f > SEUIL_PLEINE) cle = 'pleine';
  else if (f < SEUIL_QUARTIER_BAS) cle = croissante ? 'croissant-1' : 'croissant-2';
  else if (f <= SEUIL_QUARTIER_HAUT) cle = croissante ? 'quartier-1' : 'quartier-2';
  else cle = croissante ? 'gibbeuse-1' : 'gibbeuse-2';
  return { cle: cle, nom: NOMS_PHASES[cle], croissante: croissante };
}

/* La petite phrase du soir, affichée sous le hublot et lue par le conteur. */
export function phraseDuSoir(jour) {
  var j = Math.round(jourNormalise(jour));
  var info = phaseInfo(jour);
  var debut = 'Soir ' + j + ' — ' + info.nom + '. ';
  if (info.cle === 'nouvelle') return debut + 'On ne la voit pas du tout !';
  if (info.cle === 'pleine') return debut + 'La Lune est toute ronde !';
  if (info.croissante) return debut + 'Chaque soir, la Lune grossit.';
  return debut + 'Chaque soir, la Lune rapetisse.';
}

/* Les quatre moments-clés : boutons « 🎲 Joue avec la Lune ».
 * `histoire` s'affiche à l'écran ; `oral` est la version pour le conteur
 * (enchaînements ajoutés, aucun émoji, ponctuation propre). */
export var SCENARIOS = [
  {
    id: 'nouvelle',
    emoji: '🌑',
    jour: 0,
    titre: 'La Lune a disparu !',
    sousTitre: 'nouvelle lune',
    histoire: 'Ce soir, pas de Lune dans le ciel ! Elle est passée entre la Terre et le Soleil. ' +
      'Sa moitié éclairée regarde le Soleil… et nous, on ne voit que sa moitié toute sombre. ' +
      'On appelle ça la nouvelle lune.',
    oral: 'Regarde : ce soir, pas de Lune dans le ciel ! Elle est passée entre la Terre et le Soleil. ' +
      'Sa moitié éclairée regarde le Soleil… et nous, on ne voit que sa moitié toute sombre. ' +
      'On appelle ça la nouvelle lune.'
  },
  {
    id: 'croissant',
    emoji: '🌒',
    jour: 2.5,
    titre: 'Un petit sourire',
    sousTitre: 'premier croissant',
    histoire: 'La Lune a un peu avancé sur son chemin. On aperçoit un tout petit bout de sa moitié éclairée : ' +
      'un fin croissant, comme un sourire dans le ciel ! Chaque soir, il va grossir un peu.',
    oral: 'Deux ou trois soirs après la nouvelle lune, la Lune a un peu avancé sur son chemin. ' +
      'On aperçoit un tout petit bout de sa moitié éclairée : un fin croissant, comme un sourire dans le ciel ! ' +
      'Chaque soir, il va grossir un peu.'
  },
  {
    id: 'pleine',
    emoji: '🌕',
    jour: JOUR_PLEINE,
    titre: 'Toute ronde !',
    sousTitre: 'pleine lune',
    histoire: 'Cette nuit, la Lune est de l’autre côté de la Terre, juste en face du Soleil. ' +
      'On voit toute sa moitié éclairée d’un coup : un grand rond brillant ! ' +
      'C’est la pleine lune.',
    oral: 'Deux semaines après la nouvelle lune, la Lune est arrivée de l’autre côté de la Terre, juste en face du Soleil. ' +
      'On voit toute sa moitié éclairée d’un coup : un grand rond brillant ! ' +
      'C’est la pleine lune.'
  },
  {
    id: 'quartier',
    emoji: '🌗',
    jour: 22.125,
    titre: 'Coupée en deux',
    sousTitre: 'dernier quartier',
    histoire: 'La Lune est sur le chemin du retour. On ne voit plus que la moitié de sa moitié éclairée : ' +
      'on dirait qu’elle est coupée en deux ! Chaque soir, elle va rapetisser encore, ' +
      'jusqu’à disparaître… et tout recommencera.',
    oral: 'Trois semaines après la nouvelle lune, la Lune est sur le chemin du retour. ' +
      'On ne voit plus que la moitié de sa moitié éclairée : ' +
      'on dirait qu’elle est coupée en deux ! Chaque soir, elle va rapetisser encore, ' +
      'jusqu’à disparaître… et tout recommencera.'
  }
];

/* Le jeu « Attrape la bonne Lune » : l'enfant doit amener la Lune sur la
 * phase demandée en la faisant tourner sur son orbite. */
export var DEFIS = [
  { cible: 'croissant-1', emoji: '🌒', nom: 'un premier croissant' },
  { cible: 'quartier-1', emoji: '🌓', nom: 'un premier quartier' },
  { cible: 'pleine', emoji: '🌕', nom: 'une pleine lune' },
  { cible: 'croissant-2', emoji: '🌘', nom: 'un dernier croissant' }
];

export function defiReussi(cible, jour) {
  return phaseInfo(jour).cle === cible;
}

/* Il faut RESTER un instant sur la bonne forme : un grand coup de glisser qui
 * traverse la fenêtre ne gagne pas « en passant ». Plus long que chez
 * ou-va-le-soleil (350 ms) : les fenêtres de phases sont larges (le croissant
 * couvre ~15 % de l'orbite), un tour tranquille les traverse en ~500 ms. */
export var DEFI_ATTENTE_MS = 650;

/* Hystérésis de sortie (acquis d'ou-va-le-soleil, désormais dans la charte de
 * la famille) : une fois le bravo gagné, il ne se range que si la Lune quitte
 * FRANCHEMENT la forme — au bord de la fenêtre, un frémissement du doigt ne
 * doit pas le faire clignoter. La marge s'exprime en jours d'orbite autour de
 * la fenêtre de la phase. */
export var DEFI_SORTIE_JOURS = 1.25;

export function defiEncoreTenu(cible, jour) {
  /* Les fenêtres de phases sont des arcs continus de plusieurs jours : un
   * balayage au quart de jour autour de la position suffit à savoir si l'on
   * est encore dans la fenêtre élargie. */
  for (var d = -DEFI_SORTIE_JOURS; d <= DEFI_SORTIE_JOURS + 1e-9; d += 0.25) {
    if (defiReussi(cible, jour + d)) return true;
  }
  return false;
}

/* La consigne et le bravo d'un défi — pour l'écran et pour le conteur. */
export function consigneDefi(defi) {
  return 'Fabrique ' + defi.nom + ' !';
}

export function bravoDefi(defi) {
  return 'Bravo ! Tu as fabriqué ' + defi.nom + ' !';
}
