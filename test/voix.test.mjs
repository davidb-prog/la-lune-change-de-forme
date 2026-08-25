// Tests de la voix du conteur — zéro dépendance : `node test/voix.test.mjs`
// Le corpus vocal (blocs id + texte oral) et, quand les fichiers enregistrés
// existent, la cohérence manifeste ↔ textes du site : la voix enregistrée ne
// doit JAMAIS dire autre chose que ce que le site affiche.
//
// Contrairement à la-terre-tourne (textes générés, couverture par
// énumération), tout ce que cet épisode peut dire est écrit main : la
// couverture re-déroule simplement chaque endroit où js/main.js donne la
// parole au conteur et vérifie que le bloc existe, avec le bon texte.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { corpus, empreinteBloc } from '../tools/voix-lib.mjs';
import { SCENARIOS, DEFIS, consigneDefi, bravoDefi, texteOral, EMOJI_RE } from '../js/model.js';

let failed = 0;
let passed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.error('  ✗ ' + name + (detail === undefined ? '' : ' — ' + detail)); }
}

console.log('Le texte oral (texteOral)');
check('les émojis disparaissent et le point se recolle',
  texteOral('La Lune brille 🌙 .') === 'La Lune brille.');
check('le point orphelin d’un émoji retiré après « ! » disparaît',
  texteOral('toute ronde ! 🌕.') === 'toute ronde !');
check('l’espace française avant « ! » et « : » est préservée',
  texteOral('Regarde ! Ce soir : rien.') === 'Regarde ! Ce soir : rien.');
check('les guillemets français disparaissent (la synthèse trébuche dessus)',
  texteOral('On dit qu’elle « disparaît »… en vrai') === 'On dit qu’elle disparaît… en vrai');
check('le tiret cadratin devient une virgule',
  texteOral('la Lune — toujours ronde — avance') === 'la Lune, toujours ronde, avance');
check('« 6 h 30 » se dit « 6 heures 30 » (fonction de la famille, même sans heure ici)',
  texteOral('à 6 h 30 puis 18 h pile') === 'à 6 heures 30 puis 18 heures pile' &&
  texteOral('à 1 h') === 'à 1 heure');

console.log('Le corpus vocal');
const blocs = corpus();
{
  const groupes = {};
  for (const b of blocs) {
    const g = b.id.split('-')[0];
    groupes[g] = (groupes[g] || 0) + 1;
  }
  check('l’ossature y est : 4 scénarios, 5 paragraphes d’histoire, 12 blocs de jeu',
    groupes.scn === 4 && groupes.histoire === 5 && groupes.defi === 12,
    JSON.stringify(groupes));
}
{
  const ids = {};
  const textes = {};
  let ok = true;
  let dup = false;
  for (const b of blocs) {
    if (ids[b.id]) ok = false;
    ids[b.id] = true;
    if (textes[b.texte]) dup = true;
    textes[b.texte] = true;
    if (!/^[a-z0-9-]+$/.test(b.id)) ok = false;
    if (!b.texte || b.texte.length < 5) ok = false;
  }
  check('identifiants uniques en kebab-case, textes non vides', ok);
  check('aucun texte enregistré deux fois sous deux ids (pas de crédits gâchés)', !dup);
}
// EMOJI_RE porte le drapeau /g (stateful avec .test) : on le clone sans
const emojiUne = new RegExp(EMOJI_RE.source, 'u');
check('aucun émoji dans les textes oraux',
  blocs.every((b) => !emojiUne.test(b.texte)));
check('aucune heure en chiffres (« N h ») — cet épisode parle en soirs, pas en heures',
  blocs.every((b) => !/\d\s*h\b/.test(b.texte)),
  blocs.filter((b) => /\d\s*h\b/.test(b.texte)).map((b) => b.id).join(', '));
check('aucun guillemet ni tiret cadratin dans les textes oraux',
  blocs.every((b) => !/[«»—]/.test(b.texte)));
check('apostrophes typographiques « ’ » partout (jamais le « \' » droit)',
  blocs.every((b) => b.texte.indexOf("'") === -1));
// Leçon de la famille : une ouverture d'un seul mot (« midi ! Mets… ») passe
// mal. « Bravo ! » est exempté : une vraie interjection, que la voix sait
// lancer — si l'écoute la signale quand même, c'est le texte ORAL du bravo
// qu'on retouche (l'écran garde le sien), pas ce lint qu'on supprime.
const ouvreSeul = (t) => /^[A-Za-zÀ-ÿ]+\s*[!?]/.test(t) && t.indexOf('Bravo !') !== 0;
check('jamais une ouverture d’un seul mot (la voix a besoin d’un appui) — sauf « Bravo ! »',
  blocs.every((b) => !ouvreSeul(b.texte)),
  blocs.filter((b) => ouvreSeul(b.texte)).map((b) => b.id).join(', '));
check('le corpus tient dans le plan Starter d’ElevenLabs (< 15 000 crédits)',
  blocs.reduce((n, b) => n + b.texte.length, 0) < 15000);

console.log('La couverture : tout ce que le site peut dire est dans le corpus');
{
  const parId = {};
  for (const b of blocs) parId[b.id] = b.texte;
  // les 4 moments-clés : narrateur.raconter('scn-' + s.id, s.oral)
  check('chaque scénario a son bloc, avec exactement le texte que le site dirait',
    SCENARIOS.every((s) => parId['scn-' + s.id] === texteOral(s.oral)),
    SCENARIOS.filter((s) => parId['scn-' + s.id] !== texteOral(s.oral)).map((s) => s.id).join(', '));
  // le jeu : consigne au nouveau défi, bravo à la victoire
  check('chaque défi a sa consigne et son bravo, aux textes du modèle',
    DEFIS.every((d) => parId['defi-' + d.cible + '-consigne'] === texteOral(consigneDefi(d)) &&
      parId['defi-' + d.cible + '-bravo'] === texteOral(bravoDefi(d))));
  // la boîte d'explication : un bloc par paragraphe, ids histoire-1…
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const zone = html.match(/<div id="texte-explication"[^>]*>([\s\S]*?)<\/div>/);
  const paras = (zone ? zone[1] : '').match(/<p>[\s\S]*?<\/p>/g) || [];
  check('chaque paragraphe de l’histoire a son bloc histoire-N, au texte exact',
    paras.length === 5 && paras.every((p, i) =>
      parId['histoire-' + (i + 1)] === texteOral(p.replace(/<[^>]+>/g, ' '))));
}

console.log('Le manifeste des fichiers enregistrés');
const manifeste = JSON.parse(readFileSync(new URL('../assets/audio/manifest.json', import.meta.url), 'utf8'));
const enregistres = Object.keys(manifeste.blocs);
if (enregistres.length === 0) {
  check('pas encore de fichiers enregistrés : le site lit tout à la synthèse (repli)', true);
} else {
  check('chaque bloc du corpus a son fichier enregistré',
    blocs.every((b) => manifeste.blocs[b.id]),
    blocs.filter((b) => !manifeste.blocs[b.id]).map((b) => b.id).slice(0, 5).join(', '));
  check('chaque fichier dit ENCORE le texte du site (texte et empreinte à jour)',
    blocs.every((b) => {
      const m = manifeste.blocs[b.id];
      return m && m.texte === b.texte && m.hash === empreinteBloc(b);
    }),
    blocs.filter((b) => {
      const m = manifeste.blocs[b.id];
      return !m || m.texte !== b.texte || m.hash !== empreinteBloc(b);
    }).map((b) => b.id).slice(0, 5).join(', '));
  check('aucun bloc fantôme dans le manifeste',
    enregistres.every((id) => blocs.some((b) => b.id === id)));
  const dossier = new URL('../assets/audio/', import.meta.url);
  check('tous les mp3 du manifeste existent sur le disque',
    enregistres.every((id) => existsSync(new URL(manifeste.blocs[id].fichier, dossier))));
  check('aucun mp3 orphelin dans assets/audio/',
    readdirSync(dossier).filter((f) => f.endsWith('.mp3'))
      .every((f) => enregistres.some((id) => manifeste.blocs[id].fichier === f)));
  check('la voix et le modèle sont notés dans le manifeste',
    typeof manifeste.voix === 'string' && manifeste.voix.length > 0 &&
    manifeste.modele === 'eleven_multilingual_v2');
}

console.log('');
if (failed > 0) {
  console.error(failed + ' test(s) en échec, ' + passed + ' réussi(s).');
  process.exit(1);
}
console.log('Tous les tests de la voix passent (' + passed + ').');
