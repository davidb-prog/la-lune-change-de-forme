// Corpus vocal de « Pourquoi la Lune change de forme ? » : la liste des blocs
// parlés (id stable + texte oral), partagée par tools/build-voix.mjs
// (génération ElevenLabs) et test/voix.test.mjs (cohérence manifeste ↔
// textes du site).
//
// Contrairement à la-terre-tourne (textes générés, corpus par énumération),
// tout ce que cet épisode peut dire est écrit main et fini : les 4 histoires
// des scénarios, les paragraphes de la boîte d'explication, et les consignes
// et bravos des 4 défis du jeu. Les ids sont EXACTEMENT ceux que js/main.js
// donne au conteur.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SCENARIOS, DEFIS, consigneDefi, bravoDefi, texteOral } from '../js/model.js';

// Tous les blocs que le conteur peut dire, avec les MÊMES ids que js/main.js.
export function corpus() {
  const parId = {};
  const blocs = [];
  const ajouter = (id, texteBrut) => {
    const texte = texteOral(texteBrut);
    if (parId[id]) {
      // même id, même texte : la déduplication attendue ; sinon, collision
      if (parId[id] !== texte) throw new Error('collision d’id de bloc : ' + id);
      return;
    }
    parId[id] = texte;
    blocs.push({ id: id, texte: texte });
  };
  // les 4 moments-clés, racontés en entier (champ `oral` du modèle)
  for (const scn of SCENARIOS) {
    ajouter('scn-' + scn.id, scn.oral);
  }
  // la boîte « Pourquoi la Lune change de forme ? » : un bloc par paragraphe
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const zone = html.match(/<div id="texte-explication"[^>]*>([\s\S]*?)<\/div>/);
  if (!zone) throw new Error('texte-explication introuvable dans index.html');
  const paras = zone[1].match(/<p>[\s\S]*?<\/p>/g) || [];
  paras.forEach((p, i) => {
    ajouter('histoire-' + (i + 1), p.replace(/<[^>]+>/g, ' '));
  });
  // le jeu : la consigne et le bravo de chaque défi
  for (const defi of DEFIS) {
    ajouter('defi-' + defi.cible + '-consigne', consigneDefi(defi));
    ajouter('defi-' + defi.cible + '-bravo', bravoDefi(defi));
  }
  return blocs;
}

// Empreinte courte d'un texte : le manifeste s'en sert pour savoir quels
// blocs régénérer quand un texte du site change.
export function hashTexte(t) {
  return createHash('sha1').update(t, 'utf8').digest('hex').slice(0, 12);
}

// L'empreinte d'un bloc couvre aussi son amorce de prosodie éventuelle
// (previous_text) : changer le contexte change le rendu, donc régénère.
export function empreinteBloc(b) {
  return hashTexte(b.texte + (b.precedent ? '\n@\n' + b.precedent : ''));
}
