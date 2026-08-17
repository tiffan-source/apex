import { Component, effect, inject, input } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ObjectiveOverviewViewModel } from 'apps/apex-client/src/chore/models/objective.viewmodel';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { DrawerStore } from 'apps/apex-client/src/chore/stores/drawer.store';
import { EditObjectiveFormField, EditObjectiveFormModel } from './edit-objective.form';
import { TextareaModule } from 'primeng/textarea';
import { ObjectiveStore } from 'apps/apex-client/src/chore/stores/objective.store';

@Component({
  selector: 'app-edit-objective',
  imports: [InputTextModule, ButtonModule, DrawerModule, CardModule, SkeletonModule, ReactiveFormsModule, TextareaModule],
  templateUrl: './edit-objective.html',
  styleUrl: './edit-objective.css',
})
export class EditObjective {
  objectiveOverview = input.required<ObjectiveOverviewViewModel>()
  drawerStore = inject(DrawerStore);
  objectiveStore = inject(ObjectiveStore)
  EditObjectiveFormField = EditObjectiveFormField

  form: EditObjectiveFormModel = new EditObjectiveFormModel();

  constructor() {
    effect(() => {
      if (this.objectiveStore.requestStatus() === 'fulfilled') {
        this.drawerStore.closeObjectiveEditionDrawer();
      }
    });
  }

  ngOnInit(): void {
    let data = this.objectiveOverview();

    if (!data) {
      throw new Error('ObjectiveOverviewViewModel is required');
    }

    this.form = new EditObjectiveFormModel({
      title: data.title,
      description: data.description,
      why: data.why,
      due_date: data.dueDate ? new Date(data.dueDate) : null,
    });
  }

  editObjective(){
    if (this.form.valid) {
      const { title, description, why, dueDate } = this.form.value;

      if (title){
        this.objectiveStore.editObjective({
          id: this.objectiveOverview().id,
          title,
          description: description || undefined,
          why: why || undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined
        });
      }
      // Here you would typically call a service to handle the creation of the objective
    } else {
      console.error('Form is invalid. Please fill out all required fields.');
    }
  }
}
