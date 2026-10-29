import { HttpBackend, HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { API_URL } from './api.config';
import { ApiError, request } from './api-error';
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
 * - Un renouvellement refusé ferme la session. Une panne (réseau, serveur endormi) la garde : on ne
 *   déconnecte personne pour une panne.
 * - Les onglets partagent la session : une connexion, un renouvellement ou une fermeture dans l'un vaut
 *   dans les autres (événement « storage »), sans réutiliser un jeton de renouvellement déjà consommé.
 */
@Injectable({ providedIn: 'root' })
export class ApiSession {
  private readonly refreshUrl = `${inject(API_URL)}/v1/auth/refresh`;
  /** Sans intercepteur : le renouvellement ne repasse pas par celui qui l'a demandé. */
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly state = signal<StoredSession | null>(readStoredSession());
  private refreshing: Promise<boolean> | null = null;

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

  /** Le jeton d'accès à envoyer, renouvelé d'abord s'il expire bientôt ; null sans session. */
  async accessToken(): Promise<string | null> {
    const current = this.state();
    if (!current) return null;
    if (expiresSoon(current.session.expiresAt)) await this.refresh();
    return this.state()?.session.accessToken ?? null;
  }

  /** Renouvelle la session (une seule requête à la fois). Vrai si un jeton neuf est là. */
  refresh(): Promise<boolean> {
    this.refreshing ??= this.renew().finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  private async renew(): Promise<boolean> {
    if (this.adoptNewerStoredSession()) return true;
    const current = this.state();
    if (!current) return false;

    try {
      const renewed = await request(
        this.http.post<SignedInResponse>(this.refreshUrl, { refreshToken: current.session.refreshToken }),
      );
      // Fermée, ou rouverte par une connexion, pendant le renouvellement : on n'y touche plus.
      if (this.state() !== current) return this.state() !== null;
      this.open(renewed);
      return true;
    } catch (error) {
      // Un autre onglet a pu la renouveler entre-temps : son jeton de renouvellement a remplacé celui-ci.
      if (this.adoptNewerStoredSession()) return true;
      if (error instanceof ApiError && error.status === 401 && this.state() === current) this.close();
      return false;
    }
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
