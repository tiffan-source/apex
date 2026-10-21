import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { EBouton, EChamp, EMarque, ENote, ESaisie, ESurface } from '@empreinte-studio/angular';
import { AnnoncesStore } from '../../chore/stores/annonces.store';
import { SessionStore } from '../../chore/stores/session.store';
import {
  AuthMode,
  EMPTY_CREDENTIALS,
  PASSWORD_MIN_LENGTH,
  authSchema,
  translateAuthError,
  type AuthCredentials,
  type AuthErrorField,
} from './auth.form';

/** Les textes de l'écran qui changent avec le mode (les libellés fixes sont dans le gabarit). */
export const AUTH_TEXTS = {
  tagline: 'Chaque pas laisse une empreinte.',
  passwordHelp: `Au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  [AuthMode.SignIn]: {
    title: 'Te revoilà.',
    submit: 'Me connecter',
    pending: 'Je te connecte…',
    switch: 'Pas encore de compte ? Crée-le',
  },
  [AuthMode.CreateUser]: {
    title: 'Crée ton compte',
    submit: 'Créer mon compte',
    pending: 'Je crée ton compte…',
    switch: 'Déjà un compte ? Connecte-toi',
  },
} as const;

/** Ce qui a été envoyé au serveur : sa réponse ne vaut que pour ces valeurs et ce mode. */
type AuthAttempt = { mode: AuthMode; email: string; password: string };

/**
 * La connexion (/auth), hors de la coque : un panneau étroit au centre de la page, la marque, puis
 * « Te revoilà. » ou « Crée ton compte ». Le bouton sceau (le seul de l'écran) connecte ou crée le
 * compte par SessionStore ; une fois la session ouverte, l'écran mène à l'accueil.
 *
 * Ce qui manque s'écrit sous le champ concerné, en encre, avec la solution (e-champ). Une réponse du
 * serveur est traduite (translateAuthError) : sous le champ qu'elle concerne, qui reçoit le focus, ou
 * dans une note d'Akari au-dessus du bouton. Elle s'efface dès que la personne change ce qu'elle avait
 * envoyé. La bascule entre les deux modes annonce le nouveau titre aux lecteurs d'écran.
 */
@Component({
  selector: 'app-auuthentication-page',
  imports: [FormField, FormRoot, EBouton, EChamp, EMarque, ENote, ESaisie, ESurface],
  templateUrl: './auuthentication-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuuthenticationPage {
  private readonly session = inject(SessionStore);
  private readonly annonces = inject(AnnoncesStore);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  /** Connexion, ou création de compte. */
  protected readonly mode = signal<AuthMode>(AuthMode.SignIn);
  protected readonly creatingAccount = computed(() => this.mode() === AuthMode.CreateUser);
  protected readonly texts = computed(() => AUTH_TEXTS[this.mode()]);
  protected readonly tagline = AUTH_TEXTS.tagline;
  protected readonly passwordHelp = AUTH_TEXTS.passwordHelp;

  /** Ce que la personne écrit ; l'adresse et le mot de passe restent d'un mode à l'autre. */
  protected readonly model = signal<AuthCredentials>({ ...EMPTY_CREDENTIALS });

  /**
   * Le formulaire (Signal Forms) : le bouton sceau le soumet. Valide, il part au serveur ; sinon,
   * chaque champ dit ce qui manque et le focus va au premier concerné. Le nom donne aux champs des
   * attributs name stables (auth.email, auth.password), que les gestionnaires de mots de passe retiennent.
   */
  protected readonly credentials = form(this.model, authSchema(this.mode), {
    name: 'auth',
    submission: {
      action: async () => {
        await this.send();
        return undefined;
      },
      onInvalid: () => this.focusFirstInvalidField(),
    },
  });

  /** Vrai pendant l'appel au serveur : le sceau est inactif, le statut le dit. */
  protected readonly pending = computed(() => this.session.isPending());
  protected readonly status = computed(() => (this.pending() ? this.texts().pending : ''));

  /** Le dernier envoi, ou null (aucun envoi, ou le mode a changé depuis). */
  private readonly attempt = signal<AuthAttempt | null>(null);

  /** La réponse du serveur au dernier envoi, dans la voix ; null tant qu'il n'y a rien à dire. */
  private readonly serverReport = computed(() => {
    const attempt = this.attempt();
    const message = this.session.error();
    if (!attempt || !message || attempt.mode !== this.mode()) return null;
    return translateAuthError(message, attempt.mode);
  });

  /** L'adresse, puis le mot de passe envoyés sont toujours dans leur champ : la réponse les concerne encore. */
  private readonly sentEmailKept = computed(() => this.attempt()?.email === this.model().email.trim());
  private readonly sentPasswordKept = computed(() => this.attempt()?.password === this.model().password);

  protected readonly emailServerError = computed(() => this.fieldReport('email'));
  protected readonly passwordServerError = computed(() => this.fieldReport('password'));

  /** Une réponse qui ne concerne aucun champ : Akari la dit au-dessus du bouton. */
  protected readonly note = computed(() => {
    const report = this.serverReport();
    return report && report.field === null ? report.text : null;
  });

  constructor() {
    // Une session ouverte (connexion, création de compte, ou déjà là) mène à l'accueil.
    effect(() => {
      if (this.session.isAuthenticated()) void this.router.navigate(['/']);
    });
  }

  /** Passe de la connexion à la création de compte, et inversement. */
  protected switchMode(): void {
    if (this.pending()) return;
    this.mode.update((mode) => (mode === AuthMode.SignIn ? AuthMode.CreateUser : AuthMode.SignIn));
    this.attempt.set(null);
    this.model.update((credentials) => ({ ...credentials, confirmPassword: '' }));
    // Les messages du mode précédent s'effacent : ils reviendront à la prochaine soumission.
    this.credentials().reset();
    // Le focus reste sur la bascule : le nouveau titre est dit aux lecteurs d'écran.
    this.annonces.annoncer(this.texts().title);
  }

  /** Envoie l'adresse et le mot de passe à SessionStore, selon le mode. */
  private async send(): Promise<void> {
    if (this.pending()) return;
    const mode = this.mode();
    const { email, password, confirmPassword } = this.model();
    const sent = { email: email.trim(), password };
    this.attempt.set({ mode, ...sent });
    if (mode === AuthMode.SignIn) {
      await this.session.login(sent);
    } else {
      await this.session.signup({ ...sent, confirmPassword });
    }
    this.focusReportedField();
  }

  /**
   * Une adresse refusée vaut tant que l'adresse reste ; un mot de passe refusé, tant que l'adresse et le
   * mot de passe restent (« Ce mot de passe ne correspond pas à cette adresse »).
   */
  private fieldReport(field: Exclude<AuthErrorField, null>): string | null {
    const report = this.serverReport();
    if (report?.field !== field) return null;
    const kept = field === 'email' ? this.sentEmailKept() : this.sentEmailKept() && this.sentPasswordKept();
    return kept ? report.text : null;
  }

  /**
   * La réponse du serveur concerne un champ : le focus y va, une fois le message écrit, pour que le
   * lecteur d'écran le lise avec le libellé (le message du champ est masqué tant qu'il est vide, sa
   * région aria-live ne suffit pas). Une réponse sans champ est dite par la note d'Akari (role="alert").
   */
  private focusReportedField(): void {
    const field = this.serverReport()?.field;
    if (!field || !this.fieldReport(field) || this.destroyRef.destroyed) return;
    afterNextRender(() => this.credentials[field]().focusBoundControl(), { injector: this.injector });
  }

  private focusFirstInvalidField(): void {
    const { email, password, confirmPassword } = this.credentials;
    const firstInvalid = [email, password, confirmPassword].find((field) => !field().hidden() && field().invalid());
    firstInvalid?.().focusBoundControl();
  }
}
