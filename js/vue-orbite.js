/*
 * La vue du ciel (vue du dessus, depuis le pôle Nord) : le Soleil FIXE à
 * gauche, la Terre au centre, la Lune sur son orbite. C'est ici que vit le
 * geste-signature : attraper la Lune et la faire tourner.
 *
 * Le décor (fond, étoiles, Soleil, orbite, Terre et sa maison, étiquettes) ne
 * dépend pas du soir : il est dessiné UNE fois dans une image mémoire, refaite
 * seulement quand le canvas change de taille. Chaque image de l'animation
 * copie le décor puis pose le fil du regard, la Lune (pré-rendue, voir
 * lune-disque.js) et le halo « attrape-moi ».
 */
import { TAU, CYCLE_JOURS, positionLune } from './model.js';
import { creerCacheLune } from './lune-disque.js';

var COULEUR_ORBITE = 'rgba(154, 165, 195, 0.35)';
var COULEUR_REGARD = 'rgba(255, 107, 157, 0.55)';

/* Étoiles décoratives, déterministes (petit générateur maison, graine fixe). */
function fabriquerEtoiles(n, graine) {
  var etoiles = [];
  var g = graine;
  function suivant() {
    g = (g * 1103515245 + 12345) % 2147483648;
    return g / 2147483648;
  }
  for (var i = 0; i < n; i++) {
    etoiles.push({ x: suivant(), y: suivant(), r: 0.35 + suivant() * 1.2, a: 0.2 + suivant() * 0.6, t: suivant() });
  }
  return etoiles;
}
var ETOILES = fabriquerEtoiles(140, 42);

/* Une forme organique : courbes quadratiques entre des points (en fraction
 * de `s`, centrés en cx, cy). */
function cheminOrganique(ctx, pts, cx, cy, s) {
  ctx.beginPath();
  var n = pts.length;
  for (var j = 0; j < n; j++) {
    var p = pts[j];
    var q = pts[(j + 1) % n];
    if (j === 0) ctx.moveTo(cx + (pts[n - 1][0] + p[0]) / 2 * s, cy + (pts[n - 1][1] + p[1]) / 2 * s);
    ctx.quadraticCurveTo(cx + p[0] * s, cy + p[1] * s, cx + (p[0] + q[0]) / 2 * s, cy + (p[1] + q[1]) / 2 * s);
  }
  ctx.closePath();
}

/* Un dégradé de nuit court, de gauche (jour) à droite (nuit), sur un disque
 * de rayon r : la moitié qui tourne le dos au Soleil est sombre, et la
 * frontière reste lisible comme une moitié. */
function ombreDeNuit(ctx, cx, cy, r, alpha) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();
  var nuit = ctx.createLinearGradient(cx - r * 0.04, 0, cx + r * 0.08, 0);
  nuit.addColorStop(0, 'rgba(4, 7, 18, 0)');
  nuit.addColorStop(1, 'rgba(4, 7, 18, ' + alpha + ')');
  ctx.fillStyle = nuit;
  ctx.fillRect(cx - r * 0.06, cy - r - 1, r * 1.1, r * 2 + 2);
  ctx.restore();
}

function dessinerSoleil(ctx, g) {
  var r = Math.min(g.w, g.h) * 0.16;
  var cx = -r * 0.35;
  var cy = g.cy;
  /* la lueur chaude qui baigne la gauche de la scène, sans envahir la Lune */
  var halo = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.6);
  halo.addColorStop(0, 'rgba(255, 190, 80, 0.42)');
  halo.addColorStop(0.35, 'rgba(255, 170, 60, 0.10)');
  halo.addColorStop(1, 'rgba(255, 160, 60, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, g.w * 0.6, g.h);
  /* seize rayons doux, longs triangles translucides, fixes */
  ctx.save();
  ctx.translate(cx, cy);
  for (var i = 0; i < 16; i++) {
    var a = (i / 16) * TAU + 0.1;
    var L = r * (1.9 + (i % 3) * 0.45);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - 0.05) * r * 1.02, Math.sin(a - 0.05) * r * 1.02);
    ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L);
    ctx.lineTo(Math.cos(a + 0.05) * r * 1.02, Math.sin(a + 0.05) * r * 1.02);
    ctx.closePath();
    var rayon = ctx.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L);
    rayon.addColorStop(0, 'rgba(255, 220, 120, 0.45)');
    rayon.addColorStop(1, 'rgba(255, 220, 120, 0)');
    ctx.fillStyle = rayon;
    ctx.fill();
  }
  ctx.restore();
  /* le disque : jaune clair au cœur, orangé au bord, un liseré lumineux */
  var disque = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
  disque.addColorStop(0, '#fff3b0');
  disque.addColorStop(0.6, '#ffcf5c');
  disque.addColorStop(1, '#ff9f1c');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fillStyle = disque;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 245, 200, 0.55)';
  ctx.lineWidth = Math.max(1.5, r * 0.04);
  ctx.stroke();
}

/* Chez nous : un pictogramme de maison posé SUR la Terre, côté nuit (à
 * l'opposé du Soleil) — c'est de là qu'on regarde la Lune. Corps clair,
 * une seule fenêtre chaude. */
function dessinerMaison(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  var lueur = ctx.createRadialGradient(0, -s * 0.3, s * 0.1, 0, -s * 0.3, s * 1.1);
  lueur.addColorStop(0, 'rgba(255, 207, 92, 0.30)');
  lueur.addColorStop(1, 'rgba(255, 207, 92, 0)');
  ctx.fillStyle = lueur;
  ctx.fillRect(-s * 1.2, -s * 1.4, s * 2.4, s * 2.2);
  ctx.fillStyle = '#eef1fb';
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, s * 0.3);
  ctx.lineTo(-s * 0.5, -s * 0.3);
  ctx.lineTo(-s * 0.62, -s * 0.3);
  ctx.lineTo(0, -s * 0.85);
  ctx.lineTo(s * 0.62, -s * 0.3);
  ctx.lineTo(s * 0.5, -s * 0.3);
  ctx.lineTo(s * 0.5, s * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(7, 11, 23, 0.75)';
  ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = '#ffcf5c';
  ctx.fillRect(-s * 0.17, -s * 0.15, s * 0.34, s * 0.3);
  ctx.restore();
}

function dessinerTerre(ctx, g) {
  var R = g.rTerre;
  var cx = g.cx;
  var cy = g.cy;
  /* l'atmosphère : un halo bleu pâle */
  var atm = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.35);
  atm.addColorStop(0, 'rgba(120, 190, 255, 0.35)');
  atm.addColorStop(1, 'rgba(120, 190, 255, 0)');
  ctx.fillStyle = atm;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.35, 0, TAU);
  ctx.fill();
  /* l'océan, en volume (la lumière vient de la gauche) */
  var ocean = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.3, R * 0.1, cx, cy, R);
  ocean.addColorStop(0, '#6fb8ef');
  ocean.addColorStop(0.7, '#2f7fd0');
  ocean.addColorStop(1, '#1f5aa8');
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fillStyle = ocean;
  ctx.fill();
  /* les continents, en formes organiques, et quelques nuages */
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.clip();
  ctx.fillStyle = '#4fc79b';
  cheminOrganique(ctx, [[-0.55, -0.5], [-0.2, -0.62], [0.05, -0.4], [-0.15, -0.15], [-0.4, -0.05], [-0.65, -0.25]], cx, cy, R);
  ctx.fill();
  cheminOrganique(ctx, [[0.1, -0.05], [0.42, -0.2], [0.62, 0.05], [0.5, 0.42], [0.25, 0.55], [0.05, 0.3]], cx, cy, R);
  ctx.fill();
  cheminOrganique(ctx, [[-0.6, 0.35], [-0.35, 0.28], [-0.25, 0.55], [-0.45, 0.7], [-0.7, 0.55]], cx, cy, R);
  ctx.fill();
  ctx.fillStyle = '#3aa885';
  cheminOrganique(ctx, [[0.3, -0.62], [0.55, -0.55], [0.5, -0.38], [0.3, -0.42]], cx, cy, R);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  [[-0.3, -0.7, 0.12], [0.35, -0.35, 0.15], [-0.5, 0.15, 0.14], [0.1, 0.65, 0.16], [0.45, 0.2, 0.09]].forEach(function (n) {
    /* un nuage : trois disques alignés, aplatis par une échelle en y */
    ctx.save();
    ctx.translate(cx + n[0] * R, cy + n[1] * R);
    ctx.scale(1, 0.4);
    ctx.beginPath();
    ctx.arc(-n[2] * R * 0.5, 0, n[2] * R * 0.5, 0, TAU);
    ctx.arc(0, 0, n[2] * R * 0.6, 0, TAU);
    ctx.arc(n[2] * R * 0.5, 0, n[2] * R * 0.45, 0, TAU);
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();
  /* VÉRITÉ N° 2 côté Terre : la moitié droite tourne le dos au Soleil, c'est
   * la nuit — et c'est là qu'on habite. */
  ombreDeNuit(ctx, cx, cy, R + 0.5, 0.78);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.strokeStyle = 'rgba(200, 225, 255, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  dessinerMaison(ctx, cx + R * 0.62, cy + R * 0.02, R * 0.5);
}

/* Tout ce qui ne dépend pas du soir. */
function dessinerDecor(ctx, g, dpr) {
  var fond = ctx.createLinearGradient(0, 0, g.w, 0);
  fond.addColorStop(0, '#0b1024');
  fond.addColorStop(0.45, '#070b17');
  fond.addColorStop(1, '#04060f');
  ctx.fillStyle = fond;
  ctx.fillRect(0, 0, g.w, g.h);
  for (var i = 0; i < ETOILES.length; i++) {
    var e = ETOILES[i];
    var r = e.r * (g.compact ? 0.8 : 1) * dpr;
    var x = e.x * g.w;
    var y = e.y * g.h;
    ctx.globalAlpha = e.a;
    ctx.fillStyle = e.t < 0.12 ? '#ffe9b8' : (e.t > 0.88 ? '#cfe0ff' : '#eef1fb');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    if (r > 1.35 * dpr) {
      ctx.globalAlpha = e.a * 0.45;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = Math.max(0.5, r * 0.3);
      ctx.beginPath();
      ctx.moveTo(x - r * 3, y); ctx.lineTo(x + r * 3, y);
      ctx.moveTo(x, y - r * 3); ctx.lineTo(x, y + r * 3);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  dessinerSoleil(ctx, g);
  /* l'orbite */
  ctx.beginPath();
  ctx.arc(g.cx, g.cy, g.rOrbite, 0, TAU);
  ctx.strokeStyle = COULEUR_ORBITE;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  ctx.stroke();
  ctx.setLineDash([]);
  dessinerTerre(ctx, g);
  /* les petites étiquettes (pas en mode compact) */
  if (!g.compact) {
    var taille = Math.round(Math.min(g.w, g.h) * 0.035);
    ctx.fillStyle = 'rgba(154, 165, 195, 0.9)';
    ctx.font = '600 ' + taille + 'px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Soleil', Math.min(g.w, g.h) * 0.03, g.cy - Math.min(g.w, g.h) * 0.2);
    ctx.textAlign = 'center';
    ctx.fillText('Terre', g.cx, g.cy + g.rTerre + taille * 1.3);
  }
}

export function creerVueOrbite(canvas) {
  var ctx = canvas.getContext('2d');
  var cacheLune = creerCacheLune(false);
  var decor = null;
  var decorW = 0;
  var decorH = 0;

  /* Géométrie recalculée à chaque rendu (le canvas peut changer de taille). */
  function geometrie() {
    var w = canvas.width;
    var h = canvas.height;
    var compact = Math.min(w, h) < 520 * (window.devicePixelRatio || 1);
    var cx = w * 0.56;               /* la Terre, décalée pour laisser le Soleil respirer */
    var cy = h * 0.5;
    var rOrbite = Math.min(w, h) * (compact ? 0.34 : 0.33);
    var rTerre = Math.min(w, h) * 0.085;
    var rLune = Math.min(w, h) * (compact ? 0.062 : 0.055);
    return { w: w, h: h, cx: cx, cy: cy, rOrbite: rOrbite, rTerre: rTerre, rLune: rLune, compact: compact };
  }

  function obtenirDecor(g) {
    if (decor && decorW === g.w && decorH === g.h) return decor;
    decor = document.createElement('canvas');
    decor.width = g.w;
    decor.height = g.h;
    decorW = g.w;
    decorH = g.h;
    dessinerDecor(decor.getContext('2d'), g, window.devicePixelRatio || 1);
    return decor;
  }

  /* Position de la Lune sur le canvas (bascule math → canvas : y inversé). */
  function positionLuneCanvas(jour, g) {
    var p = positionLune(jour);
    return { x: g.cx + p.x * g.rOrbite, y: g.cy - p.y * g.rOrbite };
  }

  function dessinerLune(ctx, g, jour, halo) {
    var p = positionLuneCanvas(jour, g);
    var r = g.rLune;
    if (halo > 0) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * (1.55 + 0.25 * halo), 0, TAU);
      ctx.strokeStyle = 'rgba(169, 139, 255, ' + (0.35 + 0.4 * halo) + ')';
      ctx.lineWidth = Math.max(2, r * 0.14);
      ctx.stroke();
    }
    /* la même Lune que dans le hublot, vue du dessus */
    var image = cacheLune.obtenir(r);
    ctx.drawImage(image, p.x - image.width / 2, p.y - image.height / 2);
    /* VÉRITÉ N° 1 : la moitié qui tourne le dos au Soleil est sombre —
     * la nuit de la Lune est toujours sa moitié droite, où qu'elle soit. */
    ombreDeNuit(ctx, p.x, p.y, r + 0.5, 0.86);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.strokeStyle = 'rgba(233, 237, 248, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return p;
  }

  return {
    /* Rendu complet. `halo` dans [0, 1] fait respirer l'anneau « attrape-moi ». */
    rendre: function (jour, halo) {
      var g = geometrie();
      if (g.w === 0 || g.h === 0) return;
      ctx.drawImage(obtenirDecor(g), 0, 0);
      /* Le fil du regard : de chez nous vers la Lune. */
      var p = positionLuneCanvas(jour, g);
      ctx.beginPath();
      ctx.moveTo(g.cx, g.cy);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = COULEUR_REGARD;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      dessinerLune(ctx, g, jour, halo);
    },

    /* Le jour correspondant à un point du canvas (pour le glisser).
     * θ = atan2(dy, −dx) car la position canvas de la Lune est
     * (cx − cosθ·r, cy + sinθ·r). */
    jourDepuisPointeur: function (x, y) {
      var g = geometrie();
      var t = Math.atan2(y - g.cy, -(x - g.cx));
      if (t < 0) t += TAU;
      return (t / TAU) * CYCLE_JOURS;
    },

    /* Le pointeur est-il assez près de la Lune pour l'attraper ?
     * (zone généreuse : des petits doigts vont viser large) */
    attrapeLune: function (x, y, jour) {
      var g = geometrie();
      var p = positionLuneCanvas(jour, g);
      var marge = Math.max(g.rLune * 3, 44 * (window.devicePixelRatio || 1));
      var dx = x - p.x;
      var dy = y - p.y;
      return dx * dx + dy * dy <= marge * marge;
    }
  };
}
