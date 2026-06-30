
import { CoreErrorMetadata } from './core.error';

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; metadata?: CoreErrorMetadata } };

/**
 * Construire un résultat de succès typé.
 */
function success<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Construire un résultat d'échec normalisé.
 */
function failure<T = unknown>(code: string, message: string, metadata?: CoreErrorMetadata): Result<T> {
  return { success: false, error: { code, message, metadata } };
}

type DomainErrorLike = Error & { code: string; metadata?: CoreErrorMetadata };
type ExpectedDomainErrorConstructor = abstract new (...args: never[]) => DomainErrorLike;

function isDomainErrorLike(error: unknown): error is DomainErrorLike {
  return (
    error instanceof Error &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

/**
 * Exécuter une action et normaliser ses erreurs en Result<T>.
 */
export async function runWithResult<T>(
  action: () => Promise<T>,
  expectedErrors: ReadonlyArray<ExpectedDomainErrorConstructor>,
  fallbackUnknownMessage: string,
): Promise<Result<T>> {
  try {
    return success(await action());
  } catch (error: unknown) {
    if (isDomainErrorLike(error) && expectedErrors.some((ErrorType) => error instanceof ErrorType)) {
      return failure(error.code, error.message, error.metadata);
    }

    const message = error instanceof Error ? error.message : fallbackUnknownMessage;
    return failure('UNKNOWN_ERROR', message);
  }
}
