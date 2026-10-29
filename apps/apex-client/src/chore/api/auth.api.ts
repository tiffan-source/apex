import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './api.config';
import { request } from './api-error';
import type { Credentials, RegisteredResponse, SignedInResponse } from './api.models';

/**
 * L'authentification, par l'API (Supabase Auth est derrière elle). Le renouvellement de la session est
 * fait par ApiSession. Une réponse refusée devient une ApiError : INVALID_CREDENTIALS, EMAIL_NOT_CONFIRMED,
 * USER_ALREADY_EXIST, WEAK_PASSWORD, INVALID_EMAIL, TOO_MANY_REQUESTS…
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/v1/auth`;

  /** POST /v1/auth/register : la session vaut null tant que l'adresse doit être confirmée. */
  register(credentials: Credentials): Promise<RegisteredResponse> {
    return request(this.http.post<RegisteredResponse>(`${this.url}/register`, credentials));
  }

  /** POST /v1/auth/login */
  login(credentials: Credentials): Promise<SignedInResponse> {
    return request(this.http.post<SignedInResponse>(`${this.url}/login`, credentials));
  }
}
