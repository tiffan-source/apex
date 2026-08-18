import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DataViewModule } from 'primeng/dataview';
import { FocusTaskStore } from '../../chore/stores/focus-task.store';
import { CheckboxModule } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';
import { ObjectiveStore } from '../../chore/stores/objective.store';
import { CardModule } from 'primeng/card';
import { ProgressBar } from 'primeng/progressbar';

@Component({
  selector: 'app-focus',
  imports: [DatePipe, DataViewModule, CheckboxModule, FormsModule, CardModule, ProgressBar],
  templateUrl: './focus.html',
  styleUrl: './focus.css',
})
export class Focus {
  todayDate = new Date();
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
