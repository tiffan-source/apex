import { Component, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { CreateObjective } from './create-objective/create-objective';
import { CardModule } from 'primeng/card';
import { DatePipe } from '@angular/common';
import { ProgressBarModule } from 'primeng/progressbar';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { Router } from '@angular/router';
import { StatsCard } from './stats-card/stats-card';
import { FocusTaskStore } from '../../chore/stores/focus-task.store';

@Component({
  selector: 'app-board',
  imports: [Button, CreateObjective, CardModule, DatePipe, ProgressBarModule, StatsCard],
  templateUrl: './board.html',
  styleUrl: './board.css',
})
export class Board {
  createObjectiveModalOpen = signal(false);
  readonly objectiveStore = inject(ObjectiveStore);
  readonly focuseStore = inject(FocusTaskStore);
  readonly router = inject(Router);
  getAllObjectives = this.objectiveStore.mainObjectivesWithProgress;

  navigateToObjective(objectiveId: string) {
    this.router.navigate(['/objective', objectiveId]);
  }
}
