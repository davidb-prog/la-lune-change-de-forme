/*
 * Le câblage de la page : boucle de rendu résiliente, geste-signature
 * (attraper la Lune), curseur maître, scénarios, conteur et jeu.
 * Toute la connaissance du phénomène vit dans js/model.js — ici on ne fait
 * que brancher.
 */
import {
  CYCLE_JOURS, JOUR_DEPART, jourNormalise, phraseDuSoir,
  SCENARIOS, creerPiocheDefis, defiReussi, defiEncoreTenu, consigneDefi, bravoDefi, DEFI_ATTENTE_MS,
  LECTURE_SECONDES_PAR_CYCLE, texteOral
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
  glisse: false,
  enLecture: false,     /* la lecture auto (bouton ⏸/▶) : la Lune avance seule */
  tPrecedente: null     /* horodatage du dernier passage de la boucle */
};

var mouvementReduit = false;
if (window.matchMedia) {
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mouvementReduit = !!mq.matches;
  if (mq.addEventListener) mq.addEventListener('change', function (e) {
    mouvementReduit = !!e.matches;
    if (mouvementReduit) fixerLecture(false); /* rien ne bouge tout seul */
  });
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
var boutonSonJeu = document.getElementById('bouton-son-jeu'); /* le jumeau posé sur le jeu */
var boutonLecture = document.getElementById('bouton-lecture');
var boutonEcouter = document.getElementById('bouton-ecouter');
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

/* La lecture auto (bouton ⏸/▶ harmonisé de la famille) : la Lune avance toute
 * seule sur son orbite ; reprendre la main met en pause. Les deux libellés
 * vivent empilés dans le bouton (largeur stable) : aria-pressed suffit. */
function fixerLecture(enLecture) {
  etat.enLecture = enLecture;
  boutonLecture.setAttribute('aria-pressed', enLecture ? 'true' : 'false');
  boutonLecture.setAttribute('aria-label', enLecture
    ? 'Mettre en pause (la Lune avance toute seule)'
    : 'Relancer la Lune qui avance toute seule');
}
boutonLecture.addEventListener('click', function () { fixerLecture(!etat.enLecture); });

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
    /* La lecture auto : la Lune avance toute seule, sauf pendant une
     * animation de scénario ou un glisser (le doigt est le maître). */
    if (etat.enLecture && !etat.animation && !etat.glisse && etat.tPrecedente !== null) {
      var dt = Math.min(200, maintenant - etat.tPrecedente); /* onglet endormi : pas de bond */
      fixerJour(etat.jour + (dt / 1000) * (CYCLE_JOURS / LECTURE_SECONDES_PAR_CYCLE));
    }
    etat.tPrecedente = maintenant;
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

/* Safari iOS ignore user-scalable=no depuis iOS 10 : on neutralise aussi le
 * zoom pincé de la PAGE par son événement propriétaire (inconnu ailleurs,
 * donc sans effet). Les canvas des vues ne passent pas par là : leurs gestes
 * vivent sur des éléments en touch-action: none. */
document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

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
    fixerLecture(false); /* attraper la Lune met en pause */
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
  fixerLecture(false); /* reprendre la main met en pause */
  fixerJour(parseFloat(curseur.value));
});

/* ------------------------------------------------------------------ */
/* Les scénarios                                                        */
/* ------------------------------------------------------------------ */

var boutonsScenarios = [];

/* Sur mobile, le voyage de la Lune se joue hors écran quand on tape une
 * vignette : on remonte doucement en calant la carte du jardin en haut de
 * l'écran — le bandeau montre la forme du soir et la vue de l'espace,
 * juste dessous, montre le voyage en même temps.
 * (Sur grand écran les deux vues sont déjà sous les yeux : on ne bouge pas.) */
function montrerLeVoyage() {
  if (!estMobile) return;
  try {
    carteHublot.scrollIntoView({ behavior: mouvementReduit ? 'auto' : 'smooth', block: 'start' });
  } catch (e) {
    carteHublot.scrollIntoView(true);
  }
}

function rafraichirBoutonsScenarios() {
  boutonsScenarios.forEach(function (b) {
    b.el.setAttribute('aria-pressed', etat.scenarioActif === b.id ? 'true' : 'false');
  });
}

/* L'histoire écrite : une ligne par vue (puce colorée + texte), comme les
 * autres épisodes — le même instant, deux regards. */
function montrerHistoire(s) {
  histoireScenario.hidden = false;
  while (histoireScenario.firstChild) histoireScenario.removeChild(histoireScenario.firstChild);
  [{ classe: 'puce-ciel', puce: '🌙 dans le ciel', texte: s.ciel },
   { classe: 'puce-espace', puce: '🚀 depuis l’espace', texte: s.espace }].forEach(function (l) {
    var ligne = document.createElement('div');
    ligne.className = 'ligne-histoire';
    var puce = document.createElement('span');
    puce.className = 'puce-histoire ' + l.classe;
    puce.textContent = l.puce;
    var texte = document.createElement('p');
    texte.className = 'texte-histoire';
    texte.textContent = l.texte;
    ligne.appendChild(puce);
    ligne.appendChild(texte);
    histoireScenario.appendChild(ligne);
  });
}

SCENARIOS.forEach(function (s) {
  var bouton = document.createElement('button');
  bouton.type = 'button';
  /* scn-<id> : les couleurs de la famille (reprises d'ou-va-le-soleil) */
  bouton.className = 'bouton-scenario scn-' + s.id;
  bouton.setAttribute('aria-pressed', 'false');
  bouton.innerHTML = '<span class="emoji">' + s.emoji + '</span>' +
    '<span class="titre"></span><span class="sous"></span>';
  bouton.querySelector('.titre').textContent = s.titre;
  bouton.querySelector('.sous').textContent = s.sousTitre;
  bouton.addEventListener('click', function () {
    fixerLecture(false); /* le scénario prend la main sur la lecture auto */
    etat.scenarioActif = s.id;
    rafraichirBoutonsScenarios();
    allerAuJour(s.jour, false);
    montrerHistoire(s);
    if (sonScenariosActif) narrateur.raconter('scn-' + s.id, s.oral);
    montrerLeVoyage();
  });
  grilleScenarios.appendChild(bouton);
  boutonsScenarios.push({ id: s.id, el: bouton });
});

/* ------------------------------------------------------------------ */
/* Le conteur                                                           */
/* ------------------------------------------------------------------ */

var synthesePossible = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
/* Clé de famille : même origine petit-labo.fr pour tous les épisodes, le
 * réglage du son suit l'enfant de l'un à l'autre. L'ancienne clé propre à
 * l'épisode est lue en secours pour ne pas perdre le réglage déjà fait. */
var CLE_SON = 'petit-labo-son';
var ANCIENNE_CLE_SON = 'petit-labo-lune-son';
var sonScenariosActif = false;

/* La voix enregistrée : un manifeste (assets/audio/manifest.json) liste les
 * blocs mp3 disponibles avec leur texte oral exact. On ne joue un fichier que
 * si son texte correspond ENCORE au texte du site — sinon, repli synthèse (la
 * voix enregistrée ne ment jamais). Manifeste vide ou absent : tout passe par
 * la synthèse, comme avant. Fichiers générés par tools/build-voix.mjs. */
var blocsAudio = {};
function brancherManifeste(m) {
  if (!m || !m.blocs) return;
  blocsAudio = m.blocs;
  /* le conseil « voix améliorée » ne concerne que le repli synthèse */
  if (conseilVoix && Object.keys(blocsAudio).length > 0) conseilVoix.hidden = true;
}
if (window.__VOIX_MANIFESTE) {
  /* la page-test artefact de la famille embarque le manifeste dans la page */
  brancherManifeste(window.__VOIX_MANIFESTE);
} else if (window.fetch) {
  window.fetch('assets/audio/manifest.json')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(brancherManifeste)
    .catch(function () { /* hors ligne ou manifeste absent : synthèse seule */ });
}

function audioSrc(id, texte) {
  var b = blocsAudio[id];
  if (!b || b.texte !== texte || !b.fichier) return null;
  /* l'artefact embarque les sons en data URI ; le site sert des fichiers */
  return b.fichier.indexOf('data:') === 0 ? b.fichier : 'assets/audio/' + b.fichier;
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
    return { lire: function () {}, raconter: function () {}, stop: function () {} };
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

  /* Le score choisit seul la meilleure voix française : le menu de choix des
   * premiers épisodes était un héritage d'avant la voix enregistrée. */
  function rafraichirVoix() {
    var fr = voixFrancaises();
    if (!fr.length) return;
    voixChoisie = fr[0];
    /* le conseil ne vaut que pour le repli synthèse : avec la voix
     * enregistrée, l'appareil n'a pas besoin d'une jolie voix système */
    conseilVoix.hidden = scoreVoix(voixChoisie) >= 40 || Object.keys(blocsAudio).length > 0;
  }

  if (synthese.addEventListener) synthese.addEventListener('voiceschanged', rafraichirVoix);
  else if ('onvoiceschanged' in synthese) synthese.onvoiceschanged = rafraichirVoix;
  rafraichirVoix();

  function tonDeConteur(u, phrase) {
    u.rate = 0.92;
    u.pitch = 1.04;
    if (phrase.indexOf('…') !== -1) u.rate = 0.87;
    if (/\?\s*$/.test(phrase)) u.pitch = 1.12;
    if (/!\s*$/.test(phrase)) { u.rate = 0.96; u.pitch = 1.14; }
  }

  /* UN SEUL élément audio, réutilisé pour tous les blocs enregistrés : une
   * fois débloqué par un geste (iOS ne permet play() que dans la foulée d'un
   * toucher), il peut rejouer SANS geste — indispensable pour la consigne du
   * défi suivant ou l'histoire relue depuis le bouton du jeu. */
  var lecteur = null;
  function getLecteur() {
    if (!lecteur) lecteur = new window.Audio();
    return lecteur;
  }
  function arreterLecteur() {
    if (!lecteur) return;
    try { lecteur.pause(); } catch (e) { /* déjà arrêté */ }
    lecteur.onended = null;
    lecteur.onerror = null;
  }
  function finir() {
    if (finPrecedente) { var f = finPrecedente; finPrecedente = null; f(); }
  }

  /* Le repli synthèse : lit des morceaux { texte, finDeParagraphe }. */
  function direMorceaux(morceaux, gen, apres) {
    function suivant(i) {
      if (gen !== generation) return;
      if (i >= morceaux.length) { apres(); return; }
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

  /* Le conteur : une suite de blocs { id, texte } (texte déjà passé par
   * texteOral). Chaque bloc joue son fichier enregistré s'il existe ET dit
   * encore le bon texte ; sinon la synthèse lit le texte phrase à phrase.
   * Une histoire = UNE voix : si un seul bloc n'a pas son fichier (texte
   * changé, manifeste vide…), tout le récit passe à la synthèse — jamais de
   * voix chaleureuse interrompue par une phrase robotique. */
  function lire(blocs, quandFini) {
    generation += 1;
    var gen = generation;
    finir();
    finPrecedente = quandFini || null;
    synthese.cancel();
    arreterLecteur();
    rafraichirVoix(); /* certaines listes de voix arrivent tard */
    var enregistre = true;
    for (var i = 0; i < blocs.length; i++) {
      if (!audioSrc(blocs[i].id, blocs[i].texte)) { enregistre = false; break; }
    }

    function suivant(n) {
      if (gen !== generation) return;
      if (n >= blocs.length) { finir(); return; }
      var bloc = blocs[n];
      var apres = function () {
        if (gen === generation) window.setTimeout(function () { suivant(n + 1); }, 0);
      };
      var tombe = false; /* onerror ET promesse rejetée peuvent tomber tous les deux */
      var repli = function () {
        if (tombe || gen !== generation) return;
        tombe = true;
        direMorceaux(phrasesDe(bloc.texte), gen, apres);
      };
      var src = enregistre ? audioSrc(bloc.id, bloc.texte) : null;
      if (!src) { repli(); return; }
      var a = getLecteur();
      a.onended = function () {
        if (gen === generation) window.setTimeout(apres, 620);
      };
      a.onerror = repli;
      a.src = src;
      var p = a.play();
      if (p && p.then) p.then(null, repli);
      /* pendant que ce bloc joue, préchauffer le fichier du suivant : son
       * chargement se fait d'avance (cache HTTP) et ne s'ajoute plus au
       * blanc entre les blocs au premier passage en ligne */
      if (n + 1 < blocs.length && window.fetch) {
        var nx = audioSrc(blocs[n + 1].id, blocs[n + 1].texte);
        if (nx && nx.indexOf('data:') !== 0) {
          window.fetch(nx).catch(function () { /* le lecteur retentera */ });
        }
      }
    }
    suivant(0);
  }

  return {
    lire: lire,
    /* Un texte du modèle, en un seul bloc : id du fichier + version orale. */
    raconter: function (id, texte) { lire([{ id: id, texte: texteOral(texte) }]); },
    stop: function () {
      generation += 1;
      synthese.cancel();
      arreterLecteur();
      finir();
    }
  };
})();

/* « 🔊 Écouter l'histoire » sur la boîte d'explication. */
var lectureExplication = false;

function lireExplication() {
  /* un bloc par paragraphe : les ids histoire-1… des fichiers enregistrés */
  var paragraphes = texteExplication.querySelectorAll('p');
  var blocs = [];
  for (var i = 0; i < paragraphes.length; i++) {
    blocs.push({ id: 'histoire-' + (i + 1), texte: texteOral(paragraphes[i].textContent) });
  }
  lectureExplication = true;
  boutonEcouter.textContent = '⏹ Arrêter';
  boutonEcouter.setAttribute('aria-pressed', 'true');
  narrateur.lire(blocs, function () {
    lectureExplication = false;
    boutonEcouter.textContent = '🔊 Écouter l’histoire';
    boutonEcouter.setAttribute('aria-pressed', 'false');
  });
}

if (synthesePossible) {
  boutonEcouter.hidden = false;
  boutonSonScenarios.hidden = false;
  boutonSonJeu.hidden = false;
  boutonEcouter.addEventListener('click', function () {
    if (lectureExplication) narrateur.stop();
    else lireExplication();
  });

  try {
    var son = window.localStorage.getItem(CLE_SON);
    sonScenariosActif = son !== null
      ? son === '1'
      : window.localStorage.getItem(ANCIENNE_CLE_SON) === 'oui';
  } catch (e) { /* tant pis */ }

  function rafraichirBoutonSon() {
    /* libellés empilés dans le HTML : aria-pressed montre l'un, cache
     * l'autre. Les deux boutons (scénarios + jeu) sont jumeaux. */
    [boutonSonScenarios, boutonSonJeu].forEach(function (b) {
      b.setAttribute('aria-pressed', sonScenariosActif ? 'true' : 'false');
      b.setAttribute('aria-label',
        sonScenariosActif ? 'Couper la version sonore des histoires' : 'Activer la version sonore des histoires');
    });
  }
  rafraichirBoutonSon();

  function basculerSon() {
    sonScenariosActif = !sonScenariosActif;
    try { window.localStorage.setItem(CLE_SON, sonScenariosActif ? '1' : '0'); } catch (e) { /* tant pis */ }
    rafraichirBoutonSon();
    if (!sonScenariosActif) {
      narrateur.stop();
      return;
    }
    if (etat.scenarioActif) {
      /* L'activer relit le moment affiché. */
      for (var i = 0; i < SCENARIOS.length; i++) {
        if (SCENARIOS[i].id === etat.scenarioActif) {
          narrateur.raconter('scn-' + SCENARIOS[i].id, SCENARIOS[i].oral);
          break;
        }
      }
    } else if (etat.defi) {
      /* L'activer depuis le jeu relit la consigne du défi en cours. */
      narrateur.raconter('defi-' + etat.defi.cible + '-consigne', consigneDefi(etat.defi));
    }
  }
  boutonSonScenarios.addEventListener('click', basculerSon);
  boutonSonJeu.addEventListener('click', basculerSon);

  /* Partir ailleurs (autre application, autre onglet, écran verrouillé)
   * coupe le conteur net — synthèse ET mp3 : la voix ne parle jamais dans le
   * vide. Pas de reprise au retour : rien ne parle tout seul, on re-tape. */
  window.addEventListener('pagehide', function () { narrateur.stop(); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') narrateur.stop();
  });
}

/* ------------------------------------------------------------------ */
/* Le jeu « Attrape la bonne Lune »                                     */
/* ------------------------------------------------------------------ */

/* Le sac survit au « Ranger le jeu » : sur une session entière, l'enfant voit
 * toutes les formes avant qu'une seule ne revienne. */
var piocherDefi = creerPiocheDefis();

function nouveauDefi() {
  etat.defi = piocherDefi();
  etat.defiGagne = false;
  etat.bravoVisible = false;
  etat.defiEntreMs = null;
  defiJeu.textContent = etat.defi.emoji + ' ' + etat.defi.nom + ' !';
  defiJeu.hidden = false;
  bravoJeu.hidden = true;
  boutonEncore.hidden = true;
  /* La version sonore du jeu suit le même bouton 🔇/🔊 que les scénarios. */
  if (sonScenariosActif) narrateur.raconter('defi-' + etat.defi.cible + '-consigne', consigneDefi(etat.defi));
}

function surveillerDefi(ms) {
  if (!etat.defi) return;
  var dessus = defiReussi(etat.defi.cible, etat.jour);
  /* Le bravo ne ment jamais : il s'efface quand l'enfant repart faire
   * tourner la Lune, et revient s'il refabrique la bonne forme (sans
   * relire la voix). « Encore une ! » reste acquis. Il ne se range que si
   * la Lune quitte FRANCHEMENT la forme (hystérésis defiEncoreTenu) : au
   * bord de la fenêtre, un frémissement du doigt ne le fait pas clignoter. */
  if (etat.bravoVisible) {
    if (!defiEncoreTenu(etat.defi.cible, etat.jour)) {
      etat.bravoVisible = false;
      etat.defiEntreMs = null;
      bravoJeu.hidden = true;
    }
    return;
  }
  /* On ne gagne qu'en manœuvrant soi-même (pas pendant une animation de
   * scénario NI pendant la lecture auto), et il faut RESTER sur la forme :
   * la traverser d'un grand coup de glisser ne compte pas. */
  if (!dessus || etat.animation || etat.enLecture) {
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
    if (sonScenariosActif) narrateur.raconter('defi-' + etat.defi.cible + '-bravo', bravoDefi(etat.defi));
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
    fixerLecture(false); /* rien ne doit gagner tout seul */
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
fixerLecture(!mouvementReduit); /* comme les autres épisodes : la Lune avance seule */
window.requestAnimationFrame(boucle);
