---
paths:
  - "libs/design-tokens/**"
  - "tools/design-system/**"
---

# Design system : Empreinte et la couche de mise en page d'Apex

Tu modifies le design system dont dépendent tous les écrans d'Apex. Chaque changement est global.

1. Suis le skill `design-system-evolution` (`.claude/skills/design-system-evolution/SKILL.md`) et choisis d'abord le niveau.
2. **Empreinte, en amont** (couleurs Jour et Nuit, typographie, formes, ombre, mouvement, composants, kit `e-*`, icônes, voix, contrastes) : se change dans le dépôt `empreinte-studio/empreinte` (Conventional Commits, publication sur GitHub Packages), puis par une montée de version de `@empreinte-studio/*` dans Apex. Jamais de surcharge locale.
3. **La couche Apex** (`libs/design-tokens`) ne fait que placer : tokens `--ds-*` sous `:root`, sans couleur ; classes `.ds-*` qui partent d'une `.ds-*`, en tokens d'Empreinte ou `--ds-*`, sans typographie ni forme ; media queries annotées et égales aux `--ds-breakpoint-*` ; `index.ts` aligné.
4. Avant tout changement d'identité visuelle, toute suppression ou tout renommage, ou un changement visible sur tous les écrans : demande la validation de l'utilisateur.
5. Chaque modification de la couche : une entrée dans `libs/design-tokens/CHANGELOG.md` et une version semver dans `libs/design-tokens/package.json`.
6. `npx nx lint design-tokens` doit passer pour la couche (règles de la couche, contraste des couples du brand book en Jour et en Nuit). Ne l'affaiblis jamais pour faire passer une modification.
