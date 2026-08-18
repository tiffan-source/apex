import { FormControl, FormGroup } from "@angular/forms";

export enum EditSubObjectiveFormField {
  TITLE = 'title',
  DESCRIPTION = 'description',
  DUE_DATE = 'dueDate',
}

export type EditSubObjectiveForm = {
  [EditSubObjectiveFormField.TITLE]: FormControl<string>;
  [EditSubObjectiveFormField.DESCRIPTION]: FormControl<string>;
  [EditSubObjectiveFormField.DUE_DATE]: FormControl<Date | null>;
};

export type EditSubObjectiveFormInput = {
  title: string;
  description?: string;
  dueDate?: Date;
}

export class EditSubObjectiveFormModel extends FormGroup<EditSubObjectiveForm> {
  constructor(input: EditSubObjectiveFormInput) {
    super({
      [EditSubObjectiveFormField.TITLE]: new FormControl(input.title, { nonNullable: true }),
      [EditSubObjectiveFormField.DESCRIPTION]: new FormControl(input.description || '', { nonNullable: true }),
      [EditSubObjectiveFormField.DUE_DATE]: new FormControl(input.dueDate || null, { nonNullable: true }),
    });
  }
}
