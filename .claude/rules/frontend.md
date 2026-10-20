---
paths:
  - "apps/**"
---

# Front-end : Empreinte d'abord

Tu travailles dans une application. Avant d'écrire ou de modifier un gabarit, un composant, une mise en page ou un texte d'interface :

1. Suis le skill `frontend-ui` (`.claude/skills/frontend-ui/SKILL.md`) et lis les sources qu'il indique : le cahier `docs/features/migration-empreinte.md`, le catalogue `.claude/skills/frontend-ui/references/catalogue-empreinte.md`, `libs/design-tokens/src/layout.css` et la maquette de l'écran.
2. Construis avec, dans cet ordre : un composant Empreinte (`@empreinte-studio/angular`) réglé par ses entrées ; une classe `e-*` écrite à la main seulement dans les cas permis par le catalogue (§ 5.4) ; les 8 styles typographiques et les classes `.ds-*` de `layout.css` pour le texte et la mise en page.
3. N'écris **aucun** CSS : pas de feuille de style, pas de `styles` ni de `styleUrl`, pas de `style="…"`, `[style.x]`, `[ngStyle]`, `[ngClass]`, `[class]` ni `class="{{…}}"` (bascule avec `[class.ds-x]`), pas de couleur ni de longueur en dur, pas de classe hors `ds-*`, `e-*` livrées et styles typographiques. Aucune trace de PrimeNG (`<p-…>`, `pButton`, `[dt]`, `pi pi-*`, `MessageService`) : une réussite s'annonce avec `AnnoncesStore.annoncer`, un souci avec `AnnoncesStore.signaler`.
4. Respecte le brand book et la voix : un seul sceau par écran, une corne par groupe avec `aria-current`, aucune lumière pour un état, aucune erreur en rouge ; tutoiement, ni « échec », « erreur », « en retard », « supprimer », ni pourcentage, ni point d'exclamation, ni emoji.
5. S'il manque quelque chose, arrête-toi et propose une évolution (skill `design-system-evolution`) : la couche Apex pour la mise en page, Empreinte en amont pour l'apparence. Ne contourne pas.
6. Avant de rendre la main : `npx nx lint design-tokens` sans violation dans tes fichiers, puis `npx nx typecheck apex-client`, `npx nx vite:test apex-client` et `npx nx build apex-client` ; écran vérifié en Jour, en Nuit et à 375px.
