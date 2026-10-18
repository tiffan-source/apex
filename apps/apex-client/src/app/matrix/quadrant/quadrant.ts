import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';
import { EisenhowerCategory } from '@org/apex-library';
import { ObjectiveStore } from '../../../chore/stores/objective.store';

// Sévérité PrimeNG de chaque quadrant (même correspondance que les étiquettes de tâche)
const QUADRANT_SEVERITY: Record<EisenhowerCategory, 'danger' | 'warn' | 'info' | 'secondary'> = {
  [EisenhowerCategory.DO]: 'danger',
  [EisenhowerCategory.DELEGATE]: 'warn',
  [EisenhowerCategory.SCHEDULE]: 'info',
  [EisenhowerCategory.DELETE]: 'secondary',
};

@Component({
  selector: 'app-quadrant',
  imports: [CardModule, CheckboxModule, TagModule, BadgeModule, FormsModule],
  templateUrl: './quadrant.html',
})
export class Quadrant {
  private readonly objectiveStore = inject(ObjectiveStore);

  category = input.required<EisenhowerCategory>();
  label = input.required<string>();
  description = input.required<string>();
  emptyMessage = input.required<string>();

  tasks = computed(() => this.objectiveStore.tasksByEisenhowerCategory()[this.category()]);
  severity = computed(() => QUADRANT_SEVERITY[this.category()]);

  toggleTaskDone(taskId: string, done: boolean) {
    this.objectiveStore.udpateTaskDone({ taskId, done: !done });
  }
}
