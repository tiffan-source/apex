import { Component, inject, input, output, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ObjectiveStore } from '../../../../chore/stores/objective.store';
import { Button } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';

@Component({
  selector: 'app-add-sub-objective',
  imports: [InputTextModule, Button, SelectModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './add-sub-objective.html',
})
export class AddSubObjective {
  title: string = '';

  objectiveId = input.required<string>();
  abort = output();

  objectiveStore = inject(ObjectiveStore);

  addSubObjective() {
    // Un sous-objectif sans titre est inutilisable dans les listes
    const title = this.title.trim();
    if (!title) return;

    this.objectiveStore.addSubObjective({ objectiveId: this.objectiveId(), subObjectiveTitle: title });
    this.title = '';
  }

}
