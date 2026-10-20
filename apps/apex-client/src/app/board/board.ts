import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Button } from 'primeng/button';
import { CreateObjective } from './create-objective/create-objective';
import { CardModule } from 'primeng/card';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ProgressBarModule } from 'primeng/progressbar';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { RouterLink } from '@angular/router';
import { StatsCard } from './stats-card/stats-card';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { FocusTaskStore } from '../../chore/stores/focus-task.store';

@Component({
  selector: 'app-board',
  imports: [Button, CreateObjective, CardModule, DatePipe, DecimalPipe, ProgressBarModule, StatsCard, RouterLink, AvatarModule, TagModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './board.html',
})
export class Board {
  createObjectiveModalOpen = signal(false);
  readonly objectiveStore = inject(ObjectiveStore);
  readonly focuseStore = inject(FocusTaskStore);
  getAllObjectives = this.objectiveStore.mainObjectivesWithProgress;
}
