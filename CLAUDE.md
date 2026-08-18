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
  interactif. Tester à 390 px de large.
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
- Jour 0 = nouvelle lune. `positionLune(jour) = (−cos θ, −sin θ)` avec
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
  (le vrai sens de l'orbite) ; en `prefers-reduced-motion`, saut sec.
- **Reprendre la main efface l'histoire** : bouger le curseur ou la Lune ferme
  la micro-histoire du scénario et désarme son `aria-pressed`.
- **Le jeu ne se gagne qu'en manœuvrant soi-même** (pas pendant une animation
  de scénario).
- **Sur mobile (< 880 px) seulement** : un médaillon flottant (haut droit,
  hors du chemin du pouce qui fait tourner la Lune) montre la Lune du soir dès
  que le hublot sort de l'écran — un tap y ramène. Le jeu n'affiche qu'une
  seule vue (l'espace), sans rien d'incrusté dans le canvas : c'est le
  médaillon flottant qui montre le résultat, il reste donc visible pendant le
  jeu. Rien de tout cela n'existe sur grand écran.

## Le conteur (synthèse vocale)

Voir la charte de la famille : moteur unique `narrateur` (générations pour
invalider les lectures annulées), découpage en phrases, ton (rate/pitch selon
la ponctuation), score des voix françaises (fr-FR > fr > fr-CA, bonus
naturelles/neurales, malus robotiques), menu 🗣 si ≥ 2 voix (choix en
`localStorage`), textes `oral` sans émoji avec espaces recollées avant la
ponctuation, `pagehide` → `cancel()`. Sans synthèse, les boutons sonores se
cachent et le site reste complet.

## Structure

```
index.html          la page unique
css/style.css       palette commune de la série astronomie (fond nuit)
js/model.js         modèle pur + constantes du récit
js/vue-orbite.js    vue du ciel (Soleil fixe, orbite, geste-signature)
js/vue-hublot.js    la Lune vue du jardin (dessinerDisqueLune)
js/main.js          câblage : boucle rAF, curseur, scénarios, conteur, jeu
test/model.test.mjs tests du modèle (Node)
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

Pieds de page croisés avec : `eclipse-explorer`, `ou-va-le-soleil`,
`la-terre-tourne`. En publiant cet épisode, ajouter son lien dans les pieds de
page des trois voisins. Les épisodes ne sont **pas numérotés** (ni kicker, ni
pieds de page) : l'ordre de publication vit dans le registre du skill, pas dans
l'interface.
