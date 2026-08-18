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
import { ObjectiveOverviewViewModel, ObjectiveViewModel, TaskViewModel } from 'apps/apex-client/src/chore/models/objective.viewmodel';
import { EditTask } from "./edit-task/edit-task";
import { EditSubObjective } from './edit-sub-objective/edit-sub-objective';

@Component({
  selector: 'app-objective-overview',
  imports: [AddSubObjective, AddTask, DataViewModule, Button, CheckboxModule, TagModule, FormsModule, Chat, EditObjective, EditTask, EditSubObjective],
  templateUrl: './objective-overview.html',
  styleUrl: './objective-overview.css',
})
export class ObjectiveOverview {
  readonly id = input.required<string>();
  private readonly objectivesStore = inject(ObjectiveStore);
  router = inject(Router);
  taskToEdit = signal<TaskViewModel | null>(null);
  subObjectiveToEdit = signal<ObjectiveViewModel | null>(null)

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

  editTask(taskId: string) {
    const task = this.objectiveOverview().tasks.find((task) => task.id === taskId) || null;
    this.taskToEdit.set(task);
  }

  editSubObjective(subObjectiveId: string) {
    const subObjective = this.objectiveOverview().subObjectives.find((subObjective) => subObjective.id === subObjectiveId) || null;
    this.subObjectiveToEdit.set(subObjective);
  }

  closeEditTask() {
    this.taskToEdit.set(null);
  }
  closeEditSubObjective() {
    this.subObjectiveToEdit.set(null)
  }
}
