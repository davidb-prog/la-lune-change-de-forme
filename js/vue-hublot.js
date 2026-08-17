/*
 * Le hublot « ce soir, dans le ciel » : la Lune telle qu'on la voit du jardin,
 * toujours synchronisée avec la vue du ciel. La forme vient du modèle
 * (formeLune) — la vue ne calcule rien elle-même.
 */
import { TAU, formeLune } from './model.js';

var CIEL = '#070b17';
var LUNE_SOMBRE = '#232a45';
var LUNE_CLAIRE = '#f2eedf';

function fabriquerEtoiles(n) {
  var etoiles = [];
  var graine = 7;
  function suivant() {
    graine = (graine * 1103515245 + 12345) % 2147483648;
    return graine / 2147483648;
  }
  for (var i = 0; i < n; i++) {
    etoiles.push({ x: suivant(), y: suivant(), r: 0.4 + suivant() * 1.2, a: 0.25 + suivant() * 0.55 });
  }
  return etoiles;
}
var ETOILES = fabriquerEtoiles(60);

/* Dessine le disque de la Lune en phase.
 * Chemin : le limbe éclairé (du haut au bas, en passant par le côté éclairé),
 * puis le terminateur (arc à l'échelle k en x — astuce compatible partout,
 * sans ctx.ellipse). */
export function dessinerDisqueLune(ctx, cx, cy, R, forme) {
  /* Le disque sombre, toujours là (à la nouvelle lune, on le devine à peine). */
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fillStyle = LUNE_SOMBRE;
  ctx.fill();

  var f = forme.fraction;
  if (f > 0.005) {
    ctx.beginPath();
    if (f >= 0.995) {
      ctx.arc(cx, cy, R, 0, TAU);
    } else {
      var versLaGauche = forme.cote === 'gauche';
      /* |k| trop petit → scale(0) : on borne (epsilon géométrique explicite). */
      var k = forme.k;
      if (Math.abs(k) < 0.004) k = k >= 0 ? 0.004 : -0.004;
      ctx.arc(cx, cy, R, -Math.PI / 2, Math.PI / 2, versLaGauche);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(k, 1);
      ctx.arc(0, 0, R, Math.PI / 2, -Math.PI / 2, true);
      ctx.restore();
      ctx.closePath();
    }
    ctx.fillStyle = LUNE_CLAIRE;
    ctx.fill();

    /* Quelques cratères, seulement sur la partie éclairée. */
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(120, 118, 100, 0.28)';
    ctx.beginPath();
    ctx.arc(cx - R * 0.3, cy - R * 0.25, R * 0.16, 0, TAU);
    ctx.arc(cx + R * 0.28, cy + R * 0.32, R * 0.12, 0, TAU);
    ctx.arc(cx + R * 0.15, cy - R * 0.45, R * 0.09, 0, TAU);
    ctx.arc(cx - R * 0.12, cy + R * 0.18, R * 0.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /* Le contour, discret. */
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.strokeStyle = 'rgba(233, 237, 248, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function creerVueHublot(canvas) {
  var ctx = canvas.getContext('2d');

  return {
    rendre: function (jour) {
      var w = canvas.width;
      var h = canvas.height;
      ctx.fillStyle = CIEL;
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < ETOILES.length; i++) {
        var e = ETOILES[i];
        ctx.globalAlpha = e.a;
        ctx.fillStyle = '#e9edf8';
        ctx.beginPath();
        ctx.arc(e.x * w, e.y * h, e.r * (window.devicePixelRatio || 1), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      var forme = formeLune(jour);
      var R = Math.min(w, h) * 0.3;
      var cx = w / 2;
      var cy = h * 0.44;
      /* Un halo doux quand la Lune brille. */
      if (forme.fraction > 0.02) {
        var halo = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 2.1);
        halo.addColorStop(0, 'rgba(242, 238, 223, ' + (0.25 * forme.fraction) + ')');
        halo.addColorStop(1, 'rgba(242, 238, 223, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, w, h);
      }
      dessinerDisqueLune(ctx, cx, cy, R, forme);

      /* Les toits endormis, en bas du hublot. */
      var sol = h * 0.86;
      ctx.fillStyle = '#0e1530';
      ctx.fillRect(0, sol, w, h - sol);
      ctx.beginPath();
      /* Une petite maison… */
      var mx = w * 0.22;
      ctx.rect(mx - w * 0.06, sol - h * 0.07, w * 0.12, h * 0.07);
      ctx.moveTo(mx - w * 0.08, sol - h * 0.07);
      ctx.lineTo(mx, sol - h * 0.13);
      ctx.lineTo(mx + w * 0.08, sol - h * 0.07);
      ctx.closePath();
      ctx.fill();
      /* …sa fenêtre allumée… */
      ctx.fillStyle = '#ffcf5c';
      ctx.fillRect(mx - w * 0.015, sol - h * 0.05, w * 0.03, h * 0.03);
      /* …et deux sapins. */
      ctx.fillStyle = '#0e1530';
      [0.68, 0.82].forEach(function (fx) {
        var sx = w * fx;
        ctx.beginPath();
        ctx.moveTo(sx - w * 0.05, sol);
        ctx.lineTo(sx, sol - h * 0.12);
        ctx.lineTo(sx + w * 0.05, sol);
        ctx.closePath();
        ctx.fill();
      });
    }
  };
}
