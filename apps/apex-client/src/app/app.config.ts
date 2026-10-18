import {
  ApplicationConfig,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { providePrimeNG } from 'primeng/config';
import { DesignSystemPreset, designSystemThemeOptions } from '@org/design-tokens';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { ChoreProviders } from '../chore/providers/chore.providers';
import { ObjectiveProviders } from '../chore/providers/objective.providers';
import { provideRouter, withComponentInputBinding } from '@angular/router';
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
    providePrimeNG({
      theme: {
        preset: DesignSystemPreset,
        options: designSystemThemeOptions
      }
    }),
    provideRouter(routes, withComponentInputBinding()),
    ...provideSupabase(env.SUPABASE_CONFIG),
    ...provideFirebase(env.FIREBASE_CONFIG),
    ...provideGemini(),
    ...ChoreProviders,
    ...ObjectiveProviders,
    ...AIProvider,
    ...AuthProviders,
    ...ChoreProviders,
    ...ChatProvider,
    ...WorkflowProvider
  ],
};
