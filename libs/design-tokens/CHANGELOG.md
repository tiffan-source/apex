# Journal des modifications — design-tokens

Une entrée par modification, la plus récente en haut. Rubriques : Ajouté, Modifié, Déprécié, Supprimé.
Version (semver, `package.json`) : majeure = suppression ou renommage, mineure = ajout, correctif = ajustement de valeur.
Tant que la version est en 0.x (développement initial), un changement cassant passe en version mineure.

## 0.2.0 — 2026-10-18

### Ajouté

- Contrôle automatique `tools/design-system/check.mjs` (`npx nx lint design-tokens`) : CSS interdit dans les applications, valeurs brutes, classes et tokens inconnus, hiérarchie des niveaux, mode sombre, contraste WCAG AA en clair et en sombre.
- Primitifs d'ombre : `--ds-shadow-geometry-sm|md|lg` et teintes `--ds-color-black-alpha-8|12|35|50`.
- Sémantiques d'ombre : `--ds-color-shadow`, `--ds-color-shadow-strong` (le mode sombre ne change que ces teintes).

### Modifié

- `--ds-color-gray-500` : `#6b7280` → `#626977`. Le texte secondaire atteint 4,5:1 sur le fond de page (4,36:1 avant).
- `--ds-color-warning` et `--ds-color-warning-soft` : orange → jaune (700 sur 50 en clair, 300 en sombre). Le texte d'avertissement atteint 4,5:1 sur son fond doux (3,35:1 avant), et « Déléguer » reste distinct de « Faire » (rouge).
- `--ds-shadow-sm|md|lg` sont construits sur les primitifs d'ombre (rendu inchangé).

### Supprimé

- `--ds-color-overlay-shadow` et `--ds-color-overlay-shadow-strong`, remplacés par `--ds-color-shadow` et `--ds-color-shadow-strong`.
- `--ds-color-eisenhower-*` : la matrice utilise les sévérités PrimeNG (Faire = danger, Déléguer = warn, Planifier = info, Éliminer = secondary).
- `--ds-layout-section-gap` (inutilisé).

## 0.1.0 — 2026-10-18

### Ajouté

- `tokens.css` : primitifs, sémantiques (clair et sombre), composants.
- `primeng-preset.ts` : preset PrimeNG construit sur les tokens, variantes `avatarTone`.
- `layout.css` : remise à zéro, base, classes de mise en page `.ds-*`.
