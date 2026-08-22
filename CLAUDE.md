# CLAUDE.md — Pourquoi la Lune change de forme ?

**Petit labo d'astronomie.** Site statique d'une page, en français,
qui explique les phases de la Lune à un enfant d'environ 5 ans. Le parent lit à
voix haute ; l'enfant attrape la Lune et la fait tourner autour de la Terre.

## Contraintes (non négociables)

- **Zéro dépendance, zéro build** : HTML + CSS + JS vanilla (modules ES),
  canvas 2D dessiné à la main. La page s'ouvre avec `python3 -m http.server`
  et se déploie telle quelle sur GitHub Pages.
- **Compat mobiles anciens** : pas d'optional chaining `?.` ni de nullish `??`,
  pas de lookbehind regex, repli `@supports` pour `aspect-ratio`,
  `top/right/bottom/left` plutôt qu'`inset`, `touch-action: none` sur le canvas
  interactif **doublé d'un repli JS** (`touchstart`/`touchmove` non passifs qui
  font `preventDefault` — les vieux mobiles ignorent `touch-action` et volent
  le geste pour défiler). Tester à 390 px de large.
- **`js/model.js` est pur** (aucun accès DOM) : toutes les constantes du récit
  (cycle, seuils de phases, scénarios, défis, phrases générées) vivent dedans.
  Il se teste avec `node test/model.test.mjs`.
- **Boucle rAF résiliente** : le `requestAnimationFrame` suivant se planifie
  dans un `try/finally`.
- **`prefers-reduced-motion` respecté** : les animations de scénario deviennent
  des sauts secs, le halo « attrape-moi » ne pulse plus.
- **Public 5 ans** : phrases courtes, apostrophe typographique « ' », zéro
  jargon côté enfant (« presque pleine », pas « gibbeuse » — le mot savant va
  dans la note aux parents).

## L'idée centrale (la vérité à préserver)

> La Lune ne change pas vraiment de forme : elle est toujours à moitié éclairée
> par le Soleil. C'est nous qui la voyons d'un côté différent chaque nuit,
> pendant qu'elle tourne autour de la Terre.

Vérités verrouillées par `test/model.test.mjs` (à compléter, jamais supprimer) :

1. la moitié éclairée fait toujours face au Soleil ;
2. Lune entre Terre et Soleil → nouvelle lune ; Terre entre Soleil et Lune →
   pleine lune ;
3. l'ordre des phases ne s'inverse jamais ; la fraction éclairée croît jusqu'à
   la pleine lune puis décroît ;
4. le cycle affiché dure 29,5 jours et reboucle proprement ;
5. Lune croissante → côté droit éclairé, décroissante → côté gauche
   (hémisphère nord).

## Géométrie du modèle

- Coordonnées **mathématiques** (y vers le haut) dans le modèle ; les vues font
  la bascule canvas (y vers le bas).
- Le Soleil est **fixe**, très loin, direction `SOLEIL_DIR = (−1, 0)` (à gauche).
- Jour 0 = nouvelle lune. La page démarre au soir `JOUR_DEPART` (2,5 —
  premier croissant) : une Lune visible d'emblée, le ciel du jour 0 serait
  vide. `positionLune(jour) = (−cos θ, −sin θ)` avec
  `θ = jour / 29,5 · τ` (sens trigonométrique, le vrai sens vu du pôle Nord).
- Fraction éclairée vue de la Terre : `(1 − cos θ) / 2`.
- Forme du disque (hublot) : `formeLune(jour)` → `{ fraction, cote, k }` avec
  `k = dir · (1 − 2·fraction)` (demi-axe signé du terminateur, en fraction du
  rayon) — le hublot ne calcule rien lui-même.

## Invariants d'interaction

- **Le Soleil ne bouge jamais à l'écran** (objet-repère de la série) — sonde de
  pixels dans la suite navigateur.
- **Glisser fait avancer le phénomène** : attraper la Lune la déplace sur son
  orbite ; le curseur maître fait la même chose. Les deux vues (ciel + hublot)
  restent **synchronisées en permanence** sur le même `etat.jour`.
- **Les scénarios vont au moment choisi en douceur, toujours vers l'avant**
  (le vrai sens de l'orbite) ; en `prefers-reduced-motion`, saut sec. Sur
  mobile, taper une vignette **remonte doucement la page à la vue de
  l'espace** pour regarder le voyage (défilement sec en mouvement réduit,
  rien sur grand écran où les deux vues sont déjà sous les yeux).
- **Reprendre la main efface l'histoire** : bouger le curseur ou la Lune ferme
  la micro-histoire du scénario et désarme son `aria-pressed`.
- **Le jeu ne se gagne qu'en manœuvrant soi-même** (pas pendant une animation
  de scénario), et il faut **rester un instant sur la bonne forme**
  (`DEFI_ATTENTE_MS`) : un tour de Lune qui traverse la fenêtre sans
  s'arrêter ne gagne pas « en passant ». Le bravo **ne ment jamais** : il
  s'efface quand l'enfant
  repart faire tourner la Lune, revient si la bonne forme est refabriquée ;
  « Encore une ! » reste acquis. Le jeu est **sonore** via le même bouton
  🔇/🔊 que les scénarios (consigne au nouveau défi, bravo à la victoire —
  `consigneDefi`/`bravoDefi` du modèle).
- **Sur mobile (< 880 px) seulement** : le hublot se compacte en bandeau
  paysage (13/6, la Lune au-dessus du jardin) — jamais collant : épinglé en
  haut, il cacherait la vue de l'espace au niveau des boutons-scénarios. La
  vue de l'espace passe en carré (l'orbite plus grande sous le doigt). Un
  médaillon flottant (haut droit, hors du chemin du pouce) prend le relais
  dès que la **carte** du hublot est entièrement sortie de l'écran (jamais
  avant : il recouvrirait la phrase du soir). Le médaillon est
  un **mini hublot** (ciel, Lune, jardin) cerclé d'or — le violet reste
  réservé à la Lune attrapable, pour qu'on ne les confonde pas. Un tap y
  ramène au jardin, sauf pendant le jeu où il n'est qu'un afficheur (remonter
  sortirait l'enfant du jeu). Le jeu n'affiche qu'une seule vue (l'espace),
  sans rien d'incrusté dans le canvas : c'est le médaillon qui montre le
  résultat, il reste donc visible pendant le jeu. La boîte « Pourquoi la Lune
  change de forme ? » se **replie** sur mobile (repliée au chargement, comme
  la note aux parents ; toujours ouverte sur ordinateur, `main.js` y veille).
  Rien de tout cela n'existe sur grand écran.

## Le conteur (voix enregistrée + synthèse en repli)

Voir la charte de la famille : moteur unique `narrateur` (générations pour
invalider les lectures annulées), découpage en phrases, ton (rate/pitch selon
la ponctuation), score des voix françaises (fr-FR > fr > fr-CA, bonus
naturelles/neurales, malus robotiques), menu 🗣 si ≥ 2 voix (choix en
`localStorage`), textes `oral` sans émoji avec espaces recollées avant la
ponctuation (`texteOral()` du modèle, partagée site/outil/tests),
`visibilitychange`+`pagehide` → `narrateur.stop()` (qui coupe synthèse ET
mp3). Sans synthèse, les boutons sonores se cachent et le site reste complet.

## La voix enregistrée (ElevenLabs)

Le conteur joue des **mp3 commités** dans `assets/audio/` quand ils existent ;
la synthèse reste le repli permanent. L'implémentation canonique et le guide
vivant de la famille sont dans `ou-va-le-soleil`
(`docs/voix-conteur.md`) ; ici, seul `corpus()` de `tools/voix-lib.mjs` est
propre à l'épisode. Règles dures :

- **Le site reste 100 % statique** : mp3 générés HORS site par
  `tools/build-voix.mjs` (Node ≥ 18, zéro dépendance, `ELEVENLABS_API_KEY` +
  `ELEVENLABS_VOICE_ID` en variables d'environnement — jamais commitées).
  Modèle `eleven_multilingual_v2`, sortie 64 kb/s.
- **La clé API vit sur la machine de David** (`~/.zshrc`), JAMAIS dans un
  cloud environment (`api.elevenlabs.io` y est bloqué par le réseau). Clé
  dédiée scope Text-to-Speech, plafond ≈ 10 000 caractères/mois, expiration
  ≤ 30 jours. La génération se fait en local ; depuis le cloud on prépare
  corpus et outillage, puis on passe la main.
- **La voix enregistrée ne ment jamais** : `assets/audio/manifest.json` stocke
  le texte oral exact de chaque bloc ; `audioSrc(id, texte)` dans `main.js` ne
  joue un mp3 que si son texte correspond ENCORE à l'écran (sinon repli
  synthèse), et `node test/voix.test.mjs` échoue si un texte a changé sans
  régénération.
- **Le corpus : 17 blocs** (~1 700 crédits) — `histoire-1…5` (paragraphes de
  la boîte d'explication), `scn-<id>` (les 4 scénarios, un bloc unique chacun,
  pas de transitions parlées ici), `defi-<cible>-consigne`/`-bravo` (phrases
  générées `consigneDefi`/`bravoDefi`). Des phrases pleines partout : aucun
  fragment, aucun `previous_text`.
- **Discipline de commit des mp3** (git ne delta-compresse pas l'audio) : les
  essais vont dans `tools/essais/` (gitignoré, comme `tools/ecoute.html`), et
  `assets/audio/` se commit en UNE fois, après validation à l'écoute.
- **Figer les textes avant d'enregistrer** : tout changement de texte après
  coup rejoue la loterie sur son bloc (`--only <id>` pour re-tirer une prise).
- L'artefact de test embarque manifeste et sons en data URI
  (`window.__VOIX_MANIFESTE`, lu avant le `fetch` du manifeste).

## Structure

```
index.html          la page unique
css/style.css       palette commune de la série astronomie (fond nuit)
js/model.js         modèle pur + constantes du récit
js/vue-orbite.js    vue du ciel (Soleil fixe, orbite, geste-signature)
js/vue-hublot.js    la Lune vue du jardin (dessinerDisqueLune)
js/main.js          câblage : boucle rAF, curseur, scénarios, conteur, jeu
assets/audio/       voix enregistrée du conteur (mp3 + manifest.json)
tools/build-voix.mjs génération ElevenLabs hors site (idempotente, --dry-run…)
tools/voix-lib.mjs  corpus() des blocs parlés — la seule partie propre à l'épisode
test/model.test.mjs tests du modèle (Node)
test/voix.test.mjs  tests de la voix (corpus oral + cohérence du manifeste)
docs/               captures d'écran du README
```

## Vérification navigateur

Suite Playwright maintenue **hors dépôt** (scratchpad de session,
`test-site.js`) : quatre passes — desktop 1200 px, `reducedMotion: 'reduce'`,
mobile 390 px (`hasTouch`, `isMobile`), et « voix enregistrée simulée »
(manifeste injecté via `window.__VOIX_MANIFESTE`, `play()` instrumenté : le
bloc au texte exact joue son fichier, le texte périmé retombe sur la
synthèse). Vérifie la structure, le
geste-signature (glisser simulé), la synchronisation des vues, l'effacement de
l'histoire, le câblage du son, le jeu, zéro erreur console, pas de débordement
horizontal, et des sondes de pixels (le Soleil doré fixe à gauche ; hublot
lumineux à la pleine lune, sombre à la nouvelle). Servir avant :
`python3 -m http.server 8123`. Régénérer les captures `docs/*.png` à chaque
évolution visuelle (variable `CAPTURES=docs`).

## La série

Pieds de page croisés avec : `eclipse-explorer`, `ou-va-le-soleil`,
`la-terre-tourne`. En publiant cet épisode, ajouter son lien dans les pieds de
page des trois voisins. Les épisodes ne sont **pas numérotés** (ni kicker, ni
pieds de page) : l'ordre de publication vit dans le registre du skill, pas dans
l'interface.
