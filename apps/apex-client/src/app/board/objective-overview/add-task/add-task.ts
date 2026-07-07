import { Component, inject, input, OnInit, output, signal, Signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { AddTaskFormField, AddTaskFormModel, ImportanceValueOption, UrgencyValueOption } from './add-task.form';
import { ReactiveFormsModule } from '@angular/forms';
import { AddTaskServices } from './add-task.services';

@Component({
  selector: 'app-add-task',
  imports: [Card, InputTextModule, Button, SelectModule, ReactiveFormsModule],
  templateUrl: './add-task.html',
  styleUrl: './add-task.css',
})
export class AddTask implements OnInit {
  objectiveId = input.required<string>();
  abort = output();

  private readonly addTaskServices = inject(AddTaskServices);

  optionsImportance = ImportanceValueOption
  optionUrgerncy = UrgencyValueOption

  optionsObjective: Signal<{ label: string, value: string }[]> = signal([]);
  form: AddTaskFormModel = new AddTaskFormModel(this.optionsObjective().length > 0 ? this.optionsObjective()[0].value : null);

  ngOnInit() {
    this.optionsObjective = this.addTaskServices.subObjective(this.objectiveId);
    this.form = new AddTaskFormModel(this.optionsObjective().length > 0 ? this.optionsObjective()[0].value : null);
  }

  AddTaskFormField = AddTaskFormField

  addTask = async () => {
    let { title, important, urgent, objective } = this.form.value;

    if(title && important && urgent && objective)
      await this.addTaskServices.addTask(
        objective,
        title,
        important,
        urgent
      );
  }

}
