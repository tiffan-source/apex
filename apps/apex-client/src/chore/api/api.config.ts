import { InjectionToken } from '@angular/core';

/**
 * L'adresse d'Apex Brain, l'API d'Apex, sans « / » final : celle de l'environnement
 * (src/environments, branchée par provideApi dans app.config.ts).
 */
export const API_URL = new InjectionToken<string>('API_URL');

/** L'adresse sans « / » final : les services y ajoutent leurs routes (« /v1/… »). */
export function normalizeApiUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** Vrai pour une requête vers l'API : le jeton de la personne ne part jamais vers un autre hôte. */
export function isApiRequest(url: string, apiUrl: string): boolean {
  return url === apiUrl || url.startsWith(`${apiUrl}/`);
}
