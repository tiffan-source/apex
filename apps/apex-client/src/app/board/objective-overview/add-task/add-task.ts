import { Component, inject, input, output} from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { AddTaskFormField, AddTaskFormModel} from './add-task.form';
import { ReactiveFormsModule } from '@angular/forms';
import { ObjectiveStore } from 'apps/apex-client/src/chore/stores/objective.store';
import { ImportanceValueOption, UrgencyValueOption } from 'apps/apex-client/src/chore/constants/task.constante';

@Component({
  selector: 'app-add-task',
  imports: [Card, InputTextModule, Button, SelectModule, ReactiveFormsModule],
  templateUrl: './add-task.html',
  styleUrl: './add-task.css',
})
export class AddTask {
  readonly objectiveStore = inject(ObjectiveStore);

  objectiveId = input.required<string>();
  abort = output();

  optionsImportance = ImportanceValueOption
  optionUrgerncy = UrgencyValueOption

  optionsObjective = input.required<{ label: string, value: string }[]>();

  form: AddTaskFormModel = new AddTaskFormModel();

  ngOnInit(): void {
    const defaultObjectiveId = this.optionsObjective().length > 0 ? this.optionsObjective()[0].value : null;
    this.form = new AddTaskFormModel(defaultObjectiveId);
  }

  AddTaskFormField = AddTaskFormField

  addTask() {
    if (this.form.valid) {
      const { objective, title, important, urgent } = this.form.value;
      if( objective && title && important && urgent)
        this.objectiveStore.addTaskToObjective({
          objectiveId: objective,
          task: {
            title,
            importance: important,
            urgency: urgent
          }
        });
      this.form.reset({ objective: this.optionsObjective().length > 0 ? this.optionsObjective()[0].value : null });
      this.abort.emit();
    }

  }
}
