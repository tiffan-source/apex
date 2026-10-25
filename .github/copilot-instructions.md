# Instructions pour les assistants IA

Les règles complètes du dépôt sont dans [`CLAUDE.md`](../CLAUDE.md). Ce fichier en reprend l'essentiel pour le front-end.

## Front-end : Empreinte pour l'identité, Apex pour sa mise en page

- L'identité vient du design system **Empreinte**, commun à toutes les applications de la suite : les composants de `@empreinte-studio/angular`, les 8 styles typographiques, les tokens Jour et Nuit de `@empreinte-studio/tokens`.
- La mise en page et le style propres à Apex vivent dans Apex : la feuille du composant (`<nom>.css` à côté du gabarit, `styleUrl`) pour ce qui n'appartient qu'à un écran ; `apps/apex-client/src/styles/layout.css` (utilitaires `.ds-*`) pour ce qui sert à plusieurs écrans. Couleurs en tokens d'Empreinte.
- Empreinte ne change que pour ce qui servirait à toute la suite (composant, variante, icône, token, voix), jamais pour la mise en page d'Apex.
- Avant toute intervention sur une interface, suivre le skill [`frontend-ui`](../.claude/skills/frontend-ui/SKILL.md).
- PrimeNG est retiré : ne pas le réintroduire.
