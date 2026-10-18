---
name: design-system-evolution
description: À utiliser pour toute modification du design system partagé (libs/design-tokens) — ajouter, modifier, renommer ou supprimer un design token (couleur, espacement, typographie, ombre, taille, rayon…), changer l'apparence d'un composant PrimeNG dans le preset, ajouter une variante [dt], ajouter une classe de mise en page .ds-*, adopter un nouveau composant PrimeNG, ajuster le mode sombre ou le contraste. Garantit la cohérence entre toutes les applications qui partagent ce design system. Use for design tokens, theme, PrimeNG preset or design system changes.
---

# Faire évoluer le design system

Le design system (`libs/design-tokens`) est partagé par toutes les applications de productivité, présentes et futures, y compris hors de ce dépôt.
**Chaque modification est globale.** Le but est d'avoir peu de tokens, bien nommés, et toujours sémantiques du côté des usages.

| Fichier                         | Rôle                                                                   |
| ------------------------------- | ---------------------------------------------------------------------- |
| `src/tokens.css`                | toutes les valeurs (variables `--ds-*`), en 3 niveaux + le mode sombre |
| `src/primeng-preset.ts`         | apparence des composants PrimeNG, variantes `[dt]` exportées           |
| `src/layout.css`                | remise à zéro, base, classes de mise en page `.ds-*`                   |
| `README.md`                     | principes, mode d'emploi pour une nouvelle application                 |
| `CHANGELOG.md`                  | journal des modifications (obligatoire)                                |
| `tools/design-system/check.mjs` | contrôle automatique (`npx nx lint design-tokens`)                     |

## 0. Avant toute modification

1. Lire `README.md`, puis les trois fichiers sources.
2. Reformuler le besoin en **rôle** : « fond d'un bloc mis en avant », et non « violet clair ».
3. Chercher si l'existant couvre déjà ce rôle : parcourir les échelles (espacements, tailles, typographie) et les tokens sémantiques. Une valeur proche dans l'échelle est presque toujours préférable à une nouvelle valeur.
4. Mesurer l'impact : `grep -rn -- "--ds-<nom>" apps libs`. Penser aussi aux références dynamiques du preset (`palette('green')` lit `--ds-color-green-50` à `-950`).
5. **Demander la validation de l'utilisateur avant d'appliquer** si la modification change l'identité visuelle (couleur de marque, typographie, arrondis, densité, ombres), ou si elle supprime ou renomme quelque chose. Présenter : l'avant, l'après, les écrans touchés.

## 1. Où placer quoi

| Niveau                           | Contenu                                                                                                                                                            | Règles (vérifiées par le contrôle)                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Primitifs**                 | palettes 50 → 950, échelles d'espacement, de taille, de typographie, de rayon, de bordure, de durée, de z-index, d'ombre (géométrie et teintes), points de rupture | Le **seul** endroit avec des valeurs brutes. Nom = nature + échelle (`--ds-color-teal-600`, `--ds-space-4`). Jamais utilisé directement par une application. |
| **2. Sémantiques**               | rôles : `--ds-color-text-muted`, `--ds-color-danger-soft`, `--ds-shadow-md`, `--ds-text-heading-size`                                                              | Uniquement des `var(--ds-<primitif>)` ou un `color-mix(in srgb, …)` de primitifs. Ne référence jamais un token de composant.                                 |
| **2 bis. Sombre**                | redéfinitions dans `@media (prefers-color-scheme: dark)`                                                                                                           | Ne redéfinit **que** des tokens sémantiques déjà déclarés en mode clair.                                                                                     |
| **3. Composants**                | réglages d'un composant récurrent : `--ds-card-padding`, `--ds-dialog-width`, `--ds-dock-offset`                                                                   | Construit sur les sémantiques et les primitifs. Seuls `%`, `vw` et `vh` sont permis en brut.                                                                 |
| **Preset** (`primeng-preset.ts`) | apparence de chaque composant PrimeNG                                                                                                                              | Uniquement des `var(--ds-*)` ou des mots-clés (`solid`, `transparent`, `none`, `0`). Mêmes références en clair et en sombre : les tokens basculent seuls.    |
| **Variantes**                    | objets prêts pour `[dt]` (ex. `avatarTone`)                                                                                                                        | Exportées et typées depuis `primeng-preset.ts`, donc disponibles via `@org/design-tokens`.                                                                   |
| **Mise en page** (`layout.css`)  | remise à zéro, base, utilitaires `.ds-*`                                                                                                                           | Mise en page et texte **uniquement**, jamais l'habillage d'un composant. Valeurs en tokens.                                                                  |

## 2. Conventions de nommage

- Préfixe `--ds-` pour les tokens et `.ds-` pour les classes ; kebab-case ; mots en anglais.
- Couleurs sémantiques : `--ds-color-<rôle>[-<variante>]`. Variantes : `-soft` (fond doux), `-hover`, `-active`, `-contrast` (texte sur la couleur pleine), `-strong`, `-muted`, `-subtle`.
- Échelles `space` et `size` en unités de 0,25 rem : `--ds-space-4` = 1 rem, `--ds-space-1-5` = 0,375 rem.
- Tailles de police : `2xs` à `5xl`. Graisses : `regular`, `medium`, `semibold`, `bold`.
- Tokens de composant : `--ds-<composant>-<propriété>[-<état ou contexte>]` (`--ds-dock-offset-mobile`).
- Classes : `.ds-<rôle>` court (`.ds-row`, `.ds-grid-card`). Une variante est une classe supplémentaire (`.ds-gap-2`), pas une nouvelle classe complète.

## 3. Recettes

### A. Ajouter ou modifier un token

1. Choisir le niveau (tableau § 1). Réutiliser une valeur d'échelle existante plutôt que d'en créer une nouvelle.
2. Déclarer le token dans la bonne sous-section de `tokens.css`, avec un commentaire court si son rôle n'est pas évident.
3. Pour une couleur sémantique, définir aussi sa valeur sombre dans la section 2 bis si la valeur claire ne convient pas sur fond sombre.
4. S'il s'agit d'un nouveau couple texte / fond (un nouveau rôle de texte ou de fond), l'ajouter à `CONTRAST_PAIRS` dans `tools/design-system/check.mjs`. Le contrôle vérifie alors le contraste WCAG AA (4,5:1) en clair et en sombre.
5. Pour une nouvelle palette, déclarer les 11 paliers (50 → 950) et l'ajouter à `PALETTE_TOKEN` dans le script de contrôle.
6. En cas de remplacement, mettre à jour tous les usages.

### B. Changer l'apparence d'un composant PrimeNG (pour toutes les applications)

1. Lister les tokens du composant dans le thème Lara (nom en minuscules : `card`, `button`, `tag`, `datepicker`…) :
   ```bash
   node -e "import('@primeuix/themes/lara/card').then(m => console.log(JSON.stringify(m.default, null, 2)))"
   ```
2. Ajouter dans `components.<composant>` du preset **uniquement** les clés à changer, avec des valeurs `var(--ds-*)`. Les clés absentes gardent la valeur de Lara.
3. Pour des couleurs par sévérité, réutiliser les assistants du preset : `severities`, `softFill`, `messageTone`.
4. Si le composant a un `colorScheme`, mettre la même structure dans `light` et dans `dark` : les tokens se chargent de la bascule.
5. S'il manque un token pour exprimer la valeur voulue, l'ajouter d'abord (recette A).

### C. Ajouter une variante d'instance (`[dt]`)

Dès qu'un même objet `[dt]` apparaît dans deux composants, l'exporter depuis le preset (modèle : `avatarTone` et son type `AvatarTone`), puis remplacer les copies.

### D. Ajouter une classe de mise en page

1. Vérifier qu'aucune classe existante, ni aucune combinaison de classes, ne suffit.
2. La classe doit concerner la mise en page ou le texte. Si elle habille un composant, c'est le preset qu'il faut modifier (recette B).
3. Préfixe `.ds-`, valeurs uniquement en tokens, dans la bonne section de `layout.css`. Attention à l'ordre : à spécificité égale, la règle déclarée le plus bas l'emporte.
4. Une media query utilise la valeur exacte d'un `--ds-breakpoint-*` et est précédée du commentaire `/* --ds-breakpoint-xx */`.
5. Cibler une classe interne de PrimeNG (`.p-*`) seulement en dernier recours, toujours sous une classe `.ds-*`, et le noter dans le journal : c'est une dépendance à la structure interne de PrimeNG.

### E. Adopter un nouveau composant PrimeNG

1. Vérifier son rendu brut en clair et en sombre (il hérite déjà des couleurs, des surfaces et du focus).
2. Habiller dans le preset ce qui détonne (recette B).
3. Le marquer comme « Habillé » dans `.claude/skills/frontend-ui/references/catalogue-primeng.md`.

### F. Renommer ou supprimer un token ou une classe

1. Recenser tous les usages (applications, librairies, références dynamiques).
   `node tools/design-system/check.mjs --unused` liste les tokens et les classes jamais utilisés.
2. Des applications hors du dépôt peuvent l'utiliser. Garder l'ancien nom pendant une version, comme alias commenté `/* Déprécié : utiliser --ds-… */`, puis le supprimer à la version majeure suivante.
3. Un renommage ou une suppression est un changement cassant : version majeure (§ 4).

## 4. Versionner et documenter

- `CHANGELOG.md` : une entrée par modification, sous la version concernée, dans les rubriques « Ajouté », « Modifié », « Déprécié » ou « Supprimé ». La plus récente en haut.
- Version semver dans `libs/design-tokens/package.json` :
  - **majeure** : suppression ou renommage ;
  - **mineure** : ajout (token, variante, classe, composant habillé) ;
  - **correctif** : ajustement d'une valeur sans changement de rôle.
- Mettre à jour `README.md` si une règle ou un principe change.

## 5. Vérifier

1. `npx nx lint design-tokens` : 0 violation (niveaux, valeurs brutes, mode sombre, contraste, tokens inconnus, classes inconnues). Dans Claude Code, un hook le lance déjà après chaque modification de `libs/design-tokens/**`.
2. `npx nx build` pour chaque application concernée.
3. Contrôle visuel de **toutes** les pages en clair, en sombre et à 375 px de large : un changement de token touche tout.
4. Résumer à l'utilisateur : ce qui change, où, l'impact visuel, la nouvelle version et l'entrée du journal.

## Ce qu'il ne faut jamais faire

- Ajouter une valeur brute hors des primitifs, ou une couleur directement dans le preset.
- Créer un token pour un seul usage alors qu'une valeur d'échelle existe déjà.
- Inverser la hiérarchie : un primitif qui référence un token sémantique, ou un sémantique qui référence un token de composant.
- Corriger le rendu d'une application en ajoutant du CSS dans l'application : la correction se fait ici, pour tout le monde.
- Affaiblir le script de contrôle pour faire passer une modification. Si une règle semble mauvaise, en discuter avec l'utilisateur.
