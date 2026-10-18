import { Component, computed, effect, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { AuthFormField, CreateUserFormModel, SignInFormModel } from './auth.form';
import { ReactiveFormsModule } from '@angular/forms';
import { SessionStore } from '../../chore/stores/session.store';
import { Router } from '@angular/router';

export enum AuthMode {
  SignIn = 'sign-in',
  CreateUser = 'create-user'
}

@Component({
  selector: 'app-auuthentication-page',
  imports: [ButtonModule, CheckboxModule, InputTextModule, CardModule, ReactiveFormsModule, MessageModule],
  templateUrl: './auuthentication-page.html',
  styleUrl: './auuthentication-page.css',
})
export class AuuthenticationPage {
  mode = signal<AuthMode>(AuthMode.SignIn);
  AuthMode = AuthMode;
  AuthFormField = AuthFormField;

  loginForm = new SignInFormModel();
  createUserForm = new CreateUserFormModel();

  sessionStore = inject(SessionStore);

  router = inject(Router);

  // Erreur détectée côté formulaire (champ manquant, mots de passe différents…)
  formError = signal<string | null>(null);

  // Le formulaire a priorité, sinon on traduit l'erreur renvoyée par le serveur
  errorMessage = computed(() => {
    const formError = this.formError();
    if (formError) return formError;
    return this.sessionStore.error() ? this.translateAuthError(this.sessionStore.error() as string) : null;
  });

  constructor() {
    effect(() => {
      if (this.sessionStore.isAuthenticated()) {
        this.router.navigate(['/']);
      }
    });
  }

  changeMode() {
    this.mode.set(this.mode() === AuthMode.SignIn ? AuthMode.CreateUser : AuthMode.SignIn);
    this.formError.set(null);
  }

  submitAuthForm() {
    if (this.sessionStore.isPending()) return;

    const form = this.mode() === AuthMode.SignIn ? this.loginForm : this.createUserForm;
    if (form.invalid) {
      form.markAllAsTouched();
      this.formError.set(this.describeFormError());
      return;
    }

    this.formError.set(null);

    if (this.mode() === AuthMode.SignIn) {
      const { email, password } = this.loginForm.getRawValue();
      this.sessionStore.login({ email, password });
    } else {
      const { email, password, confirmPassword } = this.createUserForm.getRawValue();

      if (password !== confirmPassword) {
        this.formError.set('Les deux mots de passe ne correspondent pas.');
        return;
      }

      this.sessionStore.signup({ email, password, confirmPassword });
    }
  }

  private describeFormError(): string {
    const form = this.mode() === AuthMode.SignIn ? this.loginForm : this.createUserForm;
    const emailControl = form.controls[AuthFormField.EMAIL];
    const passwordControl = form.controls[AuthFormField.PASSWORD];

    if (emailControl?.hasError('required') || passwordControl?.hasError('required')) {
      return 'Renseignez votre e-mail et votre mot de passe.';
    }
    if (emailControl?.hasError('email')) {
      return "L'adresse e-mail n'est pas valide.";
    }
    if (passwordControl?.hasError('minlength')) {
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    }
    return 'Vérifiez les champs du formulaire.';
  }

  private translateAuthError(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('invalid login credentials')) return 'E-mail ou mot de passe incorrect.';
    if (lower.includes('already registered')) return 'Un compte existe déjà avec cet e-mail.';
    if (lower.includes('email not confirmed')) return 'Confirmez votre adresse e-mail avant de vous connecter.';
    if (lower.includes('fetch') || lower.includes('network')) return 'Impossible de joindre le serveur. Vérifiez votre connexion.';
    return 'La connexion a échoué. Réessayez dans un instant.';
  }
}
