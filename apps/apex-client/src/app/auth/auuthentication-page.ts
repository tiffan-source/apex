import { Component, effect, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
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
  imports: [ButtonModule, CheckboxModule, InputTextModule, CardModule, ReactiveFormsModule],
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

  constructor() {
    effect(() => {
      if (this.sessionStore.isAuthenticated()) {
        this.router.navigate(['/']);
      }
    });
  }

  changeMode() {
    this.mode.set(this.mode() === AuthMode.SignIn ? AuthMode.CreateUser : AuthMode.SignIn);
  }

  submitAuthForm() {
    if (this.mode() === AuthMode.SignIn) {
      if (this.loginForm.valid) {
        const { email, password } = this.loginForm.value;

        if (!email || !password) {
          console.error('Email and password are required.');
          return;
        }
        this.sessionStore.login({ email, password });
      }
    } else {
      if (this.createUserForm.valid) {
        const { email, password, confirmPassword } = this.createUserForm.value;

        if (!email || !password || !confirmPassword) {
          console.error('All fields are required.');
          return;
        }

        if (password !== confirmPassword) {
          console.error('Passwords do not match.');
          return;
        }

        this.sessionStore.signup({ email, password, confirmPassword });
      }
    }
  }
}
