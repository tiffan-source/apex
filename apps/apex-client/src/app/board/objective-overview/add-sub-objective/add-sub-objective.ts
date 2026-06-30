import { Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { AddSubObjectiveServices } from './add-sub-objective.services';

@Component({
  selector: 'app-add-sub-objective',
  imports: [Card, InputTextModule, Button, SelectModule, FormsModule],
  templateUrl: './add-sub-objective.html',
  styleUrl: './add-sub-objective.css',
})
export class AddSubObjective {
  private readonly addSubObjectiveService = inject(AddSubObjectiveServices);
  title: string = '';

  objectiveId = input.required<string>();
  abort = output();

  isAdding = this.addSubObjectiveService.isAdding;

  addSubObjective = async () => {
    await this.addSubObjectiveService.addSubObjective(this.objectiveId(), this.title);
  }
}
