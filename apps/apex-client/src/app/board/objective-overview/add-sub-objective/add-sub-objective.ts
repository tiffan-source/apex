import { Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ObjectiveStore } from 'apps/apex-client/src/chore/stores/objective.store';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';

@Component({
  selector: 'app-add-sub-objective',
  imports: [Card, InputTextModule, Button, SelectModule, FormsModule],
  templateUrl: './add-sub-objective.html',
  styleUrl: './add-sub-objective.css',
})
export class AddSubObjective {
  title: string = '';

  objectiveId = input.required<string>();
  abort = output();

  objectiveStore = inject(ObjectiveStore);

  addSubObjective() {
    this.objectiveStore.addSubObjective({ objectiveId: this.objectiveId(), subObjectiveTitle: this.title });
    this.title = '';
  }

}
