import { computed, inject, Injectable } from "@angular/core";
import { ObjectiveStore } from "../../chore/stores/objective.store";

@Injectable({
  providedIn: 'root'
})
export class DailyServices {
  private readonly objectiveStore = inject(ObjectiveStore);

  mostimportantTaskOftheDay = computed(() => {
    let tasks : { id: string, title: string, objectiveTitle: string, important: number, urgent: number}[] = [];

    this.objectiveStore.objectives().forEach((objective) => {
      objective.subObjectives.forEach((subObjective) => {
        subObjective.tasks.forEach((task) => {
          tasks.push({
            id: task.id,
            title: task.title,
            objectiveTitle: subObjective.title,
            important: task.importance,
            urgent: task.urgency
          });
        });
      });
    });

    return tasks.filter((task) => task.important >= 3 && task.urgent >= 3).map((task) => {
      return {
        id: task.id,
        title: task.title,
        objectiveTitle: task.objectiveTitle
      }
    });
  });
}
