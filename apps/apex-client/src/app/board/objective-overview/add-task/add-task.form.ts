import { FormControl, FormGroup } from "@angular/forms";

export const ImportanceValueOption: { label: string, value: number }[] = [
  { label: "Important 1", value: 1 },
  { label: "Important 2", value: 2 },
  { label: "Important 3", value: 3 },
  { label: "Important 4", value: 4 },
  { label: "Important 5", value: 5 }
];

export const UrgencyValueOption: { label: string, value: number }[] = [
  { label: "Urgent 1", value: 1 },
  { label: "Urgent 2", value: 2 },
  { label: "Urgent 3", value: 3 },
  { label: "Urgent 4", value: 4 },
  { label: "Urgent 5", value: 5 }
];

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
