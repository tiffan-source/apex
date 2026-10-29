import {
  type EnvironmentProviders,
  Injector,
  effect,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import { Router } from '@angular/router';
import { SessionStore } from '../stores/session.store';

/**
 * Quand la session prend fin pendant qu'Apex est ouvert (renouvellement refusé par l'API, session fermée
 * dans un autre onglet), la personne retourne à la connexion. À l'ouverture d'une page, authGuard s'en charge.
 */
export function provideSessionEndRedirect(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideEnvironmentInitializer(() => {
      const session = inject(SessionStore);
      const injector = inject(Injector);
      let wasAuthenticated = false;
      effect(() => {
        const authenticated = session.isAuthenticated();
        if (wasAuthenticated && !authenticated) void injector.get(Router).navigate(['/auth']);
        wasAuthenticated = authenticated;
      });
    }),
  ]);
}
