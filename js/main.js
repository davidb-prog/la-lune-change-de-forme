/*
 * Le câblage de la page : boucle de rendu résiliente, geste-signature
 * (attraper la Lune), curseur maître, scénarios, conteur et jeu.
 * Toute la connaissance du phénomène vit dans js/model.js — ici on ne fait
 * que brancher.
 */
import {
  CYCLE_JOURS, JOUR_DEPART, jourNormalise, phraseDuSoir,
  SCENARIOS, DEFIS, defiReussi, consigneDefi, bravoDefi, DEFI_ATTENTE_MS
} from './model.js';
import { creerVueOrbite } from './vue-orbite.js';
import { creerVueHublot } from './vue-hublot.js';

/* ------------------------------------------------------------------ */
/* L'état                                                              */
/* ------------------------------------------------------------------ */

var etat = {
  jour: 0,
  animation: null,      /* { depart, delta, t0, duree } — toujours vers l'avant */
  scenarioActif: null,  /* id du scénario affiché, ou null */
  defi: null,           /* le défi du jeu en cours, ou null */
  defiGagne: false,
  bravoVisible: false,  /* le bravo s'efface quand on repart tourner la Lune */
  defiEntreMs: null,    /* entrée dans la fenêtre (anti « gagné en passant ») */
  glisse: false
};

var mouvementReduit = false;
if (window.matchMedia) {
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mouvementReduit = !!mq.matches;
  if (mq.addEventListener) mq.addEventListener('change', function (e) { mouvementReduit = !!e.matches; });
}

/* Petit écran ? (même seuil que la grille CSS : 880 px) */
var estMobile = false;
if (window.matchMedia) {
  var mqMobile = window.matchMedia('(max-width: 879px)');
  estMobile = !!mqMobile.matches;
  if (mqMobile.addEventListener) mqMobile.addEventListener('change', function (e) { estMobile = !!e.matches; });
}

/* ------------------------------------------------------------------ */
/* Les éléments                                                        */
/* ------------------------------------------------------------------ */

var canvasOrbite = document.getElementById('canvas-orbite');
var canvasHublot = document.getElementById('canvas-hublot');
var curseur = document.getElementById('curseur-jours');
var phraseSoir = document.getElementById('phrase-soir');
var grilleScenarios = document.getElementById('grille-scenarios');
var histoireScenario = document.getElementById('histoire-scenario');
var boutonSonScenarios = document.getElementById('bouton-son-scenarios');
var boutonEcouter = document.getElementById('bouton-ecouter');
var menuVoix = document.getElementById('menu-voix');
var conseilVoix = document.getElementById('conseil-voix');
var texteExplication = document.getElementById('texte-explication');
var boutonJouer = document.getElementById('bouton-jouer');
var medaillon = document.getElementById('medaillon-lune');
var canvasMedaillon = document.getElementById('canvas-medaillon');
var zoneJeu = document.getElementById('zone-jeu');
var defiJeu = document.getElementById('defi-jeu');
var bravoJeu = document.getElementById('bravo-jeu');
var boutonEncore = document.getElementById('bouton-encore');

var canvasOrbiteJeu = document.getElementById('canvas-orbite-jeu');
var canvasHublotJeu = document.getElementById('canvas-hublot-jeu');

var vueOrbite = creerVueOrbite(canvasOrbite);
var vueHublot = creerVueHublot(canvasHublot);
/* Les mêmes vues, en petit, sous le jeu — synchronisées sur le même jour. */
var vueOrbiteJeu = creerVueOrbite(canvasOrbiteJeu);
var vueHublotJeu = creerVueHublot(canvasHublotJeu);
/* Le médaillon est un mini hublot (ciel, Lune, jardin) : une fenêtre sur le
 * soir, impossible à confondre avec la Lune attrapable de la vue de l'espace. */
var vueMedaillon = creerVueHublot(canvasMedaillon);

/* ------------------------------------------------------------------ */
/* Changer de jour                                                     */
/* ------------------------------------------------------------------ */

function fixerJour(jour) {
  etat.jour = jourNormalise(jour);
  curseur.value = String(etat.jour);
  phraseSoir.textContent = phraseDuSoir(etat.jour);
}

/* L'utilisateur reprend la main : l'histoire affichée s'efface. */
function reprendreLaMain() {
  etat.animation = null;
  if (etat.scenarioActif !== null) {
    etat.scenarioActif = null;
    histoireScenario.hidden = true;
    histoireScenario.textContent = '';
    rafraichirBoutonsScenarios();
    narrateur.stop();
  }
}

/* Aller à un jour-cible EN AVANT (le vrai sens de l'orbite), en douceur. */
function allerAuJour(cible, immediat) {
  var arrivee = jourNormalise(cible);
  if (immediat || mouvementReduit) {
    etat.animation = null;
    fixerJour(arrivee);
    return;
  }
  var delta = jourNormalise(arrivee - etat.jour);
  if (delta < 0.01) delta += CYCLE_JOURS; /* déjà dessus : refaire un tour, c'est plus joli */
  etat.animation = {
    depart: etat.jour,
    delta: delta,
    t0: null,
    duree: 900 + 55 * delta
  };
}

/* ------------------------------------------------------------------ */
/* La boucle de rendu (résiliente : un raté ne tue jamais l'animation)  */
/* ------------------------------------------------------------------ */

function ajusterCanvas(canvas) {
  var rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return;
  var dpr = window.devicePixelRatio || 1;
  var w = Math.round(rect.width * dpr);
  var h = Math.round(rect.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function adoucir(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function boucle(maintenant) {
  try {
    if (etat.animation) {
      var a = etat.animation;
      if (a.t0 === null) a.t0 = maintenant;
      var p = Math.min(1, (maintenant - a.t0) / a.duree);
      fixerJour(a.depart + a.delta * adoucir(p));
      if (p >= 1) etat.animation = null;
    }
    ajusterCanvas(canvasOrbite);
    ajusterCanvas(canvasHublot);
    var halo = etat.glisse ? 1 : (mouvementReduit ? 0.4 : 0.4 + 0.35 * Math.sin(maintenant / 550));
    vueOrbite.rendre(etat.jour, halo);
    vueHublot.rendre(etat.jour);
    if (!zoneJeu.hidden) {
      ajusterCanvas(canvasOrbiteJeu);
      /* Sur mobile, le jeu n'a qu'une vue (le mini hublot est masqué par la
       * feuille de style) : c'est le médaillon flottant qui montre le soir. */
      vueOrbiteJeu.rendre(etat.jour, halo);
      if (canvasHublotJeu.offsetWidth > 0) {
        ajusterCanvas(canvasHublotJeu);
        vueHublotJeu.rendre(etat.jour);
      }
    }
    gererMedaillon();
    surveillerDefi(maintenant);
  } finally {
    window.requestAnimationFrame(boucle);
  }
}

/* ------------------------------------------------------------------ */
/* Le médaillon flottant (mobile) : la Lune du soir, toujours visible   */
/* ------------------------------------------------------------------ */

var carteHublot = document.querySelector('.carte-hublot');

/* La carte entière est-elle sortie de l'écran ? (Pas seulement le canvas :
 * tant que la phrase du soir se lit encore, le médaillon la recouvrirait.) */
function carteHorsEcran(element) {
  var rect = element.getBoundingClientRect();
  var hauteur = window.innerHeight || document.documentElement.clientHeight;
  return rect.bottom < 0 || rect.top > hauteur;
}

function gererMedaillon() {
  /* Dès que le hublot sort de l'écran, la Lune du soir suit l'enfant —
   * y compris pendant le jeu : c'est elle qui montre le résultat. */
  var visible = estMobile && carteHorsEcran(carteHublot);
  medaillon.hidden = !visible;
  if (!visible) return;
  ajusterCanvas(canvasMedaillon);
  vueMedaillon.rendre(etat.jour);
}

/* Un tap sur le médaillon remonte à la vue du jardin — sauf pendant le jeu,
 * où il sert d'afficheur de résultat : remonter sortirait l'enfant du jeu. */
medaillon.addEventListener('click', function () {
  if (!zoneJeu.hidden) return;
  try {
    canvasHublot.scrollIntoView({ behavior: mouvementReduit ? 'auto' : 'smooth', block: 'center' });
  } catch (e) {
    canvasHublot.scrollIntoView(true);
  }
});

/* ------------------------------------------------------------------ */
/* Le geste-signature : attraper la Lune                                */
/* ------------------------------------------------------------------ */

/* Les écouteurs tactiles doivent être non passifs pour pouvoir bloquer le
 * défilement (détection du support des options d'addEventListener). */
var supporteEcouteurPassif = false;
try {
  var optionsTest = Object.defineProperty({}, 'passive', {
    get: function () { supporteEcouteurPassif = true; return false; }
  });
  window.addEventListener('test-passif', null, optionsTest);
  window.removeEventListener('test-passif', null, optionsTest);
} catch (e) { /* vieux navigateur : les options sont un booléen */ }

/* Toucher un canvas ne doit JAMAIS faire défiler ni zoomer la page : le CSS
 * pose touch-action: none, mais les vieux mobiles et certaines WebViews
 * l'ignorent — on bloque aussi le geste à la main. */
function bloquerDefilementTactile(canvas) {
  function bloquer(e) { e.preventDefault(); }
  var options = supporteEcouteurPassif ? { passive: false } : false;
  canvas.addEventListener('touchstart', bloquer, options);
  canvas.addEventListener('touchmove', bloquer, options);
}

function coordonneesCanvas(canvas, e) {
  var rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function brancherGesteLune(canvas, vue) {
  bloquerDefilementTactile(canvas);

  canvas.addEventListener('pointerdown', function (e) {
    var c = coordonneesCanvas(canvas, e);
    if (!vue.attrapeLune(c.x, c.y, etat.jour)) return;
    etat.glisse = true;
    reprendreLaMain();
    canvas.classList.add('attrape');
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!etat.glisse) return;
    var c = coordonneesCanvas(canvas, e);
    fixerJour(vue.jourDepuisPointeur(c.x, c.y));
    e.preventDefault();
  });

  function lacherLaLune() {
    etat.glisse = false;
    canvas.classList.remove('attrape');
  }

  canvas.addEventListener('pointerup', lacherLaLune);
  canvas.addEventListener('pointercancel', lacherLaLune);
}

brancherGesteLune(canvasOrbite, vueOrbite);
brancherGesteLune(canvasOrbiteJeu, vueOrbiteJeu);

/* ------------------------------------------------------------------ */
/* Le curseur maître                                                    */
/* ------------------------------------------------------------------ */

curseur.addEventListener('input', function () {
  reprendreLaMain();
  fixerJour(parseFloat(curseur.value));
});

/* ------------------------------------------------------------------ */
/* Les scénarios                                                        */
/* ------------------------------------------------------------------ */

var boutonsScenarios = [];

/* Sur mobile, le voyage de la Lune se joue hors écran quand on tape une
 * vignette : on remonte doucement à la vue de l'espace pour le regarder —
 * le bandeau du jardin, juste au-dessus, montre l'effet en même temps.
 * (Sur grand écran les deux vues sont déjà sous les yeux : on ne bouge pas.) */
function montrerLeVoyage() {
  if (!estMobile) return;
  try {
    canvasOrbite.scrollIntoView({ behavior: mouvementReduit ? 'auto' : 'smooth', block: 'center' });
  } catch (e) {
    canvasOrbite.scrollIntoView(true);
  }
}

function rafraichirBoutonsScenarios() {
  boutonsScenarios.forEach(function (b) {
    b.el.setAttribute('aria-pressed', etat.scenarioActif === b.id ? 'true' : 'false');
  });
}

SCENARIOS.forEach(function (s) {
  var bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'bouton-scenario';
  bouton.setAttribute('aria-pressed', 'false');
  bouton.innerHTML = '<span class="emoji">' + s.emoji + '</span>' +
    '<span class="titre"></span><span class="sous"></span>';
  bouton.querySelector('.titre').textContent = s.titre;
  bouton.querySelector('.sous').textContent = s.sousTitre;
  bouton.addEventListener('click', function () {
    etat.scenarioActif = s.id;
    rafraichirBoutonsScenarios();
    allerAuJour(s.jour, false);
    histoireScenario.hidden = false;
    histoireScenario.textContent = s.histoire;
    if (sonScenariosActif) narrateur.raconter(s.oral);
    montrerLeVoyage();
  });
  grilleScenarios.appendChild(bouton);
  boutonsScenarios.push({ id: s.id, el: bouton });
});

/* ------------------------------------------------------------------ */
/* Le conteur                                                           */
/* ------------------------------------------------------------------ */

var synthesePossible = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
var CLE_SON = 'petit-labo-lune-son';
var CLE_VOIX = 'petit-labo-lune-voix';
var sonScenariosActif = false;

/* Retire les émojis (imprononçables) et recolle l'espace orpheline. */
function pourOral(texte) {
  var sansEmoji = texte.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '');
  return sansEmoji.replace(/\s+([.,…])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

/* Découpe un texte en phrases (les moteurs coupent les longs blocs). */
function phrasesDe(texte) {
  var morceaux = [];
  var re = /[^.!?…]+[.!?…]+/g;
  var dernierIndex = 0;
  var m = re.exec(texte);
  while (m) {
    var phrase = m[0].trim();
    if (phrase) morceaux.push({ texte: phrase, finDeParagraphe: false });
    dernierIndex = re.lastIndex;
    m = re.exec(texte);
  }
  var reste = texte.slice(dernierIndex).trim();
  if (reste) morceaux.push({ texte: reste, finDeParagraphe: false });
  if (morceaux.length) morceaux[morceaux.length - 1].finDeParagraphe = true;
  return morceaux;
}

var narrateur = (function () {
  if (!synthesePossible) {
    return { parler: function () {}, raconter: function () {}, stop: function () {} };
  }

  var synthese = window.speechSynthesis;
  var generation = 0;
  var finPrecedente = null;
  var voixChoisie = null;

  function scoreVoix(v) {
    var lang = (v.lang || '').replace('_', '-').toLowerCase();
    var nom = (v.name || '').toLowerCase();
    var score = 0;
    if (lang.indexOf('fr-fr') === 0) score += 60;
    else if (lang.indexOf('fr-ca') === 0) score += 20 - 30;
    else if (lang.indexOf('fr') === 0) score += 20;
    else return -1000;
    if (/natural|neural|online|premium|enhanced|améliorée|amelioree|siri/.test(nom)) score += 30;
    if (/google/.test(nom)) score += 24;
    if (/amélie|amelie|thomas|audrey|aurélie|aurelie|marie|denise|hortense|julie/.test(nom)) score += 12;
    if (v.localService === false) score += 6;
    if (/espeak|eloquence|compact|robot/.test(nom)) score -= 50;
    if (/albert|bahh|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|bad news|good news/.test(nom)) score -= 40;
    return score;
  }

  function voixFrancaises() {
    var toutes = synthese.getVoices() || [];
    var fr = [];
    for (var i = 0; i < toutes.length; i++) {
      if (scoreVoix(toutes[i]) > -1000) fr.push(toutes[i]);
    }
    fr.sort(function (a, b) { return scoreVoix(b) - scoreVoix(a); });
    return fr;
  }

  function rafraichirVoix() {
    var fr = voixFrancaises();
    if (!fr.length) return;
    var souhait = null;
    try { souhait = window.localStorage.getItem(CLE_VOIX); } catch (e) { /* stockage indisponible */ }
    voixChoisie = fr[0];
    if (souhait) {
      for (var i = 0; i < fr.length; i++) {
        if (fr[i].name === souhait) { voixChoisie = fr[i]; break; }
      }
    }
    /* Le menu de voix, seulement s'il y a le choix. */
    if (fr.length >= 2) {
      menuVoix.hidden = false;
      while (menuVoix.firstChild) menuVoix.removeChild(menuVoix.firstChild);
      fr.forEach(function (v) {
        var opt = document.createElement('option');
        opt.value = v.name;
        opt.textContent = '🗣️ ' + v.name;
        if (voixChoisie && v.name === voixChoisie.name) opt.selected = true;
        menuVoix.appendChild(opt);
      });
    }
    conseilVoix.hidden = scoreVoix(voixChoisie) >= 40;
  }

  if (synthese.addEventListener) synthese.addEventListener('voiceschanged', rafraichirVoix);
  else if ('onvoiceschanged' in synthese) synthese.onvoiceschanged = rafraichirVoix;
  rafraichirVoix();

  menuVoix.addEventListener('change', function () {
    try { window.localStorage.setItem(CLE_VOIX, menuVoix.value); } catch (e) { /* tant pis */ }
    var relire = synthese.speaking && lectureExplication;
    rafraichirVoix();
    if (relire) lireExplication(); /* changement de voix en cours de lecture → on relit */
  });

  function tonDeConteur(u, phrase) {
    u.rate = 0.92;
    u.pitch = 1.04;
    if (phrase.indexOf('…') !== -1) u.rate = 0.87;
    if (/\?\s*$/.test(phrase)) u.pitch = 1.12;
    if (/!\s*$/.test(phrase)) { u.rate = 0.96; u.pitch = 1.14; }
  }

  function parler(morceaux, quandFini) {
    generation += 1;
    var gen = generation;
    if (finPrecedente) { var f = finPrecedente; finPrecedente = null; f(); }
    finPrecedente = quandFini || null;
    synthese.cancel();
    rafraichirVoix(); /* certaines listes de voix arrivent tard */

    function suivant(i) {
      if (gen !== generation) return;
      if (i >= morceaux.length) {
        if (finPrecedente) { var f2 = finPrecedente; finPrecedente = null; f2(); }
        return;
      }
      var u = new window.SpeechSynthesisUtterance(morceaux[i].texte);
      u.lang = 'fr-FR';
      if (voixChoisie) u.voice = voixChoisie;
      tonDeConteur(u, morceaux[i].texte);
      u.onend = function () {
        if (gen !== generation) return;
        var pause = morceaux[i].finDeParagraphe ? 620 : 300;
        window.setTimeout(function () { suivant(i + 1); }, pause);
      };
      u.onerror = u.onend;
      synthese.speak(u);
    }
    suivant(0);
  }

  return {
    parler: parler,
    raconter: function (texte) { parler(phrasesDe(pourOral(texte))); },
    stop: function () {
      generation += 1;
      synthese.cancel();
      if (finPrecedente) { var f = finPrecedente; finPrecedente = null; f(); }
    }
  };
})();

/* « 🔊 Écouter l'histoire » sur la boîte d'explication. */
var lectureExplication = false;

function lireExplication() {
  var paragraphes = texteExplication.querySelectorAll('p');
  var morceaux = [];
  for (var i = 0; i < paragraphes.length; i++) {
    var phrases = phrasesDe(pourOral(paragraphes[i].textContent));
    for (var j = 0; j < phrases.length; j++) morceaux.push(phrases[j]);
  }
  lectureExplication = true;
  boutonEcouter.textContent = '⏹ Arrêter';
  narrateur.parler(morceaux, function () {
    lectureExplication = false;
    boutonEcouter.textContent = '🔊 Écouter l’histoire';
  });
}

if (synthesePossible) {
  boutonEcouter.hidden = false;
  boutonSonScenarios.hidden = false;
  boutonEcouter.addEventListener('click', function () {
    if (lectureExplication) narrateur.stop();
    else lireExplication();
  });

  try { sonScenariosActif = window.localStorage.getItem(CLE_SON) === 'oui'; } catch (e) { /* tant pis */ }

  function rafraichirBoutonSon() {
    boutonSonScenarios.textContent = sonScenariosActif ? '🔊' : '🔇';
    boutonSonScenarios.setAttribute('aria-pressed', sonScenariosActif ? 'true' : 'false');
    boutonSonScenarios.setAttribute('aria-label',
      sonScenariosActif ? 'Couper la version sonore des histoires' : 'Activer la version sonore des histoires');
  }
  rafraichirBoutonSon();

  boutonSonScenarios.addEventListener('click', function () {
    sonScenariosActif = !sonScenariosActif;
    try { window.localStorage.setItem(CLE_SON, sonScenariosActif ? 'oui' : 'non'); } catch (e) { /* tant pis */ }
    rafraichirBoutonSon();
    if (!sonScenariosActif) {
      narrateur.stop();
    } else if (etat.scenarioActif) {
      /* L'activer relit le moment affiché. */
      for (var i = 0; i < SCENARIOS.length; i++) {
        if (SCENARIOS[i].id === etat.scenarioActif) { narrateur.raconter(SCENARIOS[i].oral); break; }
      }
    }
  });

  window.addEventListener('pagehide', function () { window.speechSynthesis.cancel(); });
}

/* ------------------------------------------------------------------ */
/* Le jeu « Attrape la bonne Lune »                                     */
/* ------------------------------------------------------------------ */

function nouveauDefi() {
  var candidats = [];
  for (var i = 0; i < DEFIS.length; i++) {
    if (!etat.defi || DEFIS[i].cible !== etat.defi.cible) candidats.push(DEFIS[i]);
  }
  etat.defi = candidats[Math.floor(Math.random() * candidats.length)];
  etat.defiGagne = false;
  etat.bravoVisible = false;
  etat.defiEntreMs = null;
  defiJeu.textContent = etat.defi.emoji + ' ' + etat.defi.nom + ' !';
  defiJeu.hidden = false;
  bravoJeu.hidden = true;
  boutonEncore.hidden = true;
  /* La version sonore du jeu suit le même bouton 🔇/🔊 que les scénarios. */
  if (sonScenariosActif) narrateur.raconter(consigneDefi(etat.defi));
}

function surveillerDefi(ms) {
  if (!etat.defi) return;
  var dessus = defiReussi(etat.defi.cible, etat.jour);
  /* Le bravo ne ment jamais : il s'efface quand l'enfant repart faire
   * tourner la Lune, et revient s'il refabrique la bonne forme (sans
   * relire la voix). « Encore une ! » reste acquis. */
  if (etat.bravoVisible) {
    if (!dessus) {
      etat.bravoVisible = false;
      etat.defiEntreMs = null;
      bravoJeu.hidden = true;
    }
    return;
  }
  /* On ne gagne qu'en manœuvrant soi-même (pas pendant une animation), et
   * il faut RESTER sur la forme : la traverser d'un grand coup de glisser
   * ne compte pas. */
  if (!dessus || etat.animation) {
    etat.defiEntreMs = null;
    return;
  }
  if (etat.defiEntreMs === null) { etat.defiEntreMs = ms; return; }
  if (ms - etat.defiEntreMs < DEFI_ATTENTE_MS) return;
  etat.bravoVisible = true;
  bravoJeu.hidden = false;
  if (!etat.defiGagne) {
    etat.defiGagne = true;
    bravoJeu.textContent = '⭐ ' + bravoDefi(etat.defi);
    boutonEncore.hidden = false;
    if (sonScenariosActif) narrateur.raconter(bravoDefi(etat.defi));
  }
}

boutonJouer.addEventListener('click', function () {
  var ouvert = !zoneJeu.hidden;
  if (ouvert) {
    zoneJeu.hidden = true;
    etat.defi = null;
    etat.bravoVisible = false;
    etat.defiEntreMs = null;
    boutonJouer.textContent = 'Jouer';
    medaillon.setAttribute('aria-label', 'La Lune de ce soir — remonter à la vue du jardin');
  } else {
    zoneJeu.hidden = false;
    boutonJouer.textContent = 'Ranger le jeu';
    medaillon.setAttribute('aria-label', 'La Lune de ce soir — le résultat de ta manœuvre');
    nouveauDefi();
  }
});

boutonEncore.addEventListener('click', nouveauDefi);

/* ------------------------------------------------------------------ */
/* La boîte d'explication se replie sur mobile (raccourcit la page)     */
/* ------------------------------------------------------------------ */

var pliExplication = document.getElementById('pli-explication');

function synchroniserPliExplication() {
  if (estMobile) return; /* sur mobile, l'enfant plie et déplie librement */
  pliExplication.open = true; /* sur ordinateur, toujours ouverte */
}

if (estMobile) pliExplication.open = false; /* au chargement : repliée */
pliExplication.addEventListener('toggle', synchroniserPliExplication);
if (typeof mqMobile !== 'undefined' && mqMobile) {
  if (mqMobile.addEventListener) mqMobile.addEventListener('change', synchroniserPliExplication);
  else if (mqMobile.addListener) mqMobile.addListener(synchroniserPliExplication); /* vieux Safari */
}

/* ------------------------------------------------------------------ */
/* Démarrage                                                            */
/* ------------------------------------------------------------------ */

fixerJour(JOUR_DEPART); /* un premier croissant : une Lune visible d'emblée */
window.requestAnimationFrame(boucle);
