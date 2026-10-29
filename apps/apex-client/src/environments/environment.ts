/**
 * La configuration du client en production (`npx nx build apex-client`). Rien de secret ici : les clés
 * (Supabase, Gemini, Firebase) vivent sur le serveur, l'application ne connaît que l'adresse de l'API.
 */
export const environment = {
  /** Apex Brain, l'API d'Apex (dépôt tiffan-source/apex-brain), hébergée sur Render. */
  apiUrl: 'https://apex-brain-kapj.onrender.com',
};
