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
import { ChatDrawerStore } from 'apps/apex-client/src/chore/stores/chat-drawer.store';


@Component({
  selector: 'app-objective-overview',
  imports: [AddSubObjective, AddTask, DataViewModule, Button, CheckboxModule, TagModule, FormsModule, Chat],
  templateUrl: './objective-overview.html',
  styleUrl: './objective-overview.css',
})
export class ObjectiveOverview {
  readonly id = input.required<string>();
  private readonly objectivesStore = inject(ObjectiveStore);

  readonly objectiveOverview = computed(() => this.objectivesStore.findObjectiveOverViewById(this.id()));

  optionsObjective = computed(() => {
    return this.objectiveOverview()
    ?.subObjectives
    .map((subObjective) => ({ label: subObjective.title, value: subObjective.id }))
    || [];
  });

  displayAddSubObjective = signal(false);
  displayAddTask = signal(false);
}
