import { Component, inject, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { CreateObjectiveFormField, CreateObjectiveFormModel } from './create-objective.form';
import { TextareaModule } from 'primeng/textarea';
import { CreateObjectiveServices } from './create-objective.services';
import { ReactiveFormsModule } from '@angular/forms';

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

  protected readonly createObjectiveService = inject(CreateObjectiveServices);

  create = async () => {
    let {title, description, why, dueDate} = this.createObjectiveForm.value;
    let result
    if(title && description && why && dueDate)
      result = await this.createObjectiveService.createObjectiveService(title, description, why, dueDate);

    if(result)
      this.setOpen.emit(false);
  }
}
