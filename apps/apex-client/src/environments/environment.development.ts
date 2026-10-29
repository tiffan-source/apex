/**
 * La configuration du client en développement (`npx nx serve apex-client`), qui remplace environment.ts
 * (project.json, fileReplacements) : Apex Brain lancé en local (`npx nx serve api` dans son dépôt), dont
 * CORS_ORIGINS autorise http://localhost:4200.
 */
export const environment = {
  apiUrl: 'http://localhost:3000',
};
