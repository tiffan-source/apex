import {
  ApplicationConfig,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideEmpreinte } from '@empreinte-studio/angular/core';
import { ChoreProviders } from '../chore/providers/chore.providers';
import { A11yProviders } from '../chore/providers/a11y.provider';
import { ObjectiveProviders } from '../chore/providers/objective.providers';
import { routes } from './app.routes';
import { AIProvider } from '../chore/providers/ai.provider';
import { provideGemini } from '../chore/providers/gemini.provider';
import env from "../../env/env"
import { SessionStore } from '../chore/stores/session.store';
import { provideSupabase } from '../chore/providers/supabase.provider';
import { provideFirebase } from '../chore/providers/firebase.provider';
import { AuthProviders } from '../chore/providers/auth.provider';
import { ChatProvider } from '../chore/providers/chat.provider';
import { WorkflowProvider } from '../chore/providers/workflow.provider';

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(async () => {
      const authService = inject(SessionStore);
      return await authService.restoreSession();
    }),
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
    ...provideSupabase(env.SUPABASE_CONFIG),
    ...provideFirebase(env.FIREBASE_CONFIG),
    ...provideGemini(),
    ...ChoreProviders,
    ...ObjectiveProviders,
    ...AIProvider,
    ...AuthProviders,
    ...ChatProvider,
    ...WorkflowProvider
  ],
};
