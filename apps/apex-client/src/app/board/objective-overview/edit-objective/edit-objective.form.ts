import { FormControl, FormGroup, Validators } from "@angular/forms";

export enum EditObjectiveFormField {
  TITLE = 'title',
  DESCRIPTION = 'description',
  WHY = 'why',
  DUE_DATE = 'dueDate',
}

export type EditObjectiveForm = {
  [EditObjectiveFormField.TITLE]: FormControl<string>;
  [EditObjectiveFormField.DESCRIPTION]: FormControl<string | null>;
  [EditObjectiveFormField.WHY]: FormControl<string | null>;
  [EditObjectiveFormField.DUE_DATE]: FormControl<string | null>;
}

export type EditObjectiveFormModelInput = {
  title: string;
  description: string | null;
  why: string | null;
  due_date: Date | null;
}

const defaultValues: EditObjectiveFormModelInput = {
  title: '',
  description: null,
  why: null,
  due_date: null,
}

export class EditObjectiveFormModel extends FormGroup<EditObjectiveForm> {
  constructor(input: EditObjectiveFormModelInput = defaultValues) {
    super({
      [EditObjectiveFormField.TITLE]: new FormControl(input.title, { nonNullable: true, validators: [Validators.required] }),
      [EditObjectiveFormField.DESCRIPTION]: new FormControl(input.description),
      [EditObjectiveFormField.WHY]: new FormControl(input.why),
      [EditObjectiveFormField.DUE_DATE]: new FormControl(input.due_date ? input.due_date.toISOString().split('T')[0] : null),
    })
  }
}
