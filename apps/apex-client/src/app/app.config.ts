import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { providePrimeNG } from 'primeng/config';
import Lara from '@primeuix/themes/lara';
import { ChoreProviders } from '../chore/providers/chore.providers';
import { ObjectiveProviders } from '../chore/providers/objective.providers';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { AIProvider } from '../chore/providers/ai.provider';
import { provideGemini } from '../chore/providers/gemini.provider';
import env from "../../env/env"
import { SessionStore } from '../chore/stores/session.store';
import { provideSupabase } from '../chore/providers/supabase.provider';
import { AuthProviders } from '../chore/providers/auth.provider';
import { ChatProvider } from '../chore/providers/chat.provider';
import { WorkflowProvider } from '../chore/providers/workflow.provider';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(async () => {
      const authService = inject(SessionStore);
      return await authService.restoreSession();
    }),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    providePrimeNG({
      theme: {
        preset: Lara,
        options: {
            darkModeSelector: false || 'none'
        }
      }
    }),
    provideRouter(routes, withComponentInputBinding()),
    ...provideSupabase(env.SUPABASE_CONFIG),
    ...provideGemini(env.GEMINI_API_KEY),
    ...ChoreProviders,
    ...ObjectiveProviders,
    ...AIProvider,
    ...AuthProviders,
    ...ChoreProviders,
    ...ChatProvider,
    ...WorkflowProvider
  ],
};
