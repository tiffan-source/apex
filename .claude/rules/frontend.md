---
paths:
  - "apps/**"
---

# Front-end : le système visuel d'Apex

Tu travailles dans une application. Avant d'écrire ou de modifier un gabarit, un composant, une feuille de style, une mise en page ou un texte d'interface :

1. Suis le skill `frontend-ui` (`.claude/skills/frontend-ui/SKILL.md`) et regarde la maquette de l'écran (canvas « Apex · refonte des écrans », https://claude.ai/artifact/MPiN1pv2uhvjiRtmifTBfV).
2. Construis avec le kit d'Apex (`apps/apex-client/src/ui/`, composants `ax-*`) et les classes globales de `apps/apex-client/src/styles.css` (`.card`, `.btn`, `.chip`, `.check`, `.input`, la typographie `.display` … `.label`). Empreinte et PrimeNG ont été retirés : ne les réintroduis jamais.
3. Ce qui n'appartient qu'à un écran s'écrit dans la feuille du composant (`<nom>.css`, `styleUrl`) ; un nouvel élément réutilisable va dans le kit ou dans `styles.css`, pas copié d'un écran à l'autre. Couleurs toujours en tokens (`var(--encre)`, `var(--sceau)`…), pour que Jour et Nuit suivent. Pas de `::ng-deep`.
4. Une réussite s'annonce avec `AnnoncesStore.annoncer`, un souci avec `AnnoncesStore.signaler` : pas de toast.
5. La voix : tutoiement, phrases courtes ; ni « échec », « erreur », « en retard », « supprimer », ni pourcentage, ni point d'exclamation, ni emoji. Une erreur ne s'écrit jamais en rouge.
6. Avant de rendre la main : `npx nx typecheck apex-client`, `npx nx lint apex-client`, `npx nx vite:test apex-client` et `npx nx build apex-client` ; écran vérifié en Jour, en Nuit et à 375px.
