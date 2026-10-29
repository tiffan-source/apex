import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { API_URL, normalizeApiUrl } from '../api/api.config';
import { authInterceptor } from '../api/auth.interceptor';

/**
 * Le client HTTP d'Apex, branché sur Apex Brain (l'API qui porte toutes les règles métier et les données) :
 * son adresse, et le jeton de la personne sur chaque requête (authInterceptor).
 */
export function provideApi(apiUrl: string): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: API_URL, useValue: normalizeApiUrl(apiUrl) },
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
  ]);
}
