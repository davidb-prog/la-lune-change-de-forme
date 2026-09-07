# CLAUDE.md — Pourquoi la Lune change de forme ?

**Petit labo d'astronomie.** Site statique d'une page, en français,
qui explique les phases de la Lune à un enfant d'environ 5 ans. Le parent lit à
voix haute ; l'enfant attrape la Lune et la fait tourner autour de la Terre.

## Contraintes (non négociables)

- **Zéro dépendance, zéro build** : HTML + CSS + JS vanilla (modules ES),
  canvas 2D dessiné à la main. Aucune police tierce à l'exécution : la rondeur
  des titres de la famille, **Baloo 2**, est auto-hébergée (`assets/fonts/`,
  licence OFL, `font-display: swap`, variable `--titres`) — les titres
  seulement, jamais le corps du texte ni les boutons. La page s'ouvre avec
  `python3 -m http.server` et se déploie telle quelle sur GitHub Pages.
- **Compat mobiles anciens** : pas d'optional chaining `?.` ni de nullish `??`,
  pas de lookbehind regex, repli `@supports` pour `aspect-ratio`,
  `top/right/bottom/left` plutôt qu'`inset`, `touch-action: none` sur le canvas
  interactif **doublé d'un repli JS** (`touchstart`/`touchmove` non passifs qui
  font `preventDefault` — les vieux mobiles ignorent `touch-action` et volent
  le geste pour défiler). Tester à 390 px de large.
- **La page se manipule, elle ne se sélectionne pas** (verrou anti-gestes
  d'enfant de la famille) : `user-select: none` sur `body` (préfixé,
  + `-webkit-touch-callout: none` et `-webkit-tap-highlight-color:
  transparent`) ; `* { touch-action: pan-x pan-y }` — le doigt défile mais ni
  pincement ni double-tap ne zooment la page, le `touch-action: none` des
  canvas, plus spécifique, gagne ; viewport `maximum-scale=1, user-scalable=no`
  AVEC le filet JS `gesturestart` → `preventDefault` (Safari iOS ignore
  `user-scalable` depuis iOS 10). Les zooms d'accessibilité du système restent
  utilisables.
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

## Le dessin des vues (style « livre illustré »)

- **Le décor est pré-rendu** : tout ce qui ne dépend pas du soir (ciel,
  étoiles, jardin, Soleil, orbite, Terre, étiquettes) est dessiné une fois
  dans un canvas mémoire, refait seulement quand le canvas change de taille ;
  chaque image de la boucle rAF copie le décor puis pose la Lune. La Lune
  pleine est elle-même pré-rendue par rayon (`creerCacheLune` dans
  `js/lune-disque.js`, partagé par les trois vues). Mesuré : moins cher par
  image que l'ancien dessin à plat — un dessin naïf coûterait quinze à
  trente fois plus. Ne jamais redessiner le décor dans `rendre`.
- **Primitives portables seulement** : arcs, dégradés, découpe par chemin,
  `fill('evenodd')`. Pas de `ctx.ellipse`, `filter`, `shadowBlur`, `Path2D`.
- **La Lune** : boule ivoire assombrie au bord, six cratères cartoon (pas de
  mers « réalistes » : à cette taille elles font des taches grises et jurent
  avec le jardin dessiné à plat), terminateur adouci par quatre bandes,
  côté nuit deviné (lumière cendrée à 7 %). Même disque dans le hublot et
  dans l'espace ; dans l'espace, la moitié nuit est un dégradé COURT (quelques
  pixels) pour que « la moitié » reste lisible — pas de lumières de villes.
- **Le jardin** : collines, pré, maison à toit de tuiles et cheminée qui
  fume, **l'enfant à la grande fenêtre** (silhouette de dos, une main sur la
  vitre : c'est lui qui regarde la Lune), porte sombre (pas une lampe), un
  feuillu et un sapin **à droite, hors du disque de la Lune** (elle occupe
  jusqu'à ~0,79 w), clôture sur grand écran seulement (en bandeau 13/6 elle
  ne serait qu'un pointillé). Pas de chat ni d'animal : rien ne doit
  détourner l'œil de la Lune. Palette bleu nuit, une seule source chaude :
  les fenêtres.
- **Les pictogrammes de Lune** (frise du curseur, boutons-moments, ligne du
  défi) sont du **SVG inline** aux couleurs de la Lune (`js/icone-lune.js`,
  pur, testé par `node test/icone.test.mjs`) — jamais les emoji 🌑🌒🌕🌗,
  jaunes sur iOS, autres sur Android, blancs ailleurs : le site ne les
  maîtrise pas. Une seule licence : un croissant d'icône est porté à
  `FRACTION_ICONE_MIN` (20 %) — au soir 3, les 7 % réels font un fil de 2 px
  sur 26 px. Le hublot, lui, montre la forme exacte. Les champs `emoji` du
  modèle restent (textes, tests) mais ne s'affichent plus.
- **L'espace** : Soleil en dégradé à seize rayons doux, lueur atténuée ;
  Terre en volume, continents organiques, nuages, atmosphère, **sans
  calottes polaires** ; la maison-repère est un **pictogramme posé SUR le
  disque**, côté nuit (corps clair, une fenêtre chaude — pas de toit rouge,
  qui lisait « croix rouge »). Le Soleil ne bouge toujours pas d'un pixel.

## Invariants d'interaction

- **Le Soleil ne bouge jamais à l'écran** (objet-repère de la série) — sonde de
  pixels dans la suite navigateur.
- **Un seul doigt tient la Lune** : le `pointerId` qui l'a attrapée est
  mémorisé, les autres sont ignorés jusqu'au relâcher (acquis de
  la-terre-est-penchee : un second doigt posé faisait sauter la Lune sous
  lui). Vaut pour les deux vues de l'espace — celle du haut et celle du jeu.
- **Glisser fait avancer le phénomène** : attraper la Lune la déplace sur son
  orbite ; le curseur maître fait la même chose. Les deux vues (ciel + hublot)
  restent **synchronisées en permanence** sur le même `etat.jour`.
- **La lecture auto** (harmonisation de la famille) : la Lune avance toute
  seule (`LECTURE_SECONDES_PAR_CYCLE` = 90 s par cycle, dans le modèle),
  commandée UNIQUEMENT par le **bouton ⏸/▶ à largeur stable** (libellés
  « ⏸ Pause » / « ▶ Lecture » empilés) posé sur la PREMIÈRE carte
  (« 🌙 Ce soir, dans le ciel ») — jamais par un tap sur une vue. Reprendre la main (attraper la Lune, bouger
  le curseur, choisir un scénario, ouvrir le jeu) met en pause ; **on ne gagne
  pas un défi pendant la lecture auto** (garde dans `surveillerDefi`) ;
  `prefers-reduced-motion` la désactive. Le bouton 🔇/🔊 partage le même
  patron à libellés empilés (« 🔊 avec la voix » / « 🔇 sans la voix »).
- **Pied de page harmonisé de la famille** : « un épisode du Petit labo
  d'astronomie » suivi de l'emoji de série 🔭, les autres épisodes en liens
  cliquables (sans « La mécanique des éclipses ») portant chacun le
  **médaillon SVG de sa carte du portail** (tuile ~30 px, fond `#070b17`,
  soulignement sur le titre seul), et le bouton « Tous les épisodes du Petit
  labo » vers <https://petit-labo.fr/>, qui porte la **fiole maître au « ? »**
  en SVG inline (version petites tailles de la charte) — plus d'emoji devant
  ces liens ni d'éprouvette 🧪.
- **Les scénarios vont au moment choisi en douceur, toujours vers l'avant**
  (le vrai sens de l'orbite) ; en `prefers-reduced-motion`, saut sec. Sur
  mobile, taper une vignette **remonte doucement la page en calant la carte
  du jardin en haut de l'écran** (`scroll-margin-top`) : le bandeau montre la
  forme du soir et la vue de l'espace, juste dessous, montre le voyage en
  même temps (défilement sec en mouvement réduit, rien sur grand écran où
  les deux vues sont déjà sous les yeux).
- **Reprendre la main ne coupe plus l'histoire au premier doigt** (acquis de
  la-terre-est-penchee) : glisser la Lune ou tirer le curseur
  (`reprendreLaMainDoucement`) laisse la micro-histoire à l'écran **tant que
  la Lune garde la forme du moment choisi** — à l'hystérésis du jeu près
  (`scenarioEncoreTenu`/`defiEncoreTenu` du modèle : au bord de la fenêtre,
  un frémissement ne fait pas clignoter le texte). Dès qu'elle en sort,
  l'histoire s'efface et son `aria-pressed` se désarme, mais **la voix ne se
  coupe pas net : elle finit son bloc puis se tait**
  (`narrateur.finirDoucement('scn-')`). Le bouton ⏸/▶ range aussi l'histoire
  de la même façon ; **ouvrir le jeu**, lui, efface ET coupe
  (`reprendreLaMain`).
- **Scénarios au patron de la famille** (repris d'ou-va-le-soleil) : 4 boutons
  en dégradés colorés (croissant rose, quartier bleu, pleine lune dorée,
  nouvelle lune violette — classes `scn-<id>`), et l'histoire écrite en
  **deux lignes à puces** — « 🌙 dans le ciel » (champs `ciel` du modèle) puis
  « 🚀 depuis l'espace » (`espace`, fusée de la famille) : le même instant, deux regards
  (`montrerHistoire` dans main.js). Le bouton 🔇/🔊 a un **jumeau posé sur le
  jeu** (`bouton-son-jeu`, même état, même clé ; l'activer depuis le jeu relit
  la consigne du défi en cours).
- **Le jeu ne se gagne qu'en manœuvrant soi-même** — ni pendant une animation
  de scénario, **ni sur son point d'arrivée** (`etat.jourFabrique`, faux dès
  qu'on tape un bouton-moment, vrai au premier geste de l'enfant : le voyage
  finit PILE sur la forme du moment, qui est aussi une cible du jeu — jeu
  ouvert, « Toute ronde ! » gagnait « une pleine lune » sans rien fabriquer ;
  le saut sec du mouvement réduit gagnait pareil). Et il faut **rester un
  instant sur la bonne forme**
  (`DEFI_ATTENTE_MS`) : un tour de Lune qui traverse la fenêtre sans
  s'arrêter ne gagne pas « en passant ». Le bravo **ne ment jamais** : il
  s'efface quand l'enfant repart faire tourner la Lune — mais seulement
  quand elle quitte **franchement** la forme (hystérésis de sortie
  `DEFI_SORTIE_JOURS`/`defiEncoreTenu`, acquis de la famille : au bord de la
  fenêtre, un frémissement du doigt ne le fait pas clignoter) — et revient
  si la bonne forme est refabriquée ; **et la pioche n'offre jamais la forme
  que la Lune montre déjà** (`creerPiocheDefis(alea)` prend le soir affiché,
  `piocherDefi(etat.jour)` : à l'ouverture du jeu comme à « Encore une ! »,
  un défi gagné d'avance serait un bravo sans manœuvre — le fond de sac qui
  ne garde que celle-là fait remélanger un sac neuf plutôt que de mentir) ;
  « Encore une ! » reste acquis. Le jeu est **sonore** via le même bouton
  🔇/🔊 que les scénarios (consigne au nouveau défi, bravo à la victoire —
  `consigneDefi`/`bravoDefi` du modèle).
- **Les deux vues du jeu tombent PILE à la même hauteur** : la largeur des
  colonnes et les ratios des cadres se répondent — orbite `1.25fr` en `9/7`,
  hublot `1fr` en `36/35` (= 1 / (1,25 × 7/9), repli `padding-bottom: 97.2%`)
  — et la grille à deux colonnes ne s'ouvre qu'à **880 px**, là où le hublot
  apparaît (en dessous, une grille à 720 px réservait une colonne vide et
  l'orbite perdait 44 % de la rangée : la vue qu'on manipule rétrécissait
  quand la fenêtre grandissait). Règle de méthode de la famille (même défaut
  corrigé sur la-terre-est-penchee et ou-va-le-soleil) : **on fige d'abord la
  vue qu'on manipule — sa largeur ne se sacrifie pas — puis on déduit le ratio
  de l'autre.** Un cadre qui s'arrête plus haut que son voisin se lit comme un
  bug de mise en page.
- **Sur mobile (< 880 px) seulement** : le hublot se compacte en bandeau
  paysage (13/6, la Lune au-dessus du jardin) — jamais collant : épinglé en
  haut, il cacherait la vue de l'espace au niveau des boutons-scénarios. La
  vue de l'espace passe en carré (l'orbite plus grande sous le doigt). Un
  médaillon flottant (haut droit, hors du chemin du pouce) prend le relais
  dès que la **Lune du jardin** a quitté l'écran — le disque lui-même
  (`geometrieLune` de la vue, jamais une géométrie recopiée) : ce qui manque à
  l'enfant qui a défilé, c'est la forme du soir, pas le bas de la carte. Il ne
  recouvre pourtant **jamais la phrase du soir** : tant qu'une ligne de la
  phrase traverse son coin, il se pose juste dessous et remonte avec elle
  jusqu'à sa place (glissement collé au défilement ; on mesure les lignes et
  non le bloc — une ligne courte et centrée ne le dérange pas). Le médaillon
  montre la **Lune seule** (ciel uni, ni jardin ni cratères : à 60 px, seule
  la forme du soir compte — option `{ medaillon: true }` de `creerVueHublot`),
  cerclé d'or — le violet reste réservé à la Lune attrapable, pour qu'on ne
  les confonde pas. Un tap y
  ramène au jardin, sauf pendant le jeu où il n'est qu'un afficheur (remonter
  sortirait l'enfant du jeu). Le jeu n'affiche qu'une seule vue (l'espace),
  sans rien d'incrusté dans le canvas : c'est le médaillon qui montre le
  résultat, il reste donc visible pendant le jeu. **Jeu ouvert, le médaillon
  s'ancre dans l'en-tête du jeu** (`placerMedaillon`, à chaque image, un seul
  `getBoundingClientRect` et un déplacement DOM aux transitions) : il devient
  un élément de la mise en page — à droite du titre, 60 px, sa case dans la
  grille, plus rien à esquiver — et les **trois commandes tiennent sur une
  ligne dessous** : `[🔇] [🎲 Encore une !] [📦 Ranger le jeu]`, la voix en
  icône seule (son libellé vit dans le jumeau des scénarios), « Encore une ! »
  monté dans l'en-tête (il se range donc à la main au rangement du jeu).
  L'ancrage ne vaut que **tant que l'en-tête est à l'écran** : si l'enfant
  remonte vers les scénarios sans ranger le jeu, le médaillon redevient
  flottant, et se ré-ancre au retour (acquis de la-terre-est-penchee :
  « coincé en haut du jeu »). La boîte « Pourquoi la Lune
  change de forme ? » se **replie** sur mobile (repliée au chargement, comme
  la note aux parents ; toujours ouverte sur ordinateur, `main.js` y veille).
  Rien de tout cela n'existe sur grand écran.

## Le conteur (synthèse vocale)

Voir la charte de la famille : moteur unique `narrateur` (générations pour
invalider les lectures annulées), découpage en phrases, ton (rate/pitch selon
la ponctuation), score des voix françaises (fr-FR > fr > fr-CA, bonus
naturelles/neurales, malus robotiques) qui **choisit seul** la meilleure voix
(le menu 🗣 d'avant la voix enregistrée a été retiré de toute la famille),
textes `oral` sans émoji avec espaces recollées avant la ponctuation,
`pagehide` → `cancel()`. Un cran de plus que `stop()` :
**`finirDoucement(prefixe)`** — « finis ton bloc, puis tais-toi ». Le mp3 (ou
la phrase de synthèse) en cours va au bout, les blocs suivants ne partent pas.
Visé par préfixe d'id (`scn-`) : la grande histoire du bouton « Écouter » et
les consignes du jeu ne se taisent pas pour un doigt posé sur la Lune. Le réglage 🔇/🔊 se retient sous la **clé de
famille** `petit-labo-son` (même origine petit-labo.fr pour tous les
épisodes ; l'ancienne clé `petit-labo-lune-son` est lue en secours). Sans
synthèse, les boutons sonores se cachent et le site reste complet.

## La voix enregistrée (ElevenLabs)

Le conteur peut jouer des **mp3 commités** dans `assets/audio/` au lieu de la
synthèse. La référence de la famille est le skill `petit-labo`
(references/voix-enregistree.md) et son compagnon `generer-voix-petit-labo` ;
l'outillage est porté de `la-terre-tourne`. Règles dures :

- **Le corpus est fini et écrit main** : 21 blocs — 4 scénarios (`scn-<id>`,
  champ `oral` du modèle), 5 paragraphes d'histoire (`histoire-N`, lus dans
  `index.html`), 12 blocs de jeu (`defi-<cible>-consigne`/`-bravo`). Les ids
  sont EXACTEMENT ceux que `js/main.js` donne au conteur ; `corpus()` vit
  dans `tools/voix-lib.mjs`, la seule partie propre à l'épisode.
- **Le site reste 100 % statique** : génération HORS site par
  `tools/build-voix.mjs` (Node ≥ 18, zéro dépendance, `ELEVENLABS_API_KEY` +
  `ELEVENLABS_VOICE_ID` en variables d'environnement — jamais commitées,
  jamais côté site). Modèle `eleven_multilingual_v2`, sortie 64 kb/s.
- **La clé API vit sur la machine de David**, JAMAIS dans un cloud
  environment (`api.elevenlabs.io` y est bloqué par le réseau). Un seul
  rangement : le fichier gitignoré `.cle-elevenlabs` (chmod 600) à la racine
  du dépôt — jamais collée dans une conversation. La génération se fait en
  local ; depuis le cloud on prépare corpus et outillage, puis on passe la
  main.
- **La voix enregistrée ne ment jamais** : le manifeste
  (`assets/audio/manifest.json`) stocke le texte oral exact de chaque bloc,
  `audioSrc` (main.js) ne joue un mp3 que si son texte correspond ENCORE, et
  `node test/voix.test.mjs` échoue si un texte a changé sans régénération.
  Corollaire : **tout changement des textes parlés (`oral` des scénarios,
  `consigneDefi`/`bravoDefi`, paragraphes d'`index.html`) invalide des
  blocs** — re-passer par `--dry-run` et régénérer avant de committer.
- **Une histoire = une voix** : un bloc manquant fait passer tout le récit en
  synthèse (règle d'oreille, dans `lire` de main.js) — ne pas « optimiser »
  en mélangeant.
- **Figer les textes avant d'enregistrer**, valider à l'écoute
  (`tools/ecoute.html`, gitignoré, généré par build-voix), puis UN seul
  commit d'`assets/audio/` (mp3 + manifeste) — l'audio commité ne se
  delta-compresse pas, chaque régénération commitée est un blob mort à vie.
- **La revue ne se fait pas à l'oreille un par un** :
  `node tools/controle-voix.mjs` (local aussi — prérequis ffmpeg et
  openai-whisper, repli `--sans-stt`) passe chaque mp3 aux filets mécaniques
  puis le transcrit et compare ; il écrit `tools/controle.html` (gitignoré)
  avec seulement les suspects. Un clip signalé n'est pas forcément raté —
  l'oreille reste juge en dernier ressort. Re-tirages : `--only <id> --calme`,
  et diagnostic AVANT la série (voir le skill `generer-voix-petit-labo`).

## Structure

```
index.html          la page unique
assets/fonts/       Baloo 2 auto-hébergée (la voix des titres de la famille)
assets/audio/       la voix enregistrée du conteur (mp3 + manifest.json)
css/style.css       palette commune de la série astronomie (fond nuit)
js/model.js         modèle pur + constantes du récit + texteOral
js/lune-disque.js   le disque de la Lune partagé (Lune pleine pré-rendue, phase)
js/icone-lune.js    les pictogrammes de Lune en SVG (frise, boutons, défi)
js/vue-orbite.js    vue du ciel (Soleil fixe, orbite, Terre, geste-signature)
js/vue-hublot.js    la Lune vue du jardin (décor pré-rendu, médaillon)
js/main.js          câblage : boucle rAF, curseur, scénarios, conteur, jeu
tools/voix-lib.mjs  corpus() : les 21 blocs parlés de l'épisode
tools/build-voix.mjs  génération ElevenLabs (locale) + page d'écoute
tools/controle-voix.mjs  contrôle « sans oreilles » (ffmpeg + whisper)
test/model.test.mjs tests du modèle (Node)
test/icone.test.mjs tests des pictogrammes (formes, SVG)
test/voix.test.mjs  tests de la voix (corpus, couverture, manifeste)
docs/               captures d'écran du README
```

## Vérification navigateur

Suite Playwright maintenue **hors dépôt** (scratchpad de session,
`test-site.js`) : trois passes — desktop 1200 px, `reducedMotion: 'reduce'`,
mobile 390 px (`hasTouch`, `isMobile`). Vérifie la structure, le
geste-signature (glisser simulé), la synchronisation des vues, l'effacement de
l'histoire, le câblage du son, le jeu, zéro erreur console, pas de débordement
horizontal, et des sondes de pixels (le Soleil doré fixe à gauche ; hublot
lumineux à la pleine lune, sombre à la nouvelle). Servir avant :
`python3 -m http.server 8123`. Régénérer les captures `docs/*.png` à chaque
évolution visuelle (variable `CAPTURES=docs`).

## La série

Pieds de page croisés avec : `ou-va-le-soleil`, `la-terre-tourne`.
`eclipse-explorer` n'est encore lié nulle part — ni pied de page, ni note aux
parents, ni README : l'épisode n'est pas prêt. La famille est en ligne sous son domaine **petit-labo.fr**
(`petit-labo.fr/<depot>/`) : tous les liens croisés l'utilisent, jamais
`github.io`. Les épisodes ne sont **pas numérotés** (ni kicker, ni
pieds de page) : l'ordre de publication vit dans le registre du skill, pas dans
l'interface.
