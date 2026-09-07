/* Les pictogrammes de Lune : `node test/icone.test.mjs`. */
import assert from 'node:assert/strict';
import { CYCLE_JOURS, JOUR_DEPART, formeLune } from '../js/model.js';
import { FRACTION_ICONE_MIN, jourPourFraction, formeIcone, formeIconeDefi, svgLune } from '../js/icone-lune.js';

var n = 0;
function test(nom, fn) { fn(); n++; console.log('  ✓ ' + nom); }
var presque = function (a, b, eps) { assert.ok(Math.abs(a - b) < (eps || 1e-9), a + ' ≠ ' + b); };

test('jourPourFraction inverse la fraction éclairée du modèle, des deux côtés', function () {
  [0.05, 0.2, 0.5, 0.8].forEach(function (f) {
    var d = formeLune(jourPourFraction(f, 'droite'));
    presque(d.fraction, f); assert.equal(d.cote, 'droite');
    var g = formeLune(jourPourFraction(f, 'gauche'));
    presque(g.fraction, f); assert.equal(g.cote, 'gauche');
  });
});

test('un croissant d’icône est porté à 20 %, du bon côté', function () {
  var depart = formeIcone(JOUR_DEPART);            /* soir 2,5 : 7 % à droite */
  presque(depart.fraction, FRACTION_ICONE_MIN);
  assert.equal(depart.cote, 'droite');
  var fin = formeIcone(CYCLE_JOURS - 3);           /* dernier croissant, à gauche */
  presque(fin.fraction, FRACTION_ICONE_MIN);
  assert.equal(fin.cote, 'gauche');
});

test('quartiers, pleine et nouvelle gardent la forme exacte du modèle', function () {
  [0, CYCLE_JOURS / 4, CYCLE_JOURS / 2, (3 * CYCLE_JOURS) / 4].forEach(function (j) {
    assert.deepEqual(formeIcone(j), formeLune(j));
  });
});

test('les six cibles du jeu ont chacune leur forme', function () {
  presque(formeIconeDefi('nouvelle').fraction, 0);
  presque(formeIconeDefi('pleine').fraction, 1);
  presque(formeIconeDefi('quartier-1').fraction, 0.5);
  assert.equal(formeIconeDefi('quartier-1').cote, 'droite');
  assert.equal(formeIconeDefi('quartier-2').cote, 'gauche');
  presque(formeIconeDefi('croissant-2').fraction, FRACTION_ICONE_MIN);
  assert.equal(formeIconeDefi('croissant-2').cote, 'gauche');
});

test('le SVG : pleine = disque plein, nouvelle = disque sombre seul', function () {
  assert.match(svgLune(formeIconeDefi('pleine')), /<circle r="1" fill="#ebe5d2"\/>/);
  assert.doesNotMatch(svgLune(formeIconeDefi('nouvelle')), /#ebe5d2/);
});

test('le SVG : le terminateur bombe vers le côté éclairé pour un croissant, vers l’ombre pour une gibbeuse', function () {
  /* croissant droit : limbe par la droite (sweep 1), terminateur vers la droite (sweep 0) */
  assert.match(svgLune(formeIconeDefi('croissant-1')), /A 1 1 0 0 1 0 1 A 0\.600 1 0 0 0 0 -1/);
  /* croissant gauche : limbe par la gauche (sweep 0), terminateur vers la gauche (sweep 1) */
  assert.match(svgLune(formeIconeDefi('croissant-2')), /A 1 1 0 0 0 0 1 A 0\.600 1 0 0 1 0 -1/);
  /* gibbeuse droite (80 %) : limbe par la droite, terminateur vers la gauche */
  assert.match(svgLune(formeLune(jourPourFraction(0.8, 'droite'))), /A 1 1 0 0 1 0 1 A 0\.600 1 0 0 1 0 -1/);
});

test('aucun emoji dans le SVG, et il est masqué aux lecteurs d’écran', function () {
  var s = svgLune(formeIcone(10));
  assert.doesNotMatch(s, /[\u{1F000}-\u{1FAFF}]/u);
  assert.match(s, /aria-hidden="true"/);
});

console.log('\n' + n + ' tests, tout est vert.');
