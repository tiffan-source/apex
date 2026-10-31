import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { defer, firstValueFrom } from 'rxjs';
import {
  ApiError,
  NETWORK_ERROR,
  UNKNOWN_ERROR,
  errorCodeOf,
  isTransientError,
  isUnknownOutcome,
  retryDelay,
  retryWhileTransient,
  toApiError,
} from './api-error';

const httpError = (status: number, error: unknown) =>
  new HttpErrorResponse({ status, error, url: 'https://api.test/v1/objectives', headers: new HttpHeaders() });

describe('toApiError', () => {
  it('lit le corps d’erreur de l’API : code, statut, message technique et champs refusés', () => {
    const error = toApiError(
      httpError(400, {
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: [{ path: 'title', message: 'Too big' }] },
      }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', status: 400, message: 'Invalid request' });
    expect(error.details).toEqual([{ path: 'title', message: 'Too big' }]);
  });

  it('lit un corps d’erreur resté en texte', () => {
    expect(toApiError(httpError(404, '{"error":{"code":"TASK_NOT_FOUND","message":"Task with ID t1 not found"}}'))).toMatchObject({
      code: 'TASK_NOT_FOUND',
      status: 404,
    });
  });

  it('un serveur qui ne répond pas (réseau, CORS) donne NETWORK_ERROR', () => {
    expect(toApiError(httpError(0, new ProgressEvent('error')))).toMatchObject({ code: NETWORK_ERROR, status: 0 });
  });

  it('une réponse sans le corps de l’API (hébergeur, proxy) donne UNKNOWN_ERROR avec son statut', () => {
    expect(toApiError(httpError(502, '<html>Bad gateway</html>'))).toMatchObject({ code: UNKNOWN_ERROR, status: 502 });
  });

  it('toute autre erreur devient UNKNOWN_ERROR ; une ApiError reste telle quelle', () => {
    expect(toApiError(new Error('boom'))).toMatchObject({ code: UNKNOWN_ERROR, message: 'boom' });
    const known = new ApiError('WORKFLOW_BUSY', 409, 'busy');
    expect(toApiError(known)).toBe(known);
  });
});

describe('errorCodeOf et isTransientError', () => {
  it('donne le code d’une ApiError, rien pour une autre erreur', () => {
    expect(errorCodeOf(new ApiError('OBJECTIVE_NOT_FOUND', 404, ''))).toBe('OBJECTIVE_NOT_FOUND');
    expect(errorCodeOf(new Error('boom'))).toBeUndefined();
  });

  it('ne réessaie que les pannes passagères', () => {
    expect(isTransientError(new ApiError(NETWORK_ERROR, 0, ''))).toBe(true);
    expect(isTransientError(new ApiError('TOO_MANY_REQUESTS', 429, ''))).toBe(true);
    expect(isTransientError(new ApiError(UNKNOWN_ERROR, 503, ''))).toBe(true);
    expect(isTransientError(new ApiError('CONVERSATION_NOT_FOUND', 404, ''))).toBe(false);
    expect(isTransientError(new ApiError('UNAUTHENTICATED', 401, ''))).toBe(false);
    expect(isTransientError(new Error('boom'))).toBe(false);
  });

  it('une issue inconnue : pas de réponse, ou panne du serveur ; une requête refusée n’a rien fait', () => {
    expect(isUnknownOutcome(new ApiError(NETWORK_ERROR, 0, ''))).toBe(true);
    expect(isUnknownOutcome(new ApiError(UNKNOWN_ERROR, 500, ''))).toBe(true);
    expect(isUnknownOutcome(new ApiError('TOO_MANY_REQUESTS', 429, ''))).toBe(false);
    expect(isUnknownOutcome(new ApiError('WORKFLOW_BUSY', 409, ''))).toBe(false);
    expect(isUnknownOutcome(new Error('boom'))).toBe(false);
  });
});

describe('retryWhileTransient', () => {
  afterEach(() => vi.useRealTimers());

  /** Une requête qui rend, dans l'ordre, chaque issue (une ApiError est rejetée). */
  const responses = (...outcomes: unknown[]) => {
    let calls = 0;
    return vi.fn(async (): Promise<unknown> => {
      const outcome = outcomes[Math.min(calls++, outcomes.length - 1)];
      if (outcome instanceof ApiError) throw outcome;
      return outcome;
    });
  };

  it('espace les essais : 1 s, 2 s, 4 s, 8 s, puis 10 s au plus', () => {
    expect([1, 2, 3, 4, 5, 9].map((retryCount) => retryDelay(retryCount))).toEqual([1000, 2000, 4000, 8000, 10_000, 10_000]);
  });

  it('réessaie une panne passagère jusqu’à la réponse, et dit chaque nouvel essai', async () => {
    vi.useFakeTimers();
    const call = responses(new ApiError(NETWORK_ERROR, 0, ''), new ApiError(UNKNOWN_ERROR, 503, ''), 'ok');
    const onRetry = vi.fn();
    const result = firstValueFrom(defer(call).pipe(retryWhileTransient({ onRetry })));

    await vi.advanceTimersByTimeAsync(1000);
    expect(call).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toBe('ok');
    expect(call).toHaveBeenCalledTimes(3);
    expect(onRetry.mock.calls).toEqual([[1], [2]]);
  });

  it('laisse remonter tout de suite une requête refusée', async () => {
    const refused = new ApiError('OBJECTIVE_NOT_FOUND', 404, '');
    const call = responses(refused);
    await expect(firstValueFrom(defer(call).pipe(retryWhileTransient()))).rejects.toBe(refused);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('s’arrête après maxRetries nouveaux essais, sur la dernière panne', async () => {
    vi.useFakeTimers();
    const down = new ApiError(NETWORK_ERROR, 0, '');
    const call = responses(down);
    const result = firstValueFrom(defer(call).pipe(retryWhileTransient({ maxRetries: 2 })));
    const settled = expect(result).rejects.toBe(down);
    await vi.advanceTimersByTimeAsync(3000);
    await settled;
    expect(call).toHaveBeenCalledTimes(3);
  });
});
