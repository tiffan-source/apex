import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods } from '@ngrx/signals';
import { AuthApi } from '../api/auth.api';
import { ApiSession } from '../api/api-session';
import { UNKNOWN_ERROR, errorCodeOf } from '../api/api-error';
import type { ApiUser, SignedInResponse } from '../api/api.models';
import { AnnoncesStore } from './annonces.store';
import { withRequestStatus } from './utils/loading-feature';

export type UserViewModel = {
  id: string;
  name: string;
  email: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type SignupInput = {
  email: string;
  password: string;
  confirmPassword: string;
}

/**
 * Le compte est créé, mais l'adresse e-mail doit être confirmée avant qu'une session s'ouvre
 * (POST /v1/auth/register rend `session: null`). Ce n'est pas un code de l'API : SessionStore le pose.
 */
export const EMAIL_CONFIRMATION_REQUIRED = 'EMAIL_CONFIRMATION_REQUIRED';

const toUserViewModel = (user: ApiUser): UserViewModel => ({ id: user.id, name: user.name, email: user.email });

/**
 * La personne connectée, tirée de la session de l'API (ApiSession, qui garde les jetons dans le navigateur
 * et les renouvelle) : une session reprise à l'ouverture, renouvelée ou fermée, la change ici aussi.
 * SessionStore ouvre la session (connexion, création de compte). `error()` donne le code de l'API
 * (INVALID_CREDENTIALS, USER_ALREADY_EXIST…, ou EMAIL_CONFIRMATION_REQUIRED) : l'écran de connexion en
 * choisit la phrase (translateAuthError).
 */
export const SessionStore = signalStore(
  { providedIn: 'root' },
  withComputed((_, apiSession = inject(ApiSession)) => ({
    currentUser: computed<UserViewModel | null>(() => {
      const session = apiSession.current();
      return session ? toUserViewModel(session.user) : null;
    }),
  })),
  withComputed(({ currentUser }) => ({
    isAuthenticated: computed(() => currentUser() !== null),
    currentUserId: computed(() => currentUser()?.id ?? null),
  })),
  withRequestStatus(),
  withMethods((store,
    auth = inject(AuthApi),
    apiSession = inject(ApiSession),
    annonces = inject(AnnoncesStore)
  ) => {
    const open = (signedIn: SignedInResponse) => {
      apiSession.open(signedIn);
      // Une nouvelle session repart sans signalement : celui d'une session finie n'a plus lieu d'être.
      annonces.compris();
      patchState(store, { requestStatus: 'fulfilled' });
    };

    const fail = (error: unknown) => {
      console.error(error);
      patchState(store, { requestStatus: { error: errorCodeOf(error) ?? UNKNOWN_ERROR } });
    };

    return {
      /** Ferme la session : plus aucun jeton n'est envoyé, la personne n'est plus connectée. */
      clearSession: () => {
        apiSession.close();
      },
      login: async (input: LoginInput) => {
        patchState(store, { requestStatus: 'pending' });
        try {
          open(await auth.login({ email: input.email, password: input.password }));
        } catch (error) {
          fail(error);
        }
      },
      /** La confirmation du mot de passe est vérifiée par le formulaire : seuls l'adresse et le mot de passe partent. */
      signup: async (input: SignupInput) => {
        patchState(store, { requestStatus: 'pending' });
        try {
          const registered = await auth.register({ email: input.email, password: input.password });
          if (registered.session) {
            open({ user: registered.user, session: registered.session });
          } else {
            patchState(store, { requestStatus: { error: EMAIL_CONFIRMATION_REQUIRED } });
          }
        } catch (error) {
          fail(error);
        }
      },
    };
  }),
);
