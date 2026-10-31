import type { Signal } from '@angular/core';
import { email, hidden, minLength, required, validate, type SchemaFn } from '@angular/forms/signals';

/*
 * Le formulaire de connexion et de création de compte (Signal Forms), et les phrases qu'il dit à la
 * personne, dans la voix d'Apex : tutoiement, phrases courtes, en encre, avec la solution.
 * Jamais « erreur », « échec » ni « invalide » ; jamais le message technique du serveur.
 */

/** Se connecter, ou créer son compte. */
export enum AuthMode {
  SignIn = 'sign-in',
  CreateUser = 'create-user',
}

/** Ce que la personne écrit. La confirmation ne compte qu'à la création d'un compte. */
export type AuthCredentials = {
  email: string;
  password: string;
  confirmPassword: string;
};

export const EMPTY_CREDENTIALS: AuthCredentials = { email: '', password: '', confirmPassword: '' };

/** La longueur minimale d'un mot de passe (celle de Supabase). */
export const PASSWORD_MIN_LENGTH = 6;

/** Ce que disent les champs quand il manque quelque chose (anciennement describeFormError). */
export const AUTH_FORM_MESSAGES = {
  emailRequired: 'Écris ton adresse e-mail pour continuer.',
  emailIncomplete: 'Cette adresse semble incomplète. Ajoute la fin, par exemple @gmail.com.',
  passwordRequired: 'Écris ton mot de passe pour continuer.',
  passwordTooShort: `Encore un peu : au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  confirmRequired: 'Recopie ton mot de passe pour le confirmer.',
  passwordMismatch: "Ce n'est pas le même mot de passe. Recopie celui du dessus.",
} as const;

/**
 * La validation : une adresse complète, un mot de passe d'au moins 6 caractères et, à la création
 * d'un compte seulement, la même confirmation. En connexion, la confirmation est masquée : elle ne
 * compte ni dans la validité ni dans l'état « touché » du formulaire.
 */
export function authSchema(mode: Signal<AuthMode>): SchemaFn<AuthCredentials> {
  const creatingAccount = () => mode() === AuthMode.CreateUser;
  return (path) => {
    required(path.email, { message: AUTH_FORM_MESSAGES.emailRequired });
    email(path.email, { message: AUTH_FORM_MESSAGES.emailIncomplete });
    required(path.password, { message: AUTH_FORM_MESSAGES.passwordRequired });
    minLength(path.password, PASSWORD_MIN_LENGTH, { message: AUTH_FORM_MESSAGES.passwordTooShort });
    hidden(path.confirmPassword, () => !creatingAccount());
    required(path.confirmPassword, { message: AUTH_FORM_MESSAGES.confirmRequired, when: creatingAccount });
    validate(path.confirmPassword, ({ value, valueOf }) =>
      creatingAccount() && value() !== '' && value() !== valueOf(path.password)
        ? { kind: 'passwordMismatch', message: AUTH_FORM_MESSAGES.passwordMismatch }
        : undefined,
    );
  };
}

/** Le champ auquel une réponse du serveur se rattache ; null : la note d'Akari, au-dessus du bouton. */
export type AuthErrorField = 'email' | 'password' | null;

/** Une réponse du serveur, dite dans la voix, avec l'endroit où l'afficher. */
export type AuthErrorReport = {
  field: AuthErrorField;
  text: string;
};

/** Les phrases qui répondent au serveur (anciennement translateAuthError). */
export const AUTH_SERVER_MESSAGES = {
  wrongCredentials: 'Ce mot de passe ne correspond pas à cette adresse. Vérifie-le, ou crée un compte.',
  accountExists: 'Un compte existe déjà avec cette adresse. Connecte-toi plutôt.',
  emailRejected: "Cette adresse n'est pas acceptée. Vérifie-la, puis réessaie.",
  passwordTooWeak: 'Ce mot de passe est trop simple. Allonge-le, puis réessaie.',
  emailNotConfirmed: "Ton adresse n'est pas encore confirmée. Ouvre le lien reçu par e-mail, puis connecte-toi.",
  confirmEmail: 'Confirme ton adresse : ouvre le lien reçu par e-mail, puis connecte-toi.',
  signupClosed: "La création de compte est fermée pour l'instant. Connecte-toi avec un compte existant.",
  tooManyAttempts: "Trop d'essais à la suite. Attends une minute, puis réessaie.",
  unreachable: "Je n'arrive pas à joindre Apex. Vérifie ta connexion, puis réessaie.",
  signInFallback: "Je n'ai pas pu te connecter. Vérifie ta connexion, puis réessaie.",
  createUserFallback: "Je n'ai pas pu créer ton compte. Vérifie ta connexion, puis réessaie.",
} as const;

/**
 * Traduit le message brut que SessionStore.error() garde (Supabase ou le domaine, en anglais) en une
 * phrase dans la voix, rattachée au champ concerné quand il y en a un. Le message brut n'est jamais
 * montré : un cas inconnu donne la phrase de repli de l'action.
 */
export function translateAuthError(message: string, mode: AuthMode): AuthErrorReport {
  const raw = message.toLowerCase();
  const has = (...parts: string[]) => parts.some((part) => raw.includes(part));

  if (has('invalid login credentials', 'invalid credentials')) {
    return { field: 'password', text: AUTH_SERVER_MESSAGES.wrongCredentials };
  }
  if (has('already registered', 'already exists', 'already been registered')) {
    return { field: 'email', text: AUTH_SERVER_MESSAGES.accountExists };
  }
  if (has('email not confirmed')) {
    return { field: null, text: AUTH_SERVER_MESSAGES.emailNotConfirmed };
  }
  // Compte créé, mais sans session : l'adresse attend sa confirmation.
  if (mode === AuthMode.CreateUser && has('session missing', 'no user found')) {
    return { field: null, text: AUTH_SERVER_MESSAGES.confirmEmail };
  }
  if (has('rate limit', 'too many', 'security purposes')) {
    return { field: null, text: AUTH_SERVER_MESSAGES.tooManyAttempts };
  }
  if (has('signups not allowed', 'signup is disabled', 'signups are disabled')) {
    return { field: null, text: AUTH_SERVER_MESSAGES.signupClosed };
  }
  if (has('password should', 'weak password', 'password is known', 'weak_password')) {
    return { field: 'password', text: AUTH_SERVER_MESSAGES.passwordTooWeak };
  }
  if (has('unable to validate email', 'invalid format') || (raw.includes('email') && raw.includes('invalid'))) {
    return { field: 'email', text: AUTH_SERVER_MESSAGES.emailRejected };
  }
  if (has('fetch', 'network', 'load failed', 'timeout', 'timed out')) {
    return { field: null, text: AUTH_SERVER_MESSAGES.unreachable };
  }
  return {
    field: null,
    text: mode === AuthMode.SignIn ? AUTH_SERVER_MESSAGES.signInFallback : AUTH_SERVER_MESSAGES.createUserFallback,
  };
}
