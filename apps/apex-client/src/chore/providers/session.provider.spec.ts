import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStore } from '../stores/session.store';
import { provideSessionEndRedirect } from './session.provider';

function setup(authenticated: boolean) {
  const isAuthenticated = signal(authenticated);
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideSessionEndRedirect(), { provide: SessionStore, useValue: { isAuthenticated } }],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  TestBed.tick();
  return { isAuthenticated, navigate };
}

afterEach(() => {
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
});

describe('provideSessionEndRedirect', () => {
  it('mène à la connexion quand la session prend fin', () => {
    const { isAuthenticated, navigate } = setup(true);
    expect(navigate).not.toHaveBeenCalled();

    isAuthenticated.set(false);
    TestBed.tick();
    expect(navigate).toHaveBeenCalledWith(['/auth']);
  });

  it('ne fait rien à l’ouverture sans session (authGuard s’en charge), ni à la connexion', () => {
    const { isAuthenticated, navigate } = setup(false);
    isAuthenticated.set(true);
    TestBed.tick();
    expect(navigate).not.toHaveBeenCalled();
  });
});
