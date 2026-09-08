/*
 * Le disque de la Lune, partagé par le hublot (la Lune vue du jardin), la vue
 * de l'espace et le médaillon mobile. Style « livre illustré » : une boule
 * ivoire qui prend du volume au bord, six cratères cartoon, un terminateur
 * adouci par bandes, et le côté nuit à peine deviné (la lumière cendrée que la
 * Terre lui renvoie).
 *
 * Le dessin complet de la Lune pleine coûte cher (dégradés, cratères) : il se
 * pré-rend UNE fois par rayon dans une image mémoire (creerCacheLune), et
 * chaque image de l'animation ne fait plus que découper cette image selon la
 * phase. Rien ici ne dépend du soir : la forme vient du modèle (formeLune).
 *
 * Portable partout : arcs, dégradés, découpe par chemin, fill('evenodd') —
 * pas de ctx.ellipse, ni filter, ni shadowBlur, ni Path2D.
 */
import { TAU } from './model.js';

/* Le côté nuit de la Lune : plus clair que le ciel, pour qu'on la devine. */
export var LUNE_SOMBRE = '#1a2038';

/* Les six cratères, en fraction du rayon : [x, y, r]. */
var CRATERES = [
  [-0.32, -0.30, 0.17], [0.30, -0.12, 0.12], [-0.05, 0.36, 0.20],
  [0.42, 0.42, 0.09], [-0.55, 0.30, 0.08], [0.12, -0.60, 0.07]
];

/* Dessine la Lune PLEINE (toute éclairée) dans le disque (cx, cy, R).
 * `nue` : sans cratères (le médaillon de 60 px, où ils ne feraient que des
 * taches). */
export function dessinerLunePleine(ctx, cx, cy, R, nue) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.clip();
  /* La pâte : blanc chaud, un peu plus lumineux en haut à gauche, à peine
   * assombri au bord (la Lune est une boule, pas un rond). Le bord reste
   * CLAIR : un croissant est entièrement fait du bord — avec un bord beige,
   * la Lune la plus fine du mois était aussi la plus terne. */
  var base = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.1, cx, cy, R * 1.05);
  base.addColorStop(0, '#fffdf5');
  base.addColorStop(0.55, '#f4f0e4');
  base.addColorStop(1, '#e2dcc9');
  ctx.fillStyle = base;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  if (!nue) {
    for (var i = 0; i < CRATERES.length; i++) {
      var c = CRATERES[i];
      var x = cx + c[0] * R;
      var y = cy + c[1] * R;
      var r = c[2] * R;
      /* le fond, deux disques décalés pour l'ombre intérieure — contraste
       * modéré (60 % du premier jet) : à la pleine lune, sans ombre portée,
       * les cratères accrochaient l'œil avant la forme */
      ctx.fillStyle = 'rgba(150, 150, 160, 0.18)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(120, 120, 140, 0.13)';
      ctx.beginPath();
      ctx.arc(x + r * 0.12, y + r * 0.14, r * 0.78, 0, TAU);
      ctx.fill();
      /* le rebord clair, côté lumière (en haut à gauche) */
      ctx.strokeStyle = 'rgba(255, 253, 245, 0.42)';
      ctx.lineWidth = Math.max(1, r * 0.16);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.98, Math.PI * 0.8, Math.PI * 1.7);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* Une image mémoire de la Lune pleine, refaite seulement quand le rayon
 * change (redimensionnement) : chaque vue en garde une. */
export function creerCacheLune(nue) {
  var image = null;
  var rayon = -1;
  return {
    /* L'image (canvas hors écran, côté 2R + marge) pour le rayon R. */
    obtenir: function (R) {
      var r = Math.ceil(R);
      if (image && r === rayon) return image;
      rayon = r;
      image = document.createElement('canvas');
      image.width = r * 2 + 4;
      image.height = r * 2 + 4;
      var ictx = image.getContext('2d');
      dessinerLunePleine(ictx, r + 2, r + 2, R, nue);
      return image;
    }
  };
}

/* Copie l'image de la Lune pleine centrée en (cx, cy). */
function poserLunePleine(ctx, image, cx, cy) {
  ctx.drawImage(image, cx - image.width / 2, cy - image.height / 2);
}

/* Le chemin de la partie éclairée : le limbe éclairé (du haut au bas, en
 * passant par le côté éclairé), puis le terminateur — un arc à l'échelle k en
 * x, astuce compatible partout, sans ctx.ellipse. */
function cheminEclaire(ctx, cx, cy, R, forme, k) {
  ctx.beginPath();
  if (forme.fraction >= 0.995) {
    ctx.arc(cx, cy, R, 0, TAU);
    return;
  }
  /* |k| trop petit → scale(0) : on borne (epsilon géométrique explicite). */
  if (Math.abs(k) < 0.004) k = k >= 0 ? 0.004 : -0.004;
  if (k > 0.999) k = 0.999;
  if (k < -0.999) k = -0.999;
  var versLaGauche = forme.cote === 'gauche';
  ctx.arc(cx, cy, R, -Math.PI / 2, Math.PI / 2, versLaGauche);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, 1);
  ctx.arc(0, 0, R, Math.PI / 2, -Math.PI / 2, true);
  ctx.restore();
  ctx.closePath();
}

/* Dessine le disque de la Lune en phase, à partir de l'image pré-rendue de la
 * Lune pleine (`cache`, voir creerCacheLune). La forme vient du modèle :
 * { fraction, cote, k }. */
export function dessinerDisqueLune(ctx, cx, cy, R, forme, cache) {
  var image = cache.obtenir(R);
  /* Le côté nuit : sombre, mais on y devine la surface (lumière cendrée). */
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fillStyle = LUNE_SOMBRE;
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.07;
  poserLunePleine(ctx, image, cx, cy);
  ctx.restore();

  var f = forme.fraction;
  if (f > 0.005) {
    ctx.save();
    cheminEclaire(ctx, cx, cy, R, forme, forme.k);
    ctx.clip();
    poserLunePleine(ctx, image, cx, cy);
    ctx.restore();

    /* Le terminateur adouci : des bandes de pénombre entre le terminateur k
     * et un terminateur rapproché du côté éclairé. Chaque bande est « disque
     * moins région(kk) » (règle evenodd), découpée dans région(k). Le nombre
     * de bandes suit la taille : environ 2 px chacune (4 à 16), sinon sur la
     * grande Lune d'un ordinateur quatre bandes de 10 px faisaient un
     * escalier visible. La noirceur totale au terminateur reste la même
     * (~31 %) quel que soit le nombre de bandes. */
    if (f < 0.995) {
      var dir = forme.cote === 'gauche' ? -1 : 1;
      /* la pénombre ne mange jamais plus de 30 % de la partie éclairée : un
       * croissant de 7 % (soir 3) garde son fil clair, sans rayures */
      var largeur = Math.min(0.14, 0.3 * (1 - Math.abs(forme.k)));
      var n = Math.max(4, Math.min(16, Math.round((largeur * R) / 2)));
      var alpha = 1 - Math.pow(0.686, 1 / n);
      ctx.fillStyle = 'rgba(20, 24, 40, ' + alpha.toFixed(4) + ')';
      for (var b = 1; b <= n; b++) {
        var kk = forme.k + dir * (largeur * b) / n;
        if (kk > 0.999 || kk < -0.999) continue;
        ctx.save();
        cheminEclaire(ctx, cx, cy, R, forme, forme.k);
        ctx.clip();
        cheminEclaire(ctx, cx, cy, R, forme, kk);
        ctx.arc(cx, cy, R + 1, 0, TAU);
        ctx.fill('evenodd');
        ctx.restore();
      }
    }
  }

  /* Le limbe : un liseré très discret qui détache la Lune du ciel. */
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.strokeStyle = 'rgba(233, 237, 248, 0.16)';
  ctx.lineWidth = Math.max(1, R * 0.012);
  ctx.stroke();
}
