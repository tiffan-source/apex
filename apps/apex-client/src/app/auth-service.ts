import { effect, inject, Injectable, signal } from "@angular/core";
import { AppServices } from "./app.services";

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly appServices = inject(AppServices);

  private readonly _isAuthenticated = signal(false);
  readonly isAuthenticated = this._isAuthenticated.asReadonly();

  constructor() {
    effect(() => {
      if (this._isAuthenticated()) {
        this.appServices.bootstrap();
      }
    });
  }

  async restoreSession(): Promise<void> {
    this._isAuthenticated.set(true);
  }
}
