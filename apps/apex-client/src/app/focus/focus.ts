import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AvatarModule } from 'primeng/avatar';
import { avatarTone } from '@org/design-tokens';
import { FocusTaskStore } from '../../chore/stores/focus-task.store';
import { CheckboxModule } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { CardModule } from 'primeng/card';
import { ProgressBar } from 'primeng/progressbar';

@Component({
  selector: 'app-focus',
  imports: [DatePipe, DecimalPipe, AvatarModule, CheckboxModule, FormsModule, CardModule, ProgressBar],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './focus.html',
})
export class Focus {
  todayDate = new Date();

  // Carte de progression aux couleurs de la marque
  readonly progressCardTokens = { root: { background: 'var(--ds-color-accent-soft)', shadow: 'none' } };
  readonly progressBarTokens = { value: { background: 'var(--ds-color-accent)' } };
  readonly emptyAvatarTokens = avatarTone.warning;
  focusStore = inject(FocusTaskStore);
  objectivesStore = inject(ObjectiveStore);

  progression = computed(()=>{
    const taskTotal = this.focusStore.taskTotal();
    const taskDone = this.focusStore.taskDone();
    return taskTotal > 0 ? (taskDone / taskTotal) * 100 : 0;
  })

  toogleTaskDone(taskId: string, done: boolean) {
    this.objectivesStore.udpateTaskDone({ taskId, done: !done });
  }
}
