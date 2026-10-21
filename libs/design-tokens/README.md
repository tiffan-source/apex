# design-tokens — la mise en page d'Apex, posée sur Empreinte

Apex ne dessine rien lui-même. Son identité vient du design system **Empreinte** :

- `@empreinte-studio/tokens` : couleurs Jour et Nuit (`--fond`, `--panneau`, `--encre`, `--encre-douce`, `--trame`, `--sceau`, les quatre lumières…), typographie (`manifeste`, `objectif`, `voix`, `palier`, `section`, `corps`, `detail`, `repere`), pas (`--pas-1` à `--pas-16`), cornes, traits, mouvement ;
- `@empreinte-studio/angular` : les composants (`button[eBouton]`, `article[eCarte]`, `li[eTache]`, `e-pas`, `e-matrice`, `e-arete`, `aside[eNote]`, `eCoque`…), qui embarquent leur propre feuille.

Cette librairie (`@org/design-tokens`) n'ajoute que **la mise en page** : des tokens `--ds-*` (points de rupture, largeurs, marges des panneaux) et un vocabulaire de classes `.ds-*` pour placer les composants comme dans les maquettes du canvas « Apex ». Elle ne recrée jamais l'apparence d'un composant, ne touche ni à la typographie ni aux formes, et ne contient aucune couleur.

## Contenu

| Fichier                                           | Rôle                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/tokens.css`                                  | Tokens de mise en page `--ds-*`, sous `:root`, construits autant que possible sur les pas d'Empreinte. Aucune couleur.                      |
| `src/layout.css`                                  | Les classes `.ds-*` : page, en-têtes, empilements, rangées, grilles, trame de panneaux, listes à filets, conversation, responsive.           |
| `src/index.ts`                                    | `DS_BREAKPOINTS` et `DS_MEDIA` pour `BreakpointObserver` (alias `@org/design-tokens`). Plus de preset.                                      |
| `CHANGELOG.md`                                    | Journal des modifications. La version (semver) est dans `package.json`.                                                                     |
| `tools/design-system/check.mjs` (racine du dépôt) | Contrôle automatique, lancé par `npx nx lint design-tokens`, par la CI et par le hook de Claude Code.                                       |

## Principes

1. **Un besoin visuel ?** Un composant Empreinte. Catalogue : `.claude/skills/frontend-ui/references/catalogue-empreinte.md`.
2. **Un texte ?** Un des 8 styles typographiques d'Empreinte (`class="objectif"`, `class="detail ds-muted"`).
3. **De la mise en page ?** Les classes `.ds-*` ci-dessous : `class="ds-page-header"`, `class="ds-panels ds-cols-2"`.
4. **Aucun CSS dans l'application** : pas de `styles`/`styleUrl`, pas de `style="…"`, pas de `[style.*]`, `[ngStyle]`, `[ngClass]`, `[class]`, pas de couleur ni de longueur en dur.
5. **Rien ne convient ?** On ne contourne pas : on propose une classe ou un token ici (skill `design-system-evolution`), ou un composant à Empreinte.

## Utiliser la couche dans une application

```json
// apps/<app>/project.json → targets.build.options
"styles": ["apps/<app>/src/styles.css", "libs/design-tokens/src/tokens.css", "libs/design-tokens/src/layout.css"]
```

```css
/* apps/<app>/src/styles.css : uniquement des @import, Empreinte d'abord */
@import '@empreinte-studio/tokens/empreinte.css';
```

```ts
// app.config.ts
provideEmpreinte({ theme: 'jour' });

// un composant qui doit savoir s'il est sur mobile
import { DS_MEDIA } from '@org/design-tokens';
breakpointObserver.observe(DS_MEDIA.sm);
```

Les classes `e-*` d'un composant ne sont injectées dans la page qu'à son premier usage : poser le composant (`<e-empreinte>`, `aside[eNote]`…) plutôt que recopier ses classes à la main.

## Les tokens (`src/tokens.css`)

| Token                                                                           | Valeur                       | Pour                                                                   |
| ------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| `--ds-breakpoint-sm` / `-md` / `-lg`                                            | 760px / 900px / 1100px       | mobile (comme la coque d'Empreinte) / grilles égales / panneaux asymétriques |
| `--ds-space-0-5`, `-5`, `-7`, `-10`                                             | 2, 20, 28, 40px              | les pas intermédiaires des maquettes (même numérotation : N × 4px)     |
| `--ds-page-max-width`                                                           | 1120px                       | largeur du contenu d'une page                                          |
| `--ds-page-title-basis`                                                         | 480px                        | sous cette largeur, l'action d'un en-tête passe sous le titre          |
| `--ds-measure`, `--ds-narrow-width`, `--ds-grid-min-width`, `--ds-screen-height` | 760px, 440px, 280px, 100dvh | ligne confortable, bloc étroit, colonne de grille auto, écran plein    |
| `--ds-arete-min-width`                                                          | 640px                        | sous cette largeur, l'arête défile dans `.ds-scroll-x` au lieu de rétrécir |
| `--ds-panel-padding-block` / `-inline` (et `-mobile`)                           | 28 / 32px (24 / 20px)        | marges intérieures d'un panneau de la trame                            |
| `--ds-check-lead`, `--ds-entry-lead`                                            | 20px, 28px                   | colonne de la case, colonne du numéro                                  |
| `--ds-conversation-gap`, `--ds-reply-author-width`, `--ds-reply-author-indent`  | 28px, 96px, 15px             | fil des répliques d'Akari                                              |

Les couleurs ne passent jamais par un token `--ds-*` : on écrit `var(--encre-douce)` là où il le faut, c'est-à-dire seulement dans `layout.css`.

## Les classes (`src/layout.css`)

Dans tout conteneur `.ds-*`, les enfants directs perdent leurs marges par défaut (`h1`, `p`, `ul`) : l'espacement vient de l'écart du conteneur. Une marge propre à un composant d'Empreinte l'emporte toujours.

**Page**

| Classe              | Usage                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `.ds-page`          | Conteneur d'une page : sections empilées (pas-8), largeur max centrée.                             |
| `.ds-page-header`   | En-tête : bloc de titre (1er enfant) à gauche, action à droite, alignés en bas ; passe à la ligne. |
| `.ds-title-row`     | Titre à gauche, compte ou légende à droite, sur la même ligne de base.                             |
| `.ds-screen-center` | Écran plein au contenu centré (connexion).                                                         |
| `.ds-narrow`        | Bloc étroit (440px max), pleine largeur sur mobile.                                                |
| `.ds-skip-link`     | Lien d'évitement « Aller au contenu » : hors de l'écran, visible en haut à gauche au focus.        |
| `.ds-initial`       | Initiale de la personne en bas de la navigation : carré de pas-8 sur le fond creux, lettre centrée (contournement du catalogue § 9, en attendant un composant d'Empreinte). |

**Empilements, rangées, grilles**

| Classe                                    | Usage                                                                                        |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| `.ds-stack`                               | Empilement vertical, écart pas-4. Les enfants s'étirent (`.ds-self-start` pour un bouton).   |
| `.ds-row`                                 | Rangée centrée verticalement, écart pas-3.                                                   |
| `.ds-actions`                             | Rangée de boutons (écart pas-2) qui passe à la ligne.                                        |
| `.ds-grid`                                | Grille espacée (pas-6), une colonne par défaut.                                              |
| `.ds-panels`                              | La trame : panneaux séparés et entourés d'un filet `--trame` de `--trait-fin`.               |
| `.ds-grid-auto`                           | Autant de colonnes que la largeur le permet (min 280px).                                     |
| `.ds-cols-2`, `.ds-cols-3`                | 2 ou 3 colonnes égales ; une seule sous 900px.                                               |
| `.ds-cols-2-1`, `.ds-cols-7-6`            | 2fr/1fr (arête et étape) ou 7fr/6fr (conversation et brouillon) ; une seule sous 1100px.     |
| `.ds-span-2`, `.ds-span-all`              | Occupe deux colonnes (dans `.ds-cols-3`), ou toute la largeur.                               |
| `.ds-surfaces`                            | Avec `.ds-panels`, quand les enfants sont des surfaces d'Empreinte (`article[eCarte]`, `[eSurface]`) : un seul filet entre deux cartes. |

Dans une trame `.ds-panels.ds-cols-2`, un dernier panneau seul occupe toute la largeur : la trame ne laisse jamais de case vide.

**Panneaux, listes, lignes**

| Classe             | Usage                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `.ds-panel`        | Panneau de la trame : fond panneau (sauf sur une surface Empreinte), marges 28/32px, contenu empilé (pas-4).          |
| `.ds-panel-flush`  | Avec `.ds-panel` : les listes `ul[eListe] nue` vont d'un bord à l'autre ; les autres enfants gardent la marge.        |
| `.ds-list-bare`    | Liste sans puces ni retrait.                                                                                          |
| `.ds-divided`      | Lignes séparées par des filets trame (dessus de chaque ligne, dessous de la dernière), espacées de pas-3.             |
| `.ds-rule-top`     | Filet trame au-dessus, avec pas-4 d'air (pied de carte, prochain pas, zone de réponse).                               |
| `.ds-rule-block`   | Filets dessus et dessous (bloc replié).                                                                               |
| `.ds-disclosure`   | Bloc repliable natif (`details`) : le `summary` est une rangée haute d'une cible tactile, sans la puce du navigateur.  |
| `.ds-check`        | Case (`input[eCase]`) dans une colonne de 20px, intitulé à côté, détail et action dessous.                            |
| `.ds-entry`        | Repère étroit (numéro), texte, valeur à droite ; la suite passe sous le texte.                                        |

**Conversation avec Akari**

| Classe              | Usage                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `.ds-conversation`  | Fil des répliques : liste nue, écart 28px.                                                        |
| `.ds-reply`         | Une réplique : nom (96px) et phrase sur la même ligne de base ; empilés sur mobile.               |
| `.ds-reply-author`  | Nom de la personne, décalé pour s'aligner sur celui d'Akari (après son losange).                  |
| `.ds-composer`      | Zone de réponse : le `textarea[eSaisie]` prend la place, le bouton d'envoi reste à sa taille.      |
| `.ds-prose`         | Texte rendu depuis le Markdown : blocs espacés, listes en retrait, code qui défile. Les titres Markdown gardent la taille du navigateur : les rendre en paragraphe. |

**Modificateurs**

| Classe                                                                                       | Usage                                               |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `.ds-wrap`                                                                                   | Passe à la ligne.                                   |
| `.ds-between`, `.ds-justify-end`, `.ds-justify-center`                                       | Répartition sur l'axe principal.                    |
| `.ds-items-start`, `-center`, `-end`, `-baseline`, `-stretch`                                | Alignement des enfants sur l'axe secondaire.        |
| `.ds-self-start`, `-center`, `-end`                                                          | Alignement d'un enfant.                             |
| `.ds-grow`, `.ds-no-shrink`                                                                  | Prend la place restante / ne rétrécit jamais.       |
| `.ds-push-down`, `.ds-push-right`                                                            | Poussé en bas d'un empilement / à droite.           |
| `.ds-gap-0`, `-0-5`, `-1`, `-2`, `-3`, `-4`, `-5`, `-6`, `-8`, `-10`, `-12`                  | Écart entre enfants : N × 4px (0-5 = 2px).          |
| `.ds-pad-block-1`, `.ds-pad-inline-3`                                                        | Air de pas-1 dessus et dessous / retrait de pas-3 à gauche et à droite. |
| `.ds-muted`                                                                                  | Texte en encre douce.                               |
| `.ds-link`                                                                                   | Lien dans le texte, dans l'encre du texte qui l'entoure (pas de bleu du navigateur). |
| `.ds-break`, `.ds-nowrap`, `.ds-truncate`                                                    | Coupe les mots longs / jamais à la ligne / une ligne avec « … ». |
| `.ds-text-center`, `.ds-text-end`, `.ds-measure`                                             | Alignement du texte, longueur de ligne confortable. |
| `.ds-scroll-x`                                                                               | Défilement horizontal ; une `e-arete` y garde 640px et défile au lieu de rétrécir. |
| `.ds-hide-mobile`, `.ds-show-mobile`                                                         | Masqué sous 760px / visible seulement sous 760px (sur un élément simple, pas l'hôte d'un composant). |

## Exemples (maquettes du canvas « Apex »)

```html
<!-- En-tête de page avec action -->
<header class="ds-page-header">
  <div class="ds-stack ds-gap-2">
    <p class="repere ds-muted">Lundi 19 octobre</p>
    <h1 class="manifeste">Mes objectifs</h1>
    <p class="detail ds-muted">4 en marche · 1 accompli</p>
  </div>
  <a eBouton="sceau" routerLink="/objectifs/nouveau"><e-icone nom="plus" [taille]="18" />Nouvel objectif</a>
</header>

<!-- Trame de cartes -->
<div class="ds-panels ds-cols-2">
  <article class="ds-panel"> … </article>
</div>

<!-- Conversation. La signature d'Akari (« AKARI » et son losange) n'est dessinée que par une
     ENote : une aside[eNote] par réplique d'Akari, posée directement dans le li (catalogue § 9). -->
<ol class="ds-conversation">
  <li><aside eNote><div class="ds-prose" [innerHTML]="reponse.html"></div></aside></li>
  <li class="ds-reply"><p class="repere ds-muted ds-reply-author">Léa</p><p class="corps">Un stage cet été.</p></li>
</ol>

<!-- Arête : défile sur mobile au lieu de rétrécir -->
<div class="ds-scroll-x"><e-arete [objectif]="titre" [etapes]="etapes" /></div>
```

## Contrôle automatique

```bash
npx nx lint design-tokens                   # ou : node tools/design-system/check.mjs
node tools/design-system/check.mjs --unused # liste aussi les classes .ds-* et tokens --ds-* inutilisés
```

Le contrôle vérifie :

- **la couche Apex** : `tokens.css` sous `:root`, noms `--ds-<kebab>`, aucune couleur (ni en dur, ni en alias d'une couleur d'Empreinte) ; `layout.css` avec des sélecteurs qui partent d'une classe `.ds-*` (une classe `e-*` ou un élément seulement dessous), des valeurs en tokens d'Empreinte ou `--ds-*` (plus `0`, `%`, `fr`, nombres sans unité, mots-clés), sans `!important`, sans typographie ni forme, des media queries annoncées par `/* --ds-breakpoint-xx */` et égales à sa valeur ; `index.ts` aligné sur les points de rupture ; aucun autre fichier dans `src/` ;
- **le contraste d'Empreinte**, dans les thèmes Jour et Nuit : `encre` et `encre-douce` sur `fond`, `panneau`, `creux` ; `sur-sceau` sur `sceau` ; chaque `-vif` sur son `-voile`, sur `fond` et sur `panneau` ; `encre` sur chaque `-voile` (4,5:1) ; `trame-forte` et `sceau` sur `fond`, `panneau`, `creux` (3:1). Une mise à jour d'Empreinte qui casserait une de ces promesses est refusée ;
- **les applications** (`apps/*/src`) : aucune feuille de style hors `styles.css` (des `@import`, Empreinte en premier) ; pas de `styles`/`styleUrl(s)` ; pas de `style="…"`, `[style…]`, `[attr.style]`, `[ngStyle]`, `[ngClass]`, `[class]`, `class="{{…}}"` ; pas de `::ng-deep` ni `!important` ; pas de style posé par le code ; pas de couleur ni de longueur en dur (un nombre sans unité passé à une entrée, `[taille]="28"`, est permis) ; seulement les classes `.ds-*` de `layout.css`, les classes `e-*` livrées par Empreinte et les 8 styles typographiques ; aucune référence `var(--…)` inconnue ; plus aucune trace de PrimeNG (`primeng/…`, `@primeuix/…`, `<p-…>`, `pButton`, `pInputText`, `pTextarea`, `[dt]`, `pi pi-*`, `providePrimeNG`, `MessageService`) ;
- **l'ordre des styles** dans `apps/*/project.json` : `styles.css`, `tokens.css`, `layout.css`.

Il signale aussi : une classe `e-*` du kit écrite à la main hors de `e-masque`, `e-nav__marque` et `e-carte__entete|pied|meta|raison` (catalogue § 5.4 : poser le composant) ; une directive d'Empreinte mal nommée ou posée sur un élément qu'elle ne vise pas (`div[eBouton]`, `input[eCase]` sans `type="checkbox"`) ; les styles et classes posés par `host`, `@HostBinding` ou le code ; `<link rel="stylesheet">` ; un `@import` autre qu'Empreinte dans `styles.css` ; dans la couche, l'apparence d'un composant ou d'un élément retouchée (couleur, fond, bordure, ombre) et `prefers-color-scheme`.

Dans Claude Code, un hook (`.claude/settings.json`) lance ce contrôle après chaque modification d'un fichier front-end, puis en fin de tour.

## Faire évoluer la couche

Toute modification touche tous les écrans. La marche à suivre (niveau, nommage, journal, version) est dans le skill [`design-system-evolution`](../../.claude/skills/design-system-evolution/SKILL.md) ; pour construire un écran, voir le skill [`frontend-ui`](../../.claude/skills/frontend-ui/SKILL.md).
