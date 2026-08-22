// Corpus vocal de « Pourquoi la Lune change de forme ? » : la liste des blocs
// parlés (id stable + texte oral), partagée par tools/build-voix.mjs
// (génération ElevenLabs) et test/voix.test.mjs (cohérence manifeste ↔ textes
// du site).
//
// L'outil vient de ou-va-le-soleil (l'implémentation canonique de la
// famille) : seule cette fonction corpus() est propre à l'épisode — elle
// décrit où vivent les textes d'ICI.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SCENARIOS, DEFIS, consigneDefi, bravoDefi, texteOral } from '../js/model.js';

// Tous les blocs que le conteur peut dire, avec les MÊMES ids que js/main.js.
export function corpus() {
  const blocs = [];
  // la grande histoire : un bloc par paragraphe de la boîte d'explication
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const zone = html.match(/<div id="texte-explication"[^>]*>([\s\S]*?)<\/div>/);
  if (!zone) throw new Error('texte-explication introuvable dans index.html');
  const paras = zone[1].match(/<p>[\s\S]*?<\/p>/g) || [];
  paras.forEach((p, i) => {
    blocs.push({ id: 'histoire-' + (i + 1), texte: texteOral(p.replace(/<[^>]+>/g, ' ')) });
  });
  // les quatre moments-clés : un bloc unique par scénario (sa version orale,
  // avec ses enchaînements — pas de transitions séparées dans cet épisode)
  for (const s of SCENARIOS) {
    blocs.push({ id: 'scn-' + s.id, texte: texteOral(s.oral) });
  }
  // le jeu « Attrape la bonne Lune » : consigne et bravo de chaque défi
  // (phrases générées du modèle — des phrases pleines, pas de fragments,
  // donc aucun contexte `precedent` à envoyer)
  for (const d of DEFIS) {
    blocs.push({ id: 'defi-' + d.cible + '-consigne', texte: texteOral(consigneDefi(d)) });
    blocs.push({ id: 'defi-' + d.cible + '-bravo', texte: texteOral(bravoDefi(d)) });
  }
  return blocs;
}

// Empreinte courte d'un texte : le manifeste s'en sert pour savoir quels
// blocs régénérer quand un texte du site change.
export function hashTexte(t) {
  return createHash('sha1').update(t, 'utf8').digest('hex').slice(0, 12);
}

// L'empreinte d'un bloc couvre aussi son amorce de prosodie éventuelle :
// changer le contexte previous_text change le rendu, donc doit régénérer.
export function empreinteBloc(b) {
  return hashTexte(b.texte + (b.precedent ? '\n@\n' + b.precedent : ''));
}
