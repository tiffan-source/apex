import { HttpBackend, HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { API_URL } from './api.config';
import { type ApiError, errorCodeOf, request, toApiError } from './api-error';
import type { SignedInResponse } from './api.models';

/** Où la session est gardée entre deux visites, et partagée entre les onglets. */
export const SESSION_STORAGE_KEY = 'apex:session';

/**
 * Le jeton d'accès est renouvelé un peu avant son expiration : une requête partie juste avant n'arrive
 * pas avec un jeton périmé.
 */
export const REFRESH_MARGIN_MS = 60_000;

/** La session ouverte : la personne et ses jetons, tels que l'API les a rendus. */
export type StoredSession = SignedInResponse;

/**
 * L'issue d'un renouvellement : un jeton neuf de la même personne, ou rien. `failure` : la panne qui l'a
 * empêché quand la session reste ouverte (réseau, limite de débit…) ; null quand la session a pris fin.
 */
export type RefreshOutcome = { renewed: true } | { renewed: false; failure: ApiError | null };

const NOT_RENEWED: RefreshOutcome = { renewed: false, failure: null };

function isStoredSession(value: unknown): value is StoredSession {
  const candidate = value as Partial<StoredSession> | null;
  return (
    typeof candidate?.user?.id === 'string' &&
    typeof candidate.user.name === 'string' &&
    typeof candidate.user.email === 'string' &&
    typeof candidate.session?.accessToken === 'string' &&
    typeof candidate.session.refreshToken === 'string' &&
    typeof candidate.session.expiresAt === 'string'
  );
}

/** La session gardée dans le navigateur ; null s'il n'y en a pas, si elle est illisible ou sans stockage. */
export function readStoredSession(): StoredSession | null {
  try {
    const raw = globalThis.localStorage?.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession | null): void {
  try {
    if (session) globalThis.localStorage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else globalThis.localStorage?.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Pas de stockage (navigation privée stricte…) : la session vit le temps de la page.
  }
}

/** Le jeton d'accès expire (ou a expiré) dans moins de REFRESH_MARGIN_MS ; une date illisible compte comme expirée. */
export function expiresSoon(expiresAt: string, now = Date.now()): boolean {
  const expiry = Date.parse(expiresAt);
  return Number.isNaN(expiry) || expiry - now < REFRESH_MARGIN_MS;
}

/**
 * La session de la personne auprès de l'API : ses jetons, gardés dans le navigateur (comme le faisait
 * supabase-js), et leur renouvellement. L'intercepteur d'authentification lui demande le jeton de chaque
 * requête ; SessionStore en tire la personne connectée.
 *
 * - Le jeton d'accès est renouvelé avant son expiration, ou quand l'API le refuse (401), une seule
 *   requête à la fois : le jeton de renouvellement ne sert qu'une fois.
 * - Un renouvellement que l'API refuse (`INVALID_SESSION` : jeton consommé, révoqué, expiré) ferme la
 *   session. Toute autre issue (réseau, serveur endormi, limite de débit, réponse d'un proxy) la garde :
 *   on ne déconnecte personne pour une panne.
 * - Les onglets partagent la session : une connexion, un renouvellement ou une fermeture dans l'un vaut
 *   dans les autres (événement « storage »), sans réutiliser un jeton de renouvellement déjà consommé,
 *   ni effacer la session qu'un autre onglet vient d'ouvrir.
 * - Une requête ne part qu'avec le jeton de la personne pour qui elle est partie (`owner`) : si une autre
 *   personne s'est connectée entre-temps (dans un autre onglet), elle n'en reçoit aucun.
 */
@Injectable({ providedIn: 'root' })
export class ApiSession {
  private readonly refreshUrl = `${inject(API_URL)}/v1/auth/refresh`;
  /** Sans intercepteur : le renouvellement ne repasse pas par celui qui l'a demandé. */
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly state = signal<StoredSession | null>(readStoredSession());
  private refreshing: Promise<RefreshOutcome> | null = null;

  /** La session ouverte, ou null. */
  readonly current = this.state.asReadonly();

  constructor() {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_STORAGE_KEY || event.key === null) this.state.set(readStoredSession());
    };
    globalThis.addEventListener?.('storage', onStorage);
    inject(DestroyRef).onDestroy(() => globalThis.removeEventListener?.('storage', onStorage));
  }

  /** Ouvre la session rendue par l'API (connexion, création de compte, renouvellement). */
  open(session: StoredSession): void {
    this.state.set(session);
    writeStoredSession(session);
  }

  /** Ferme la session : plus aucun jeton n'est envoyé. */
  close(): void {
    this.state.set(null);
    writeStoredSession(null);
  }

  /** La personne de la session ouverte, ou null. */
  ownerId(): string | null {
    return this.state()?.user.id ?? null;
  }

  /**
   * Le jeton d'accès à envoyer pour `owner`, renouvelé d'abord s'il expire bientôt ; null sans session, ou
   * si la session ouverte est (ou devient pendant le renouvellement) celle d'une autre personne.
   */
  async accessToken(owner: string | null = this.ownerId()): Promise<string | null> {
    const current = this.state();
    if (!current || current.user.id !== owner) return null;
    if (expiresSoon(current.session.expiresAt)) await this.refresh(owner);
    const now = this.state();
    return now && now.user.id === owner ? now.session.accessToken : null;
  }

  /**
   * Renouvelle la session de `owner` (une seule requête à la fois). `renewed` : un jeton neuf de cette
   * personne est là, la requête refusée peut repartir avec lui ; jamais avec la session d'une autre.
   */
  async refresh(owner: string | null = this.ownerId()): Promise<RefreshOutcome> {
    if (owner === null || this.ownerId() !== owner) return NOT_RENEWED;
    this.refreshing ??= this.renew().finally(() => (this.refreshing = null));
    const outcome = await this.refreshing;
    return this.ownerId() === owner ? outcome : NOT_RENEWED;
  }

  private async renew(): Promise<RefreshOutcome> {
    if (this.adoptNewerStoredSession()) return { renewed: true };
    const current = this.state();
    if (!current) return NOT_RENEWED;

    try {
      const renewed = await request(
        this.http.post<SignedInResponse>(this.refreshUrl, { refreshToken: current.session.refreshToken }),
      );
      // Fermée, ou rouverte par une connexion, pendant le renouvellement : on n'y touche plus.
      if (this.state() !== current) return this.isRenewalOf(current) ? { renewed: true } : NOT_RENEWED;
      this.open(renewed);
      return { renewed: true };
    } catch (error) {
      // Un autre onglet a pu la renouveler entre-temps : son jeton de renouvellement a remplacé celui-ci.
      if (this.adoptNewerStoredSession()) return { renewed: true };
      if (this.state() !== current) return this.isRenewalOf(current) ? { renewed: true } : NOT_RENEWED;
      if (errorCodeOf(error) === 'INVALID_SESSION') {
        this.end(current);
        return NOT_RENEWED;
      }
      // La session reste ouverte : c'est la panne qui remonte, et non le 401 de la requête (l'écran dit
      // alors de vérifier la connexion, et non que la session a pris fin).
      return { renewed: false, failure: toApiError(error) };
    }
  }

  /** La session ouverte prolonge `previous` : même personne, jeton d'accès neuf. */
  private isRenewalOf(previous: StoredSession): boolean {
    const now = this.state();
    return now !== null && now.user.id === previous.user.id && now.session.accessToken !== previous.session.accessToken;
  }

  /**
   * Ferme la session que l'API refuse, ici et dans le navigateur, sauf si le navigateur en garde déjà une
   * autre (un autre onglet s'est reconnecté entre-temps) : celle-là est reprise, et non effacée.
   */
  private end(refused: StoredSession): void {
    const stored = readStoredSession();
    if (stored && stored.session.refreshToken !== refused.session.refreshToken) this.state.set(stored);
    else this.close();
  }

  /**
   * Reprend la session qu'un autre onglet a renouvelée pour la même personne (jeton de renouvellement
   * différent, jeton d'accès encore frais) plutôt que de renouveler avec un jeton déjà consommé.
   */
  private adoptNewerStoredSession(): boolean {
    const current = this.state();
    const stored = readStoredSession();
    if (
      !current ||
      !stored ||
      stored.user.id !== current.user.id ||
      stored.session.refreshToken === current.session.refreshToken ||
      expiresSoon(stored.session.expiresAt)
    ) {
      return false;
    }
    this.state.set(stored);
    return true;
  }
}
