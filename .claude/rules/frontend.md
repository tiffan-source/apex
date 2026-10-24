---
paths:
  - "apps/**"
---

# Front-end : l'identité vient d'Empreinte, la mise en page est celle d'Apex

Tu travailles dans une application. Avant d'écrire ou de modifier un gabarit, un composant, une feuille de style, une mise en page ou un texte d'interface :

1. Suis le skill `frontend-ui` (`.claude/skills/frontend-ui/SKILL.md`) et lis les sources qu'il indique : le cahier `docs/features/migration-empreinte.md`, le catalogue `.claude/skills/frontend-ui/references/catalogue-empreinte.md` et la maquette de l'écran.
2. Construis l'apparence avec Empreinte : un composant `@empreinte-studio/angular` réglé par ses entrées ; une classe `e-*` écrite à la main seulement dans les cas du catalogue (§ 5.4) ; les 8 styles typographiques pour le texte.
3. La mise en page et le style propres à Apex s'écrivent dans Apex : dans la feuille du composant (`<nom>.css` à côté du gabarit, `styleUrl`) pour ce qui n'appartient qu'à un écran ; dans `apps/apex-client/src/styles/layout.css` (utilitaires `.ds-*`) pour ce qui sert à plusieurs écrans. Couleurs en tokens d'Empreinte (Jour et Nuit), espacements et filets en tokens quand ils existent. Aucune trace de PrimeNG : une réussite s'annonce avec `AnnoncesStore.annoncer`, un souci avec `AnnoncesStore.signaler`.
4. Empreinte ne change que pour ce qui servirait à toute la suite (un composant, une variante, une icône, un token, un mot de la voix) : jamais pour la mise en page d'Apex.
5. Respecte le brand book et la voix : un seul sceau par écran, une corne par groupe avec `aria-current`, aucune lumière pour un état, aucune erreur en rouge ; tutoiement, ni « échec », « erreur », « en retard », « supprimer », ni pourcentage, ni point d'exclamation, ni emoji.
6. Avant de rendre la main : `npx nx typecheck apex-client`, `npx nx lint apex-client`, `npx nx vite:test apex-client` et `npx nx build apex-client` ; écran vérifié en Jour, en Nuit et à 375px.
