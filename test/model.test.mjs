/*
 * Tests du modèle pur — `node test/model.test.mjs`.
 * Les « vérités à préserver » de l'épisode sont le contrat : ces tests ne se
 * suppriment pas, ils se complètent.
 */
import { strict as assert } from 'node:assert';
import {
  TAU, CYCLE_JOURS, JOUR_PLEINE, SOLEIL_DIR, EPS,
  jourNormalise, angleOrbite, positionLune, directionEclairee,
  fractionEclairee, luneCroissante, coteEclaire, formeLune,
  ORDRE_PHASES, phaseInfo, phraseDuSoir, phraseDuSoirParties,
  SCENARIOS, DEFIS, creerPiocheDefis, defiReussi, defiEncoreTenu, DEFI_SORTIE_JOURS,
  JOUR_DEPART, consigneDefi, bravoDefi, LECTURE_SECONDES_PAR_CYCLE,
  DEFI_ATTENTE_MS
} from '../js/model.js';

var tests = [];
function test(nom, fn) { tests.push({ nom: nom, fn: fn }); }
function presque(a, b, tol) { assert.ok(Math.abs(a - b) <= (tol || 1e-9), a + ' ≉ ' + b); }

/* ------------------------------------------------------------------ */
/* Vérité n° 1 — la moitié éclairée fait toujours face au Soleil       */
/* ------------------------------------------------------------------ */

test('la moitié éclairée de la Lune fait toujours face au Soleil, où qu’elle soit', function () {
  for (var j = 0; j <= CYCLE_JOURS; j += 0.25) {
    var d = directionEclairee(j);
    assert.equal(d.x, SOLEIL_DIR.x);
    assert.equal(d.y, SOLEIL_DIR.y);
  }
});

test('le Soleil est l’objet-repère : sa direction ne bouge jamais', function () {
  assert.equal(SOLEIL_DIR.x, -1);
  assert.equal(SOLEIL_DIR.y, 0);
});

/* ------------------------------------------------------------------ */
/* Vérité n° 2 — nouvelle lune côté Soleil, pleine lune à l'opposé     */
/* ------------------------------------------------------------------ */

test('jour 0 : la Lune est entre la Terre et le Soleil → nouvelle lune, invisible', function () {
  var p = positionLune(0);
  presque(p.x, SOLEIL_DIR.x);
  presque(p.y, SOLEIL_DIR.y);
  presque(fractionEclairee(0), 0);
  assert.equal(phaseInfo(0).cle, 'nouvelle');
});

test('à mi-cycle : la Terre est entre le Soleil et la Lune → pleine lune, toute ronde', function () {
  var p = positionLune(JOUR_PLEINE);
  presque(p.x, -SOLEIL_DIR.x);
  presque(p.y, -SOLEIL_DIR.y);
  presque(fractionEclairee(JOUR_PLEINE), 1);
  assert.equal(phaseInfo(JOUR_PLEINE).cle, 'pleine');
});

/* ------------------------------------------------------------------ */
/* Vérité n° 3 — l'ordre des phases ne s'inverse jamais                */
/* ------------------------------------------------------------------ */

test('sur tout le mois, les phases se suivent toujours dans le même ordre', function () {
  var precedente = phaseInfo(0).cle;
  assert.equal(precedente, 'nouvelle');
  for (var j = 0; j <= CYCLE_JOURS + 1; j += 0.02) {
    var cle = phaseInfo(j).cle;
    if (cle !== precedente) {
      var attendu = ORDRE_PHASES[(ORDRE_PHASES.indexOf(precedente) + 1) % ORDRE_PHASES.length];
      assert.equal(cle, attendu,
        'au jour ' + j.toFixed(2) + ' : ' + precedente + ' → ' + cle + ' (attendu : ' + attendu + ')');
      precedente = cle;
    }
  }
});

test('la Lune grossit jusqu’à la pleine lune, puis rapetisse jusqu’à la nouvelle', function () {
  var pas = 0.05;
  for (var j = 0; j < JOUR_PLEINE - pas; j += pas) {
    assert.ok(fractionEclairee(j + pas) > fractionEclairee(j), 'devrait grossir au jour ' + j.toFixed(2));
  }
  for (var k = JOUR_PLEINE; k < CYCLE_JOURS - pas; k += pas) {
    assert.ok(fractionEclairee(k + pas) < fractionEclairee(k), 'devrait rapetisser au jour ' + k.toFixed(2));
  }
});

/* ------------------------------------------------------------------ */
/* Vérité n° 4 — le tour complet dure environ un mois                  */
/* ------------------------------------------------------------------ */

test('le cycle affiché dure 29,5 jours, et le jour 29,5 recommence comme le jour 0', function () {
  assert.equal(CYCLE_JOURS, 29.5);
  presque(jourNormalise(CYCLE_JOURS), 0);
  assert.equal(phaseInfo(CYCLE_JOURS).cle, phaseInfo(0).cle);
  presque(fractionEclairee(CYCLE_JOURS), fractionEclairee(0));
});

test('jourNormalise ramène toujours dans [0, 29,5[', function () {
  presque(jourNormalise(-3), CYCLE_JOURS - 3);
  presque(jourNormalise(32), 32 - CYCLE_JOURS);
  presque(jourNormalise(0), 0);
});

/* ------------------------------------------------------------------ */
/* Le côté éclairé vu de chez nous (hémisphère nord)                   */
/* ------------------------------------------------------------------ */

test('quand la Lune grossit, son côté droit est éclairé ; quand elle rapetisse, son côté gauche', function () {
  [3, 7, 10, 13].forEach(function (j) {
    assert.ok(luneCroissante(j), 'jour ' + j + ' devrait être croissant');
    assert.equal(coteEclaire(j), 'droite');
  });
  [16, 20, 24, 28].forEach(function (j) {
    assert.ok(!luneCroissante(j), 'jour ' + j + ' devrait être décroissant');
    assert.equal(coteEclaire(j), 'gauche');
  });
});

test('la forme du disque : croissant fin, quartier droit, gibbeuse bombée', function () {
  /* Premier croissant : terminateur bombé vers la droite (côté éclairé). */
  var croissant = formeLune(2.5);
  assert.equal(croissant.cote, 'droite');
  assert.ok(croissant.k > 0.5, 'croissant fin : |k| grand, ici ' + croissant.k);
  /* Premier quartier : terminateur presque droit. */
  var quartier = formeLune(JOUR_PLEINE / 2);
  presque(quartier.fraction, 0.5, 1e-9);
  presque(quartier.k, 0, 1e-9);
  /* Gibbeuse décroissante (côté gauche éclairé) : bombée vers la droite (le côté sombre). */
  var gibbeuse = formeLune(18);
  assert.equal(gibbeuse.cote, 'gauche');
  assert.ok(gibbeuse.fraction > 0.6 && gibbeuse.k > 0, 'gibbeuse bombée vers le côté sombre');
});

/* ------------------------------------------------------------------ */
/* Les scénarios et le conteur                                         */
/* ------------------------------------------------------------------ */

test('chaque scénario tombe bien sur sa phase', function () {
  var attendus = { nouvelle: 'nouvelle', croissant: 'croissant-1', pleine: 'pleine', quartier: 'quartier-2' };
  SCENARIOS.forEach(function (s) {
    assert.equal(phaseInfo(s.jour).cle, attendus[s.id], 'scénario ' + s.id);
  });
});

test('chaque scénario raconte le même instant deux fois : dans le ciel, puis depuis l’espace', function () {
  SCENARIOS.forEach(function (s) {
    assert.ok(s.ciel && s.ciel.length > 20, 'ligne « ciel » manquante : ' + s.id);
    assert.ok(s.espace && s.espace.length > 20, 'ligne « espace » manquante : ' + s.id);
  });
});

test('les textes du conteur sont prêts pour l’oral : pas d’émoji, ponctuation propre', function () {
  var emojis = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
  SCENARIOS.forEach(function (s) {
    assert.ok(!emojis.test(s.oral), 'émoji dans l’oral de ' + s.id);
    assert.ok(/[.!?…]$/.test(s.oral), 'l’oral de ' + s.id + ' doit finir par une ponctuation');
    assert.ok(!/\s[.,!?]/.test(s.oral.replace(/\s[!?]/g, '')), 'espace orpheline avant un point dans ' + s.id);
    assert.ok(s.oral.indexOf('’') !== -1 || s.oral.indexOf('‘') === -1, 'apostrophe typographique attendue');
  });
});

test('la phrase du soir raconte le bon moment', function () {
  assert.ok(phraseDuSoir(0).indexOf('nouvelle lune') !== -1);
  assert.ok(phraseDuSoir(0).indexOf('On ne la voit pas') !== -1);
  assert.ok(phraseDuSoir(JOUR_PLEINE).indexOf('pleine lune') !== -1);
  assert.ok(phraseDuSoir(7).indexOf('grossit') !== -1);
  assert.ok(phraseDuSoir(22).indexOf('rapetisse') !== -1);
  assert.ok(/[.!?]$/.test(phraseDuSoir(9)), 'la phrase du soir finit par une ponctuation');
});

test('la phrase du soir se coupe toujours au même endroit (deux lignes fixes à l’écran)', function () {
  for (var j = 0; j < CYCLE_JOURS; j += 0.5) {
    var p = phraseDuSoirParties(j);
    assert.ok(/^Soir \d+ — .+\.$/.test(p.soir), 'le soir et sa phase, ponctués : ' + p.soir);
    assert.ok(p.suite.length > 0 && /[.!?]$/.test(p.suite), 'la suite est une phrase : ' + p.suite);
    assert.ok(p.soir.indexOf('\n') === -1 && p.suite.indexOf('\n') === -1, 'pas de retour à la ligne caché');
    assert.equal(p.soir + ' ' + p.suite, phraseDuSoir(j), 'la phrase entière est la réunion des deux');
  }
});

/* ------------------------------------------------------------------ */
/* Le jeu « Attrape la bonne Lune »                                    */
/* ------------------------------------------------------------------ */

test('les défis du jeu visent des phases toutes différentes et atteignables', function () {
  var vues = {};
  DEFIS.forEach(function (d) {
    assert.ok(!vues[d.cible], 'défi en double : ' + d.cible);
    vues[d.cible] = true;
    assert.ok(ORDRE_PHASES.indexOf(d.cible) !== -1, 'phase inconnue : ' + d.cible);
    /* Chaque défi est atteignable : au moins un jour du mois le réussit. */
    var atteignable = false;
    for (var j = 0; j < CYCLE_JOURS; j += 0.05) {
      if (defiReussi(d.cible, j)) { atteignable = true; break; }
    }
    assert.ok(atteignable, 'défi inatteignable : ' + d.cible);
  });
});

test('un défi réussit sur sa phase et échoue ailleurs', function () {
  assert.ok(defiReussi('pleine', JOUR_PLEINE));
  assert.ok(!defiReussi('pleine', 3));
  assert.ok(defiReussi('croissant-1', 2.5));
  assert.ok(!defiReussi('croissant-1', 27));
  assert.ok(defiReussi('croissant-2', 27));
});

test('la page démarre sur un premier croissant : une Lune visible dès l’arrivée', function () {
  var info = phaseInfo(JOUR_DEPART);
  assert.equal(info.cle, 'croissant-1');
  assert.ok(fractionEclairee(JOUR_DEPART) > 0.04, 'la Lune du départ doit se voir');
});

test('la lecture auto fait un tour complet à une allure d’enfant (ni film, ni escargot)', function () {
  assert.ok(LECTURE_SECONDES_PAR_CYCLE >= 45, 'trop rapide : les phases défileraient comme un film');
  assert.ok(LECTURE_SECONDES_PAR_CYCLE <= 180, 'trop lente : on croirait la Lune arrêtée');
});

test('gagner demande de s’arrêter : la temporisation existe et reste vive', function () {
  /* Assez longue pour qu'un tour continu ne gagne pas en passant, assez
   * courte pour qu'un vrai arrêt semble instantané. */
  assert.ok(DEFI_ATTENTE_MS >= 400, 'trop courte : un tour la traverserait');
  assert.ok(DEFI_ATTENTE_MS <= 1200, 'trop longue : l’arrêt semblerait ignoré');
});

test('le bravo ne clignote pas au bord de la fenêtre : l’hystérésis de sortie tient', function () {
  /* Acquis de la famille (payé sur ou-va-le-soleil) : la fenêtre où le bravo
   * se range est PLUS LARGE que celle où il se gagne. Pour chaque défi : tout
   * jour gagnant est encore « tenu » ; juste au bord de la fenêtre (moins
   * d'une demi-marge dehors), toujours tenu ; loin dehors, plus tenu. */
  assert.ok(DEFI_SORTIE_JOURS > 0.5, 'marge de sortie trop mince pour amortir le bord');
  DEFIS.forEach(function (d) {
    var dedans = [];
    for (var j = 0; j < CYCLE_JOURS; j += 0.05) {
      if (defiReussi(d.cible, j)) dedans.push(j);
    }
    dedans.forEach(function (j) {
      assert.ok(defiEncoreTenu(d.cible, j), 'gagné mais pas tenu : ' + d.cible + ' au jour ' + j);
    });
    var bordBas = dedans[0];
    var bordHaut = dedans[dedans.length - 1];
    assert.ok(defiEncoreTenu(d.cible, bordBas - DEFI_SORTIE_JOURS / 2),
      'le bravo clignoterait juste sous la fenêtre : ' + d.cible);
    assert.ok(defiEncoreTenu(d.cible, bordHaut + DEFI_SORTIE_JOURS / 2),
      'le bravo clignoterait juste au-dessus de la fenêtre : ' + d.cible);
  });
  /* Loin de la fenêtre, le bravo se range vraiment : à la nouvelle lune, ni
   * la pleine ni les quartiers ne sont « encore tenus ». */
  assert.ok(!defiEncoreTenu('pleine', 5), 'tenu bien trop loin de la pleine lune');
  assert.ok(!defiEncoreTenu('quartier-1', 20), 'tenu bien trop loin du premier quartier');
});

test('la consigne et le bravo du défi nomment la forme (ou la Lune), sans émoji', function () {
  DEFIS.forEach(function (d) {
    var consigne = consigneDefi(d);
    var bravo = bravoDefi(d);
    /* Un défi à mots propres (la nouvelle lune) parle de « la Lune » ;
     * les autres suivent le patron et nomment la forme. */
    function nomme(texte) {
      return texte.indexOf(d.nom) !== -1 || texte.indexOf('la Lune') !== -1;
    }
    assert.ok(nomme(consigne), 'consigne muette sur : ' + d.nom);
    assert.ok(nomme(bravo), 'bravo muet sur : ' + d.nom);
    assert.ok(/!$/.test(consigne), 'la consigne ne s’exclame pas : ' + consigne);
    assert.ok(bravo.indexOf('Bravo') === 0, 'le bravo ne félicite pas : ' + bravo);
    assert.ok(!/[\u{1F000}-\u{1FAFF}]/u.test(consigne + bravo), 'émoji dans les textes du défi');
  });
});

test('le jeu propose toutes les formes nommables — nouvelle lune et dernier quartier compris', function () {
  var cibles = DEFIS.map(function (d) { return d.cible; });
  assert.ok(cibles.indexOf('nouvelle') !== -1, 'la nouvelle lune manque au jeu');
  assert.ok(cibles.indexOf('quartier-2') !== -1, 'le dernier quartier manque au jeu');
  /* Les gibbeuses restent hors du jeu : mot savant, note aux parents. */
  assert.ok(cibles.indexOf('gibbeuse-1') === -1, 'gibbeuse-1 : jargon dans le jeu');
  assert.ok(cibles.indexOf('gibbeuse-2') === -1, 'gibbeuse-2 : jargon dans le jeu');
});

/* Un générateur déterministe (LCG de Park-Miller) pour tester la pioche. */
function fauxAlea(graine) {
  var g = graine;
  return function () {
    g = (g * 16807) % 2147483647;
    return (g - 1) / 2147483646;
  };
}

test('la pioche vide un sac complet avant toute répétition : chaque forme sort une fois par tournée', function () {
  var piocher = creerPiocheDefis(fauxAlea(42));
  for (var tournee = 0; tournee < 30; tournee++) {
    var vues = {};
    for (var i = 0; i < DEFIS.length; i++) {
      var d = piocher();
      assert.ok(!vues[d.cible], 'répétition dans la tournée ' + tournee + ' : ' + d.cible);
      vues[d.cible] = true;
    }
  }
});

test('la pioche ne redonne jamais deux fois de suite la même forme, même entre deux sacs', function () {
  for (var graine = 1; graine <= 10; graine++) {
    var piocher = creerPiocheDefis(fauxAlea(graine));
    var precedent = null;
    for (var i = 0; i < 20 * DEFIS.length; i++) {
      var d = piocher();
      assert.ok(precedent === null || d.cible !== precedent.cible,
        'deux fois de suite (graine ' + graine + ') : ' + d.cible);
      precedent = d;
    }
  }
});

/* ------------------------------------------------------------------ */

var rates = 0;
tests.forEach(function (t) {
  try {
    t.fn();
    console.log('  ✓ ' + t.nom);
  } catch (e) {
    rates += 1;
    console.error('  ✗ ' + t.nom);
    console.error('    ' + (e && e.message ? e.message : e));
  }
});
console.log('');
console.log(rates === 0
  ? tests.length + ' tests, tout est vert.'
  : rates + ' test(s) en échec sur ' + tests.length + '.');
if (rates > 0) process.exit(1);
