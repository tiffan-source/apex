import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { CreateNewUserUseCase, GetCurrentUserUseCase, LogUserInUseCase } from '@org/auth';
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

export const SessionStore = signalStore(
  { providedIn: 'root' },
  withState<{ currentUser: UserViewModel | null }>({ currentUser: null }),
  withComputed(({ currentUser }) => ({
    isAuthenticated: computed(() => currentUser() !== null),
    currentUserId: computed(() => currentUser()?.id ?? null),
  })),
  withRequestStatus(),
  withMethods((store,
    getCurrentUser = inject(GetCurrentUserUseCase),
    logginUserUsecase = inject(LogUserInUseCase),
    signUpUserUsecase = inject(CreateNewUserUseCase)
  ) => ({
    restoreSession: async () => {
      const result = await getCurrentUser.execute();

      if (result.success) {
        patchState(store, { currentUser: result.data });
      } else {
        patchState(store, { currentUser: null });
      }
    },
    clearSession: () => {
      patchState(store, { currentUser: null });
    },
    login: async (input: LoginInput) => {
      patchState(store, { requestStatus: 'pending' });
      const result = await logginUserUsecase.execute(input);
      if (result.success) {
        patchState(store, { currentUser: {
          id: result.data.uid,
          email: result.data.email,
          name: result.data.displayName ?? '',
        }, requestStatus: 'fulfilled' });
      } else {
        patchState(store, { requestStatus: { error: result.error.message } });
      }
    },
    signup: async (input: SignupInput) => {
      patchState(store, { requestStatus: 'pending' });
      const result = await signUpUserUsecase.execute(input);
      if (result.success) {

        patchState(store, { currentUser: {
          id: result.data.uid,
          email: result.data.email,
          name: result.data.displayName ?? '',
        }, requestStatus: 'fulfilled' });
      } else {
        patchState(store, { requestStatus: { error: result.error.message } });
      }
    }
  })),
);
