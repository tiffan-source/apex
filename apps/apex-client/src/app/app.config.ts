import {
  ApplicationConfig,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideEmpreinte } from '@empreinte-studio/angular/core';
import { A11yProviders } from '../chore/providers/a11y.provider';
import { provideApi } from '../chore/providers/api.provider';
import { provideSessionEndRedirect } from '../chore/providers/session.provider';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    { provide: LOCALE_ID, useValue: 'fr' },
    // Empreinte : thème Jour au premier lancement, puis le choix retenu (clé « empreinte:theme »,
    // lue aussi par le script d'index.html pour éviter un éclair de Jour en Nuit).
    provideEmpreinte({ theme: 'jour' }),
    // La zone des annonces aux lecteurs d'écran, masquée par Empreinte (voir a11y.provider.ts).
    ...A11yProviders,
    // Une nouvelle page s'ouvre en haut (sinon elle garderait le défilement de la précédente, sur mobile au
    // milieu de son contenu) ; Précédent et Suivant retrouvent la position quittée. La coque déplace le focus.
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    // Apex Brain : les règles métier, les données et Akari passent tous par son API. La session de la
    // personne (gardée dans le navigateur) est reprise sans attendre le serveur : authGuard la lit.
    provideApi(environment.apiUrl),
    provideSessionEndRedirect(),
  ],
};
