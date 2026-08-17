import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { AddSubObjective } from './add-sub-objective/add-sub-objective';
import { AddTask } from './add-task/add-task';
import { DataViewModule } from 'primeng/dataview';
import { Button } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { TagModule } from 'primeng/tag';
import { FormsModule } from '@angular/forms';
import { ObjectiveStore } from "../../../chore/stores/objective.store"
import { Chat } from './chat/chat';
import { EditObjective } from "./edit-objective/edit-objective";
import { Router } from '@angular/router';
import { ObjectiveOverviewViewModel } from 'apps/apex-client/src/chore/models/objective.viewmodel';

@Component({
  selector: 'app-objective-overview',
  imports: [AddSubObjective, AddTask, DataViewModule, Button, CheckboxModule, TagModule, FormsModule, Chat, EditObjective],
  templateUrl: './objective-overview.html',
  styleUrl: './objective-overview.css',
})
export class ObjectiveOverview {
  readonly id = input.required<string>();
  private readonly objectivesStore = inject(ObjectiveStore);
  router = inject(Router);



  objectiveOverview = computed<ObjectiveOverviewViewModel>(() => this.objectivesStore.findObjectiveOverViewById(this.id()) as ObjectiveOverviewViewModel);

  optionsObjective = computed(() => {
    return this.objectiveOverview()
    ?.subObjectives
    .map((subObjective) => ({ label: subObjective.title, value: subObjective.id }))
    || [];
  });

  displayAddSubObjective = signal(false);
  displayAddTask = signal(false);

  toogleTaskDone(taskId: string, done: boolean) {
    this.objectivesStore.udpateTaskDone({ taskId, done: !done });
  }
}
