import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { motsAEviter } from '@empreinte-studio/angular/core';
import { AnnoncesStore } from '../../chore/stores/annonces.store';
import { EMAIL_CONFIRMATION_REQUIRED, SessionStore, type LoginInput, type SignupInput } from '../../chore/stores/session.store';
import { voiceIssues } from '../../chore/constants/messages.constante';
import { AUTH_TEXTS, AuuthenticationPage } from './auuthentication-page';
import {
  AUTH_FORM_MESSAGES,
  AUTH_SERVER_MESSAGES,
  AuthMode,
  translateAuthError,
  type AuthErrorReport,
} from './auth.form';
import { present } from '../../testing/present';

/** Un SessionStore simulé : les signaux que l'écran lit (error : le code de l'API), et les deux actions qu'il appelle. */
function createSessionStub() {
  const stub = {
    isAuthenticated: signal(false),
    isPending: signal(false),
    error: signal<string | null>(null),
    login: vi.fn<(input: LoginInput) => Promise<void>>(async () => undefined),
    signup: vi.fn<(input: SignupInput) => Promise<void>>(async () => undefined),
  };
  return stub;
}

describe('AuuthenticationPage', () => {
  let fixture: ComponentFixture<AuuthenticationPage>;
  let host: HTMLElement;
  let session: ReturnType<typeof createSessionStub>;
  let annonces: { annoncer: ReturnType<typeof vi.fn<(texte: string) => void>> };
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    session = createSessionStub();
    annonces = { annoncer: vi.fn<(texte: string) => void>() };
    await TestBed.configureTestingModule({
      imports: [AuuthenticationPage],
      providers: [
        provideRouter([]),
        { provide: SessionStore, useValue: session },
        { provide: AnnoncesStore, useValue: annonces },
      ],
    }).compileComponents();

    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(AuuthenticationPage);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  /** Laisse passer la soumission (asynchrone) puis met l'écran à jour. */
  async function settle(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
    }
  }

  const input = (id: string) => host.querySelector<HTMLInputElement>(`#${id}`);
  const text = () => host.textContent?.replace(/\s+/g, ' ') ?? '';
  const submitButton = () => present(host.querySelector<HTMLButtonElement>('button[type="submit"]'), "le bouton d'envoi");
  const switchButton = () => present(host.querySelector<HTMLButtonElement>('button[type="button"]'), 'le bouton qui change de formulaire');

  function write(id: string, value: string): void {
    const field = present(input(id), `le champ #${id}`);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  async function submit(): Promise<void> {
    submitButton().click();
    await settle();
  }

  async function switchMode(): Promise<void> {
    switchButton().click();
    await settle();
  }

  /** Le message affiché par le champ qui entoure ce contrôle. */
  function fieldMessage(id: string): string {
    return present(present(input(id), `le champ #${id}`).closest('e-champ'), `l'e-champ de #${id}`).querySelector('[aria-live]')?.textContent?.trim() ?? '';
  }

  describe('en connexion', () => {
    it('montre la marque, « Te revoilà. », la phrase en voix et les deux champs', () => {
      expect(host.querySelector('e-marque')?.textContent).toContain('Apex');
      expect(host.querySelector('h1')?.textContent?.trim()).toBe('Te revoilà.');
      expect(host.querySelector('p.voix')?.textContent?.trim()).toBe('Chaque pas laisse une empreinte.');
      expect(text()).toContain('Ton adresse e-mail');
      expect(text()).toContain('Ton mot de passe');
      expect(input('auth-confirm-password')).toBeNull();
      expect(submitButton().textContent?.trim()).toBe('Me connecter');
      expect(switchButton().textContent?.trim()).toBe('Créer un compte');
      // La question est écrite à côté du bouton, qui la fait lire : le bouton garde moins de 4 mots.
      expect(host.querySelector('#auth-question')?.textContent?.trim()).toBe('Pas encore de compte ?');
      expect(switchButton().getAttribute('aria-describedby')).toBe('auth-question');
    });

    it('relie chaque libellé à son champ, avec les bons autocomplete', () => {
      expect(host.querySelector('label[for="auth-email"]')?.textContent).toContain('Ton adresse e-mail');
      expect(host.querySelector('label[for="auth-password"]')?.textContent).toContain('Ton mot de passe');
      expect(input('auth-email')?.type).toBe('email');
      expect(input('auth-email')?.getAttribute('autocomplete')).toBe('username');
      expect(input('auth-password')?.type).toBe('password');
      expect(input('auth-password')?.getAttribute('autocomplete')).toBe('current-password');
      expect(input('auth-email')?.name).toBe('auth.email');
      expect(input('auth-password')?.name).toBe('auth.password');
    });

    it('porte un seul sceau, le bouton « Me connecter », et une bascule en bouton nu', () => {
      expect(host.querySelectorAll('.e-btn--sceau')).toHaveLength(1);
      expect(submitButton().classList).toContain('e-btn--sceau');
      expect(switchButton().classList).toContain('e-btn--nu');
    });

    it("n'affiche aucune note d'Akari tant que rien n'est arrivé", () => {
      expect(host.querySelector('aside')).toBeNull();
      expect(host.querySelector('[role="status"]')?.textContent?.trim()).toBe('');
    });

    it('connecte avec l’adresse et le mot de passe saisis', async () => {
      write('auth-email', 'lea@exemple.com');
      write('auth-password', 'secret1');
      await submit();
      expect(session.login).toHaveBeenCalledWith({ email: 'lea@exemple.com', password: 'secret1' });
      expect(session.signup).not.toHaveBeenCalled();
    });

    it('dit ce qui manque sous chaque champ et met le focus sur le premier', async () => {
      await submit();
      expect(session.login).not.toHaveBeenCalled();
      expect(fieldMessage('auth-email')).toBe(AUTH_FORM_MESSAGES.emailRequired);
      expect(fieldMessage('auth-password')).toBe(AUTH_FORM_MESSAGES.passwordRequired);
      expect(input('auth-email')?.getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(input('auth-email'));
    });

    it('demande une adresse complète et un mot de passe de 6 caractères', async () => {
      write('auth-email', 'lea@');
      write('auth-password', 'abc');
      await submit();
      expect(session.login).not.toHaveBeenCalled();
      expect(fieldMessage('auth-email')).toBe(AUTH_FORM_MESSAGES.emailIncomplete);
      expect(fieldMessage('auth-password')).toBe(AUTH_FORM_MESSAGES.passwordTooShort);
    });

    it('rattache un mot de passe refusé au champ, puis l’efface dès qu’il change', async () => {
      session.login.mockImplementation(async () => {
        session.error.set('INVALID_CREDENTIALS');
      });
      write('auth-email', 'lea@exemple.com');
      write('auth-password', 'secret1');
      await submit();

      expect(fieldMessage('auth-password')).toBe(AUTH_SERVER_MESSAGES.wrongCredentials);
      expect(input('auth-password')?.getAttribute('aria-invalid')).toBe('true');
      expect(text()).not.toMatch(/invalid login credentials/i);
      expect(host.querySelector('aside')).toBeNull();
      // Le focus va au champ concerné, qui décrit le message (aria-describedby) au lecteur d'écran.
      expect(document.activeElement).toBe(input('auth-password'));
      const describedBy = present(input('auth-password'), 'le champ du mot de passe').getAttribute('aria-describedby') ?? '';
      expect(describedBy.split(' ').map((id) => host.querySelector(`[id="${id}"]`)?.textContent?.trim())).toContain(
        AUTH_SERVER_MESSAGES.wrongCredentials,
      );

      write('auth-password', 'secret2');
      expect(fieldMessage('auth-password')).toBe('');
    });

    it('efface le mot de passe refusé dès que l’adresse change', async () => {
      session.login.mockImplementation(async () => {
        session.error.set('INVALID_CREDENTIALS');
      });
      write('auth-email', 'lea@exemple.com');
      write('auth-password', 'secret1');
      await submit();
      expect(fieldMessage('auth-password')).toBe(AUTH_SERVER_MESSAGES.wrongCredentials);

      write('auth-email', 'lea.martin@exemple.com');
      expect(fieldMessage('auth-password')).toBe('');
    });

    it('fait dire à Akari, au-dessus du bouton, ce qui ne concerne aucun champ', async () => {
      session.login.mockImplementation(async () => {
        session.error.set('NETWORK_ERROR');
      });
      write('auth-email', 'lea@exemple.com');
      write('auth-password', 'secret1');
      await submit();

      const note = host.querySelector('aside');
      expect(note?.classList).toContain('e-note');
      expect(note?.textContent).toContain('Akari');
      expect(note?.querySelector('[role="alert"]')?.textContent?.trim()).toBe(AUTH_SERVER_MESSAGES.unreachable);
      // La note précède le bouton sceau.
      expect(present(note, 'la note').compareDocumentPosition(submitButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // Aucun champ n'est en cause : le focus ne bouge pas vers un champ.
      expect(document.activeElement).not.toBe(input('auth-email'));
      expect(document.activeElement).not.toBe(input('auth-password'));
    });

    it('dit l’attente et ne renvoie rien tant que le serveur répond', async () => {
      session.login.mockImplementation(() => {
        session.isPending.set(true);
        return new Promise<void>(() => undefined);
      });
      write('auth-email', 'lea@exemple.com');
      write('auth-password', 'secret1');
      await submit();

      expect(submitButton().getAttribute('aria-disabled')).toBe('true');
      expect(host.querySelector('[role="status"]')?.textContent?.trim()).toBe('Je te connecte…');

      await submit();
      expect(session.login).toHaveBeenCalledTimes(1);

      await switchMode();
      expect(host.querySelector('h1')?.textContent?.trim()).toBe('Te revoilà.');
      expect(annonces.annoncer).not.toHaveBeenCalled();
    });
  });

  describe('en création de compte', () => {
    beforeEach(async () => {
      await switchMode();
    });

    it('annonce le nouveau titre aux lecteurs d’écran à chaque bascule', async () => {
      expect(annonces.annoncer).toHaveBeenLastCalledWith('Crée ton compte');
      await switchMode();
      expect(annonces.annoncer).toHaveBeenLastCalledWith('Te revoilà.');
    });

    it('montre « Crée ton compte », la confirmation et la bascule vers la connexion', () => {
      expect(host.querySelector('h1')?.textContent?.trim()).toBe('Crée ton compte');
      expect(input('auth-confirm-password')).not.toBeNull();
      expect(text()).toContain('Confirme ton mot de passe');
      expect(text()).toContain('Au moins 6 caractères.');
      expect(submitButton().textContent?.trim()).toBe('Créer mon compte');
      expect(switchButton().textContent?.trim()).toBe('Me connecter');
      expect(host.querySelector('#auth-question')?.textContent?.trim()).toBe('Déjà un compte ?');
      expect(host.querySelectorAll('.e-btn--sceau')).toHaveLength(1);
    });

    it('demande un nouveau mot de passe au gestionnaire de mots de passe', () => {
      expect(input('auth-password')?.getAttribute('autocomplete')).toBe('new-password');
      expect(input('auth-confirm-password')?.getAttribute('autocomplete')).toBe('new-password');
    });

    it('refuse deux mots de passe différents, sous la confirmation', async () => {
      write('auth-email', 'lea@exemple.com');
      write('auth-password', 'secret1');
      write('auth-confirm-password', 'secret2');
      await submit();
      expect(session.signup).not.toHaveBeenCalled();
      expect(fieldMessage('auth-confirm-password')).toBe(AUTH_FORM_MESSAGES.passwordMismatch);
      expect(document.activeElement).toBe(input('auth-confirm-password'));
    });

    it('crée le compte quand les deux mots de passe sont les mêmes', async () => {
      write('auth-email', 'lea@exemple.com');
      write('auth-password', 'secret1');
      write('auth-confirm-password', 'secret1');
      await submit();
      expect(session.signup).toHaveBeenCalledWith({
        email: 'lea@exemple.com',
        password: 'secret1',
        confirmPassword: 'secret1',
      });
      expect(session.login).not.toHaveBeenCalled();
    });

    it('rattache une adresse déjà prise au champ de l’adresse', async () => {
      session.signup.mockImplementation(async () => {
        session.error.set('USER_ALREADY_EXIST');
      });
      write('auth-email', 'lea@exemple.com');
      write('auth-password', 'secret1');
      write('auth-confirm-password', 'secret1');
      await submit();
      expect(fieldMessage('auth-email')).toBe(AUTH_SERVER_MESSAGES.accountExists);
      expect(document.activeElement).toBe(input('auth-email'));

      // L'adresse est toujours la même : changer le mot de passe ne change rien à la réponse.
      write('auth-password', 'secret2');
      expect(fieldMessage('auth-email')).toBe(AUTH_SERVER_MESSAGES.accountExists);

      write('auth-email', 'lea.martin@exemple.com');
      expect(fieldMessage('auth-email')).toBe('');
    });

    it('revient à la connexion en gardant l’adresse, sans la réponse précédente', async () => {
      session.signup.mockImplementation(async () => {
        session.error.set('NETWORK_ERROR');
      });
      write('auth-email', 'lea@exemple.com');
      write('auth-password', 'secret1');
      write('auth-confirm-password', 'secret1');
      await submit();
      expect(host.querySelector('aside')).not.toBeNull();

      await switchMode();
      expect(host.querySelector('h1')?.textContent?.trim()).toBe('Te revoilà.');
      expect(host.querySelector('aside')).toBeNull();
      expect(input('auth-confirm-password')).toBeNull();
      expect(input('auth-email')?.value).toBe('lea@exemple.com');
      expect(fieldMessage('auth-email')).toBe('');
    });
  });

  it('mène à l’accueil dès que la session est ouverte', () => {
    session.isAuthenticated.set(true);
    fixture.detectChanges();
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  describe('la voix', () => {
    const serverSamples: [string, AuthMode][] = [
      ['INVALID_CREDENTIALS', AuthMode.SignIn],
      ['USER_ALREADY_EXIST', AuthMode.CreateUser],
      ['EMAIL_NOT_CONFIRMED', AuthMode.SignIn],
      [EMAIL_CONFIRMATION_REQUIRED, AuthMode.CreateUser],
      ['NETWORK_ERROR', AuthMode.SignIn],
      ['TOO_MANY_REQUESTS', AuthMode.SignIn],
      ['WEAK_PASSWORD', AuthMode.CreateUser],
      ['INVALID_EMAIL', AuthMode.CreateUser],
      ['VALIDATION_ERROR', AuthMode.CreateUser],
      ['UNKNOWN_ERROR', AuthMode.SignIn],
      ['UNKNOWN_ERROR', AuthMode.CreateUser],
    ];

    const screenTexts = [
      AUTH_TEXTS.tagline,
      AUTH_TEXTS.passwordHelp,
      ...Object.values(AUTH_TEXTS[AuthMode.SignIn]),
      ...Object.values(AUTH_TEXTS[AuthMode.CreateUser]),
      ...Object.values(AUTH_FORM_MESSAGES),
      ...Object.values(AUTH_SERVER_MESSAGES),
      ...serverSamples.map(([message, mode]) => translateAuthError(message, mode).text),
    ];

    it.each(screenTexts)('« %s » parle comme Empreinte', (phrase) => {
      expect(motsAEviter(phrase)).toEqual([]);
      expect(voiceIssues(phrase)).toEqual([]);
      expect(phrase).not.toMatch(/erreur|échec|échou|invalide|vous|votre/i);
    });

    it('chaque bouton garde moins de 4 mots (brand book, Bouton)', () => {
      for (const mode of [AuthMode.SignIn, AuthMode.CreateUser]) {
        for (const label of [AUTH_TEXTS[mode].submit, AUTH_TEXTS[mode].switch]) {
          expect(label.trim().split(/\s+/).length, label).toBeLessThan(4);
        }
      }
    });

    it('l’écran rendu, dans les deux modes, parle comme Empreinte', async () => {
      const rendered = [text()];
      await switchMode();
      rendered.push(text());
      for (const phrase of rendered) {
        expect(motsAEviter(phrase)).toEqual([]);
        expect(voiceIssues(phrase)).toEqual([]);
      }
    });
  });
});

describe('translateAuthError', () => {
  it.each<[string, AuthMode, AuthErrorReport]>([
    ['INVALID_CREDENTIALS', AuthMode.SignIn, { field: 'password', text: AUTH_SERVER_MESSAGES.wrongCredentials }],
    ['USER_ALREADY_EXIST', AuthMode.CreateUser, { field: 'email', text: AUTH_SERVER_MESSAGES.accountExists }],
    ['EMAIL_NOT_CONFIRMED', AuthMode.SignIn, { field: null, text: AUTH_SERVER_MESSAGES.emailNotConfirmed }],
    [EMAIL_CONFIRMATION_REQUIRED, AuthMode.CreateUser, { field: null, text: AUTH_SERVER_MESSAGES.confirmEmail }],
    ['NETWORK_ERROR', AuthMode.SignIn, { field: null, text: AUTH_SERVER_MESSAGES.unreachable }],
    ['TOO_MANY_REQUESTS', AuthMode.CreateUser, { field: null, text: AUTH_SERVER_MESSAGES.tooManyAttempts }],
    ['WEAK_PASSWORD', AuthMode.CreateUser, { field: 'password', text: AUTH_SERVER_MESSAGES.passwordTooWeak }],
    ['INVALID_EMAIL', AuthMode.CreateUser, { field: 'email', text: AUTH_SERVER_MESSAGES.emailRejected }],
    ['VALIDATION_ERROR', AuthMode.SignIn, { field: 'email', text: AUTH_SERVER_MESSAGES.emailRejected }],
  ])('« %s » (%s)', (code, mode, expected) => {
    expect(translateAuthError(code, mode)).toEqual(expected);
  });

  it('ne montre jamais le message technique : un code inconnu donne la phrase de repli du mode', () => {
    expect(translateAuthError('UNKNOWN_ERROR', AuthMode.SignIn)).toEqual({
      field: null,
      text: AUTH_SERVER_MESSAGES.signInFallback,
    });
    expect(translateAuthError('AUTH_PROVIDER_CONFIGURATION_FAILED_ERROR_CODE', AuthMode.CreateUser)).toEqual({
      field: null,
      text: AUTH_SERVER_MESSAGES.createUserFallback,
    });
  });
});
