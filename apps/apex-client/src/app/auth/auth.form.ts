import { FormControl, FormGroup, Validators } from "@angular/forms";

export enum AuthFormField {
  EMAIL = 'email',
  PASSWORD = 'password',
  CONFIRM_PASSWORD = 'confirmPassword',
}

export type CreateUserForm = {
  [AuthFormField.EMAIL]: FormControl<string>;
  [AuthFormField.PASSWORD]: FormControl<string>;
  [AuthFormField.CONFIRM_PASSWORD]: FormControl<string>;
};

export type SignInForm = {
  [AuthFormField.EMAIL]: FormControl<string>;
  [AuthFormField.PASSWORD]: FormControl<string>;
};

export class CreateUserFormModel extends FormGroup<CreateUserForm> {
  constructor() {
    super({
      [AuthFormField.EMAIL]: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
      [AuthFormField.PASSWORD]: new FormControl('', { nonNullable: true, validators: [Validators.minLength(6)] }),
      [AuthFormField.CONFIRM_PASSWORD]: new FormControl('', { nonNullable: true, validators: [Validators.minLength(6)] }),
    });
  }
}

export class SignInFormModel extends FormGroup<SignInForm> {
  constructor() {
    super({
      [AuthFormField.EMAIL]: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
      [AuthFormField.PASSWORD]: new FormControl('', { nonNullable: true, validators: [Validators.minLength(6)] }),
    });
  }
}

