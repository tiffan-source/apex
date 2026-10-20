import { Component, computed, effect, inject, input, output, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ObjectiveViewModel } from '../../../../chore/models/objective.viewmodel';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { EditSubObjectiveFormField, EditSubObjectiveFormModel } from './edit-sub-objective.form';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { ObjectiveStore } from '../../../../chore/stores/objective.store';

@Component({
  selector: 'app-edit-sub-objective',
  imports: [DialogModule, ReactiveFormsModule, ButtonModule, SelectModule, InputTextModule, TextareaModule, DatePickerModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './edit-sub-objective.html',
})
export class EditSubObjective {
  objectiveViewModel = input.required<ObjectiveViewModel | null>()
  open = computed(() => this.objectiveViewModel() !== null);
  abort = output();
  objectiveStore = inject(ObjectiveStore);

  form: EditSubObjectiveFormModel | null = null;

  EditSubObjectiveFormField = EditSubObjectiveFormField;

  constructor() {
    effect(() => {
      const subObjective = this.objectiveViewModel();
      // On crée aussi le formulaire quand le titre est vide, pour pouvoir le corriger
      if (subObjective) {
        const { title, description, dueDate } = subObjective;
        this.form = new EditSubObjectiveFormModel({
          title: title ?? '',
          description: description || '',
          dueDate: dueDate ? new Date(dueDate) : undefined,
        });
      }
    })

    effect(() => {
      if (this.objectiveStore.requestStatus() === 'fulfilled') {
        this.abort.emit();
      }
    });
  }

  editObjective(){
    let id = this.objectiveViewModel()?.id;
    if (this.form?.valid && id) {
      const { title, description, dueDate } = this.form.value;
      if (title)
      this.objectiveStore.editObjective({
        id,
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      })
    }
  }
}
