import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../api/api.config';
import { ApiError } from '../api/api-error';
import { ApiSession, SESSION_STORAGE_KEY } from '../api/api-session';
import { AuthApi } from '../api/auth.api';
import type { SignedInResponse } from '../api/api.models';
import { AnnoncesStore } from './annonces.store';
import { EMAIL_CONFIRMATION_REQUIRED, SessionStore } from './session.store';

/*
 * La personne connectée, tirée de la session de l'API : reprise à l'ouverture sans attendre le serveur,
 * connexion et création de compte par l'API, codes d'erreur gardés pour l'écran de connexion.
 */

const LEA = { id: 'u1', name: 'Léa Martin', email: 'lea@exemple.com' };
const SIGNED_IN: SignedInResponse = {
  user: LEA,
  session: { accessToken: 'a1', refreshToken: 'r1', expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
};

function setup() {
  const auth = { login: vi.fn(), register: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: API_URL, useValue: 'https://api.test' },
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthApi, useValue: auth },
      { provide: LiveAnnouncer, useValue: { announce: vi.fn().mockResolvedValue(undefined) } },
    ],
  });
  return {
    store: TestBed.inject(SessionStore),
    apiSession: TestBed.inject(ApiSession),
    annonces: TestBed.inject(AnnoncesStore),
    auth,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  TestBed.resetTestingModule();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('SessionStore', () => {
  it('reprend la personne de la session gardée dans le navigateur', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(SIGNED_IN));
    const { store } = setup();
    expect(store.isAuthenticated()).toBe(true);
    expect(store.currentUser()).toEqual(LEA);
    expect(store.currentUserId()).toBe('u1');
  });

  it('sans session gardée, personne n’est connecté', () => {
    const { store } = setup();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.currentUserId()).toBeNull();
  });

  it('la connexion ouvre la session de l’API, et efface le signalement d’une session finie', async () => {
    const { store, apiSession, annonces, auth } = setup();
    annonces.signaler("Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.");
    auth.login.mockResolvedValue(SIGNED_IN);

    const done = store.login({ email: 'lea@exemple.com', password: 'secret1' });
    expect(store.isPending()).toBe(true);
    await done;

    expect(auth.login).toHaveBeenCalledWith({ email: 'lea@exemple.com', password: 'secret1' });
    expect(apiSession.current()).toEqual(SIGNED_IN);
    expect(store.currentUser()).toEqual(LEA);
    expect(store.isFulfilled()).toBe(true);
    expect(annonces.signalement()).toBeNull();
  });

  it('une connexion refusée garde le code de l’API, jamais son message', async () => {
    const { store, auth } = setup();
    auth.login.mockRejectedValue(new ApiError('INVALID_CREDENTIALS', 401, 'Invalid email or password.'));
    await store.login({ email: 'lea@exemple.com', password: 'faux' });
    expect(store.error()).toBe('INVALID_CREDENTIALS');
    expect(store.isAuthenticated()).toBe(false);
  });

  it('une panne inattendue donne UNKNOWN_ERROR', async () => {
    const { store, auth } = setup();
    auth.login.mockRejectedValue(new Error('boom'));
    await store.login({ email: 'lea@exemple.com', password: 'secret1' });
    expect(store.error()).toBe('UNKNOWN_ERROR');
  });

  it('la création de compte n’envoie que l’adresse et le mot de passe, et ouvre la session rendue', async () => {
    const { store, auth } = setup();
    auth.register.mockResolvedValue(SIGNED_IN);
    await store.signup({ email: 'lea@exemple.com', password: 'secret1', confirmPassword: 'secret1' });
    expect(auth.register).toHaveBeenCalledWith({ email: 'lea@exemple.com', password: 'secret1' });
    expect(store.currentUser()).toEqual(LEA);
  });

  it('un compte créé dont l’adresse attend sa confirmation n’ouvre pas de session', async () => {
    const { store, auth } = setup();
    auth.register.mockResolvedValue({ user: LEA, session: null });
    await store.signup({ email: 'lea@exemple.com', password: 'secret1', confirmPassword: 'secret1' });
    expect(store.isAuthenticated()).toBe(false);
    expect(store.error()).toBe(EMAIL_CONFIRMATION_REQUIRED);
  });

  it('suit la session : fermée (renouvellement refusé, autre onglet), la personne n’est plus connectée', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(SIGNED_IN));
    const { store, apiSession } = setup();
    apiSession.close();
    expect(store.isAuthenticated()).toBe(false);
  });

  it('clearSession ferme la session de l’API', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(SIGNED_IN));
    const { store, apiSession } = setup();
    store.clearSession();
    expect(apiSession.current()).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});
