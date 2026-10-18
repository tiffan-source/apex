# design-tokens

Le design system commun à toutes les applications de productivité : une seule source de vérité pour les couleurs, la typographie, les espacements, les arrondis, les ombres, les animations et les tailles.

## Contenu

| Fichier                                           | Rôle                                                                                                                                                                                                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/tokens.css`                                  | Toutes les valeurs, sous forme de variables CSS `--ds-*`. Aucune dépendance : il peut être copié tel quel dans n'importe quel projet web.                                                                                                          |
| `src/primeng-preset.ts`                           | Preset PrimeNG (`DesignSystemPreset`) : l'apparence de chaque composant (carte, bouton, tag, badge, avatar, message, dialog, drawer, toolbar…) est définie ici à partir des tokens. Exporte aussi `avatarTone`, les variantes de pastille d'icône. |
| `src/layout.css`                                  | Remise à zéro, typographie de base et classes de mise en page `.ds-*` (piles, lignes, grilles, texte). C'est la seule CSS dont les apps ont besoin.                                                                                                |
| `CHANGELOG.md`                                    | Journal des modifications. La version (semver) est dans `package.json`.                                                                                                                                                                            |
| `tools/design-system/check.mjs` (racine du dépôt) | Contrôle automatique des règles ci-dessous, lancé par `npx nx lint design-tokens` et par la CI.                                                                                                                                                    |

## Principe : PrimeNG d'abord, presque zéro CSS

1. **Un besoin visuel ?** Utiliser un composant PrimeNG : `p-card`, `p-tag`, `p-badge`, `p-avatar`, `p-message`, `p-progressbar`, `p-toolbar`, `p-datepicker`…
2. **Son apparence ne convient pas partout ?** Modifier ses tokens dans `primeng-preset.ts`.
3. **Une seule instance doit changer ?** Utiliser l'entrée `[dt]` du composant avec des tokens, par exemple `[dt]="{ root: { background: 'var(--ds-color-accent-soft)' } }"`, ou les variantes prêtes à l'emploi comme `avatarTone.success`.
4. **De la mise en page ?** Utiliser les classes `.ds-*` de `layout.css`, par exemple `class="ds-row ds-between"` ou `class="ds-grid ds-grid-card"`.
5. **Aucun fichier `.css` par composant.** Si rien de ce qui précède ne suffit, on fait évoluer le design system lui-même (nouveau token, réglage du preset, nouvelle classe `.ds-*`) au lieu d'écrire un style local.

## Les trois niveaux de tokens

1. **Primitifs** (`--ds-color-violet-600`, `--ds-space-4`, `--ds-font-size-sm`…) : la palette brute, sans notion d'usage.
2. **Sémantiques** (`--ds-color-text`, `--ds-color-primary`, `--ds-color-danger-soft`…) : le rôle d'une valeur. **C'est ce niveau que les composants utilisent.** Le mode sombre ne redéfinit que ce niveau.
3. **Composants** (`--ds-card-padding`, `--ds-dock-radius`, `--ds-dialog-width`…) : les réglages d'un composant récurrent.

## Utiliser le design system dans une nouvelle application

**Application Angular du monorepo**

1. Charger les tokens puis la mise en page, dans `project.json` :
   ```json
   "styles": ["libs/design-tokens/src/tokens.css", "libs/design-tokens/src/layout.css", "apps/<mon-app>/src/styles.css"]
   ```
2. Brancher PrimeNG dans `app.config.ts` :
   ```ts
   import { DesignSystemPreset, designSystemThemeOptions } from '@org/design-tokens';

   providePrimeNG({ theme: { preset: DesignSystemPreset, options: designSystemThemeOptions } });
   ```

**Projet hors du monorepo**

Copier `src/tokens.css` puis `src/layout.css` et les importer dans cet ordre. Si le projet utilise PrimeNG, copier aussi `src/primeng-preset.ts`.

## Règles

- **Aucune valeur en dur dans un composant** : couleur, taille de police, graisse, espacement, arrondi, ombre, durée… tout passe par une variable `--ds-*`.
- **Utiliser les tokens sémantiques**, pas les primitifs : `var(--ds-color-danger)` plutôt que `var(--ds-color-red-700)`. Ainsi le mode sombre et les changements de rôle fonctionnent sans toucher aux composants.
- **Besoin d'une valeur qui n'existe pas ?** On l'ajoute dans `tokens.css` (au bon niveau) au lieu de l'écrire dans le composant.
- **Points de rupture** : les variables CSS ne fonctionnent pas dans `@media`. On recopie la valeur de `--ds-breakpoint-*` avec un commentaire qui cite le token :
  ```css
  /* --ds-breakpoint-sm */
  @media (max-width: 640px) { … }
  ```
- Les valeurs purement structurelles (`100%`, `1fr`, `0`, `50%` pour centrer, `100vw`) ne sont pas des choix de design : elles sont permises dans `layout.css` et dans la largeur des overlays (`[style]` de `p-dialog` et `p-drawer`). Les applications n'ont pas d'autre endroit où écrire du style.

## Contrôle automatique

```bash
npx nx lint design-tokens
```

Le contrôle refuse notamment :

- toute feuille de style ou tout style inline dans les applications ;
- les couleurs et longueurs écrites en dur ;
- les classes autres que `ds-*` et `pi-*`, ainsi que les tokens ou classes inexistants ;
- les valeurs brutes hors des primitifs et les inversions de niveau ;
- un mode sombre qui redéfinit autre chose que des tokens sémantiques ;
- un contraste texte / fond inférieur à 4,5:1 (WCAG AA), en clair comme en sombre.

`node tools/design-system/check.mjs --unused` liste en plus les tokens et les classes jamais utilisés.

Dans Claude Code, un hook (`.claude/settings.json`) lance ce contrôle après chaque modification d'un fichier front-end, puis une dernière fois en fin de tour si des fichiers front-end ont changé. Les violations sont renvoyées à l'IA, qui doit les corriger aussitôt.

## Faire évoluer le design system

Toute modification est globale, puisque toutes les applications en dépendent. La marche à suivre (niveau du token, nommage, mode sombre, contraste, journal, version) est décrite dans le skill [`design-system-evolution`](../../.claude/skills/design-system-evolution/SKILL.md). Pour construire une interface, voir le skill [`frontend-ui`](../../.claude/skills/frontend-ui/SKILL.md).
