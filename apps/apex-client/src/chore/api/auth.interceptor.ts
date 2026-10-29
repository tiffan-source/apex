import { HttpErrorResponse, type HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { API_URL, isApiRequest } from './api.config';
import { ApiSession } from './api-session';

/** Les routes de l'API qui ouvrent ou renouvellent une session : elles ne demandent pas de jeton. */
const PUBLIC_ROUTES: ReadonlySet<string> = new Set(['/v1/auth/register', '/v1/auth/login', '/v1/auth/refresh']);

const withBearer = (request: HttpRequest<unknown>, token: string | null) =>
  token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

/**
 * Chaque requête vers l'API part avec le jeton d'accès de la personne (`Authorization: Bearer`), renouvelé
 * d'abord s'il expire bientôt. Une requête refusée (401) part une seconde fois après un renouvellement.
 * Si l'API refuse le renouvellement, ApiSession ferme la session et le 401 remonte (« ta session a pris
 * fin ») ; si une panne l'empêche, la session reste ouverte et c'est la panne qui remonte (« vérifie ta
 * connexion »). Le jeton ne part jamais vers un autre hôte que l'API, ni pour une autre personne que
 * celle pour qui la requête est partie (une autre a pu se connecter entre-temps dans un autre onglet).
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const apiUrl = inject(API_URL);
  if (!isApiRequest(request.url, apiUrl)) return next(request);

  const path = request.url.slice(apiUrl.length).split(/[?#]/, 1)[0];
  if (PUBLIC_ROUTES.has(path)) return next(request);

  const session = inject(ApiSession);
  const owner = session.ownerId();
  const send = () => from(session.accessToken(owner)).pipe(switchMap((token) => next(withBearer(request, token))));

  return send().pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) return throwError(() => error);
      return from(session.refresh(owner)).pipe(
        switchMap((outcome) => (outcome.renewed ? send() : throwError(() => outcome.failure ?? error))),
      );
    }),
  );
};
