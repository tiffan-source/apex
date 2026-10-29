import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ApiError, NETWORK_ERROR, UNKNOWN_ERROR, errorCodeOf, isTransientError, toApiError } from './api-error';

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
});
