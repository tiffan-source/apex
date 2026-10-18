---
paths:
  - "libs/design-tokens/**"
  - "tools/design-system/**"
---

# Design system partagé

Tu modifies le design system dont dépendent toutes les applications de productivité, y compris hors de ce dépôt. Chaque changement est global.

1. Suis le skill `design-system-evolution` (`.claude/skills/design-system-evolution/SKILL.md`).
2. Respecte les niveaux : valeurs brutes uniquement dans les primitifs ; sémantiques construits sur les primitifs ; mode sombre limité aux sémantiques ; tokens de composant construits sur les deux ; preset et `layout.css` uniquement en `var(--ds-*)`.
3. Avant de changer l'identité visuelle (couleur de marque, typographie, arrondis, densité, ombres), ou de supprimer ou renommer quoi que ce soit : demande la validation de l'utilisateur.
4. Chaque modification : une entrée dans `libs/design-tokens/CHANGELOG.md` et une version semver dans `libs/design-tokens/package.json`.
5. `npx nx lint design-tokens` doit passer (niveaux, contraste WCAG AA en clair et en sombre, tokens et classes inconnus). Ne l'affaiblis jamais pour faire passer une modification.
