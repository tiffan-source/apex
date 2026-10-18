---
paths:
  - "apps/**"
---

# Front-end : le design system d'abord

Tu travailles dans une application. Avant d'écrire ou de modifier un template, un composant ou une mise en page :

1. Suis le skill `frontend-ui` (`.claude/skills/frontend-ui/SKILL.md`) et lis les sources qu'il indique.
2. Construis avec, dans cet ordre : un composant PrimeNG, une évolution du preset, un `[dt]` en tokens `var(--ds-*)`, les classes `.ds-*` de `libs/design-tokens/src/layout.css`.
3. N'écris **aucun** CSS : pas de feuille de style de composant, pas de `styleUrl`, pas de `style="…"`, pas de `[ngStyle]` ou `[ngClass]`, pas de valeur en dur (`#hex`, `rgb()`, `'red'`, `px`, `rem`), pas de classe autre que `ds-*` et `pi`/`pi-*`, pas de token ni de classe inventés.
4. S'il manque quelque chose au design system, arrête-toi et propose de le faire évoluer (skill `design-system-evolution`) au lieu de le contourner.
5. Avant de rendre la main : `npx nx lint design-tokens` doit afficher 0 violation, puis `npx nx typecheck` et `npx nx build` de l'application.
