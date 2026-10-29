import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api.config';
import { ApiSession, REFRESH_MARGIN_MS, SESSION_STORAGE_KEY, type StoredSession } from './api-session';
import { authInterceptor } from './auth.interceptor';

/*
 * La session auprès de l'API et l'intercepteur qui envoie son jeton : en-tête Bearer vers l'API seulement,
 * renouvellement avant l'expiration ou sur un 401, session fermée quand le renouvellement est refusé,
 * gardée pendant une panne, partagée entre les onglets.
 */

const API = 'https://api.test';
const user = { id: 'u1', name: 'Léa', email: 'lea@exemple.com' };

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const session = (accessToken: string, refreshToken: string, expiresAt = inMinutes(60)): StoredSession => ({
  user,
  session: { accessToken, refreshToken, expiresAt },
});

const stored = (): StoredSession | null => {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as StoredSession) : null;
};

/** Laisse passer les promesses (le jeton est lu avant que la requête parte). */
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

let httpMock: HttpTestingController | undefined;

function setup(initial: StoredSession | null) {
  if (initial) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(initial));
  TestBed.configureTestingModule({
    providers: [
      { provide: API_URL, useValue: API },
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  httpMock = TestBed.inject(HttpTestingController);
  return {
    http: TestBed.inject(HttpClient),
    httpMock,
    apiSession: TestBed.inject(ApiSession),
  };
}

beforeEach(() => localStorage.clear());

afterEach(() => {
  httpMock?.verify();
  httpMock = undefined;
  TestBed.resetTestingModule();
  localStorage.clear();
});

describe('ApiSession', () => {
  it('reprend la session gardée dans le navigateur, sans attendre le serveur', () => {
    const { apiSession } = setup(session('a1', 'r1'));
    expect(apiSession.current()?.user).toEqual(user);
  });

  it('ignore une session illisible', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, '{"user":{"id":"u1"}}');
    const { apiSession } = setup(null);
    expect(apiSession.current()).toBeNull();
  });

  it('ouvre et ferme la session, dans le navigateur aussi', () => {
    const { apiSession } = setup(null);
    apiSession.open(session('a1', 'r1'));
    expect(stored()?.session.accessToken).toBe('a1');
    apiSession.close();
    expect(apiSession.current()).toBeNull();
    expect(stored()).toBeNull();
  });

  it('suit une connexion ou une fermeture faite dans un autre onglet', () => {
    const { apiSession } = setup(session('a1', 'r1'));
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session('a2', 'r2')));
    window.dispatchEvent(new StorageEvent('storage', { key: SESSION_STORAGE_KEY }));
    expect(apiSession.current()?.session.accessToken).toBe('a2');

    localStorage.removeItem(SESSION_STORAGE_KEY);
    window.dispatchEvent(new StorageEvent('storage', { key: SESSION_STORAGE_KEY }));
    expect(apiSession.current()).toBeNull();
  });
});

describe('authInterceptor', () => {
  it('envoie le jeton de la personne à l’API', async () => {
    const { http, httpMock } = setup(session('a1', 'r1'));
    const response = firstValueFrom(http.get(`${API}/v1/objectives`));
    await settle();

    const request = httpMock.expectOne(`${API}/v1/objectives`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer a1');
    request.flush({ objectives: [], tasks: [] });
    await expect(response).resolves.toEqual({ objectives: [], tasks: [] });
  });

  it('n’envoie jamais le jeton à un autre hôte, ni aux routes qui ouvrent une session', async () => {
    const { http, httpMock } = setup(session('a1', 'r1'));
    void firstValueFrom(http.get('https://ailleurs.test/v1/objectives'));
    void firstValueFrom(http.get('https://api.test.ailleurs.test/v1/objectives'));
    void firstValueFrom(http.post(`${API}/v1/auth/login`, {}));
    await settle();

    for (const url of ['https://ailleurs.test/v1/objectives', 'https://api.test.ailleurs.test/v1/objectives', `${API}/v1/auth/login`]) {
      const request = httpMock.expectOne(url);
      expect(request.request.headers.has('Authorization'), url).toBe(false);
      request.flush({});
    }
  });

  it('sans session, la requête part sans jeton', async () => {
    const { http, httpMock } = setup(null);
    void firstValueFrom(http.get(`${API}/v1/objectives`)).catch(() => undefined);
    await settle();
    const request = httpMock.expectOne(`${API}/v1/objectives`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ error: { code: 'UNAUTHENTICATED', message: 'Missing token' } }, { status: 401, statusText: 'Unauthorized' });
    await settle();
  });

  it('renouvelle d’abord un jeton qui expire bientôt, une seule fois pour plusieurs requêtes', async () => {
    const { http, httpMock, apiSession } = setup(session('a1', 'r1', new Date(Date.now() + REFRESH_MARGIN_MS / 2).toISOString()));
    const first = firstValueFrom(http.get(`${API}/v1/objectives`));
    const second = firstValueFrom(http.get(`${API}/v1/tasks/today-focus`));
    await settle();

    const refresh = httpMock.expectOne(`${API}/v1/auth/refresh`);
    expect(refresh.request.body).toEqual({ refreshToken: 'r1' });
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush(session('a2', 'r2'));
    await settle();

    for (const url of [`${API}/v1/objectives`, `${API}/v1/tasks/today-focus`]) {
      const request = httpMock.expectOne(url);
      expect(request.request.headers.get('Authorization')).toBe('Bearer a2');
      request.flush([]);
    }
    await Promise.all([first, second]);
    expect(apiSession.current()?.session.refreshToken).toBe('r2');
    expect(stored()?.session.refreshToken).toBe('r2');
  });

  it('un jeton refusé (401) : un renouvellement, puis un seul nouvel essai', async () => {
    const { http, httpMock } = setup(session('a1', 'r1'));
    const response = firstValueFrom(http.get(`${API}/v1/objectives`));
    await settle();

    httpMock
      .expectOne(`${API}/v1/objectives`)
      .flush({ error: { code: 'UNAUTHENTICATED', message: 'Invalid token' } }, { status: 401, statusText: 'Unauthorized' });
    await settle();
    httpMock.expectOne(`${API}/v1/auth/refresh`).flush(session('a2', 'r2'));
    await settle();

    const retry = httpMock.expectOne(`${API}/v1/objectives`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer a2');
    retry.flush({ objectives: [], tasks: [] });
    await expect(response).resolves.toEqual({ objectives: [], tasks: [] });
  });

  it('un renouvellement refusé ferme la session, et l’erreur remonte', async () => {
    const { http, httpMock, apiSession } = setup(session('a1', 'r1'));
    const response = firstValueFrom(http.get(`${API}/v1/objectives`));
    await settle();

    httpMock
      .expectOne(`${API}/v1/objectives`)
      .flush({ error: { code: 'UNAUTHENTICATED', message: 'Invalid token' } }, { status: 401, statusText: 'Unauthorized' });
    await settle();
    httpMock
      .expectOne(`${API}/v1/auth/refresh`)
      .flush({ error: { code: 'INVALID_SESSION', message: 'Session expired' } }, { status: 401, statusText: 'Unauthorized' });

    await expect(response).rejects.toMatchObject({ status: 401 });
    expect(apiSession.current()).toBeNull();
    expect(stored()).toBeNull();
  });

  it('une panne pendant le renouvellement garde la session : on ne déconnecte personne pour une panne', async () => {
    const { http, httpMock, apiSession } = setup(session('a1', 'r1'));
    const response = firstValueFrom(http.get(`${API}/v1/objectives`));
    await settle();

    httpMock
      .expectOne(`${API}/v1/objectives`)
      .flush({ error: { code: 'UNAUTHENTICATED', message: 'Invalid token' } }, { status: 401, statusText: 'Unauthorized' });
    await settle();
    httpMock.expectOne(`${API}/v1/auth/refresh`).error(new ProgressEvent('error'));

    await expect(response).rejects.toMatchObject({ status: 401 });
    expect(apiSession.current()?.session.refreshToken).toBe('r1');
  });

  it('reprend la session qu’un autre onglet a renouvelée, sans réutiliser un jeton de renouvellement consommé', async () => {
    const { http, httpMock, apiSession } = setup(session('a1', 'r1', new Date(Date.now() + REFRESH_MARGIN_MS / 2).toISOString()));
    // Un autre onglet a renouvelé la session ; l'événement « storage » n'est pas encore arrivé ici.
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session('a2', 'r2')));

    const response = firstValueFrom(http.get(`${API}/v1/objectives`));
    await settle();

    httpMock.expectNone(`${API}/v1/auth/refresh`);
    const request = httpMock.expectOne(`${API}/v1/objectives`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer a2');
    request.flush({ objectives: [], tasks: [] });
    await response;
    expect(apiSession.current()?.session.refreshToken).toBe('r2');
  });
});
