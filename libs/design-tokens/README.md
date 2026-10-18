# design-tokens

Le design system commun à toutes les applications de productivité : une seule source de vérité pour les couleurs, la typographie, les espacements, les arrondis, les ombres, les animations et les tailles.

## Contenu

| Fichier | Rôle |
|---------|------|
| `src/tokens.css` | Toutes les valeurs, sous forme de variables CSS `--ds-*`. Aucune dépendance : il peut être copié tel quel dans n'importe quel projet web. |
| `src/primeng-preset.ts` | Preset PrimeNG (`DesignSystemPreset`) dont chaque valeur pointe vers un token. Les composants PrimeNG suivent donc automatiquement le design system. |

## Les trois niveaux de tokens

1. **Primitifs** (`--ds-color-violet-600`, `--ds-space-4`, `--ds-font-size-sm`…) : la palette brute, sans notion d'usage.
2. **Sémantiques** (`--ds-color-text`, `--ds-color-primary`, `--ds-color-eisenhower-do`…) : le rôle d'une valeur. **C'est ce niveau que les composants utilisent.** Le mode sombre ne redéfinit que ce niveau.
3. **Composants** (`--ds-card-padding`, `--ds-dock-radius`, `--ds-dialog-width`…) : les réglages d'un composant récurrent.

## Utiliser le design system dans une nouvelle application

**Application Angular du monorepo**

1. Charger les tokens avant les styles de l'app, dans `project.json` :
   ```json
   "styles": ["libs/design-tokens/src/tokens.css", "apps/<mon-app>/src/styles.css"]
   ```
2. Brancher PrimeNG dans `app.config.ts` :
   ```ts
   import { DesignSystemPreset, designSystemThemeOptions } from '@org/design-tokens';

   providePrimeNG({ theme: { preset: DesignSystemPreset, options: designSystemThemeOptions } });
   ```

**Projet hors du monorepo**

Copier `src/tokens.css` et l'importer en premier (`<link rel="stylesheet" href="tokens.css">` ou `@import "tokens.css";`). Si le projet utilise PrimeNG, copier aussi `src/primeng-preset.ts`.

## Règles

- **Aucune valeur en dur dans un composant** : couleur, taille de police, graisse, espacement, arrondi, ombre, durée… tout passe par une variable `--ds-*`.
- **Utiliser les tokens sémantiques**, pas les primitifs : `var(--ds-color-danger)` plutôt que `var(--ds-color-red-700)`. Ainsi le mode sombre et les changements de rôle fonctionnent sans toucher aux composants.
- **Besoin d'une valeur qui n'existe pas ?** On l'ajoute dans `tokens.css` (au bon niveau) au lieu de l'écrire dans le composant.
- **Points de rupture** : les variables CSS ne fonctionnent pas dans `@media`. On recopie la valeur de `--ds-breakpoint-*` avec un commentaire qui cite le token :
  ```css
  /* --ds-breakpoint-sm */
  @media (max-width: 640px) { … }
  ```
- Les valeurs de mise en page purement structurelles (`100%`, `1fr`, `0`, `50%` pour centrer) ne sont pas des choix de design : elles restent dans les composants.
