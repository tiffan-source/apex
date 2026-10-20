---
name: design-system-evolution
description: À utiliser pour toute évolution du design system d'Apex, à ses deux niveaux. (a) Empreinte, en amont — tokens (couleurs Jour et Nuit, typographie, pas, cornes, traits, ombre, mouvement), composants @empreinte-studio/angular, kit CSS e-*, icônes, fonctions de voix, contrastes, thème Nuit — qui se change dans le dépôt empreinte-studio/empreinte, se publie sur GitHub Packages puis se met à jour dans Apex (montée de version de @empreinte-studio/*). (b) La couche de mise en page d'Apex (libs/design-tokens) — ajouter, modifier, renommer ou supprimer un token --ds-*, une classe .ds-*, un point de rupture, DS_MEDIA. Garantit qu'aucune surcharge locale ne contourne Empreinte et que chaque changement est journalisé et versionné. Use for design system, design tokens, Empreinte upgrade or contribution, theme, dark mode, contrast, layout classes or breakpoints changes.
---

# Faire évoluer le design system

Le design system d'Apex a deux niveaux, qui ne se changent ni au même endroit ni de la même façon :

| Niveau | Ce qu'il contient | Où il se change |
| --- | --- | --- |
| **Empreinte**, en amont | Toute l'identité : couleurs Jour et Nuit, typographie (les 8 styles, les polices), pas, angles, cornes, traits, ombre, mouvement, haptique ; les composants et leur apparence (kit `e-*`) ; les icônes ; les fonctions de voix (`legendeProgression`, `motsAEviter`…). Partagée par toutes les applications Empreinte. | Le dépôt https://github.com/empreinte-studio/empreinte, puis une montée de version de `@empreinte-studio/*` dans Apex (§ 1). **Jamais dans Apex.** |
| **La couche Apex** | La mise en page seulement : tokens `--ds-*` (points de rupture, largeurs, marges des panneaux), classes `.ds-*`, `DS_BREAKPOINTS` et `DS_MEDIA`. Aucune couleur, aucune typographie, aucune forme. | `libs/design-tokens` (alias `@org/design-tokens`), dans ce dépôt (§ 2). |

Pour construire un écran avec l'existant, c'est le skill `frontend-ui`.

## 0. Avant toute modification

1. Reformuler le besoin en **rôle** : « séparer les étapes du brouillon », pas « un trait gris de 1px ».
2. Chercher si l'existant le couvre : une entrée ou une variante d'un composant (catalogue `.claude/skills/frontend-ui/references/catalogue-empreinte.md`, § 2 ; manques connus au § 9), une classe ou une combinaison de classes de `libs/design-tokens/src/layout.css`, un pas d'Empreinte (`--pas-1` à `--pas-16`) ou un token de `tokens.css`. Une valeur proche dans l'échelle vaut presque toujours mieux qu'une nouvelle valeur.
3. **Choisir le niveau.** Le besoin change l'apparence de quelque chose (couleur, texte, forme, ombre, mouvement, comportement d'un composant, nouveau composant, nouvelle icône, nouveau mot de la voix) → Empreinte. Il ne fait que placer (empiler, aligner, espacer, mettre en grille, largeur, point de rupture, responsive) → couche Apex.
4. Mesurer l'impact : `grep -rn -- "ds-<nom>" apps libs`, `node tools/design-system/check.mjs --unused`.
5. **Demander la validation de l'utilisateur avant d'appliquer** tout changement d'identité visuelle (couleur, typographie, forme, densité, ombre, mouvement : ils relèvent d'Empreinte et touchent toutes les applications), toute suppression ou tout renommage, et tout changement visible sur tous les écrans (marges des panneaux, points de rupture, écart des pages). Présenter l'avant, l'après et les écrans touchés.

## 1. Empreinte, en amont

**Jamais de surcharge locale.** Si un composant d'Empreinte ne rend pas comme la maquette, s'il manque une variante, une icône, un token ou un mot à la voix, la correction se fait dans Empreinte, pour toutes les applications. Dans Apex, sont interdits : redéfinir une variable d'Empreinte (`--encre`, `--pas-4`…), cibler une classe `e-*` pour changer son apparence, recopier ou envelopper un composant pour le redessiner, modifier `node_modules`, ajouter une règle `prefers-color-scheme` (la Nuit passe par `data-theme`). En attendant la correction, utiliser le contournement documenté au catalogue § 9, ou accepter l'écart et le signaler.

### Proposer et faire le changement

Le dépôt a son propre `CLAUDE.md`, `docs/ARCHITECTURE.md` et `docs/CONTRIBUER.md` : les lire d'abord.

- **Tokens** (`packages/tokens/src/tokens.json`) : générés depuis le brand book. Les modifier d'abord dans le design system « Empreinte » (https://claude.ai/artifact/QBkmtgtj9oKk8xdJPb2QNe), exporter `tokens.json`, le remplacer dans le dépôt, puis `npx nx test tokens` (contrastes promis dans les deux thèmes, panneau plus lumineux que le fond).
- **Kit CSS** (`packages/css/src/<nom>.css`, une feuille par composant) : seulement des tokens, `angle-net` partout, la corne en `clip-path`, un repli `prefers-reduced-motion` ; `npx nx test css`.
- **Composants Angular** (`packages/angular/<nom>/`, un point d'entrée par famille) : API en français, signaux, `OnPush`, `ViewEncapsulation.None` avec la feuille du kit ; un `<nom>.spec.ts` (rendu, accessibilité, comportement) ; un spécimen dans la vitrine (`apps/vitrine`), en Jour et en Nuit.
- **Commits** : [Conventional Commits](https://www.conventionalcommits.org/fr/) en français (`feat(matrice): déplacer une tâche au clavier`, `fix(voix): reconnaître les mots accentués`). `feat` donne une version mineure, `fix` une corrective, `feat!` ou `BREAKING CHANGE:` une majeure. Les trois paquets (`tokens`, `css`, `angular`) avancent ensemble.
- **Vérifier** : `npx nx run-many -t lint test build`, puis la vitrine en Jour et en Nuit, au clavier, à 390px.
- **Publier** : onglet Actions du dépôt → workflow **Publier** → *Run workflow* (vérifie, versionne d'après les commits, écrit `CHANGELOG.md`, crée la release GitHub, publie sur GitHub Packages). Pour essayer avant de publier : `npx nx local-registry` dans le dépôt Empreinte, `npx nx release publish --registry http://localhost:4873`, et ce registre temporairement dans le `.npmrc` d'Apex (à ne pas committer).

Pousser sur le dépôt Empreinte, ouvrir une pull request ou lancer une publication : seulement à la demande de l'utilisateur. Sans accès au dépôt, rédiger la demande (le besoin, la maquette, l'API proposée) et la remettre à l'utilisateur.

### Monter de version dans Apex

1. Lire le `CHANGELOG.md` d'Empreinte entre la version installée et la nouvelle.
2. Installer : le `.npmrc` d'Apex fait pointer `@empreinte-studio` vers GitHub Packages et lit `NODE_AUTH_TOKEN`, un jeton GitHub avec le droit `read:packages`. `npm install @empreinte-studio/angular@<v> @empreinte-studio/tokens@<v>` (même version pour les deux). `@angular/aria` et `@angular/cdk` suivent la version d'Angular d'Apex : les aligner avec `nx migrate`, pas à la main.
3. `npx nx lint design-tokens` : le contrôle relit Empreinte tel qu'installé. Il vérifie les **29 couples de contraste** promis par le brand book, en Jour et en Nuit (`encre` et `encre-douce` sur `fond`, `panneau`, `creux` ; `sur-sceau` sur `sceau` ; chaque `-vif` sur son `-voile`, sur `fond` et sur `panneau` ; `encre` sur chaque `-voile`, à 4,5:1 ; `trame-forte` et `sceau` sur `fond`, `panneau`, `creux`, à 3:1), et il reconstruit la liste des classes `e-*` livrées : une classe retirée en amont apparaît comme classe inconnue dans les écrans. **Un contraste qui ne tient plus : ne pas adopter la version**, le signaler à Empreinte.
4. Mettre à jour le catalogue (`catalogue-empreinte.md`) : version couverte, API qui changent, pièges levés (§ 8), manques comblés (§ 9).
5. `npx nx typecheck apex-client`, `npx nx vite:test apex-client`, `npx nx build apex-client`, puis un contrôle visuel de **tous** les écrans en Jour, en Nuit et à 375px.

## 2. La couche Apex (`libs/design-tokens`)

| Fichier | Rôle |
| --- | --- |
| `src/tokens.css` | Tokens de mise en page `--ds-*`, sous `:root`, construits sur les pas d'Empreinte quand c'est possible. Aucune couleur. |
| `src/layout.css` | Classes `.ds-*`, chacune précédée d'un commentaire en français. |
| `src/index.ts` | `DS_BREAKPOINTS`, `DS_MEDIA`, type `DsBreakpoint` (pour `BreakpointObserver`). Rien d'autre. |
| `README.md` | Principes, liste des tokens et des classes, exemples. |
| `CHANGELOG.md`, `package.json` | Journal (obligatoire) et version semver. |
| `tools/design-system/check.mjs` (racine) | Le contrôle, lancé par `npx nx lint design-tokens`, la CI et le hook de Claude Code. |

`src/` ne contient que ces trois fichiers (plus d'éventuels `*.spec.ts`). Les styles d'une application se chargent dans cet ordre : `styles.css` (qui importe `@empreinte-studio/tokens/empreinte.css`), `tokens.css`, `layout.css`.

### Où placer quoi (règles vérifiées par le contrôle)

| Endroit | Règles |
| --- | --- |
| **`tokens.css`** | Uniquement des variables `--ds-<kebab-case>` sous `:root`, sans autre sélecteur ni `@media`, chacune déclarée une fois. **Aucune couleur** : ni `#hex`, ni fonction de couleur, ni nom de couleur, ni alias d'une couleur d'Empreinte (`--ds-x: var(--encre)` est refusé). Pas de `!important`. Une référence `var()` vise un token d'Empreinte ou de `tokens.css`. Valeurs construites sur les pas (`calc(var(--pas-6) + var(--pas-1))`) ; une valeur brute seulement pour une largeur ou un point de rupture tirés des maquettes. Points de rupture `--ds-breakpoint-*` en pixels entiers. |
| **`layout.css`** | Chaque sélecteur part d'une classe `.ds-*` (seule, ou dans `:where()` / `:is()`) ; une classe `e-*` (réellement livrée par Empreinte) ou un élément ne se cible que **sous** une `.ds-*`, et seulement pour placer (ex. `.ds-panel .e-tache { padding-inline: 0 }`), jamais pour redessiner. Pas d'identifiant, pas de pseudo-élément, pas de règle imbriquée, pas de classe d'une autre famille. Valeurs : tokens d'Empreinte (`--pas-*`, `--trait-*`, couleurs comme `--trame` ou `--encre-douce`) ou `--ds-*`, plus `0`, `%`, `fr`, nombres sans unité et mots-clés ; aucune longueur brute, aucune couleur en dur ni nommée (`transparent` compris). Fonctions permises : `var`, `calc`, `min`, `max`, `clamp`, `minmax`, `repeat`, `fit-content`. Propriétés interdites (elles appartiennent à Empreinte) : `font*`, `line-height`, `letter-spacing`, `text-transform`, `text-decoration`, `border-radius`, `clip-path`, `outline`, `content`, `transition`, `animation`, `filter`. Pas de `!important`. Variables locales nommées `--ds-*`. Seule at-rule : `@media`, précédée juste au-dessus du commentaire `/* --ds-breakpoint-xx */` et égale à sa valeur. |
| **`index.ts`** | `DS_BREAKPOINTS` reprend exactement tous les `--ds-breakpoint-*` de `tokens.css` ; aucune trace de PrimeNG ni de preset. |

**L'ordre de `layout.css` compte** : à spécificité égale, la règle la plus basse l'emporte. D'où l'ordre : remise à zéro des marges des enfants (`:where`, spécificité nulle), page, empilements, grilles et trame, panneaux, listes, conversation, modificateurs, puis responsive en dernier. Une nouvelle classe se range dans sa section.

### Conventions de nommage

- Préfixes `--ds-` et `.ds-`, kebab-case, mots en anglais ; le commentaire qui précède est en français.
- Espacements : `--ds-space-N` = N × 4px (`--ds-space-0-5` = 2px), **seulement** pour les valeurs qu'Empreinte n'a pas (`--pas-1`, `-2`, `-3`, `-4`, `-6`, `-8`, `-12`, `-16` existent déjà : ne pas les doubler).
- Réglages de mise en page : `--ds-<rôle>-<propriété>[-<contexte>]` (`--ds-panel-padding-inline-mobile`, `--ds-reply-author-width`).
- Points de rupture : `--ds-breakpoint-sm|md|lg`, repris dans `DS_BREAKPOINTS` et `DS_MEDIA` sous la même clé.
- Classes : `.ds-<rôle>` court (`.ds-panel`, `.ds-title-row`). Une variante est une classe supplémentaire (`.ds-gap-2`, `.ds-cols-2`), pas une nouvelle classe complète.

### Recettes

**A. Ajouter ou modifier un token.** Vérifier qu'un pas d'Empreinte ou un token existant ne suffit pas ; le déclarer dans la bonne section de `tokens.css`, avec un commentaire court ; le construire sur les pas. En cas de remplacement, mettre à jour tous les usages.

**B. Ajouter une classe.** Vérifier qu'aucune classe ni combinaison ne suffit ; s'assurer qu'elle ne fait que placer (si elle habille, c'est Empreinte qu'il faut changer, § 1) ; l'écrire dans la bonne section, avec son commentaire, en tokens ; si elle a un effet responsive, l'ajouter dans la media query existante du point de rupture. Si ses enfants directs doivent perdre leurs marges, ajouter la classe à la liste `:where(…) > *` du début du fichier.

**C. Changer ou ajouter un point de rupture.** Trois endroits à garder égaux : le token dans `tokens.css`, chaque `@media` de `layout.css` (avec son commentaire), `DS_BREAKPOINTS` dans `index.ts`. Le contrôle vérifie les trois. Changement visible partout : validation de l'utilisateur.

**D. Renommer ou supprimer.** Recenser les usages (`grep`, `--unused`) et les mettre à jour dans la même modification (la couche ne sert aujourd'hui qu'Apex ; si une autre application l'adopte, garder l'ancien nom une version, en alias commenté `/* Déprécié : utiliser … */`). C'est un changement cassant : version majeure.

**E. Documenter.** Mettre à jour `README.md` (tables des tokens et des classes) et, si une composition change, les modèles du skill `frontend-ui` (§ 6).

### Versionner

- `CHANGELOG.md` : une entrée par modification, sous la version concernée, la plus récente en haut, dans les rubriques « Ajouté », « Modifié », « Déprécié », « Supprimé ».
- Version semver dans `libs/design-tokens/package.json` : **majeure** pour une suppression ou un renommage ; **mineure** pour un ajout (token, classe) ; **corrective** pour un ajustement de valeur sans changement de rôle.

### Vérifier

1. `npx nx lint design-tokens` : aucune violation dans la couche (`libs/design-tokens/src`). Les violations des écrans encore en PrimeNG, pendant la migration, sont un autre sujet : ne pas les masquer.
2. `npx nx build apex-client` (et toute autre application qui charge la couche).
3. Contrôle visuel de **tous** les écrans en Jour, en Nuit et à 375px : une classe ou un token touche tout.
4. Résumer à l'utilisateur : ce qui change, où, l'impact visuel, la nouvelle version et l'entrée du journal.

## Ce qu'il ne faut jamais faire

- Surcharger Empreinte dans Apex (§ 1), ou recréer un preset, un thème ou une feuille de composant.
- Mettre une couleur, une typographie, une forme, une ombre ou une animation dans la couche Apex.
- Créer un token pour un seul usage quand un pas d'Empreinte ou un token existant convient.
- Corriger le rendu d'un écran en ajoutant du CSS dans l'application : la correction se fait dans la couche (mise en page) ou dans Empreinte (apparence), pour tous.
- Affaiblir `tools/design-system/check.mjs` pour faire passer une modification : ni retirer un couple de contraste, ni élargir la liste des classes permises, ni ignorer un fichier. Si une règle semble mauvaise, en discuter avec l'utilisateur.
