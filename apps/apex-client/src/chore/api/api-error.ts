import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, type Observable } from 'rxjs';

/** Le serveur n'a pas répondu : pas de réseau, adresse injoignable, ou réponse bloquée par le navigateur. */
export const NETWORK_ERROR = 'NETWORK_ERROR';

/** Une réponse sans le corps d'erreur de l'API (hébergeur, proxy…), ou une panne inattendue. */
export const UNKNOWN_ERROR = 'UNKNOWN_ERROR';

/** Un champ refusé par la validation de l'API (`VALIDATION_ERROR`). */
export type ApiErrorDetail = {
  path: string;
  message: string;
};

/**
 * Une requête à l'API qui n'a pas abouti, d'après le corps d'erreur de l'API : `{ error: { code, message, details? } }`.
 * Le code est le contrat : le client choisit sa phrase d'après lui. Le message est technique (en anglais) :
 * il va dans la console, jamais à l'écran.
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    /** Le statut HTTP ; 0 quand le serveur n'a pas répondu. */
    readonly status: number,
    message: string,
    readonly details: readonly ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ErrorBody = { error?: { code?: unknown; message?: unknown; details?: unknown } };

/** Le corps d'une réponse d'erreur : déjà lu en JSON, ou encore en texte. */
function errorBodyOf(body: unknown): ErrorBody | null {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as ErrorBody;
    } catch {
      return null;
    }
  }
  return typeof body === 'object' && body !== null ? (body as ErrorBody) : null;
}

/** N'importe quelle erreur d'une requête, en ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return new ApiError(NETWORK_ERROR, 0, error.message);

    const body = errorBodyOf(error.error)?.error;
    if (body && typeof body.code === 'string') {
      const details = Array.isArray(body.details) ? (body.details as ApiErrorDetail[]) : [];
      return new ApiError(body.code, error.status, typeof body.message === 'string' ? body.message : '', details);
    }
    return new ApiError(UNKNOWN_ERROR, error.status, error.message);
  }

  return new ApiError(UNKNOWN_ERROR, 0, error instanceof Error ? error.message : String(error));
}

/** Le code d'une erreur de l'API, ou undefined pour toute autre erreur. */
export function errorCodeOf(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}

/**
 * Une panne passagère, qu'un nouvel essai peut lever : pas de réponse (réseau, serveur qui se réveille),
 * trop de requêtes, ou panne du serveur. Une requête refusée (400, 401, 404, 409) ne l'est pas.
 */
export function isTransientError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status === 429 || error.status >= 500);
}

/**
 * Une requête de l'API, en promesse : la réponse, ou une ApiError. Les stores enchaînent leurs écritures
 * dans une file de promesses (WriteQueue) : c'est la forme qu'ils attendent.
 */
export async function request<T>(response: Observable<T>): Promise<T> {
  try {
    return await firstValueFrom(response);
  } catch (error) {
    throw toApiError(error);
  }
}
