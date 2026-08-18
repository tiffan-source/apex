import { FormControl, FormGroup } from "@angular/forms";


export enum AddTaskFormField {
  TITLE = 'title',
  OBJECTIVE = 'objective',
  IMPORTANT = 'important',
  URGENT = 'urgent',
}

export type AddTaskForm = {
  [AddTaskFormField.TITLE]: FormControl<string>;
  [AddTaskFormField.OBJECTIVE]: FormControl<string | null>;
  [AddTaskFormField.IMPORTANT]: FormControl<number>;
  [AddTaskFormField.URGENT]: FormControl<number>;
};

export class AddTaskFormModel extends FormGroup<AddTaskForm> {
  constructor(defaultObjectiveId: string | null = null) {
    super({
      [AddTaskFormField.TITLE]: new FormControl('', { nonNullable: true }),
      [AddTaskFormField.OBJECTIVE]: new FormControl(defaultObjectiveId, { nonNullable: true }),
      [AddTaskFormField.IMPORTANT]: new FormControl(1, { nonNullable: true }),
      [AddTaskFormField.URGENT]: new FormControl(1, { nonNullable: true }),
    });
  }
}
