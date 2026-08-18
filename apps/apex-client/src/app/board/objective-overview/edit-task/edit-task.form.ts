import { FormControl, FormGroup } from "@angular/forms";

export enum EditTaskFormField {
  TITLE = 'title',
  OBJECTIVE = 'objective',
  IMPORTANT = 'important',
  URGENT = 'urgent',
}

export type EditTaskForm = {
  [EditTaskFormField.TITLE]: FormControl<string>;
  [EditTaskFormField.OBJECTIVE]: FormControl<string | null>;
  [EditTaskFormField.IMPORTANT]: FormControl<number>;
  [EditTaskFormField.URGENT]: FormControl<number>;
};

export type EditTaskFormInput = {
  title: string;
  objective: string;
  important: number;
  urgent: number;
}

export class EditTaskFormModel extends FormGroup<EditTaskForm> {
  constructor(input: EditTaskFormInput) {
    super({
      [EditTaskFormField.TITLE]: new FormControl(input.title, { nonNullable: true }),
      [EditTaskFormField.OBJECTIVE]: new FormControl(input.objective, { nonNullable: true }),
      [EditTaskFormField.IMPORTANT]: new FormControl(input.important, { nonNullable: true }),
      [EditTaskFormField.URGENT]: new FormControl(input.urgent, { nonNullable: true }),
    });
  }
}
