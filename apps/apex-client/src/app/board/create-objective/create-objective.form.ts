import { FormControl, FormGroup, Validators } from "@angular/forms";

export enum CreateObjectiveFormField {
  TITLE = 'title',
  DESCRIPTION = 'description',
  WHY = 'why',
  DUE_DATE = 'dueDate',
}

export type CreateObjectiveForm = {
  [CreateObjectiveFormField.TITLE]: FormControl<string>;
  [CreateObjectiveFormField.DESCRIPTION]: FormControl<string | null>;
  [CreateObjectiveFormField.WHY]: FormControl<string | null>;
  [CreateObjectiveFormField.DUE_DATE]: FormControl<Date | null>;
};

export class CreateObjectiveFormModel extends FormGroup<CreateObjectiveForm> {
  constructor() {
    super({
      [CreateObjectiveFormField.TITLE]: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      [CreateObjectiveFormField.DESCRIPTION]: new FormControl(''),
      [CreateObjectiveFormField.WHY]: new FormControl(''),
      [CreateObjectiveFormField.DUE_DATE]: new FormControl(null),
    });
  }
}
