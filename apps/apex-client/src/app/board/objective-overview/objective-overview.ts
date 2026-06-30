import { Component, inject, signal } from '@angular/core';
import { ObjectiveOverviewServices } from './objective-overview.services';
import { AddSubObjective } from './add-sub-objective/add-sub-objective';
import { AddTask } from './add-task/add-task';
import { DataViewModule } from 'primeng/dataview';
import { Button } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-objective-overview',
  imports: [AddSubObjective, AddTask, DataViewModule, Button, CheckboxModule, TagModule],
  providers: [ObjectiveOverviewServices],
  templateUrl: './objective-overview.html',
  styleUrl: './objective-overview.css',
})
export class ObjectiveOverview {

  private readonly services = inject(ObjectiveOverviewServices);

  addSubObjective = signal(false);
  addTask = signal(false);

  objectiveData = this.services.objectiveData;
  objectiveTasks = this.services.objectiveTasks;
  currentObjectiveId = this.services.currentObjectiveId;

  getTagValue = (importance: number, urgency: number) => {
    if (importance >= 3 && urgency >= 3) {
      return "Faire";
    } else if (importance >= 3) {
      return "Planifier";
    } else if (urgency >= 3) {
      return "Déléguer";
    } else {
      return "Supprimer";
    }
  }

  getTagSeverity = (importance: number, urgency: number) => {
    if (importance >= 3 && urgency >= 3) {
      return "danger";
    } else if (importance >= 3) {
      return "warn";
    } else if (urgency >= 3) {
      return "info";
    } else {
      return "secondary";
    }
  }
}
