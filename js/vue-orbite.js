/*
 * La vue du ciel (vue du dessus, depuis le pôle Nord) : le Soleil FIXE à
 * gauche, la Terre au centre, la Lune sur son orbite. C'est ici que vit le
 * geste-signature : attraper la Lune et la faire tourner.
 */
import { TAU, angleOrbite, CYCLE_JOURS, positionLune } from './model.js';

var CIEL = '#070b17';
var COULEUR_ORBITE = 'rgba(154, 165, 195, 0.35)';
var COULEUR_REGARD = 'rgba(255, 107, 157, 0.55)';

/* Étoiles décoratives, déterministes (petit générateur maison, graine fixe). */
function fabriquerEtoiles(n) {
  var etoiles = [];
  var graine = 42;
  function suivant() {
    graine = (graine * 1103515245 + 12345) % 2147483648;
    return graine / 2147483648;
  }
  for (var i = 0; i < n; i++) {
    etoiles.push({ x: suivant(), y: suivant(), r: 0.4 + suivant() * 1.1, a: 0.25 + suivant() * 0.55 });
  }
  return etoiles;
}
var ETOILES = fabriquerEtoiles(90);

/* Demi-disque de nuit : assombrit la moitié d'un astre qui tourne le dos au
 * Soleil (le Soleil est à gauche → la nuit est la moitié droite). */
function ombreDeNuit(ctx, cx, cy, r, couleur) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false);
  ctx.closePath();
  ctx.fillStyle = couleur;
  ctx.fill();
}

export function creerVueOrbite(canvas) {
  var ctx = canvas.getContext('2d');

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

  /* Position de la Lune sur le canvas (bascule math → canvas : y inversé). */
  function positionLuneCanvas(jour, g) {
    var p = positionLune(jour);
    return { x: g.cx + p.x * g.rOrbite, y: g.cy - p.y * g.rOrbite };
  }

  function dessinerSoleil(ctx, g) {
    var r = Math.min(g.w, g.h) * 0.16;
    var cx = -r * 0.35;
    var cy = g.cy;
    var halo = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 2.6);
    halo.addColorStop(0, 'rgba(255, 207, 92, 0.55)');
    halo.addColorStop(1, 'rgba(255, 207, 92, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, g.w * 0.5, g.h);
    /* Les rayons, sages et fixes. */
    ctx.strokeStyle = 'rgba(255, 207, 92, 0.5)';
    ctx.lineWidth = Math.max(2, r * 0.05);
    for (var i = -3; i <= 3; i++) {
      var a = i * 0.22;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 1.25);
      ctx.lineTo(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 1.6);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fillStyle = '#ffcf5c';
    ctx.fill();
  }

  function dessinerTerre(ctx, g) {
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.rTerre, 0, TAU);
    ctx.fillStyle = '#3d8bd4';
    ctx.fill();
    /* Quelques continents joufflus, découpés dans le disque. */
    ctx.save();
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.rTerre, 0, TAU);
    ctx.clip();
    ctx.fillStyle = '#46c2a5';
    ctx.beginPath();
    ctx.arc(g.cx - g.rTerre * 0.35, g.cy - g.rTerre * 0.3, g.rTerre * 0.45, 0, TAU);
    ctx.arc(g.cx + g.rTerre * 0.4, g.cy + g.rTerre * 0.35, g.rTerre * 0.38, 0, TAU);
    ctx.arc(g.cx + g.rTerre * 0.3, g.cy - g.rTerre * 0.55, g.rTerre * 0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
    /* La moitié droite tourne le dos au Soleil : c'est la nuit. */
    ombreDeNuit(ctx, g.cx, g.cy, g.rTerre + 0.5, 'rgba(4, 7, 18, 0.72)');
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.rTerre, 0, TAU);
    ctx.strokeStyle = 'rgba(233, 237, 248, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    /* Chez nous : une petite maison plantée sur le côté nuit de la Terre
     * (à l'opposé du Soleil) — c'est de là qu'on regarde la Lune. */
    dessinerMaison(ctx, g.cx + g.rTerre, g.cy, Math.PI / 2, g.rTerre * 0.58);
  }

  /* Une petite maison éclairée, posée en (x, y), « debout » selon rotation
   * (0 = vers le haut du canvas). */
  function dessinerMaison(ctx, x, y, rotation, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.rect(-s * 0.5, -s * 0.62, s, s * 0.62);
    ctx.moveTo(-s * 0.64, -s * 0.62);
    ctx.lineTo(0, -s * 1.15);
    ctx.lineTo(s * 0.64, -s * 0.62);
    ctx.closePath();
    ctx.fillStyle = '#cdd5ea';
    ctx.fill();
    ctx.strokeStyle = 'rgba(7, 11, 23, 0.8)';
    ctx.lineWidth = Math.max(1, s * 0.06);
    ctx.stroke();
    ctx.fillStyle = '#ffcf5c';
    ctx.fillRect(-s * 0.17, -s * 0.48, s * 0.34, s * 0.32);
    ctx.restore();
  }

  function dessinerLune(ctx, g, jour, halo) {
    var p = positionLuneCanvas(jour, g);
    if (halo > 0) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, g.rLune * (1.55 + 0.25 * halo), 0, TAU);
      ctx.strokeStyle = 'rgba(169, 139, 255, ' + (0.35 + 0.4 * halo) + ')';
      ctx.lineWidth = Math.max(2, g.rLune * 0.14);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, g.rLune, 0, TAU);
    ctx.fillStyle = '#d8d4c8';
    ctx.fill();
    /* Deux petits cratères. */
    ctx.fillStyle = 'rgba(90, 95, 110, 0.35)';
    ctx.beginPath();
    ctx.arc(p.x - g.rLune * 0.25, p.y - g.rLune * 0.2, g.rLune * 0.2, 0, TAU);
    ctx.arc(p.x + g.rLune * 0.3, p.y + g.rLune * 0.3, g.rLune * 0.14, 0, TAU);
    ctx.fill();
    /* VÉRITÉ N° 1 : la moitié qui tourne le dos au Soleil est sombre —
     * la nuit de la Lune est toujours sa moitié droite, où qu'elle soit. */
    ombreDeNuit(ctx, p.x, p.y, g.rLune + 0.5, 'rgba(4, 7, 18, 0.82)');
    ctx.beginPath();
    ctx.arc(p.x, p.y, g.rLune, 0, TAU);
    ctx.strokeStyle = 'rgba(233, 237, 248, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return p;
  }

  return {
    /* Rendu complet. `halo` dans [0, 1] fait respirer l'anneau « attrape-moi ». */
    rendre: function (jour, halo) {
      var g = geometrie();
      ctx.fillStyle = CIEL;
      ctx.fillRect(0, 0, g.w, g.h);
      /* Les étoiles. */
      for (var i = 0; i < ETOILES.length; i++) {
        var e = ETOILES[i];
        ctx.globalAlpha = e.a;
        ctx.fillStyle = '#e9edf8';
        ctx.beginPath();
        ctx.arc(e.x * g.w, e.y * g.h, e.r * (g.compact ? 0.8 : 1) * (window.devicePixelRatio || 1), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      dessinerSoleil(ctx, g);
      /* L'orbite. */
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, g.rOrbite, 0, TAU);
      ctx.strokeStyle = COULEUR_ORBITE;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
      dessinerTerre(ctx, g);
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
      /* Les petites étiquettes (pas en mode compact). */
      if (!g.compact) {
        var taille = Math.round(Math.min(g.w, g.h) * 0.035);
        ctx.fillStyle = 'rgba(154, 165, 195, 0.9)';
        ctx.font = '600 ' + taille + 'px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Soleil', Math.min(g.w, g.h) * 0.03, g.cy - Math.min(g.w, g.h) * 0.2);
        ctx.textAlign = 'center';
        ctx.fillText('Terre', g.cx, g.cy + g.rTerre + taille * 1.3);
      }
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
