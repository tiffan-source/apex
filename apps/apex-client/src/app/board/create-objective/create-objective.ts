import { Component, computed, effect, inject, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { CreateObjectiveFormField, CreateObjectiveFormModel } from './create-objective.form';
import { TextareaModule } from 'primeng/textarea';
import { ReactiveFormsModule } from '@angular/forms';
import { ObjectiveStore } from 'apps/apex-client/src/chore/stores/objective.store';

@Component({
  selector: 'app-create-objective',
  imports: [DialogModule, Button, InputTextModule, TextareaModule, ReactiveFormsModule],
  templateUrl: './create-objective.html',
  styleUrl: './create-objective.css',
})
export class CreateObjective {
  open = input.required<boolean>();
  setOpen = output<boolean>();

  protected CreateObjectiveFormField = CreateObjectiveFormField
  createObjectiveForm = new CreateObjectiveFormModel();

  objectiveStore = inject(ObjectiveStore);

  isLoading = computed(()=>this.objectiveStore.isPending())

  constructor() {
    effect(() => {
      if (this.objectiveStore.requestStatus() === 'fulfilled') {
        this.setOpen.emit(false);
      }
    });
  }

  createObjective() {
    if (this.createObjectiveForm.valid) {
      const { title, description, why, dueDate } = this.createObjectiveForm.value;

      if (title && description && why && dueDate){
        let date = new Date(dueDate);
        this.objectiveStore.createObjective({ title, description, why, dueDate: date });
      }
      // Here you would typically call a service to handle the creation of the objective
    } else {
      console.error('Form is invalid. Please fill out all required fields.');
    }
  }

}
