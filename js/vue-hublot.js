/*
 * Le hublot « ce soir, dans le ciel » : la Lune telle qu'on la voit du jardin,
 * toujours synchronisée avec la vue du ciel. La forme vient du modèle
 * (formeLune) — la vue ne calcule rien elle-même.
 *
 * Le décor (ciel, étoiles, collines, maison et son enfant à la fenêtre,
 * arbres) ne dépend pas du soir : il est dessiné UNE fois dans une image
 * mémoire, refaite seulement quand le canvas change de taille. Chaque image
 * de l'animation copie le décor puis pose la Lune (elle-même pré-rendue, voir
 * lune-disque.js) : moins de travail par image que l'ancien dessin à plat.
 *
 * Même vue pour le médaillon mobile (option { medaillon: true }) : là, pas de
 * jardin ni de cratères — à 60 px, le médaillon montre la forme du soir, rien
 * d'autre.
 */
import { TAU, formeLune } from './model.js';
import { creerCacheLune, dessinerDisqueLune, LUNE_SOMBRE } from './lune-disque.js';

export { dessinerDisqueLune };

var CIEL_MEDAILLON = '#0a1024';

/* Étoiles décoratives, déterministes (petit générateur maison, graine fixe). */
function fabriquerEtoiles(n, graine) {
  var etoiles = [];
  var g = graine;
  function suivant() {
    g = (g * 1103515245 + 12345) % 2147483648;
    return g / 2147483648;
  }
  for (var i = 0; i < n; i++) {
    etoiles.push({ x: suivant(), y: suivant(), r: 0.35 + suivant() * 1.3, a: 0.2 + suivant() * 0.6, t: suivant() });
  }
  return etoiles;
}
var ETOILES = fabriquerEtoiles(110, 7);

/* Où se pose le disque de la Lune dans le hublot, pour une boîte w × h.
 * La vue s'en sert pour dessiner ; main.js s'en sert pour savoir si la Lune du
 * jardin est encore à l'écran — une seule géométrie, jamais deux copies. */
export function geometrieLune(w, h) {
  return { cx: w / 2, cy: h * 0.44, R: Math.min(w, h) * 0.3 };
}

/* Le sol du jardin, en fraction de la hauteur. */
var SOL = 0.86;

/* ---------- Le décor ---------- */

/* Une étoile : un point, et pour les plus grosses une petite croix. */
function etoile(ctx, x, y, r, a, t) {
  ctx.globalAlpha = a;
  ctx.fillStyle = t < 0.15 ? '#ffe9b8' : (t > 0.85 ? '#cfe0ff' : '#eef1fb');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  if (r > 1.3) {
    ctx.globalAlpha = a * 0.5;
    ctx.lineWidth = Math.max(0.5, r * 0.3);
    ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath();
    ctx.moveTo(x - r * 3, y); ctx.lineTo(x + r * 3, y);
    ctx.moveTo(x, y - r * 3); ctx.lineTo(x, y + r * 3);
    ctx.stroke();
  }
}

/* Une ligne de collines douces posée sur `sol`. */
function colline(ctx, w, sol, hauteur, amp, freq, phase, couleur) {
  ctx.beginPath();
  ctx.moveTo(0, sol + 2);
  var n = 40;
  for (var i = 0; i <= n; i++) {
    var x = (i / n) * w;
    var y = sol - hauteur - Math.sin((i / n) * freq * TAU + phase) * amp
      - Math.sin((i / n) * freq * 2.3 * TAU + phase * 1.7) * amp * 0.35;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, sol + 2);
  ctx.closePath();
  ctx.fillStyle = couleur;
  ctx.fill();
}

/* La maison : toit en tuiles débordant, cheminée qui fume, porte sombre,
 * deux fenêtres chaudes, et l'enfant à la grande fenêtre, de dos, qui regarde
 * la Lune. `s` : largeur du corps. */
function maison(ctx, x, sol, s) {
  var hCorps = s * 0.62;
  var hToit = s * 0.45;
  var deb = s * 0.12;
  /* la lueur des fenêtres sur le mur et l'herbe */
  var lueur = ctx.createRadialGradient(x, sol - hCorps * 0.45, s * 0.05, x, sol - hCorps * 0.45, s * 1.1);
  lueur.addColorStop(0, 'rgba(255, 207, 92, 0.22)');
  lueur.addColorStop(1, 'rgba(255, 207, 92, 0)');
  ctx.fillStyle = lueur;
  ctx.fillRect(x - s * 1.2, sol - hCorps - hToit - s * 0.3, s * 2.4, hCorps + hToit + s * 0.4);
  /* cheminée et fumée */
  ctx.fillStyle = '#2a3563';
  ctx.fillRect(x + s * 0.22, sol - hCorps - hToit * 0.95, s * 0.11, hToit * 0.7);
  ctx.fillStyle = 'rgba(200, 208, 235, 0.16)';
  var fx = x + s * 0.275;
  var fy = sol - hCorps - hToit * 0.95;
  [[0, -0.08, 0.05], [0.04, -0.2, 0.065], [0.11, -0.33, 0.08], [0.2, -0.47, 0.095]].forEach(function (p) {
    ctx.beginPath();
    ctx.arc(fx + p[0] * s, fy + p[1] * s, p[2] * s, 0, TAU);
    ctx.fill();
  });
  /* le corps, un peu plus clair en haut */
  ctx.fillStyle = '#334078';
  ctx.fillRect(x - s / 2, sol - hCorps, s, hCorps);
  var mur = ctx.createLinearGradient(0, sol - hCorps, 0, sol);
  mur.addColorStop(0, 'rgba(255, 255, 255, 0.07)');
  mur.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
  ctx.fillStyle = mur;
  ctx.fillRect(x - s / 2, sol - hCorps, s, hCorps);
  /* le toit en tuiles, débordant */
  function cheminToit() {
    ctx.beginPath();
    ctx.moveTo(x - s / 2 - deb, sol - hCorps);
    ctx.lineTo(x, sol - hCorps - hToit);
    ctx.lineTo(x + s / 2 + deb, sol - hCorps);
  }
  cheminToit();
  ctx.closePath();
  ctx.fillStyle = '#5a3f7a';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.lineWidth = Math.max(1, s * 0.012);
  for (var r = 1; r < 5; r++) {
    var yy = sol - hCorps - (hToit * r) / 5;
    ctx.beginPath();
    ctx.moveTo(x - s, yy);
    ctx.lineTo(x + s, yy);
    ctx.stroke();
  }
  ctx.restore();
  cheminToit();
  ctx.strokeStyle = 'rgba(233, 237, 248, 0.35)';
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.stroke();
  /* la porte : un panneau sombre en arche, un cadre à peine marqué, une
   * petite vitre ronde et une poignée tamisées — pas une ombre, pas une lampe */
  var pw = s * 0.17;
  var ph = hCorps * 0.6;
  var px = x + s * 0.2;
  function cheminPorte(marge) {
    ctx.beginPath();
    ctx.moveTo(px - pw / 2 - marge, sol);
    ctx.lineTo(px - pw / 2 - marge, sol - ph + pw / 2);
    ctx.arc(px, sol - ph + pw / 2, pw / 2 + marge, Math.PI, 0);
    ctx.lineTo(px + pw / 2 + marge, sol);
    ctx.closePath();
  }
  cheminPorte(s * 0.012);
  ctx.fillStyle = 'rgba(201, 208, 234, 0.18)';
  ctx.fill();
  cheminPorte(0);
  ctx.fillStyle = '#2b2452';
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 217, 122, 0.55)';
  ctx.beginPath();
  ctx.arc(px, sol - ph + pw / 2, pw * 0.22, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 217, 122, 0.7)';
  ctx.beginPath();
  ctx.arc(px + pw * 0.3, sol - ph * 0.45, Math.max(1, s * 0.01), 0, TAU);
  ctx.fill();
  /* les fenêtres à croisillons, lumière chaude */
  function fenetre(fx, fy, fw, fh) {
    var lum = ctx.createLinearGradient(fx, fy, fx, fy + fh);
    lum.addColorStop(0, '#ffe08a');
    lum.addColorStop(1, '#ffb347');
    ctx.fillStyle = lum;
    ctx.fillRect(fx, fy, fw, fh);
    ctx.strokeStyle = 'rgba(40, 30, 70, 0.7)';
    ctx.lineWidth = Math.max(1, s * 0.015);
    ctx.beginPath();
    ctx.moveTo(fx + fw / 2, fy); ctx.lineTo(fx + fw / 2, fy + fh);
    ctx.moveTo(fx, fy + fh / 2); ctx.lineTo(fx + fw, fy + fh / 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(233, 237, 248, 0.5)';
    ctx.strokeRect(fx, fy, fw, fh);
  }
  var gx = x - s * 0.36;
  var gy = sol - hCorps * 0.78;
  var gw = s * 0.22;
  var gh = hCorps * 0.36;
  fenetre(gx, gy, gw, gh);
  /* l'enfant à la grande fenêtre : tête ronde, épaules, une main sur la vitre,
   * en silhouette devant la lumière */
  ctx.save();
  ctx.beginPath();
  ctx.rect(gx, gy, gw, gh);
  ctx.clip();
  ctx.fillStyle = '#2a1f45';
  var ex = gx + gw * 0.55;
  var ey = gy + gh * 0.55;
  ctx.beginPath();
  ctx.arc(ex, ey, gw * 0.17, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(ex - gw * 0.34, gy + gh + 1);
  ctx.quadraticCurveTo(ex - gw * 0.34, ey + gw * 0.16, ex, ey + gw * 0.14);
  ctx.quadraticCurveTo(ex + gw * 0.34, ey + gw * 0.16, ex + gw * 0.34, gy + gh + 1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ex + gw * 0.3, ey - gw * 0.02, gw * 0.07, 0, TAU);
  ctx.fill();
  ctx.lineWidth = gw * 0.09;
  ctx.strokeStyle = '#2a1f45';
  ctx.beginPath();
  ctx.moveTo(ex + gw * 0.22, ey + gw * 0.3);
  ctx.lineTo(ex + gw * 0.3, ey + gw * 0.02);
  ctx.stroke();
  ctx.restore();
  fenetre(x - s * 0.02, sol - hCorps * 0.78, s * 0.14, hCorps * 0.28);
  /* l'œil-de-bœuf sous le toit */
  ctx.fillStyle = '#ffd97a';
  ctx.beginPath();
  ctx.arc(x, sol - hCorps - hToit * 0.38, s * 0.05, 0, TAU);
  ctx.fill();
}

/* Un grand feuillu : tronc, deux branches, houppier en silhouette bosselée
 * avec une frange de clair de Lune sur le dessus. */
function arbreRond(ctx, x, sol, h, couleurFeuille, couleurTronc) {
  var tronc = h * 0.06;
  ctx.fillStyle = couleurTronc;
  ctx.beginPath();
  ctx.moveTo(x - tronc, sol);
  ctx.lineTo(x - tronc * 0.7, sol - h * 0.45);
  ctx.lineTo(x + tronc * 0.7, sol - h * 0.45);
  ctx.lineTo(x + tronc, sol);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = couleurTronc;
  ctx.lineWidth = tronc * 0.8;
  ctx.beginPath();
  ctx.moveTo(x, sol - h * 0.4); ctx.lineTo(x - h * 0.16, sol - h * 0.6);
  ctx.moveTo(x, sol - h * 0.45); ctx.lineTo(x + h * 0.14, sol - h * 0.62);
  ctx.stroke();
  var bosses = [[0, -0.64, 0.34], [-0.24, -0.54, 0.24], [0.25, -0.55, 0.23], [-0.12, -0.80, 0.22], [0.13, -0.79, 0.21], [0, -0.45, 0.26]];
  function cheminHouppier() {
    ctx.beginPath();
    bosses.forEach(function (b) {
      ctx.moveTo(x + b[0] * h + b[2] * h, sol + b[1] * h);
      ctx.arc(x + b[0] * h, sol + b[1] * h, b[2] * h, 0, TAU);
    });
  }
  cheminHouppier();
  ctx.fillStyle = couleurFeuille;
  ctx.fill();
  ctx.save();
  cheminHouppier();
  ctx.clip();
  var frange = ctx.createLinearGradient(0, sol - h * 1.02, 0, sol - h * 0.5);
  frange.addColorStop(0, 'rgba(200, 210, 240, 0.16)');
  frange.addColorStop(1, 'rgba(200, 210, 240, 0)');
  ctx.fillStyle = frange;
  ctx.fillRect(x - h, sol - h * 1.1, h * 2, h);
  ctx.restore();
}

/* Un sapin : trois étages aux bords légèrement courbés. */
function sapin(ctx, x, sol, h, couleur) {
  ctx.fillStyle = '#24305c';
  ctx.fillRect(x - h * 0.035, sol - h * 0.12, h * 0.07, h * 0.12);
  [[0.10, 0.48, 0.30], [0.36, 0.72, 0.24], [0.58, 0.98, 0.16]].forEach(function (e) {
    var yb = sol - h * e[0];
    var yt = sol - h * e[1];
    var demi = h * e[2];
    ctx.beginPath();
    ctx.moveTo(x, yt);
    ctx.quadraticCurveTo(x + demi * 0.55, (yt + yb) / 2 + (yb - yt) * 0.15, x + demi, yb);
    ctx.quadraticCurveTo(x + demi * 0.5, yb - (yb - yt) * 0.08, x + demi * 0.2, yb);
    ctx.lineTo(x - demi * 0.2, yb);
    ctx.quadraticCurveTo(x - demi * 0.5, yb - (yb - yt) * 0.08, x - demi, yb);
    ctx.quadraticCurveTo(x - demi * 0.55, (yt + yb) / 2 + (yb - yt) * 0.15, x, yt);
    ctx.closePath();
    ctx.fillStyle = couleur;
    ctx.fill();
  });
  ctx.strokeStyle = 'rgba(200, 210, 240, 0.12)';
  ctx.lineWidth = Math.max(1, h * 0.012);
  ctx.beginPath();
  ctx.moveTo(x, sol - h * 0.98);
  ctx.lineTo(x - h * 0.16, sol - h * 0.58);
  ctx.stroke();
}

function buisson(ctx, x, sol, s, couleur) {
  ctx.fillStyle = couleur;
  [[0, 0, 0.5], [-0.45, 0.1, 0.36], [0.45, 0.12, 0.34], [0.15, -0.25, 0.32], [-0.2, -0.22, 0.3]].forEach(function (b) {
    ctx.beginPath();
    ctx.arc(x + b[0] * s, sol - s * 0.35 + b[1] * s, b[2] * s, 0, TAU);
    ctx.fill();
  });
}

/* La clôture à piquets (grand écran seulement : en bandeau mobile elle ne
 * serait plus qu'un pointillé). */
function cloture(ctx, x0, x1, sol, h) {
  ctx.strokeStyle = '#3a4a86';
  ctx.fillStyle = '#3a4a86';
  ctx.lineWidth = Math.max(1.2, h * 0.09);
  var n = Math.max(3, Math.round((x1 - x0) / (h * 0.55)));
  for (var i = 0; i <= n; i++) {
    var x = x0 + ((x1 - x0) * i) / n;
    ctx.beginPath();
    ctx.moveTo(x, sol);
    ctx.lineTo(x, sol - h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - h * 0.08, sol - h);
    ctx.lineTo(x, sol - h * 1.15);
    ctx.lineTo(x + h * 0.08, sol - h);
    ctx.fill();
  }
  ctx.lineWidth = Math.max(1, h * 0.07);
  ctx.beginPath();
  ctx.moveTo(x0, sol - h * 0.35); ctx.lineTo(x1, sol - h * 0.35);
  ctx.moveTo(x0, sol - h * 0.75); ctx.lineTo(x1, sol - h * 0.75);
  ctx.stroke();
}

function herbe(ctx, w, sol, h, graine) {
  var g = graine;
  function alea() {
    g = (g * 1103515245 + 12345) % 2147483648;
    return g / 2147483648;
  }
  ctx.strokeStyle = 'rgba(90, 110, 180, 0.55)';
  ctx.lineWidth = Math.max(1, h * 0.1);
  ctx.lineCap = 'round';
  for (var i = 0; i < 26; i++) {
    var x = alea() * w;
    var hh = h * (0.5 + alea());
    var pente = (alea() - 0.5) * hh * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, sol + 1);
    ctx.quadraticCurveTo(x + pente * 0.3, sol - hh * 0.6, x + pente, sol - hh);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

/* Tout ce qui ne dépend pas du soir, pour une boîte w × h (pixels canvas). */
function dessinerDecor(ctx, w, h, dpr) {
  var sol = h * SOL;
  /* le bandeau mobile 13/6 : le jardin se serre */
  var compact = h / w < 0.6;

  /* Le ciel : plus profond en haut, une brume bleutée à l'horizon. */
  var ciel = ctx.createLinearGradient(0, 0, 0, h);
  ciel.addColorStop(0, '#04060f');
  ciel.addColorStop(0.5, '#0a1024');
  ciel.addColorStop(0.86, '#141c45');
  ciel.addColorStop(1, '#1a2454');
  ctx.fillStyle = ciel;
  ctx.fillRect(0, 0, w, h);
  /* une voie lactée très discrète, en diagonale */
  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);
  ctx.rotate(-0.55);
  var vl = ctx.createLinearGradient(0, -h * 0.22, 0, h * 0.22);
  vl.addColorStop(0, 'rgba(180, 190, 240, 0)');
  vl.addColorStop(0.5, 'rgba(180, 190, 240, 0.06)');
  vl.addColorStop(1, 'rgba(180, 190, 240, 0)');
  ctx.fillStyle = vl;
  ctx.fillRect(-w, -h * 0.22, w * 2, h * 0.44);
  ctx.restore();
  /* les étoiles, jamais sous l'horizon */
  for (var i = 0; i < ETOILES.length; i++) {
    var e = ETOILES[i];
    etoile(ctx, e.x * w, e.y * sol * 0.98, e.r * dpr, e.a, e.t);
  }
  ctx.globalAlpha = 1;

  /* Le jardin : collines lointaines, puis le pré en léger dôme. */
  var hauteur = h * 0.06;
  colline(ctx, w, sol, hauteur * 1.4, hauteur * 0.9, 1.3, 0.8, '#101740');
  colline(ctx, w, sol, hauteur * 0.6, hauteur * 0.7, 1.9, 2.6, '#141d4d');
  var pre = ctx.createLinearGradient(0, sol, 0, h);
  pre.addColorStop(0, '#1d2a5e');
  pre.addColorStop(1, '#101736');
  ctx.fillStyle = pre;
  ctx.beginPath();
  ctx.moveTo(0, sol + h * 0.01);
  ctx.quadraticCurveTo(w * 0.5, sol - h * 0.015, w, sol + h * 0.008);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  var s = compact ? h * 0.22 : Math.min(w * 0.17, h * 0.17);
  var hArbre = compact ? h * 0.30 : Math.min(w, h) * 0.21;
  buisson(ctx, w * 0.5, sol, s * 0.32, '#1a2657');
  if (!compact) cloture(ctx, w * 0.34, w * 0.58, sol, hArbre * 0.16);
  maison(ctx, w * 0.2, sol, s);
  /* les arbres, à droite, hors du disque de la Lune (qui va jusqu'à ~0,79 w) */
  arbreRond(ctx, w * 0.87, sol, hArbre, '#1f3a6a', '#22284f');
  sapin(ctx, w * 0.965, sol, hArbre * 0.72, '#1b3460');
  buisson(ctx, w * 0.78, sol, s * 0.26, '#1a2657');
  buisson(ctx, w * 0.06, sol, s * 0.3, '#1c2a5c');
  herbe(ctx, w, sol, h * 0.02, 5);
}

/* ---------- La vue ---------- */

export function creerVueHublot(canvas, options) {
  var ctx = canvas.getContext('2d');
  var medaillon = !!(options && options.medaillon);
  var cacheLune = creerCacheLune(medaillon);
  var decor = null;
  var decorW = 0;
  var decorH = 0;

  function obtenirDecor(w, h) {
    if (decor && decorW === w && decorH === h) return decor;
    decor = document.createElement('canvas');
    decor.width = w;
    decor.height = h;
    decorW = w;
    decorH = h;
    dessinerDecor(decor.getContext('2d'), w, h, window.devicePixelRatio || 1);
    return decor;
  }

  function rendreMedaillon(w, h, forme) {
    ctx.fillStyle = CIEL_MEDAILLON;
    ctx.fillRect(0, 0, w, h);
    var R = Math.min(w, h) * 0.36;
    dessinerDisqueLune(ctx, w / 2, h / 2, R, forme, cacheLune);
  }

  return {
    rendre: function (jour) {
      var w = canvas.width;
      var h = canvas.height;
      if (w === 0 || h === 0) return;
      var forme = formeLune(jour);
      if (medaillon) {
        rendreMedaillon(w, h, forme);
        return;
      }
      ctx.drawImage(obtenirDecor(w, h), 0, 0);

      var geo = geometrieLune(w, h);
      var sol = h * SOL;
      /* Le halo de la Lune, proportionnel à sa lumière, dans le ciel seulement —
       * avec un plancher (comme une Lune à 30 %) : un croissant garde une
       * lueur, sinon la Lune la plus fine du mois est aussi la plus terne. */
      var lumiere = Math.max(forme.fraction, 0.3);
      if (forme.fraction > 0.02) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, sol);
        ctx.clip();
        var halo = ctx.createRadialGradient(geo.cx, geo.cy, geo.R * 0.8, geo.cx, geo.cy, geo.R * 2.6);
        halo.addColorStop(0, 'rgba(242, 238, 223, ' + (0.28 * lumiere) + ')');
        halo.addColorStop(0.4, 'rgba(242, 238, 223, ' + (0.08 * lumiere) + ')');
        halo.addColorStop(1, 'rgba(242, 238, 223, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(geo.cx - geo.R * 2.6, geo.cy - geo.R * 2.6, geo.R * 5.2, geo.R * 5.2);
        ctx.restore();
        /* …et son clair de Lune sur l'herbe. */
        var lum = ctx.createRadialGradient(geo.cx, sol, w * 0.05, geo.cx, sol, w * 0.5);
        lum.addColorStop(0, 'rgba(190, 200, 240, ' + (0.10 * forme.fraction) + ')');
        lum.addColorStop(1, 'rgba(190, 200, 240, 0)');
        ctx.fillStyle = lum;
        ctx.fillRect(0, sol - 2, w, h - sol + 2);
      }
      dessinerDisqueLune(ctx, geo.cx, geo.cy, geo.R, forme, cacheLune);
    }
  };
}

/* Réexporté pour les tests visuels : la couleur du côté nuit. */
export { LUNE_SOMBRE };
