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

/* Où se pose le disque de la Lune dans le hublot, pour une boîte w × h.
 * La vue s'en sert pour dessiner ; main.js s'en sert pour savoir si la Lune du
 * jardin est encore à l'écran — une seule géométrie, jamais deux copies. */
export function geometrieLune(w, h) {
  return { cx: w / 2, cy: h * 0.44, R: Math.min(w, h) * 0.3 };
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
      var geo = geometrieLune(w, h);
      var R = geo.R;
      var cx = geo.cx;
      var cy = geo.cy;
      /* Un halo doux quand la Lune brille. */
      if (forme.fraction > 0.02) {
        var halo = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 2.1);
        halo.addColorStop(0, 'rgba(242, 238, 223, ' + (0.25 * forme.fraction) + ')');
        halo.addColorStop(1, 'rgba(242, 238, 223, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, w, h);
      }
      dessinerDisqueLune(ctx, cx, cy, R, forme);

      /* Le jardin endormi, en bas du hublot — silhouettes plus claires que le
       * ciel et détourées, pour que la maison et les sapins se lisent bien. */
      var sol = h * 0.86;
      ctx.fillStyle = '#16204a';
      ctx.fillRect(0, sol, w, h - sol);
      ctx.strokeStyle = 'rgba(169, 139, 255, 0.5)';
      ctx.lineWidth = Math.max(1.5, h * 0.004);
      ctx.beginPath();
      ctx.moveTo(0, sol);
      ctx.lineTo(w, sol);
      ctx.stroke();
      /* Une petite maison… */
      var mx = w * 0.22;
      ctx.beginPath();
      ctx.rect(mx - w * 0.07, sol - h * 0.085, w * 0.14, h * 0.085);
      ctx.moveTo(mx - w * 0.09, sol - h * 0.085);
      ctx.lineTo(mx, sol - h * 0.155);
      ctx.lineTo(mx + w * 0.09, sol - h * 0.085);
      ctx.closePath();
      ctx.fillStyle = '#2e3a6e';
      ctx.fill();
      ctx.strokeStyle = 'rgba(233, 237, 248, 0.45)';
      ctx.stroke();
      /* …sa fenêtre allumée… */
      ctx.fillStyle = '#ffcf5c';
      ctx.fillRect(mx - w * 0.022, sol - h * 0.062, w * 0.044, h * 0.038);
      /* …et deux sapins. */
      [0.68, 0.82].forEach(function (fx) {
        var sx = w * fx;
        ctx.beginPath();
        ctx.moveTo(sx - w * 0.055, sol);
        ctx.lineTo(sx, sol - h * 0.14);
        ctx.lineTo(sx + w * 0.055, sol);
        ctx.closePath();
        ctx.fillStyle = '#26437a';
        ctx.fill();
        ctx.strokeStyle = 'rgba(233, 237, 248, 0.4)';
        ctx.stroke();
      });
    }
  };
}
