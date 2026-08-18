import { Component, computed, effect, inject, input, OnInit, output } from '@angular/core';
import { TaskViewModel } from 'apps/apex-client/src/chore/models/objective.viewmodel';
import { EditTaskFormField, EditTaskFormModel } from './edit-task.form';
import { DialogModule } from 'primeng/dialog';
import { ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ImportanceValueOption, UrgencyValueOption } from 'apps/apex-client/src/chore/constants/task.constante';
import { InputTextModule } from 'primeng/inputtext';
import { ObjectiveStore } from 'apps/apex-client/src/chore/stores/objective.store';

@Component({
  selector: 'app-edit-task',
  imports: [DialogModule, ReactiveFormsModule, ButtonModule, SelectModule, InputTextModule],
  templateUrl: './edit-task.html',
  styleUrl: './edit-task.css',
})
export class EditTask {
  taskViewModel = input.required<TaskViewModel | null>()
  open = computed(() => this.taskViewModel() !== null);

  form: EditTaskFormModel | null = null;
  EditTaskFormField = EditTaskFormField;

  optionsImportance = ImportanceValueOption
  optionUrgerncy = UrgencyValueOption

  abort = output();

  optionsObjective = input.required<{ label: string, value: string }[]>();

  objectiveStore = inject(ObjectiveStore);

  constructor() {
    effect(() => {
      let { title, objectiveId, importance, urgency } = this.taskViewModel() || {};
      if(title && objectiveId && importance && urgency)
        this.form = new EditTaskFormModel({
          title: title,
          objective: objectiveId,
          important: importance,
          urgent: urgency,
        });
    })

    effect(() => {
      if (this.objectiveStore.requestStatus() === 'fulfilled') {
        this.abort.emit();
      }
    });
  }

  editTask() {
    let id = this.taskViewModel()?.id;
    if (this.form?.valid && id) {
      const { objective, title, important, urgent } = this.form.value;
      if( objective && title && important && urgent)
        this.objectiveStore.editTask({
          taskId: id,
          input: {
            title,
            importance: important,
            urgency: urgent,
            objectiveId: objective
          }
        });
      this.abort.emit();
    }
  }

}
