# Instructions pour les assistants IA

Les règles complètes du dépôt sont dans [`CLAUDE.md`](../CLAUDE.md). Ce fichier en reprend l'essentiel pour le front-end.

## Front-end : design system obligatoire

Toutes les applications de productivité partagent un design system unique, `libs/design-tokens`. **Les applications ne contiennent jamais de CSS custom** : l'apparence vient des composants PrimeNG habillés par le preset partagé, et la mise en page vient des classes `.ds-*`.

- Avant toute intervention sur une interface, suivre le skill [`frontend-ui`](../.claude/skills/frontend-ui/SKILL.md).
- Pour toute modification du design system (tokens, preset PrimeNG, classes `.ds-*`, mode sombre), suivre le skill [`design-system-evolution`](../.claude/skills/design-system-evolution/SKILL.md).
- Interdits dans les applications : feuilles de style de composant, `style="…"`, `[ngStyle]`, `[ngClass]`, `::ng-deep`, `!important`, couleurs ou longueurs en dur, classes autres que `ds-*` et `pi`/`pi-*`, tokens ou classes inventés, thème ou `definePreset`.
- `npx nx lint design-tokens` vérifie ces règles. Il doit passer avant de rendre la main ; ne jamais l'affaiblir pour faire passer une modification.
